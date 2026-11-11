(()=>{
'use strict';
const project='https://fquzuxdqvhecijjuxbmg.supabase.co';
const key='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
const base=project+'/storage/v1/object';
const snapshot='historico/auditoria-2026-06-a-2026-11.html';
const snapshotSha256='8495d45e31eefe72971d08eab0474fda30d1cab57388b24943dfec6364cb3c01';
const allowed={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};

function headers(){
  const session=JSON.parse(localStorage.getItem('sb-fquzuxdqvhecijjuxbmg-auth-token')||'null');
  const token=session?.access_token||session?.currentSession?.access_token||session?.session?.access_token;
  if(!token) throw Error('Entre novamente no Portal para acessar os documentos.');
  return {apikey:key,Authorization:'Bearer '+token};
}
const objectPath=path=>path.split('/').map(encodeURIComponent).join('/');
async function read(path){
  const response=await fetch(base+'/authenticated/waste-audit/'+objectPath(path),{headers:headers()});
  if(!response.ok){
    const error=Error(response.status===401||response.status===403
      ?'Sua sessão ou perfil precisa ter acesso aos documentos de Resíduos.'
      :'O Portal não conseguiu carregar o documento. Tente novamente.');
    error.status=response.status;
    throw error;
  }
  return response.blob();
}
async function upload(file,entryId){
  const extension=file.name.split('.').pop().toLowerCase();
  if(!Object.hasOwn(allowed,extension)||file.size===0||file.size>40000000) {
    throw Error('Escolha um PDF, JPG, PNG ou XLSX de até 40 MB.');
  }
  const path='coletas/'+entryId+'/'+crypto.randomUUID()+'.'+extension;
  const response=await fetch(base+'/waste-audit/'+objectPath(path),{
    method:'POST',headers:{...headers(),'Content-Type':allowed[extension]},body:file
  });
  if(!response.ok) throw Error('O Portal não conseguiu salvar o anexo. Confira seu acesso e tente novamente.');
  return {path,name:file.name};
}
async function download(path,name){
  const url=URL.createObjectURL(await read(path));
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=name;
  anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function offerImport(content,refresh){
  const label=document.createElement('label');
  label.textContent='Importar painel histórico com os documentos';
  const input=document.createElement('input');
  input.type='file';
  input.accept='.html,text/html';
  label.append(input);
  const button=document.createElement('button');
  button.type='button';
  button.textContent='Importar histórico';
  const status=document.createElement('p');
  status.setAttribute('aria-live','polite');
  button.onclick=async()=>{
    const file=input.files[0];
    if(!file){status.textContent='Selecione o HTML da auditoria de junho a novembro de 2026.';return;}
    button.disabled=true;
    status.textContent='Verificando e enviando o histórico…';
    try{
      const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
      const hex=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
      if(hex!==snapshotSha256) throw Error('Use a versão da auditoria que contém os nove documentos incorporados.');
      const response=await fetch(base+'/waste-audit/'+objectPath(snapshot),{
        method:'POST',headers:{...headers(),'Content-Type':'text/html'},body:file
      });
      if(!response.ok) throw Error('Não foi possível importar. Confirme que você tem permissão para gerenciar lançamentos de resíduos.');
      await refresh();
    }catch(error){status.textContent=error.message;}
    finally{button.disabled=false;}
  };
  content.append(label,button,status);
}
function bind(root){
  const open=root.querySelector('[data-waste-audit-open]');
  if(!open) return;
  open.onclick=async()=>{
    const content=root.querySelector('[data-waste-audit-content]');
    open.disabled=true;
    content.textContent='Carregando auditoria e documentos…';
    try{
      const blob=await read(snapshot);
      if(!content.isConnected) return;
      const csp=`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'">`;
      const html=(await blob.text()).replace(/<!doctype html>/i,'<!doctype html>'+csp);
      const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
      const frame=document.createElement('iframe');
      frame.title='Auditoria de resíduos · junho a novembro de 2026';
      frame.setAttribute('sandbox','allow-scripts allow-downloads');
      frame.style.cssText='width:100%;height:75vh;border:1px solid #cfe0ed;border-radius:8px;margin-top:10px';
      frame.src=url;
      frame.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});
      content.replaceChildren(frame);
      open.hidden=true;
    }catch(error){
      content.textContent=error.message;
      open.disabled=false;
      if(error.status===400||error.status===404) offerImport(content,open.onclick);
    }
  };
  const loadWhenSignedIn=()=>{
    if(!open.isConnected||open.disabled||open.hidden) return;
    try{headers();}catch{return;}
    void open.onclick();
  };
  loadWhenSignedIn();
  if(!open.disabled) window.addEventListener('gao-chem-db-ready',loadWhenSignedIn,{once:true});
}
window.GAO_WASTE_DOCUMENTS={upload,download,bind};
})();
