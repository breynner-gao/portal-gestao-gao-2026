import {mountFactionPortal} from './fabric-faction-portal-v1.mjs?v=1';
const SB='https://fquzuxdqvhecijjuxbmg.supabase.co';
const KEY='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
const host=document.getElementById('faction-orders');
async function rpc(name,args){
 const session=window.GAO_AUTH_SESSION;
 const response=await fetch(SB+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(args)
 });
 const body=await response.json();
 if(!response.ok)throw Error(body.message||'Não foi possível consultar as ordens.');
 return body;
}
try{await window.GAO_AUTH_READY;await mountFactionPortal(host,rpc)}
catch(error){host.textContent=error.message}
