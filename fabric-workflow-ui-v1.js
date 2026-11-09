import { fabricCatalogVariantKey, fabricInvoiceAliasKey, summarizeFabricPurchaseOrder, groupPendingFabricLotsByInvoice, latestFabricConsumptionByVariant, fabricCostReferenceLabel, normalizeFabricNumber, serviceOrderDueDate } from '/fabric-workflow-rules-v1.mjs?v=3'; import {sameFabricStandard,groupFabricStandards,purchaseReferenceChoices} from '/fabric-standard-rules-v1.mjs?v=1';
(() => {
'use strict';
const SB='https://fquzuxdqvhecijjuxbmg.supabase.co';
const KEY='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=normalizeFabricNumber;
const br=(v,d=2)=>n(v).toLocaleString('pt-BR',{maximumFractionDigits:d});
const uid=()=>crypto.randomUUID();
const state={org:null,session:null,tab:'demand',qualityInvoice:'',fabric:[],standards:[],suppliers:[],recipes:[],lots:[],orders:[],items:[],moves:[],returns:[],purchaseOrders:[],purchaseItems:[],purchaseReceipts:[],aliases:[],inspections:[],tracking:[],cuts:[],consumptionReferences:[],materialLinks:[],costReferences:[],busy:false,error:'',snapshot:[],mode:false};
const style=document.createElement('style');style.textContent='.fw-shell{margin:14px 0;color:#082d52}.fw-head,.fw-panel{background:#fff;border:1px solid #d5e2ef;border-radius:12px;padding:16px;margin:10px 0}.fw-head{display:flex;justify-content:space-between;align-items:center;background:#eef7ff}.fw-head small{font-weight:900;letter-spacing:.12em;color:#0879c9}.fw-head h2{margin:5px 0}.fw-head p,.fw-panel p{color:#54708e;margin:6px 0 12px}.fw-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.fw-tabs button,.fw-panel button{border:0;border-radius:8px;background:#3188cc;color:white;padding:9px 12px;font-weight:800}.fw-tabs button{background:#fff;color:#174a78;border:1px solid #b9d1e8}.fw-tabs button.active{background:#3188cc;color:white}.fw-panel h3{margin:0 0 10px}.fw-panel table{width:100%;border-collapse:collapse;min-width:780px;font-size:13px}.fw-panel th,.fw-panel td{text-align:left;padding:9px;border-bottom:1px solid #e7eef5;vertical-align:top}.fw-panel th{background:#f3f8fd;color:#54708e}.fw-panel td small{display:block;color:#7890a8;margin-top:4px}.fw-po-line{display:flex;flex-wrap:wrap;gap:8px;align-items:center;width:100%}.fw-po-order{border-top:1px solid #e7eef5;padding-top:8px;margin-top:12px}.fw-status{display:inline-block;background:#eef5fb;border-radius:999px;padding:4px 9px;color:#174a78;font-size:12px;font-weight:800}.fw-po-summary{grid-template-columns:repeat(5,1fr);margin:12px 0}.fw-po-order h4{margin:8px 0}.fw-purchase-orders>form{margin:10px 0 14px}.fw-panel form{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.fw-panel input,.fw-panel select{padding:9px;border:1px solid #b9d1e8;border-radius:8px;min-width:150px}.fw-panel form button{min-height:38px}.fw-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.fw-cards article{background:#fff;border:1px solid #d5e2ef;border-radius:10px;padding:14px}.fw-cards small,.fw-cards b{display:block}.fw-cards small{color:#54708e}.fw-cards b{font-size:22px;margin-top:7px}.fw-error{background:#fff0f0;border:1px solid #f4bcbc;color:#9b1c1c;padding:10px;border-radius:8px}.fw-note{padding:10px;color:#54708e}.fw-table-scroll{overflow:auto}.fw-catalog-edit{border:1px solid #e1eaf3;border-radius:9px;padding:10px;margin:8px 0}.fw-catalog-edit summary{cursor:pointer}.fw-catalog-edit form{margin-top:10px}.fw-catalog-edit label,.fw-panel form label{display:flex;gap:6px;align-items:center}.fw-alias-row{border-bottom:1px solid #e7eef5;padding:8px}#gao-linen-risk-shell.fw-mode>.lr150-shell{display:none!important}#gao-linen-risk-shell>#gao-fabric-flow:not([hidden]){display:block!important}@media(max-width:760px){.fw-cards{grid-template-columns:1fr}.fw-po-summary{grid-template-columns:1fr}.fw-panel form input,.fw-panel form select{width:100%}.fw-head{align-items:start;gap:8px;flex-direction:column}}';document.head.appendChild(style);
style.textContent+='.fw-source-picker{display:grid!important;gap:6px;width:100%;font-weight:800;color:#54708e}.fw-source-picker select{width:100%;max-width:100%}[data-fw-consumption-note]{display:block;width:100%;padding:2px 0;font-size:12px;line-height:1.5}';
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
  ['fabric_catalog','created_at'],['fabric_suppliers','created_at'],['fabric_product_recipes','created_at'],['fabric_consumption_references','source_date'],['fabric_product_cost_references','source_row'],
  ['fabric_lots','created_at'],['fabric_production_orders','created_at'],
  ['fabric_production_order_items','created_at'],['fabric_stock_movements','created_at'],['fabric_faction_returns','returned_at'],['fabric_purchase_orders','ordered_date'],['fabric_purchase_order_items','created_at'],['fabric_purchase_order_receipts','received_at'],['fabric_catalog_aliases','updated_at'],['fabric_lot_inspections','inspected_at'],['fabric_faction_tracking','source_row'],['fabric_cut_batches','created_at'],['fabric_material_links','updated_at'],['fabric_standards','code']
 ];
 const [fabric,suppliers,recipes,consumptionReferences,costReferences,lots,orders,items,moves,returns,purchaseOrders,purchaseItems,purchaseReceipts,aliases,inspections,tracking,cuts,materialLinks,standards]=await Promise.all(tables.map(([t,order])=>api('/rest/v1/'+t+'?select=*&organization_id=eq.'+state.org+'&order='+order+'.desc')));
 Object.assign(state,{fabric,suppliers,recipes,consumptionReferences,costReferences,lots,orders,items,moves,returns,purchaseOrders,purchaseItems,purchaseReceipts,aliases,inspections,tracking,cuts,materialLinks,standards});
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
 const cuts=state.cuts.filter(c=>c.order_item_id===item.id),produced=cuts.length?cuts.reduce((a,c)=>a+n(c.produced_pieces),0):accepted+rejected;
 const theoretical=produced*n(item.consumption_m_per_piece),loss=Math.max(0,issued-returned-theoretical);
 const usedFabricCost=Math.max(0,fabricCost-returnCost),unitCost=issued?fabricCost/issued:0;
 const totalCost=usedFabricCost+faction+extras;
 return {issued,accepted,rejected,returned,faction,extras,theoretical,loss,lossCost:loss*unitCost,unit:accepted?totalCost/accepted:null,remaining:Math.max(0,n(item.ordered_pieces)-accepted-rejected)};
}
function render(){
 const host=document.querySelector('#gao-fabric-flow');if(!host)return;host.hidden=!state.mode;
 const tabs=[['demand','Necessidade e facção'],['stock','Tecido e compras'],['quality','Qualidade'],['recipes','Ficha técnica'],['cost','Custos e perdas']];
 const buttons=tabs.map(([id,label])=>'<button type="button" data-fw-tab="'+id+'" class="'+(state.tab===id?'active':'')+'">'+label+'</button>').join('');
 const body=state.tab==='material-need'?materialCoverageView():state.tab==='production'||state.tab==='demand'?demandView()+productionView()+trackingView():['stock','purchases','receipt','lots'].includes(state.tab)?stockPanels(state.tab):state.tab==='suppliers'?stockPanels('suppliers'):state.tab==='catalog'?standardsManagementView()+'<details class="fw-panel"><summary>Referências comerciais e códigos de NF</summary>'+stockPanels('catalog')+'</details>'+recipeView():state.tab==='quality'?qualityView():state.tab==='recipes'?recipeView():costView();
 host.innerHTML='<section class="fw-shell"><header class="fw-head"><div><small>ENXOVAL • PRODUÇÃO TÊXTIL</small><h2>'+esc(({'material-need':'Necessidade de compra de tecido',stock:'Estoque de tecidos',purchases:'Pedidos de compra',receipt:'Receber nota fiscal',lots:'Lotes recebidos',catalog:'Padronização de produtos',suppliers:'Fornecedores',quality:'Qualidade de tecidos',production:'Produção e facção',cost:'Custos e perdas'})[state.tab]||'Produção têxtil')+'</h2><p>'+esc(({'material-need':'Quanto tecido falta comprar, em metros, descontando estoque e compras a receber.',stock:'Saldo disponível e reservado de cada tecido.',purchases:'Pedidos em andamento, entregas previstas e histórico.',receipt:'Importe o XML ou registre o material recebido.',lots:'Consulte os lotes e a avaliação por nota fiscal.'})[state.tab]||'Demanda ligada a estoque, produção e custo real.')+'</p></div><button type="button" data-fw-refresh>Atualizar dados</button></header>'+(state.error?'<div class="fw-error">'+esc(state.error)+'</div>':'')+(state.busy?'<div class="fw-note">Salvando no banco…</div>':'')+body+'</section>';
}
function materialLinkInfo(code){
 const link=state.materialLinks.find(l=>l.product_reference===String(code));
 if(!link)return null;
 const source=state.consumptionReferences.find(c=>c.id===link.consumption_reference_id);
 return source?{...link,source,consumption:n(source.consumption_m_per_piece)}:null;
}
const RECIPE_UNIT_DEFAULTS=Object.freeze({rfid:1.98,label:0.22});
function recipeCostValues(row){
 return {cost_reference_id:row.id,faction_cost_per_piece:row.faction_cost_per_piece??'',label_cost_per_piece:RECIPE_UNIT_DEFAULTS.label,rfid_cost_per_piece:RECIPE_UNIT_DEFAULTS.rfid,manual_extras_per_piece:row.source_block==='VARIANTES'?0:row.extras_cost_per_piece??''};
}
function applyRecipeCost(form,row){
 for(const [key,value] of Object.entries(recipeCostValues(row))){const input=form.elements.namedItem(key);if(input)input.value=value;}
 const note=form.querySelector('[data-fw-default-cost-note]');if(note)note.textContent='Padrão aplicado: '+row.source_sheet+' • linha '+row.source_row+'. Padrão GAO: RFID R$ 1,98 e etiqueta R$ 0,22. Os valores podem ser ajustados.';
}
function fillMaterialLink(code,targetForm=null){
 const link=materialLinkInfo(code),form=targetForm||document.querySelector('form[data-fw-form="recipe"]');if(!link||!form)return;
 form.reset();form.elements.namedItem('label_cost_per_piece').value=RECIPE_UNIT_DEFAULTS.label;form.elements.namedItem('rfid_cost_per_piece').value=RECIPE_UNIT_DEFAULTS.rfid;for(const [key,value] of Object.entries({product_reference:link.product_reference,product_name:link.product_name,consumption_m_per_piece:link.consumption,fabric_id:link.fabric_id||'',cost_reference_id:link.cost_reference_id||''})){const input=form.elements.namedItem(key);if(input)input.value=value;}
 const cost=state.costReferences.find(c=>c.id===link.cost_reference_id);
 if(cost)applyRecipeCost(form,cost);
 const note=form.querySelector('[data-fw-consumption-note]');if(note)note.textContent='Consumo vinculado: '+link.consumption+' m/peça • '+link.source.source_sheet+' • linha '+link.source.source_row+'. '+link.resolution_note;
 if(!targetForm)form.scrollIntoView({behavior:'smooth',block:'center'});form.elements.namedItem('fabric_id').focus();
}
let recipeDialog=null,recipeDialogOrigin=null,recipeDialogScroll=0;
function closeRecipeDialog(){
 if(!recipeDialog||recipeDialog.dataset.saving==='true')return;
 const dialog=recipeDialog;recipeDialog=null;if(dialog.open)dialog.close();dialog.remove();
 recipeDialogOrigin?.focus?.({preventScroll:true});window.scrollTo({top:recipeDialogScroll,behavior:'instant'});recipeDialogOrigin=null;
}
const recipeSearchKey=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/VERMELHA/g,'VERMELHO').replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
function recipeSourceChoices(kind,productName,query='',all=false,selected=''){
 const target=recipeSearchKey(productName),search=recipeSearchKey(query);
 const rows=kind==='cost'?state.costReferences.filter(r=>r.product_name):latestFabricConsumptionByVariant(state.consumptionReferences);
 return rows.filter(r=>{
  const name=recipeSearchKey(r.product_name),same=kind==='consumption'?name===target:target.startsWith(name)||name.startsWith(target)||(/^CALCA /.test(target)&&/^CALCA /.test(name))||(/^CAMISA /.test(target)&&!target.includes(' ML ')&&/^CAMISA /.test(name)&&!name.includes(' ML '));
  const value=kind==='cost'?r.id:r.variant_key;
  return value===selected||((all||same)&&(!search||recipeSearchKey([r.product_name,r.color_description,r.fabric_description,r.supplier_name,r.size,r.source_block].join(' ')).includes(search)));
 }).map(r=>({value:kind==='cost'?r.id:r.variant_key,label:kind==='cost'?[r.product_name,r.color_description,r.supplier_name,r.source_block==='MODELO_A'?'Base A':r.source_block==='MODELO_B'?'Base B':''].filter(Boolean).join(' • '):[r.product_name,recipeSearchKey(r.product_name).endsWith(recipeSearchKey(r.size))?'':r.size,r.color_description,br(r.consumption_m_per_piece,3)+' m/peça'].filter(Boolean).join(' • ')}));
}
function refreshRecipeSources(form){
 const name=form.elements.namedItem('product_name').value,query=form.querySelector('[data-fw-source-search]').value,all=form.querySelector('[data-fw-source-all]').checked;
 for(const [kind,selector] of [['cost','[data-fw-cost-source]'],['consumption','[data-fw-consumption-source]']]){
  const select=form.querySelector(selector),selected=select.value,choices=recipeSourceChoices(kind,name,query,all,selected);
  select.innerHTML='<option value="">'+(choices.length?'Escolher outra origem (opcional)':'Nenhuma fonte correspondente')+'</option>'+choices.map(c=>'<option value="'+esc(c.value)+'" '+(c.value===selected?'selected':'')+'>'+esc(c.label)+'</option>').join('');
 }
}
function simplifyRecipeDialog(form){
 const link=materialLinkInfo(form.elements.namedItem('product_reference').value);
 const cost=state.costReferences.find(c=>c.id===(form.elements.namedItem('cost_reference_id').value||link?.cost_reference_id));
 const advanced=document.createElement('details');advanced.className='fw-recipe-sources';
 advanced.innerHTML='<summary>Consultar ou alterar a fonte dos dados</summary><label class="fw-source-picker">Buscar na fonte<input type="search" data-fw-source-search placeholder="Nome, cor ou fornecedor"></label><label class="fw-all-sources"><input type="checkbox" data-fw-source-all> Mostrar outras peças da base</label>';
 const sourceNodes=[...form.querySelectorAll('.fw-source-picker,[data-fw-cost-note],[data-fw-consumption-note]')];sourceNodes.forEach(node=>advanced.appendChild(node));
 const submitButton=form.querySelector('button[type="submit"],button:not([type])');
 const defaults=document.createElement('div');defaults.className='fw-default-cost';defaults.innerHTML='<small data-fw-default-cost-note>'+esc(cost?(form.dataset.recipeId?'Valores salvos preservados. Padrão disponível: ':'Valores preenchidos da planilha: ')+cost.source_sheet+' • linha '+cost.source_row+'. RFID R$ 1,98 e etiqueta R$ 0,22.'+(cost.source_block==='VARIANTES'?' A fonte agrupa R$ '+br(cost.extras_cost_per_piece)+' em insumos; esse agregado não foi somado novamente.':''):'Sem padrão de custo inequívoco para esta peça; informe os valores ou consulte outra fonte.')+'</small>'+(cost&&form.dataset.recipeId?'<button type="button" data-fw-apply-cost="'+esc(cost.id)+'">Aplicar padrão da planilha</button>':'');if(form.dataset.recipeId)defaults.insertAdjacentHTML('beforeend','<button type="button" data-fw-unit-defaults>Aplicar RFID e etiqueta padrão</button>');submitButton.before(defaults,advanced);
 const summary=document.createElement('div');summary.className='fw-piece-summary';summary.innerHTML='<b>'+esc(form.elements.namedItem('product_name').value)+'</b><small>Código '+esc(form.elements.namedItem('product_reference').value)+'</small>';form.prepend(summary);
 for(const key of ['product_name','product_reference'])form.elements.namedItem(key).closest('label').hidden=true;
 // Keep the fabric and consumption together before optional costs and sources.
 const fabric=form.elements.namedItem('fabric_id').closest('label'),consumption=form.elements.namedItem('consumption_m_per_piece').closest('label');summary.after(fabric,consumption);
 refreshRecipeSources(form);
}
function openRecipeDialog(code,recipeId=null,origin=null){
 if(recipeDialog)return;
 const template=document.createElement('template');template.innerHTML=recipeView();const source=template.content.querySelector('form[data-fw-form="recipe"]');
 const dialog=document.createElement('dialog');dialog.className='fw-recipe-dialog';dialog.setAttribute('data-fw-recipe-dialog','');dialog.setAttribute('aria-labelledby','fw-recipe-dialog-title');
 dialog.innerHTML='<header class="fw-modal-head"><h2 id="fw-recipe-dialog-title">'+(recipeId?'Editar ficha técnica':'Conferir vínculo da peça')+'</h2><button type="button" data-fw-modal-close aria-label="Fechar janela">×</button></header><div class="fw-panel"><div class="fw-error" data-fw-modal-error role="alert" hidden></div>'+source.outerHTML+'</div>';
 const form=dialog.querySelector('form');form.insertAdjacentHTML('beforeend','<button type="button" data-fw-modal-close>Cancelar</button>');form.querySelector('button[type="submit"],button:not([type])').textContent='Salvar alterações';
 const labels={fabric_id:'Tecido padrão GAO',product_reference:'Código da peça',product_name:'Nome da peça',consumption_m_per_piece:'Consumo (m/peça)',faction_cost_per_piece:'Confecção (R$/peça)',label_cost_per_piece:'Etiqueta (R$/peça)',rfid_cost_per_piece:'RFID (R$/peça)',manual_extras_per_piece:'Outros insumos (R$/peça)'};
 for(const input of [...form.querySelectorAll('input,select')]){if(input.closest('label'))continue;const label=document.createElement('label');label.className='fw-field';label.textContent=labels[input.name]||input.getAttribute('aria-label')||input.name;input.before(label);label.appendChild(input);}
 document.body.appendChild(dialog);recipeDialog=dialog;recipeDialogOrigin=origin||document.activeElement;recipeDialogScroll=window.scrollY;
 if(recipeId){const r=state.recipes.find(x=>x.id===recipeId);if(!r){closeRecipeDialog();return;}
  form.dataset.recipeId=r.id;for(const key of ['product_reference','product_name','fabric_id','consumption_m_per_piece','faction_cost_per_piece','label_cost_per_piece','rfid_cost_per_piece','cost_reference_id']){const input=form.elements.namedItem(key);if(input)input.value=r[key]??'';}
  form.elements.namedItem('manual_extras_per_piece').value=Math.max(0,n(r.extras_cost_per_piece)-n(r.label_cost_per_piece)-n(r.rfid_cost_per_piece));
 }else fillMaterialLink(code,form);
 form.elements.namedItem('product_reference').readOnly=true;
 simplifyRecipeDialog(form);
 dialog.addEventListener('cancel',e=>{e.preventDefault();closeRecipeDialog();});dialog.showModal();form.elements.namedItem('fabric_id').focus();
}
async function saveRecipeDialog(form){
 const dialog=form.closest('[data-fw-recipe-dialog]');if(dialog.dataset.saving==='true')return;
 dialog.dataset.saving='true';const error=dialog.querySelector('[data-fw-modal-error]');error.hidden=true;
 const buttons=[...dialog.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 try{const result=await submit(form);if(result?.[0]?.id)form.dataset.recipeId=result[0].id;await reload();render();dialog.dataset.saving='false';closeRecipeDialog();window.dispatchEvent(new Event('gao-production-updated'));}
 catch(err){error.textContent=err.message||String(err);error.hidden=false;}
 finally{dialog.dataset.saving='false';buttons.forEach(b=>b.disabled=false);}
}
const demandDrafts=new Map();
function demandQuantity(row){
 const key=String(row.produtoId||row.produtoNome),raw=demandDrafts.has(key)?demandDrafts.get(key):Math.ceil(Math.max(0,n(row.pedidoReal)));
 if(String(raw).trim()===''||!Number.isSafeInteger(Number(raw))||Number(raw)<0)throw Error('Informe uma quantidade inteira de peças, igual ou maior que zero.');
 return Number(raw);
}
function demandRequestedPieces(row){
 const quantity=demandQuantity(row);
 if(!quantity)throw Error('A quantidade selecionada está zerada. Desmarque a peça ou informe a quantidade para pedir.');
 return demandDrafts.has(String(row.produtoId||row.produtoNome))?quantity+n(row.pendingServiceOrders):n(row.needWithoutTracking??row.pedidoReal);
}
function demandView(){
 const snap=window.GAO_LINEN_NEED_SNAPSHOT||state.snapshot||[];
 const balances=liveBalances();
 const pending=state.items.reduce((a,i)=>a+orderStats(i).remaining,0);
 const rows=snap.filter(x=>n(x.pedidoReal)>0).map(x=>{
  const rec=state.recipes.find(r=>r.active&&r.product_reference===String(x.produtoId||x.produtoNome));
  const link=materialLinkInfo(x.produtoId||x.produtoNome),consumption=n(rec?.consumption_m_per_piece)||link?.consumption||0;
  const cov=n(x.pendingTracking)+n(x.pendingServiceOrders);
  const missing=demandDrafts.has(String(x.produtoId||x.produtoNome))?Number(demandDrafts.get(String(x.produtoId||x.produtoNome))):Math.ceil(Math.max(0,n(x.pedidoReal)));
  const meters=missing*consumption;
  const bal=rec?balances.filter(b=>fabricMatches(b.fabric_id,rec.fabric_id)&&b.quality_status==='APROVADO').reduce((a,b)=>a+b.onhand-b.reserved,0):0;
  return '<tr><td><b>'+esc(x.produtoNome)+'</b><small>'+esc(x.produtoId||'sem código')+'</small></td><td>'+br(x.pedidoReal,0)+' pç</td><td>'+esc(consumption?br(consumption,3)+' m/peça'+(!rec?' • confirmar tecido':''):'Sem consumo vinculado')+'</td><td>'+br(cov,0)+' pç</td><td><div class="fw-demand-editor"><input type="number" min="0" step="1" inputmode="numeric" aria-label="Quantidade a pedir de '+esc(x.produtoNome)+'" data-fw-demand-quantity="'+esc(x.produtoId||x.produtoNome)+'" data-has-recipe="'+Boolean(consumption)+'" data-suggestion="'+Math.ceil(Math.max(0,n(x.pedidoReal)))+'" data-consumption="'+consumption+'" value="'+esc(Number.isFinite(missing)?missing:'')+'" ><button type="button" class="fw-demand-reset" aria-label="Restaurar sugestão de '+br(x.pedidoReal,0)+' peças" title="Voltar à sugestão: '+br(x.pedidoReal,0)+' peças" data-fw-demand-reset="'+esc(x.produtoId||x.produtoNome)+'" '+(missing===Math.ceil(Math.max(0,n(x.pedidoReal)))?'hidden':'')+'>↶</button></div></td><td data-fw-demand-meters>'+(consumption?br(meters,2)+' m':'Não calculado')+'</td><td>'+(rec?br(bal,2)+' m':'Tecido não vinculado')+'</td><td>'+(rec?'<input class="fw-check" type="checkbox" data-fw-demand="'+esc(x.produtoId||x.produtoNome)+'" checked>':link?'<button type="button" data-fw-link-recipe="'+esc(link.product_reference)+'">Vincular tecido</button>':'—')+'</td></tr>'
 }).join('');
 return '<div class="fw-cards"><article><small>Peças pedidas</small><b>'+br(snap.reduce((a,x)=>a+n(x.pedidoReal),0),0)+'</b></article><article><small>Peças em produção</small><b>'+br(pending,0)+'</b></article><article><small>Tecidos cadastrados</small><b>'+state.fabric.length+'</b></article></div><div class="fw-panel"><h3>Gerar ordem sem duplicar pedido de peça</h3><p>Ajuste a quantidade a pedir antes de gerar a OS. A sugestão já desconta os pedidos em andamento; o tecido estimado acompanha a quantidade escolhida. Itens sem ficha técnica podem ser ajustados, mas exigem a ficha para gerar a ordem.</p><div class="fw-table-scroll"><table><thead><tr><th>Peça</th><th>Necessidade</th><th>Consumo padrão</th><th>Já coberto</th><th>Quantidade a pedir</th><th>Tecido estimado</th><th>Saldo tecido</th><th>Incluir</th></tr></thead><tbody>'+ (rows||'<tr><td colspan="8">Sem demanda de peças carregada. Abra o painel de Enxoval e atualize a base RFID.</td></tr>')+'</tbody></table></div><button type="button" data-fw-create-order>Gerar ordem de facção para selecionados</button></div><div class="fw-panel"><h3>Ordens abertas</h3>'+ordersTable()+'</div>';
}
function ordersTable(){const rows=state.items.map(i=>{const o=state.orders.find(x=>x.id===i.order_id),s=orderStats(i),shipments=state.moves.filter(m=>m.order_item_id===i.id&&m.movement_type==='ENVIO_FACCAO').sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))),sent=state.cuts.filter(c=>c.order_item_id===i.id&&c.sent_date).sort((a,b)=>a.sent_date.localeCompare(b.sent_date))[0],due=sent?sent.expected_date:state.cuts.some(c=>c.order_item_id===i.id)?'Corte concluído, aguardando envio':shipments.length?'Envio anterior: conferir prazo':'Aguardando corte',trace=shipments.map(m=>{const l=state.lots.find(l=>l.id===m.lot_id);return (l?.lot_code||m.lot_id)+' • NF '+(l?.invoice_number||'—')+' • '+br(m.quantity_m,3)+' m'}).join(' / '),needed=n(i.ordered_pieces)*n(i.consumption_m_per_piece),r=state.recipes.find(x=>x.id===i.recipe_id);return '<tr><td>OS '+esc(o?.order_number||'—')+' • '+esc(i.product_name)+'<small>Ref. '+esc(state.fabric.find(f=>f.id===i.fabric_id)?.color_reference||'—')+' • Q'+esc(state.fabric.find(f=>f.id===i.fabric_id)?.quality_code||'—')+'</small></td><td>'+br(i.ordered_pieces,0)+' pç</td><td>'+br(needed,2)+' m</td><td>'+br(s.issued,2)+' m enviados<small>'+esc(trace)+'</small><small>Previsão: '+esc(due)+'</small></td><td>'+br(s.accepted,0)+' aceitas / '+br(s.rejected,0)+' rejeitadas</td><td>'+(r&&s.issued+0.0005<needed?'<a href="#os-cut-'+i.id+'">Registrar corte por lote</a>':'')+' <button type="button" data-fw-return="'+i.id+'">Lançar retorno</button></td></tr>'}).join('');return '<div class="fw-table-scroll"><table><thead><tr><th>OS / produto</th><th>Peças</th><th>Tecido previsto</th><th>Envio</th><th>Retorno</th><th>Ação</th></tr></thead><tbody>'+ (rows||'<tr><td colspan="6">Nenhuma OS gravada.</td></tr>')+'</tbody></table></div>'}
function poLineHtml(){return '<div data-fw-po-line class="fw-po-line"><label class="fw-field">Tecido padrão GAO<select data-fw-purchase-standard required>'+standardOptions()+'</select></label><label class="fw-field">Código / referência do fornecedor<select name="fabric_id" required><option value="">Escolha padrão e fornecedor</option></select></label><label class="fw-field">Quantidade (m)<input name="ordered_m" type="number" min=".001" step=".001" required></label><label class="fw-field">Preço previsto (R$/m)<input name="purchase_price_per_m" type="number" min="0" step=".0001" required></label><button type="button" data-fw-remove-po-line>Remover</button></div>';}

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
 const rows=summarized.sort((a,b)=>Number(['LIBERADA','CANCELADA'].includes(a.summary.status))-Number(['LIBERADA','CANCELADA'].includes(b.summary.status))).map(({order,summary})=>{
  const supplier=state.suppliers.find(item=>item.id===order.supplier_id);
  const lines=state.purchaseItems.filter(item=>item.purchase_order_id===order.id);
  const lineRows=lines.map(item=>{
   const fabric=state.fabric.find(x=>x.id===item.fabric_id);
   const line=summary.lines.find(x=>String(x.id)===String(item.id));
   const canReceive=order.status!=='CANCELADA'&&n(item.ordered_m)-n(item.received_m)>0.0005;
   return '<tr><td>'+esc((fabric?internalName(fabric)+' — ':'')+fabric?.code+' • '+fabric?.name+' • Ref. '+(fabric?.color_reference||'—')+' • Q'+(fabric?.quality_code||'—'))+'</td><td>'+br(item.ordered_m,3)+' m</td><td>'+br(item.received_m,3)+' m</td><td><b>'+br(Math.max(0,n(item.ordered_m)-n(item.received_m)),3)+' m</b></td><td>R$ '+br(item.purchase_price_per_m,4)+'/m</td><td><span class="fw-status">'+esc(line?.label||'Status não identificado')+'</span></td><td>'+(canReceive?'<button type="button" data-fw-receive-po-item="'+item.id+'">Registrar recebimento</button>':'—')+'</td></tr>';
  }).join('');
  return '<details class="fw-po-order" data-fw-purchase-row data-search="'+esc([order.order_number,supplier?.trade_name,supplier?.legal_name,...lines.map(i=>{const f=state.fabric.find(f=>f.id===i.fabric_id);return [f?.code,f?.name,f?.color,f?.color_reference].join(' ')})].join(' ').toLocaleLowerCase('pt-BR'))+'"><summary><b>Pedido '+esc(order.order_number)+' • '+esc(supplier?.trade_name||supplier?.legal_name||'Fornecedor')+' <span class="fw-status">'+esc(summary.label)+'</span></b><span class="fw-order-meter">'+br(summary.receivedMeters,3)+' / '+br(summary.orderedMeters,3)+' m recebidos</span></summary><p>Pedido em '+esc(order.ordered_date||'—')+' • Previsão '+esc(order.expected_date||'não informada')+' • Total recebido '+br(summary.receivedMeters,3)+' / '+br(summary.orderedMeters,3)+' m</p><div class="fw-table-scroll"><table><thead><tr><th>Tecido / referência / Q</th><th>Pedido</th><th>Recebido</th><th>Pendente</th><th>Preço previsto</th><th>Status do item</th><th>Ação</th></tr></thead><tbody>'+lineRows+'</tbody></table></div></details>';
 }).join('');
 return '<div class="fw-panel fw-purchase-orders"><h3>Acompanhamento geral dos pedidos de tecido</h3><p>Fluxo: necessidade/cotação → pedido emitido → recebimento parcial ou total → inspeção do lote → aprovação e liberação para estoque. Pedido aberto não entra no saldo; lote recebido pendente de inspeção fica separado do tecido liberado.</p>'+cards+'<details class="fw-new-order"><summary>+ Novo pedido de compra</summary><form data-fw-form="purchaseOrder"><input name="order_number" placeholder="Número do pedido / OC" required><select name="supplier_id" required><option value="">Fornecedor</option>'+state.suppliers.map(x=>'<option value="'+x.id+'">'+esc(x.trade_name||x.legal_name)+'</option>').join('')+'</select><input name="ordered_date" type="date" value="'+new Date().toISOString().slice(0,10)+'" required><input name="expected_date" type="date" aria-label="Previsão de entrega"><input name="notes" placeholder="Observação (opcional)"><div data-fw-po-lines>'+poLineHtml()+'</div><button type="button" data-fw-add-po-line>Adicionar tecido/cor</button><button type="submit">Registrar pedido de tecido</button></form></details><label>Buscar pedido<input type="search" data-fw-purchase-search placeholder="Pedido, fornecedor, tecido ou cor"></label><p>Clique no pedido para consultar itens e registrar o recebimento.</p>'+(rows||'<p>Nenhum pedido de tecido registrado ainda.</p>')+'</div>';
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
function fabricMatches(a,b){return sameFabricStandard(state.fabric,a,b);}
function internalName(f){const standard=state.standards.find(s=>s.id===f?.standard_id);return standard?standard.code+' • '+standard.name:f?f.code+' • '+f.name:'Tecido não identificado';}
function internalFabricOptions(selected=''){
 if(!state.standards.length)return catalogOptionList(selected);
 const selectedRef=state.fabric.find(f=>f.id===selected);
 return '<option value="">Selecione o tecido padrão GAO</option>'+groupFabricStandards(state.standards.filter(s=>s.active&&(s.material_kind||'TECIDO')==='TECIDO'),state.fabric).map(({standard,references})=>{
  const usable=references.filter(f=>f.active&&f.homologated&&f.standard_link_approved);if(!usable.length)return '';
  const ref=selectedRef?.standard_id===standard.id?selectedRef:usable[0];return '<option value="'+ref.id+'" '+(selectedRef?.standard_id===standard.id?'selected':'')+'>'+esc(standard.code+' • '+standard.name)+'</option>';
 }).join('');
}
function standardOptions(selected=''){return '<option value="">Padrão GAO</option>'+state.standards.filter(s=>s.active&&(s.material_kind||'TECIDO')==='TECIDO').map(s=>'<option value="'+s.id+'" '+(s.id===selected?'selected':'')+'>'+esc(s.code+' • '+s.name)+'</option>').join('');}
function planningFabrics(){
 if(!state.standards.length)return state.fabric;
 return groupFabricStandards(state.standards,state.fabric).filter(g=>g.references.length).flatMap(({standard,references})=>{const approved=references.filter(f=>f.active&&f.homologated&&f.standard_link_approved),pending=references.filter(f=>!approved.includes(f));return [...(approved.length?[{...approved[0],name:standard.name,color:standard.color,color_reference:standard.code,quality_code:standard.quality_requirement||'—'}]:[]),...pending];});
}
function receiptReferenceOptions(supplier='',selected=''){
 return state.fabric.filter(f=>f.active!==false&&(!supplier||f.supplier_id===supplier)).map(f=>{const standard=state.standards.find(s=>s.id===f.standard_id);return '<option value="'+f.id+'" '+(f.id===selected?'selected':'')+'>'+esc((standard?standard.code+' • ':'')+f.code+' • '+(f.color_reference||f.color||'—')+' • Q'+(f.quality_code||'—'))+'</option>'}).join('');
}
function refreshPurchaseReferences(form){
 const supplier=form.querySelector('select[name="supplier_id"]').value;
 for(const row of form.querySelectorAll('[data-fw-po-line]')){
  const standard=row.querySelector('[data-fw-purchase-standard]').value,select=row.querySelector('[name="fabric_id"]'),previous=select.value;
  const choices=purchaseReferenceChoices(state.fabric,standard,supplier);
  select.innerHTML='<option value="">'+(!supplier?'Escolha o fornecedor':!standard?'Escolha o padrão GAO':choices.length?'Referência homologada do fornecedor':'Sem referência homologada para este fornecedor')+'</option>'+choices.map(f=>'<option value="'+f.id+'" '+(f.id===previous?'selected':'')+'>'+esc(f.code+' • Ref. '+(f.color_reference||'—')+' • Q'+(f.quality_code||'—')+' • '+f.name)+'</option>').join('');
  if(choices.length===1)select.value=choices[0].id;
  const price=row.querySelector('[name="purchase_price_per_m"]'),ref=state.fabric.find(f=>f.id===select.value),lot=state.lots.find(l=>l.fabric_id===ref?.id&&l.supplier_id===supplier);
  if(lot&&(!price.value||price.dataset.auto==='true')){price.value=lot.purchase_price_per_m??lot.effective_price_per_m;price.dataset.auto='true';}else if(!lot&&price.dataset.auto==='true'){price.value='';delete price.dataset.auto;}
 }
}
function standardsManagementView(){
 const fabrics=state.standards.filter(s=>s.active&&(s.material_kind||'TECIDO')==='TECIDO').sort((a,b)=>a.code.localeCompare(b.code));
 const finished=state.standards.filter(s=>s.active&&s.material_kind==='PRODUTO_ACABADO').sort((a,b)=>a.code.localeCompare(b.code));
 return '<div class="fw-panel"><h3>Padrões de tecido GAO</h3><p>Estoque e consumo em metros. Códigos, qualidades Q1/Q2 e tratamentos ficam nas referências de cada fornecedor.</p><button type="button" data-fw-edit-standard="new">Novo padrão de tecido</button>'+groupFabricStandards(fabrics,state.fabric).map(({standard,references})=>'<details class="fw-catalog-edit"><summary><b>'+esc(standard.name)+'</b><small>'+esc(standard.code)+' • '+references.length+' referência(s) de fornecedor • '+(standard.gsm?br(standard.gsm,1)+' g/m²':'Gramatura a conferir')+(standard.width_m?' • '+br(standard.width_m,3)+' m de largura':'')+'</small></summary><p>'+esc(standard.composition||'Composição a conferir')+'</p><button type="button" data-fw-edit-standard="'+standard.id+'">Editar padrão</button> <button type="button" data-fw-standard-origin="'+standard.id+'">Compras, lotes e custos</button>'+references.map(f=>{const supplier=state.suppliers.find(x=>x.id===f.supplier_id);return '<article class="fw-reference"><b>'+esc(supplier?.trade_name||supplier?.legal_name||'Fornecedor não relacionado')+'</b><p>'+esc(f.code+' • '+f.name+' • Ref. '+(f.color_reference||'—')+' • Q'+(f.quality_code||'—'))+'</p><span class="fw-status">'+(f.standard_link_approved?'Vínculo aprovado':'Conferir vínculo')+'</span> <button type="button" data-fw-map-reference="'+f.id+'">Relacionar ao padrão GAO</button></article>'}).join('')+(references.length?'':'<p>Sem referência comercial cadastrada. Relacione a referência do fornecedor antes da compra.</p>')+'</details>').join('')+'</div><div class="fw-panel"><h3>Produtos acabados</h3><p>Itens comprados prontos, classificados em peças. Não entram nas compras ou no consumo de tecido em metros.</p><button type="button" data-fw-edit-standard="new-finished">Novo produto acabado</button>'+finished.map(s=>'<article class="fw-reference"><b>'+esc(s.name)+'</b><p>'+esc(s.code)+' • Unidade: peça</p><button type="button" data-fw-edit-standard="'+s.id+'">Editar cadastro</button></article>').join('')+'</div>';
}

function openStandardWindow(kind,id){
 if(document.querySelector('[data-fw-standard-dialog]'))return;
 const dialog=document.createElement('dialog');dialog.className='fw-recipe-dialog';dialog.setAttribute('data-fw-standard-dialog','');dialog.setAttribute('aria-label','Padrão GAO e referências');
 let body='',title='';
 if(kind==='standard'){
  const r=state.standards.find(s=>s.id===id)||{},materialKind=r.material_kind||(id==='new-finished'?'PRODUTO_ACABADO':'TECIDO');title=r.id?'Editar padrão GAO':materialKind==='PRODUTO_ACABADO'?'Novo produto acabado':'Novo padrão de tecido';
  body='<p>Tipo: '+(materialKind==='PRODUTO_ACABADO'?'produto acabado • unidade: peça':'tecido • unidade: metro')+'</p><form data-fw-form="standard"><input type="hidden" name="material_kind" value="'+materialKind+'"><input type="hidden" name="id" value="'+esc(r.id||'')+'">'+[['code','Código GAO'],['name','Nome padronizado'],['fabric_type','Tipo de tecido'],['composition','Composição'],['color','Cor GAO'],['width_m','Largura (m)'],['gsm','Gramatura (g/m²)'],['quality_requirement','Requisito de qualidade'],['notes','Notas técnicas']].map(([key,label])=>'<label class="fw-field">'+label+'<input name="'+key+'" '+(['width_m','gsm'].includes(key)?'type="number" min=".001" step=".001"':'')+' value="'+esc(r[key]??'')+'" '+(['code','name'].includes(key)?'required':'')+'></label>').join('')+'<button>Salvar padrão</button><button type="button" data-fw-standard-close>Cancelar</button></form>';
 }else if(kind==='reference'){
  const r=state.fabric.find(f=>f.id===id);if(!r)return;title='Referência do fornecedor → padrão GAO';body='<p><b>'+esc(r.code+' • '+r.name+' • Ref. '+r.color_reference+' • Q'+r.quality_code)+'</b></p><p>Confira composição, gramatura, largura, tratamento e cor antes de homologar equivalência com outro material.</p><form data-fw-form="standardReference"><input type="hidden" name="id" value="'+r.id+'"><label class="fw-field">Padrão GAO<select name="standard_id" required>'+standardOptions(r.standard_id)+'</select></label><label class="fw-field">Fornecedor<select name="supplier_id" required>'+supplierOptionList(r.supplier_id)+'</select></label><label><input type="checkbox" name="standard_link_approved" '+(r.standard_link_approved?'checked':'')+'> Conferi e aprovo a referência comercial para este padrão</label><button>Salvar vínculo</button><button type="button" data-fw-standard-close>Cancelar</button></form>';
 }else{
  const r=state.standards.find(s=>s.id===id);title='Origem das compras e custo por lote';const ids=new Set(state.fabric.filter(f=>f.standard_id===id).map(f=>f.id));
  const lots=state.lots.filter(l=>ids.has(l.fabric_id));body='<p><b>'+esc(r?.code+' • '+r?.name)+'</b></p><div class="fw-table-scroll"><table><thead><tr><th>Fornecedor / referência</th><th>NF / lote</th><th>Recebido</th><th>Custo efetivo</th></tr></thead><tbody>'+lots.map(l=>{const f=state.fabric.find(f=>f.id===l.fabric_id),v=state.suppliers.find(v=>v.id===l.supplier_id);return '<tr><td>'+esc(v?.trade_name||v?.legal_name||'—')+'<small>'+esc(f?.code+' • '+f?.color_reference+' • Q'+f?.quality_code)+'</small></td><td>NF '+esc(l.invoice_number||'—')+'<small>'+esc(l.lot_code)+' • '+esc(l.received_date||'—')+'</small></td><td>'+br(l.quantity_received_m,3)+' m</td><td>R$ '+br(l.effective_price_per_m,4)+'/m</td></tr>'}).join('')+'</tbody></table></div><h3>Consumo registrado na produção</h3>'+state.moves.filter(m=>m.movement_type==='ENVIO_FACCAO'&&lots.some(l=>l.id===m.lot_id)).map(m=>{const i=state.items.find(i=>i.id===m.order_item_id),o=state.orders.find(o=>o.id===i?.order_id),l=lots.find(l=>l.id===m.lot_id);return '<p>OS '+esc(o?.order_number)+' • '+esc(i?.product_name)+' • lote '+esc(l?.lot_code)+' • '+br(m.quantity_m,3)+' m × R$ '+br(m.unit_cost_per_m,4)+'/m = R$ '+br(n(m.quantity_m)*n(m.unit_cost_per_m))+'</p>'}).join('')+'<p>A quantidade e o custo do lote utilizado ficam registrados em cada movimento de corte.</p>';
 }
 dialog.innerHTML='<header class="fw-modal-head"><h2>'+title+'</h2><button type="button" data-fw-standard-close aria-label="Fechar">×</button></header><div class="fw-panel"><div data-fw-standard-error class="fw-error" role="alert" hidden></div>'+body+'</div>';document.body.appendChild(dialog);dialog.showModal();dialog.addEventListener('cancel',e=>{if(dialog.dataset.saving==='true')e.preventDefault();else dialog.remove();});
}
function catalogOptionList(selected=''){
 return '<option value="">Selecione tecido homologado</option>'+state.fabric.filter(f=>f.active).map(f=>'<option value="'+f.id+'" '+(f.id===selected?'selected':'')+'>'+esc(f.code+' • '+f.name+' • '+(f.color||'cor não informada')+' • Ref. '+(f.color_reference||'—')+' • Q'+(f.quality_code||'—')+(f.homologated?' • HOMOLOGADO':' • PENDENTE'))+'</option>').join('');
}
function supplierOptionList(selected=''){
 return '<option value="">Fornecedor não identificado</option>'+state.suppliers.map(s=>'<option value="'+s.id+'" '+(s.id===selected?'selected':'')+'>'+esc(s.trade_name||s.legal_name)+'</option>').join('');
}
function catalogManagementView(){
 const catalogRows=state.fabric.map(f=>'<section data-fw-catalog-row data-search="'+esc([f.code,f.name,f.color,f.color_reference,f.quality_code,f.composition].join(' ').toLocaleLowerCase('pt-BR'))+'"><div class="fw-catalog-actions"><button type="button" data-fw-catalog-action="edit" data-id="'+f.id+'">Editar</button><button type="button" data-fw-catalog-action="copy" data-id="'+f.id+'">Duplicar / nova cor</button><button type="button" data-fw-catalog-action="toggle" data-id="'+f.id+'">'+(f.active===false?'Reativar':'Inativar')+'</button><button type="button" data-fw-catalog-action="delete" data-id="'+f.id+'">Excluir</button></div><details class="fw-catalog-edit"><summary><b>'+esc(f.code+' • '+f.name)+'</b> — '+esc(f.color||'cor não informada')+' • Ref. '+esc(f.color_reference||'—')+' • Q'+esc(f.quality_code||'—')+' <span class="fw-status">'+(f.active===false?'INATIVO':f.homologated?'HOMOLOGADO':'PENDENTE DE HOMOLOGAÇÃO')+'</span></summary><form data-fw-form="catalogEdit"><input type="hidden" name="id" value="'+f.id+'"><input name="code" aria-label="Código GAO ou fabricante" placeholder="Código" value="'+esc(f.code)+'" required><input name="name" aria-label="Nome oficial do tecido" placeholder="Nome oficial" value="'+esc(f.name)+'" required><input name="fabric_type" aria-label="Fornecedor e tipo" placeholder="Fornecedor e tipo" value="'+esc(f.fabric_type||'')+'"><input name="composition" aria-label="Composição" placeholder="Composição" value="'+esc(f.composition||'')+'"><input name="color" aria-label="Cor homologada" placeholder="Cor homologada" value="'+esc(f.color||'')+'"><input name="color_reference" aria-label="Referência oficial da cor" placeholder="Ref. oficial (ex.: P53)" value="'+esc(f.color_reference||'')+'" required><input name="quality_code" aria-label="Qualidade Q" placeholder="Q (ex.: 1 ou 2)" value="'+esc(f.quality_code||'')+'" required><input name="width_m" type="number" min="0" step=".001" aria-label="Largura em metros" placeholder="Largura (m)" value="'+esc(f.width_m??'')+'"><label><input type="checkbox" name="homologated" '+(f.homologated?'checked':'')+'> Referência conferida e homologada pela GAO</label><button type="submit">Salvar referência comercial</button></form></details></section>').join('');
 const aliasRows=state.aliases.map(a=>{
  const canonical=state.fabric.find(f=>f.id===a.fabric_id);
  return '<details class="fw-catalog-edit"><summary><b>NF: '+esc(a.supplier_item_code||'sem código')+' • '+esc(a.supplier_item_description||'descrição não informada')+'</b> → '+esc(canonical?.color_reference||'ref. —')+' / Q'+esc(canonical?.quality_code||'—')+' <span class="fw-status">'+(a.active===false?'INATIVO':a.homologated?'HOMOLOGADO':'PENDENTE')+'</span></summary><form data-fw-form="aliasEdit"><input type="hidden" name="id" value="'+a.id+'"><select name="fabric_id" required>'+catalogOptionList(a.fabric_id)+'</select><select name="supplier_id">'+supplierOptionList(a.supplier_id||'')+'</select><input name="supplier_item_code" aria-label="Código na NF" placeholder="Código do item na NF" value="'+esc(a.supplier_item_code||'')+'"><input name="supplier_item_description" aria-label="Descrição exata na NF" placeholder="Descrição exata da NF" value="'+esc(a.supplier_item_description||'')+'"><input name="invoice_color_reference" aria-label="Referência na NF" placeholder="Referência como veio na NF" value="'+esc(a.invoice_color_reference||'')+'"><input name="invoice_quality_code" aria-label="Qualidade na NF" placeholder="Q como veio na NF" value="'+esc(a.invoice_quality_code||'')+'"><input name="source_invoice_number" aria-label="Número da NF" placeholder="Número da NF" value="'+esc(a.source_invoice_number||'')+'"><input name="notes" aria-label="Observação" placeholder="Observação da conferência" value="'+esc(a.notes||'')+'"><label><input type="checkbox" name="homologated" '+(a.homologated?'checked':'')+'> Vínculo conferido pela GAO</label><label><input type="checkbox" name="active" '+(a.active===false?'':'checked')+'> Vínculo ativo</label><button type="submit">Salvar vínculo</button></form></details>';
 }).join('');
 return '<div class="fw-panel"><h3>Referências comerciais por fornecedor</h3><p>Estes são os códigos e as descrições originais dos fornecedores. O padrão interno GAO fica no cadastro acima; cada referência comercial precisa estar relacionada ao padrão e ao fornecedor corretos.</p><label>Buscar tecido<input type="search" data-fw-catalog-search placeholder="Código, nome, cor ou referência"></label><p>Inativar retira o tecido das novas seleções. Excluir só é permitido quando não há vínculos; o histórico de estoque é preservado.</p><div class="fw-table-scroll">'+(catalogRows||'<p>Nenhum tecido cadastrado.</p>')+'</div></div><div class="fw-panel"><h3>Relacionar códigos e descrições de NF</h3><p>Cadastre o texto exatamente como aparece na nota e associe ao tecido, cor, referência e Q corretos. Vínculos pendentes não entram como equivalência homologada.</p><form data-fw-form="aliasCreate"><select name="fabric_id" required>'+catalogOptionList()+'</select><select name="supplier_id">'+supplierOptionList()+'</select><input name="supplier_item_code" aria-label="Código do item na NF" placeholder="Código na NF / fornecedor"><input name="supplier_item_description" aria-label="Descrição exata da NF" placeholder="Descrição exata da NF"><input name="invoice_color_reference" aria-label="Referência da cor na NF" placeholder="Ref. como veio na NF"><input name="invoice_quality_code" aria-label="Qualidade na NF" placeholder="Q como veio na NF"><input name="source_invoice_number" aria-label="Número da NF" placeholder="Número da NF"><input name="notes" aria-label="Observação" placeholder="Observação da conferência"><label><input type="checkbox" name="homologated"> Confirmo a equivalência para homologação</label><button type="submit">Salvar relação</button></form><div class="fw-table-scroll">'+(aliasRows||'<p>Nenhum código de NF relacionado ainda.</p>')+'</div></div>';
}
function stockView(){
 const bal=liveBalances();
 const stock=planningFabrics().map(f=>{
  const ls=bal.filter(b=>fabricMatches(b.fabric_id,f.id));
  const approved=ls.filter(l=>l.quality_status==='APROVADO').reduce((a,l)=>a+l.onhand,0);
  const pending=ls.filter(l=>l.quality_status==='PENDENTE').reduce((a,l)=>a+l.onhand,0);
  const rejected=ls.filter(l=>l.quality_status==='REPROVADO').reduce((a,l)=>a+l.onhand,0);
  const reserved=ls.reduce((a,l)=>a+l.reserved,0);
  return '<tr><td><b>'+esc(internalName(f))+'</b><small>'+esc(f.fabric_type||'')+' '+esc(f.composition||'')+' • '+esc(f.color||'')+' • Ref. '+esc(f.color_reference||'—')+' • Q'+esc(f.quality_code||'—')+'</small></td><td>'+br(approved,2)+' m</td><td>'+br(pending,2)+' m</td><td>'+br(rejected,2)+' m</td><td>'+br(reserved,2)+' m</td><td>R$ '+br(ls.reduce((a,l)=>a+n(l.effective_price_per_m)*l.onhand,0),2)+'</td></tr>';
 }).join('');
 const lotRows=state.lots.map(l=>'<tr><td>'+esc((state.fabric.find(f=>f.id===l.fabric_id)?.name||'—')+' • Ref. '+(state.fabric.find(f=>f.id===l.fabric_id)?.color_reference||'—')+' • Q'+(state.fabric.find(f=>f.id===l.fabric_id)?.quality_code||'—'))+'</td><td>'+esc(l.lot_code)+'</td><td>'+br(l.quantity_received_m,2)+' m</td><td>R$ '+br(l.effective_price_per_m,4)+'/m</td><td>'+esc(l.quality_status)+'</td><td>'+'<button type="button" data-fw-tab="quality">Abrir Qualidade</button>'+'</td></tr>').join('');
 return purchaseOrderView()+'<div class="fw-panel"><h3>Cadastrar referência de fornecedor</h3><p>Escolha um modelo para preencher os dados técnicos. Confira a nova cor, referência e qualidade antes de salvar.</p><select data-fw-catalog-model aria-label="Usar tecido como modelo"><option value="">Usar tecido cadastrado como modelo</option>'+catalogOptionList()+'</select><form data-fw-form="fabric"><select name="standard_id" required>'+standardOptions()+'</select><select name="supplier_id" required>'+supplierOptionList()+'</select><input name="code" placeholder="Código" required><input name="name" placeholder="Nome do tecido" required><input name="fabric_type" placeholder="Tipo"><input name="composition" placeholder="Composição"><input name="color" placeholder="Cor (ex.: Azul céu)"><input name="color_reference" placeholder="Referência da cor (ex.: V02)" required><input name="quality_code" placeholder="Qualidade Q (ex.: 1 ou 2)" required><input name="width_m" type="number" step=".001" placeholder="Largura (m)"><label><input type="checkbox" name="homologated"> Referência conferida e homologada</label><button>Cadastrar tecido</button></form></div>'+catalogManagementView()+'<div class="fw-panel"><h3>Fornecedor</h3><form data-fw-form="supplier"><input name="legal_name" placeholder="Razão social" required><input name="trade_name" placeholder="Nome fantasia"><input name="cnpj" placeholder="CNPJ"><input name="supply_lines" placeholder="Linhas de fornecimento"><input name="lead_days" type="number" placeholder="Prazo (dias)"><button>Cadastrar fornecedor</button></form></div><div class="fw-panel"><h3>Registrar compra recebida / lote</h3><label>Importar XML da NF<input type="file" data-fw-invoice-xml accept=".xml"></label><div data-fw-invoice-preview></div><p>A gravação cria lote e entrada de estoque numa única operação. Registre apenas material fisicamente recebido.</p><form data-fw-form="receipt"><select name="fabric_id" required><option value="">Referência comercial da NF</option>'+receiptReferenceOptions()+'</select><select name="supplier_id"><option value="">Fornecedor (opcional)</option>'+state.suppliers.map(s=>'<option value="'+s.id+'">'+esc(s.trade_name||s.legal_name)+'</option>').join('')+'</select><input name="lot_code" placeholder="Lote" required><input name="invoice_number" placeholder="NF"><input name="invoice_item_code" placeholder="Código do item na NF"><input name="invoice_item_description" placeholder="Descrição exata na NF"><input name="invoice_color_reference" placeholder="Ref. de cor como veio na NF"><input name="invoice_quality_code" placeholder="Q como veio na NF"><label><input type="checkbox" name="invoice_alias_homologated"> Confirmei a equivalência da NF</label><input name="quantity_m" type="number" min=".001" step=".001" placeholder="Quantidade (m)" required><input name="purchase_price_per_m" type="number" min="0" step=".0001" placeholder="R$/m" required><input name="freight_cost" type="number" min="0" step=".01" placeholder="Frete R$"><input name="other_cost" type="number" min="0" step=".01" placeholder="Outros custos R$"><input name="received_date" type="date"><button>Registrar recebimento</button></form></div><div class="fw-panel"><h3>Saldo e valor por tecido</h3><div class="fw-table-scroll"><table><thead><tr><th>Tecido</th><th>Liberado</th><th>Aguardando inspeção</th><th>Reprovado</th><th>Reservado</th><th>Valor em estoque</th></tr></thead><tbody>'+(stock||'<tr><td colspan="6">Cadastre os tecidos para iniciar.</td></tr>')+'</tbody></table></div></div><div class="fw-panel"><h3>Lotes recebidos e aprovação</h3><p>Lotes só podem ser enviados à facção depois de aprovados.</p><div class="fw-table-scroll"><table><thead><tr><th>Tecido</th><th>Lote</th><th>Qtd.</th><th>Custo efetivo</th><th>Inspeção do lote</th><th>Ação</th></tr></thead><tbody>'+(lotRows||'<tr><td colspan="6">Nenhum lote recebido.</td></tr>')+'</tbody></table></div></div>';
}
function lotInspectionView(lot){
 const f=state.fabric.find(x=>x.id===lot.fabric_id),inspections=state.inspections.filter(i=>i.lot_id===lot.id);
 return '<div class="fw-panel"><button type="button" data-fw-quality-all>Ver todas as avaliações</button><h3>Qualidade • '+esc(lot.lot_code)+'</h3><p>NF '+esc(lot.invoice_number||'—')+' • '+esc(f?.name||'—')+' • Ref. '+esc(f?.color_reference||'—')+' • '+br(lot.quantity_received_m,3)+' m</p><p><b>Situação: '+esc(lot.quality_status)+'</b></p>'+ (inspections.map(i=>'<article><p>'+esc(i.inspection_status)+' • '+esc(i.inspected_at||'')+'</p><p>'+esc(i.notes||'')+'</p>'+(i.report_path?'<button type="button" data-fw-report="'+esc(i.report_path)+'">Abrir relatório</button>':'<p>Sem relatório anexado neste registro.</p>')+'</article>').join('')||'<p>Nenhum relatório de inspeção vinculado a este lote.</p>')+'</div>';
}
function qualityView(){
 const focusLot=state.lots.find(l=>l.id===state.qualityLot);if(focusLot&&focusLot.quality_status==='APROVADO')return lotInspectionView(focusLot);
 const pending=state.lots.filter(l=>l.quality_status==='PENDENTE');
 const latest=lotId=>state.inspections.find(i=>i.lot_id===lotId);
 const cards='<div class="fw-cards"><article><small>Aguardando inspeção</small><b>'+pending.length+'</b></article><article><small>Aprovados</small><b>'+state.lots.filter(l=>l.quality_status==='APROVADO').length+'</b></article><article><small>Reprovados</small><b>'+state.lots.filter(l=>l.quality_status==='REPROVADO').length+'</b></article></div>';
 const groups=groupPendingFabricLotsByInvoice(state.lots);
 if(!groups.some(g=>g.invoice===state.qualityInvoice))state.qualityInvoice=groups[0]?.invoice||'';
 const selected=groups.find(g=>g.invoice===state.qualityInvoice)||groups[0];
 const invoiceTabs=groups.map(g=>'<button type="button" data-fw-quality-invoice="'+esc(g.invoice)+'" class="'+(g.invoice===selected?.invoice?'active':'')+'">NF '+esc(g.invoice)+' • '+g.lots.length+' lote(s)</button>').join('');
 const criteria=[['visual_ok','Aspecto e integridade visual conformes'],['color_ok','Cor compatível com o padrão homologado'],['composition_ok','Composição/identificação compatível com o pedido'],['width_ok','Largura dentro da especificação'],['defects_ok','Sem defeitos, manchas ou contaminação'],['invoice_match','NF, tecido, referência e Q conferidos']];
 const lotCards=selected?'<div class="fw-panel"><h4>NF '+esc(selected.invoice)+' • Avaliação conjunta</h4><p>Confira cada lote abaixo. A decisão escolhida e o relatório anexado serão aplicados aos lotes desta nota; o checklist é individual por lote.</p><form data-fw-form="qualityBatch" enctype="multipart/form-data"><div class="fw-table-scroll"><table><thead><tr><th>Lote / tecido</th><th>Quantidade</th><th>Conferência deste lote</th></tr></thead><tbody>'+selected.lots.map(l=>{const f=state.fabric.find(x=>x.id===l.fabric_id),s=latest(l.id);return '<tr><td><b>'+esc(l.lot_code)+'</b><small>'+esc(f?.name||'Tecido')+' • Cor '+esc(f?.color||'—')+' • Ref. '+esc(f?.color_reference||'—')+' • Q'+esc(f?.quality_code||'—')+' • recebido '+esc(l.received_date||'—')+'</small>'+(s?'<small>Última avaliação: '+esc(s.inspection_status)+' em '+esc(s.inspected_at||'')+'</small>':'')+(s?.report_path?'<button type="button" data-fw-report="'+esc(s.report_path)+'">Abrir último relatório</button>':'')+'</td><td>'+br(l.quantity_received_m,2)+' m</td><td>'+criteria.map(([key,label])=>'<label><input type="checkbox" data-fw-lot-check="'+esc(l.id)+'" data-fw-criterion="'+key+'"> '+label+'</label>').join('')+'</td></tr>'}).join('')+'</tbody></table></div><label>Decisão para esta NF <select name="inspection_status" required><option value="">Escolha uma decisão</option><option value="APROVADO">Aprovar os lotes conformes</option><option value="REPROVADO">Reprovar e bloquear os lotes</option></select></label><label>Relatório/evidência desta NF <input name="report" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required></label><textarea name="notes" placeholder="Observação da avaliação; obrigatório se reprovar"></textarea><button type="submit">Registrar avaliação dos '+selected.lots.length+' lote(s)</button></form></div>':'<p>Nenhum lote pendente de avaliação.</p>';
 const history=state.inspections.map(i=>{const l=state.lots.find(x=>x.id===i.lot_id),f=state.fabric.find(x=>x.id===l?.fabric_id);return '<tr><td>'+esc(f?.name||'—')+' • Ref. '+esc(f?.color_reference||'—')+' • Q'+esc(f?.quality_code||'—')+'</td><td>'+esc(l?.lot_code||'—')+'</td><td>'+esc(i.inspection_status)+'</td><td>'+esc(i.inspected_at||'')+'</td><td>'+esc(i.report_filename||'')+'</td><td><button type="button" data-fw-report="'+esc(i.report_path)+'">Abrir relatório</button></td></tr>'}).join('');
 return '<div class="fw-panel"><h3>Qualidade de tecidos • avaliação e liberação</h3><p>As abas agrupam os lotes por nota fiscal. Para aprovar, todos os critérios precisam estar conformes em cada lote e é necessário anexar evidência. A reprovação mantém os lotes bloqueados no estoque.</p>'+cards+'<nav class="fw-tabs" aria-label="Notas fiscais para avaliar">'+(invoiceTabs||'<span>Nenhuma nota aguardando avaliação.</span>')+'</nav>'+lotCards+'</div><div class="fw-panel"><h3>Histórico de inspeções</h3><div class="fw-table-scroll"><table><thead><tr><th>Tecido / referência</th><th>Lote</th><th>Decisão</th><th>Data e hora</th><th>Arquivo</th><th>Ação</th></tr></thead><tbody>'+(history||'<tr><td colspan="6">Nenhuma inspeção registrada.</td></tr>')+'</tbody></table></div></div>';
}
async function uploadQualityReport(path,file){
 const url=SB+'/storage/v1/object/fabric-quality-reports/'+path.split('/').map(encodeURIComponent).join('/');
 const send=()=>fetch(url,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+state.session.access_token,'Content-Type':file.type,'x-upsert':'false'},body:file});
 let response=await send();let text=await response.text();
 if(!response.ok&&[401,403].includes(response.status)&&/exp|expired|timestamp|jwt/i.test(text)&&typeof window.GAO_REFRESH_SESSION==='function'){
  state.session=await window.GAO_REFRESH_SESSION();response=await send();text=await response.text();
 }
 if(!response.ok)throw Error('Falha ao enviar relatório: '+text);
}
async function saveQualityBatch(form){
 const file=form.querySelector('[name=report]')?.files?.[0];if(!file)throw Error('Anexe o relatório ou evidência da NF.');
 const allowed=['application/pdf','image/jpeg','image/png','image/webp'];if(!allowed.includes(file.type))throw Error('Use PDF, JPG, PNG ou WEBP.');if(file.size>20*1024*1024)throw Error('O arquivo deve ter no máximo 20 MB.');
 const status=form.querySelector('[name=inspection_status]')?.value;if(!status)throw Error('Escolha a decisão da nota fiscal.');
 const lots=groupPendingFabricLotsByInvoice(state.lots).find(g=>g.invoice===state.qualityInvoice)?.lots||[];
 if(!lots.length)throw Error('Esta nota não possui lotes aguardando avaliação. Atualize os dados.');
 if(status==='REPROVADO'&&!form.querySelector('[name=notes]')?.value.trim())throw Error('Descreva o motivo da reprovação.');
 const checks=[...form.querySelectorAll('[data-fw-lot-check]')],criteria=['visual_ok','color_ok','composition_ok','width_ok','defects_ok','invoice_match'];
 const checklistByLot=Object.fromEntries(lots.map(l=>[l.id,Object.fromEntries(criteria.map(key=>[key,checks.some(c=>c.dataset.fwLotCheck===l.id&&c.dataset.fwCriterion===key&&c.checked)]))]));
 if(status==='APROVADO'&&Object.entries(checklistByLot).some(([,c])=>Object.values(c).some(v=>!v)))throw Error('Para aprovar a NF, marque conformes os seis critérios em cada lote.');
 if(lots.length>1&&!confirm('Registrar '+status+' para todos os '+lots.length+' lotes da NF '+state.qualityInvoice+'? A decisão e o relatório serão vinculados a cada lote.'))return;
 let completed=0;
 for(const lot of lots){
  const path=state.org+'/'+lot.id+'/'+uid()+'-'+file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  await uploadQualityReport(path,file);
  try{await rpc('record_fabric_lot_inspection',{p_organization_id:state.org,p_lot_id:lot.id,p_status:status,p_checklist:checklistByLot[lot.id],p_report_path:path,p_report_filename:file.name,p_report_mime_type:file.type,p_report_size_bytes:file.size,p_notes:form.querySelector('[name=notes]')?.value||null});completed++}
  catch(err){await fetch(SB+'/storage/v1/object/fabric-quality-reports/'+path.split('/').map(encodeURIComponent).join('/'),{method:'DELETE',headers:{apikey:KEY,Authorization:'Bearer '+state.session.access_token}}).catch(()=>{});if(completed)throw Error('A avaliação foi gravada em '+completed+' lote(s), mas falhou no lote '+lot.lot_code+': '+(err.message||err));throw err}
 }
}
async function openQualityReport(path){const win=window.open('about:blank','_blank');try{const r=await api('/storage/v1/object/sign/fabric-quality-reports/'+path.split('/').map(encodeURIComponent).join('/'),{method:'POST',body:JSON.stringify({expiresIn:3600})});const url=r.signedURL?.startsWith('http')?r.signedURL:SB+r.signedURL;if(!r.signedURL)throw Error('Não foi possível gerar o link do relatório.');if(win)win.location=url;else location.href=url}catch(err){win?.close();throw err}}
function recipeView(){
 const linkedOptions=state.materialLinks.map(l=>'<option value="'+esc(l.product_reference)+'">'+esc(l.product_reference+' • '+l.product_name)+'</option>').join('');
 const costs=state.costReferences.filter(r=>r.product_name);
 const costOptions=costs.map(r=>'<option value="'+r.id+'">'+esc(fabricCostReferenceLabel(r)+' • '+br(r.consumption_m_per_piece,3)+' m/peça • custo total R$ '+br(r.total_cost_per_piece)+'/peça')+'</option>').join('');
 const consumption=latestFabricConsumptionByVariant(state.consumptionReferences);
 const consumptionOptions=consumption.map(r=>'<option value="'+esc(r.variant_key)+'">'+esc([r.product_code||'sem código',r.product_name,r.size,r.fabric_description,r.color_description].filter(Boolean).join(' • '))+' — '+br(r.consumption_m_per_piece,4)+' m/peça'+(r.historical_consumptions.length>1?' • consumo revisado':'')+'</option>').join('');
 const unassigned=state.costReferences.filter(r=>!r.product_name).map(r=>'<tr><td>'+esc(r.fabric_description||'—')+'</td><td>'+esc(r.color_description||'—')+'</td><td>'+esc(r.supplier_name||'—')+'</td><td>'+br(r.quantity,0)+'</td><td>'+br(r.consumption_m_per_piece,3)+' m/peça</td><td>R$ '+br(r.fabric_cost_per_piece)+'</td><td>R$ '+br(r.faction_cost_per_piece)+'</td><td>R$ '+br(r.extras_cost_per_piece)+'</td><td>R$ '+br(r.total_cost_per_piece)+'</td><td>linha '+esc(r.source_row)+'</td></tr>').join('');
 const recipeRows=state.recipes.map(r=>{const f=state.fabric.find(x=>x.id===r.fabric_id),cr=state.costReferences.find(x=>x.id===r.cost_reference_id);return '<tr><td>'+esc(r.product_reference)+' • '+esc(r.product_name)+'</td><td>'+esc(internalName(f))+'</td><td>'+br(r.consumption_m_per_piece,4)+' m</td><td>R$ '+br(r.faction_cost_per_piece)+'</td><td>R$ '+br(r.label_cost_per_piece)+' / R$ '+br(r.rfid_cost_per_piece)+'</td><td>R$ '+br(r.extras_cost_per_piece)+'</td><td>R$ '+br(cr?.total_cost_per_piece)+'</td><td>'+esc(cr?cr.source_block+' • linha '+cr.source_row:'Manual')+'</td><td><button type="button" data-fw-edit-recipe="'+esc(r.id)+'">Editar</button></td></tr>'}).join('');
 return '<div class="fw-panel"><h3>Ficha técnica por peça</h3><p>Base: arquivo Controle de Tecido, aba Custo de Produção. Escolha a peça com seu tecido, cor e fornecedor para carregar os custos unitários; depois vincule o código exato da demanda e o tecido homologado.</p><label>Peças com consumo já vinculado<select data-fw-material-link><option value="">Escolher peça para concluir o vínculo do tecido</option>'+linkedOptions+'</select></label><form data-fw-form="recipe"><label class="fw-source-picker">Custo de produção por peça <select name="cost_reference_id" data-fw-cost-source><option value="">Escolher peça, tecido e cor</option>'+costOptions+'</select></label><small data-fw-cost-note class="fw-note">As bases A/B e as variantes por tecido/cor ficam separadas porque a planilha não identifica qual quadro A/B está vigente.</small><label class="fw-source-picker">Consumo por tamanho/variação (opcional) <select data-fw-consumption-source><option value="">Usar consumo do custo de produção</option>'+consumptionOptions+'</select></label><small data-fw-consumption-note class="fw-note">Complemento do mesmo arquivo Controle de Tecido, aba Pedido Produção. Altera somente o consumo da ficha.</small><select name="fabric_id" required>'+internalFabricOptions()+'</select><input name="product_reference" placeholder="Código exato da peça na demanda" required><input name="product_name" placeholder="Nome da peça" required><input name="consumption_m_per_piece" type="number" min=".0001" step=".0001" placeholder="Consumo (m/peça)" required><input name="faction_cost_per_piece" type="number" min="0" step=".01" placeholder="Facção R$/peça"><input name="label_cost_per_piece" type="number" min="0" step=".01" placeholder="Etiqueta R$/peça" value="0.22"><input name="rfid_cost_per_piece" type="number" min="0" step=".01" placeholder="RFID R$/peça" value="1.98"><input name="manual_extras_per_piece" type="number" min="0" step=".01" placeholder="Outros insumos R$/peça"><button>Salvar ficha técnica</button></form><div class="fw-table-scroll"><table><thead><tr><th>Peça</th><th>Tecido homologado</th><th>Consumo</th><th>Facção</th><th>Etiqueta / RFID</th><th>Insumos por peça</th><th>Total ref. planilha</th><th>Fonte</th><th>Ação</th></tr></thead><tbody>'+(recipeRows||'<tr><td colspan="9">Nenhuma ficha técnica cadastrada.</td></tr>')+'</tbody></table></div></div>'+(unassigned?'<div class="fw-panel"><h3>Custos da planilha sem nome de peça</h3><p>Estas linhas informam tecido, cor, fornecedor e custos, mas não identificam o produto. Não serão associadas automaticamente a nenhuma ficha.</p><div class="fw-table-scroll"><table><thead><tr><th>Tecido</th><th>Cor</th><th>Fornecedor</th><th>Qtd.</th><th>Consumo</th><th>Tecido/peça</th><th>Facção/peça</th><th>Insumos/peça</th><th>Total/peça</th><th>Origem</th></tr></thead><tbody>'+unassigned+'</tbody></table></div></div>':'');
}
function costView(){
 const rows=state.items.map(i=>{const s=orderStats(i),lots=state.lots.filter(l=>fabricMatches(l.fabric_id,i.fabric_id)),qty=lots.reduce((a,l)=>a+n(l.quantity_received_m),0),price=n(i.planned_price_per_m),planned=n(i.consumption_m_per_piece)*price+n(i.faction_cost_per_piece)+n(i.extras_cost_per_piece),o=state.orders.find(x=>x.id===i.order_id);return '<tr><td>#'+esc(o?.order_number)+' • '+esc(i.product_name)+'<small>'+esc(state.fabric.find(f=>f.id===i.fabric_id)?.color_reference||'')+' • Q'+esc(state.fabric.find(f=>f.id===i.fabric_id)?.quality_code||'')+'</small></td><td>'+br(s.accepted,0)+'</td><td>R$ '+br(planned)+'</td><td>'+(s.unit===null?'Aguardando retorno':'R$ '+br(s.unit))+'</td><td>'+br(s.loss,3)+' m<small>'+br(s.issued-s.returned>0?s.loss/(s.issued-s.returned)*100:0,2)+'% do consumo</small></td><td>R$ '+br(s.lossCost)+'</td></tr>'}).join('');
 return '<div class="fw-panel"><h3>Custo real e perda por ordem</h3><p>Custo real considera o tecido consumido, facção e aviamentos dividido pelas peças aceitas. Perda em metros = tecido enviado − sobra retornada − consumo teórico das peças produzidas.</p><div class="fw-table-scroll"><table><thead><tr><th>Peça / ordem</th><th>Peças aceitas</th><th>Custo previsto/peça</th><th>Custo real/peça</th><th>Perda de tecido</th><th>Custo da perda</th></tr></thead><tbody>'+(rows||'<tr><td colspan="6">Os custos aparecerão após registrar uma ordem e o retorno da facção.</td></tr>')+'</tbody></table></div></div>';
}


async function readInvoiceXML(file){
 if(!file)return;const xml=new DOMParser().parseFromString(await file.text(),'application/xml');if(xml.querySelector('parsererror'))throw Error('XML da NF inválido');
 const text=(el,tag)=>el?.getElementsByTagName(tag)[0]?.textContent?.trim()||'';
 const emit=xml.getElementsByTagName('emit')[0],cnpj=text(emit,'CNPJ'),supplier=state.suppliers.find(s=>String(s.cnpj||'').replace(/\D/g,'')===cnpj),nf=text(xml,'nNF');
 state.invoiceLines=[...xml.getElementsByTagName('det')].map(det=>{const prod=det.getElementsByTagName('prod')[0],unit=text(prod,'uCom').toUpperCase(),code=text(prod,'cProd'),description=text(prod,'xProd');if(!['M','MT','METRO','METROS'].includes(unit))return null;
 const aliases=state.aliases.filter(a=>a.active!==false&&a.homologated&&a.supplier_id===supplier?.id&&a.supplier_item_code===code&&a.supplier_item_description===description);
 return {invoice_number:nf,supplier_id:supplier?.id||'',invoice_item_code:code,invoice_item_description:description,quantity_m:text(prod,'qCom'),purchase_price_per_m:text(prod,'vUnCom'),lot_code:text(det,'nLote'),fabric_id:aliases.length===1?aliases[0].fabric_id:''};}).filter(Boolean);
 const preview=document.querySelector('[data-fw-invoice-preview]');if(preview)preview.innerHTML=state.invoiceLines.length?state.invoiceLines.map((r,i)=>'<p>'+esc(r.invoice_item_code+' — '+r.invoice_item_description)+' • '+br(r.quantity_m,3)+' m • R$ '+br(r.purchase_price_per_m,4)+'/m <button type="button" data-fw-invoice-line="'+i+'">Conferir entrada</button></p>').join(''):'Nenhum item em metros encontrado no XML. Confira a unidade antes do lançamento.';
}

const addDays=serviceOrderDueDate;
function stockPanelGroup(heading){
 if(/Cadastrar referência de fornecedor|Referências comerciais por fornecedor|Relacionar códigos/.test(heading))return 'catalog';
 if(heading==='Fornecedor')return 'suppliers';
 if(heading==='Acompanhamento geral dos pedidos de tecido')return 'purchases';
 if(heading==='Registrar compra recebida / lote')return 'receipt';
 if(heading==='Lotes recebidos e aprovação')return 'lots';
 return 'stock';
}
function stockPanels(mode){
 if(mode==='lots')return stockLotsView();
 const t=document.createElement('template');t.innerHTML=stockView();
 if(mode==='receipt'){
  const form=t.content.querySelector('[data-fw-form="receipt"]');
  const labels={fabric_id:'Tecido homologado',supplier_id:'Fornecedor',lot_code:'Lote recebido',invoice_number:'Número da NF',invoice_item_code:'Código na NF',invoice_item_description:'Descrição na NF',invoice_color_reference:'Referência na NF',invoice_quality_code:'Qualidade na NF',quantity_m:'Quantidade recebida (m)',purchase_price_per_m:'Preço do tecido (R$/m)',freight_cost:'Frete (R$)',other_cost:'Outros custos (R$)',received_date:'Data do recebimento'};
  for(const input of [...form.querySelectorAll('input:not([type="checkbox"]),select')]){const label=document.createElement('label');label.className='fw-field';label.textContent=labels[input.name]||input.name;input.before(label);label.appendChild(input);}
 }
 return [...t.content.children].filter(el=>stockPanelGroup(el.querySelector('h3')?.textContent||'')===mode).map(el=>el.outerHTML).join('')+
 (mode==='purchases'?incomingView():mode==='suppliers'?'<div class="fw-panel"><h3>Linhas cadastradas</h3>'+state.suppliers.map(x=>'<p><b>'+esc(x.trade_name||x.legal_name)+'</b> — '+esc(x.supply_lines||'Linha não informada')+'</p>').join('')+'</div>':'');
}
function stockLotsView(){
 const groups=new Map();for(const lot of state.lots){const key=String(lot.invoice_number||'Sem NF')+'|'+String(lot.supplier_id||'');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(lot);}
 return '<div class="fw-panel"><h3>Lotes por nota fiscal</h3><p>Abra uma nota para consultar seus tecidos, quantidades, custos e situação da qualidade.</p><label>Buscar nota ou tecido<input type="search" data-fw-lots-search placeholder="NF, lote, tecido ou referência"></label>'+([...groups.values()].map(lots=>{
 const supplier=state.suppliers.find(x=>x.id===lots[0].supplier_id),pending=lots.filter(l=>l.quality_status==='PENDENTE').length;
 const search=lots.map(l=>{const f=state.fabric.find(x=>x.id===l.fabric_id);return [l.invoice_number,l.lot_code,f?.name,f?.code,f?.color_reference].join(' ')}).join(' ').toLocaleLowerCase('pt-BR');
 return '<details class="fw-po-order" data-fw-lots-row data-search="'+esc(search)+'"><summary><b>NF '+esc(lots[0].invoice_number||'não informada')+' • '+esc(supplier?.trade_name||supplier?.legal_name||'Fornecedor não informado')+'</b><span class="fw-order-meter">'+lots.length+' lote(s) • '+br(lots.reduce((a,l)=>a+n(l.quantity_received_m),0),3)+' m • '+pending+' aguardando inspeção</span></summary><div class="fw-table-scroll"><table><thead><tr><th>Tecido / cor / Q</th><th>Lote</th><th>Recebido</th><th>Custo efetivo</th><th>Qualidade</th><th>Ação</th></tr></thead><tbody>'+lots.map(l=>{const f=state.fabric.find(x=>x.id===l.fabric_id);return '<tr><td>'+esc(f?.name||'—')+'<small>'+esc(f?.color||'')+' • Ref. '+esc(f?.color_reference||'—')+' • Q'+esc(f?.quality_code||'—')+'</small></td><td>'+esc(l.lot_code)+'</td><td>'+br(l.quantity_received_m,3)+' m</td><td>R$ '+br(l.effective_price_per_m,4)+'/m</td><td>'+esc(l.quality_status)+'</td><td><button type="button" data-fw-open-lot-quality="'+l.id+'">Ver avaliação</button></td></tr>'}).join('')+'</tbody></table></div></details>';
 }).join('')||'<p>Nenhum lote recebido.</p>')+'</div>';
}

function materialPurchasePlan(){
 const balances=liveBalances(),unlinked=[],extra=new Map();
 const trackingPending=state.tracking.filter(r=>n(r.quantity)>n(r.delivered)),reconciliationPending=trackingPending.length>0;
 for(const x of window.GAO_LINEN_NEED_SNAPSHOT||[]){
  if(n(x.pedidoReal)<=0&&!demandDrafts.has(String(x.produtoId||x.produtoNome)))continue;
  let quantity;try{quantity=demandQuantity(x)}catch{unlinked.push({row:x,reason:'Quantidade a pedir inválida'});continue;}
  if(!quantity)continue;
  const recipes=state.recipes.filter(r=>r.active&&r.product_reference===String(x.produtoId||x.produtoNome)&&n(r.consumption_m_per_piece)>0&&state.fabric.some(f=>f.id===r.fabric_id));
  const reason=!x.coverageReady?'Aguardando atualização dos pedidos em andamento':recipes.length===0?'Vincular tecido e consumo na ficha técnica':recipes.length>1?'Definir uma única ficha técnica ativa':'';
  if(reason){const link=materialLinkInfo(x.produtoId||x.produtoNome);unlinked.push({row:x,quantity,link,reason:!x.coverageReady?reason:recipes.length===0&&link?link.resolution_note:reason});continue;}
  const r=recipes[0];extra.set(r.fabric_id,(extra.get(r.fabric_id)||0)+quantity*n(r.consumption_m_per_piece));
 }
 const fabrics=planningFabrics().map(f=>{
  const approved=balances.filter(l=>fabricMatches(l.fabric_id,f.id)&&l.quality_status==='APROVADO').reduce((sum,l)=>sum+l.onhand,0),reserved=balances.filter(l=>fabricMatches(l.fabric_id,f.id)&&l.quality_status==='APROVADO').reduce((sum,l)=>sum+l.reserved,0);
  let needed=[...extra.entries()].filter(([id])=>fabricMatches(id,f.id)).reduce((sum,[,value])=>sum+value,0);
  for(const i of state.items.filter(i=>fabricMatches(i.fabric_id,f.id)&&['ABERTA','PARCIAL','ENVIADA'].includes(state.orders.find(o=>o.id===i.order_id)?.status)))needed+=Math.max(0,n(i.ordered_pieces)*n(i.consumption_m_per_piece)-orderStats(i).issued);
  const incoming=state.purchaseItems.filter(i=>fabricMatches(i.fabric_id,f.id)&&state.purchaseOrders.some(o=>o.id===i.purchase_order_id&&o.status!=='CANCELADA'&&o.logistics_stage!=='COTACAO')).reduce((sum,i)=>sum+Math.max(0,n(i.ordered_m)-n(i.received_m)),0);
  return {fabric:f,recorded:approved,free:reconciliationPending?null:Math.max(0,approved-reserved),reserved,needed,incoming,buy:reconciliationPending?null:Math.max(0,needed-approved-incoming)};
 }).sort((a,b)=>b.buy-a.buy);
 return {fabrics,unlinked,trackingPending,reconciliationPending};
}
function materialCoverageView(){
 const {fabrics,unlinked,trackingPending,reconciliationPending}=materialPurchasePlan();
 const rows=fabrics.map(r=>'<tr><td><b>'+esc(r.fabric.name)+'</b><small>'+esc(r.fabric.color||'')+' • Ref. '+esc(r.fabric.color_reference||'—')+' • Q'+esc(r.fabric.quality_code||'—')+'</small></td><td>'+(reconciliationPending||unlinked.length?(r.needed?br(r.needed,3)+' m (parcial)':'Não apurado'):br(r.needed,3)+' m')+'</td><td>'+br(r.recorded,3)+' m</td><td>'+(r.free===null?'A conciliar':br(r.free,3)+' m')+'</td><td>'+br(r.reserved,3)+' m</td><td>'+br(r.incoming,3)+' m</td><td><b>'+(r.buy===null?'Não apurado':br(r.buy,3)+' m')+'</b></td></tr>').join('');
 const warning=unlinked.length?'<div class="fw-error"><b>Cálculo parcial: '+unlinked.length+' peça(s) ainda não puderam ser convertidas em metros.</b> Confira as pendências abaixo. Esses itens não são considerados como necessidade zero.</div>':'';
 const pending=unlinked.length?'<div class="fw-panel"><h3>Pendências para calcular o tecido</h3><p>Estas quantidades são de peças, não de tecido. Falta resolver o vínculo para calcular os metros necessários.</p><button type="button" data-fw-tab="recipes">Abrir fichas técnicas</button><div class="fw-table-scroll"><table><thead><tr><th>Peça</th><th>Quantidade a pedir</th><th>Consumo vinculado</th><th>Metros previstos sem tecido definido</th><th>Conferência pendente</th><th>Ação</th></tr></thead><tbody>'+unlinked.map(({row,reason,link,quantity})=>'<tr><td>'+esc(row.produtoNome)+'<small>'+esc(row.produtoId||'')+'</small></td><td>'+br(quantity??row.pedidoReal,0)+' pç</td><td>'+(link?br(link.consumption,3)+' m/peça':'Sem fonte correspondente')+'</td><td>'+(link?br((quantity??n(row.pedidoReal))*link.consumption,3)+' m':'Não calculado')+'</td><td>'+esc(reason)+'</td><td>'+(link?'<button type="button" data-fw-link-recipe="'+esc(link.product_reference)+'">Conferir vínculo</button>':'')+'</td></tr>').join('')+'</tbody></table></div></div>':'';
 const reconciliation=reconciliationPending?'<div class="fw-error"><b>Saldo livre não confirmado.</b> Existem '+trackingPending.length+' linhas de programação/facção importadas sem apropriação de tecido por lote. O saldo registrado abaixo mostra entradas menos saídas registradas; não comprova o tecido ainda disponível. A compra não pode ser concluída com esses vínculos pendentes.</div>':'';
 const trackingPanel=reconciliationPending?'<div class="fw-panel"><h3>Programação e facção a conciliar com o estoque</h3><p>'+br(trackingPending.reduce((a,r)=>a+Math.max(0,n(r.quantity)-n(r.delivered)),0),0)+' peças pendentes. O status de corte informa a etapa, mas não registra sozinho quais lotes de tecido foram consumidos.</p><div class="fw-table-scroll"><table><thead><tr><th>Item / peça</th><th>Cor / tamanho</th><th>Saldo de peças</th><th>Corte</th><th>Consumo previsto</th><th>Tecido / lote</th></tr></thead><tbody>'+trackingPending.map(r=>'<tr><td>'+esc(r.source_item)+' • '+esc(r.product_name)+'</td><td>'+esc(r.color||'—')+' / '+esc(r.size||'—')+'</td><td>'+br(Math.max(0,n(r.quantity)-n(r.delivered)),0)+' pç</td><td>'+esc(r.cut_status)+'</td><td>'+(materialLinkInfo(r.product_reference)?br(materialLinkInfo(r.product_reference).consumption,3)+' m/peça • '+br(Math.max(0,n(r.quantity)-n(r.delivered))*materialLinkInfo(r.product_reference).consumption,3)+' m previstos':'Consumo não vinculado')+'</td><td>Lote e baixa física pendentes</td></tr>').join('')+'</tbody></table></div><button type="button" data-fw-tab="production">Abrir programação e facção</button></div>':'';
 return reconciliation+warning+'<div class="fw-panel"><h3>Necessidade de compra de tecido — metros</h3><p>Consumo das peças a pedir + tecido restante das OS abertas − estoque aprovado − compras confirmadas a receber. Cotações não abatem a necessidade.</p><p><b>Compra de tecido: '+(reconciliationPending?'não apurada — conciliar a facção com o estoque':br(fabrics.reduce((sum,r)=>sum+r.buy,0),3)+' m'+(unlinked.length?' (parcial)':''))+'</b></p><div class="fw-table-scroll"><table><thead><tr><th>Tecido / cor / referência</th><th>Consumo necessário</th><th>Saldo registrado</th><th>Disponível livre confirmado</th><th>Reservas registradas</th><th>Já comprado a receber</th><th>Falta comprar</th></tr></thead><tbody>'+(rows||'<tr><td colspan="7">Cadastre os tecidos para iniciar o cálculo.</td></tr>')+'</tbody></table></div><button type="button" data-fw-tab="purchases">Consultar pedidos de compra</button></div>'+trackingPanel+pending;
}

function incomingView(){return '<div class="fw-panel"><h3>Compras e entregas a caminho</h3><p>Saldo a receber considera somente metros ainda não recebidos. Cotações ficam separadas dos pedidos confirmados.</p>'+state.purchaseOrders.filter(o=>o.status!=='CANCELADA').map(o=>{const lines=state.purchaseItems.filter(i=>i.purchase_order_id===o.id);const pending=lines.reduce((sum,i)=>sum+Math.max(0,n(i.ordered_m)-n(i.received_m)),0);if(!pending)return '';return '<details><summary>Pedido '+esc(o.order_number)+' — '+br(pending,3)+' m a receber — '+esc(o.logistics_stage)+'</summary><form data-fw-form="logistics"><input type="hidden" name="id" value="'+o.id+'"><select name="logistics_stage">'+['COTACAO','CONFIRMADO','EM_TRANSPORTE'].map(x=>'<option '+(x===o.logistics_stage?'selected':'')+'>'+x+'</option>').join('')+'</select><input name="carrier" placeholder="Transportadora" value="'+esc(o.carrier||'')+'"><input name="tracking_code" placeholder="Rastreio" value="'+esc(o.tracking_code||'')+'"><input name="expected_date" type="date" value="'+esc(o.expected_date||'')+'"><button>Salvar acompanhamento</button></form></details>'}).join('')+'</div>'}
function trackingView(){return '<div class="fw-panel"><h3>Histórico migrado da facção</h3><p>Registros distintos preservados por linha de origem. Recebimentos históricos confirmados somente pelo Status Concluído.</p>'+state.tracking.map(r=>'<details class="fw-catalog-edit"><summary>Item '+esc(r.source_item)+' — '+esc(r.product_name)+' / '+esc(r.size)+' — '+br(r.delivered,0)+' de '+br(r.quantity,0)+' entregues — '+esc(r.delivery_status)+' <small>origem: linha '+r.source_row+'</small></summary><form data-fw-form="tracking"><input type="hidden" name="id" value="'+r.id+'"><label>Peça no mapa<select name="product_reference"><option value="">Relacionar automaticamente pela descrição</option>'+ (window.GAO_LINEN_NEED_SNAPSHOT||[]).map(p=>'<option value="'+esc(p.produtoId)+'" '+(r.product_reference===String(p.produtoId)?'selected':'')+'>'+esc(p.produtoId+' • '+p.produtoNome)+'</option>').join('')+'</select></label><label>Corte<select name="cut_status">'+['PENDENTE','CONCLUIDO'].map(x=>'<option '+(r.cut_status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Entrega<select name="delivery_status">'+['PENDENTE','PARCIAL','CONCLUIDO'].map(x=>'<option '+(r.delivery_status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Recebido acumulado<input type="number" name="delivered" min="0" max="'+r.quantity+'" value="'+r.delivered+'"></label><label>Previsão<input type="date" name="expected_date" value="'+esc(r.expected_date||'')+'"></label><label>Recebido GAO<input type="date" name="received_date" value="'+esc(r.received_date||'')+'"></label><button>Salvar no sistema</button></form></details>').join('')+'</div>'}
function productionView(){return '<div class="fw-panel"><h3>Reserva, corte e envio por OS</h3>'+state.items.map(i=>{const order=state.orders.find(o=>o.id===i.order_id);if(order?.status==='CANCELADA')return '';const lots=liveBalances().filter(l=>fabricMatches(l.fabric_id,i.fabric_id)&&l.quality_status==='APROVADO');const options=lots.map(l=>'<option value="'+l.id+'">'+esc(l.lot_code)+' • NF '+esc(l.invoice_number||'—')+' • '+br(l.onhand,3)+' m / reservado '+br(l.reserved,3)+'</option>').join('');return '<details id="os-cut-'+i.id+'" class="fw-catalog-edit"><summary>OS '+esc(order?.order_number)+' • '+esc(i.product_name)+'</summary><form data-fw-form="reserve"><input type="hidden" name="order_item_id" value="'+i.id+'"><select name="lot_id" required>'+options+'</select><input name="quantity_m" type="number" min=".001" step=".001" placeholder="Metros a reservar" required><button>Reservar tecido</button></form><form data-fw-form="release"><input type="hidden" name="order_item_id" value="'+i.id+'"><select name="lot_id" required>'+options+'</select><input name="quantity_m" type="number" min=".001" step=".001" placeholder="Metros para liberar" required><button>Liberar reserva não utilizada</button></form><form data-fw-form="cut"><input type="hidden" name="order_item_id" value="'+i.id+'"><select name="lot_id" required>'+options+'</select><input name="consumed_m" type="number" min=".001" step=".001" placeholder="Metros efetivamente consumidos" required><input name="produced_pieces" type="number" min="1" step="1" placeholder="Peças cortadas" required><button>Concluir lote de corte</button></form>'+state.cuts.filter(c=>c.order_item_id===i.id).map(c=>{const l=state.lots.find(l=>l.id===c.lot_id),loss=Math.max(0,n(c.consumed_m)-n(c.produced_pieces)*n(i.consumption_m_per_piece));return '<div class="fw-panel"><b>Lote de corte '+esc(c.id.slice(0,8))+'</b><p>Tecido '+esc(l?.lot_code)+' • NF '+esc(l?.invoice_number)+' • '+br(c.produced_pieces,0)+' peças • '+br(c.consumed_m,3)+' m • perda '+br(loss,3)+' m ('+br(loss/n(c.consumed_m)*100,2)+'%) • R$ '+br(loss*n(l?.effective_price_per_m))+'</p>'+(c.sent_date?'<p>Enviado '+esc(c.sent_date)+' • previsão '+esc(c.expected_date)+'</p>':'<form data-fw-form="dispatch"><input type="hidden" name="id" value="'+c.id+'"><select name="supplier_id" required>'+supplierOptionList()+'</select><label>Envio<input name="sent_date" type="date" value="'+new Date().toISOString().slice(0,10)+'" required></label><label>Previsão (padrão +21 dias)<input name="expected_date" type="date"></label><input name="notes" placeholder="Justificativa se alterar prazo"><button>Enviar peças à facção</button></form>')+'</div>'}).join('')+'</details>'}).join('')+'</div>'}

function formData(form){return Object.fromEntries(new FormData(form).entries())}
function val(d,k){return d[k]===''||d[k]===undefined?null:n(d[k])}
function ensureCatalogKey(value,ignoreId=''){
 const key=fabricCatalogVariantKey(value);
 const duplicate=state.fabric.find(f=>f.id!==ignoreId&&fabricCatalogVariantKey(f)===key);
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
 const lines=picks.map(p=>{const x=snap.find(i=>String(i.produtoId||i.produtoNome)===p.dataset.fwDemand),r=state.recipes.find(q=>q.active&&q.product_reference===String(x?.produtoId||x?.produtoNome));if(!x||!r)throw Error('Cadastre ficha técnica ativa para todas as peças selecionadas.');if(!x.coverageReady)throw Error('Aguarde a atualização dos pedidos em andamento antes de gerar uma nova OS.');const lots=state.lots.filter(l=>fabricMatches(l.fabric_id,r.fabric_id));const planned=lots.reduce((a,l)=>a+n(l.effective_price_per_m)*n(l.quantity_received_m),0)/(lots.reduce((a,l)=>a+n(l.quantity_received_m),0)||1);return {source_item_key:String(x.produtoId||x.produtoNome),product_reference:String(x.produtoId||''),product_name:String(x.produtoNome||''),requested_pieces:demandRequestedPieces(x),recipe_id:r.id,planned_price_per_m:planned}});
 if(!lines.length)throw Error('Marque pelo menos uma peça com demanda e ficha técnica.');
 const result=await rpc('fabric_create_orders_for_demand',{p_organization_id:state.org,p_demand_as_of:(window.GAO_LINEN_NEED_SNAPSHOT||[])[0]?.asOf||new Date().toISOString().slice(0,10),p_lines:lines,p_idempotency_key:'fabric-demand-'+uid()});demandDrafts.clear();return result;
}
async function submit(form){
 const d=formData(form),table=form.dataset.fwForm;
 if(table==='standard'){const {id,...fields}=d;const material_kind=d.material_kind||'TECIDO';const payload={...fields,material_kind,unit:material_kind==='PRODUTO_ACABADO'?'PC':'M',organization_id:state.org,code:d.code.trim().toUpperCase(),name:d.name.trim(),width_m:val(d,'width_m'),gsm:val(d,'gsm'),updated_at:new Date().toISOString()};return api('/rest/v1/fabric_standards'+(id?'?id=eq.'+encodeURIComponent(id)+'&organization_id=eq.'+state.org:''),{method:id?'PATCH':'POST',body:JSON.stringify(payload)});}
 if(table==='standardReference'){return api('/rest/v1/fabric_catalog?id=eq.'+encodeURIComponent(d.id)+'&organization_id=eq.'+state.org,{method:'PATCH',body:JSON.stringify({standard_id:d.standard_id,supplier_id:d.supplier_id,standard_link_approved:d.standard_link_approved==='on',updated_at:new Date().toISOString(),updated_by:state.session.user.id})});}
 if(table==='purchaseOrder'){
  const lines=[...form.querySelectorAll('[data-fw-po-line]')].map(row=>({fabric_id:row.querySelector('[name=fabric_id]')?.value,ordered_m:row.querySelector('[name=ordered_m]')?.value,purchase_price_per_m:row.querySelector('[name=purchase_price_per_m]')?.value}));
  if(!lines.length)throw Error('Adicione ao menos um tecido ao pedido.');
  for(const line of lines){const f=state.fabric.find(f=>f.id===line.fabric_id);if(!f||!purchaseReferenceChoices(state.fabric,f.standard_id,d.supplier_id).some(x=>x.id===line.fabric_id))throw Error('A referência precisa estar homologada para o padrão GAO e para o fornecedor selecionado.');}

  const open=state.purchaseItems.filter(i=>lines.some(l=>fabricMatches(l.fabric_id,i.fabric_id))&&n(i.ordered_m)>n(i.received_m)&&state.purchaseOrders.some(o=>o.id===i.purchase_order_id&&o.status!=='CANCELADA'));if(open.length&&!confirm('Já há '+open.length+' item(ns) de compra desse tecido com saldo a receber. Consulte pedidos e transporte para evitar duplicidade. Confirma um pedido adicional?'))throw Error('Novo pedido cancelado para conferir compras existentes.');
  return rpc('fabric_create_purchase_order',{p_organization_id:state.org,p_supplier_id:d.supplier_id,p_order_number:d.order_number.trim(),p_ordered_date:d.ordered_date||null,p_expected_date:d.expected_date||null,p_lines:lines.map(x=>({fabric_id:x.fabric_id,ordered_m:n(x.ordered_m),purchase_price_per_m:n(x.purchase_price_per_m)})),p_notes:d.notes||null,p_idempotency_key:'fabric-po-'+uid()});
 }
 if(table==='fabric'){
  const payload={...d,organization_id:state.org,code:d.code.trim(),name:d.name.trim(),color_reference:d.color_reference.trim().toUpperCase(),quality_code:d.quality_code.trim().toUpperCase().replace(/^Q/,''),width_m:val(d,'width_m'),homologated:d.homologated==='on',standard_link_approved:table==='fabric'&&d.homologated==='on',homologated_at:d.homologated==='on'?new Date().toISOString():null,homologated_by:d.homologated==='on'?state.session.user.id:null};
  ensureCatalogKey(payload);return api('/rest/v1/fabric_catalog',{method:'POST',body:JSON.stringify(payload)});
 }
 if(table==='catalogEdit'){
  const payload={...d,standard_link_approved:d.homologated==='on'&&Boolean(state.fabric.find(f=>f.id===d.id)?.standard_link_approved),code:d.code.trim(),name:d.name.trim(),color_reference:d.color_reference.trim().toUpperCase(),quality_code:d.quality_code.trim().toUpperCase().replace(/^Q/,''),width_m:val(d,'width_m'),homologated:d.homologated==='on',homologated_at:d.homologated==='on'?new Date().toISOString():null,homologated_by:d.homologated==='on'?state.session.user.id:null,updated_at:new Date().toISOString(),updated_by:state.session.user.id};
  ensureCatalogKey(payload,d.id);return api('/rest/v1/fabric_catalog?id=eq.'+encodeURIComponent(d.id)+'&organization_id=eq.'+state.org,{method:'PATCH',body:JSON.stringify(payload)});
 }
 if(table==='aliasCreate'||table==='aliasEdit')return saveAliasMapping({...d,homologated:d.homologated==='on',active:table==='aliasCreate'||d.active==='on'},table==='aliasEdit'?d.id:null);
 if(table==='tracking'){const row=state.tracking.find(x=>x.id===d.id);const delivered=d.delivery_status==='CONCLUIDO'?row.quantity:n(d.delivered);if(delivered>row.quantity)throw Error('Entrega excede a quantidade do pedido');await api('/rest/v1/fabric_faction_tracking?id=eq.'+d.id+'&organization_id=eq.'+state.org,{method:'PATCH',body:JSON.stringify({product_reference:d.product_reference?.trim()||null,cut_status:d.cut_status,delivery_status:delivered===row.quantity?'CONCLUIDO':delivered>0?'PARCIAL':'PENDENTE',delivered,expected_date:d.expected_date||null,received_date:d.received_date||null,updated_at:new Date().toISOString()})});window.dispatchEvent(new Event('gao-production-updated'));return;}
 if(table==='cut'){if(!Number.isInteger(n(d.produced_pieces)))throw Error('Informe peças inteiras');return rpc('fabric_record_cut',{p_organization_id:state.org,p_order_item_id:d.order_item_id,p_lot_id:d.lot_id,p_consumed_m:n(d.consumed_m),p_produced_pieces:n(d.produced_pieces),p_key:uid()});}
 if(table==='release')return rpc('fabric_post_stock_movement',{p_organization_id:state.org,p_lot_id:d.lot_id,p_movement_type:'LIBERA_RESERVA',p_quantity_m:n(d.quantity_m),p_order_item_id:d.order_item_id,p_idempotency_key:'release:'+uid(),p_notes:'Liberação de saldo reservado da OS'});
 if(table==='reserve')return rpc('fabric_post_stock_movement',{p_organization_id:state.org,p_lot_id:d.lot_id,p_movement_type:'RESERVA',p_quantity_m:n(d.quantity_m),p_order_item_id:d.order_item_id,p_idempotency_key:'reserve:'+uid(),p_notes:'Reserva de tecido para OS'});
 if(table==='dispatch'){const date=d.sent_date,expected=d.expected_date||addDays(date,21);if(expected!==addDays(date,21)&&!d.notes.trim())throw Error('Justifique a alteração do prazo de 21 dias');return api('/rest/v1/fabric_cut_batches?id=eq.'+d.id+'&organization_id=eq.'+state.org,{method:'PATCH',body:JSON.stringify({sent_date:date,expected_date:expected,supplier_id:d.supplier_id,notes:d.notes||null})});}
 if(table==='logistics')return api('/rest/v1/fabric_purchase_orders?id=eq.'+d.id+'&organization_id=eq.'+state.org,{method:'PATCH',body:JSON.stringify({logistics_stage:d.logistics_stage,carrier:d.carrier,tracking_code:d.tracking_code,expected_date:d.expected_date||null})});
 if(table==='supplier')return api('/rest/v1/fabric_suppliers',{method:'POST',body:JSON.stringify({...d,organization_id:state.org,lead_days:val(d,'lead_days')})});
 if(table==='recipe'){const {manual_extras_per_piece,...recipeData}=d;const existing=state.recipes.find(r=>r.id===form.dataset.recipeId)||state.recipes.find(r=>r.product_reference===d.product_reference&&r.fabric_id===d.fabric_id);return api('/rest/v1/fabric_product_recipes'+(existing?'?id=eq.'+encodeURIComponent(existing.id)+'&organization_id=eq.'+state.org:''),{method:existing?'PATCH':'POST',body:JSON.stringify({...recipeData,cost_reference_id:d.cost_reference_id||null,organization_id:state.org,consumption_m_per_piece:val(d,'consumption_m_per_piece'),faction_cost_per_piece:val(d,'faction_cost_per_piece')||0,label_cost_per_piece:val(d,'label_cost_per_piece')||0,rfid_cost_per_piece:val(d,'rfid_cost_per_piece')||0,extras_cost_per_piece:(val(d,'manual_extras_per_piece')||0)+(val(d,'label_cost_per_piece')||0)+(val(d,'rfid_cost_per_piece')||0)})});}
 if(table==='receipt'){if(d.invoice_item_code||d.invoice_item_description||d.invoice_color_reference||d.invoice_quality_code)await saveAliasMapping({fabric_id:d.fabric_id,supplier_id:d.supplier_id,supplier_item_code:d.invoice_item_code,supplier_item_description:d.invoice_item_description,invoice_color_reference:d.invoice_color_reference,invoice_quality_code:d.invoice_quality_code,source_invoice_number:d.invoice_number,homologated:d.invoice_alias_homologated==='on'},null);return rpc('fabric_record_receipt',{p_organization_id:state.org,p_fabric_id:d.fabric_id,p_supplier_id:d.supplier_id,p_lot_code:d.lot_code,p_invoice_number:d.invoice_number,p_quantity_m:val(d,'quantity_m'),p_purchase_price_per_m:val(d,'purchase_price_per_m'),p_freight_cost:val(d,'freight_cost')||0,p_other_cost:val(d,'other_cost')||0,p_received_date:d.received_date||null,p_idempotency_key:'fabric-receipt-'+d.fabric_id+'-'+d.lot_code.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-')+'-'+String(d.invoice_number||'semnf').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-')});}
}
async function ship(id){
 const item=state.items.find(i=>i.id===id),needed=n(item.ordered_pieces)*n(item.consumption_m_per_piece);
 const prior=state.moves.filter(m=>m.order_item_id===id&&m.movement_type==='ENVIO_FACCAO').reduce((a,m)=>a+n(m.quantity_m),0);
 const balance=liveBalances().filter(l=>fabricMatches(l.fabric_id,item.fabric_id)&&l.quality_status==='APROVADO');
 const lots=balance.filter(l=>l.onhand-l.reserved>0).sort((a,b)=>a.received_date.localeCompare(b.received_date));
 let remaining=Math.max(0,needed-prior);
 const available=lots.reduce((a,l)=>a+l.onhand-l.reserved,0);if(available+0.0005<remaining)throw Error('Saldo aprovado insuficiente. Disponível: '+br(available,3)+' m; faltam enviar '+br(remaining,3)+' m.');
 for(const lot of lots){const qty=Math.min(remaining,lot.onhand-lot.reserved);if(qty<=0)continue;const cumulative=Math.round((prior+needed-remaining+qty)*1000);await rpc('fabric_post_stock_movement',{p_organization_id:state.org,p_lot_id:lot.id,p_movement_type:'ENVIO_FACCAO',p_quantity_m:qty,p_order_item_id:item.id,p_idempotency_key:'fabric-ship-'+item.id+'-'+lot.id+'-'+cumulative,p_notes:'Envio para facção • '+item.product_name});remaining-=qty;if(remaining<=0.0005)break}
 if(remaining>0.0005)throw Error('O saldo mudou durante o envio. Clique em “Completar envio” para continuar com o saldo atualizado.');
}
async function returnForm(id){
 const item=state.items.find(x=>x.id===id);
 const shipments=state.moves.filter(x=>x.order_item_id===id&&x.movement_type==='ENVIO_FACCAO');
 const cuts=state.cuts.filter(c=>c.order_item_id===id);if(cuts.length&&!cuts.some(c=>c.sent_date))throw Error('Registre o envio das peças cortadas à facção antes do recebimento.');
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
 state.mode=enabled;if(enabled)document.querySelectorAll('[data-dimension-view].active').forEach(b=>b.classList.remove('active'));

 const shell=document.querySelector('#gao-linen-risk-shell');
 const host=document.querySelector('#gao-fabric-flow');
 const button=document.querySelector('[data-fw-open]');
 shell?.classList.toggle('fw-mode',enabled);
 if(host)host.hidden=!enabled;
 if(button){button.classList.toggle('active',enabled);button.setAttribute('aria-pressed',String(enabled))}
}
const catalogStyle=document.createElement('style');catalogStyle.textContent='.fw-reference{border-top:1px solid #e1eaf3;margin-top:12px;padding:12px 0}.fw-catalog-edit summary small{display:block;color:#54708e;margin-top:5px}.fw-recipe-dialog select{max-width:100%}'+'.fw-default-cost{flex-basis:100%;font-size:13px;color:#54708e}.fw-default-cost small{display:block;line-height:1.5}.fw-default-cost button{margin-top:8px}'+'.fw-piece-summary{flex-basis:100%;padding:10px 12px;background:#edf5fc;border-radius:8px}.fw-piece-summary b,.fw-piece-summary small{display:block}.fw-piece-summary small{margin-top:4px;color:#54708e}.fw-recipe-sources{flex-basis:100%;border-top:1px solid #e1eaf3;padding:12px 0;margin-top:8px}.fw-recipe-sources summary{cursor:pointer;min-height:40px;display:flex;align-items:center;color:#315675;font-weight:700}.fw-recipe-sources .fw-source-picker{margin:12px 0}.fw-recipe-sources .fw-all-sources{font-size:13px}.fw-recipe-sources .fw-all-sources input{min-width:0;width:auto}.fw-recipe-dialog .fw-field[hidden]{display:none!important}'+'.fw-recipe-dialog{width:min(920px,calc(100vw - 24px));max-height:calc(100dvh - 32px);border:1px solid #b9d1e8;border-radius:16px;padding:0;background:#fff;color:#082d52;overflow:auto;box-shadow:0 24px 80px #082d5240}.fw-recipe-dialog::backdrop{background:#082d5280}.fw-modal-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:16px;position:sticky;top:0;z-index:1;background:#fff}.fw-modal-head h2{font-size:21px;margin:0}.fw-modal-head button{min-width:44px;min-height:44px}.fw-recipe-dialog .fw-panel{border:0;margin:0}.fw-recipe-dialog .fw-field{flex:1 1 220px;min-width:0}.fw-recipe-dialog .fw-field input,.fw-recipe-dialog .fw-field select{min-width:0;width:100%}.fw-recipe-dialog [hidden]{display:none!important}@media(max-width:600px){.fw-recipe-dialog{max-height:calc(100dvh - 16px)}.fw-recipe-dialog .fw-field{flex-basis:100%}}'+'.fw-demand-editor{display:flex;align-items:center;gap:6px;min-height:44px}.fw-demand-editor input{width:100px;min-width:80px;height:40px}.fw-panel button.fw-demand-reset{background:transparent;color:#315675;border:1px solid #b9d1e8;width:40px;height:40px;min-height:40px;padding:0;font-size:22px;line-height:1}.fw-panel button.fw-demand-reset:hover{background:#edf5fb}.fw-panel button.fw-demand-reset[hidden]{display:none!important}'+'.fw-cards.fw-po-summary{grid-template-columns:repeat(5,minmax(0,1fr))}.fw-cards.fw-po-summary article{padding:10px}.fw-field{display:flex;flex-direction:column;align-items:stretch!important;gap:5px}.fw-field input,.fw-field select{width:100%}@media(max-width:1000px){.fw-cards.fw-po-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.fw-field{width:100%}.fw-cards.fw-po-summary{grid-template-columns:1fr}}.fw-po-order summary,.fw-new-order summary{cursor:pointer;padding:12px;border-radius:8px;background:#f3f8fd;min-height:44px}.fw-new-order{margin:12px 0}.fw-new-order form{padding:14px 0}.fw-order-meter{display:block;margin-top:6px;color:#54708e;font-size:13px}.fw-stock-child{margin-left:12px!important;width:calc(100% - 12px)!important}.fw-catalog-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 6px}.fw-catalog-actions button{min-height:40px}.fw-catalog-actions+details{margin-top:0}[data-fw-catalog-row][hidden]{display:none!important}';document.head.appendChild(catalogStyle);
function catalogModelValues(f){return Object.fromEntries(['code','name','fabric_type','composition','width_m'].map(k=>[k,f[k]??'']));}
function fillCatalogModel(id){
 const f=state.fabric.find(x=>x.id===id),form=document.querySelector('[data-fw-form="fabric"]');if(!f||!form)return;
 form.reset();for(const [key,value] of Object.entries(catalogModelValues(f)))form.elements.namedItem(key).value=value;
 form.scrollIntoView({behavior:'smooth',block:'center'});form.elements.namedItem('color').focus();
}
async function catalogAction(action,id){
 const f=state.fabric.find(x=>x.id===id);if(!f)throw Error('Tecido não encontrado. Atualize os dados.');
 if(action==='toggle'){
  if(f.active===false)ensureCatalogKey(f,id);
  return api('/rest/v1/fabric_catalog?id=eq.'+encodeURIComponent(id)+'&organization_id=eq.'+state.org,{method:'PATCH',body:JSON.stringify({active:f.active===false,updated_at:new Date().toISOString(),updated_by:state.session.user.id})});
 }
 if(action==='delete'){
  const linked=[state.lots,state.recipes,state.purchaseItems,state.items,state.aliases].some(rows=>rows.some(r=>r.fabric_id===id));
  if(linked)throw Error('Este tecido tem notas, estoque ou outros vínculos. Use Inativar para preservar o histórico.');
  return api('/rest/v1/fabric_catalog?id=eq.'+encodeURIComponent(id)+'&organization_id=eq.'+state.org,{method:'DELETE'});
 }
}
document.addEventListener('input',e=>{
 if(e.target.name==='purchase_price_per_m')e.target.dataset.auto='false';

 if(e.target.matches('[data-fw-source-search]')){refreshRecipeSources(e.target.closest('form'));return;}

 if(e.target.matches('[data-fw-demand-quantity]')){
  const input=e.target,key=input.dataset.fwDemandQuantity;demandDrafts.set(key,input.value);
  const valid=input.value.trim()!==''&&Number.isSafeInteger(Number(input.value))&&Number(input.value)>=0;
  input.setCustomValidity(valid?'':'Informe uma quantidade inteira, igual ou maior que zero.');
  const row=input.closest('tr'),reset=row.querySelector('[data-fw-demand-reset]');if(reset)reset.hidden=valid&&Number(input.value)===Number(input.dataset.suggestion);
  const cell=row.querySelector('[data-fw-demand-meters]');if(cell)cell.textContent=!valid?'Quantidade inválida':input.dataset.hasRecipe==='true'?br(Number(input.value)*n(input.dataset.consumption),2)+' m':'Não calculado';return;
 }

 for(const [input,row] of [['[data-fw-purchase-search]','[data-fw-purchase-row]'],['[data-fw-lots-search]','[data-fw-lots-row]']])if(e.target.matches(input)){const q=e.target.value.trim().toLocaleLowerCase('pt-BR');document.querySelectorAll(row).forEach(el=>{el.hidden=!el.dataset.search.includes(q)});return;}

 if(!e.target.matches('[data-fw-catalog-search]'))return;
 const q=e.target.value.trim().toLocaleLowerCase('pt-BR');document.querySelectorAll('[data-fw-catalog-row]').forEach(row=>{row.hidden=!row.dataset.search.includes(q)});
});
document.addEventListener('click',async e=>{
 const standardClose=e.target.closest('[data-fw-standard-close]');if(standardClose){const d=standardClose.closest('dialog');if(d.dataset.saving!=='true'){d.close();d.remove();}return;}
 for(const [selector,kind,key] of [['[data-fw-edit-standard]','standard','fwEditStandard'],['[data-fw-map-reference]','reference','fwMapReference'],['[data-fw-standard-origin]','origin','fwStandardOrigin']]){const button=e.target.closest(selector);if(button){openStandardWindow(kind,button.dataset[key]);return;}}

 if(e.target.closest('[data-fw-unit-defaults]')){const form=e.target.closest('form'),cost=state.costReferences.find(c=>c.id===form.elements.namedItem('cost_reference_id').value);if(cost?.source_block==='VARIANTES'&&n(form.elements.namedItem('label_cost_per_piece').value)===0&&n(form.elements.namedItem('rfid_cost_per_piece').value)===0&&n(form.elements.namedItem('manual_extras_per_piece').value)===n(cost.extras_cost_per_piece)){form.elements.namedItem('manual_extras_per_piece').value=0;const note=form.querySelector('[data-fw-default-cost-note]');if(note)note.textContent='RFID e etiqueta padrão aplicados. O insumo agrupado da planilha não foi somado novamente.';}form.elements.namedItem('label_cost_per_piece').value=RECIPE_UNIT_DEFAULTS.label;form.elements.namedItem('rfid_cost_per_piece').value=RECIPE_UNIT_DEFAULTS.rfid;return;}

 const applyCost=e.target.closest('[data-fw-apply-cost]');if(applyCost){const cost=state.costReferences.find(c=>c.id===applyCost.dataset.fwApplyCost);if(cost)applyRecipeCost(applyCost.closest('form'),cost);return;}

 if(e.target.closest('[data-fw-modal-close]')){closeRecipeDialog();return;}
 const editRecipe=e.target.closest('[data-fw-edit-recipe]');if(editRecipe){openRecipeDialog(null,editRecipe.dataset.fwEditRecipe,editRecipe);return;}
 const linkButton=e.target.closest('[data-fw-link-recipe]');if(linkButton){openRecipeDialog(linkButton.dataset.fwLinkRecipe,null,linkButton);return;}

 const resetDemand=e.target.closest('[data-fw-demand-reset]');if(resetDemand){const row=resetDemand.closest('tr'),input=row.querySelector('[data-fw-demand-quantity]');input.value=input.dataset.suggestion;demandDrafts.delete(resetDemand.dataset.fwDemandReset);row.querySelector('[data-fw-demand-meters]').textContent=input.dataset.hasRecipe==='true'?br(Number(input.value)*n(input.dataset.consumption),2)+' m':'Não calculado';input.setCustomValidity('');resetDemand.hidden=true;input.focus();return;}

 const catalog=e.target.closest('[data-fw-catalog-action]');if(catalog){
  const {fwCatalogAction:action,id}=catalog.dataset;
  if(action==='edit'){const row=catalog.closest('[data-fw-catalog-row]'),details=row.querySelector('details');details.open=true;details.querySelector('[name=name]').focus();return;}
  if(action==='copy'){fillCatalogModel(id);return;}
  if(action==='delete'&&!window.confirm('Excluir este cadastro sem vínculos? Esta ação não poderá ser desfeita.'))return;
  await run(()=>catalogAction(action,id));return;
 }

 const lotQuality=e.target.closest('[data-fw-open-lot-quality]');if(lotQuality){const lot=state.lots.find(l=>l.id===lotQuality.dataset.fwOpenLotQuality);if(lot){state.qualityLot=lot.id;state.qualityInvoice=String(lot.invoice_number||'').trim()||'Sem NF • '+(lot.lot_code||lot.id);state.tab='quality';setFlowMode(true);render();}return;}
 if(e.target.closest('[data-fw-quality-all]')){state.qualityLot=null;render();return;}
 const tab=e.target.closest('[data-fw-tab]');if(tab){state.qualityLot=null;state.tab=tab.dataset.fwTab;setFlowMode(true);render();return}
 const xmlLine=e.target.closest('[data-fw-invoice-line]');if(xmlLine){const r=state.invoiceLines?.[Number(xmlLine.dataset.fwInvoiceLine)],form=document.querySelector('[data-fw-form=receipt]');if(r&&form)for(const [key,value] of Object.entries(r)){const input=form.elements.namedItem(key);if(input)input.value=value??'';}return;}
 const invoiceTab=e.target.closest('[data-fw-quality-invoice]');if(invoiceTab){state.qualityInvoice=invoiceTab.dataset.fwQualityInvoice;render();return}
 if(e.target.closest('[data-fw-open]')){setFlowMode(true);render();return}
 const dimension=e.target.closest('[data-dimension-view]');if(dimension){setFlowMode(false);document.querySelectorAll('.gao-textile-subnav .active').forEach(b=>b.classList.remove('active'));dimension.classList.add('active')}
 if(e.target.closest('[data-fw-refresh]')){await run(()=>reload());return}
 if(e.target.closest('[data-fw-create-order]')){await run(createOrder);return}
 if(e.target.closest('[data-fw-add-po-line]')){document.querySelector('[data-fw-po-lines]')?.insertAdjacentHTML('beforeend',poLineHtml());const form=document.querySelector('[data-fw-form="purchaseOrder"]');if(form)refreshPurchaseReferences(form);return}
 const removePoLine=e.target.closest('[data-fw-remove-po-line]');if(removePoLine){if(document.querySelectorAll('[data-fw-po-line]').length>1)removePoLine.closest('[data-fw-po-line]').remove();return}
 const receivePo=e.target.closest('[data-fw-receive-po-item]');if(receivePo){await run(()=>receivePurchaseItem(receivePo.dataset.fwReceivePoItem));return}
 const report=e.target.closest('[data-fw-report]');if(report){await run(()=>openQualityReport(report.dataset.fwReport));return}
 const shipBtn=e.target.closest('[data-fw-ship]');if(shipBtn){await run(()=>ship(shipBtn.dataset.fwShip));return}
 const ret=e.target.closest('[data-fw-return]');if(ret){await run(()=>returnForm(ret.dataset.fwReturn));return}
});
document.addEventListener('change',async e=>{
 const receipt=e.target.closest('[data-fw-form="receipt"]');if(receipt&&e.target.name==='fabric_id'){const ref=state.fabric.find(f=>f.id===e.target.value);if(ref?.supplier_id)receipt.querySelector('[name="supplier_id"]').value=ref.supplier_id;}else if(receipt&&e.target.name==='supplier_id'){const select=receipt.querySelector('[name="fabric_id"]');select.innerHTML='<option value="">Referência comercial da NF</option>'+receiptReferenceOptions(e.target.value,select.value);}
 const purchase=e.target.closest('[data-fw-form="purchaseOrder"]');if(purchase&&(e.target.name==='supplier_id'||e.target.matches('[data-fw-purchase-standard]')||e.target.name==='fabric_id')){refreshPurchaseReferences(purchase);return;}

 if(e.target.matches('[data-fw-source-all]')){refreshRecipeSources(e.target.closest('form'));return;}

 if(e.target.matches('[data-fw-material-link]')){fillMaterialLink(e.target.value);return;}

 if(e.target.matches('[data-fw-catalog-model]')){fillCatalogModel(e.target.value);return;}
 const catalogForm=e.target.closest('[data-fw-form="fabric"]');if(catalogForm&&e.target.name==='code'){
  const candidates=state.fabric.filter(f=>f.active!==false&&f.code.trim().toUpperCase()===e.target.value.trim().toUpperCase());
  for(const key of ['name','fabric_type','composition','width_m']){const values=[...new Set(candidates.map(f=>String(f[key]??'')))];const input=catalogForm.elements.namedItem(key);if(!input.value&&values.length===1)input.value=values[0];}
 }
 if(e.target.matches('[data-fw-invoice-xml]')){try{await readInvoiceXML(e.target.files?.[0])}catch(err){state.error=err.message;render()}return;}

 const form=e.target.closest('form[data-fw-form="recipe"]');if(!form)return;
 const costPicker=e.target.closest('[data-fw-cost-source]');
 if(costPicker){
  const row=state.costReferences.find(r=>r.id===costPicker.value);if(!row)return;
  if(!form.querySelector('[name=consumption_m_per_piece]').value)form.querySelector('[name=consumption_m_per_piece]').value=row.consumption_m_per_piece??'';
  applyRecipeCost(form,row);
  if(!form.querySelector('[name=product_name]').value)form.querySelector('[name=product_name]').value=row.product_name||'';
  if(!form.querySelector('[name=product_reference]').value){
   const match=(window.GAO_LINEN_NEED_SNAPSHOT||[]).find(x=>String(x.produtoNome||'').trim().toLocaleUpperCase('pt-BR')===String(row.product_name||'').trim().toLocaleUpperCase('pt-BR'));
   if(match?.produtoId)form.querySelector('[name=product_reference]').value=String(match.produtoId);
  }
  form.querySelector('[data-fw-cost-note]').textContent='Controle de Tecido • Custo de Produção • '+fabricCostReferenceLabel(row)+' • consumo '+br(row.consumption_m_per_piece,3)+' m/peça • tecido R$ '+br(row.fabric_cost_per_piece)+' ('+br(row.fabric_price_per_m,2)+' R$/m) • facção R$ '+br(row.faction_cost_per_piece)+' • etiqueta R$ '+br(row.label_cost_per_piece)+' • RFID R$ '+br(row.rfid_cost_per_piece)+' • demais insumos R$ '+br(row.extras_cost_per_piece)+' • total R$ '+br(row.total_cost_per_piece)+'/peça.';
  }
  const consumptionPicker=e.target.closest('[data-fw-consumption-source]');
  if(consumptionPicker&&consumptionPicker.value){
   const row=latestFabricConsumptionByVariant(state.consumptionReferences).find(r=>r.variant_key===consumptionPicker.value);if(!row)return;
   form.querySelector('[name=consumption_m_per_piece]').value=Number(row.consumption_m_per_piece).toFixed(4).replace(/0+$/,'').replace(/\.$/,'');
   if(!form.querySelector('[name=product_name]').value)form.querySelector('[name=product_name]').value=row.product_name||'';
   const match=(window.GAO_LINEN_NEED_SNAPSHOT||[]).find(x=>String(x.produtoNome||'').trim().toLocaleUpperCase('pt-BR')===String(row.product_name||'').trim().toLocaleUpperCase('pt-BR'));
   if(!form.querySelector('[name=product_reference]').value&&(match?.produtoId||row.product_code))form.querySelector('[name=product_reference]').value=String(match?.produtoId||row.product_code);
   const history=row.source_history||[];
   form.querySelector('[data-fw-consumption-note]').textContent='Controle de Tecido • Pedido Produção • linha '+row.source_row+' • '+(row.source_date||'data sem registro')+' • tamanho '+(row.size||'não informado')+' • '+(row.fabric_description||'tecido não informado')+' • cor '+(row.color_description||'não informada')+(history.length>1?' • histórico: '+history.map(x=>br(x.consumption_m_per_piece,4)+' m em '+(x.source_date||'sem data')).join(' → '):'');
  }
});
document.addEventListener('submit',async e=>{const form=e.target.closest('[data-fw-form]');if(!form)return;e.preventDefault();const standardDialog=form.closest('[data-fw-standard-dialog]');if(standardDialog){if(standardDialog.dataset.saving==='true')return;standardDialog.dataset.saving='true';const buttons=[...standardDialog.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{await submit(form);await reload();render();standardDialog.close();standardDialog.remove();}catch(err){const box=standardDialog.querySelector('[data-fw-standard-error]');box.textContent=err.message||String(err);box.hidden=false;}finally{standardDialog.dataset.saving='false';buttons.forEach(b=>b.disabled=false);}return;}if(form.closest('[data-fw-recipe-dialog]')){await saveRecipeDialog(form);return;}await run(async()=>{if(form.dataset.fwForm==='qualityBatch')await saveQualityBatch(form);else await submit(form);form.reset();await reload()})});
async function syncOrderStatuses(){for(const o of state.orders.filter(x=>['ABERTA','PARCIAL','ENVIADA'].includes(x.status))){const items=state.items.filter(i=>i.order_id===o.id);if(!items.length)continue;const done=items.every(i=>orderStats(i).accepted+orderStats(i).rejected>=n(i.ordered_pieces));const any=items.some(i=>orderStats(i).accepted+orderStats(i).rejected>0);const sent=items.some(i=>orderStats(i).issued>0);const status=done?'CONCLUIDA':any?'PARCIAL':sent?'ENVIADA':'ABERTA';if(status!==o.status)await api('/rest/v1/fabric_production_orders?id=eq.'+o.id,{method:'PATCH',body:JSON.stringify({status,updated_at:new Date().toISOString()})})}}
async function run(fn){if(state.busy)return;state.busy=true;state.error='';render();try{await fn();await reload();await syncOrderStatuses();await reload()}catch(err){state.error=err.message||String(err)}finally{state.busy=false;render();window.dispatchEvent(new Event('gao-production-updated'))}}
function mount(){
 const path=location.pathname.replace(/\/+$/,'');const route=path==='/enxoval-tecidos'||location.hash==='#enxoval'||location.hash==='#enxoval-tecidos';if(!route){document.querySelector('#gao-fabric-flow')?.remove();return}
 const shell=document.querySelector('#gao-linen-risk-shell');if(!shell)return;if(shell.classList.contains('fw-mode')!==state.mode)shell.classList.toggle('fw-mode',state.mode);
 const nav=document.querySelector('.gao-textile-subnav');
 if(!nav)return;

 nav.querySelectorAll('[data-fw-tab]').forEach(b=>{const active=state.mode&&b.dataset.fwTab===state.tab;if(b.classList.contains('active')!==active)b.classList.toggle('active',active)});
 const flowButton=nav.querySelector('[data-fw-open]');flowButton?.classList.toggle('active',state.mode);flowButton?.setAttribute('aria-pressed',String(state.mode));
 if(!shell.querySelector('#gao-fabric-flow')){const host=document.createElement('div');host.id='gao-fabric-flow';host.hidden=!state.mode;shell.appendChild(host);render();if(!state.org){init().then(render).catch(err=>{state.error=err.message;render()})}}
}
new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
setInterval(mount,900);
})();
