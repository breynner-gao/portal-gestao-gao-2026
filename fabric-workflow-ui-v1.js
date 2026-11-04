(() => {
'use strict';
const SB='https://fquzuxdqvhecijjuxbmg.supabase.co';
const KEY='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>{const x=Number(String(v??'').trim().replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'));return Number.isFinite(x)?x:0};
const br=(v,d=2)=>n(v).toLocaleString('pt-BR',{maximumFractionDigits:d});
const uid=()=>crypto.randomUUID();
const state={org:null,session:null,tab:'demand',fabric:[],suppliers:[],recipes:[],lots:[],orders:[],items:[],moves:[],returns:[],busy:false,error:'',snapshot:[],mode:false};
const style=document.createElement('style');style.textContent='.fw-shell{margin:14px 0;color:#082d52}.fw-head,.fw-panel{background:#fff;border:1px solid #d5e2ef;border-radius:12px;padding:16px;margin:10px 0}.fw-head{display:flex;justify-content:space-between;align-items:center;background:#eef7ff}.fw-head small{font-weight:900;letter-spacing:.12em;color:#0879c9}.fw-head h2{margin:5px 0}.fw-head p,.fw-panel p{color:#54708e;margin:6px 0 12px}.fw-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.fw-tabs button,.fw-panel button{border:0;border-radius:8px;background:#3188cc;color:white;padding:9px 12px;font-weight:800}.fw-tabs button{background:#fff;color:#174a78;border:1px solid #b9d1e8}.fw-tabs button.active{background:#3188cc;color:white}.fw-panel h3{margin:0 0 10px}.fw-panel table{width:100%;border-collapse:collapse;min-width:780px;font-size:13px}.fw-panel th,.fw-panel td{text-align:left;padding:9px;border-bottom:1px solid #e7eef5;vertical-align:top}.fw-panel th{background:#f3f8fd;color:#54708e}.fw-panel td small{display:block;color:#7890a8;margin-top:4px}.fw-panel form{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.fw-panel input,.fw-panel select{padding:9px;border:1px solid #b9d1e8;border-radius:8px;min-width:150px}.fw-panel form button{min-height:38px}.fw-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.fw-cards article{background:#fff;border:1px solid #d5e2ef;border-radius:10px;padding:14px}.fw-cards small,.fw-cards b{display:block}.fw-cards small{color:#54708e}.fw-cards b{font-size:22px;margin-top:7px}.fw-error{background:#fff0f0;border:1px solid #f4bcbc;color:#9b1c1c;padding:10px;border-radius:8px}.fw-note{padding:10px;color:#54708e}.fw-table-scroll{overflow:auto}#gao-linen-risk-shell.fw-mode>.lr150-shell>:not(.lr150-top):not(.lr150-dimension-nav){display:none!important}#gao-linen-risk-shell.fw-mode>#gao-fabric-flow{display:block!important}@media(max-width:760px){.fw-cards{grid-template-columns:1fr}.fw-panel form input,.fw-panel form select{width:100%}.fw-head{align-items:start;gap:8px;flex-direction:column}}';document.head.appendChild(style);
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
 const tables=['fabric_catalog','fabric_suppliers','fabric_product_recipes','fabric_lots','fabric_production_orders','fabric_production_order_items','fabric_stock_movements','fabric_faction_returns'];
 const [fabric,suppliers,recipes,lots,orders,items,moves,returns]=await Promise.all(tables.map(t=>api('/rest/v1/'+t+'?select=*&organization_id=eq.'+state.org+'&order=created_at.desc')));
 Object.assign(state,{fabric,suppliers,recipes,lots,orders,items,moves,returns});
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
 const theoretical=(accepted+rejected)*n(item.consumption_m_per_piece),loss=Math.max(0,issued-returned-theoretical);
 const totalCost=Math.max(0,fabricCost-returned*(issued?fabricCost/issued:0))+faction+extras;
 return {issued,accepted,rejected,returned,faction,extras,theoretical,loss,lossCost:loss*(issued?fabricCost/issued:0),unit:accepted?totalCost/accepted:null,remaining:Math.max(0,n(item.ordered_pieces)-accepted-rejected)};
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
function ordersTable(){const rows=state.items.map(i=>{const o=state.orders.find(x=>x.id===i.order_id),r=state.recipes.find(x=>x.id===i.recipe_id),s=orderStats(i);return '<tr><td>#'+esc(o?.order_number||'—')+' • '+esc(i.product_name)+'</td><td>'+br(i.ordered_pieces,0)+' pç</td><td>'+br(i.ordered_pieces*n(i.consumption_m_per_piece),2)+' m</td><td>'+br(s.issued,2)+' m enviados</td><td>'+br(s.accepted,0)+' aceitas / '+br(s.rejected,0)+' rejeitadas</td><td>'+(!s.issued&&r?'<button type="button" data-fw-ship="'+i.id+'">Enviar tecido</button>':'')+' <button type="button" data-fw-return="'+i.id+'">Lançar retorno</button></td></tr>'}).join('');return '<div class="fw-table-scroll"><table><thead><tr><th>Ordem / item</th><th>Peças</th><th>Tecido previsto</th><th>Envio</th><th>Retorno</th><th>Ação</th></tr></thead><tbody>'+ (rows||'<tr><td colspan="6">Nenhuma ordem gravada.</td></tr>')+'</tbody></table></div>'}
function stockView(){
 const bal=liveBalances();
 const stock=state.fabric.map(f=>{const ls=bal.filter(b=>b.fabric_id===f.id);const qty=ls.reduce((a,l)=>a+l.onhand,0),res=ls.reduce((a,l)=>a+l.reserved,0);return '<tr><td><b>'+esc(f.code)+' • '+esc(f.name)+'</b><small>'+esc(f.fabric_type||'')+' '+esc(f.composition||'')+'</small></td><td>'+br(qty,2)+' m</td><td>'+br(res,2)+' m</td><td>R$ '+br(ls.reduce((a,l)=>a+n(l.effective_price_per_m)*l.onhand,0),2)+'</td></tr>'}).join('');
 return '<div class="fw-panel"><h3>Cadastro de tecido</h3><form data-fw-form="fabric"><input name="code" placeholder="Código" required><input name="name" placeholder="Nome do tecido" required><input name="fabric_type" placeholder="Tipo"><input name="composition" placeholder="Composição"><input name="width_m" type="number" step=".001" placeholder="Largura (m)"><button>Cadastrar tecido</button></form></div><div class="fw-panel"><h3>Fornecedor</h3><form data-fw-form="supplier"><input name="legal_name" placeholder="Razão social" required><input name="trade_name" placeholder="Nome fantasia"><input name="cnpj" placeholder="CNPJ"><input name="lead_days" type="number" placeholder="Prazo (dias)"><button>Cadastrar fornecedor</button></form></div><div class="fw-panel"><h3>Registrar compra recebida / lote</h3><p>A gravação cria lote e entrada de estoque numa única operação. Registre apenas material fisicamente recebido.</p><form data-fw-form="receipt"><select name="fabric_id" required><option value="">Tecido</option>'+state.fabric.map(f=>'<option value="'+f.id+'">'+esc(f.code+' • '+f.name)+'</option>').join('')+'</select><select name="supplier_id"><option value="">Fornecedor (opcional)</option>'+state.suppliers.map(s=>'<option value="'+s.id+'">'+esc(s.trade_name||s.legal_name)+'</option>').join('')+'</select><input name="lot_code" placeholder="Lote" required><input name="invoice_number" placeholder="NF"><input name="quantity_m" type="number" min=".001" step=".001" placeholder="Quantidade (m)" required><input name="purchase_price_per_m" type="number" min="0" step=".0001" placeholder="R$/m" required><input name="freight_cost" type="number" min="0" step=".01" placeholder="Frete R$"><input name="other_cost" type="number" min="0" step=".01" placeholder="Outros custos R$"><input name="received_date" type="date"><button>Registrar recebimento</button></form></div><div class="fw-panel"><h3>Saldo e valor por tecido</h3><table><thead><tr><th>Tecido</th><th>Em estoque</th><th>Reservado</th><th>Valor em estoque</th></tr></thead><tbody>'+ (stock||'<tr><td colspan="4">Cadastre os tecidos para iniciar.</td></tr>')+'</tbody></table></div>';
}
function recipeView(){return '<div class="fw-panel"><h3>Ficha técnica por peça</h3><p>Cadastre quantos metros entram no custo previsto, o custo previsto da facção e dos aviamentos por unidade.</p><form data-fw-form="recipe"><select name="fabric_id" required><option value="">Tecido padrão</option>'+state.fabric.map(f=>'<option value="'+f.id+'">'+esc(f.code+' • '+f.name)+'</option>').join('')+'</select><input name="product_reference" placeholder="Código da peça" required><input name="product_name" placeholder="Nome igual à demanda RFID" required><input name="consumption_m_per_piece" type="number" min=".0001" step=".0001" placeholder="Consumo (m/peça)" required><input name="faction_cost_per_piece" type="number" min="0" step=".01" placeholder="Facção prevista R$/peça"><input name="extras_cost_per_piece" type="number" min="0" step=".01" placeholder="Aviamentos R$/peça"><button>Salvar ficha técnica</button></form><table><thead><tr><th>Peça</th><th>Tecido</th><th>Consumo</th><th>Facção prevista</th><th>Extras previstos</th></tr></thead><tbody>'+state.recipes.map(r=>'<tr><td>'+esc(r.product_reference)+' • '+esc(r.product_name)+'</td><td>'+esc(state.fabric.find(f=>f.id===r.fabric_id)?.name||'—')+'</td><td>'+br(r.consumption_m_per_piece,4)+' m</td><td>R$ '+br(r.faction_cost_per_piece)+'</td><td>R$ '+br(r.extras_cost_per_piece)+'</td></tr>').join('')+'</tbody></table></div>'}
function costView(){return '<div class="fw-panel"><h3>Custo real e perda por ordem</h3><p>Custo de tecido consumido, facção e extras dividido pelas peças aceitas. Perda em metros = tecido enviado − sobra retornada − consumo teórico das peças produzidas.</p><table><thead><tr><th>Peça / ordem</th><th>Peças aceitas</th><th>Custo previsto/peça</th><th>Custo real/peça</th><th>Perda de tecido</th><th>Custo da perda</th></tr></thead><tbody>'+state.items.map(i=>{const s=orderStats(i),f=state.fabric.find(x=>x.id===i.fabric_id),lot=state.lots.filter(l=>l.fabric_id===i.fabric_id),price=lot.length?lot.reduce((a,l)=>a+n(l.effective_price_per_m),0)/lot.length:n(i.planned_price_per_m);const planned=n(i.consumption_m_per_piece)*price+n(i.faction_cost_per_piece)+n(i.extras_cost_per_piece);const o=state.orders.find(x=>x.id===i.order_id);return '<tr><td>#'+esc(o?.order_number)+' • '+esc(i.product_name)+'</td><td>'+br(s.accepted,0)+'</td><td>R$ '+br(planned)+'</td><td>'+(s.unit===null?'Aguardando retorno':'R$ '+br(s.unit))+'</td><td>'+br(s.loss,3)+' m</td><td>R$ '+br(s.lossCost)+'</td></tr>'}).join('')||'<tr><td colspan="6">Os custos aparecerão após registrar uma ordem e o retorno da facção.</td></tr>')+'</tbody></table></div>'}
function formData(form){return Object.fromEntries(new FormData(form).entries())}
function val(d,k){return d[k]===''||d[k]===undefined?null:n(d[k])}
async function createOrder(){
 const picks=[...document.querySelectorAll('[data-fw-demand]:checked')],snap=window.GAO_LINEN_NEED_SNAPSHOT||[];
 const lines=picks.map(p=>{const x=snap.find(i=>String(i.produtoId||i.produtoNome)===p.dataset.fwDemand),r=state.recipes.find(q=>q.active&&q.product_reference===String(x?.produtoId||x?.produtoNome));if(!x||!r)throw Error('Cadastre ficha técnica ativa para todas as peças selecionadas.');const lots=state.lots.filter(l=>l.fabric_id===r.fabric_id);const planned=lots.reduce((a,l)=>a+n(l.effective_price_per_m)*n(l.quantity_received_m),0)/(lots.reduce((a,l)=>a+n(l.quantity_received_m),0)||1);return {source_item_key:String(x.produtoId||x.produtoNome),product_reference:String(x.produtoId||''),product_name:String(x.produtoNome||''),requested_pieces:n(x.pedidoReal),recipe_id:r.id,planned_price_per_m:planned}});
 if(!lines.length)throw Error('Marque pelo menos uma peça com demanda e ficha técnica.');
 return rpc('fabric_create_orders_for_demand',{p_organization_id:state.org,p_demand_as_of:(window.GAO_LINEN_NEED_SNAPSHOT||[])[0]?.asOf||new Date().toISOString().slice(0,10),p_lines:lines,p_idempotency_key:'fabric-demand-'+uid()})
}
async function submit(form){
 const d=formData(form),table=form.dataset.fwForm;
 if(table==='fabric')return api('/rest/v1/fabric_catalog',{method:'POST',body:JSON.stringify({...d,organization_id:state.org,width_m:val(d,'width_m')})});
 if(table==='supplier')return api('/rest/v1/fabric_suppliers',{method:'POST',body:JSON.stringify({...d,organization_id:state.org,lead_days:val(d,'lead_days')})});
 if(table==='recipe')return api('/rest/v1/fabric_product_recipes',{method:'POST',body:JSON.stringify({...d,organization_id:state.org,consumption_m_per_piece:val(d,'consumption_m_per_piece'),faction_cost_per_piece:val(d,'faction_cost_per_piece')||0,extras_cost_per_piece:val(d,'extras_cost_per_piece')||0})});
 if(table==='receipt')return rpc('fabric_record_receipt',{p_organization_id:state.org,p_fabric_id:d.fabric_id,p_supplier_id:d.supplier_id,p_lot_code:d.lot_code,p_invoice_number:d.invoice_number,p_quantity_m:val(d,'quantity_m'),p_purchase_price_per_m:val(d,'purchase_price_per_m'),p_freight_cost:val(d,'freight_cost')||0,p_other_cost:val(d,'other_cost')||0,p_received_date:d.received_date||null,p_idempotency_key:'fabric-receipt-'+uid()});
}
async function ship(id){
 const item=state.items.find(i=>i.id===id),rec=state.recipes.find(r=>r.id===item.recipe_id),needed=n(item.ordered_pieces)*n(item.consumption_m_per_piece);
 const lots=liveBalances().filter(l=>l.fabric_id===item.fabric_id&&l.quality_status==='APROVADO'&&l.onhand-l.reserved>0).sort((a,b)=>a.received_date.localeCompare(b.received_date));
 const available=lots.reduce((a,l)=>a+l.onhand-l.reserved,0);if(available+0.0005<needed)throw Error('Saldo aprovado insuficiente. Disponível: '+br(available,3)+' m; necessário: '+br(needed,3)+' m.');
 let remaining=needed;
 for(const lot of lots){const qty=Math.min(remaining,lot.onhand-lot.reserved);if(qty<=0)continue;await rpc('fabric_post_stock_movement',{p_organization_id:state.org,p_lot_id:lot.id,p_movement_type:'ENVIO_FACCAO',p_quantity_m:qty,p_order_item_id:item.id,p_idempotency_key:'fabric-ship-'+item.id+'-'+lot.id,p_notes:'Envio para facção • '+item.product_name});remaining-=qty;if(remaining<=0.0005)break}
 if(remaining>0.0005)throw Error('Falha ao concluir envio integral; verifique os movimentos antes de tentar novamente.');
}
async function returnForm(id){
 const i=state.items.find(x=>x.id===id),m=state.moves.filter(x=>x.order_item_id===id&&x.movement_type==='ENVIO_FACCAO'),lot=m[0]?.lot_id||null;
 const accepted=prompt('Peças aceitas nesta entrega da facção:', '0');if(accepted===null)return;
 const rejected=prompt('Peças rejeitadas:', '0');if(rejected===null)return;
 const returned=prompt('Metros de tecido que voltaram ao estoque:', '0');if(returned===null)return;
 const faction=prompt('Custo da facção desta entrega (R$):', String(n(accepted)*n(i.faction_cost_per_piece)));if(faction===null)return;
 const extras=prompt('Custo de aviamentos desta entrega (R$):', String(n(accepted)*n(i.extras_cost_per_piece)));if(extras===null)return;
 const notes=prompt('Observação (opcional):','')||'';
 return rpc('fabric_record_faction_return',{p_organization_id:state.org,p_order_item_id:id,p_lot_id:lot,p_accepted_pieces:n(accepted),p_rejected_pieces:n(rejected),p_returned_m:n(returned),p_faction_cost_amount:n(faction),p_extras_cost_amount:n(extras),p_notes:notes,p_idempotency_key:'fabric-return-'+uid()})
}
document.addEventListener('click',async e=>{
 const tab=e.target.closest('[data-fw-tab]');if(tab){state.tab=tab.dataset.fwTab;render();return}
 if(e.target.closest('[data-fw-open]')){state.mode=true;document.querySelector('#gao-linen-risk-shell')?.classList.add('fw-mode');const host=document.querySelector('#gao-fabric-flow');if(host)host.hidden=false;render();return}
 if(e.target.closest('[data-dimension-view]')){state.mode=false;document.querySelector('#gao-linen-risk-shell')?.classList.remove('fw-mode')}
 if(e.target.closest('[data-fw-refresh]')){await run(()=>reload());return}
 if(e.target.closest('[data-fw-create-order]')){await run(createOrder);return}
 const shipBtn=e.target.closest('[data-fw-ship]');if(shipBtn){await run(()=>ship(shipBtn.dataset.fwShip));return}
 const ret=e.target.closest('[data-fw-return]');if(ret){await run(()=>returnForm(ret.dataset.fwReturn));return}
});
document.addEventListener('submit',async e=>{const form=e.target.closest('[data-fw-form]');if(!form)return;e.preventDefault();await run(async()=>{await submit(form);form.reset();await reload()})});
async function run(fn){if(state.busy)return;state.busy=true;state.error='';render();try{await fn();await reload()}catch(err){state.error=err.message||String(err)}finally{state.busy=false;render()}}
function mount(){
 const route=location.pathname.replace(/\/+$/,'')==='/enxoval-tecidos';if(!route){document.querySelector('#gao-fabric-flow')?.remove();return}
 const shell=document.querySelector('#gao-linen-risk-shell');if(!shell)return;
 let nav=shell.querySelector('.lr150-dimension-nav');if(!nav)return;
 if(!nav.querySelector('[data-fw-open]')){const b=document.createElement('button');b.type='button';b.dataset.fwOpen='';b.textContent='Fluxo tecido e facção';b.onclick=()=>{state.mode=true;document.querySelector('#gao-linen-risk-shell')?.classList.add('fw-mode');const host=document.querySelector('#gao-fabric-flow');if(host)host.hidden=false;};nav.appendChild(b)}
 if(!shell.querySelector('#gao-fabric-flow')){const host=document.createElement('div');host.id='gao-fabric-flow';host.hidden=!state.mode;shell.appendChild(host);render();if(!state.org){init().then(render).catch(err=>{state.error=err.message;render()})}}
}
new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
setInterval(mount,900);
})();