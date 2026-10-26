(()=>{
 'use strict';
 const ROUTES=new Set(['/quimicos/produtos','/quimicos/principios']);
 function isNativeMaster(el){
   if(!el || el.id==='chem-v81' || el.closest?.('#chem-v81')) return false;
   const t=(el.textContent||'').replace(/\s+/g,' ');
   return /Princípios ativos e fornecedores/i.test(t) && /Fornecedores/i.test(t) && /Produtos por fornecedor/i.test(t);
 }
 function clean(){
   if(!ROUTES.has(location.pathname)) return;
   // O React pode recriar o card nativo após a extensão montar. Mantemos uma única tela mestre.
   document.querySelectorAll('section.data-panel').forEach(el=>{
     if(isNativeMaster(el)){
       el.dataset.gaoV108NativeMaster='1';
       el.style.setProperty('display','none','important');
     }
   });
   const custom=document.getElementById('chem-v81');
   if(custom){
     custom.style.removeProperty('display');
     const tabs=custom.querySelector('.c81-tabs');
     if(tabs && !tabs.querySelector('[data-v84-history-map]')){
       // O módulo de vínculo fará a montagem no próximo ciclo; dispara uma navegação interna sem alterar URL.
       window.dispatchEvent(new PopStateEvent('popstate'));
     }
   }
 }
 function restore(){
   document.querySelectorAll('[data-gao-v108-native-master="1"]').forEach(el=>{
     el.style.removeProperty('display');
     delete el.dataset.gaoV108NativeMaster;
   });
 }
 let last=location.pathname;
 setInterval(()=>{
   if(location.pathname!==last){restore();last=location.pathname;setTimeout(clean,60)}
   else clean();
 },250);
 addEventListener('popstate',()=>setTimeout(clean,80));
 clean();
})();
