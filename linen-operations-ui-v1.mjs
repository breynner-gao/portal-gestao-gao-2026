import {applyIdealReferences, idealReferenceKey, listMovementItems} from './linen-risk-rules-v150.mjs?v=227';
import {directionLabel, filterTransferHistory, localTimestamp, transferWorkbook} from './linen-operations-history-v1.mjs?v=1';

const HOST='gao-linen-operations';
const SB='https://fquzuxdqvhecijjuxbmg.supabase.co';
const API='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const qty=value=>Number(value).toLocaleString('pt-BR');
const blocked='Saldo elegível indisponível. A posição RFID informa o saldo bruto, sem detalhar reservas e bloqueios por peça. As transferências físicas ainda dependem dessa integração.';

function mount(host) {
  let session, organization, canWrite=false, snapshot, proposals=[], requests=[], events=[];
  let loading=true, saving=false, message='', failed=false;
  let filters={product:'',direction:'',start:'',end:'',responsible:''};

  async function api(path, body) {
    const response=await fetch(SB+path,{
      method:body?'POST':'GET', cache:'no-store',
      headers:{apikey:API,Authorization:'Bearer '+(window.GAO_AUTH_SESSION||session)?.access_token,'Content-Type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{})
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw Error(data?.message||'Não foi possível consultar o SGQ.');
    return data;
  }

  async function all(table, params) {
    const rows=[], limit=500;
    for(let offset=0;;offset+=limit){
      const batch=await api('/rest/v1/'+table+'?'+new URLSearchParams({...params,limit,offset}));
      rows.push(...batch);
      if(batch.length<limit)return rows;
    }
  }

  async function load() {
    loading=true; failed=false; render();
    try{
      session=await window.GAO_AUTH_READY;
      session=window.GAO_AUTH_SESSION||session;
      if(!session?.user?.id)throw Error('Entre no SGQ para consultar Gestão de Enxoval.');
      const memberships=await api('/rest/v1/memberships?select=id,organization_id,role_name,organizations!inner(kind,active)&active=eq.true&profile_id=eq.'+encodeURIComponent(session.user.id));
      const member=memberships.find(m=>m.organizations?.kind==='gao'&&m.organizations.active);
      if(!member)throw Error('Seu usuário não tem vínculo ativo com a GAO.');
      organization=member.organization_id;
      const permissions=new Set((await api('/rest/v1/member_permissions?select=permission_code&allowed=eq.true&membership_id=eq.'+member.id)).map(row=>row.permission_code));
      if(!permissions.has('textiles.inventory.view')&&member.role_name!=='Administrador Geral')throw Error('Seu perfil não tem acesso ao estoque de enxoval.');
      canWrite=member.role_name==='Administrador Geral'||permissions.has('textiles.inventory.manage')||permissions.has('textiles.production.manage');
      const org='eq.'+organization;
      const [snapshots,ideals,saved,history]=await Promise.all([
        api('/rest/v1/linen_rfid_snapshots?select=rows,as_of,informed_at,updated_at&organization_id='+org+'&limit=1'),
        all('linen_ideal_references',{select:'product_key,ideal',organization_id:org,order:'product_key'}),
        all('linen_transfer_requests',{select:'*',organization_id:org,order:'created_at.desc,id.desc'}),
        all('linen_transfer_events',{select:'*,request:linen_transfer_requests!inner(product_code,product_key,product_name,direction,organization_id)', 'request.organization_id':org,order:'occurred_at.desc,id.desc'}),
      ]);
      snapshot=snapshots[0];
      requests=saved;
      events=history;
      const source=applyIdealReferences(snapshot?.rows||[],new Map(ideals.map(row=>[row.product_key,Number(row.ideal)])));
      proposals=listMovementItems(source).map(row=>({
        product_key:idealReferenceKey(row), product_code:row.produtoId, product_name:row.produtoNome,
        direction:row.direcao, planned:row.quantidade, gross:row.direcao==='supply'?row.deposito:row.mercadoAtual
      }));
    }catch(error){failed=true;message=error.message;}
    finally{loading=false;render();}
  }

  function operationRows(){
    const moved=new Map();
    for(const event of events)moved.set(event.request_id,(moved.get(event.request_id)||0)+event.quantity);
    const key=row=>row.direction+'|'+row.product_key;
    const saved=new Map(requests.filter(row=>row.planned>(moved.get(row.id)||0) || Date.parse(row.snapshot_version)===Date.parse(snapshot?.updated_at)).map(row=>[key(row),row]));
    const rows=proposals.map(row=>({...row,...saved.get(key(row))}));
    const shown=new Set(rows.map(row=>row.id));
    rows.push(...requests.filter(row=>!shown.has(row.id)));
    return rows.map(row=>{const done=moved.get(row.id)||0;return {...row,done,remaining:Math.max(0,row.planned-done)};});
  }

  async function savePending(rows){
    if(saving||!canWrite||!snapshot||!rows.length)return;
    saving=true;message='';render();
    try{
      const saved=await api('/rest/v1/rpc/linen_mark_transfer_pending',{
        p_org:organization,p_version:snapshot.updated_at,
        p_keys:rows.map(row=>({productKey:row.product_key,direction:row.direction}))
      });
      const ids=new Set(saved.map(row=>row.id));
      requests=[...saved,...requests.filter(row=>!ids.has(row.id))];
      message='Pendências registradas. Nenhuma baixa de estoque foi lançada.';
    }catch(error){message=error.message;}
    finally{saving=false;render();}
  }

  function table(rows,pending){
    if(!rows.length)return '<p>Nenhum item nesta lista.</p>';
    return '<div class="leo-scroll"><table><thead><tr><th>Produto</th><th>Solicitação e sentido</th><th>Previsto</th><th>Saldo bruto RFID</th><th>Elegível</th><th>Movimentado</th><th>Restante</th><th>Ação</th></tr></thead><tbody>'+
      rows.map((row,i)=>'<tr><td><strong>'+esc(row.product_name)+'</strong><small>'+esc(row.product_code||'')+'</small></td><td>'+directionLabel(row.direction)+'<small>'+esc(row.id||'Sugestão da posição RFID')+'</small></td><td>'+qty(row.planned)+'</td><td>'+(row.gross==null?'—':qty(row.gross))+'</td><td>Indisponível</td><td>'+qty(row.done)+'</td><td>'+qty(row.remaining)+'</td><td>'+
      (row.remaining&&!row.id&&row.product_code&&canWrite?'<button type="button" data-leo-pending="'+i+'" '+(saving?'disabled':'')+'>Não movimentou</button>':row.remaining?'Em aberto':'Concluído')+
      (pending||row.id?'<button type="button" data-leo-history="'+i+'">Ver histórico</button>':'')+'</td></tr>').join('')+'</tbody></table></div>';
  }

  function history() {
    const products=new Map([...requests.map(row=>[row.product_key,row.product_name]),...events.map(e=>[e.request.product_key,e.request.product_name])]);
    const people=new Map(events.map(e=>[e.responsible_id,e.responsible]));
    const options=(items,selected)=>'<option value="">Todos</option>'+[...items].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')).map(([value,label])=>'<option value="'+esc(value)+'" '+(value===selected?'selected':'')+'>'+esc(label)+'</option>').join('');
    let shown=[],error='';
    try{shown=filterTransferHistory(events,filters);}catch(reason){error=reason.message;}
    const selectors='<label>Produto<select name="product">'+options(products,filters.product)+'</select></label><label>Sentido<select name="direction">'+options(new Map([['return',directionLabel('return')],['supply',directionLabel('supply')]]),filters.direction)+'</select></label><label>De<input name="start" type="date" value="'+esc(filters.start)+'"></label><label>Até<input name="end" type="date" value="'+esc(filters.end)+'"></label><label>Responsável<select name="responsible">'+options(people,filters.responsible)+'</select></label>';
    const records=shown.length?'<div class="leo-scroll"><table><thead><tr><th>Data e hora</th><th>Produto</th><th>Sentido</th><th>Quantidade</th><th>Responsável</th><th>Saldo restante</th><th>Referência</th></tr></thead><tbody>'+shown.map(event=>'<tr><td>'+esc(localTimestamp(event.occurred_at))+'</td><td>'+esc(event.request.product_name)+'</td><td>'+directionLabel(event.request.direction)+'</td><td>'+qty(event.quantity)+'</td><td>'+esc(event.responsible)+'</td><td>'+qty(event.remaining)+'</td><td>'+esc(event.id)+'</td></tr>').join('')+'</tbody></table></div>':'<p>'+(error?esc(error):'Nenhum registro de movimentação confirmado neste recorte.')+'</p>';
    return {shown,labels:{product:products.get(filters.product),responsible:people.get(filters.responsible)},html:'<section class="gao-card"><h2>Histórico de movimentações</h2><form data-leo-filters>'+selectors+'<button type="submit">Filtrar</button><button type="button" data-leo-clear>Limpar filtros</button><button type="button" data-leo-export '+(!shown.length?'disabled':'')+'>Exportar Excel</button></form>'+records+'</section>'};
  }

  function render(){
    if(!host.isConnected)return;
    let rows=[], content='', report;
    if(loading)content='<p role="status">Carregando o histórico do SGQ…</p>';
    else if(!failed){
      rows=operationRows().filter(row=>row.remaining>0);
      report=history();
      content='<p>'+blocked+'</p>'+table(rows,true)+report.html;
    }
    host.innerHTML='<p role="status">'+esc(message)+'</p>'+content;
    host.querySelectorAll('[data-leo-pending]').forEach(button=>button.onclick=()=>savePending([rows[Number(button.dataset.leoPending)]]));
    host.querySelectorAll('[data-leo-history]').forEach(button=>button.onclick=()=>{
      filters={product:rows[Number(button.dataset.leoHistory)].product_key,direction:'',start:'',end:'',responsible:''};render();
    });
    host.querySelector('[data-leo-filters]')?.addEventListener('submit',event=>{
      event.preventDefault();filters=Object.fromEntries(new FormData(event.currentTarget));render();
    });
    host.querySelector('[data-leo-clear]')?.addEventListener('click',()=>{filters={product:'',direction:'',start:'',end:'',responsible:''};render();});
    host.querySelector('[data-leo-export]')?.addEventListener('click',()=>{
      try{
        if(!window.XLSX)throw Error('O gerador de Excel ainda não está disponível.');
        const file=transferWorkbook(window.XLSX,report.shown,filters,report.labels);
        window.XLSX.writeFile(file,'historico-movimentacoes-enxoval.xlsx');
      }catch(error){message=error.message;render();}
    });
  }
  void load();
}

const style=document.createElement('style');
style.textContent='#gao-linen-operations{color:#082d52;padding:10px}#gao-linen-operations h1,#gao-linen-operations h2{color:#082d52}#lr150-movement-records{margin-top:14px}#lr150-movement-records>summary{font-weight:700;cursor:pointer;padding:8px}.leo-head{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap}.leo-nav{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.leo-link,#gao-linen-operations button{display:inline-block;border:1px solid #5f7d9b;border-radius:8px;background:#182c40;color:#e8f0ff;padding:8px 12px;min-height:38px;font:inherit;cursor:pointer;margin:2px}#gao-linen-operations button[aria-pressed=true]{background:#276999;color:white}#gao-linen-operations button:disabled{opacity:.6;cursor:default}.leo-kpis{display:flex;gap:12px;flex-wrap:wrap}.leo-kpis div{padding:12px;border:1px solid #57728c;border-radius:8px;flex:1}.leo-kpis dd{font-size:24px;font-weight:700;margin:4px 0}.leo-scroll{overflow:auto;margin-top:12px}#gao-linen-operations table{border-collapse:collapse;width:100%;min-width:740px}#gao-linen-operations th,#gao-linen-operations td{padding:9px;border-bottom:1px solid #57728c;text-align:left}#gao-linen-operations td small{display:block;margin-top:5px}#gao-linen-operations form{display:flex;gap:8px;flex-wrap:wrap;align-items:end}#gao-linen-operations form label{display:grid;gap:4px}#gao-linen-operations form :is(input,select){padding:7px;font:inherit}';
document.head.append(style);
let currentHost;
function connect(){
  const host=document.getElementById(HOST);
  const details=host?.closest('details');
  if (!host || host===currentHost) return;
  currentHost=host;
  if(details?.open)mount(host);
  else details?.addEventListener('toggle',function start(){
    if(!details.open)return;
    details.removeEventListener('toggle',start);
    mount(host);
  });
}
connect();
new MutationObserver(connect).observe(document.getElementById('root'),{childList:true,subtree:true});
