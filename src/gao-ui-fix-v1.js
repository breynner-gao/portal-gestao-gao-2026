(() => {
  const STYLE_ID = 'gao-ui-fix-v1';
  const css = `
    :root{
      --gao-navy:#124b78;
      --gao-navy-dark:#0b3c63;
      --gao-blue:#2f86c7;
      --gao-blue-soft:#eaf4fb;
      --gao-bg:#f4f8fc;
      --gao-border:#d5e3ee;
      --gao-text:#0b3156;
    }
    .gao-shell{background:var(--gao-bg)!important;color:var(--gao-text)!important}
    .gao-sidebar{position:relative!important;width:344px!important;flex:0 0 344px!important;background:var(--gao-navy)!important;padding:22px 20px!important;transition:width .22s ease,transform .22s ease!important;overflow:visible!important;z-index:5!important}
    .gao-brand{display:flex!important;align-items:center!important;gap:11px!important;margin:4px 14px 34px!important;color:#fff!important;min-height:54px!important}
    .gao-brand .gao-logo{width:48px!important;height:34px!important;flex:0 0 48px!important}
    .gao-brand>span{font-size:23px!important;line-height:1.05!important;font-weight:900!important;white-space:nowrap!important}
    .gao-caption{margin:0 14px 24px!important;padding:0 0 22px!important;color:#a9c8df!important;border-bottom:1px solid rgba(255,255,255,.22)!important}
    .gao-nav{display:grid!important;gap:5px!important}
    .gao-nav>a{font-size:18px!important;padding:13px 14px!important;border-radius:12px!important;color:#fff!important}
    .gao-nav>a:hover,.gao-nav>a.active{background:#3479a9!important}
    .gao-subnav{display:none!important;margin:0 0 8px 14px!important;padding:7px 0 4px 14px!important;border-left:1px solid rgba(255,255,255,.35)!important;gap:2px!important}
    .gao-subnav.gao-menu-open{display:grid!important}
    .gao-subnav:has(a.active){display:grid!important}
    .gao-subnav a{color:#dceefa!important;padding:10px 12px!important;border-radius:9px!important;font-size:15px!important}
    .gao-subnav a:hover,.gao-subnav a.active{background:#2f6f9e!important;color:#fff!important}
    .gao-body{min-width:0!important}
    .gao-header{background:#fff!important;border-bottom:1px solid var(--gao-border)!important}
    .gao-main{background:var(--gao-bg)!important}
    .gao-rouparia-flow-menu{display:none!important}
    .gao-sidebar .gao-menu-toggle{display:none!important}
    .gao-sidebar .gao-brand{margin-right:58px!important}
    .gao-sidebar .gao-brand>span{font-size:19px!important;white-space:normal!important}
    .gao-mobile-menu-toggle{position:fixed!important;top:12px!important;left:284px!important;display:grid!important;place-items:center!important;width:48px!important;height:48px!important;padding:0!important;border:1px solid rgba(255,255,255,.35)!important;border-radius:12px!important;background:var(--gao-navy)!important;color:#fff!important;font-size:24px!important;font-weight:800!important;line-height:1!important;box-shadow:0 4px 16px rgba(5,35,60,.24)!important;z-index:1004!important;touch-action:manipulation!important}
    .gao-mobile-menu-backdrop{display:none!important}
    body.gao-mobile-menu-closed .gao-sidebar,body.gao-menu-collapsed .gao-sidebar{width:0!important;min-width:0!important;max-width:0!important;flex:0 0 0!important;padding:0!important;margin:0!important;overflow:hidden!important;transform:translateX(-100%)!important;box-shadow:none!important}
    body.gao-mobile-menu-closed .gao-mobile-menu-toggle,body.gao-menu-collapsed .gao-mobile-menu-toggle{left:12px!important;background:#fff!important;color:var(--gao-navy)!important;border-color:var(--gao-border)!important}
    @media(max-width:900px){
      html,body,#root{min-width:0!important;width:100%!important;overflow-x:hidden!important}
      .gao-shell{display:block!important;min-height:100vh!important;width:100%!important}
      .gao-sidebar{position:fixed!important;inset:0 auto 0 0!important;width:min(84vw,320px)!important;min-width:min(84vw,320px)!important;max-width:min(84vw,320px)!important;height:100dvh!important;max-height:100dvh!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior:contain!important;flex:none!important;padding:calc(22px + env(safe-area-inset-top)) 18px calc(22px + env(safe-area-inset-bottom))!important;transform:translateX(0)!important;transition:transform .22s ease!important;z-index:1002!important;box-shadow:12px 0 32px rgba(5,35,60,.22)!important}
      body.gao-mobile-menu-closed .gao-sidebar{transform:translateX(-110%)!important}
      .gao-sidebar .gao-menu-toggle{display:none!important}
      body.gao-mobile-menu-closed .gao-sidebar,body.gao-menu-collapsed .gao-sidebar{width:0!important;min-width:0!important;max-width:0!important;flex:0 0 0!important;padding:0!important;margin:0!important;overflow:hidden!important;transform:translateX(-110%)!important;box-shadow:none!important}
      .gao-sidebar .gao-brand{margin:4px 58px 22px 6px!important}
      .gao-sidebar .gao-brand>span{font-size:19px!important;white-space:normal!important}
      .gao-nav{position:static!important;display:grid!important;grid-template-columns:minmax(0,1fr)!important;align-items:stretch!important;gap:5px!important;overflow:visible!important;padding:2px 0 8px!important}
      .gao-nav>a{display:flex!important;align-items:center!important;justify-content:flex-start!important;min-width:0!important;min-height:48px!important;white-space:normal!important;font-size:16px!important;padding:12px 14px!important;touch-action:manipulation!important}
      .gao-nav>.gao-subnav.gao-menu-open{position:static!important;display:grid!important;grid-template-columns:minmax(0,1fr)!important;gap:3px!important;width:auto!important;max-height:none!important;overflow:visible!important;margin:0 0 8px 12px!important;padding:4px 0 4px 12px!important;border:0!important;border-left:1px solid rgba(255,255,255,.35)!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
      .gao-subnav a{display:flex!important;align-items:center!important;min-height:44px!important;font-size:15px!important}
      .gao-body{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important}
      .gao-mobile-menu-toggle{position:fixed!important;top:calc(12px + env(safe-area-inset-top))!important;left:calc(min(84vw,320px) - 60px)!important;display:grid!important;place-items:center!important;width:48px!important;height:48px!important;padding:0!important;border:1px solid rgba(255,255,255,.35)!important;border-radius:12px!important;background:var(--gao-navy)!important;color:#fff!important;font-size:24px!important;font-weight:800!important;line-height:1!important;box-shadow:0 4px 16px rgba(5,35,60,.24)!important;z-index:1004!important;touch-action:manipulation!important}
      .gao-mobile-menu-backdrop{position:fixed!important;inset:0!important;display:block!important;background:rgba(4,22,38,.48)!important;z-index:1001!important;opacity:1!important;transition:opacity .22s ease!important}
      body.gao-mobile-menu-closed .gao-mobile-menu-backdrop{display:none!important}
      body.gao-mobile-menu-closed .gao-mobile-menu-toggle{left:12px!important;background:#fff!important;color:var(--gao-navy)!important;border-color:var(--gao-border)!important}
      .gao-header{min-height:72px!important;height:auto!important;padding:14px 16px 14px 72px!important;font-size:15px!important}
      .gao-header strong{font-size:17px!important}
      .gao-user{font-size:13px!important;overflow-wrap:anywhere!important}
      .gao-main{padding:22px 16px!important}
    }
  `;
  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');s.id=STYLE_ID;s.textContent=css;document.head.appendChild(s);
  }
  function ensureBrand(side){
    const brand=side.querySelector('.gao-brand');if(!brand)return;
    if(!brand.querySelector('.gao-logo'))brand.insertAdjacentHTML('afterbegin','<svg class="gao-logo" viewBox="0 0 72 48" aria-label="GAO"><path fill="#fff" d="M4 9h29c8 0 12 4 12 10v20H4z"/><path fill="#8ec5e8" d="M33 9h28c6 0 9 4 9 9v21H33z"/><path fill="#154a78" d="M18 30 44 9v20c0 4-3 7-7 7H18z"/></svg>');
    const span=brand.querySelector('span');if(span&&span.textContent!=='GAO Lavanderia')span.textContent='GAO Lavanderia';
  }
  function ensureMobileMenu(side){
    let toggle=document.getElementById('gao-mobile-menu-toggle');
    if(!toggle){toggle=document.createElement('button');toggle.id='gao-mobile-menu-toggle';toggle.type='button';toggle.className='gao-mobile-menu-toggle';toggle.setAttribute('aria-controls','gao-portal-sidebar');toggle.innerHTML='☰';document.body.appendChild(toggle)}
    side.id='gao-portal-sidebar';
    let backdrop=document.getElementById('gao-mobile-menu-backdrop');
    if(!backdrop){backdrop=document.createElement('div');backdrop.id='gao-mobile-menu-backdrop';backdrop.className='gao-mobile-menu-backdrop';backdrop.setAttribute('aria-hidden','true');document.body.appendChild(backdrop)}
    document.body.classList.remove('gao-menu-collapsed');
    try{if(localStorage.getItem('gao-mobile-menu-state')==='closed')document.body.classList.add('gao-mobile-menu-closed')}catch{}
    const mobile=()=>window.matchMedia('(max-width: 900px)').matches;
    const setOpen=open=>{document.body.classList.toggle('gao-mobile-menu-closed',!open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');toggle.title=open?'Fechar menu':'Abrir menu';const label=open?'×':'☰';if(toggle.textContent!==label)toggle.textContent=label;if(mobile())try{localStorage.setItem('gao-mobile-menu-state',open?'open':'closed')}catch{}};
    setOpen(!document.body.classList.contains('gao-mobile-menu-closed'));
    if(!toggle.dataset.bound){toggle.addEventListener('click',()=>setOpen(document.body.classList.contains('gao-mobile-menu-closed')));backdrop.addEventListener('click',()=>setOpen(false));document.addEventListener('keydown',e=>{if(e.key==='Escape'&&mobile())setOpen(false)});document.addEventListener('click',e=>{if(!mobile())return;const link=e.target.closest?.('.gao-nav a');if(!link)return;const isRoupariaHome=link.getAttribute('href')==='/rouparia';if(!isRoupariaHome)setOpen(false)});toggle.dataset.bound='true'}
  }
  function setup(){
    injectStyle();
    const side=document.querySelector('.gao-sidebar');if(!side)return;
    ensureBrand(side);
    ensureMobileMenu(side);
  }
  new MutationObserver(setup).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',setup);
  setTimeout(setup,50);
  setTimeout(setup,500);
})();
