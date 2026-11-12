(()=>{
'use strict';
const project='https://fquzuxdqvhecijjuxbmg.supabase.co';
const key='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
const base=project+'/storage/v1/object';
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
function saveBlob(blob,name){
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=name;
  anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function download(path,name){saveBlob(await read(path),name);}
async function downloadHistoricalDocument(documentKey,name){
  const response=await fetch(project+'/functions/v1/waste-audit-documents',{
    method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({key:documentKey})
  });
  if(!response.ok) throw Error('Não foi possível baixar este documento. Tente novamente.');
  saveBlob(await response.blob(),name);
}
function bind(root){
  const content=root.querySelector('[data-waste-audit-content]');
  if(!content) return;
  const status=root.querySelector('[data-waste-audit-status]');
  const load=async()=>{
    if(!content.isConnected||content.getAttribute('aria-busy')==='true'||status.hidden) return;
    try{headers();}catch{return;}
    content.setAttribute('aria-busy','true');
    status.textContent='Carregando o histórico de resíduos…';
    try{
      const query='/rest/v1/waste_audit_history?id=eq.2026-06-a-2026-11&select=records,indcom_audit,billing_titles,documents';
      const [response,{mountAudit}]=await Promise.all([
        fetch(project+query,{headers:headers()}),
        import('/waste-audit-panel-v1.mjs?v=2')
      ]);
      if(!response.ok) throw Error('Não foi possível consultar o histórico de resíduos.');
      const [history]=await response.json();
      if(!history) throw Error('Histórico indisponível para este perfil.');
      if(!content.isConnected) return;
      mountAudit(content,history,downloadHistoricalDocument);
      status.hidden=true;
    }catch(error){
      if(!content.isConnected) return;
      const retry=document.createElement('button');
      retry.type='button';
      retry.textContent='Tentar novamente';
      retry.onclick=load;
      status.replaceChildren(document.createTextNode(error.message+' '),retry);
    }finally{content.removeAttribute('aria-busy');}
  };
  void load();
  window.addEventListener('gao-chem-db-ready',load,{once:true});
}
window.GAO_WASTE_DOCUMENTS={upload,download,bind};
})();
