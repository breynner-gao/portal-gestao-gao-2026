const GAO_SCOPE_SB='https://fquzuxdqvhecijjuxbmg.supabase.co';
const GAO_SCOPE_KEY='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
let GAO_SCOPE_CACHE=null,GAO_SCOPE_AT=0;
function gaoScopeToken(){for(const k of Object.keys(localStorage))if(k.startsWith('sb-')&&k.endsWith('-auth-token'))try{const x=JSON.parse(localStorage.getItem(k)||'null');const t=x?.access_token??x?.currentSession?.access_token??x?.session?.access_token;if(t)return t}catch{}return''}
async function gaoScopeRpc(){if(GAO_SCOPE_CACHE&&Date.now()-GAO_SCOPE_AT<300000)return GAO_SCOPE_CACHE;const r=await fetch(`${GAO_SCOPE_SB}/rest/v1/rpc/gao_my_laundry_scope`,{method:'POST',headers:{apikey:GAO_SCOPE_KEY,Authorization:`Bearer ${gaoScopeToken()}`,'Content-Type':'application/json'},body:'{}'});if(!r.ok)throw Error(await r.text());const a=await r.json();GAO_SCOPE_CACHE=Array.isArray(a)?a:[];GAO_SCOPE_AT=Date.now();window.GAO_LAUNDRY_SCOPE=GAO_SCOPE_CACHE;window.dispatchEvent(new CustomEvent('gao:scope-ready',{detail:GAO_SCOPE_CACHE}));return GAO_SCOPE_CACHE}
window.gaoGetLaundryScope=gaoScopeRpc;
window.gaoCanAccessClient=async id=>{const s=await gaoScopeRpc();return s.some(x=>x.client_id===id)};
if(location.pathname.startsWith('/rouparia'))gaoScopeRpc().catch(e=>console.error('[GAO V59] escopo:',e));
let gaoPrev='';setInterval(()=>{if(location.pathname!==gaoPrev){gaoPrev=location.pathname;if(location.pathname.startsWith('/rouparia'))gaoScopeRpc().catch(()=>{})}},700);
