import { normalizeFabricNumber as n, summarizeFabricPurchaseOrder } from './fabric-workflow-rules-v1.mjs?v=3';
import { reportCss } from './relave-daily-report-v1.mjs?v=2';

export const purchaseReportStatuses = Object.freeze({
 '': 'Todos os status',
 ABERTA: 'Aguardando recebimento',
 PARCIAL: 'Recebimento parcial',
 AGUARDA_QUALIDADE: 'Aguardando inspeção',
 LIBERADA: 'Liberado no estoque',
 REPROVADA: 'Recebido com lote reprovado',
 COTACAO: 'Em cotação',
 CANCELADA: 'Cancelado'
});

export function formatPurchasePaymentDays(days){
 if(!Array.isArray(days)||!days.length)return '—';
 return days.join(' / ')+(days.length===1&&days[0]===1?' dia':' dias');
}

export function renderPurchaseReport(data,{supplierId,orderId,orderIds,statusFilter='',logo,issuedAt=new Date()}={}){
 const e=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const qty=value=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(value)+' m';
 const money=(value,digits=2)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:digits}).format(value);
 const date=value=>/^\d{4}-\d{2}-\d{2}/.test(value||'')?value.slice(0,10).split('-').reverse().join('/'):'—';
 const name=s=>s?.trade_name||s?.legal_name||'Fornecedor não identificado';
 const table=(headers,rows)=>rows.length?`<table><thead><tr>${headers.map(x=>`<th scope="col">${e(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${e(x===''?'—':x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'<p>Nenhum registro.</p>';
 const totals=rows=>Object.fromEntries(['ordered','received','pending','planned','balance'].map(key=>[key,rows.reduce((sum,row)=>sum+row[key],0)]));
 const selectedOrders=orderIds==null?null:new Set(orderIds);
 const rows=data.purchaseOrders.filter(o=>(!supplierId||o.supplier_id===supplierId)&&
  (!orderId||o.id===orderId)&&(!selectedOrders||selectedOrders.has(o.id))).map(o=>{
  const items=data.purchaseItems.filter(i=>i.purchase_order_id===o.id);
  const summary=summarizeFabricPurchaseOrder({orderStatus:o.status,items,receipts:data.purchaseReceipts,lots:data.lots});
  const confirmed=o.status!=='CANCELADA'&&o.logistics_stage!=='COTACAO';
  const lines=items.map((i,index)=>{
   const f=data.fabric.find(f=>f.id===i.fabric_id), standard=data.standards.find(s=>s.id===f?.standard_id);
   const ordered=n(i.ordered_m),received=n(i.received_m),pending=confirmed?Math.max(0,ordered-received):0,price=n(i.purchase_price_per_m);
   const receipts=data.purchaseReceipts.filter(r=>r.purchase_order_item_id===i.id).map(r=>({r,lot:data.lots.find(l=>l.id===r.lot_id)}));
   return {i,f,standard,ordered,received,pending,price,planned:Math.round(ordered*price*100),balance:Math.round(pending*price*100),receipts,status:summary.lines[index]?.label};
  });
  const statusKey=confirmed||o.status==='CANCELADA'?summary.status:'COTACAO';
  return {o,statusKey,supplier:data.suppliers.find(s=>s.id===o.supplier_id),lines,confirmed,...totals(lines),status:o.status!=='CANCELADA'&&o.logistics_stage==='COTACAO'?'Em cotação':summary.label};
 }).filter(row=>orderId||!statusFilter||row.statusKey===statusFilter).sort((a,b)=>String(b.o.ordered_date).localeCompare(String(a.o.ordered_date))||String(a.o.order_number).localeCompare(String(b.o.order_number),'pt-BR',{numeric:true}));
 const selected=data.suppliers.find(s=>s.id===(supplierId||rows[0]?.o.supplier_id));
 const confirmed=rows.filter(r=>r.confirmed), sum=totals(confirmed);
 const groups=new Map();
 for(const row of rows){
  const id=row.o.supplier_id;
  if(!groups.has(id))groups.set(id,[]);
  groups.get(id).push(row);
 }
 const general=!supplierId&&!orderId;
 const title=orderId?'Ordem de compra de tecido':selectedOrders?'Ordens de compra selecionadas':supplierId?'Relatório de compras por fornecedor':'Resumo geral de compras de tecido';
 const stamp=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(issuedAt);
 const safeLogo=/^data:image\/(?:png|webp);base64,[A-Za-z0-9+/=]+$/.test(logo||'')?`<img src="${logo}" alt="GAO Lavanderia">`:'<strong>GAO Lavanderia</strong>';
 const card=(label,value,caption)=>`<div><strong>${label}</strong><b>${value}</b><small>${caption}</small></div>`;
 const productName=(f,standard)=>standard?[standard.code,standard.name].join(' · '):f?.name||'Tecido não identificado';
 const supplierReference=(f)=>[f?.code,f?.name,f?.color_reference,f?.quality_code&&'Q'+f.quality_code].filter(Boolean).join(' · ')||null;
 const specifications=(f,standard)=>[f?.color,f?.composition,f?.width_m&&qty(n(f.width_m))+' de largura',standard?.gsm&&standard.gsm+' g/m²'].filter(Boolean).join(' · ')||null;
 const technicalBlock=general&&rows.length?`<section class="technical"><h2>Descrição técnica por fornecedor e produto</h2>${[...groups.values()]
 .sort((a,b)=>name(a[0].supplier).localeCompare(name(b[0].supplier),'pt-BR'))
 .map(orders=>{
  const products=new Map();
  for(const {o,lines} of orders){
   for(const {i,f,standard,ordered,price,planned} of lines){
    const key=i.fabric_id??i.id;
    if(!products.has(key))products.set(key,{f,standard,orderNumbers:new Set(),prices:new Set(),ordered:0,planned:0});
    const product=products.get(key);
    product.orderNumbers.add(o.order_number);
    product.prices.add(price);
    product.ordered+=ordered;
    product.planned+=planned;
   }
  }
  const productRows=[...products.values()].map(({f,standard,orderNumbers,prices,ordered,planned})=>[
   productName(f,standard),supplierReference(f),specifications(f,standard),[...orderNumbers].join(', '),
   qty(ordered),[...prices].sort((a,b)=>a-b).map(price=>money(price,4)).join(' / '),money(planned/100)
  ]).sort((a,b)=>a[0].localeCompare(b[0],'pt-BR'));
  return `<h3>${e(name(orders[0].supplier))}</h3>${table(['Produto GAO','Referência do fornecedor','Especificações técnicas','Ordens de compra','Quantidade','Preço/m','Subtotal'],productRows)}
  <p class="order-total"><b>Total previsto do fornecedor</b> · ${money(totals(orders).planned/100)}</p>`;
 }).join('')}<p class="order-total"><b>Total geral previsto das ordens exibidas</b> · ${money(totals(rows).planned/100)}</p>
 ${rows.some(row=>!row.confirmed)?'<p class="note">Este total soma os valores previstos de todas as ordens exibidas, incluindo cotações e cancelamentos quando presentes.</p>':''}</section>`:'';
 const details=rows.map(({o,supplier,status,lines,planned,pending,balance})=>`<section class="order"><h2>OC ${e(o.order_number)} · ${e(name(supplier))}</h2>
 <p><b>Situação</b> ${e(status)} · <b>Pedido</b> ${date(o.ordered_date)} · <b>Previsão</b> ${date(o.expected_date)}</p>
 <p><b>Condição de pagamento</b> ${e(o.payment_terms)} · <b>Prazo de pagamento</b> ${e(formatPurchasePaymentDays(o.payment_days))}</p>
 <p><b>Logística</b> ${e({COTACAO:'Cotação',CONFIRMADO:'Confirmado',EM_TRANSPORTE:'Em transporte'}[o.logistics_stage])} · <b>Transportadora</b> ${e(o.carrier||null)} · <b>Rastreio</b> ${e(o.tracking_code||null)}</p>
 ${o.notes?`<p><b>Observações</b> ${e(o.notes)}</p>`:''}
 ${lines.map(({i,f,standard,ordered,received,pending,price,planned,status:lineStatus,receipts})=>`<h3>${e(productName(f,standard))}</h3>
 <p><b>Referência do fornecedor</b> ${e(supplierReference(f))}</p>
 <p><b>Especificações</b> ${e(specifications(f,standard))}</p>
 ${table(['Situação','Pedido','Recebido','A receber','Preço previsto/m','Subtotal previsto'],[[lineStatus,qty(ordered),qty(received),qty(pending),money(price,4),money(planned/100)]])}
 ${i.expected_date?`<p><b>Previsão do item</b> ${date(i.expected_date)}</p>`:''}${i.notes?`<p><b>Observações do item</b> ${e(i.notes)}</p>`:''}
 <h4>Notas fiscais e lotes</h4>${table(['NF / lote','Recebimento','Quantidade','Frete / outros','Custo efetivo/m','Qualidade'],receipts.map(({r,lot})=>[
 [r.invoice_number||lot?.invoice_number||'NF não informada',lot?.lot_code].filter(Boolean).join(' · '),date(r.received_at||lot?.received_date),qty(n(r.quantity_received_m)),
 lot?money(n(lot.freight_cost))+' / '+money(n(lot.other_cost)):null,lot?.effective_price_per_m==null?null:money(n(lot.effective_price_per_m),4),lot?.quality_status
 ]))}`).join('')||'<p>Nenhum item registrado.</p>'}
 <p class="order-total"><b>Total previsto da ordem</b> ${money(planned/100)} · <b>Saldo a receber</b> ${qty(pending)} (${money(balance/100)})</p></section>`).join('');
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GAO · ${title}</title><style>${reportCss}
 h3,h4{break-after:avoid;margin:10px 0 4px}h3{font-size:13px}h4{font-size:11px}.order{border-top:2px solid #dbe5ed;margin-top:14px}.order-total{background:#eef5f9;padding:8px}.order p{overflow-wrap:anywhere}.cards{margin-bottom:10px}.technical{margin-top:18px;padding-top:4px;border-top:2px solid #dbe5ed}.technical th:nth-child(-n+3){width:17%}.technical th:nth-child(4){width:10%}.technical th:nth-child(n+5){width:13%}.technical .order-total{break-inside:avoid}
 </style></head><body><div class="print"></div><main><header><div class="brand">${safeLogo}<span>GESTÃO DE COMPRAS</span></div><h1>${title}</h1><p>Emissão ${e(stamp)}${general?'':' · '+e(name(selected))}</p>${selectedOrders?`<p>Ordens selecionadas · ${e(rows.map(row=>row.o.order_number).join(', ')||'—')}</p>`:!orderId?`<p>Status do pedido · ${e(purchaseReportStatuses[statusFilter]||statusFilter)}</p>`:''}</header>
 ${selected&&!general?`<h2>Fornecedor</h2>${table(['Razão social','CNPJ','Contato','Condição de pagamento cadastrada','Prazo de entrega (dias)'],[[selected.legal_name,selected.cnpj,selected.contact,selected.payment_terms,selected.lead_days]])}`:''}
 ${!orderId?`<div class="cards">${card('Ordens registradas',rows.length,confirmed.length+' confirmadas')}${card('Volume confirmado',qty(sum.ordered),qty(sum.received)+' recebidos · '+qty(sum.pending)+' a receber')}${card('Valor previsto confirmado',money(sum.planned/100),money(sum.balance/100)+' referente ao saldo a receber')}</div><p class="note">Os totais confirmados excluem cotações e cancelamentos.</p>`:''}
 ${general?`<h2>Resumo por fornecedor</h2>${!rows.length?'<p>Nenhuma ordem de compra encontrada para os filtros selecionados.</p>':''}${table(['Fornecedor','OC registradas','Pedido','Recebido','A receber','Valor previsto'],[...groups.values()].map(group=>{
 const t=totals(group.filter(r=>r.confirmed));return [name(group[0].supplier),group.length,qty(t.ordered),qty(t.received),qty(t.pending),money(t.planned/100)];
 }).sort((a,b)=>a[0].localeCompare(b[0],'pt-BR')))}
 <h2>Ordens de compra</h2>${table(['OC / fornecedor','Pedido / previsão','Situação','Condição / prazo de pagamento','Pedido / recebido','A receber','Valor previsto'],rows.map(r=>[r.o.order_number+' · '+name(r.supplier),date(r.o.ordered_date)+' / '+date(r.o.expected_date),r.status,[r.o.payment_terms,r.o.payment_days?.length?formatPurchasePaymentDays(r.o.payment_days):null].filter(Boolean).join(' · '),qty(r.ordered)+' / '+qty(r.received),qty(r.pending),money(r.planned/100)]))}`:details||'<p>Nenhuma ordem de compra encontrada.</p>'}
 ${technicalBlock}
 </main></body></html>`;
}
