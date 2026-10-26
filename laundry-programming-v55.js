/* V55 — Filtro seguro de Programações por Cliente.
   Regra: cada linha é filtrada pelo ID real da programação -> sector_id -> unit_id -> client_id.
   Nunca usa nome de setor, evitando mistura entre clientes com setores homônimos.
   Seleção em massa fica desabilitada nesta visão para impedir ações em linhas ocultas. */
const SUPABASE_URL='https://fquzuxdqvhecijjuxbmg.supabase.co';
const ANON_KEY='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
const authHeaders=()=>{let token='';try{const raw=localStorage.getItem('sb-fquzuxdqvhecijjuxbmg-auth-token');const obj=raw?JSON.parse(raw):null;token=obj?.access_token||obj?.currentSession?.access_token||''}catch{}return{apikey:ANON_KEY,Authorization:`Bearer ${token||ANON_KEY}`}};
async function rest(table,select='*',order='name.asc'){const q=new URLSearchParams({select});if(order)q.set('order',order);const r=await fetch(`${SUPABASE_URL}/rest/v1/${table}?${q}`,{headers:authHeaders()});if(!r.ok)throw new Error(await r.text());return r.json()}
let selectedClient='';let scheduleClient=new Map();let observer=null;let applying=false;let relationRefreshTimer=null;let saveHooked=false;
function lockBulk(table){
  const head=table?.querySelector('thead th.schedule-check-col'); if(head){head.style.visibility='hidden';head.querySelector('input')?.setAttribute('disabled','disabled')}
  document.querySelectorAll('.schedule-bulk-bar').forEach(x=>x.style.display='none');
}
function applyFilter(){
  if(applying||location.pathname!='/rouparia/contratos')return; applying=true;
  try{
    const wrap=document.querySelector('.laundry-schedule-table'),table=wrap?.querySelector('table'),filters=document.querySelector('.laundry-schedule-filters');if(!table)return;
    const visible=!!selectedClient;wrap.style.display=visible?'':'none';if(filters)filters.style.display=visible?'':'none';lockBulk(table);
    let count=0;
    table.querySelectorAll('tbody tr').forEach(tr=>{
      const sid=tr.dataset.scheduleId||'';const show=visible&&scheduleClient.get(sid)===selectedClient;
      tr.style.display=show?'':'none';
      const cb=tr.querySelector('td.schedule-check-col input');if(cb){cb.disabled=!show;cb.closest('td').style.visibility=show?'':'hidden'}
      if(show)count++;
    });
    const info=document.querySelector('#gao-client-program-count');if(info)info.textContent=visible?`${count} programação(ões) deste cliente`:'Selecione um cliente para visualizar as programações.';
  }finally{applying=false}
}
async function loadRelations(){
  const [clients,units,sectors,schedules]=await Promise.all([
    rest('laundry_clients','id,code,name,active'),rest('laundry_units','id,client_id,name,active'),rest('laundry_sectors','id,unit_id,name,active'),rest('laundry_delivery_schedules','id,sector_id,active','weekday.asc')
  ]);
  const unitClient=new Map(units.map(u=>[u.id,u.client_id]));const sectorClient=new Map(sectors.map(s=>[s.id,unitClient.get(s.unit_id)||'']));
  scheduleClient=new Map(schedules.map(s=>[s.id,sectorClient.get(s.sector_id)||'']));
  return {clients,units,sectors,schedules,sectorClient};
}
async function refreshRelationsAndFilter(){
  try{
    await loadRelations();
    applyFilter();
    const info=document.querySelector('#gao-client-program-count');
    // Atualiza também os contadores dos cartões sem desmontar a seleção atual.
    const host=document.querySelector('#gao-program-client-accordion');
    if(host){
      const {clients,sectors,schedules,sectorClient}=await loadRelations();
      host.querySelectorAll('.gao-program-client-card').forEach(btn=>{
        const cid=btn.dataset.clientId||'';
        const c=clients.find(x=>x.id===cid); if(!c)return;
        const sectorIds=new Set(sectors.filter(x=>sectorClient.get(x.id)===cid&&x.active!==false).map(x=>x.id));
        const programCount=schedules.filter(x=>sectorIds.has(x.sector_id)).length;
        const em=btn.querySelector('em'); if(em)em.textContent=`${sectorIds.size} setor(es) • ${programCount} programação(ões)`;
      });
    }
  }catch(e){console.error('[GAO V55 refresh]',e)}
}
function findButton(text){return [...document.querySelectorAll('button')].find(b=>(b.textContent||'').trim().toLowerCase()===text.toLowerCase())}
function hookAutoRefresh(){
  if(location.pathname!='/rouparia/contratos')return;
  const form=document.querySelector('.laundry-schedule-form');
  if(!form||form.dataset.gaoAutoRefresh==='1')return;
  form.dataset.gaoAutoRefresh='1';
  form.addEventListener('submit',()=>{
    // O salvamento é assíncrono no app principal. Reconsulta em janelas curtas,
    // sem exigir F5 nem clique em "Atualizar lista".
    [700,1500,3000].forEach(ms=>setTimeout(()=>{
      const update=findButton('Atualizar lista');
      if(update&&!update.disabled) update.click();
      clearTimeout(relationRefreshTimer);
      relationRefreshTimer=setTimeout(refreshRelationsAndFilter,250);
    },ms));
  },true);
}
async function mount(){
  if(location.pathname!='/rouparia/contratos'||document.querySelector('#gao-program-client-accordion'))return;
  const h=[...document.querySelectorAll('h2')].find(x=>x.textContent.trim()==='Programações cadastradas');if(!h)return;
  const sectionHeading=h.closest('.section-heading');if(!sectionHeading)return;
  const host=document.createElement('div');host.id='gao-program-client-accordion';host.className='gao-client-programming';
  host.innerHTML=`<div class="gao-client-programming-head"><div><p class="eyebrow">VISUALIZAÇÃO POR CLIENTE</p><h3>Programações por cliente</h3><p id="gao-client-program-count">Selecione um cliente para visualizar as programações.</p></div><button type="button" id="gao-collapse-programs" class="secondary-button compact" style="display:none">Recolher</button></div><div id="gao-program-client-list" class="gao-program-client-list"><span>Carregando clientes...</span></div>`;
  sectionHeading.parentNode.insertBefore(host,sectionHeading);const desc=sectionHeading.querySelector('.section-description');if(desc)desc.style.display='none';
  try{
    const {clients,sectors,schedules,sectorClient}=await loadRelations();const list=host.querySelector('#gao-program-client-list');list.innerHTML='';
    const active=clients.filter(c=>c.active!==false);if(!active.length){list.innerHTML='<span>Nenhum cliente ativo cadastrado.</span>';return}
    active.forEach(c=>{
      const sectorIds=new Set(sectors.filter(s=>sectorClient.get(s.id)===c.id&&s.active!==false).map(s=>s.id));
      const programCount=schedules.filter(s=>sectorIds.has(s.sector_id)).length;
      const btn=document.createElement('button');btn.type='button';btn.className='gao-program-client-card';btn.dataset.clientId=c.id;
      btn.innerHTML=`<span><small>${c.code||''}</small><strong>${c.name||'Cliente'}</strong><em>${sectorIds.size} setor(es) • ${programCount} programação(ões)</em></span><b>⌄</b>`;
      btn.onclick=()=>{const same=selectedClient===c.id;selectedClient=same?'':c.id;list.querySelectorAll('.gao-program-client-card').forEach(x=>x.classList.remove('active'));if(!same)btn.classList.add('active');host.querySelector('#gao-collapse-programs').style.display=same?'none':'';applyFilter()};list.appendChild(btn)
    });
    host.querySelector('#gao-collapse-programs').onclick=()=>{selectedClient='';list.querySelectorAll('.gao-program-client-card').forEach(x=>x.classList.remove('active'));host.querySelector('#gao-collapse-programs').style.display='none';applyFilter()};
    applyFilter();const tbody=document.querySelector('.laundry-schedule-table tbody');if(tbody){observer?.disconnect();observer=new MutationObserver(()=>{clearTimeout(relationRefreshTimer);relationRefreshTimer=setTimeout(refreshRelationsAndFilter,180)});observer.observe(tbody,{childList:true})}
  }catch(e){console.error('[GAO V55]',e);host.querySelector('#gao-program-client-list').innerHTML='<span>Não foi possível carregar os clientes/programações.</span>'}
}
let last='';setInterval(()=>{if(location.pathname!==last){last=location.pathname;selectedClient='';scheduleClient.clear();observer?.disconnect();observer=null}if(location.pathname==='/rouparia/contratos'){mount();hookAutoRefresh()}},500);
