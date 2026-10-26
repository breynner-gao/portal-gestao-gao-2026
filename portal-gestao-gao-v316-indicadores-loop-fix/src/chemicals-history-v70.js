(()=>{
  const ROUTE='/quimicos/importacao';
  function mount(){
    if(location.pathname!==ROUTE) return;
    if(document.getElementById('gao-chem-history-v70')) return;
    const panels=[...document.querySelectorAll('section.data-panel')];
    const target=panels.find(p=>/Importar consumo histórico/i.test(p.textContent||''));
    if(!target) return;
    const box=document.createElement('div');
    box.id='gao-chem-history-v70';
    box.style.cssText='margin:14px 0 4px;padding:14px 16px;border:1px solid #b9d8ef;border-radius:14px;background:#f3f9fd;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap';
    box.innerHTML=`<div><strong style="display:block;color:#0b416d;font-size:15px">Base histórica GAO validada</strong><span style="font-size:13px;color:#526b80">Semanas 17 a 31 de 2026. Semanas 32 e 33 foram separadas por ausência do kg do Túnel na origem.</span></div><a href="/assets/historico_quimicos_gao_importacao_v70.xlsx" download="historico_quimicos_gao_importacao_v70.xlsx" style="text-decoration:none;background:#1976b9;color:#fff;padding:10px 14px;border-radius:10px;font-weight:700">Baixar base validada</a>`;
    target.insertBefore(box,target.children[1]||null);
  }
  const p=history.pushState,r=history.replaceState;
  history.pushState=function(){const x=p.apply(this,arguments);setTimeout(mount,30);return x};
  history.replaceState=function(){const x=r.apply(this,arguments);setTimeout(mount,30);return x};
  addEventListener('popstate',()=>setTimeout(mount,30));
  new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
  mount();
})();
