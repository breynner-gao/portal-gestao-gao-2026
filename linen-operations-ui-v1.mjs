import {applyIdealReferences, idealReferenceKey, listMovementItems} from './linen-risk-rules-v150.mjs?v=227';
import {directionLabel, filterTransferHistory, localTimestamp, transferWorkbook} from './linen-operations-history-v1.mjs?v=1';

const HOST='gao-linen-operations';
const SB='https://fquzuxdqvhecijjuxbmg.supabase.co';
const API='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const qty=value=>Number(value).toLocaleString('pt-BR');
const views=[
  ['painel','Painel da operação'],['return','Mercado para Depósito'],['supply','Depósito para Mercado'],
  ['pendencias','Pendências'],['recepcao','Recepção e nota fiscal'],['ficha','Ficha técnica'],
  ['quarentena','Quarentena e qualidade'],['rfid','Cadastro RFID e destino'],
  ['chip','Peças sem chip ou com chip morto'],['costura','Costura'],['retorno','Retorno da costura'],
  ['descarte','Descarte'],['cliente','Cliente novo e comanda'],['compras','Compras e portais'],
  ['configuracoes','Configurações e histórico']
];
const integrations={
  recepcao:['A recepção de peças prontas já está disponível no fluxo de compras. O encaminhamento automático para quarentena ainda precisa ser integrado.',[['Abrir Enxoval e Tecidos','/enxoval-tecidos']]],
  ficha:['As fichas de tecido existentes estão em Enxoval e Tecidos. A ficha dimensional versionada por peça ainda precisa ser integrada.',[['Abrir cadastros de Enxoval e Tecidos','/enxoval-tecidos']]],
  quarentena:['Falta integrar a aprovação de qualidade com o bloqueio e a liberação individual das peças novas.'],
  rfid:['Falta conectar o cadastro RFID individual para validar chips, aprovações e destinos.'],
  chip:['Falta integrar a identificação da peça e a fila de recuperação por chip ausente ou inativo.'],
  costura:['A produção da Costura já possui seu painel. O recebimento de ordens de recuperação deste módulo ainda precisa ser integrado.',[['Abrir Produção → Costura','/#qualidade-costura']]],
  retorno:['Falta vincular o retorno da ordem de recuperação à peça e ao novo chip.'],
  descarte:['Falta conectar o descarte à baixa individual de estoque e ao histórico da peça.'],
  cliente:['A fila de solicitações da Rouparia já está disponível. A reserva de peças e a conclusão por comanda deste módulo ainda precisam ser integradas.',[['Abrir solicitações de entrega','/rouparia/solicitacoes/entrega']]],
  compras:['Consulte as necessidades, os pedidos e a programação da facção nos módulos existentes.',[['Enxoval e Tecidos','/enxoval-tecidos'],['Portal da Facção','/enxoval-tecidos/faccao']]],
};
const blocked='Saldo elegível indisponível. A posição RFID informa o saldo bruto, sem detalhar reservas e bloqueios por peça. As transferências físicas ainda dependem dessa integração.';

function mount(host) {
  let page='painel', session, organization, canWrite=false, snapshot, proposals=[], requests=[], events=[];
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
    const nav='<nav class="leo-nav" aria-label="Gestão de Enxoval">'+views.map(([key,label])=>'<button type="button" data-leo-view="'+key+'" aria-pressed="'+(key===page)+'">'+label+'</button>').join('')+'</nav>';
    let rows=[], content='', report;
    if(loading)content='<p role="status">Carregando a posição e os registros do SGQ…</p>';
    else if(!failed){
      const allRows=operationRows();
      if(page==='painel'){
        content='<section class="gao-card"><h2>Posição da operação</h2><dl class="leo-kpis">'+[['Depósito → Mercado',allRows.filter(x=>x.direction==='supply'&&x.remaining).length],['Mercado → Depósito',allRows.filter(x=>x.direction==='return'&&x.remaining).length],['Pendências registradas',allRows.filter(x=>x.id&&x.remaining).length]].map(([label,count])=>'<div><dt>'+label+'</dt><dd>'+qty(count)+'</dd></div>').join('')+'</dl><p>'+blocked+'</p></section>';
      }else if(['supply','return','pendencias'].includes(page)){
        const pending=page==='pendencias';
        rows=allRows.filter(row=>pending?row.remaining>0:row.direction===page);
        const unconfirmed=rows.filter(row=>!row.id&&row.product_code&&row.remaining);
        content='<section class="gao-card"><h2>'+esc(views.find(([key])=>key===page)[1])+'</h2><p>'+blocked+'</p>'+
          (!pending&&canWrite&&unconfirmed.length?'<button type="button" data-leo-list '+(saving?'disabled':'')+'>Salvar lista como pendente</button>':'')+table(rows,pending)+'</section>';
        if(pending){report=history();content+=report.html;}
      }else if(page==='configuracoes'){
        report=history();
        content='<section class="gao-card"><h2>Configurações</h2><p>As metas de troca são lidas do Mapa de peças, trocas e necessidade.</p><a href="/enxoval-tecidos">Abrir Enxoval e Tecidos</a></section>'+report.html;
      }else{
        const [description,links=[]]=integrations[page];
        content='<section class="gao-card"><h2>'+esc(views.find(([key])=>key===page)[1])+'</h2><p>'+esc(description)+'</p>'+links.map(([label,href])=>'<a class="leo-link" href="'+href+'">'+esc(label)+'</a>').join('')+'</section>';
      }
    }
    host.innerHTML='<header class="leo-head"><div><div class="gao-eyebrow">PRODUÇÃO</div><h1>Gestão de Enxoval</h1><p>'+(!loading&&!snapshot?'Posição RFID compartilhada indisponível.':snapshot?'Posição RFID de '+esc(snapshot.informed_at||snapshot.as_of||'data não informada'):'Acompanhamento operacional')+'</p></div><button type="button" data-leo-refresh '+(loading||saving?'disabled':'')+'>Atualizar posição</button></header>'+nav+'<p role="status">'+esc(message)+'</p>'+content;
    host.querySelector('[data-leo-refresh]').onclick=()=>{message='';void load();};
    host.querySelectorAll('[data-leo-view]').forEach(button=>button.onclick=()=>{page=button.dataset.leoView;render();});
    host.querySelectorAll('[data-leo-pending]').forEach(button=>button.onclick=()=>savePending([rows[Number(button.dataset.leoPending)]]));
    host.querySelector('[data-leo-list]')?.addEventListener('click',()=>savePending(rows.filter(row=>!row.id&&row.product_code&&row.remaining)));
    host.querySelectorAll('[data-leo-history]').forEach(button=>button.onclick=()=>{
      filters={product:rows[Number(button.dataset.leoHistory)].product_key,direction:'',start:'',end:'',responsible:''};page='configuracoes';render();
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
style.textContent='#gao-linen-operations{color:#e8f0ff}#gao-linen-operations h1,#gao-linen-operations h2{color:inherit}.leo-head{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap}.leo-nav{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.leo-link,#gao-linen-operations button{display:inline-block;border:1px solid #5f7d9b;border-radius:8px;background:#182c40;color:#e8f0ff;padding:8px 12px;min-height:38px;font:inherit;cursor:pointer;margin:2px}#gao-linen-operations button[aria-pressed=true]{background:#276999;color:white}#gao-linen-operations button:disabled{opacity:.6;cursor:default}.leo-kpis{display:flex;gap:12px;flex-wrap:wrap}.leo-kpis div{padding:12px;border:1px solid #57728c;border-radius:8px;flex:1}.leo-kpis dd{font-size:24px;font-weight:700;margin:4px 0}.leo-scroll{overflow:auto;margin-top:12px}#gao-linen-operations table{border-collapse:collapse;width:100%;min-width:740px}#gao-linen-operations th,#gao-linen-operations td{padding:9px;border-bottom:1px solid #57728c;text-align:left}#gao-linen-operations td small{display:block;margin-top:5px}#gao-linen-operations form{display:flex;gap:8px;flex-wrap:wrap;align-items:end}#gao-linen-operations form label{display:grid;gap:4px}#gao-linen-operations form :is(input,select){padding:7px;font:inherit}';
document.head.append(style);
let currentHost;
function connect(){
  const host=document.getElementById(HOST);
  if(host&&host!==currentHost){currentHost=host;mount(host);}
}
connect();
new MutationObserver(connect).observe(document.getElementById('root'),{childList:true,subtree:true});
