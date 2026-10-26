(()=>{
'use strict';
const SB='https://fquzuxdqvhecijjuxbmg.supabase.co';
const API='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
const KEYS=['gao.chemicals.master.v78','gao.chemicals.inventory.v74'];
const rawSet=Storage.prototype.setItem, rawGet=Storage.prototype.getItem;
let hydrating=true, queue=Promise.resolve();
function token(){for(const k of Object.keys(localStorage)){if(k.startsWith('sb-')&&k.endsWith('-auth-token'))try{const x=JSON.parse(rawGet.call(localStorage,k)||'null');const t=x?.access_token||x?.currentSession?.access_token||x?.session?.access_token;if(t)return t}catch{}}return''}
function headers(extra={}){return {apikey:API,Authorization:`Bearer ${token()||API}`,'Content-Type':'application/json',...extra}}
async function getRemote(){const r=await fetch(`${SB}/rest/v1/chemical_portal_state?select=state_key,payload,updated_at&state_key=in.(${KEYS.map(encodeURIComponent).join(',')})`,{headers:headers()});if(!r.ok)throw Error(await r.text());return r.json()}
async function upsert(k,val){let payload;try{payload=JSON.parse(val)}catch{return}const r=await fetch(`${SB}/rest/v1/chemical_portal_state?on_conflict=state_key`,{method:'POST',headers:headers({Prefer:'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify({state_key:k,payload,updated_at:new Date().toISOString()})});if(!r.ok)throw Error(await r.text())}
function meaningful(k,v){if(!v)return false;try{const x=JSON.parse(v);if(k.includes('master'))return (x.principles?.length||0)+(x.suppliers?.length||0)+(x.offers?.length||0)>0;if(k.includes('inventory'))return !!x.latest&&Object.keys(x.latest.items||{}).length>0}catch{}return false}
Storage.prototype.setItem=function(k,v){rawSet.call(this,k,v);if(this===localStorage&&KEYS.includes(k)&&!hydrating){queue=queue.then(()=>upsert(k,v)).catch(e=>console.error('[GAO V102 sync]',e))}}
async function boot(){try{const remote=await getRemote(), map=new Map(remote.map(x=>[x.state_key,x.payload]));for(const k of KEYS){const local=rawGet.call(localStorage,k),rv=map.get(k);if(rv){const remoteText=JSON.stringify(rv);if(meaningful(k,local)){
          // O navegador pode conter cadastro mais completo que a recuperação SQL: preserva e envia ao Supabase.
          const L=JSON.parse(local),R=rv;let merged=R;
          if(k.includes('master')) merged={...R,...L,principles:(L.principles?.length?L.principles:R.principles)||[],suppliers:(L.suppliers?.length?L.suppliers:R.suppliers)||[],offers:(L.offers?.length?L.offers:R.offers)||[],historyMap:{...(R.historyMap||{}),...(L.historyMap||{})}};
          else if(k.includes('inventory')&&L.latest) merged=L;
          rawSet.call(localStorage,k,JSON.stringify(merged)); await upsert(k,JSON.stringify(merged));
        }else rawSet.call(localStorage,k,remoteText)
      }else if(meaningful(k,local)) await upsert(k,local)
    }
    window.GAO_CHEM_DB_READY=true;window.dispatchEvent(new Event('gao-chem-db-ready'));
    if(location.pathname.startsWith('/quimicos/')){setTimeout(()=>{window.dispatchEvent(new PopStateEvent('popstate'));},80)}
  }catch(e){console.error('[GAO V102 persistência]',e);window.GAO_CHEM_DB_READY=false}finally{hydrating=false}}
window.GAO_CHEM_DB_READY=false;boot();
})();
