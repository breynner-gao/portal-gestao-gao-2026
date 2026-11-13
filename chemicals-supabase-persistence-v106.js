(()=>{
'use strict';
const SB='https://fquzuxdqvhecijjuxbmg.supabase.co';
const API='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
const LEGACY_RELAVE='gao.chemicals.relave.v118';
const RELAVE='gao.chemicals.relave.v122';
const WASTE='gao.chemicals.waste.v1';
const KEYS=['gao.chemicals.master.v78','gao.chemicals.inventory.v74',RELAVE,WASTE];
const FETCH_KEYS=[...KEYS,LEGACY_RELAVE];
const rawSet=Storage.prototype.setItem, rawGet=Storage.prototype.getItem;
let hydrating=true, queue=Promise.resolve(), bootPromise;
const norm=s=>String(s||'').trim().toUpperCase();
function token(){const active=window.GAO_AUTH_SESSION?.access_token;if(active)return active;for(const k of Object.keys(localStorage)){if(k.startsWith('sb-')&&k.endsWith('-auth-token'))try{const x=JSON.parse(rawGet.call(localStorage,k)||'null');const t=x?.access_token||x?.currentSession?.access_token||x?.session?.access_token;if(t)return t}catch{}}return''}
function headers(extra={}){return {apikey:API,Authorization:`Bearer ${token()||API}`,'Content-Type':'application/json',...extra}}
function parse(v){try{return typeof v==='string'?JSON.parse(v):v}catch{return null}}
function uniq(arr,key){const m=new Map();for(const x of arr||[]){if(!x)continue;const k=key(x);if(!m.has(k))m.set(k,x);else m.set(k,{...m.get(k),...x})}return [...m.values()]}
function mergeMaster(R={},L={}){
 const principles=uniq([...(R.principles||[]),...(L.principles||[])],x=>norm(x.code||x.name));
 const suppliers=uniq([...(R.suppliers||[]),...(L.suppliers||[])],x=>norm(x.doc||x.name));
 const offers=uniq([...(R.offers||[]),...(L.offers||[])],x=>[norm(x.principle),norm(x.supplier),norm(x.commercialName||x.product),Number(x.pack||0)].join('|'));
 return {...R,...L,principles,suppliers,offers,historyMap:{...(R.historyMap||{}),...(L.historyMap||{})}};
}
function invScore(x){return x?.latest?.savedAt?Date.parse(x.latest.savedAt)||0:(x?.latest?1:0)}
function relaveId(x,i=0){return x?.id||['relave',x?.date||'sem-data',x?.command||'sem-comanda',x?.savedAt||i].join('-').replace(/[^\w.-]+/g,'_')}
function relaveState(x={}){
 const entries=(Array.isArray(x.entries)?x.entries:[]).map((r,i)=>({...r,id:relaveId(r,i),savedAt:r.savedAt||r.createdAt||new Date().toISOString()}));
 return {...x,entries,deleted:(Array.isArray(x.deleted)?x.deleted:[]).filter(k=>k&&k!=='l:undefined')};
}
function mergeRelave(...states){
 const normalized=states.map(relaveState);
 const entries=uniq(normalized.flatMap(x=>x?.entries||[]),x=>relaveId(x));
 const overrides=Object.assign({},...normalized.map(x=>x?.overrides||{}));
 const deleted=[...new Set(normalized.flatMap(x=>Array.isArray(x?.deleted)?x.deleted:[]))].filter(k=>k&&k!=='l:undefined');
 return {...Object.assign({},...normalized),entries:entries.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))),overrides,deleted,updatedAt:new Date().toISOString()};
}
function mergeWaste(...states){
 const normalized=states.map(x=>x&&typeof x==='object'?x:{});
 const entries=uniq(normalized.flatMap(x=>Array.isArray(x.entries)?x.entries:[]),x=>x.id||[x.date,x.company,x.invoice,x.savedAt].join('|'));
 const deleted=[...new Set(normalized.flatMap(x=>Array.isArray(x.deleted)?x.deleted:[]))];
 return {...Object.assign({},...normalized),entries,deleted,updatedAt:new Date().toISOString()};
}
function merge(k,R,L){if(k.includes('master'))return mergeMaster(R||{},L||{});if(k.includes('inventory'))return invScore(L)>=invScore(R)?(L||R||{}):(R||L||{});if(k.includes('relave'))return mergeRelave(R,L);if(k===WASTE)return mergeWaste(R,L);return L||R||{}}
async function getRemote(){const r=await fetch(`${SB}/rest/v1/chemical_portal_state?select=state_key,payload,updated_at&state_key=in.(${FETCH_KEYS.map(encodeURIComponent).join(',')})`,{headers:headers()});if(!r.ok)throw Error(await r.text());return r.json()}
async function upsert(k,val){const payload=parse(val);if(!payload)return;const r=await fetch(`${SB}/rest/v1/chemical_portal_state?on_conflict=state_key`,{method:'POST',headers:headers({Prefer:'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify({state_key:k,payload,updated_at:new Date().toISOString()})});if(!r.ok)throw Error(await r.text())}
function backup(k,v,tag){if(!v)return;try{rawSet.call(localStorage,`gao.backup.${k}.${tag}`,v)}catch{}}
function enqueue(k,v){queue=queue.catch(()=>{}).then(()=>upsert(k,v));return queue}
Storage.prototype.setItem=function(k,v){rawSet.call(this,k,v);if(this===localStorage&&KEYS.includes(k)&&!hydrating){backup(k,v,'latest');enqueue(k,v).catch(e=>{console.error('[GAO V106 sync]',e);window.GAO_CHEM_DB_SYNC_ERROR=String(e?.message||e);window.dispatchEvent(new Event('gao-chem-db-sync-error'))})}};
async function boot(){try{
 const session=await window.GAO_AUTH_READY;
 if(!session?.access_token)throw Error('Sessão indisponível.');
 const remote=await getRemote(),map=new Map(remote.map(x=>[x.state_key,x.payload]));
 for(const k of KEYS){
  const localText=rawGet.call(localStorage,k),L=parse(localText)||{},R=map.get(k)||{};backup(k,localText,'pre-hydration');
  let merged;
  if(k===RELAVE){const oldLocal=parse(rawGet.call(localStorage,LEGACY_RELAVE))||{},oldRemote=map.get(LEGACY_RELAVE)||{};merged=mergeRelave(R,L,oldRemote,oldLocal)}
  else merged=merge(k,R,L);
  const txt=JSON.stringify(merged);rawSet.call(localStorage,k,txt);backup(k,txt,'merged');
 }
 window.GAO_CHEM_DB_READY=true;window.GAO_CHEM_DB_SYNC_ERROR='';window.dispatchEvent(new Event('gao-chem-db-ready'));
 if(location.pathname.startsWith('/quimicos/'))setTimeout(()=>window.dispatchEvent(new PopStateEvent('popstate')),80);
 }catch(e){console.error('[GAO V106 persistência]',e);window.GAO_CHEM_DB_READY=false;window.GAO_CHEM_DB_SYNC_ERROR=String(e?.message||e)}finally{hydrating=false}}
window.GAO_RELAVE_ARCHIVE=async()=>{
 if(!token())return {rows:[],excludedRows:[]};
 const prefix='gao.chemicals.relave.archive.';
 const endpoint=`${SB}/rest/v1/chemical_portal_state?select=payload&state_key=like.${prefix}*&order=state_key`;
 const response=await fetch(endpoint,{headers:headers()});
 if(!response.ok)throw Error('Histórico de expedição indisponível.');
 const pages=await response.json();
 const valid=pages.map(page=>page.payload).filter(payload=>payload?.version===1);
 return {rows:valid.flatMap(payload=>payload.rows||[]),excludedRows:valid.flatMap(payload=>payload.excludedRows||[])};
};
window.GAO_RELAVE_ARCHIVE_EXCLUDE=async(command,date)=>{
 if(!token()||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Sessão ou data inválida.');
 const endpoint=`${SB}/rest/v1/chemical_portal_state?state_key=eq.gao.chemicals.relave.archive.${date.slice(0,7)}`;
 const response=await fetch(endpoint+'&select=payload,updated_at',{headers:headers()});
 if(!response.ok)throw Error('Não foi possível consultar a comanda.');
 const [page]=await response.json();
 const payload=page?.payload;
 if(!Array.isArray(payload?.rows)||!page.updated_at)throw Error('Comanda indisponível.');
 const matches=row=>row[0]===command&&row[2]===date;
 const removed=payload.rows.filter(matches);
 if(!removed.length){
  if(payload.excludedRows?.some(matches))return;
  throw Error('Comanda indisponível.');
 }
 const saved=await fetch(endpoint+'&updated_at=eq.'+encodeURIComponent(page.updated_at),{
  method:'PATCH',headers:headers({Prefer:'return=representation'}),
  body:JSON.stringify({payload:{...payload,rows:payload.rows.filter(row=>!matches(row)),excludedRows:[...(payload.excludedRows||[]),...removed]},updated_at:new Date().toISOString()})
 });
 if(!saved.ok)throw Error('Não foi possível excluir a comanda. Confira sua permissão.');
 if(!(await saved.json()).length)throw Error('O histórico foi atualizado. Tente excluir novamente.');
};
window.GAO_CHEM_DB_READY=false;window.GAO_CHEM_DB_SYNC_ERROR='';
window.GAO_CHEM_DB_LOAD=()=>bootPromise;
window.GAO_CHEM_DB_SYNC=async(key)=>{await bootPromise;if(!window.GAO_CHEM_DB_READY)throw Error(window.GAO_CHEM_DB_SYNC_ERROR||'Banco indisponível');for(const stateKey of (key ? [key] : [RELAVE,WASTE])){if(!KEYS.includes(stateKey))throw Error('Estado inválido.');const value=rawGet.call(localStorage,stateKey);if(value)await enqueue(stateKey,value)}};
bootPromise=boot();
})();
