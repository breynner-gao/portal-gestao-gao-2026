(() => {
  'use strict';

  const navItems = [
    ['painel', 'Painel'],
    ['quimicos', 'Químicos'],
    ['rouparia', 'Rouparia'],
    ['enxoval', 'Enxoval e Tecidos'],
    ['compras', 'Compras'],
    ['importacoes', 'Importações'],
    ['administracao', 'Administração'],
    ['qualidade', 'Qualidade'],
    ['indicadores', 'Indicadores']
  ];

  const app = {
    route() {
      const value = (location.hash || '#painel').slice(1).toLowerCase();
      return navItems.some(([key]) => key === value) ? value : 'painel';
    },
    title(route) {
      return navItems.find(([key]) => key === route)?.[1] || 'Painel';
    },
    renderContent(route) {
      if (route === 'quimicos') {
        return '<div class="gao-eyebrow">GESTÃO DE SANEANTES</div>' +
          '<h1>Químicos</h1>' +
          '<p class="gao-muted">Produção</p>' +
          '<div class="gao-tabs"><button data-subroute="painel">Painel</button><button data-subroute="lancamento">Lançamento</button><button data-subroute="historico">Histórico</button><button data-subroute="relave">Relave</button><button data-subroute="principios">Princípios ativos e fornecedores</button><button data-subroute="inventario">Inventário</button><button data-subroute="compras">Sugestão de compra</button><button data-subroute="importacao">Importação</button></div>' +
          '<section class="gao-card"><div class="gao-eyebrow">GESTÃO QUÍMICA</div><h2>Consolidado por período</h2><p class="gao-muted">Selecione uma opção acima para consultar os lançamentos, histórico e classificações do relave.</p><div class="gao-grid"><div><label>Ano</label><input placeholder="2026"></div><div><label>Semana inicial</label><input placeholder="17"></div><div><label>Semana final</label><input placeholder="31"></div></div><div class="gao-notice">A tela foi recuperada e está pronta para carregar os dados do Portal.</div></section>';
      }
      if (route === 'rouparia') {
        return '<div class="gao-eyebrow">GESTÃO DE ROUPARIA</div><h1>Rouparia</h1><section class="gao-card"><h2>Painel da Rouparia</h2><p class="gao-muted">Acesse produção, entregas, coletas e indicadores pelo menu.</p></section>';
      }
      return '<div class="gao-eyebrow">GESTÃO INTEGRADA</div><h1>' + app.title(route) + '</h1><section class="gao-card"><h2>Painel</h2><p class="gao-muted">Portal SGQ carregado. Selecione um módulo no menu lateral.</p><div class="gao-notice">Conexão com o Portal restabelecida. Os dados operacionais serão exibidos nos módulos correspondentes.</div></section>';
    },
    render() {
      const route = app.route();
      const root = document.getElementById('root');
      if (!root) return;
      root.innerHTML = '<div class="gao-shell">' +
        '<aside class="gao-sidebar"><div class="gao-brand"><span class="gao-mark">◆</span><span>GAO Lavanderia</span></div><div class="gao-caption">Gestão integrada</div><nav class="gao-nav">' +
        navItems.map(([key, label]) => '<a href="#' + key + '" class="' + (key === route ? 'active' : '') + '">' + label + '</a>').join('') +
        '</nav></aside>' +
        '<div class="gao-body"><header class="gao-header"><div><strong>Portal de Gestão da Qualidade</strong><span> Gestão integrada • GAO Lavanderia</span></div><div class="gao-user">Portal SGQ</div></header><main class="gao-main">' + app.renderContent(route) + '</main></div></div>';
      root.querySelectorAll('[data-subroute]').forEach(button => {
        button.addEventListener('click', () => {
          root.querySelectorAll('[data-subroute]').forEach(x => x.classList.remove('active'));
          button.classList.add('active');
          const card = root.querySelector('.gao-card');
          if (card) card.querySelector('h2').textContent = button.textContent;
        });
      });
      root.querySelectorAll('.gao-tabs button')[0]?.classList.add('active');
      window.dispatchEvent(new CustomEvent('gao:core-ready', { detail: { route } }));
    }
  };

  const style = document.createElement('style');
  style.textContent = '.gao-shell{display:flex;min-height:100vh;background:#f3f7fb;color:#082d52}.gao-sidebar{width:280px;background:#154a78;color:#fff;padding:22px 16px;flex:0 0 280px}.gao-brand{font-size:20px;font-weight:800;display:flex;gap:8px;align-items:center;margin:12px 12px 52px}.gao-mark{color:#fff;font-size:22px}.gao-caption{color:#9bb8d2;border-bottom:1px solid rgba(255,255,255,.18);padding:0 22px 34px;margin-bottom:28px}.gao-nav{display:grid;gap:8px}.gao-nav a{display:block;color:#fff;border-radius:15px;padding:14px 16px;font-size:18px;font-weight:800;text-decoration:none}.gao-nav a:hover,.gao-nav a.active{background:#35658f}.gao-body{min-width:0;flex:1}.gao-header{height:94px;background:#fff;border-bottom:1px solid #d8e4ef;display:flex;align-items:center;justify-content:space-between;padding:0 38px;color:#103d67;font-size:20px}.gao-header strong{font-size:22px}.gao-user{font-size:15px;color:#53718e}.gao-main{max-width:1500px;margin:0 auto;padding:38px 44px}.gao-eyebrow{color:#0577bd;font-size:15px;font-weight:900;letter-spacing:3px;margin:0 0 14px}.gao-main h1{font-size:40px;margin:0 0 24px}.gao-main h2{font-size:28px;margin:12px 0 18px}.gao-muted{color:#57738e;font-size:17px}.gao-card{background:#fff;border:1px solid #d4e1ed;border-radius:14px;padding:26px;margin-top:22px;box-shadow:0 5px 18px rgba(13,55,88,.06)}.gao-tabs{display:flex;gap:10px;flex-wrap:wrap;border-bottom:1px solid #cbdcea;padding-bottom:16px;margin:24px 0}.gao-tabs button{border:1px solid #b7d3e8;background:#fff;color:#174a78;border-radius:10px;padding:10px 14px;font-weight:800}.gao-tabs button.active,.gao-tabs button:hover{background:#2d98d0;color:#fff;border-color:#2d98d0}.gao-grid{display:grid;grid-template-columns:repeat(3,minmax(160px,1fr));gap:18px}.gao-grid label{display:block;margin-bottom:6px}.gao-grid input{width:100%;padding:11px;border:1px solid #b9d1e8;border-radius:8px}.gao-notice{margin-top:22px;padding:14px 16px;border-radius:9px;background:#edf7ff;color:#23618b;border:1px solid #c9e4f6}@media(max-width:800px){.gao-shell{display:block}.gao-sidebar{width:auto;padding:14px}.gao-brand{margin:4px 8px 18px}.gao-caption{padding:0 8px 16px;margin-bottom:12px}.gao-nav{display:flex;overflow:auto;gap:6px}.gao-nav a{white-space:nowrap;font-size:14px;padding:10px 12px}.gao-header{height:auto;min-height:72px;padding:16px 18px;display:block;font-size:16px}.gao-header strong{font-size:17px}.gao-user{margin-top:5px}.gao-main{padding:22px 16px}.gao-main h1{font-size:30px}.gao-grid{grid-template-columns:1fr}}';
  document.head.appendChild(style);

  function start() {
    if (!document.getElementById('gao-core-started')) {
      const marker = document.createElement('meta');
      marker.id = 'gao-core-started';
      document.head.appendChild(marker);
    }
    app.render();
    window.addEventListener('hashchange', app.render);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();