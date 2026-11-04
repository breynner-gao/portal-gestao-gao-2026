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
    .gao-sidebar{position:relative!important;width:344px!important;flex:0 0 344px!important;background:var(--gao-navy)!important;padding:22px 20px!important;transition:width .2s ease,padding .2s ease!important;overflow:visible!important}
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
    @media(max-width:900px){
      .gao-sidebar{width:100%!important;flex-basis:auto!important}
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
  function setup(){
    injectStyle();
    const side=document.querySelector('.gao-sidebar');if(!side)return;
    ensureBrand(side);
    const link=side.querySelector('.gao-nav>a[href="/rouparia"]');
    const sub=side.querySelector('.gao-subnav');
    if(link&&sub&&!link.dataset.gaoMenuFix){
      link.dataset.gaoMenuFix='1';
      const subroute=/^\/rouparia\/(contratos|rotas|coletas|cadastros)/.test(location.pathname);
      const open=()=>{sub.classList.add('gao-menu-open');link.setAttribute('aria-expanded','true')};
      const close=()=>{if(!/^\/rouparia\/(contratos|rotas|coletas|cadastros)/.test(location.pathname)){sub.classList.remove('gao-menu-open');link.setAttribute('aria-expanded','false')}};
      link.setAttribute('aria-haspopup','true');
      link.setAttribute('aria-expanded',subroute?'true':'false');
      if(subroute)open(); else sub.classList.remove('gao-menu-open');
      link.addEventListener('click',e=>{e.preventDefault();sub.classList.toggle('gao-menu-open');link.setAttribute('aria-expanded',sub.classList.contains('gao-menu-open')?'true':'false')});
      sub.addEventListener('click',()=>sub.classList.add('gao-menu-open'));
      side.querySelectorAll('.gao-nav>a:not([href="/rouparia"])').forEach(a=>a.addEventListener('click',close));
    }
  }
  new MutationObserver(setup).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',setup);
  setTimeout(setup,50);
  setTimeout(setup,500);
})();
