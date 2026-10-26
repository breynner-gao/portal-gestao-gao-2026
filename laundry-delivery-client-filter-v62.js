(()=>{
const SB='https://fquzuxdqvhecijjuxbmg.supabase.co',KEY='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
const token=()=>{for(const k of Object.keys(localStorage))if(k.startsWith('sb-')&&k.endsWith('-auth-token'))try{const x=JSON.parse(localStorage.getItem(k)||'null');if(x?.access_token)return x.access_token;if(x?.currentSession?.access_token)return x.currentSession.access_token}catch{}return''};
const H=()=>({apikey:KEY,Authorization:`Bearer ${token()||KEY}`});
async function q(path){const r=await fetch(`${SB}/rest/v1/${path}`,{headers:H()});if(!r.ok)throw Error(await r.text());return r.json()}
let selected='',lastKey='',timer=0,cache=null,cacheAt=0;
const route=()=>location.pathname==='/rouparia/rotas';
const panel=()=>document.querySelector('.delivery-operation-panel');
const cards=()=>[...(panel()?.querySelectorAll('article.delivery-card')||[])];
const shift=()=>{const b=[...(panel()?.querySelectorAll('.supplier-tabs button')||[])],i=b.findIndex(x=>x.classList.contains('active'));return i===0?'MANHA':i===1?'TARDE':'NOITE'};
const date=()=>panel()?.querySelector('input[type="date"]')?.value||'';
async function meta(){if(cache&&Date.now()-cacheAt<600000)return cache;const sc=await (window.GAO_SCOPE_READY_V60||Promise.resolve(window.GAO_SCOPE_V60));cache=sc||{clients:[],units:[],sectors:[]};cacheAt=Date.now();return cache}
function sectorName(card){const h=card.querySelector('h2,h3,.section-heading h3,.section-heading h2');return (h?.textContent||'').trim().toLocaleUpperCase('pt-BR')}
async function mount(){if(!route())return;const p=panel();if(!p)return;const m=await meta(),ctl=p.querySelector('.delivery-date-control');if(!ctl)return;
 let wrap=document.querySelector('#gao-delivery-client-wrap');if(!wrap){wrap=document.createElement('label');wrap.id='gao-delivery-client-wrap';wrap.className='gao-delivery-client-wrap';ctl.prepend(wrap)}
 const clients=m.clients||[];if(!selected&&clients.length===1)selected=clients[0].id;
 wrap.innerHTML=`<span>Cliente</span><select id="gao-delivery-client-filter">${clients.length>1?'<option value="">Todos os clientes permitidos</option>':''}${clients.map(c=>`<option value="${c.id}" ${selected===c.id?'selected':''}>${c.code?c.code+' — ':''}${c.name}</option>`).join('')}</select><small id="gao-delivery-client-count"></small>`;
 wrap.querySelector('select').onchange=e=>{selected=e.target.value;apply(m)};apply(m)
}
function apply(m){const unitClient=new Map((m.units||[]).map(u=>[u.id,u.client_id]));const byName=new Map((m.sectors||[]).map(s=>[String(s.name||'').trim().toLocaleUpperCase('pt-BR'),unitClient.get(s.unit_id)]));const clientName=new Map((m.clients||[]).map(c=>[c.id,c.name]));let vis=0;
 for(const c of cards()){const cid=byName.get(sectorName(c))||((m.clients||[]).length===1?m.clients[0].id:'');c.dataset.gaoClientId=cid||'';c.hidden=!!selected&&cid!==selected;if(!c.hidden)vis++;let badge=c.querySelector('.gao-delivery-client-badge');if(!badge){badge=document.createElement('span');badge.className='gao-delivery-client-badge';c.querySelector('.section-heading > div')?.prepend(badge)}if(badge)badge.textContent=cid?`CLIENTE • ${clientName.get(cid)||''}`:'CLIENTE NÃO IDENTIFICADO'}
 const msg=document.querySelector('#gao-delivery-client-count');if(msg)msg.textContent=`${vis} rota(s) carregada(s) neste período`;
}
function tick(){if(!route())return;const k=`${date()}|${shift()}|${cards().length}`;if(k!==lastKey){lastKey=k;clearTimeout(timer);timer=setTimeout(()=>mount().catch(console.error),80)}}
setInterval(tick,700);window.addEventListener('gao:scope-v60-ready',()=>{cache=null;tick()});
const st=document.createElement('style');st.textContent='.delivery-date-control{display:flex!important;align-items:flex-end!important;gap:12px!important;flex-wrap:wrap!important}.gao-delivery-client-wrap{display:flex;flex-direction:column;gap:5px;min-width:280px;font-weight:800;color:#082d52}.gao-delivery-client-wrap select{height:42px;border:1px solid #b9d1e8;border-radius:10px;background:#fff;padding:0 38px 0 12px;color:#082d52;font-weight:800}.gao-delivery-client-wrap small{font-weight:600;color:#607d9b}.gao-delivery-client-badge{display:inline-block;margin:0 0 5px;padding:4px 9px;border-radius:999px;background:#eaf4ff;color:#1267a8;font-size:11px;font-weight:900}.delivery-operation-panel .delivery-card[hidden]{display:none!important}';document.head.appendChild(st);
})();
