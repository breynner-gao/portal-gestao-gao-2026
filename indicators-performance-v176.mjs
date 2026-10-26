export const performanceRoutes = {
  // O Portal usa navegação por hash; a rota em pathname é interceptada
  // pelo shell principal e retorna para o painel gerencial.
  main: '/#indicadores-performance',
  legacy: '/#indicadores-performance',
  hash: '#indicadores-performance'
};

export const performanceHostSelectors = ['.page-stack', '.content-area', 'main', '#root'];

export const layoutSections = [
  'Painel Executivo',
  'Cadastro de Indicadores',
  'Avaliação Bimestral',
  'Dados Históricos',
  'Evidências',
  'Relatórios Executivos',
  'Aprovação Diretoria'
];

export const indicatorCatalog = [
  {
    code: 'KPI01',
    name: 'Índice de Não Conformidades',
    objective: 'Medir verificações não conformes confirmadas frente ao total de verificações realizadas.',
    formula: '(verificações não conformes / verificações realizadas) × 100',
    source: 'Controle de Qualidade e Não Conformidades',
    unit: '%',
    direction: 'Menor é melhor',
    target: 'Configurar meta aprovada',
    weight: 'Configurar peso aprovado',
    validationStatus: 'Pendente de validação'
  },
  {
    code: 'KPI02',
    name: 'Cumprimento de SLA Operacional',
    objective: 'Acompanhar entregas, coletas e atendimentos realizados conforme regra contratual.',
    formula: '(atendimentos conformes / atendimentos previstos) × 100',
    source: 'Entregas, Coletas, SLA e Rouparias',
    unit: '%',
    direction: 'Maior é melhor',
    target: 'Configurar meta aprovada',
    weight: 'Configurar peso aprovado',
    validationStatus: 'Pendente de validação'
  },
  {
    code: 'KPI03',
    name: 'Relave e perdas',
    objective: 'Acompanhar o relave confirmado e as perdas de enxoval identificadas pela Qualidade.',
    formula: '(kg de relave confirmado / kg triado) × 100',
    source: 'Relave e peças sem condição de uso',
    unit: '%',
    direction: 'Maior é melhor',
    target: 'Configurar meta por processo',
    weight: 'Configurar peso aprovado',
    validationStatus: 'Pendente de validação'
  },
  {
    code: 'KPI04',
    name: 'Acuracidade de Inventário de Enxoval',
    objective: 'Medir aderência entre saldo físico conferido e saldo sistêmico.',
    formula: '(itens com saldo físico igual ao sistêmico / itens conferidos) × 100',
    source: 'RFID / inventário / dimensionamento de enxoval',
    unit: '%',
    direction: 'Maior é melhor',
    target: 'Configurar meta aprovada',
    weight: 'Configurar peso aprovado',
    validationStatus: 'Pendente de validação'
  },
  {
    code: 'KPI05',
    name: 'Conformidade em Auditorias',
    objective: 'Acompanhar auditorias sem apontamentos críticos e planos de ação vinculados.',
    formula: '(auditorias sem apontamentos críticos / auditorias realizadas) × 100',
    source: 'Auditorias e Responsabilidade Técnica',
    unit: '%',
    direction: 'Maior é melhor',
    target: 'Configurar meta aprovada',
    weight: 'Configurar peso aprovado',
    validationStatus: 'Pendente de validação'
  },
  {
    code: 'KPI06',
    name: 'Rotinas da Qualidade',
    objective: 'Medir auditorias, reuniões, tratativas e rotinas da Qualidade realizadas no prazo.',
    formula: '(rotinas da Qualidade realizadas no prazo / rotinas previstas) × 100',
    source: 'Agenda, auditorias e planos de ação da Qualidade',
    unit: '%',
    direction: 'Maior é melhor',
    target: 'Configurar meta aprovada',
    weight: 'Configurar peso aprovado',
    validationStatus: 'Pendente de validação'
  }
];

export const integrationMap = indicatorCatalog.map(indicator => ({
  code: indicator.code,
  indicator: indicator.name,
  primarySource: indicator.source,
  availableData: 'Mapear no diagnóstico técnico',
  missingData: 'Confirmar tabelas, campos, filtros e regra de validação',
  status: 'Pendente de diagnóstico'
}));

export const appraisalRows = indicatorCatalog.map(indicator => ({
  code: indicator.code,
  indicator: indicator.name,
  result: 'Não apurado',
  target: 'A definir',
  weight: 'A definir',
  status: 'Cinza',
  validation: 'Aguardando fonte validada'
}));

export const performanceActions = [
  {
    key: 'draft',
    message: 'Rascunho visual salvo nesta tela. Na fase de integração, isso gravará a avaliação com usuário, data e histórico.'
  },
  {
    key: 'submit',
    message: 'Envio para Diretoria preparado. A submissão real ficará bloqueada até metas, pesos e evidências estarem validados.'
  },
  {
    key: 'preview',
    message: 'Pré-visualização do relatório preparada. O PDF final será gerado após validação das fontes.'
  },
  {
    key: 'pdf',
    message: 'Geração de PDF prevista para o relatório executivo com capa GAO, seis KPIs, evidências e parecer da Diretoria.'
  }
];

const state = {
  tab: 'executive',
  period: '2026-08-01|2026-09-30',
  manager: 'Gerência de Qualidade',
  message: ''
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const isMainPath = () => location.pathname === '/indicadores-performance' || location.pathname.startsWith('/indicadores-performance/');

const isLegacyHash = () => `${location.pathname}${location.hash}` === performanceRoutes.legacy || location.hash === performanceRoutes.hash;

const isRoute = () => isMainPath() || isLegacyHash();

const contentHost = () => {
  const existing = document.getElementById('ip176');
  if (existing?.parentElement) return existing.parentElement;
  return performanceHostSelectors
    .map(selector => document.querySelector(selector))
    .find(Boolean) || null;
};

function go(replace = false) {
  history[replace ? 'replaceState' : 'pushState']({ gaoIndicators: true }, '', performanceRoutes.main);
  setTimeout(mount, 40);
}

function ensureNav() {
  const nav = document.querySelector('.sidebar nav');
  if (!nav) return;
  let a = nav.querySelector('[data-indicators-link]');
  if (!a) {
    a = document.createElement('a');
    a.href = performanceRoutes.main;
    a.dataset.indicatorsLink = '1';
    a.className = 'sidebar-link';
    a.innerHTML = '<span class="sidebar-icon">K</span><span class="sidebar-label">Indicadores</span>';
    nav.appendChild(a);
  }
  if (nav.dataset.ip176CaptureBound !== '1') {
    nav.dataset.ip176CaptureBound = '1';
    nav.addEventListener('click', event => {
      const link = event.target.closest?.('a,button,[role="link"]');
      if (!link || !/indicadores/i.test((link.textContent || '').trim())) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      go(false);
    }, true);
  }
}

function isolate(main) {
  [...main.children].forEach(element => {
    if (element.id === 'ip176') return;
    if (!element.hasAttribute('data-ip176-prev-display')) element.setAttribute('data-ip176-prev-display', element.style.display || '');
    element.style.display = 'none';
  });
}

function restore() {
  document.querySelectorAll('[data-ip176-prev-display]').forEach(element => {
    element.style.display = element.getAttribute('data-ip176-prev-display') || '';
    element.removeAttribute('data-ip176-prev-display');
  });
}

function cleanup() {
  document.getElementById('ip176')?.remove();
  restore();
  document.querySelectorAll('[data-indicators-link]').forEach(item => item.classList.remove('active'));
}

function host() {
  const main = contentHost();
  if (!main) return null;
  let section = document.getElementById('ip176');
  if (section) return section;
  isolate(main);
  section = document.createElement('section');
  section.id = 'ip176';
  main.appendChild(section);
  return section;
}

function css() {
  if (document.getElementById('ip176-css')) return;
  const style = document.createElement('style');
  style.id = 'ip176-css';
  style.textContent = `
#ip176{color:#082d52;font-family:inherit}.ip176-hero{background:linear-gradient(135deg,#073763,#0e6ca8);color:#fff;border-radius:22px;padding:24px 26px;margin-bottom:14px;box-shadow:0 18px 44px rgba(8,45,82,.18)}.ip176-hero p{margin:0 0 7px;color:#83d8ff;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}.ip176-hero h1{margin:0 0 7px;font-size:30px}.ip176-hero span{display:block;color:#d9ecfa;max-width:980px}.ip176-toolbar{display:flex;gap:10px;align-items:end;flex-wrap:wrap;background:#fff;border:1px solid #d5e3ef;border-radius:14px;padding:12px;margin-bottom:14px}.ip176-toolbar label{font-size:11px;font-weight:900;color:#56728b}.ip176-toolbar select{display:block;min-width:220px;margin-top:4px;border:1px solid #bdd4e7;border-radius:10px;padding:9px 11px;background:#fff;color:#082d52;font-weight:800}.ip176-message{border:1px solid #9bd0f1;background:#eef8ff;color:#174a78;border-radius:12px;padding:10px 12px;margin-bottom:12px;font-weight:800}.ip176-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.ip176-tabs button{border:1px solid #bdd4e7;background:#fff;color:#174a78;border-radius:999px;padding:9px 13px;font-weight:900;cursor:pointer}.ip176-tabs button.active{background:#2d88c9;border-color:#2d88c9;color:#fff}.ip176-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.ip176-card{background:#fff;border:1px solid #d5e3ef;border-radius:16px;padding:15px;box-shadow:0 10px 28px rgba(22,59,92,.07)}.ip176-kpi small{display:block;color:#607d9b;font-weight:800;text-transform:uppercase;font-size:10px;letter-spacing:.08em}.ip176-kpi h3{margin:6px 0 10px;font-size:17px}.ip176-kpi strong{display:block;font-size:25px;color:#8798a8}.ip176-kpi .meta{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:10px}.ip176-pill{display:inline-flex;align-items:center;border-radius:999px;padding:5px 8px;font-size:11px;font-weight:900;background:#eef6fd;color:#174a78}.ip176-pill.gray{background:#edf1f5;color:#607286}.ip176-pill.green{background:#ddf7e8;color:#137744}.ip176-pill.yellow{background:#fff3d6;color:#8a5900}.ip176-pill.red{background:#ffe5e5;color:#b42318}.ip176-two{display:grid;grid-template-columns:1.2fr .8fr;gap:12px;margin-top:12px}.ip176-table-wrap{overflow:auto}.ip176-table{width:100%;border-collapse:collapse;font-size:12px}.ip176-table th{background:#174a78;color:#fff;text-align:left;padding:9px}.ip176-table td{padding:9px;border-bottom:1px solid #e3edf5;vertical-align:top}.ip176-table b{color:#082d52}.ip176-empty{border:1px dashed #bdd4e7;border-radius:14px;background:#f8fbff;color:#607d9b;padding:18px}.ip176-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;margin-top:12px}.ip176-btn{border:1px solid #2d88c9;border-radius:10px;background:#2d88c9;color:#fff;font-weight:900;padding:10px 13px;cursor:pointer}.ip176-btn.secondary{background:#fff;color:#174a78}.ip176-section-title{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.ip176-section-title h2{margin:0;font-size:19px}.ip176-steps{display:grid;gap:8px}.ip176-step{display:grid;grid-template-columns:36px 1fr auto;gap:10px;align-items:center;border:1px solid #e0ebf3;border-radius:12px;padding:10px;background:#fbfdff}.ip176-step i{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:#e7f3fb;color:#174a78;font-style:normal;font-weight:900}.ip176-step b{display:block}.ip176-step small{color:#607d9b}@media(max-width:1100px){.ip176-grid,.ip176-two{grid-template-columns:1fr}.ip176-table{min-width:980px}}`;
  document.head.appendChild(style);
}

function sourceSnapshot(){
  const keys=[]; try{for(let i=0;i<localStorage.length;i++) keys.push(localStorage.key(i)||'')}catch{}
  const text=keys.join(' ').toLowerCase();
  const rules={KPI01:['quality','nao','conform'],KPI02:['rouparia','entrega','coleta','sla'],KPI03:['relave','quimic','consum'],KPI04:['enxoval','invent','rfid'],KPI05:['audit','quality'],KPI06:['activity','atividade','rotina']};
  return indicatorCatalog.map(item=>{const hit=rules[item.code].some(k=>text.includes(k));return {...item,available:hit};});
}
function analysisFor(item){
  const snap=sourceSnapshot().find(x=>x.code===item.code); const status=snap?.available?'Dados encontrados':'Sem dados vinculados';
  const action=snap?.available?'Validar período, meta e evidência':'Vincular a fonte operacional correspondente';
  return {status,action};
}

function kpiCard(item) {
  const a=analysisFor(item); const cls=a.status==='Dados encontrados'?'green':'gray';
  return `<article class="ip176-card ip176-kpi"><small>${esc(item.code)}</small><h3>${esc(item.name)}</h3><strong>${a.status}</strong><div class="meta"><span class="ip176-pill ${cls}">${esc(a.status)}</span><span class="ip176-pill gray">Meta: aprovar</span></div><p style="margin:10px 0 0;color:#607d9b;font-size:12px"><b>Próxima ação:</b> ${esc(a.action)}</p><div class="ip176-actions"><button class="ip176-btn secondary" type="button" data-ip176-detail="${esc(item.code)}">Ver detalhes</button></div></article>`;
}

function executive() {
  const available = sourceSnapshot().filter(x => x.available).length;
  const missing = sourceSnapshot().filter(x => !x.available).length;
  return `<div class="ip176-section-title"><div><h2 style="margin:0">Resumo executivo</h2><small>Comparação do período atual com o período anterior</small></div><span class="ip176-pill gray">Atualização por fonte</span></div>
  <div class="ip176-grid">${indicatorCatalog.map(kpiCard).join('')}</div>
  <div class="ip176-two">
    <article class="ip176-card"><div class="ip176-section-title"><h2>Tendência dos indicadores</h2><span class="ip176-pill gray">Período atual × anterior</span></div><div class="ip176-empty">A linha de tendência será preenchida conforme cada fonte validada. Nenhum resultado é criado quando a fonte não está disponível.</div></article>
    <article class="ip176-card"><div class="ip176-section-title"><h2>Qualidade dos dados</h2></div><table class="ip176-table"><tbody><tr><td>Fontes disponíveis</td><td><b>${available}</b></td></tr><tr><td>Validação pendente</td><td><b>${available}</b></td></tr><tr><td>Sem fonte vinculada</td><td><b>${missing}</b></td></tr></tbody></table></article>
  </div>
  <div class="ip176-two">
    <article class="ip176-card"><h2>Principais desvios</h2><div class="ip176-empty">Exibir somente desvios calculados contra a meta aprovada.</div></article>
    <article class="ip176-card"><h2>Planos de ação</h2><div class="ip176-empty">Vincular responsáveis, prazo e evidência ao indicador em desvio.</div></article>
  </div>`;
}

function catalog() {
  return `<article class="ip176-card ip176-table-wrap"><div class="ip176-section-title"><h2>Cadastro Central de Indicadores</h2><span class="ip176-pill gray">Configurável pela Diretoria</span></div><table class="ip176-table"><thead><tr><th>Código</th><th>Indicador</th><th>Fórmula</th><th>Fonte</th><th>Meta</th><th>Peso</th><th>Status</th></tr></thead><tbody>${indicatorCatalog.map(item => `<tr><td><b>${esc(item.code)}</b></td><td><b>${esc(item.name)}</b><br><small>${esc(item.objective)}</small></td><td>${esc(item.formula)}</td><td>${esc(item.source)}</td><td>${esc(item.target)}</td><td>${esc(item.weight)}</td><td><span class="ip176-pill gray">${esc(item.validationStatus)}</span></td></tr>`).join('')}</tbody></table></article>`;
}

function appraisal() {
  return `<article class="ip176-card ip176-table-wrap"><div class="ip176-section-title"><h2>Avaliação Bimestral de Performance</h2><span class="ip176-pill gray">01/08/2026 a 30/09/2026</span></div><table class="ip176-table"><thead><tr><th>Indicador</th><th>Resultado</th><th>Meta</th><th>Peso</th><th>Status</th><th>Validação</th></tr></thead><tbody>${appraisalRows.map(row => `<tr><td><b>${esc(row.code)}</b> — ${esc(row.indicator)}</td><td>${esc(row.result)}</td><td>${esc(row.target)}</td><td>${esc(row.weight)}</td><td><span class="ip176-pill gray">${esc(row.status)}</span></td><td>${esc(row.validation)}</td></tr>`).join('')}</tbody></table><div class="ip176-two"><div class="ip176-card"><h2>Entregas estratégicas</h2><div class="ip176-empty">Campo preparado para registrar entregas e melhorias comprovadas.</div></div><div class="ip176-card"><h2>Análise crítica do gestor</h2><div class="ip176-empty">A análise será registrada antes do envio para Diretoria.</div></div></div><div class="ip176-actions"><button class="ip176-btn secondary" type="button" data-ip176-action="draft">Salvar rascunho</button><button class="ip176-btn secondary" type="button" data-ip176-action="submit">Enviar para Diretoria</button><button class="ip176-btn" type="button" data-ip176-action="pdf">Gerar relatório PDF</button></div></article>`;
}

function history() {
  return `<article class="ip176-card"><div class="ip176-section-title"><h2>Dados Históricos</h2><span class="ip176-pill gray">Agosto e Setembro/2026</span></div><div class="ip176-empty">Importação manual/histórica será usada apenas com fonte, responsável, evidência e status de validação. Resultado fictício não será aceito.</div></article>`;
}

function evidence() {
  return `<article class="ip176-card ip176-table-wrap"><div class="ip176-section-title"><h2>Evidências</h2><span class="ip176-pill gray">Anexos e rastreabilidade</span></div><table class="ip176-table"><thead><tr><th>KPI</th><th>Evidência</th><th>Responsável</th><th>Data</th><th>Status</th></tr></thead><tbody><tr><td colspan="5"><div class="ip176-empty">Nenhuma evidência vinculada nesta primeira versão visual.</div></td></tr></tbody></table></article>`;
}

function reports() {
  return `<article class="ip176-card"><div class="ip176-section-title"><h2>Relatórios Executivos</h2><span class="ip176-pill gray">PDF com versão aprovada</span></div><div class="ip176-steps">${['Capa institucional','Sumário executivo','Quadro dos seis KPIs','Resultados versus metas','Entregas estratégicas','Melhorias operacionais','Ganhos financeiros','Não conformidades e planos de ação','Riscos e oportunidades','Conclusão gerencial','Parecer da Diretoria'].map((item, index) => `<div class="ip176-step"><i>${index + 1}</i><div><b>${esc(item)}</b><small>Será preenchido a partir de dados validados e evidências vinculadas.</small></div><span class="ip176-pill gray">Previsto</span></div>`).join('')}</div><div class="ip176-actions"><button class="ip176-btn secondary" type="button" data-ip176-action="preview">Pré-visualizar</button><button class="ip176-btn" type="button" data-ip176-action="pdf">Gerar PDF</button></div></article>`;
}

function approvals() {
  return `<article class="ip176-card"><div class="ip176-section-title"><h2>Aprovação Diretoria</h2><span class="ip176-pill gray">Governança</span></div><div class="ip176-empty">A aprovação final bloqueará alterações silenciosas e manterá histórico de versões, usuário, data, valor anterior e valor atualizado.</div></article>`;
}

function diagnostics() {
  return `<article class="ip176-card ip176-table-wrap"><div class="ip176-section-title"><h2>Mapa de integração dos seis KPIs</h2><span class="ip176-pill gray">Fase 1 — Diagnóstico</span></div><table class="ip176-table"><thead><tr><th>KPI</th><th>Fonte principal</th><th>Disponível</th><th>Faltante</th><th>Status</th></tr></thead><tbody>${integrationMap.map(item => `<tr><td><b>${esc(item.code)}</b><br>${esc(item.indicator)}</td><td>${esc(item.primarySource)}</td><td>${esc(item.availableData)}</td><td>${esc(item.missingData)}</td><td><span class="ip176-pill gray">${esc(item.status)}</span></td></tr>`).join('')}</tbody></table></article>`;
}

function body() {
  if (state.tab === 'executive') return executive();
  if (state.tab === 'catalog') return catalog();
  if (state.tab === 'appraisal') return appraisal();
  if (state.tab === 'history') return history();
  if (state.tab === 'evidence') return evidence();
  if (state.tab === 'reports') return reports();
  if (state.tab === 'approval') return approvals();
  return diagnostics();
}

function notify(actionKey) {
  const action = performanceActions.find(item => item.key === actionKey);
  state.message = action?.message || 'Ação registrada nesta versão visual.';
  render();
}

function render() {
  const section = host();
  if (!section) return;
  document.querySelectorAll('[data-indicators-link]').forEach(item => item.classList.add('active'));
  const tabs = [
    ['executive', 'Painel Executivo'],
    ['catalog', 'Cadastro de Indicadores'],
    ['appraisal', 'Avaliação Bimestral'],
    ['history', 'Dados Históricos'],
    ['evidence', 'Evidências'],
    ['reports', 'Relatórios Executivos'],
    ['approval', 'Aprovação Diretoria'],
    ['diagnostics', 'Diagnóstico']
  ];
  section.innerHTML = `<div class="ip176-hero"><p>Indicadores e Performance</p><h1>Painel Executivo — Gerência de Qualidade</h1><span>Dados operacionais integrados por fonte. O painel separa resultado calculado, validação pendente e ação necessária.</span></div><div class="ip176-toolbar"><label>Gerência<select><option>${esc(state.manager)}</option></select></label><label>Período<select><option>01/08/2026 a 30/09/2026</option></select></label><label>Status dos dados<select><option>Em diagnóstico</option><option>Validado</option><option>Não apurado</option></select></label></div>${state.message ? `<div class="ip176-message">${esc(state.message)}</div>` : ''}<div class="ip176-tabs">${tabs.map(([key, label]) => `<button type="button" data-tab="${key}" class="${state.tab === key ? 'active' : ''}">${esc(label)}</button>`).join('')}</div>${body()}`;
  section.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', event => {
    state.tab = event.currentTarget.dataset.tab || 'executive';
    render();
  }));
  section.querySelectorAll('[data-ip176-action]').forEach(button => button.addEventListener('click', event => {
    notify(event.currentTarget.dataset.ip176Action);
  }));
  section.querySelectorAll('[data-ip176-detail]').forEach(button => button.addEventListener('click', event => {
    const item = indicatorCatalog.find(indicator => indicator.code === event.currentTarget.dataset.ip176Detail);
    state.message = item ? `${item.name}: detalhe disponível no módulo operacional correspondente.` : 'Detalhe indisponível.';
    render();
  }));
}

export function mount() {
  if (typeof document === 'undefined') return;
  ensureNav();
  if (isMainPath()) {
    history.replaceState({ gaoIndicators: true }, '', performanceRoutes.main);
    css();
    render();
    return;
  }
  if (!isRoute()) {
    cleanup();
    return;
  }
  css();
  render();
}

if (typeof window !== 'undefined') {
  const push = history.pushState;
  const replace = history.replaceState;
  history.pushState = function pushStatePatched() {
    const result = push.apply(this, arguments);
    setTimeout(mount, 60);
    return result;
  };
  history.replaceState = function replaceStatePatched() {
    const result = replace.apply(this, arguments);
    setTimeout(mount, 60);
    return result;
  };
  addEventListener('popstate', () => setTimeout(mount, 60));
  addEventListener('hashchange', () => setTimeout(mount, 60));
  addEventListener('click', event => {
    const link = event.target.closest?.('a[href="/#indicadores-performance"],a[href="/indicadores-performance"],[data-indicators-link]');
    if (!link) return;
    event.preventDefault();
    go(false);
  });
  // O shell do portal sofre mutações frequentes. Observar cada alteração e
  // manter um setInterval fazia a tela piscar e deixava a navegação lenta.
  // Um observador com debounce é suficiente para instalar o menu uma única vez.
  let mountTimer;
  new MutationObserver(() => {
    clearTimeout(mountTimer);
    mountTimer = setTimeout(() => {
      ensureNav();
      if (isRoute() && !document.getElementById('ip176')) mount();
    }, 120);
  }).observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(mount, 400);
}
