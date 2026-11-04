(() => {
  const items = [
    ['Painel operacional', '/rouparia'],
    ['Programação de entregas', '/rouparia/contratos'],
    ['Fila de entregas', '/rouparia/rotas'],
    ['Coletas e pesagem', '/rouparia/coletas'],
    ['Cadastros da Rouparia', '/rouparia/cadastros']
  ];
  const clean = s => String(s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function mount() {
    const side = document.querySelector('.gao-sidebar, aside, nav');
    if (!side || side.querySelector('[data-gao-rouparia-flow]')) return;
    const main = [...side.querySelectorAll('*')].find(e => (e.textContent || '').trim() === 'Rouparia');
    if (!main) return;
    const parent = main.closest('a,button,li,div') || main;
    const box = document.createElement('div');
    box.dataset.gaoRoupariaFlow = '1';
    box.className = 'gao-rouparia-flow-menu';
    box.innerHTML = '<div class="gao-flow-title">Operação de Rouparia</div>' +
      items.map(([label, href]) => '<a href="' + href + '">' + clean(label) + '</a>').join('');
    parent.after(box);
    const css = document.createElement('style');
    css.textContent = '.gao-rouparia-flow-menu{margin:4px 18px 18px 28px;padding:8px 0 8px 14px;border-left:1px solid rgba(255,255,255,.3);display:flex;flex-direction:column;gap:2px}.gao-flow-title{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#9fd0f3;font-weight:800;padding:7px 10px}.gao-rouparia-flow-menu a{display:block;padding:10px 12px;border-radius:8px;color:inherit;text-decoration:none;font-weight:700;font-size:14px}.gao-rouparia-flow-menu a:hover,.gao-rouparia-flow-menu a[aria-current="page"]{background:rgba(255,255,255,.16)}';
    document.head.appendChild(css);
    box.querySelectorAll('a').forEach(a => {
      if (a.pathname === location.pathname) a.setAttribute('aria-current', 'page');
    });
  }
  new MutationObserver(mount).observe(document.documentElement, {childList:true, subtree:true});
  window.addEventListener('load', mount);
  setTimeout(mount, 500);
})();
