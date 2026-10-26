
const U='https://fquzuxdqvhecijjuxbmg.supabase.co';
const K='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
function token(){for(const k of Object.keys(localStorage)){if(!k.startsWith('sb-')||!k.endsWith('-auth-token'))continue;try{const x=JSON.parse(localStorage.getItem(k)||'null'),t=x?.access_token??x?.currentSession?.access_token??x?.session?.access_token;if(t)return t}catch{}}return null}
async function call(body){const t=token();if(!t)throw Error('Sessão não encontrada.');const r=await fetch(`${U}/functions/v1/admin-users`,{method:'POST',headers:{apikey:K,Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:JSON.stringify(body)});let d=null;try{d=await r.json()}catch{}if(!r.ok||d?.success===false)throw Error(d?.error||d?.message||`Não foi possível excluir o usuário.`);return d}
async function users(){const d=await call({action:'list'});return Array.isArray(d?.users)?d.users:Array.isArray(d)?d:[]}
function toast(m,e=false){document.querySelector('[data-del-toast]')?.remove();const x=document.createElement('div');x.dataset.delToast='1';x.textContent=m;Object.assign(x.style,{position:'fixed',right:'24px',bottom:'24px',zIndex:100001,padding:'14px 18px',borderRadius:'12px',fontWeight:'700',background:e?'#fff0f0':'#eaf7ef',color:e?'#a61b1b':'#176b3a',border:`1px solid ${e?'#efb7b7':'#bfe5cb'}`,boxShadow:'0 12px 30px rgba(0,0,0,.14)'});document.body.append(x);setTimeout(()=>x.remove(),4500)}
function confirmDelete(user){
 const ov=document.createElement('div');Object.assign(ov.style,{position:'fixed',inset:0,zIndex:100000,background:'rgba(15,23,42,.38)',display:'grid',placeItems:'center',padding:'20px'});
 const box=document.createElement('div');Object.assign(box.style,{width:'min(540px,100%)',background:'#fff',borderRadius:'18px',border:'1px solid #dbe4ee',boxShadow:'0 24px 70px rgba(0,0,0,.22)',padding:'26px'});
 box.innerHTML=`<h2 style="margin:0 0 12px;color:#0f2745">Excluir usuário</h2><p>Tem certeza que deseja excluir <strong>${user.fullName||user.email}</strong>?</p><div style="padding:12px 14px;border-radius:10px;background:#fff1f2;color:#dc2626;font-weight:600">Esta ação é irreversível. O próprio usuário logado não pode ser excluído.</div>`;
 const a=document.createElement('div');Object.assign(a.style,{display:'flex',justifyContent:'flex-end',gap:'10px',marginTop:'22px'});
 const c=document.createElement('button'),d=document.createElement('button');c.textContent='Cancelar';d.textContent='Excluir usuário';
 for(const b of [c,d])Object.assign(b.style,{minHeight:'40px',padding:'8px 14px',borderRadius:'9px',fontWeight:'700',cursor:'pointer'});
 Object.assign(c.style,{background:'#fff',color:'#163b63',border:'1px solid #c9d9e8'});Object.assign(d.style,{background:'#dc2626',color:'#fff',border:'1px solid #dc2626'});
 c.onclick=()=>ov.remove();d.onclick=async()=>{d.disabled=c.disabled=true;d.textContent='Excluindo...';try{await call({action:'delete-user',input:{membershipId:user.membershipId}});ov.remove();toast('Usuário excluído com sucesso.');location.reload()}catch(e){toast(e.message||'Não foi possível excluir.',true);d.disabled=c.disabled=false;d.textContent='Excluir usuário'}};
 a.append(c,d);box.append(a);ov.append(box);document.body.append(ov);ov.onclick=e=>{if(e.target===ov)ov.remove()}
}
let cache=[];
async function enhance(table){
 if(table.dataset.deleteUser==='1')return;table.dataset.deleteUser='1';
 try{cache=await users()}catch{table.dataset.deleteUser='';return}
 for(const row of table.querySelectorAll('tbody tr')){
   const cells=[...row.querySelectorAll('td')];if(cells.length<7)continue;
   const email=(cells[2]?.textContent||'').trim().toLowerCase();
   const user=cache.find(x=>(x.email||'').trim().toLowerCase()===email);if(!user?.membershipId)continue;
   const ac=cells[cells.length-1];if(ac.querySelector('[data-delete-user]'))continue;
   const b=document.createElement('button');b.type='button';b.dataset.deleteUser='1';b.textContent='Excluir';
   b.className=ac.querySelector('button')?.className||'';
   Object.assign(b.style,{marginLeft:'8px',color:'#dc2626',borderColor:'#ef4444'});
   b.onclick=()=>confirmDelete(user);ac.append(b);
 }
}
function scan(){document.querySelectorAll('table').forEach(t=>{const h=t.querySelector('thead')?.textContent||'';if(h.includes('Nome')&&h.includes('Usuário')&&h.includes('E-mail')&&h.includes('Ações'))enhance(t)})}
new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});window.addEventListener('load',scan);scan();
