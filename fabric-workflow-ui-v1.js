import { fabricCatalogVariantKey, fabricInvoiceAliasKey, summarizeFabricPurchaseOrder } from '/fabric-workflow-rules-v1.mjs';
(() => {
'use strict';
const SB='https://fquzuxdqvhecijjuxbmg.supabase.co';
const KEY='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>{const x=Number(String(v??'').trim().replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'));return Number.isFinite(x)?x:0};
const br=(v,d=2)=>n(v).toLocaleString('pt-BR',{maximumFractionDigits:d});
const uid=()=>crypto.randomUUID();
const state={org:null,session:null,tab:'demand',fabric:[],suppliers:[],recipes:[],lots:[],orders:[],items:[],moves:[],returns:[],purchaseOrders:[],purchaseItems:[],purchaseReceipts:[],aliases:[],busy:false,error:'',snapshot:[],mode:false};
const style=document.createElement('style');style.textContent='.fw-shell{margin:14px 0;color:#082d52}.fw-head,.fw-panel{background:#fff;border:1px solid #d5e2ef;border-radius:12px;padding:16px;margin:10px 0}.fw-head{display:flex;justify-content:space-between;align-items:center;background:#eef7ff}.fw-head small{font-weight:900;letter-spacing:.12em;color:#0879c9}.fw-head h2{margin:5px 0}.fw-head p,.fw-panel p{color:#54708e;margin:6px 0 12px}.fw-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.fw-tabs button,.fw-panel button{border:0;border-radius:8px;background:#3188cc;color:white;padding:9px 12px;font-weight:800}.fw-tabs button{background:#fff;color:#174a78;border:1px solid #b9d1e8}.fw-tabs button.active{background:#3188cc;color:white}.fw-panel h3{margin:0 0 10px}.fw-panel table{width:100%;border-collapse:collapse;min-width:780px;font-size:13px}.fw-panel th,.fw-panel td{text-align:left;padding:9px;border-bottom:1px solid #e7eef5;vertical-align:top}.fw-panel th{background:#f3f8fd;color:#54708e}.fw-panel td small{display:block;color:#7890a8;margin-top:4px}.fw-po-line{display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:100%}.fw-po-order{border-top:1px solid #e7eef5;padding-top:8px;margin-top:12px}.fw-status{display:inline-block;background:#eef5fb;border-radius:999px;padding:4px 9px;color:#174a78;font-size:12px;font-weight:800}.fw-po-summary{grid-template-columns:repeat(5,1fr);margin:12px 0}.fw-po-order h4{margin:8px 0}.fw-purchase-orders>form{margin:10px 0 14px}.fw-panel form{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.fw-panel input,.fw-panel select{padding:9px;border:1px solid #b9d1e8;border-radius:8px;min-width:150px}.fw-panel form button{min-height:38px}.fw-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.fw-cards article{background:#fff;border:1px solid #d5e2ef;border-radius:10px;padding:14px}.fw-cards small,.fw-cards b{display:block}.fw-cards small{color:#54708e}.fw-cards b{font-size:22px;margin-top:7px}.fw-error{background:#fff0f0;border:1px solid #f4bcbc;color:#9b1c1c;padding:10px;border-radius:8px}.fw-note{padding:10px;color:#54708e}.fw-table-scroll{overflow:auto}.fw-catalog-edit{border:1px solid #e1eaf3;border-radius:9px;padding:10px;margin:8px 0}.fw-catalog-edit summary{cursor:pointer}.fw-catalog-edit form{margin-top:10px}.fw-catalog-edit label,.fw-panel form label{display:flex;gap:6px;align-items:center}.fw-alias-row{border-bottom:1px solid #e7eef5;padding:8px}#gao-linen-risk-shell.fw-mode>.lr150-shell>:not(.lr150-top):not(.lr150-dimension-nav){display:none!important}#gao-linen-risk-shell>#gao-fabric-flow:not([hidden]){display:block!important}@media(max-width:760px){.fw-cards{grid-template-columns:1fr}.fw-po-summary{grid-template-columns:1fr}.fw-panel form input,.fw-panel form select{width:100%}.fw-head{align-items:start;gap:8px;flex-direction:column}}';document.head.appendChild(style);
const headers=()=>({apikey:KEY,Authorization:'Bearer '+state.session.access_token,'Content-Type':'application/json',Prefer:'return=representation'});
async function api(path,opts={}){const r=await fetch(SB+path,{...opts,headers:{...headers(),...(opts.headers||{})}});const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw Error(d?.message||d?.details||d?.hint||String(d||'Falha no Supabase'));return d}
async function rpc(name,args){return api('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(args)})}
async function init(){
 await window.GAO_AUTH_READY;state.session=window.GAO_AUTH_SESSION;
 if(!state.session?.access_token)throw Error('Sessão do Portal não encontrada.');
 const user=state.session.user?.id;if(!user)throw Error('Usuário da sessão não identificado.');
 const m=await api('/rest/v1/memberships?select=organization_id,role_name,organizations!inner(kind,active)&profile_id=eq.'+encodeURIComponent(user)+'&active=eq.true');
 const org=(m||[]).find(x=>x.organizations?.active&&x.organizations?.kind==='gao');
 if(!org)throw Error('Sua conta não possui vínculo ativo com a organização GAO.');
 state.org=org.organization_id;
 await reload();
}
async function reload(){
 const tables=[
  ['fabric_catalog','created_at'],['fabric_suppliers','created_at'],['fabric_product_recipes','created_at'],
  ['fabric_lots','created_at'],['fabric_production_orders','created_at'],
  ['fabric_production_order_items','created_at'],['fabric_stock_movements','created_at'],['fabric_faction_returns','returned_at'],['fabric_purchase_orders','ordered_date'],['fabric_purchase_order_items','created_at'],['fabric_purchase_order_receipts','received_at'],['fabric_catalog_aliases','updated_at']
 ];
 const [fabric,suppliers,recipes,lots,orders,items,moves,returns,purchaseOrders,purchaseItems,purchaseReceipts,aliases]=await Promise.all(tables.map(([t,order])=>api('/rest/v1/'+t+'?select=*&organization_id=eq.'+state.org+'&order='+order+'.desc')));
 Object.assign(state,{fabric,suppliers,recipes,lots,orders,items,moves,returns,purchaseOrders,purchaseItems,purchaseReceipts,aliases});
 state.snapshot=window.GAO_LINEN_NEED_SNAPSHOT||state.snapshot||[];
}
function liveBalances(){
 return state.lots.map(l=>{const ms=state.moves.filter(m=>m.lot_id===l.id);return {...l,onhand:ms.reduce((a,m)=>a+n(m.stock_delta_m),0),reserved:ms.reduce((a,m)=>a+n(m.reserved_delta_m),0)}})
}
function orderStats(item){
 const ms=state.moves.filter(m=>m.order_item_id===item.id&&m.movement_type==='ENVIO_FACCAO');
 const issued=ms.reduce((a,m)=>a+n(m.quantity_m),0),fabricCost=ms.reduce((a,m)=>a+n(m.quantity_m)*n(m.unit_cost_per_m),0);
 const rs=state.returns.filter(r=>r.order_item_id===item.id),accepted=rs.reduce((a,r)=>a+n(r.accepted_pieces),0),rejected=rs.reduce((a,r)=>a+n(r.rejected_pieces),0);
 const returned=rs.reduce((a,r)=>a+n(r.returned_m),0),faction=rs.reduce((a,r)=>a+n(r.faction_cost_amount),0),extras=rs.reduce((a,r)=>a+n(r.extras_cost_amount),0);
 const returnCost=rs.reduce((a,r)=>a+n(r.returned_m)*n(state.lots.find(l=>l.id===r.lot_id)?.effective_price_per_m),0);
 const theoretical=(accepted+rejected)*n(item.consumption_m_per_piece),loss=Math.max(0,issued-returned-theoretical);
 const usedFabricCost=Math.max(0,fabricCost-returnCost),unitCost=issued?fabricCost/issued:0;
 const totalCost=usedFabricCost+faction+extras;
 return {issued,accepted,rejected,returned,faction,extras,theoretical,loss,lossCost:loss*unitCost,unit:accepted?totalCost/accepted:null,remaining:Math.max(0,n(item.ordered_pieces)-accepted-rejected)};
}
function render(){
 const host=document.querySelector('#gao-fabric-flow');if(!host)return;host.hidden=!state.mode;
 const tabs=[['demand','Necessidade e facção'],['stock','Tecido e compras'],['recipes','Ficha técnica'],['cost','Custos e perdas']];
 const buttons=tabs.map(([id,label])=>'<button type="button" data-fw-tab="'+id+'" class="'+(state.tab===id?'active':'')+'">'+label+'</button>').join('');
 const body=state.tab==='demand'?demandView():state.tab==='stock'?stockView():state.tab==='recipes'?recipeView():costView();
 host.innerHTML='<section class="fw-shell"><header class="fw-head"><div><small>ENXOVAL • PRODUÇÃO TÊXTIL</small><h2>Fluxo de tecido e facção</h2><p>Demanda atual ligada a estoque, compra, produção e custo real.</p></div><button type="button" data-fw-refresh>Atualizar dados</button></header><nav class="fw-tabs">'+buttons+'</nav>'+(state.error?'<div class="fw-error">'+esc(state.error)+'</div>':'')+(state.busy?'<div class="fw-note">Salvando no banco…</div>':'')+body+'</section>';
}
function demandView(){
 const snap=window.GAO_LINEN_NEED_SNAPSHOT||state.snapshot||[];
 const balances=liveBalances();
 const pending=state.items.reduce((a,i)=>a+orderStats(i).remaining,0);
 const rows=snap.filter(x=>n(x.pedidoReal)>0).map(x=>{
  const rec=state.recipes.find(r=>r.active&&r.product_reference===String(x.produtoId||x.produtoNome));
  const cov=state.items.filter(i=>i.source_item_key===String(x.produtoId||x.produtoNome)&&['ABERTA','PARCIAL','ENVIADA'].includes(state.orders.find(o=>o.id===i.order_id)?.status)).reduce((a,i)=>a+n(i.ordered_pieces),0);
  const missing=Math.max(0,n(x.pedidoReal)-cov);
  const meters=missing*n(rec?.consumption_m_per_piece);
  const bal=rec?balances.filter(b=>b.fabric_id===rec.fabric_id&&b.quality_status==='APROVADO').reduce((a,b)=>a+b.onhand-b.reserved,0):0;
  return '<tr><td><b>'+esc(x.produtoNome)+'</b><small>'+esc(x.produtoId||'sem código')+'</small></td><td>'+br(x.pedidoReal,0)+' pç</td><td>'+esc(rec?br(rec.consumption_m_per_piece,3)+' m/peça':'Sem ficha técnica')+'</td><td>'+br(cov,0)+' pç</td><td>'+br(missing,0)+' pç</td><td>'+br(meters,2)+' m</td><td>'+br(bal,2)+' m</td><td>'+(missing&&rec?'<input class="fw-check" type="checkbox" data-fw-demand="'+esc(x.produtoId||x.produtoNome)+'" checked>':'—')+'</td></tr>'
 }).join('');
 return '<div class="fw-cards"><article><small>Peças pedidas</small><b>'+br(snap.reduce((a,x)=>a+n(x.pedidoReal),0),0)+'</b></article><article><small>Peças em produção</small><b>'+br(pending,0)+'</b></article><article><small>Tecidos cadastrados</small><b>'+state.fabric.length+'</b></article></div><div class="fw-panel"><h3>Gerar ordem sem duplicar pedido de peça</h3><p>O saldo de pedidos ativos é abatido da necessidade; o cálculo de tecido usa o consumo cadastrado por peça.</p><table><thead><tr><th>Peça</th><th>Necessidade</th><th>Consumo padrão</th><th>Já coberto</th><th>Falta pedir</th><th>Tecido estimado</th><th>Saldo tecido</th><th>Incluir</th></tr></thead><tbody>'+ (rows||'<tr><td colspan="8">Sem demanda de peças carregada. Abra o painel de Enxoval e atualize a base RFID.</td></tr>')+'</tbody></table><button type="button" data-fw-create-order>Gerar ordem de facção para selecionados</button></div><div class="fw-panel"><h3>Ordens abertas</h3>'+ordersTable()+'</div>';
}
function ordersTable(){const rows=state.items.map(i=>{const o=state.orders.find(x=>x.id===i.order_id),s=orderStats(i),needed=n(i.ordered_pieces)*n(i.consumption_m_per_piece),r=state.recipes.find(x=>x.id===i.recipe_id);return '<tr><td>#'+esc(o?.order_number||'—')+' • '+esc(i.product_name)+'<small>Ref. '+esc(state.fabric.find(f=>f.id===i.fabric_id)?.color_reference||'—')+' • Q'+esc(state.fabric.find(f=>f.id===i.fabric_id)?.quality_code||'—')+'</small></td><td>'+br(i.ordered_pieces,0)+' pç</td><td>'+br(needed,2)+' m</td><td>'+br(s.issued,2)+' m enviados</td><td>'+br(s.accepted,0)+' aceitas / '+br(s.rejected,0)+' rejeitadas</td><td>'+(r&&s.issued+0.0005<needed?'<button type="button" data-fw-ship="'+i.id+'">'+(s.issued?'Completar envio':'Enviar tecido')+'</button>':'')+' <button type="button" data-fw-return="'+i.id+'">Lançar retorno</button></td></tr>'}).join('');return '<div class="fw-table-scroll"><table><thead><tr><th>Ordem / item</th><th>Peças</th><th>Tecido previsto</th><th>Envio</th><th>Retorno</th><th>Ação</th></tr></thead><tbody>'+ (rows||'<tr><td colspan="6">Nenhuma ordem gravada.</td></tr>')+'</tbody></table></div>'}
function poLineHtml(){
 return '<div data-fw-po-line class="fw-po-line"><select name="fabric_id" required><option value="">Tecido • cor • Q</option>'+state.fabric.map(f=>'<option value="'+f.id+'">'+esc(f.code+' • '+f.name+(f.color?' • '+f.color:'')+(f.color_reference?' • Ref. '+f.color_reference:'')+(f.quality_code?' • Q'+f.quality_code:''))+'</option>').join('')+'</select><input name="ordered_m" type="number" min=".001" step=".001" placeholder="Quantidade do pedido (m)" required><input name="purchase_price_per_m" type="number" min="0" step=".0001" placeholder="Preço previsto R$/m" required><button type="button" data-fw-remove-po-line>Remover</button></div>';
}
function purchaseOrderView(){
 const summarized=state.purchaseOrders.map(order=>({
  order,
  summary:summarizeFabricPurchaseOrder({
   orderStatus:order.status,
   items:state.purchaseItems.filter(item=>item.purchase_order_id===order.id),
   receipts:state.purchaseReceipts,
   lots:state.lots
  })
 }));
 const count=status=>summarized.filter(x=>x.summary.status===status).length;
 const inspectionCount=summarized.filter(x=>x.summary.lines.some(line=>line.quality==='PENDENTE')).length;
 const cards='<div class="fw-cards fw-po-summary"><article><small>Aguardando recebimento</small><b>'+count('ABERTA')+'</b></article><article><small>Recebimento parcial</small><b>'+count('PARCIAL')+'</b></article><article><small>Aguardando inspeção</small><b>'+inspectionCount+'</b></article><article><small>Liberado no estoque</small><b>'+count('LIBERADA')+'</b></article><article><small>Cancelado</small><b>'+count('CANCELADA')+'</b></article></div>';
 const rows=summarized.map(({order,summary})=>{
  const supplier=state.suppliers.find(item=>item.id===order.supplier_id);
  const lines=state.purchaseItems.filter(item=>item.purchase_order_id===order.id);
  const lineRows=lines.map(item=>{
   const fabric=state.fabric.find(x=>x.id===item.fabric_id);
   const line=summary.lines.find(x=>String(x.id)===String(item.id));
   const canReceive=order.status!=='CANCELADA'&&n(item.ordered_m)-n(item.received_m)>0.0005;
   return '<tr><td>'+esc(fabric?.code+' • '+fabric?.name+' • Ref. '+(fabric?.color_reference||'—')+' • Q'+(fabric?.quality_code||'—'))+'</td><td>'+br(item.ordered_m,3)+' m</td><td>'+br(item.received_m,3)+' m</td><td><b>'+br(Math.max(0,n(item.ordered_m)-n(item.received_m)),3)+' m</b></td><td>R$ '+br(item.purchase_price_per_m,4)+'/m</td><td><span class="fw-status">'+esc(line?.label||'Status não identificado')+'</span></td><td>'+(canReceive?'<button type="button" data-fw-receive-po-item="'+item.id+'">Registrar recebimento</button>':'—')+'</td></tr>';
  }).join('');
  return '<div class="fw-po-order"><h4>Pedido '+esc(order.order_number)+' • '+esc(supplier?.trade_name||supplier?.legal_name||'Fornecedor')+' <span class="fw-status">'+esc(summary.label)+'</span></h4><p>Pedido em '+esc(order.ordered_date||'—')+' • Previsão '+esc(order.expected_date||'não informada')+' • Total recebido '+br(summary.receivedMeters,3)+' / '+br(summary.orderedMeters,3)+' m</p><div class="fw-table-scroll"><table><thead><tr><th>Tecido / referência / Q</th><th>Pedido</th><th>Recebido</th><th>Pendente</th><th>Preço previsto</th><th>Status do item</th><th>Ação</th></tr></thead><tbody>'+lineRows+'</tbody></table></div></div>';
 }).join('');
 return '<div class="fw-panel fw-purchase-orders"><h3>Acompanhamento geral dos pedidos de tecido</h3><p>Fluxo: necessidade/cotação → pedido emitido → recebimento parcial ou total → inspeção do lote → aprovação e liberação para estoque. Pedido aberto não entra no saldo; lote recebido pendente de inspeção fica separado do tecido liberado.</p>'+cards+(rows||'<p>Nenhum pedido de tecido registrado ainda.</p>')+'<h3>Registrar novo pedido</h3><form data-fw-form="purchaseOrder"><input name="order_number" placeholder="Número do pedido / OC" required><select name="supplier_id" required><option value="">Fornecedor</option>'+state.suppliers.map(x=>'<option value="'+x.id+'">'+esc(x.trade_name||x.legal_name)+'</option>').join('')+'</select><input name="ordered_date" type="date" value="'+new Date().toISOString().slice(0,10)+'" required><input name="expected_date" type="date" aria-label="Previsão de entrega"><input name="notes" placeholder="Observação (opcional)"><div data-fw-po-lines>'+poLineHtml()+'</div><button type="button" data-fw-add-po-line>Adicionar tecido/cor</button><button type="submit">Registrar pedido de tecido</button></form></div>';
}
async function receivePurchaseItem(id){
 const item=state.purchaseItems.find(x=>x.id===id);if(!item)throw Error('Item do pedido não encontrado.');
 const pending=n(item.ordered_m)-n(item.received_m);
 const qty=prompt('Quantidade recebida fisicamente em metros (saldo pendente: '+br(pending,3)+' m):',String(pending));if(qty===null)return;
 const lot=prompt('Código do lote recebido:','');if(lot===null||!lot.trim())return;
 const invoice=prompt('Número da NF (opcional):','');if(invoice===null)return;
 const order=state.purchaseOrders.find(x=>x.id===item.purchase_order_id),fabric=state.fabric.find(x=>x.id===item.fabric_id);
 const known=state.aliases.find(a=>a.active!==false&&a.homologated&&a.fabric_id===item.fabric_id&&(!order?.supplier_id||a.supplier_id===order.supplier_id));
 const invoiceCode=prompt('Código do item como aparece na NF (opcional):',known?.supplier_item_code||'');if(invoiceCode===null)return;
 const invoiceDesc=prompt('Descrição do item exatamente como aparece na NF (opcional):',known?.supplier_item_description||'');if(invoiceDesc===null)return;
 const invoiceRef=prompt('Referência de cor como aparece na NF (opcional):',known?.invoice_color_reference||'');if(invoiceRef===null)return;
 const invoiceQ=prompt('Qualidade Q como aparece na NF (opcional):',known?.invoice_quality_code||'');if(invoiceQ===null)return;
 if(invoiceCode||invoiceDesc||invoiceRef||invoiceQ){const homologated=confirm('Confirma que este código/descrição da NF corresponde ao padrão '+(fabric?.color_reference||'—')+' / Q'+(fabric?.quality_code||'—')+'? OK homologa; Cancelar salva como pendente.');await saveAliasMapping({fabric_id:item.fabric_id,supplier_id:order?.supplier_id,supplier_item_code:invoiceCode,supplier_item_description:invoiceDesc,invoice_color_reference:invoiceRef,invoice_quality_code:invoiceQ,source_invoice_number:invoice,homologated},null);}
 const received=prompt('Data do recebimento (AAAA-MM-DD):',new Date().toISOString().slice(0,10));if(received===null)return;
 const freight=prompt('Frete desta entrega (R$):','0');if(freight===null)return;
 const other=prompt('Outros custos desta entrega (R$):','0');if(other===null)return;
 return rpc('fabric_receive_purchase_order_item',{p_organization_id:state.org,p_purchase_order_item_id:id,p_quantity_m:n(qty),p_lot_code:lot.trim(),p_invoice_number:invoice.trim()||null,p_received_date:received||null,p_freight_cost:n(freight),p_other_cost:n(other),p_idempotency_key:'fabric-po-receipt-'+id+'-'+uid()});
}
function catalogOptionList(selected=''){
 return '<option value="">Selecione tecido homologado</option>'+state.fabric.filter(f=>f.active).map(f=>'<option value="'+f.id+'" '+(f.id===selected?'selected':'')+'>'+esc(f.code+' • '+f.name+' • '+(f.color||'cor não informada')+' • Ref. '+(f.color_reference||'—')+' • Q'+(f.quality_code||'—')+(f.homologated?' • HOMOLOGADO':' • PENDENTE'))+'</option>').join('');
}
function supplierOptionList(selected=''){
 return '<option value="">Fornecedor não identificado</option>'+state.suppliers.map(s=>'<option value="'+s.id+'" '+(s.id===selected?'selected':'')+'>'+esc(s.trade_name||s.legal_name)+'</option>').join('');
}
function catalogManagementView(){
 const catalogRows=state.fabric.map(f=>'<details class="fw-catalog-edit"><summary><b>'+esc(f.code+' • '+f.name)+'</b> — '+esc(f.color||'cor não informada')+' • Ref. '+esc(f.color_reference||'—')+' • Q'+esc(f.quality_code||'—')+' <span class="fw-status">'+(f.homologated?'HOMOLOGADO':'PENDENTE DE HOMOLOGAÇÃO')+'</span></summary><form data-fw-form="catalogEdit"><input type="hidden" name="id" value="'+f.id+'"><input name="code" aria-label="Código GAO ou fabricante" placeholder="Código" value="'+esc(f.code)+'" required><input name="name" aria-label="Nome oficial do tecido" placeholder="Nome oficial" value="'+esc(f.name)+'" required><input name="fabric_type" aria-label="Fornecedor e tipo" placeholder="Fornecedor e tipo" value="'+esc(f.fabric_type||'')+'"><input name="composition" aria-label="Composição" placeholder="Composição" value="'+esc(f.composition||'')+'"><input name="color" aria-label="Cor homologada" placeholder="Cor homologada" value="'+esc(f.color||'')+'"><input name="color_reference" aria-label="Referência oficial da cor" placeholder="Ref. oficial (ex.: P53)" value="'+esc(f.color_reference||'')+'" required><input name="quality_code" aria-label="Qualidade Q" placeholder="Q (ex.: 1 ou 2)" value="'+esc(f.quality_code||'')+'" required><input name="width_m" type="number" min="0" step=".001" aria-label="Largura em metros" placeholder="Largura (m)" value="'+esc(f.width_m??'')+'"><label><input type="checkbox" name="homologated" '+(f.homologated?'checked':'')+'> Referência conferida e homologada pela GAO</label><button type="submit">Salvar padrão</button></form></details>').join('');
 const aliasRows=state.aliases.map(a=>{
  const canonical=state.fabric.find(f=>f.id===a.fabric_id);
  return '<details class="fw-catalog-edit"><summary><b>NF: '+esc(a.supplier_item_code||'sem código')+' • '+esc(a.supplier_item_description||'descrição não informada')+'</b> → '+esc(canonical?.color_reference||'ref. —')+' / Q'+esc(canonical?.quality_code||'—')+' <span class="fw-status">'+(a.active===false?'INATIVO':a.homologated?'HOMOLOGADO':'PENDENTE')+'</span></summary><form data-fw-form="aliasEdit"><input type="hidden" name="id" value="'+a.id+'"><select name="fabric_id" required>'+catalogOptionList(a.fabric_id)+'</select><select name="supplier_id">'+supplierOptionList(a.supplier_id||'')+'</select><input name="supplier_item_code" aria-label="Código na NF" placeholder="Código do item na NF" value="'+esc(a.supplier_item_code||'')+'"><input name="supplier_item_description" aria-label="Descrição exata na NF" placeholder="Descrição exata da NF" value="'+esc(a.supplier_item_description||'')+'"><input name="invoice_color_reference" aria-label="Referência na NF" placeholder="Referência como veio na NF" value="'+esc(a.invoice_color_reference||'')+'"><input name="invoice_quality_code" aria-label="Qualidade na NF" placeholder="Q como veio na NF" value="'+esc(a.invoice_quality_code||'')+'"><input name="source_invoice_number" aria-label="Número da NF" placeholder="Número da NF" value="'+esc(a.source_invoice_number||'')+'"><input name="notes" aria-label="Observação" placeholder="Observação da conferência" value="'+esc(a.notes||'')+'"><label><input type="checkbox" name="homologated" '+(a.homologated?'checked':'')+'> Vínculo conferido pela GAO</label><label><input type="checkbox" name="active" '+(a.active===false?'':'checked')+'> Vínculo ativo</label><button type="submit">Salvar vínculo</button></form></details>';
 }).join('');
 return '<div class="fw-panel"><h3>Catálogo GAO: cores e referências homologadas</h3><p>Este é o padrão oficial usado em pedidos e estoque. A descrição da NF fica separada e pode ser ligada a este padrão após conferência. Alterar um item atualiza as telas que usam seu cadastro.</p><div class="fw-table-scroll">'+(catalogRows||'<p>Nenhum tecido cadastrado.</p>')+'</div></div><div class="fw-panel"><h3>Relacionar códigos e descrições de NF</h3><p>Cadastre o texto exatamente como aparece na nota e associe ao tecido, cor, referência e Q corretos. Vínculos pendentes não entram como equivalência homologada.</p><form data-fw-form="aliasCreate"><select name="fabric_id" required>'+catalogOptionList()+'</select><select name="supplier_id">'+supplierOptionList()+'</select><input name="supplier_item_code" aria-label="Código do item na NF" placeholder="Código na NF / fornecedor"><input name="supplier_item_description" aria-label="Descrição exata da NF" placeholder="Descrição exata da NF"><input name="invoice_color_reference" aria-label="Referência da cor na NF" placeholder="Ref. como veio na NF"><input name="invoice_quality_code" aria-label="Qualidade na NF" placeholder="Q como veio na NF"><input name="source_invoice_number" aria-label="Número da NF" placeholder="Número da NF"><input name="notes" aria-label="Observação" placeholder="Observação da conferência"><label><input type="checkbox" name="homologated"> Confirmo a equivalência para homologação</label><button type="submit">Salvar relação</button></form><div class="fw-table-scroll">'+(aliasRows||'<p>Nenhum código de NF relacionado ainda.</p>')+'</div></div>';
}
function stockView(){
 const bal=liveBalances();
 const stock=state.fabric.map(f=>{
  const ls=bal.filter(b=>b.fabric_id===f.id);
  const approved=ls.filter(l=>l.quality_status==='APROVADO').reduce((a,l)=>a+l.onhand,0);
  const pending=ls.filter(l=>l.quality_status==='PENDENTE').reduce((a,l)=>a+l.onhand,0);
  const rejected=ls.filter(l=>l.quality_status==='REPROVADO').reduce((a,l)=>a+l.onhand,0);
  const reserved=ls.reduce((a,l)=>a+l.reserved,0);
  return '<tr><td><b>'+esc(f.code)+' • '+esc(f.name)+'</b><small>'+esc(f.fabric_type||'')+' '+esc(f.composition||'')+' • '+esc(f.color||'')+' • Ref. '+esc(f.color_reference||'—')+' • Q'+esc(f.quality_code||'—')+'</small></td><td>'+br(approved,2)+' m</td><td>'+br(pending,2)+' m</td><td>'+br(rejected,2)+' m</td><td>'+br(reserved,2)+' m</td><td>R$ '+br(ls.reduce((a,l)=>a+n(l.effective_price_per_m)*l.onhand,0),2)+'</td></tr>';
 }).join('');
 const lotRows=state.lots.map(l=>'<tr><td>'+esc((state.fabric.find(f=>f.id===l.fabric_id)?.name||'—')+' • Ref. '+(state.fabric.find(f=>f.id===l.fabric_id)?.color_reference||'—')+' • Q'+(state.fabric.find(f=>f.id===l.fabric_id)?.quality_code||'—'))+'</td><td>'+esc(l.lot_code)+'</td><td>'+br(l.quantity_received_m,2)+' m</td><td>R$ '+br(l.effective_price_per_m,4)+'/m</td><td>'+esc(l.quality_status)+'</td><td>'+(l.quality_status==='PENDENTE'?'<button type="button" data-fw-approve="'+l.id+'">Aprovar qualidade</button>':'—')+'</td></tr>').join('');
 return purchaseOrderView()+'<div class="fw-panel"><h3>Cadastro de tecido</h3><form data-fw-form="fabric"><input name="code" placeholder="Código" required><input name="name" placeholder="Nome do tecido" required><input name="fabric_type" placeholder="Tipo"><input name="composition" placeholder="Composição"><input name="color" placeholder="Cor (ex.: Azul céu)"><input name="color_reference" placeholder="Referência da cor (ex.: V02)" required><input name="quality_code" placeholder="Qualidade Q (ex.: 1 ou 2)" required><input name="width_m" type="number" step=".001" placeholder="Largura (m)"><label><input type="checkbox" name="homologated"> Referência conferida e homologada</label><button>Cadastrar tecido</button></form></div>'+catalogManagementView()+'<div class="fw-panel"><h3>Fornecedor</h3><form data-fw-form="supplier"><input name="legal_name" placeholder="Razão social" required><input name="trade_name" placeholder="Nome fantasia"><input name="cnpj" placeholder="CNPJ"><input name="lead_days" type="number" placeholder="Prazo (dias)"><button>Cadastrar fornecedor</button></form></div><div class="fw-panel"><h3>Registrar compra recebida / lote</h3><p>A gravação cria lote e entrada de estoque numa única operação. Registre apenas material fisicamente recebido.</p><form data-fw-form="receipt"><select name="fabric_id" required><option value="">Tecido</option>'+state.fabric.map(f=>'<option value="'+f.id+'">'+esc(f.code+' • '+f.name+(f.color?' • '+f.color:'')+(f.color_reference?' • Ref. '+f.color_reference:'')+(f.quality_code?' • Q'+f.quality_code:''))+'</option>').join('')+'</select><select name="supplier_id"><option value="">Fornecedor (opcional)</option>'+state.suppliers.map(s=>'<option value="'+s.id+'">'+esc(s.trade_name||s.legal_name)+'</option>').join('')+'</select><input name="lot_code" placeholder="Lote" required><input name="invoice_number" placeholder="NF"><input name="invoice_item_code" placeholder="Código do item na NF"><input name="invoice_item_description" placeholder="Descrição exata na NF"><input name="invoice_color_reference" placeholder="Ref. de cor como veio na NF"><input name="invoice_quality_code" placeholder="Q como veio na NF"><label><input type="checkbox" name="invoice_alias_homologated"> Confirmei a equivalência da NF</label><input name="quantity_m" type="number" min=".001" step=".001" placeholder="Quantidade (m)" required><input name="purchase_price_per_m" type="number" min="0" step=".0001" placeholder="R$/m" required><input name="freight_cost" type="number" min="0" step=".01" placeholder="Frete R$"><input name="other_cost" type="number" min="0" step=".01" placeholder="Outros custos R$"><input name="received_date" type="date"><button>Registrar recebimento</button></form></div><div class="fw-panel"><h3>Saldo e valor por tecido</h3><div class="fw-table-scroll"><table><thead><tr><th>Tecido</th><th>Liberado</th><th>Aguardando inspeção</th><th>Reprovado</th><th>Reservado</th><th>Valor em estoque</th></tr></thead><tbody>'+(stock||'<tr><td colspan="6">Cadastre os tecidos para iniciar.</td></tr>')+'</tbody></table></div></div><div class="fw-panel"><h3>Lotes recebidos e aprovação</h3><p>Lotes só podem ser enviados à facção depois de aprovados.</p><div class="fw-table-scroll"><table><thead><tr><th>Tecido</th><th>Lote</th><th>Qtd.</th><th>Custo efetivo</th><th>Inspeção do lote</th><th>Ação</th></tr></thead><tbody>'+(lotRows||'<tr><td colspan="6">Nenhum lote recebido.</td></tr>')+'</tbody></table></div></div>';
}
function recipeView(){return '<div class="fw-panel"><h3>Ficha técnica por peça</h3><p>Cadastre quantos metros entram no custo previsto, o custo previsto da facção e dos aviamentos por unidade.</p><form data-fw-form="recipe"><select name="fabric_id" required><option value="">Tecido padrão</option>'+state.fabric.map(f=>'<option value="'+f.id+'">'+esc(f.code+' • '+f.name+(f.color?' • '+f.color:'')+(f.color_reference?' • '+f.color_reference:'')+(f.quality_code?' • Q'+f.quality_code:''))+'</option>').join('')+'</select><input name="product_reference" placeholder="Código da peça" required><input name="product_name" placeholder="Nome igual à demanda RFID" required><input name="consumption_m_per_piece" type="number" min=".0001" step=".0001" placeholder="Consumo (m/peça)" required><input name="faction_cost_per_piece" type="number" min="0" step=".01" placeholder="Facção prevista R$/peça"><input name="extras_cost_per_piece" type="number" min="0" step=".01" placeholder="Aviamentos R$/peça"><button>Salvar ficha técnica</button></form><table><thead><tr><th>Peça</th><th>Tecido</th><th>Consumo</th><th>Facção prevista</th><th>Extras previstos</th></tr></thead><tbody>'+state.recipes.map(r=>'<tr><td>'+esc(r.product_reference)+' • '+esc(r.product_name)+'</td><td>'+esc((state.fabric.find(f=>f.id===r.fabric_id)?.name||'—')+' • Ref. '+(state.fabric.find(f=>f.id===r.fabric_id)?.color_reference||'—')+' • Q'+(state.fabric.find(f=>f.id===r.fabric_id)?.quality_code||'—'))+'</td><td>'+br(r.consumption_m_per_piece,4)+' m</td><td>R$ '+br(r.faction_cost_per_piece)+'</td><td>R$ '+br(r.extras_cost_per_piece)+'</td></tr>').join('')+'</tbody></table></div>'}
function costView(){
 const rows=state.items.map(i=>{const s=orderStats(i),lots=state.lots.filter(l=>l.fabric_id===i.fabric_id),qty=lots.reduce((a,l)=>a+n(l.quantity_received_m),0),price=qty?lots.reduce((a,l)=>a+n(l.effective_price_per_m)*n(l.quantity_received_m),0)/qty:n(i.planned_price_per_m),planned=n(i.consumption_m_per_piece)*price+n(i.faction_cost_per_piece)+n(i.extras_cost_per_piece),o=state.orders.find(x=>x.id===i.order_id);return '<tr><td>#'+esc(o?.order_number)+' • '+esc(i.product_name)+'<small>'+esc(state.fabric.find(f=>f.id===i.fabric_id)?.color_reference||'')+' • Q'+esc(state.fabric.find(f=>f.id===i.fabric_id)?.quality_code||'')+'</small></td><td>'+br(s.accepted,0)+'</td><td>R$ '+br(planned)+'</td><td>'+(s.unit===null?'Aguardando retorno':'R$ '+br(s.unit))+'</td><td>'+br(s.loss,3)+' m</td><td>R$ '+br(s.lossCost)+'</td></tr>'}).join('');
 return '<div class="fw-panel"><h3>Custo real e perda por ordem</h3><p>Custo real considera o tecido consumido, facção e aviamentos dividido pelas peças aceitas. Perda em metros = tecido enviado − sobra retornada − consumo teórico das peças produzidas.</p><div class="fw-table-scroll"><table><thead><tr><th>Peça / ordem</th><th>Peças aceitas</th><th>Custo previsto/peça</th><th>Custo real/peça</th><th>Perda de tecido</th><th>Custo da perda</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">Os custos aparecerão após registrar uma ordem e o retorno da facção.</td></tr>')+'</tbody></table></div></div>';
}
function formData(form){return Object.fromEntries(new FormData(form).entries())}
function val(d,k){return d[k]===''||d[k]===undefined?null:n(d[k])}
function ensureCatalogKey(value,ignoreId=''){
 const key=fabricCatalogVariantKey(value);
 const duplicate=state.fabric.find(f=>f.id!==ignoreId&&f.active&&fabricCatalogVariantKey(f)===key);
 if(duplicate)throw Error('Esse código + referência de cor + Q já existe no catálogo. Edite o cadastro existente para evitar duplicidade.');
}
function aliasSignature(a){return fabricInvoiceAliasKey(a)}
async function saveAliasMapping(d,id=null){
 const payload={organization_id:state.org,fabric_id:d.fabric_id,supplier_id:d.supplier_id||null,supplier_item_code:String(d.supplier_item_code||'').trim(),supplier_item_description:String(d.supplier_item_description||'').trim(),invoice_color_reference:String(d.invoice_color_reference||'').trim().toUpperCase(),invoice_quality_code:String(d.invoice_quality_code||'').trim().toUpperCase().replace(/^Q/,''),source_invoice_number:String(d.source_invoice_number||'').trim()||null,notes:String(d.notes||'').trim()||null,homologated:Boolean(d.homologated),homologated_at:d.homologated?new Date().toISOString():null,homologated_by:d.homologated?state.session.user.id:null,active:d.active!==false,updated_at:new Date().toISOString(),updated_by:state.session.user.id};
 if(!payload.supplier_item_code&&!payload.supplier_item_description)throw Error('Informe o código ou a descrição exata que aparece na NF.');
 const duplicate=state.aliases.find(a=>a.id!==id&&aliasSignature(a)===aliasSignature(payload));
 if(duplicate){if(duplicate.fabric_id!==payload.fabric_id)throw Error('Este código/descrição da NF já está relacionado a outro tecido. Revise o vínculo antes de registrar o recebimento.');if(id)throw Error('Este vínculo já existe. Abra o vínculo existente para editar os dados.');id=duplicate.id;payload.homologated=payload.homologated||duplicate.homologated;}
 if(id)return api('/rest/v1/fabric_catalog_aliases?id=eq.'+encodeURIComponent(id)+'&organization_id=eq.'+state.org,{method:'PATCH',body:JSON.stringify(payload)});
 payload.created_by=state.session.user.id;return api('/rest/v1/fabric_catalog_aliases',{method:'POST',body:JSON.stringify(payload)});
}
async function createOrder(){
 const picks=[...document.querySelectorAll('[data-fw-demand]:checked')],snap=window.GAO_LINEN_NEED_SNAPSHOT||[];
 const lines=picks.map(p=>{const x=snap.find(i=>String(i.produtoId||i.produtoNome)===p.dataset.fwDemand),r=state.recipes.find(q=>q.active&&q.product_reference===String(x?.produtoId||x?.produtoNome));if(!x||!r)throw Error('Cadastre ficha técnica ativa para todas as peças selecionadas.');const lots=state.lots.filter(l=>l.fabric_id===r.fabric_id);const planned=lots.reduce((a,l)=>a+n(l.effective_price_per_m)*n(l.quantity_received_m),0)/(lots.reduce((a,l)=>a+n(l.quantity_received_m),0)||1);return {source_item_key:String(x.produtoId||x.produtoNome),product_reference:String(x.produtoId||''),product_name:String(x.produtoNome||''),requested_pieces:n(x.pedidoReal),recipe_id:r.id,planned_price_per_m:planned}});
 if(!lines.length)throw Error('Marque pelo menos uma peça com demanda e ficha técnica.');
 return rpc('fabric_create_orders_for_demand',{p_organization_id:state.org,p_demand_as_of:(window.GAO_LINEN_NEED_SNAPSHOT||[])[0]?.asOf||new Date().toISOString().slice(0,10),p_lines:lines,p_idempotency_key:'fabric-demand-'+uid()})
}
async function submit(form){
 const d=formData(form),table=form.dataset.fwForm;
 if(table==='purchaseOrder'){
  const lines=[...form.querySelectorAll('[data-fw-po-line]')].map(row=>({fabric_id:row.querySelector('[name=fabric_id]')?.value,ordered_m:row.querySelector('[name=ordered_m]')?.value,purchase_price_per_m:row.querySelector('[name=purchase_price_per_m]')?.value}));
  if(!lines.length)throw Error('Adicione ao menos um tecido ao pedido.');
  return rpc('fabric_create_purchase_order',{p_organization_id:state.org,p_supplier_id:d.supplier_id,p_order_number:d.order_number.trim(),p_ordered_date:d.ordered_date||null,p_expected_date:d.expected_date||null,p_lines:lines.map(x=>({fabric_id:x.fabric_id,ordered_m:n(x.ordered_m),purchase_price_per_m:n(x.purchase_price_per_m)})),p_notes:d.notes||null,p_idempotency_key:'fabric-po-'+uid()});
 }
 if(table==='fabric'){
  const payload={...d,organization_id:state.org,code:d.code.trim(),name:d.name.trim(),color_reference:d.color_reference.trim().toUpperCase(),quality_code:d.quality_code.trim().toUpperCase().replace(/^Q/,''),width_m:val(d,'width_m'),homologated:d.homologated==='on',homologated_at:d.homologated==='on'?new Date().toISOString():null,homologated_by:d.homologated==='on'?state.session.user.id:null};
  ensureCatalogKey(payload);return api('/rest/v1/fabric_catalog',{method:'POST',body:JSON.stringify(payload)});
 }
 if(table==='catalogEdit'){
  const payload={...d,code:d.code.trim(),name:d.name.trim(),color_reference:d.color_reference.trim().toUpperCase(),quality_code:d.quality_code.trim().toUpperCase().replace(/^Q/,''),width_m:val(d,'width_m'),homologated:d.homologated==='on',homologated_at:d.homologated==='on'?new Date().toISOString():null,homologated_by:d.homologated==='on'?state.session.user.id:null,updated_at:new Date().toISOString(),updated_by:state.session.user.id};
  ensureCatalogKey(payload,d.id);return api('/rest/v1/fabric_catalog?id=eq.'+encodeURIComponent(d.id)+'&organization_id=eq.'+state.org,{method:'PATCH',body:JSON.stringify(payload)});
 }
 if(table==='aliasCreate'||table==='aliasEdit')return saveAliasMapping({...d,homologated:d.homologated==='on',active:table==='aliasCreate'||d.active==='on'},table==='aliasEdit'?d.id:null);
 if(table==='supplier')return api('/rest/v1/fabric_suppliers',{method:'POST',body:JSON.stringify({...d,organization_id:state.org,lead_days:val(d,'lead_days')})});
 if(table==='recipe')return api('/rest/v1/fabric_product_recipes',{method:'POST',body:JSON.stringify({...d,organization_id:state.org,consumption_m_per_piece:val(d,'consumption_m_per_piece'),faction_cost_per_piece:val(d,'faction_cost_per_piece')||0,extras_cost_per_piece:val(d,'extras_cost_per_piece')||0})});
 if(table==='receipt'){if(d.invoice_item_code||d.invoice_item_description||d.invoice_color_reference||d.invoice_quality_code)await saveAliasMapping({fabric_id:d.fabric_id,supplier_id:d.supplier_id,supplier_item_code:d.invoice_item_code,supplier_item_description:d.invoice_item_description,invoice_color_reference:d.invoice_color_reference,invoice_quality_code:d.invoice_quality_code,source_invoice_number:d.invoice_number,homologated:d.invoice_alias_homologated==='on'},null);return rpc('fabric_record_receipt',{p_organization_id:state.org,p_fabric_id:d.fabric_id,p_supplier_id:d.supplier_id,p_lot_code:d.lot_code,p_invoice_number:d.invoice_number,p_quantity_m:val(d,'quantity_m'),p_purchase_price_per_m:val(d,'purchase_price_per_m'),p_freight_cost:val(d,'freight_cost')||0,p_other_cost:val(d,'other_cost')||0,p_received_date:d.received_date||null,p_idempotency_key:'fabric-receipt-'+d.fabric_id+'-'+d.lot_code.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-')+'-'+String(d.invoice_number||'semnf').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-')});}
}
async function ship(id){
 const item=state.items.find(i=>i.id===id),needed=n(item.ordered_pieces)*n(item.consumption_m_per_piece);
 const prior=state.moves.filter(m=>m.order_item_id===id&&m.movement_type==='ENVIO_FACCAO').reduce((a,m)=>a+n(m.quantity_m),0);
 const balance=liveBalances().filter(l=>l.fabric_id===item.fabric_id&&l.quality_status==='APROVADO');
 const lots=balance.filter(l=>l.onhand-l.reserved>0).sort((a,b)=>a.received_date.localeCompare(b.received_date));
 let remaining=Math.max(0,needed-prior);
 const available=lots.reduce((a,l)=>a+l.onhand-l.reserved,0);if(available+0.0005<remaining)throw Error('Saldo aprovado insuficiente. Disponível: '+br(available,3)+' m; faltam enviar '+br(remaining,3)+' m.');
 for(const lot of lots){const qty=Math.min(remaining,lot.onhand-lot.reserved);if(qty<=0)continue;const cumulative=Math.round((prior+needed-remaining+qty)*1000);await rpc('fabric_post_stock_movement',{p_organization_id:state.org,p_lot_id:lot.id,p_movement_type:'ENVIO_FACCAO',p_quantity_m:qty,p_order_item_id:item.id,p_idempotency_key:'fabric-ship-'+item.id+'-'+lot.id+'-'+cumulative,p_notes:'Envio para facção • '+item.product_name});remaining-=qty;if(remaining<=0.0005)break}
 if(remaining>0.0005)throw Error('O saldo mudou durante o envio. Clique em “Completar envio” para continuar com o saldo atualizado.');
}
async function returnForm(id){
 const item=state.items.find(x=>x.id===id);
 const shipments=state.moves.filter(x=>x.order_item_id===id&&x.movement_type==='ENVIO_FACCAO');
 const accepted=prompt('Peças aceitas nesta entrega da facção:', '0');if(accepted===null)return;
 const rejected=prompt('Peças rejeitadas:', '0');if(rejected===null)return;
 const returned=prompt('Metros de tecido que voltaram ao estoque:', '0');if(returned===null)return;
 const faction=prompt('Custo da facção desta entrega (R$):', String(n(accepted)*n(item.faction_cost_per_piece)));if(faction===null)return;
 const extras=prompt('Custo de aviamentos desta entrega (R$):', String(n(accepted)*n(item.extras_cost_per_piece)));if(extras===null)return;
 const notes=prompt('Observação (opcional):','')||'';
 const prior=state.returns.filter(x=>x.order_item_id===id);
 let returnLeft=n(returned);
 const lots=shipments.map(m=>({lot_id:m.lot_id,remaining:n(m.quantity_m)-prior.filter(r=>r.lot_id===m.lot_id).reduce((s,r)=>s+n(r.returned_m),0)})).filter(x=>x.remaining>0);
 const allocations=[];
 for(const lot of lots){const qty=Math.min(returnLeft,lot.remaining);if(qty>0){allocations.push({...lot,qty});returnLeft-=qty}if(returnLeft<=0.0005)break}
 if(returnLeft>0.0005)throw Error('A sobra informada excede o tecido ainda enviado à facção.');
 if(n(returned)>0&&!allocations.length)throw Error('Não há lote disponível para registrar a sobra.');
 const entries=allocations.length?allocations:[{lot_id:null,qty:0}];
 let result;
 for(let index=0;index<entries.length;index++){
  const x=entries[index];
  result=await rpc('fabric_record_faction_return',{p_organization_id:state.org,p_order_item_id:id,p_lot_id:x.lot_id,p_accepted_pieces:index===0?n(accepted):0,p_rejected_pieces:index===0?n(rejected):0,p_returned_m:x.qty,p_faction_cost_amount:index===0?n(faction):0,p_extras_cost_amount:index===0?n(extras):0,p_notes:notes,p_idempotency_key:'fabric-return-'+id+'-'+new Date().toISOString().slice(0,16).replace(/[^0-9]/g,'')+'-'+index})
 }
 return result;
}
function setFlowMode(enabled){
 state.mode=enabled;
 const shell=document.querySelector('#gao-linen-risk-shell');
 const host=document.querySelector('#gao-fabric-flow');
 const button=document.querySelector('[data-fw-open]');
 shell?.classList.toggle('fw-mode',enabled);
 if(host)host.hidden=!enabled;
 if(button){button.classList.toggle('active',enabled);button.setAttribute('aria-pressed',String(enabled))}
}
document.addEventListener('click',async e=>{
 const tab=e.target.closest('[data-fw-tab]');if(tab){state.tab=tab.dataset.fwTab;render();return}
 if(e.target.closest('[data-fw-open]')){setFlowMode(true);render();return}
 if(e.target.closest('[data-dimension-view]')){setFlowMode(false)}
 if(e.target.closest('[data-fw-refresh]')){await run(()=>reload());return}
 if(e.target.closest('[data-fw-create-order]')){await run(createOrder);return}
 if(e.target.closest('[data-fw-add-po-line]')){document.querySelector('[data-fw-po-lines]')?.insertAdjacentHTML('beforeend',poLineHtml());return}
 const removePoLine=e.target.closest('[data-fw-remove-po-line]');if(removePoLine){if(document.querySelectorAll('[data-fw-po-line]').length>1)removePoLine.closest('[data-fw-po-line]').remove();return}
 const receivePo=e.target.closest('[data-fw-receive-po-item]');if(receivePo){await run(()=>receivePurchaseItem(receivePo.dataset.fwReceivePoItem));return}
 const approve=e.target.closest('[data-fw-approve]');if(approve){await run(()=>api('/rest/v1/fabric_lots?id=eq.'+approve.dataset.fwApprove,{method:'PATCH',body:JSON.stringify({quality_status:'APROVADO'})}));return}
 const shipBtn=e.target.closest('[data-fw-ship]');if(shipBtn){await run(()=>ship(shipBtn.dataset.fwShip));return}
 const ret=e.target.closest('[data-fw-return]');if(ret){await run(()=>returnForm(ret.dataset.fwReturn));return}
});
document.addEventListener('submit',async e=>{const form=e.target.closest('[data-fw-form]');if(!form)return;e.preventDefault();await run(async()=>{await submit(form);form.reset();await reload()})});
async function syncOrderStatuses(){for(const o of state.orders.filter(x=>['ABERTA','PARCIAL','ENVIADA'].includes(x.status))){const items=state.items.filter(i=>i.order_id===o.id);if(!items.length)continue;const done=items.every(i=>orderStats(i).accepted+orderStats(i).rejected>=n(i.ordered_pieces));const any=items.some(i=>orderStats(i).accepted+orderStats(i).rejected>0);const sent=items.some(i=>orderStats(i).issued>0);const status=done?'CONCLUIDA':any?'PARCIAL':sent?'ENVIADA':'ABERTA';if(status!==o.status)await api('/rest/v1/fabric_production_orders?id=eq.'+o.id,{method:'PATCH',body:JSON.stringify({status,updated_at:new Date().toISOString()})})}}
async function run(fn){if(state.busy)return;state.busy=true;state.error='';render();try{await fn();await reload();await syncOrderStatuses();await reload()}catch(err){state.error=err.message||String(err)}finally{state.busy=false;render()}}
function mount(){
 const route=location.pathname.replace(/\/+$/,'')==='/enxoval-tecidos';if(!route){document.querySelector('#gao-fabric-flow')?.remove();return}
 const shell=document.querySelector('#gao-linen-risk-shell');if(!shell)return;
 let nav=shell.querySelector('.lr150-dimension-nav');
 if(!nav){nav=document.createElement('div');nav.className='lr150-dimension-nav';shell.appendChild(nav)}
 if(!nav.querySelector('[data-fw-open]')){const b=document.createElement('button');b.type='button';b.dataset.fwOpen='';b.textContent='Fluxo tecido e facção';nav.appendChild(b)}
 const flowButton=nav.querySelector('[data-fw-open]');flowButton?.classList.toggle('active',state.mode);flowButton?.setAttribute('aria-pressed',String(state.mode));
 if(!shell.querySelector('#gao-fabric-flow')){const host=document.createElement('div');host.id='gao-fabric-flow';host.hidden=!state.mode;shell.appendChild(host);render();if(!state.org){init().then(render).catch(err=>{state.error=err.message;render()})}}
}
new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
setInterval(mount,900);
})();
