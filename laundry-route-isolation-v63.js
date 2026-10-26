(()=>{
  const DELIVERY='/rouparia/rotas';
  const COLLECTION='/rouparia/coletas';
  const DASHBOARD=['/rouparia','/rouparia/'];
  let last='';
  function remove(sel){document.querySelectorAll(sel).forEach(el=>el.remove())}
  function restoreNative(){
    document.querySelectorAll('.delivery-operation-panel').forEach(el=>{ if(location.pathname===DELIVERY) el.style.display=''; });
  }
  function cleanup(){
    const p=location.pathname;
    if(!DASHBOARD.includes(p)){
      remove('#gao-dash-v64');
      document.querySelectorAll('[data-gao-dashboard-native-hidden="1"]').forEach(el=>{el.style.display='';el.removeAttribute('data-gao-dashboard-native-hidden')});
    }
    if(p!==DELIVERY){
      remove('#gao-v622-shell');
      document.querySelectorAll('.delivery-operation-panel').forEach(el=>{el.style.display=''});
    }
    if(p!==COLLECTION){
      remove('#gao-collection-v61');
    }
    // A rota operacional deve ter apenas o módulo correspondente montado.
    if(p===COLLECTION) remove('#gao-v622-shell');
    if(p===DELIVERY) remove('#gao-collection-v61');
  }
  function tick(){
    const p=location.pathname;
    if(p!==last){ last=p; cleanup(); setTimeout(cleanup,0); setTimeout(cleanup,150); }
  }
  const push=history.pushState, replace=history.replaceState;
  history.pushState=function(){const r=push.apply(this,arguments);queueMicrotask(tick);return r};
  history.replaceState=function(){const r=replace.apply(this,arguments);queueMicrotask(tick);return r};
  addEventListener('popstate',tick);
  addEventListener('hashchange',tick);
  setInterval(tick,250);
  tick();
})();
