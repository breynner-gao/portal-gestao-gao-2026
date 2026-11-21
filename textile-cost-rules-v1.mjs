import {normalizeFabricNumber as n} from './fabric-workflow-rules-v1.mjs?v=3';
export const costCategories=[['fabric','Tecidos','#2587be'],['faction','Facção','#168779'],['ready','Produtos prontos','#8a65c3'],['extras','Aviamentos e insumos','#7d8d9e']];
export const cents=value=>Math.round(n(value)*100);
export const monthOf=date=>/^\d{4}-\d{2}-\d{2}/.test(String(date||''))?String(date).slice(0,7):null;
export function shiftMonth(month,offset){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+offset,1)).toISOString().slice(0,7);}
export function localDay(value){if(!value)return null;if(/^\d{4}-\d{2}-\d{2}$/.test(String(value)))return value;const date=new Date(value);if(!Number.isFinite(+date))return null;return new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
const unique=rows=>[...new Map((rows||[]).map((r,i)=>[r.id??'row-'+i,r])).values()];
export function buildTextileCosts(state,{month,today}={}){
 month||=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date());today||=localDay(new Date().toISOString());
 const actual=[],planned=[],warnings=[];
 const lots=unique(state.lots),fabric=unique(state.fabric),orders=unique(state.orders),items=unique(state.items),returns=unique(state.returns),cuts=unique(state.cuts),plans=unique(state.cutPlans),po=unique(state.purchaseOrders),lines=unique(state.purchaseItems),receipts=unique(state.purchaseReceipts),ready=unique(state.pieceOrders),readyReceipts=unique(state.pieceReceipts),suppliers=unique(state.suppliers);
 const supplier=id=>{const s=suppliers.find(s=>s.id===id);return s?.trade_name||s?.legal_name||'Fornecedor a informar';};
 const fabricName=id=>{const f=fabric.find(f=>f.id===id);return f?[f.internal_name||f.name,f.color_reference,f.quality_code&&'Q'+f.quality_code].filter(Boolean).join(' · '):'Tecido a identificar';};
 const push=(target,row)=>{row.month=monthOf(row.date);row.overdue=target===planned&&row.date&&row.date<today;target.push(row);};
 // Received lot is the single source for fabric expenditure. PO receipts only identify it.
 for(const lot of lots){
  const source=receipts.find(r=>r.lot_id===lot.id),line=lines.find(l=>l.id===source?.purchase_order_item_id),order=po.find(o=>o.id===line?.purchase_order_id);
  const quantity=n(lot.quantity_received_m);const price=lot.effective_price_per_m!=null?n(lot.effective_price_per_m):n(lot.purchase_price_per_m)+(quantity?(n(lot.freight_cost)+n(lot.other_cost))/quantity:0);
  // Opening stock without an invoice is not a new purchase in the dashboard.
  if(!source&&!String(lot.invoice_number||'').trim()){warnings.push({kind:'opening',name:lot.lot_code||lot.id});continue;}
  push(actual,{id:'fabric:'+lot.id,category:'fabric',date:localDay(lot.received_date),description:fabricName(lot.fabric_id),document:'NF '+(lot.invoice_number||source?.invoice_number||'a informar')+' · lote '+lot.lot_code,order:order?'OC '+order.order_number:'Entrada direta',supplier:supplier(lot.supplier_id),quantity,unit:'m',price,amount:cents(quantity*price),basis:'Quantidade recebida × custo efetivo do lote'});
 }
 // Canceled orders retain genuine historical receipts. Only their future balance is canceled.
 for(const receipt of readyReceipts){const order=ready.find(o=>o.id===receipt.order_id);if(!order){warnings.push({kind:'orphan',name:receipt.id});continue;}const quantity=n(receipt.accepted_pieces),price=n(receipt.unit_price);push(actual,{id:'ready:'+receipt.id,category:'ready',date:localDay(receipt.received_date),description:order.product_name,document:'NF '+(receipt.invoice_number||'a informar'),order:'OC '+order.order_number,supplier:supplier(order.supplier_id),quantity,unit:'pç',price,amount:cents(quantity*price),basis:'Peças aceitas × preço registrado no recebimento'});}
 for(const record of returns){const item=items.find(i=>i.id===record.order_item_id),order=orders.find(o=>o.id===item?.order_id);const date=localDay(record.returned_at);for(const [category,field] of [['faction','faction_cost_amount'],['extras','extras_cost_amount']]){
  const amount=cents(record[field]);if(!amount)continue;push(actual,{id:category+':'+record.id,category,date,description:item?.product_name||'Produto a identificar',document:'Entrega '+record.id.slice(0,8),order:'OS '+(order?.order_number||'a informar'),supplier:category==='faction'?'Facção':'Aviamentos / insumos',quantity:n(record.accepted_pieces)+n(record.rejected_pieces),unit:'pç',price:null,amount,basis:'Custo efetivamente informado na entrega da facção'});
 }}
 for(const order of po.filter(o=>!['CANCELADA','CONCLUIDA','RECEBIDA','ENCERRADA'].includes(o.status)&&o.logistics_stage!=='COTACAO'))for(const line of lines.filter(l=>l.purchase_order_id===order.id)){
  const detailed=receipts.filter(r=>r.purchase_order_item_id===line.id).reduce((s,r)=>s+n(r.quantity_received_m),0),received=Math.max(n(line.received_m),detailed),quantity=Math.max(0,n(line.ordered_m)-received);if(!quantity)continue;
  const date=localDay(line.expected_date||order.expected_date);push(planned,{id:'fabric-po:'+line.id,category:'fabric',date,description:fabricName(line.fabric_id),document:'Saldo a receber',order:'OC '+order.order_number,supplier:supplier(order.supplier_id),quantity,unit:'m',price:n(line.purchase_price_per_m),amount:cents(quantity*n(line.purchase_price_per_m)),basis:'Metros pendentes × preço do item do pedido'});
 }
 for(const order of ready.filter(o=>!['CANCELADA','CONCLUIDA','RECEBIDA','ENCERRADA'].includes(o.status))){const detailed=readyReceipts.filter(r=>r.order_id===order.id).reduce((s,r)=>s+n(r.accepted_pieces),0),quantity=Math.max(0,n(order.ordered_pieces)-Math.max(n(order.received_pieces),detailed));if(!quantity)continue;push(planned,{id:'ready-po:'+order.id,category:'ready',date:localDay(order.expected_date),description:order.product_name,document:'Saldo a receber',order:'OC '+order.order_number,supplier:supplier(order.supplier_id),quantity,unit:'pç',price:n(order.unit_price),amount:cents(quantity*n(order.unit_price)),basis:'Peças pendentes × preço do pedido'});}
 // Production only adds service/extras provisions. Fabric procurement is already above.
 for(const item of items){const order=orders.find(o=>o.id===item.order_id);if(!order||['CANCELADA','CONCLUIDA','ENCERRADA'].includes(order.status))continue;
  const history=returns.filter(r=>r.order_item_id===item.id),done=history.reduce((s,r)=>s+n(r.accepted_pieces)+n(r.rejected_pieces),0);let remaining=Math.max(0,n(item.ordered_pieces)-done);if(!remaining)continue;
  const buckets=[];let legacyDone=history.filter(r=>!r.cut_batch_id).reduce((s,r)=>s+n(r.accepted_pieces)+n(r.rejected_pieces),0);
  const itemCuts=cuts.filter(c=>c.order_item_id===item.id&&!plans.some(p=>p.cut_id===c.id&&['CANCELADO','CANCELADA','SUBSTITUIDO'].includes(p.status))).sort((a,b)=>String(a.sent_date||a.created_at).localeCompare(String(b.sent_date||b.created_at)));
  for(const cut of itemCuts){const cutDone=history.filter(r=>r.cut_batch_id===cut.id).reduce((s,r)=>s+n(r.accepted_pieces)+n(r.rejected_pieces),0);let pending=Math.max(0,n(cut.produced_pieces)-cutDone);const used=Math.min(pending,legacyDone);legacyDone-=used;pending-=used;pending=Math.min(pending,remaining);if(!pending)continue;
   const plan=plans.find(p=>p.cut_id===cut.id),date=localDay(plan?.sewing_due_set?plan.sewing_due_on:cut.expected_date);buckets.push({key:cut.id,quantity:pending,date});remaining-=pending;
  }
  if(remaining)buckets.push({key:'unplanned',quantity:remaining,date:null});
  for(const bucket of buckets)for(const [category,field] of [['faction','faction_cost_per_piece'],['extras','extras_cost_per_piece']]){
   if(item[field]==null||item[field]===''){warnings.push({kind:'price',name:item.product_name,category});continue;}
   const price=n(item[field]);if(price===0){if(category==='faction')warnings.push({kind:'zero',name:item.product_name,category});continue;}
   push(planned,{id:category+':'+item.id+':'+bucket.key,category,date:bucket.date,description:item.product_name,document:bucket.key==='unplanned'?'Saldo da OS sem lote programado':'Lote '+bucket.key.slice(0,8),order:'OS '+order.order_number,supplier:category==='faction'?'Facção':'Aviamentos / insumos',quantity:bucket.quantity,unit:'pç',price,amount:cents(bucket.quantity*price),basis:'Peças pendentes × custo unitário gravado na OS'});
  }
 }
 for(const row of [...actual,...planned])if(!Number.isSafeInteger(row.amount))warnings.push({kind:'amount',name:row.description});
 const months=Array.from({length:12},(_,i)=>shiftMonth(month,i-5));
 const sum=rows=>rows.reduce((s,r)=>s+r.amount,0),byCategory=rows=>Object.fromEntries(costCategories.map(([k])=>[k,sum(rows.filter(r=>r.category===k))]));
 const monthly=months.map(m=>{const a=actual.filter(r=>r.month===m),p=planned.filter(r=>r.month===m);return {month:m,actual:byCategory(a),planned:byCategory(p),actualTotal:sum(a),plannedTotal:sum(p),count:a.length+p.length};});
 return {month,today,actual,planned,monthly,undated:planned.filter(r=>!r.month),undatedActual:actual.filter(r=>!r.month),overdue:planned.filter(r=>r.overdue),warnings,totals:{actual:sum(actual.filter(r=>r.month===month)),planned:sum(planned.filter(r=>r.month===month)),future:sum(planned.filter(r=>r.month>month&&r.month<=shiftMonth(month,6))),undated:sum(planned.filter(r=>!r.month)),overdue:sum(planned.filter(r=>r.overdue))}};
}
