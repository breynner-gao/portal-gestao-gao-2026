import { calculateDuration, productivity, isDuplicateActivity, filterActivities, buildMetrics } from './quality-activities-rules-v1.mjs';

(() => {
  'use strict';
  const KEY = 'gao-quality-activities-v1';
  const CONFIG_KEY = 'gao-quality-activities-config-v1';
  const today = () => new Date().toISOString().slice(0, 10);
  const nowTime = () => new Date().toTimeString().slice(0, 5);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m]));
  const br = value => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const uid = () => `qa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const read = (key, fallback) => { try { const parsed = JSON.parse(localStorage.getItem(key) || 'null'); return parsed ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const defaultTypes = [
    { code: 'CADASTRO_PECAS', label: 'Cadastro de peças', mode: 'BOTH', rfid: true, product: true },
    { code: 'RECEBIMENTO_COSTURA', label: 'Recebimento de peças da costura', mode: 'QUANTITY', rfid: true, product: true },
    { code: 'ENVIO_COSTURA', label: 'Envio de peças para costura', mode: 'QUANTITY', rfid: true, product: true },
    { code: 'CONFERENCIA', label: 'Conferência de enxoval', mode: 'BOTH', rfid: true, product: true },
    { code: 'TRIAGEM', label: 'Triagem de peças', mode: 'BOTH', rfid: false, product: true },
    { code: 'SEPARACAO', label: 'Separação de enxoval', mode: 'BOTH', rfid: false, product: true },
    { code: 'MOVIMENTACAO', label: 'Movimentação entre setores', mode: 'BOTH', rfid: false, product: true },
    { code: 'INSPECAO', label: 'Inspeção de qualidade', mode: 'BOTH', rfid: false, product: true },
    { code: 'INVENTARIO', label: 'Inventário físico', mode: 'BOTH', rfid: true, product: true },
    { code: 'AVARIADA', label: 'Identificação de peças avariadas', mode: 'QUANTITY', rfid: true, product: true },
    { code: 'ORGANIZAR_ESTOQUE', label: 'Organização do estoque', mode: 'TIME', rfid: false, product: false },
    { code: 'ORGANIZAR_SETOR', label: 'Organização do setor', mode: 'TIME', rfid: false, product: false },
    { code: 'APOIO', label: 'Apoio operacional', mode: 'TIME', rfid: false, product: false },
    { code: 'OUTRAS', label: 'Outras atividades', mode: 'BOTH', rfid: false, product: false }
  ];
  let activeTab = 'launch';
  let editingId = '';
  let timerId = '';

  const records = () => read(KEY, []);
  const configs = () => read(CONFIG_KEY, defaultTypes);
  const currentUser = () => {
    for (const key of Object.keys(localStorage)) {
      if (!/user|profile|session/i.test(key)) continue;
      try { const x = JSON.parse(localStorage.getItem(key) || 'null'); const name = x?.user?.name || x?.name || x?.full_name; if (name) return String(name); } catch {}
    }
    return 'Usuário logado';
  };
  const typeByCode = code => configs().find(x => x.code === code) || { label: code || '—', mode: 'BOTH' };
  const selectedType = () => document.querySelector('#qa-activity-type')?.value || '';
  const formValue = name => document.querySelector(`[name="${name}"]`)?.value?.trim() || '';
  const selectedDate = () => formValue('date') || today();
  function saveRows(rows) { write(KEY, rows); render(); }
  function metricCards(rows) {
    const m = buildMetrics(rows);
    return `<div class="qa-cards"><article><small>Atividades</small><strong>${br(m.activities)}</strong></article><article><small>Peças apontadas</small><strong>${br(m.pieces)}</strong></article><article><small>Tempo produtivo</small><strong>${br(m.productiveMinutes)} min</strong></article><article><small>Produtividade média</small><strong>${m.productivity ? `${br(m.productivity)} pç/h` : 'Não apurado'}</strong></article><article><small>Pendências</small><strong>${br(m.pending)}</strong></article></div>`;
  }
  function tabs() {
    return `<div class="qa-subtabs">${[['launch','Lançar atividade'],['running','Em andamento'],['history','Histórico'],['pending','Pendências'],['dashboard','Painel gerencial'],['config','Configuração']].map(([key, label]) => `<button type="button" data-qa-inner-tab="${key}" class="${activeTab === key ? 'active' : ''}">${label}</button>`).join('')}</div>`;
  }
  function launchView() {
    const edit = records().find(x => x.id === editingId) || {};
    const type = typeByCode(edit.type || selectedType());
    const mode = type.mode || 'BOTH';
    return `<section class="qa-card"><div class="qa-title"><div><b>${editingId ? 'Corrigir atividade' : 'Lançar atividade'}</b><small>Preencha o que realizou. O estoque não é alterado por este lançamento.</small></div></div><form id="qa-activity-form" class="qa-form"><label>Data<input name="date" type="date" value="${esc(edit.date || today())}" required></label><label>Atividade<select id="qa-activity-type" name="type" required><option value="">Escolha a atividade</option>${configs().filter(x => x.active !== false).map(x => `<option value="${esc(x.code)}" ${edit.type === x.code ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label><label>Produto / peça<input name="product" value="${esc(edit.product)}" placeholder="Quando aplicável"></label><label>Cliente<input name="client" value="${esc(edit.client)}" placeholder="Quando aplicável"></label><label>Quantidade de peças<input name="quantity" type="number" min="0" step="1" value="${esc(edit.quantity || '')}" placeholder="0"></label><label>Início<input name="start" type="time" value="${esc(edit.start || '')}"></label><label>Fim<input name="end" type="time" value="${esc(edit.end || '')}"></label><label>Pausa (min)<input name="pauses" type="number" min="0" step="1" value="${esc(edit.pauses || 0)}"></label><label>Origem<input name="origin" value="${esc(edit.origin)}" placeholder="Ex.: Costura"></label><label>Destino<input name="destination" value="${esc(edit.destination)}" placeholder="Ex.: Estoque"></label><label>RFID / movimentação<input name="rfidEventId" value="${esc(edit.rfidEventId)}" placeholder="Opcional"></label><label class="qa-wide">Observações<textarea name="notes" placeholder="Descreva a atividade ou ocorrência">${esc(edit.notes)}</textarea></label><div class="qa-form-actions"><button type="button" data-qa-start-timer>Iniciar agora</button><button type="submit" class="qa-primary">${editingId ? 'Salvar correção' : 'Registrar atividade'}</button>${editingId ? '<button type="button" data-qa-cancel-edit>Cancelar</button>' : ''}<span class="qa-help">${mode === 'TIME' ? 'Esta atividade exige horário.' : mode === 'QUANTITY' ? 'Informe a quantidade executada.' : 'Pode informar quantidade, tempo ou ambos.'}</span></div></form></section>`;
  }
  function rowsTable(rows, allowEdit = true) {
    if (!rows.length) return '<div class="qa-empty">Nenhum lançamento nesta consulta.</div>';
    return `<div class="qa-table-wrap"><table class="qa-table"><thead><tr><th>Data</th><th>Atividade</th><th>Colaborador</th><th>Quantidade</th><th>Tempo</th><th>Produtividade</th><th>Situação</th><th>Ação</th></tr></thead><tbody>${rows.map(row => { const mins = row.durationMinutes || calculateDuration(row.start, row.end, row.pauses); const rate = productivity(row.quantity, mins); return `<tr><td>${esc(row.date)}</td><td><b>${esc(typeByCode(row.type).label)}</b><small>${esc(row.product || '—')} ${row.rfidEventId ? '• RFID vinculado' : ''}</small></td><td>${esc(row.userName || '—')}</td><td>${br(row.quantity)} pç</td><td>${mins ? `${br(mins)} min` : 'Não informado'}</td><td>${rate ? `${br(rate)} pç/h` : 'Não apurado'}</td><td><span class="qa-status ${row.status === 'CONCLUIDA' ? 'ok' : row.status === 'EM_ANDAMENTO' ? 'running' : 'pending'}">${esc(row.status || 'PENDENTE')}</span></td><td>${allowEdit ? `<button type="button" data-qa-edit="${esc(row.id)}">Editar</button>${row.status === 'EM_ANDAMENTO' ? `<button type="button" data-qa-finish="${esc(row.id)}">Finalizar</button>` : ''}` : '—'}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function runningView() { return `<section class="qa-card"><div class="qa-title"><div><b>Atividades em andamento</b><small>Finalize somente quando a tarefa terminar.</small></div></div>${rowsTable(records().filter(x => x.status === 'EM_ANDAMENTO'))}</section>`; }
  function historyView() { const closed = read('gao-quality-activity-closures-v1', []).find(x => x.date === today()); return `<section class="qa-card"><div class="qa-title"><div><b>Histórico de atividades</b><small>Consulte e corrija com rastreabilidade.</small></div><button type="button" class="qa-primary" data-qa-close-day>${closed ? 'Fechamento enviado' : 'Fechar dia para supervisão'}</button></div><form id="qa-filter-form" class="qa-filters"><label>De<input name="dateFrom" type="date"></label><label>Até<input name="dateTo" type="date"></label><label>Atividade<select name="type"><option value="">Todas</option>${configs().map(x => `<option value="${esc(x.code)}">${esc(x.label)}</option>`).join('')}</select></label><button type="submit" class="qa-primary">Filtrar</button></form><div id="qa-history-results">${rowsTable(records())}</div></section>`; }
  function pendingView() { return `<section class="qa-card"><div class="qa-title"><div><b>Pendências operacionais</b><small>Atividades iniciadas ou lançamentos sem conclusão.</small></div></div>${rowsTable(records().filter(x => ['PENDENTE', 'EM_ANDAMENTO'].includes(x.status)))}</section>`; }
  function dashboardView() { const rows = records().filter(x => x.status === 'CONCLUIDA'); const m = buildMetrics(rows); const byType = configs().map(t => [t, rows.filter(x => x.type === t.code)]).filter(([, list]) => list.length); return `<section class="qa-card"><div class="qa-title"><div><b>Painel gerencial</b><small>Somente lançamentos concluídos e dados reais.</small></div><span class="qa-date-badge">Atualizado agora</span></div><form id="qa-dashboard-filter" class="qa-filters"><label>De<input name="dateFrom" type="date"></label><label>Até<input name="dateTo" type="date"></label><label>Colaborador<input name="userId" placeholder="Nome"></label><button type="submit" class="qa-primary">Aplicar filtros</button></form><div id="qa-dashboard-results">${metricCards(rows)}<div class="qa-two"><div><h3>Volume por atividade</h3>${byType.length ? `<table class="qa-table"><thead><tr><th>Atividade</th><th>Peças</th><th>Tempo</th><th>Produtividade</th></tr></thead><tbody>${byType.map(([t, list]) => { const x = buildMetrics(list); return `<tr><td>${esc(t.label)}</td><td>${br(x.pieces)}</td><td>${br(x.productiveMinutes)} min</td><td>${x.productivity ? `${br(x.productivity)} pç/h` : 'Não apurado'}</td></tr>`; }).join('')}</tbody></table>` : '<div class="qa-empty">Não apurado. Ainda não há atividades concluídas.</div>'}</div><div><h3>Últimos lançamentos</h3>${rowsTable(rows.slice(-8).reverse(), false)}</div></div></div></section>`; }
  function configView() { return `<section class="qa-card"><div class="qa-title"><div><b>Configuração de atividades</b><small>Somente administradores devem alterar esta lista.</small></div></div><div class="qa-table-wrap"><table class="qa-table"><thead><tr><th>Atividade</th><th>Apontamento</th><th>RFID</th><th>Produto</th><th>Situação</th></tr></thead><tbody>${configs().map(x => `<tr><td><b>${esc(x.label)}</b><small>${esc(x.code)}</small></td><td>${x.mode === 'QUANTITY' ? 'Quantidade' : x.mode === 'TIME' ? 'Tempo' : 'Quantidade + tempo'}</td><td>${x.rfid ? 'Sim' : 'Não'}</td><td>${x.product ? 'Sim' : 'Não'}</td><td>${x.active === false ? 'Inativa' : 'Ativa'}</td></tr>`).join('')}</tbody></table></div></section>`; }
  function moduleMarkup() { const all = records(); return `<div class="qa-activity-module"><div class="qa-module-head"><div><div class="qa-eyebrow">GESTÃO DE ENXOVAL</div><h2>Controle de atividades</h2><p>Lance, finalize e acompanhe o trabalho do auxiliar de enxoval.</p></div><div class="qa-head-summary">${all.filter(x => x.status === 'EM_ANDAMENTO').length} em andamento</div></div>${tabs()}${activeTab === 'launch' ? launchView() : activeTab === 'running' ? runningView() : activeTab === 'history' ? historyView() : activeTab === 'pending' ? pendingView() : activeTab === 'dashboard' ? dashboardView() : configView()}</div>`; }
  function ensureTab() {
    const root = document.getElementById('q142');
    const nav = root?.querySelector('.q142-tabs');
    if (!root || !nav) return;
    if (nav.dataset.qaRestoreBound !== '1') {
      nav.dataset.qaRestoreBound = '1';
      nav.addEventListener('click', event => {
        const qualityTab = event.target.closest?.('[data-tab]');
        if (!qualityTab) return;
        setTimeout(() => {
          const current = document.getElementById('q142');
          current?.classList.remove('qa-activity-mode');
          current?.querySelector('.qa-activity-module')?.remove();
        }, 0);
      });
    }
    if (!nav.querySelector('[data-qa-main-tab]')) nav.insertAdjacentHTML('beforeend', '<button type="button" data-qa-main-tab="1" class="qa-main-tab">Controle de atividades</button>');
    const button = nav.querySelector('[data-qa-main-tab]');
    const visible = root.querySelector('.qa-activity-module');
    if (!visible && button.dataset.bound !== '1') { button.dataset.bound = '1'; button.addEventListener('click', () => show()); }
  }
  function show() { const root = document.getElementById('q142'); if (!root) return; root.classList.remove('qa-activity-mode'); root.querySelectorAll('.q142-tabs > button').forEach(x => x.classList.toggle('active', x.hasAttribute('data-qa-main-tab'))); let host = root.querySelector('.qa-activity-host'); if (!host) { host = document.createElement('div'); host.className = 'qa-activity-host'; root.appendChild(host); } host.innerHTML = moduleMarkup(); bind(host); }
  function restoreQuality() { document.querySelector('#q142 [data-tab="executive"]')?.click(); }
  function render() { if (document.getElementById('q142')?.querySelector('[data-qa-main-tab]')) show(); }
  function bind(host) {
    host.querySelectorAll('[data-qa-inner-tab]').forEach(button => button.addEventListener('click', () => { activeTab = button.dataset.qaInnerTab; render(); }));
    host.querySelector('[data-qa-cancel-edit]')?.addEventListener('click', () => { editingId = ''; activeTab = 'launch'; render(); });
    host.querySelector('[data-qa-start-timer]')?.addEventListener('click', () => { const input = host.querySelector('[name="start"]'); const end = host.querySelector('[name="end"]'); if (input) input.value = nowTime(); if (end) end.value = ''; if (input) input.dispatchEvent(new Event('input', { bubbles: true })); });
    host.querySelector('#qa-activity-form')?.addEventListener('submit', submitActivity);
    host.querySelectorAll('[data-qa-edit]').forEach(button => button.addEventListener('click', () => { editingId = button.dataset.qaEdit; activeTab = 'launch'; render(); }));
    host.querySelectorAll('[data-qa-finish]').forEach(button => button.addEventListener('click', () => finish(button.dataset.qaFinish)));
    host.querySelector('#qa-filter-form')?.addEventListener('submit', e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); host.querySelector('#qa-history-results').innerHTML = rowsTable(filterActivities(records(), f)); });
    host.querySelector('#qa-dashboard-filter')?.addEventListener('submit', e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.currentTarget)); const rows = filterActivities(records(), f).filter(x => x.status === 'CONCLUIDA'); host.querySelector('#qa-dashboard-results').innerHTML = metricCards(rows) + `<div class="qa-empty">Filtros aplicados: ${rows.length} lançamento(s) concluído(s).</div>`; });
    host.querySelector('[data-qa-close-day]')?.addEventListener('click', () => { const rows = records().filter(x => x.date === today()); if (!rows.length) return alert('Não há atividades para fechar hoje.'); const closes = read('gao-quality-activity-closures-v1', []); if (!closes.some(x => x.date === today())) { closes.push({ date: today(), user: currentUser(), at: new Date().toISOString(), activities: rows.length, status: 'AGUARDANDO_SUPERVISAO' }); write('gao-quality-activity-closures-v1', closes); } render(); });
  }
  function submitActivity(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const type = typeByCode(data.type);
    const duration = calculateDuration(data.start, data.end, data.pauses);
    if (type.mode === 'TIME' && !duration && !editingId) return alert('Informe início e fim válidos para esta atividade.');
    if (type.mode === 'QUANTITY' && Number(data.quantity || 0) <= 0) return alert('Informe a quantidade de peças executadas.');
    if (data.end && data.start && !duration) return alert('O horário final precisa ser posterior ao horário inicial.');
    const list = records();
    const id = editingId || uid();
    const candidate = { id, date: data.date || today(), userId: currentUser(), userName: currentUser(), unit: data.unit || 'GAO', type: data.type, product: data.product, client: data.client, quantity: Number(data.quantity || 0), start: data.start, end: data.end, pauses: Number(data.pauses || 0), durationMinutes: duration || 0, origin: data.origin, destination: data.destination, rfidEventId: data.rfidEventId, notes: data.notes, status: data.start && !data.end ? 'EM_ANDAMENTO' : 'CONCLUIDA', createdAt: list.find(x => x.id === id)?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), audit: [...(list.find(x => x.id === id)?.audit || []), { at: new Date().toISOString(), by: currentUser(), action: editingId ? 'CORREÇÃO' : 'CRIAÇÃO' }] };
    const others = list.filter(x => x.id !== id);
    if (isDuplicateActivity(candidate, others)) return alert('Este lançamento já existe ou o evento RFID já foi utilizado.');
    write(KEY, [candidate, ...others]);
    editingId = '';
    activeTab = candidate.status === 'EM_ANDAMENTO' ? 'running' : 'history';
    render();
  }
  function finish(id) { const list = records(); const row = list.find(x => x.id === id); if (!row) return; const end = nowTime(); const duration = calculateDuration(row.start, end, row.pauses); if (!duration) return alert('Não foi possível finalizar: confira o horário inicial.'); row.end = end; row.durationMinutes = duration; row.status = 'CONCLUIDA'; row.updatedAt = new Date().toISOString(); row.audit = [...(row.audit || []), { at: new Date().toISOString(), by: currentUser(), action: 'FINALIZAÇÃO' }]; write(KEY, list); render(); }
  function boot() { const root = document.getElementById('q142'); if (root) ensureTab(); }
  const css = document.createElement('style'); css.textContent = `.qa-main-tab{margin-left:auto!important;background:#0f5f9c!important;color:#fff!important;border-color:#0f5f9c!important}.qa-activity-module{font-family:inherit;color:#082f55}.qa-module-head{display:flex;justify-content:space-between;align-items:center;gap:14px;background:#eef7ff;border:1px solid #c9e0f2;border-radius:12px;padding:16px;margin:12px 0}.qa-eyebrow{font-size:11px;font-weight:900;letter-spacing:.16em;color:#1767a2}.qa-module-head h2{margin:4px 0;font-size:25px}.qa-module-head p{margin:0;color:#54708e}.qa-head-summary,.qa-date-badge{background:#0f5f9c;color:#fff;padding:10px 12px;border-radius:9px;font-weight:900;white-space:nowrap}.qa-subtabs{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.qa-subtabs button{border:1px solid #bdd4e7;background:#fff;color:#17476f;border-radius:8px;padding:9px 12px;font-weight:850;cursor:pointer}.qa-subtabs button.active{background:#3188cc;color:#fff;border-color:#3188cc}.qa-card{background:#fff;border:1px solid #cfdfeb;border-radius:12px;padding:15px;margin-bottom:12px;box-shadow:0 8px 24px rgba(22,59,92,.05)}.qa-title{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px}.qa-title b{font-size:16px;display:block}.qa-title small{display:block;color:#54708e;margin-top:4px}.qa-form{display:grid;grid-template-columns:repeat(4,minmax(150px,1fr));gap:10px}.qa-form label,.qa-filters label{font-size:12px;font-weight:850;color:#54708e}.qa-form input,.qa-form select,.qa-form textarea,.qa-filters input,.qa-filters select{display:block;width:100%;box-sizing:border-box;margin-top:4px;border:1px solid #bdd4e7;border-radius:8px;padding:9px;color:#082f55;background:#fff}.qa-form textarea{min-height:74px;resize:vertical}.qa-wide{grid-column:1/-1}.qa-form-actions{grid-column:1/-1;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.qa-form-actions button,.qa-table button,.qa-filters button{border:1px solid #bdd4e7;background:#fff;color:#17476f;border-radius:7px;padding:8px 11px;font-weight:850;cursor:pointer}.qa-primary{background:#3188cc!important;color:#fff!important;border-color:#3188cc!important}.qa-help{color:#54708e;font-size:12px}.qa-filters{display:flex;align-items:end;gap:9px;flex-wrap:wrap;border-bottom:1px solid #e5edf4;padding-bottom:12px;margin-bottom:12px}.qa-filters label{min-width:160px}.qa-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:9px;margin-bottom:14px}.qa-cards article{border:1px solid #d4e3ee;border-top:3px solid #3188cc;border-radius:9px;padding:11px;background:#fbfdff}.qa-cards small{display:block;color:#54708e}.qa-cards strong{display:block;font-size:20px;color:#082f55;margin-top:5px}.qa-table-wrap{overflow:auto}.qa-table{width:100%;border-collapse:collapse;min-width:880px;font-size:12px}.qa-table th{background:#1d527e;color:#fff;text-align:left;padding:9px}.qa-table td{padding:8px;border-bottom:1px solid #e0ebf3;vertical-align:top}.qa-table td small{display:block;color:#718aa0;margin-top:3px}.qa-table button{margin-right:5px;padding:5px 8px}.qa-status{display:inline-flex;border-radius:999px;padding:4px 8px;font-weight:900}.qa-status.ok{background:#e6f6ed;color:#157a48}.qa-status.running{background:#fff3d6;color:#935b00}.qa-status.pending{background:#ffe5e5;color:#b42318}.qa-empty{padding:18px;border:1px dashed #b8d1e5;border-radius:9px;background:#f7fbff;color:#54708e;text-align:center}.qa-two{display:grid;grid-template-columns:1fr 1fr;gap:14px}.qa-two h3{font-size:15px}@media(max-width:900px){.qa-form{grid-template-columns:repeat(2,minmax(140px,1fr));.qa-cards{grid-template-columns:repeat(2,1fr)}}@media(max-width:620px){.qa-module-head{display:block}.qa-head-summary{display:inline-block;margin-top:10px}.qa-form{grid-template-columns:1fr}.qa-cards,.qa-two{grid-template-columns:1fr}.qa-filters label{width:100%}}`; document.head.appendChild(css);
  const modeCss = document.createElement('style'); modeCss.textContent = '#q142:has(.qa-activity-module) > *:not(.q142-head):not(.q142-tabs):not(.qa-activity-host){display:none!important}'; document.head.appendChild(modeCss);
  const observer = new MutationObserver(() => { if (document.getElementById('q142')) ensureTab(); });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', event => {
    const originalTab = event.target.closest?.('#q142 .q142-tabs [data-tab]');
    if (!originalTab) return;
    const root = document.getElementById('q142');
    root?.classList.remove('qa-activity-mode');
    root?.querySelector('.qa-activity-module')?.remove();
  }, true);
  setInterval(() => {
    const root = document.getElementById('q142');
    if (!root || root.querySelector('.qa-activity-module')) return;
    root.classList.remove('qa-activity-mode');
  }, 250);
  setTimeout(boot, 500);
  window.GAOQualityActivities = { mount: show, calculateDuration, productivity, isDuplicateActivity, listRecords: filterActivities, buildMetrics };
})();
