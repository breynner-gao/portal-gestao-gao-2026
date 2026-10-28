import { applyFactionToRows, buildFactionMap, listDecisionItems, listMovementItems, parseDelimitedRows, sortOrderItems, summarizeDimensioning, summarizeRows, updateIdealReference } from './linen-risk-rules-v150.mjs?v=222';

const DATA = '/assets/linen-rfid-report-2026-10-13.json';
const FACTION_DATA = '/assets/linen-production-pending-2026-10-13.json';
const ONLINE_FACTION = 'https://docs.google.com/spreadsheets/d/1a8DJIkoxqbzNCz8O1BHmBEJFUpIukhILclCk5sv53i0/export?format=xlsx';
const HISTORY_KEY = 'gao-linen-history-v1';
const CURRENT_KEY = 'gao-linen-current-v1';
const route = () => location.pathname.replace(/\/+$/, '') === '/enxoval-tecidos';
const br = (v, d = 0) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: d });
const dateBr = value => {
  if (!value) return '';
  const parts = String(value).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(value);
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
let state = {
  loaded: false,
  error: '',
  baseRows: [],
  rows: [],
  asOf: '',
  informedAt: '',
  sourceSheet: '',
  sourceRule: '',
  fileName: 'relatorio-geral enxoval 21.xlsx',
  uploadMessage: '',
  itemFilter: '',
  masterCategoryFilter: [],
  subCategoryFilter: [],
  riskFilter: [],
  pointFilter: [],
  exchangeFilter: '',
  referenceFilter: [],
  indicationFilter: [],
  qtyFilter: '',
  factionFilter: '',
  realOrderFilter: '',
  itemSort: 'pedido',
  dimensionView: 'dashboard',
  orderListOpen: true,
  movementListOpen: true,
  movementDirection: 'supply',
  openFilter: '',
  factionMap: {},
  factionSource: ''
};

function readHistory() { try { const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); const seen = new Set(); return raw.filter(item => { const key = `${item.asOf}|${item.label}|${item.estoque}|${item.pedidoReal}|${item.faccao}`; if (seen.has(key)) return false; seen.add(key); return true; }); } catch { return []; } }
function readCurrent() { try { return JSON.parse(localStorage.getItem(CURRENT_KEY) || 'null'); } catch { return null; } }
function saveCurrent() { try { localStorage.setItem(CURRENT_KEY, JSON.stringify({ baseRows: state.baseRows, factionMap: state.factionMap, rows: state.rows, asOf: state.asOf, informedAt: state.informedAt, sourceSheet: state.sourceSheet, sourceRule: state.sourceRule, fileName: state.fileName, factionSource: state.factionSource })); } catch {} }
function snapshot(label = state.fileName) {
  const s = summary(); const t = sourceTotals();
  return { id: `${Date.now()}`, label, asOf: state.asOf || new Date().toISOString().slice(0, 10), informedAt: state.informedAt || state.asOf, source: state.factionSource || '', total: s.total, red: s.red, yellow: s.yellow, pedido: s.pedido, pedidoReal: s.pedidoReal, faccao: s.faccao, estoque: t.total, supply: listMovementItems(state.rows).filter(x=>x.direcao==='supply').reduce((a,x)=>a+x.quantidade,0), returns: listMovementItems(state.rows).filter(x=>x.direcao==='return').reduce((a,x)=>a+x.quantidade,0) };
}
function saveHistory() { const item = snapshot(); const old = readHistory(); localStorage.setItem(HISTORY_KEY, JSON.stringify([item, ...old].slice(0, 24))); }
function resetCurrentBase() { localStorage.removeItem(CURRENT_KEY); location.reload(); }
function editIdealReference(event) {
  const input = event.currentTarget;
  const produtoId = input.dataset.produtoId || '';
  const produtoNome = input.dataset.produtoNome || '';
  const value = Number(String(input.value || '').replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0 || value > 99) {
    input.value = input.dataset.previousValue || '';
    return;
  }
  const matches = row => (produtoId && row.produtoId === produtoId) || (!produtoId && row.produtoNome === produtoNome);
  const update = row => matches(row) ? updateIdealReference(row, value) : row;
  state = {
    ...state,
    baseRows: state.baseRows.map(update),
    rows: state.rows.map(update),
    uploadMessage: `Troca ideal de ${produtoNome} ajustada para ${br(value, 1)}. Necessidade, movimentação e pedido foram recalculados.`
  };
  saveCurrent();
  render();
}
function deleteSelectedHistory() { const id = document.querySelector('#lr150-history-select')?.value; if (!id) return; const next = readHistory().filter(item => item.id !== id); localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); render(); }
function deleteAllHistory() { localStorage.removeItem(HISTORY_KEY); render(); }
async function fetchOnlineFaction() {
  try {
    if (!window.XLSX) throw Error('Leitor Excel indisponível');
    const buffer = await fetch(ONLINE_FACTION, { cache: 'no-store' }).then(r => { if (!r.ok) throw Error(`HTTP ${r.status}`); return r.arrayBuffer(); });
    const book = window.XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheetName = book.SheetNames.find(name => /base|produção|producao/i.test(name)) || book.SheetNames[0];
    const sheet = book.Sheets[sheetName];
    const matrix = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    const headerIndex = matrix.findIndex(row => row.some(cell => String(cell || '').trim().toUpperCase() === 'PRODUTO'));
    if (headerIndex < 0) throw Error('cabeçalho PRODUTO não encontrado');
    const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, range: headerIndex });
    const statusOf = row => String(row.Status ?? row.status ?? row.STATUS ?? row['Status da produção'] ?? row['Situação'] ?? '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '');
    const pending = rows.filter(row => !['CONCLUIDO','CONCLUDO','CONCLUIDA','CONCLUDA','FINALIZADO','ENTREGUE','PRODUZIDO','ENCERRADO','CANCELADO'].includes(statusOf(row)));
    const statusSummary = [...new Set(rows.map(statusOf).filter(Boolean))].join(', ');
    if (!pending.length) throw Error(`nenhum pendente encontrado; status lidos: ${statusSummary || 'vazio'}`);
    applyUploadedFaction(pending, 'controle produção facção');
    state = { ...state, uploadMessage: `${pending.length} linhas pendentes lidas da planilha online; status: ${statusSummary}; facção atualizada sem concluídos.` };
    saveHistory();
    render();
  } catch (e) { state = { ...state, uploadMessage: `Facção online não atualizada: ${e.message || e}` }; render(); }
}

async function load() {
  if (state.loaded || state.error) return;
  try {
    const [data, faction] = await Promise.all([
      fetch(DATA).then(r => {
        if (!r.ok) throw Error(`HTTP ${r.status}`);
        return r.json();
      }),
      fetch(FACTION_DATA).then(r => r.ok ? r.json() : null).catch(() => null)
    ]);
    const current = readCurrent();
    const summary = current?.baseRows?.length ? { rows: current.baseRows } : summarizeRows(data.rows || []);
    // A facção oficial vem exclusivamente da planilha online atual.
    // A base estática antiga não pode reintroduzir peças já concluídas.
    const activeFactionMap = {};
    state = {
      ...state,
      loaded: true,
      baseRows: summary.rows,
      rows: applyFactionToRows(summary.rows, activeFactionMap),
      asOf: current?.asOf || data.asOf || '',
      informedAt: current?.informedAt || data.informedAt || data.asOf || '',
      sourceSheet: current?.sourceSheet || data.sheet || '',
      sourceRule: current?.sourceRule || data.rule || '',
      fileName: current?.fileName || data.source || state.fileName,
      factionMap: activeFactionMap,
      factionSource: current?.factionSource || faction?.source || 'Base incorporada do controle de produção'
    };
    saveCurrent();
    saveHistory();
    fetchOnlineFaction();
  } catch (e) {
    state = { ...state, error: e.message || String(e) };
  }
}

function summary() {
  const dimensioning = summarizeDimensioning(state.rows);
  return {
    ...dimensioning.totals,
    total: dimensioning.totals.totalItens,
    red: dimensioning.totals.criticos,
    yellow: dimensioning.totals.atencao,
    green: state.rows.filter(row => row.criticidade === 'verde').length,
    buy: dimensioning.criticalItems.filter(row => /Compra|Comprar|Repor/.test(row.condutaDimensionamento)).length,
    pedido: dimensioning.totals.compraSugerida,
    faccao: dimensioning.totals.pecasFaccao,
    pedidoReal: dimensioning.totals.pedidoReal,
    criticalItems: dimensioning.criticalItems,
    classRows: dimensioning.classRows
  };
}

function sourceTotals() {
  const totals = state.rows.reduce((acc, row) => {
    acc.cliente += row.estoqueCliente;
    acc.area += row.areaCritica;
    acc.mercado += row.mercado;
    acc.deposito += row.estoqueGao ?? row.deposito;
    acc.processo += row.estoqueProcesso ?? (row.relave + row.qualidade + row.desengoma);
    acc.descarte += row.estoqueBloqueado;
    return acc;
  }, { cliente: 0, area: 0, mercado: 0, deposito: 0, processo: 0, descarte: 0 });
  totals.total = totals.cliente + totals.area + totals.mercado + totals.deposito + totals.processo;
  return totals;
}

function classRows() {
  return summarizeDimensioning(state.rows).classRows.slice(0, 6);
}

function categoryOptions() {
  return [...new Set(state.rows.map(row => row.categoriaOficial).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function subcategoryOptions() {
  return [...new Set(state.rows
    .filter(row => !state.masterCategoryFilter.length || state.masterCategoryFilter.includes(row.categoriaOficial))
    .map(row => row.subcategoriaTroca)
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

const uniqueOptions = key => [...new Set(state.rows.map(row => row[key]).filter(value => value !== undefined && value !== null && value !== ''))]
  .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true }));

const uniqueOptionsFrom = (rows, key) => [...new Set((rows || []).map(row => row[key]).filter(value => value !== undefined && value !== null && value !== ''))]
  .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true }));

function exchangeText(row) {
  return `Cli+AC ${br(row.trocasClienteArea, 1)} • Merc ${br(row.trocasMercado, 1)} • GAO ${br(row.trocasDeposito, 1)}`;
}

function filterSelect(id, options, selected, all = 'Todas') {
  return `<select id="${id}" class="lr150-control"><option value="">${all}</option>${options.map(option => `<option value="${esc(option)}" ${String(selected) === String(option) ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select>`;
}

function multiFilter(id, options, selected, all = 'Todas') {
  const values = Array.isArray(selected) ? selected : (selected ? [selected] : []);
  const label = values.length ? `${values.length} sel.` : all;
  return `<details class="lr150-multi" data-filter="${id}" ${state.openFilter === id ? 'open' : ''}>
    <summary>${esc(label)}</summary>
    <div>${options.map(option => `<label><input type="checkbox" value="${esc(option)}" ${values.includes(option) ? 'checked' : ''}>${esc(option)}</label>`).join('')}</div>
  </details>`;
}

function filterInput(id, value, placeholder, type = 'search') {
  return `<input id="${id}" class="lr150-control" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}">`;
}

function sortHeader(label, value) {
  const active = state.itemSort === value;
  return `<button type="button" class="lr150-th-sort ${active ? 'active' : ''}" data-sort="${esc(value)}"><span>${esc(label)}</span><i>${active ? '↓' : '↕'}</i></button>`;
}

function applyUploadedRows(rows, fileName) {
  const summary = summarizeRows(rows);
  if (!summary.rows.length) {
    state = { ...state, uploadMessage: 'Não encontrei linhas válidas com média diária nessa planilha.' };
    render();
    return;
  }
  const detectedFactionRows = rows.filter(row => row && (row.PRODUTO || row.produto || row.Produto) && (row.QUANTIDADE !== undefined || row.quantidade !== undefined) && (row.Status !== undefined || row.status !== undefined));
  const detectedFactionMap = detectedFactionRows.length ? buildFactionMap(detectedFactionRows) : {};
  const factionMap = Object.keys(detectedFactionMap).length ? { ...state.factionMap, ...detectedFactionMap } : state.factionMap;
  state = {
    ...state,
    loaded: true,
    baseRows: summary.rows,
    rows: applyFactionToRows(summary.rows, factionMap || {}),
    fileName,
    asOf: new Date().toISOString().slice(0, 10),
    informedAt: new Date().toISOString().slice(0, 10),
    sourceSheet: 'Arquivo importado',
    sourceRule: 'Base importada pelo usuário nesta sessão.',
    factionMap,
    factionSource: detectedFactionRows.length ? `${fileName} — facção detectada automaticamente` : state.factionSource,
    uploadMessage: `${summary.rows.length} itens carregados de ${fileName}.${detectedFactionRows.length ? ` Facção detectada: ${br(Object.values(detectedFactionMap).reduce((a, b) => a + Number(b || 0), 0))} pç pendentes.` : ''}`
  };
  saveHistory();
  saveCurrent();
  render();
  fetchOnlineFaction();
}

function readRfidFile(file) {
  if (!file) return;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return readExcelFile(file, 'rfid');
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || '');
      const rows = lower.endsWith('.json') ? JSON.parse(text).rows || JSON.parse(text) : parseDelimitedRows(text);
      applyUploadedRows(Array.isArray(rows) ? rows : [], file.name);
    } catch (e) {
      state = { ...state, uploadMessage: `Não consegui ler o arquivo: ${e.message || e}` };
      render();
    }
  };
  reader.readAsText(file, 'utf-8');
}

function readExcelFile(file, kind) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      if (!window.XLSX) throw Error('Leitor Excel indisponível');
      const book = window.XLSX.read(reader.result, { type: 'array', cellDates: true });
      const sheetName = kind === 'faction' ? (book.SheetNames.find(name => /base|produção|producao/i.test(name)) || book.SheetNames[0]) : book.SheetNames[0];
      const sheet = book.Sheets[sheetName];
      const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
      if (kind === 'faction') applyUploadedFaction(rows, file.name);
      else applyUploadedRows(rows, file.name);
    } catch (e) {
      state = { ...state, uploadMessage: `Não consegui ler o Excel: ${e.message || e}` };
      render();
    }
  };
  reader.readAsArrayBuffer(file);
}

function applyUploadedFaction(rows, fileName) {
  const map = buildFactionMap(rows);
  const total = Object.values(map).reduce((sum, value) => sum + Number(value || 0), 0);
  state = {
    ...state,
    rows: applyFactionToRows(state.baseRows, map),
    factionMap: map,
    factionSource: fileName,
    uploadMessage: `${Object.keys(map).length} itens de facção carregados de ${fileName}. ${br(total)} pç pendentes consideradas.`
  };
  saveHistory();
  saveCurrent();
  render();
}

function readFactionFile(file) {
  if (!file) return;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return readExcelFile(file, 'faction');
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result || '');
      const parsed = lower.endsWith('.json') ? JSON.parse(text) : parseDelimitedRows(text);
      const rows = Array.isArray(parsed) ? parsed : (parsed.items || parsed.rows || []);
      if (parsed.byProduct && !rows.length) {
        state = {
          ...state,
          rows: applyFactionToRows(state.baseRows, parsed.byProduct),
          factionMap: parsed.byProduct,
          factionSource: file.name,
          uploadMessage: `Status de facção carregado de ${file.name}.`
        };
        render();
        return;
      }
      applyUploadedFaction(rows, file.name);
    } catch (e) {
      state = { ...state, uploadMessage: `Não consegui ler a facção: ${e.message || e}` };
      render();
    }
  };
  reader.readAsText(file, 'utf-8');
}

function filteredDecisionItems() {
  const itemNeedle = state.itemFilter.trim().toLowerCase();
  const exchangeNeedle = state.exchangeFilter.trim().toLowerCase();
  return state.rows
    .filter(row => !itemNeedle || `${row.produtoNome || ''} ${row.produtoId || ''} ${row.leituraOperacional || ''}`.toLowerCase().includes(itemNeedle))
    .filter(row => !state.masterCategoryFilter.length || state.masterCategoryFilter.includes(row.categoriaOficial))
    .filter(row => !state.subCategoryFilter.length || state.subCategoryFilter.includes(row.subcategoriaTroca))
    .filter(row => !state.riskFilter.length || state.riskFilter.includes(row.criticidade))
    .filter(row => !state.pointFilter.length || state.pointFilter.includes(row.pontoCritico))
    .filter(row => !exchangeNeedle || exchangeText(row).toLowerCase().includes(exchangeNeedle))
    .filter(row => !state.referenceFilter.length || state.referenceFilter.includes(String(row.trocasIdeais)))
    .filter(row => !state.indicationFilter.length || state.indicationFilter.includes(row.condutaDimensionamento))
    .filter(row => !state.qtyFilter || row.compraSugerida >= Number(state.qtyFilter))
    .filter(row => !state.factionFilter || row.pecasFaccao >= Number(state.factionFilter))
    .filter(row => !state.realOrderFilter || row.pedidoReal >= Number(state.realOrderFilter));
}

function downloadItemReport() {
  const rows = sortOrderItems(listDecisionItems(filteredDecisionItems()), state.itemSort);
  if (!rows.length) return;
  const header = ['Item', 'Categoria', 'Criticidade', 'Cliente', 'Area critica', 'Mercado', 'Estoque GAO', 'Relave', 'Qualidade', 'Desengoma', 'Costura avaliacao', 'Total util', 'Trocas cliente + AC', 'Trocas mercado', 'Trocas GAO', 'Trocas total', 'Necessidade', 'Faccao', 'Pedido real'];
  const csv = [header, ...rows.map(row => [row.produtoNome, row.categoria, row.criticidade, row.cliente, row.areaCritica, row.mercado, row.estoqueGao, row.relave, row.qualidade, row.desengoma, row.costura, row.totalUtil, row.trocasClienteArea, row.trocasMercado, row.trocasGao, row.trocasTotal, row.necessidade, row.faccao, row.pedidoReal])]
    .map(line => line.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mapa-enxoval-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadMovementReport() {
  const rows = listMovementItems(state.rows).filter(row => row.direcao === state.movementDirection);
  if (!rows.length) return;
  const header = ['Item', 'Categoria', 'Subcategoria', 'Origem', 'Destino', 'Quantidade sugerida', 'Consumo medio diario', 'Circulacao sem deposito', 'Trocas sem deposito', 'Trocas ideais', 'Meta circulacao em pecas', 'Excedente circulacao', 'Tolerancia retirada', 'Mercado atual', 'Estoque GAO atual'];
  const csv = [header, ...rows.map(row => [row.produtoNome, row.categoria, row.subcategoria, row.origem, row.destino, row.quantidade, row.mediaDiaria, row.estoqueCirculacao, row.trocasCirculacao, row.trocasIdeal, row.metaCirculacao, row.excedenteCirculacao, row.direcao === 'return' ? 30 : 0, row.mercadoAtual, row.deposito])]
    .map(line => line.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.movementDirection === 'supply' ? 'abastecer-mercado' : 'retirar-excedente'}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function dashboardView(s, totals, movementItems, asOf) {
  const supply = movementItems.filter(row => row.direcao === 'supply').reduce((sum, row) => sum + row.quantidade, 0);
  const returns = movementItems.filter(row => row.direcao === 'return').reduce((sum, row) => sum + row.quantidade, 0);
  const maxOrder = Math.max(...(s.criticalItems || []).map(row => row.pedidoReal || 0), 1);
  const critical = (s.criticalItems || []).slice(0, 5);
  const pct = (value, total) => `${Math.max(0, Math.min(100, total ? value / total * 100 : 0)).toFixed(2)}%`;
  return `<div class="lr150-dashboard">
    <div class="lr150-dashboard-head"><div><b>Painel de gestão à vista</b><small>Leitura executiva da base de ${esc(asOf || 'data não informada')}</small></div><span class="lr150-dashboard-source">${br(s.total)} itens analisados</span></div>
    <div class="lr150-dashboard-cards">
      <div class="lr150-dash-card"><small>Pedido real</small><strong>${br(s.pedidoReal)} <em>pç</em></strong><span>após facção</span></div>
      <div class="lr150-dash-card"><small>Levar ao mercado</small><strong>${br(supply)} <em>pç</em></strong><span>Depósito GAO → Mercado</span></div>
      <div class="lr150-dash-card"><small>Retirar excedente</small><strong>${br(returns)} <em>pç</em></strong><span>Mercado → Depósito</span></div>
      <div class="lr150-dash-card"><small>Itens críticos</small><strong>${br(s.red)}</strong><span>${br(s.yellow)} em atenção</span></div>
    </div>
    <div class="lr150-dash-grid">
      <section class="lr150-dash-panel"><div class="lr150-dash-title"><b>Visão geral da criticidade</b><span>${br(s.total)} itens</span></div><div class="lr150-crit-track"><i style="width:${pct(s.red,s.total)};background:#dc2626"></i><i style="width:${pct(s.yellow,s.total)};background:#e4b32e"></i><i style="width:${pct(s.green,s.total)};background:#2b9a67"></i></div><div class="lr150-crit-legend"><span><i style="background:#dc2626"></i>${br(s.red)} críticos</span><span><i style="background:#e4b32e"></i>${br(s.yellow)} atenção</span><span><i style="background:#2b9a67"></i>${br(s.green)} verde</span></div><p class="lr150-dash-note">A ordem de análise começa pelos críticos, depois atenção e, por fim, os itens verdes.</p></section>
      <section class="lr150-dash-panel"><div class="lr150-dash-title"><b>Onde está o estoque</b><span>${br(totals.total)} pç úteis</span></div><div class="lr150-stock-lines"><span><label>Cliente + área crítica</label><b>${br(totals.cliente + totals.area)}</b><i><em style="width:${pct(totals.cliente + totals.area, totals.total)}"></em></i></span><span><label>Mercado</label><b>${br(totals.mercado)}</b><i><em style="width:${pct(totals.mercado, totals.total)}"></em></i></span><span><label>Depósito GAO</label><b>${br(totals.deposito)}</b><i><em style="width:${pct(totals.deposito, totals.total)}"></em></i></span><span><label>Processo</label><b>${br(totals.processo)}</b><i><em style="width:${pct(totals.processo, totals.total)}"></em></i></span></div></section>
    </div>
    <div class="lr150-dash-grid">
      <section class="lr150-dash-panel"><div class="lr150-dash-title"><div><b>Críticos: o que tratar primeiro</b><small>Pedido real por item</small></div><button type="button" data-dimension-view="map">Abrir mapa completo →</button></div>${critical.length ? critical.map(row => `<div class="lr150-critical-row"><span><b>${esc(row.produtoNome)}</b><small>${br(row.trocasTotais,1)} trocas atuais · ideal ${br(row.trocaReferencia,1)}</small></span><strong>${br(row.pedidoReal)} pç</strong><i><em style="width:${Math.max(4, Math.min(100, (row.pedidoReal || 0) / maxOrder * 100))}%"></em></i></div>`).join('') : '<p class="lr150-dash-note">Nenhum item crítico na base atual.</p>'}</section>
      <section class="lr150-dash-panel"><div class="lr150-dash-title"><div><b>Movimentações sugeridas</b><small>Fluxos calculados pela regra aprovada</small></div><button type="button" data-dimension-view="movements">Abrir movimentação →</button></div><div class="lr150-flow"><span><b>GAO → Mercado</b><strong>${br(supply)} pç</strong><small>abastecimento</small></span><span><b>Mercado → GAO</b><strong>${br(returns)} pç</strong><small>excedente menos 30</small></span></div><p class="lr150-dash-note">A retirada deve preservar a reserva de consumo definida na tela operacional.</p></section>
    </div>
    <div class="lr150-history-box"><div><b>Histórico de posições</b><small>Cada importação fica registrada com data, estoque central e decisão de movimentação.</small></div>${readHistory().slice(0,6).map(h => `<span><strong>${esc(dateBr(h.asOf))}</strong><small>${esc(h.label)}</small><em>${br(h.estoque)} pç úteis · ${br(h.pedidoReal)} pç pedido · ${br(h.supply)} pç GAO→Mercado</em></span>`).join('') || '<p>Nenhuma posição histórica salva ainda.</p>'}</div>
    <div class="lr150-dash-footer"><span>Fonte: ${esc(state.fileName)}${state.sourceSheet ? ` · aba ${esc(state.sourceSheet)}` : ''}</span><span>Costura permanece fora do estoque útil para avaliação técnica.</span><span>Histórico persistido neste navegador.</span></div>
  </div>`;
}

function panel() {
  if (state.error) return `<div class="lr150-shell error">Curva RFID indisponível: ${esc(state.error)}</div>`;
  if (!state.loaded) return '<div class="lr150-shell">Carregando curva RFID...</div>';
  const s = summary();
  const totals = sourceTotals();
  const categories = categoryOptions();
  const subcategories = subcategoryOptions();
  const risks = ['vermelho', 'amarelo', 'verde'];
  const points = uniqueOptions('pontoCritico');
  const references = uniqueOptions('trocasIdeais').map(String);
  const indications = uniqueOptionsFrom(state.rows, 'condutaDimensionamento');
  const orderItems = sortOrderItems(listDecisionItems(filteredDecisionItems()), state.itemSort);
  const movementItems = listMovementItems(state.rows);
  const movementTotal = movementItems.reduce((sum, row) => sum + row.quantidade, 0);
  const supplyItems = movementItems.filter(row => row.direcao === 'supply');
  const returnItems = movementItems.filter(row => row.direcao === 'return');
  const supplying = state.movementDirection === 'supply';
  const selectedMovements = supplying ? supplyItems : returnItems;
  const selectedTotal = selectedMovements.reduce((sum, row) => sum + row.quantidade, 0);
  const asOf = dateBr(state.asOf);
  const informedAt = dateBr(state.informedAt || state.asOf);
  const sourceInfo = [
    state.fileName,
    state.sourceSheet ? `aba ${state.sourceSheet}` : '',
    informedAt ? `Data das informações: ${informedAt}` : '',
    asOf && asOf !== informedAt ? `base ${asOf}` : ''
  ].filter(Boolean).join(' • ');
  return `<section class="lr150-shell">
    <div class="lr150-top">
      <div>
        <p>RFID</p>
        <h3>Atualizar planilha do enxoval</h3>
        <small>${esc(sourceInfo)} • ${s.total} itens • ${s.red} críticos • ${s.yellow} atenção • ${br(s.pedido)} pç necessidade • ${br(s.pedidoReal)} pç pedido real</small>
      </div>
      <label class="lr150-upload">
        <input id="lr150-file" type="file" accept=".csv,.txt,.json,.xlsx,.xls">
        <span>Subir CSV RFID</span>
      </label>
      <label class="lr150-upload lr150-upload-alt">
        <input id="lr150-faction-file" type="file" accept=".csv,.txt,.json,.xlsx,.xls">
        <span>Subir facção</span>
      </label>
    </div>
    ${state.uploadMessage ? `<div class="lr150-message">${esc(state.uploadMessage)}</div>` : ''}
    <nav class="lr150-dimension-nav" aria-label="Telas de dimensionamento">
      <button type="button" data-dimension-view="dashboard" class="${state.dimensionView === 'dashboard' ? 'active' : ''}" aria-pressed="${state.dimensionView === 'dashboard'}">Painel de gestão à vista</button>
      <button type="button" data-dimension-view="map" class="${state.dimensionView === 'map' ? 'active' : ''}" aria-pressed="${state.dimensionView === 'map'}">Mapa geral de peças e trocas</button>
      <button type="button" data-dimension-view="movements" class="${state.dimensionView === 'movements' ? 'active' : ''}" aria-pressed="${state.dimensionView === 'movements'}">Movimentação sugerida</button>
    </nav>
    <div class="lr150-period-bar"><label>Data da posição<select id="lr150-asof-filter"><option value="${esc(state.asOf)}">${esc(informedAt || 'Não informada')}</option></select></label><label>Histórico<select id="lr150-history-select"><option value="">${readHistory().length ? 'Escolha uma base salva' : 'Nenhuma base salva'}</option>${readHistory().map(h => `<option value="${esc(h.id)}">${esc(dateBr(h.asOf))} — ${esc(h.label)}</option>`).join('')}</select></label><button id="lr150-delete-history" type="button" class="lr150-danger">Excluir selecionada</button><button id="lr150-delete-all-history" type="button" class="lr150-danger">Excluir todas</button><button id="lr150-reset-current" type="button" class="lr150-danger">Excluir base atual</button><span>${readHistory().length > 1 ? `Histórico local: ${readHistory().length} bases. As novas importações entram automaticamente na comparação.` : 'A próxima importação será salva automaticamente para comparação.'}</span></div>
    ${state.dimensionView === 'dashboard' ? dashboardView(s, totals, movementItems, informedAt) : ''}
    ${state.dimensionView === 'map' ? `<div class="lr150-grid">
      <div class="lr150-box">
        <b>Régua de trocas</b>
        <span class="lr150-rule"><i class="bad"></i><strong>Até 6</strong><em>crítico</em></span>
        <span class="lr150-rule"><i class="warn"></i><strong>7</strong><em>atenção</em></span>
        <span class="lr150-rule"><i class="ok"></i><strong>8 a 10</strong><em>seguro</em></span>
      </div>
      <div class="lr150-box">
        <b>Fluxo considerado</b>
        <span>Base tratada: ${esc(informedAt || 'não informada')}</span>
        <span>Cliente + área crítica: ${br(totals.cliente + totals.area)}</span>
        <span>Mercado alimenta cliente: ${br(totals.mercado)}</span>
        <span>Estoque GAO: ${br(totals.deposito)} • Processo: ${br(totals.processo)} no total • Costura/avaliação: ${br(totals.descarte)} fora do total</span>
        ${state.sourceRule ? `<span>${esc(state.sourceRule)}</span>` : ''}
      </div>
      <div class="lr150-box">
        <b>Onde mexer agora</b>
        <span>${s.depositoBaixo} itens com estoque GAO baixo</span>
        <span>${s.mercadoBaixo} itens com mercado baixo</span>
        <span>${br(movementItems.length)} itens com movimentação • ${br(movementTotal)} pç</span>
        <span>${br(s.faccao)} pç já em facção • ${br(s.pedidoReal)} pç a pedir</span>
      </div>
    </div>
    ` : ''}
    ${state.dimensionView === 'movements' ? `<div class="lr150-category-report lr150-movement-report">
      <nav class="lr150-movement-nav" aria-label="Operação de movimentação">
        <button type="button" data-movement-direction="supply" class="${supplying ? 'active' : ''}" aria-pressed="${supplying}"><b>Abastecer mercado</b><span>Estoque GAO → Mercado</span><small>${br(supplyItems.length)} itens • ${br(supplyItems.reduce((sum, row) => sum + row.quantidade, 0))} pç</small></button>
        <button type="button" data-movement-direction="return" class="${!supplying ? 'active' : ''}" aria-pressed="${!supplying}"><b>Retirar excedente</b><span>Mercado → Estoque GAO</span><small>${br(returnItems.length)} itens • ${br(returnItems.reduce((sum, row) => sum + row.quantidade, 0))} pç</small></button>
      </nav>
      <div class="lr150-order-head">
        <span><b>${supplying ? 'Retirar do estoque GAO e levar ao mercado' : 'Retirar do mercado e guardar no estoque GAO'}</b><small>${br(selectedMovements.length)} itens • ${br(selectedTotal)} pç a transferir</small></span>
        <div class="lr150-order-actions">
          <button id="lr150-toggle-movement" type="button" class="lr150-collapse">${state.movementListOpen ? 'Recolher lista' : 'Expandir lista'} <i>${state.movementListOpen ? '↑' : '↓'}</i></button>
          <button id="lr150-export-movement" type="button" class="lr150-export" ${selectedMovements.length ? '' : 'disabled'}>Extrair esta lista</button>
        </div>
      </div>
      <div class="lr150-movement-flags"><span class="${supplying ? 'critical' : 'neutral'}"><i></i>${supplying ? `${br(supplyItems.length)} itens com mercado crítico` : `${br(returnItems.length)} itens com retirada indicada`}</span><span><i></i>${supplying ? `Estoque GAO disponível: ${br(supplyItems.reduce((sum, row) => sum + row.deposito, 0))} pç` : 'Reserva de 30 peças preservada'}</span><span><i></i>${supplying ? 'Priorizar itens abaixo da meta' : 'Não retirar excedente até 30 peças'}</span></div>
      <p class="lr150-movement-rule">Circulação = cliente + área crítica + mercado + relave + qualidade + desengoma, sem depósito e sem costura. ${supplying ? 'Enviar a falta para atingir as trocas ideais, limitado ao saldo do estoque GAO.' : 'Retirar o excedente acima das trocas ideais menos 30 peças, limitado ao saldo do mercado. Excedente de até 30 peças não gera retirada.'}</p>
      ${state.movementListOpen ? `
      <table class="lr150-movement-items">
        <thead><tr><th>Peça / categoria</th><th>Indicação</th><th>Mercado atual</th><th>Trocas em circulação<br>Atual / Ideal</th><th>Estoque GAO atual</th>${supplying ? '<th>Necessidade total</th><th>Enviar agora</th><th>Saldo pendente</th>' : '<th>Retirar do mercado<br>(sugerido)</th><th>Excedente calculado</th>'}</tr></thead>
        <tbody>${selectedMovements.length ? selectedMovements.map(row => `<tr data-movement-row="${row.direcao}"><td><strong>${esc(row.produtoNome)}</strong><small>${esc(row.categoria)} • ${esc(row.subcategoria)}</small></td><td><span class="lr150-movement-status ${supplying ? 'supply' : 'return'}"><i></i>${supplying ? 'Mercado crítico' : 'Retirada indicada'}</span><small>${supplying ? (row.saldoPendente > 0 ? 'Atendimento parcial — ainda falta estoque GAO' : 'Necessidade atendida') : 'Excedente acima da reserva'}</small></td><td>${br(row.mercadoAtual)} pç</td><td><strong>${br(row.trocasCirculacao, 1)} / ${br(row.trocasIdeal, 1)}</strong><small>${br(row.estoqueCirculacao)} / ${br(row.metaCirculacao)} pç</small></td><td>${br(row.deposito)} pç</td>${supplying ? `<td>${br(row.necessidadeMovimento)} pç</td><td class="lr150-transfer-qty"><strong>${br(row.quantidade)} pç</strong></td><td class="lr150-pending-qty"><strong>${br(row.saldoPendente)} pç</strong><small>${row.saldoPendente > 0 ? 'Aguardando produção/entrada' : 'Sem saldo pendente'}</small></td>` : `<td class="lr150-transfer-qty"><strong>${br(row.quantidade)} pç</strong></td><td>${br(row.excedenteCirculacao)} pç<small>Descontar 30 pç</small></td>`}</tr>`).join('') : `<tr><td colspan="${supplying ? 8 : 7}">${supplying ? 'Nenhum item com falta em circulação e saldo no estoque GAO para envio.' : 'Nenhum item com excedente em circulação acima de 30 peças e saldo no mercado para retirada.'}</td></tr>`}</tbody>
      </table>
      ` : '<div class="lr150-collapsed-note">Lista recolhida. Clique em “Expandir lista” para abrir novamente.</div>'}
    </div>
    ` : state.dimensionView === 'map' ? `<div class="lr150-category-report lr150-order-report">
      <div class="lr150-order-head">
        <span><b>Resumo do enxoval</b><small>${br(orderItems.length)} peças • ${br(orderItems.filter(row => row.pedidoReal > 0).length)} com pedido • ${br(orderItems.reduce((sum, row) => sum + row.pedidoReal, 0))} pç a pedir</small></span>
        <div class="lr150-order-actions">
          <button id="lr150-export-items" type="button" class="lr150-export" ${orderItems.length ? '' : 'disabled'}>Extrair itens</button>
        </div>
      </div>
      <div class="lr150-message">Abaixo fica o mapa de decisão por peça: estoque em cada ponto, trocas, facção e quantidade final para pedir.</div>
    </div>
    <div class="lr150-table-wrap">
      <div class="lr150-table-head">
        <b>Mapa geral de peças e trocas</b>
        <div class="lr150-color-legend">
          <span><i class="bad"></i>Vermelho: até 6 trocas</span>
          <span><i class="warn"></i>Amarelo: 7 trocas</span>
          <span><i class="ok"></i>Verde: 8 a 10 trocas</span>
        </div>
      </div>
      <div class="lr150-legend"><b>Legenda:</b><span><strong>Cliente</strong> estoque no cliente</span><span><strong>AC</strong> área crítica</span><span><strong>Processo</strong> relave, qualidade e desengoma</span><span><strong>Costura</strong> em avaliação técnica, fora do total</span><span><strong>Total</strong> estoques considerados</span><span><strong>T. total</strong> estoque total dividido pelo consumo médio diário</span></div>
      <div class="lr150-toolbar">
        ${filterInput('lr150-item-filter', state.itemFilter, 'Buscar item')}
        ${multiFilter('masterCategoryFilter', categories, state.masterCategoryFilter, 'Categorias')}
        ${multiFilter('riskFilter', risks, state.riskFilter, 'Criticidade')}
        ${filterInput('lr150-qty-filter', state.qtyFilter, 'Necessidade mín.', 'number')}
        ${filterInput('lr150-faction-filter', state.factionFilter, 'Facção mín.', 'number')}
        ${filterInput('lr150-real-order-filter', state.realOrderFilter, 'Pedir mín.', 'number')}
      </div>
      <table class="lr150-table">
        <thead>
          <tr class="lr150-label-row"><th>Item</th><th>Estoques</th><th>Trocas</th><th>Decisão</th></tr>
        </thead>
        <tbody>${orderItems.length ? orderItems.map(row => `<tr class="lr150-row-${esc(row.criticidade)}">
          <td><strong>${esc(row.produtoNome || row.produtoId)}</strong><small>${esc(row.categoria)} • ${esc(row.subcategoria || 'Sem subcategoria')}</small><span class="lr150-pill ${esc(row.criticidade)}">${esc(row.criticidade)}</span></td>
          <td><div class="lr150-data-grid">
            <span><b>Cliente</b>${br(row.cliente)} pç</span>
            <span><b>AC</b>${br(row.areaCritica)} pç</span>
            <span><b>Mercado</b>${br(row.mercado)} pç</span>
            <span><b>Estoque GAO</b>${br(row.estoqueGao)} pç</span>
            <span class="lr150-group-start"><b>Relave</b>${br(row.relave)} pç</span>
            <span><b>Qualidade</b>${br(row.qualidade)} pç</span>
            <span><b>Desengoma</b>${br(row.desengoma)} pç</span>
            <span class="lr150-discard"><b>Costura</b>${br(row.descarte)} pç</span>
            <span class="strong lr150-total-card"><b>Total</b>${br(row.totalUtil)} pç</span>
          </div></td>
          <td><div class="lr150-data-grid lr150-data-grid-tight">
            <span><b>Cli+AC</b>${br(row.trocasClienteArea, 1)}</span>
            <span><b>Merc</b>${br(row.trocasMercado, 1)}</span>
            <span><b>GAO</b>${br(row.trocasGao, 1)}</span>
            <span class="strong lr150-total-card"><b>Total</b>${br(row.trocasTotal, 1)}</span>
            <label class="lr150-ideal-card" title="${row.idealInformado ? 'Trocas ideais informadas na planilha' : 'Referência por categoria usada no cálculo de reposição'}"><b>Ideal</b><input class="lr150-ideal-input" type="number" min="0.1" max="99" step="0.1" value="${esc(row.trocasIdeal)}" data-produto-id="${esc(row.produtoId)}" data-produto-nome="${esc(row.produtoNome)}" data-previous-value="${esc(row.trocasIdeal)}" aria-label="Troca ideal de ${esc(row.produtoNome)}"><em>trocas</em></label>
          </div></td>
          <td><div class="lr150-decision">
            <span><b>Necessidade</b>${br(row.necessidade)} pç</span>
            <span><b>Facção</b>${br(row.faccao)} pç</span>
            <strong>Pedir ${br(row.pedidoReal)} pç</strong>
          </div></td>
        </tr>`).join('') : '<tr><td colspan="4" class="lr150-empty">Nenhuma peça encontrada nos filtros atuais.</td></tr>'}</tbody>
      </table>
    </div>
    ` : ''}
  </section>`;
}

function bind() {
  document.querySelectorAll('[data-movement-direction]').forEach(button => button.addEventListener('click', event => {
    const movementDirection = event.currentTarget.dataset.movementDirection;
    if (!['supply', 'return'].includes(movementDirection) || movementDirection === state.movementDirection) return;
    state = { ...state, movementDirection, movementListOpen: true };
    render();
  }));
  document.querySelectorAll('[data-dimension-view]').forEach(button => button.addEventListener('click', event => {
    const dimensionView = event.currentTarget.dataset.dimensionView;
    if (!['dashboard', 'map', 'movements'].includes(dimensionView) || dimensionView === state.dimensionView) return;
    state = { ...state, dimensionView, openFilter: '' };
    render();
  }));
  document.querySelector('#lr150-file')?.addEventListener('change', event => readRfidFile(event.target.files?.[0]));
  document.querySelector('#lr150-faction-file')?.addEventListener('change', event => readFactionFile(event.target.files?.[0]));
  document.querySelectorAll('.lr150-ideal-input').forEach(input => input.addEventListener('change', editIdealReference));
  document.querySelector('#lr150-history-select')?.addEventListener('change', event => {
    const h = readHistory().find(item => item.id === event.target.value);
    if (!h) return;
    state = { ...state, uploadMessage: `Base histórica selecionada: ${dateBr(h.asOf)} — ${h.label}. Atual: ${br(summary().pedidoReal)} pç a pedir; histórico: ${br(h.pedidoReal)} pç.` };
    render();
  });
  document.querySelector('#lr150-delete-history')?.addEventListener('click', deleteSelectedHistory);
  document.querySelector('#lr150-delete-all-history')?.addEventListener('click', deleteAllHistory);
  document.querySelector('#lr150-reset-current')?.addEventListener('click', resetCurrentBase);
  document.querySelector('#lr150-export-items')?.addEventListener('click', downloadItemReport);
  document.querySelector('#lr150-export-movement')?.addEventListener('click', downloadMovementReport);
  document.querySelector('#lr150-toggle-movement')?.addEventListener('click', () => {
    state = { ...state, movementListOpen: !state.movementListOpen };
    render();
  });
  document.querySelectorAll('.lr150-th-sort').forEach(button => button.addEventListener('click', event => {
    state = { ...state, itemSort: event.currentTarget.dataset.sort || 'pedido' };
    render();
  }));
  document.querySelectorAll('.lr150-multi summary').forEach(summary => summary.addEventListener('click', event => {
    const key = event.currentTarget.closest('.lr150-multi')?.dataset.filter || '';
    state = { ...state, openFilter: key };
  }));
  document.querySelectorAll('.lr150-multi input').forEach(input => input.addEventListener('change', event => {
    const key = event.target.closest('.lr150-multi')?.dataset.filter;
    if (!key) return;
    const values = [...document.querySelectorAll(`.lr150-multi[data-filter="${key}"] input:checked`)].map(item => item.value);
    state = { ...state, openFilter: key, [key]: values, ...(key === 'masterCategoryFilter' ? { subCategoryFilter: [] } : {}) };
    render();
  }));
  document.querySelector('#lr150-item-filter')?.addEventListener('input', event => {
    state = { ...state, openFilter: '', itemFilter: event.target.value };
    render();
  });
  document.querySelector('#lr150-exchange-filter')?.addEventListener('input', event => {
    state = { ...state, openFilter: '', exchangeFilter: event.target.value };
    render();
  });
  document.querySelector('#lr150-qty-filter')?.addEventListener('input', event => {
    state = { ...state, openFilter: '', qtyFilter: event.target.value };
    render();
  });
  document.querySelector('#lr150-faction-filter')?.addEventListener('input', event => {
    state = { ...state, openFilter: '', factionFilter: event.target.value };
    render();
  });
  document.querySelector('#lr150-real-order-filter')?.addEventListener('input', event => {
    state = { ...state, openFilter: '', realOrderFilter: event.target.value };
    render();
  });
}

function hideLegacyDimensioningForm(shell) {
  let node = shell.nextElementSibling;
  while (node) {
    node.style.display = 'none';
    node.dataset.lr150HiddenLegacy = 'true';
    node = node.nextElementSibling;
  }
}

function findSideMenu() {
  const candidates = [...document.querySelectorAll('.sidebar, aside, nav, [class*="sidebar"], [class*="side-bar"]')];
  return candidates.find(item => {
    const text = item.textContent || '';
    return item.offsetHeight > 180 && (/Gestão de Estoque|Gestao de Estoque|Gestão integrada|MONITORAMENTO|Portal/i.test(text) || item.classList.contains('sidebar'));
  });
}

function mountMenuToggle() {
  const menu = findSideMenu();
  if (!menu) return;
  menu.classList.add('gao-menu-shell');
  let button = menu.querySelector('.gao-menu-toggle');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'gao-menu-toggle';
    button.setAttribute('aria-label', 'Recolher menu');
    menu.appendChild(button);
  }
  const collapsed = document.body.classList.contains('gao-menu-collapsed');
  button.textContent = collapsed ? '»' : '«';
  button.title = collapsed ? 'Expandir menu' : 'Recolher menu';
  button.onclick = () => {
    const nextCollapsed = !document.body.classList.contains('gao-menu-collapsed');
    document.body.classList.toggle('gao-menu-collapsed', nextCollapsed);
    button.textContent = nextCollapsed ? '»' : '«';
    button.title = nextCollapsed ? 'Expandir menu' : 'Recolher menu';
    button.setAttribute('aria-label', button.title);
  };
}

function render() {
  if (!route()) {
    document.querySelector('#gao-linen-risk-shell')?.remove();
    return;
  }
  const panelHost = document.querySelector('.page-stack .data-panel');
  const heading = panelHost?.querySelector('.section-heading');
  if (!panelHost || !heading) return;
  let shell = document.querySelector('#gao-linen-risk-shell');
  if (!shell) {
    shell = document.createElement('div');
    shell.id = 'gao-linen-risk-shell';
    heading.after(shell);
  }
  const activeId = document.activeElement?.id || '';
  const activeStart = document.activeElement?.selectionStart;
  shell.innerHTML = panel();
  bind();
  if (activeId.startsWith('lr150-')) {
    const active = document.getElementById(activeId);
    active?.focus();
    if (active && typeof active.setSelectionRange === 'function' && activeStart !== null) {
      active.setSelectionRange(activeStart, activeStart);
    }
  }
  hideLegacyDimensioningForm(shell);
}

async function mount() {
  render();
  await load();
  render();
}

const css = document.createElement('style');
css.textContent = `.lr150-shell{border:1px solid #d7e4ef;border-radius:10px;background:#f8fbff;padding:10px 12px;margin:10px 0 12px;color:#082d52}.lr150-shell.error{background:#fff5f5;color:#a32626}.lr150-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.lr150-top p{margin:0 0 2px;color:#0879c9;font-size:10px;letter-spacing:.12em;font-weight:900}.lr150-top h3{margin:0;font-size:15px;color:#082d52}.lr150-top small{display:block;color:#607d9b;margin-top:2px;font-size:12px}.lr150-upload{position:relative;display:inline-flex;align-items:center;justify-content:center;border:1px solid #3188cc;background:#3188cc;color:#fff;border-radius:999px;padding:8px 12px;font-weight:900;cursor:pointer;white-space:nowrap}.lr150-upload input{position:absolute;inset:0;opacity:0;cursor:pointer}.lr150-message{margin-top:8px;border:1px solid #b9d1e8;background:#fff;border-radius:8px;padding:8px 10px;color:#174a78;font-size:12px}.lr150-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px}.lr150-box{border:1px solid #d7e4ef;border-radius:8px;background:#fff;padding:10px 12px}.lr150-box b,.lr150-table-head b{display:block;color:#082d52;margin-bottom:6px}.lr150-box span{display:block;color:#54708e;font-size:12px;line-height:1.45}.lr150-box i,.lr150-color-legend i{display:inline-block;width:10px;height:10px;border-radius:999px;margin-right:6px}.lr150-box i.bad,.lr150-color-legend i.bad{background:#dc2626}.lr150-box i.warn,.lr150-color-legend i.warn{background:#f2b705}.lr150-box i.ok,.lr150-color-legend i.ok{background:#22a05a}.lr150-rule{display:grid!important;grid-template-columns:18px 58px 1fr;align-items:center;gap:4px;min-height:20px}.lr150-rule strong{color:#082d52}.lr150-rule em{font-style:normal;color:#54708e}.lr150-table-wrap{border:1px solid #d7e4ef;border-radius:8px;background:#fff;padding:9px 10px;margin-top:8px;overflow:auto}.lr150-table-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.lr150-color-legend{display:flex;flex-wrap:wrap;gap:7px;justify-content:flex-end;color:#54708e;font-size:11px}.lr150-color-legend span{display:inline-flex;align-items:center;border:1px solid #e1ebf3;border-radius:999px;background:#fbfdff;padding:5px 8px}.lr150-legend{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 9px;color:#54708e;font-size:11px}.lr150-legend span{border:1px solid #e1ebf3;border-radius:999px;padding:4px 7px}.lr150-toolbar{display:grid;grid-template-columns:2fr 1fr 1fr repeat(3,minmax(120px,1fr));gap:7px;margin:9px 0 10px}.lr150-table{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}.lr150-table th{position:sticky;z-index:1;text-align:center;color:#54708e;background:#f3f8fd;border-bottom:1px solid #d7e4ef;padding:7px 8px}.lr150-label-row th{top:0;font-size:11px;font-weight:900}.lr150-control{width:100%;min-width:0;border:1px solid #b9d1e8;border-radius:999px;background:#fff;color:#082d52;padding:7px 9px;font-size:11px;font-weight:800}.lr150-table th:nth-child(1),.lr150-table td:nth-child(1){width:230px}.lr150-table th:nth-child(2),.lr150-table td:nth-child(2){width:42%}.lr150-table th:nth-child(3),.lr150-table td:nth-child(3){width:22%}.lr150-table th:nth-child(4),.lr150-table td:nth-child(4){width:190px}.lr150-table th:nth-child(n+2),.lr150-table td:nth-child(n+2){border-left:1px solid #edf4fb}.lr150-table td{border-bottom:1px solid #eef4f9;padding:10px 8px;vertical-align:top;color:#22425f;overflow-wrap:normal}.lr150-table td small{display:block;color:#7890a8;margin:2px 0 6px}.lr150-row-vermelho td:first-child{border-left:5px solid #dc2626}.lr150-row-amarelo td:first-child{border-left:5px solid #f2b705}.lr150-row-verde td:first-child{border-left:5px solid #22a05a}.lr150-empty{text-align:center;color:#607d9b;padding:18px!important}.lr150-pill{display:inline-flex;border-radius:999px;padding:4px 7px;font-weight:800;text-transform:capitalize;background:#e8f1f9;color:#174a78}.lr150-pill.vermelho{background:#fee2e2;color:#b91c1c}.lr150-pill.amarelo{background:#fff4c7;color:#805600}.lr150-pill.verde{background:#dcfce7;color:#166534}.lr150-data-grid{display:grid;grid-template-columns:repeat(4,minmax(76px,1fr));gap:6px}.lr150-data-grid-tight{grid-template-columns:repeat(2,minmax(82px,1fr))}.lr150-data-grid span,.lr150-decision span{display:block;border:1px solid #e1ebf3;border-radius:7px;background:#fbfdff;padding:6px 7px;color:#22425f;white-space:nowrap}.lr150-data-grid .lr150-group-start{border-left:3px solid #dbeafe}.lr150-data-grid .lr150-discard{background:#fff7ed!important;border-color:#fed7aa!important}.lr150-data-grid .lr150-total-card{grid-column:4}.lr150-data-grid-tight .lr150-total-card{grid-column:2}.lr150-data-grid b,.lr150-decision b{display:block;color:#54708e;font-size:10px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}.lr150-data-grid .strong,.lr150-decision strong{background:#eef7ff;border-color:#b9d1e8;color:#082d52;font-weight:900}.lr150-decision{display:grid;gap:6px}.lr150-decision strong{display:block;border-radius:8px;padding:8px 9px;font-size:14px;text-align:center}.lr150-order-qty{font-size:13px}@media(max-width:1100px){.lr150-top,.lr150-table-head{align-items:flex-start;flex-direction:column}.lr150-color-legend{justify-content:flex-start}.lr150-grid{grid-template-columns:1fr}.lr150-toolbar{grid-template-columns:1fr 1fr}.lr150-table{min-width:1060px}.lr150-data-grid{grid-template-columns:repeat(3,minmax(82px,1fr))}}`;
css.textContent += `.lr150-upload-alt{border-color:#0f5f9c;background:#fff;color:#0f5f9c}.lr150-category-report{border:1px solid #d7e4ef;border-radius:8px;background:#fff;padding:9px 10px;margin-top:8px;overflow:auto}.lr150-category-report table{width:100%;border-collapse:collapse;font-size:12px}.lr150-category-report th{background:#f3f8fd;color:#54708e;text-align:left;padding:6px;border-bottom:1px solid #d7e4ef}.lr150-category-report td{padding:7px 6px;border-bottom:1px solid #eef4f9;color:#22425f}.lr150-order-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.lr150-order-head b{display:block;color:#082d52;font-size:15px}.lr150-order-head small{display:block;color:#54708e;margin-top:2px}.lr150-order-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}.lr150-collapse{display:inline-flex;align-items:center;gap:6px;border:1px solid #b9d1e8;background:#fff;color:#174a78;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:900;cursor:pointer}.lr150-collapse i{font-style:normal;font-size:13px}.lr150-collapsed-note{border:1px dashed #b9d1e8;border-radius:8px;background:#f8fbff;color:#54708e;padding:12px;font-size:12px}.lr150-movement-items{min-width:1220px}.lr150-movement-items th:nth-child(1),.lr150-movement-items td:nth-child(1){width:280px}.lr150-movement-items th:nth-child(6),.lr150-movement-items td:nth-child(6),.lr150-movement-items th:nth-child(7),.lr150-movement-items td:nth-child(7),.lr150-movement-items th:nth-child(8),.lr150-movement-items td:nth-child(8),.lr150-movement-items th:nth-child(9),.lr150-movement-items td:nth-child(9){width:92px}.lr150-th-sort{width:100%;display:inline-flex;align-items:center;justify-content:space-between;gap:5px;border:0;background:transparent;color:#54708e;text-align:left;font:inherit;font-weight:900;cursor:pointer;padding:0}.lr150-th-sort i{font-style:normal;color:#3188cc;font-size:13px}.lr150-th-sort.active{color:#082d52}.lr150-order-items{min-width:1120px}.lr150-order-items th:nth-child(1),.lr150-order-items td:nth-child(1){width:300px}.lr150-order-items th:nth-child(2),.lr150-order-items td:nth-child(2){width:105px}.lr150-order-items th:nth-child(3),.lr150-order-items td:nth-child(3){width:105px}.lr150-order-items th:nth-child(4),.lr150-order-items td:nth-child(4){width:95px}.lr150-order-items th:nth-child(5),.lr150-order-items td:nth-child(5),.lr150-order-items th:nth-child(6),.lr150-order-items td:nth-child(6),.lr150-order-items th:nth-child(7),.lr150-order-items td:nth-child(7){width:90px}.lr150-order-items strong{color:#082d52}.lr150-order-qty{font-size:13px}.lr150-export{border:1px solid #3188cc;background:#3188cc;color:#fff;border-radius:999px;padding:7px 11px;font-weight:900;cursor:pointer}.lr150-export:disabled{opacity:.45;cursor:not-allowed}.lr150-multi{position:relative}.lr150-multi summary{list-style:none;width:100%;min-width:0;border:1px solid #b9d1e8;border-radius:999px;background:#fff;color:#082d52;padding:5px 7px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lr150-multi summary::-webkit-details-marker{display:none}.lr150-multi div{position:absolute;z-index:8;top:30px;left:0;min-width:170px;max-height:210px;overflow:auto;border:1px solid #b9d1e8;border-radius:8px;background:#fff;box-shadow:0 14px 32px rgba(8,45,82,.16);padding:6px}.lr150-multi label{display:flex;align-items:center;gap:6px;color:#082d52;font-size:11px;font-weight:800;padding:5px;border-radius:6px}.lr150-multi label:hover{background:#f3f8fd}.lr150-multi input{accent-color:#3188cc}.gao-menu-shell{position:relative!important;transition:width .2s ease,min-width .2s ease,max-width .2s ease}.gao-menu-toggle{position:absolute;top:18px;right:12px;z-index:9999;width:30px;height:30px;border-radius:9px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.12);color:#fff;font-size:19px;font-weight:900;line-height:1;display:grid;place-items:center;cursor:pointer}.gao-menu-toggle:hover{background:rgba(255,255,255,.2)}body.gao-menu-collapsed .gao-menu-shell{width:82px!important;min-width:82px!important;max-width:82px!important;overflow:hidden!important}body.gao-menu-collapsed .gao-menu-shell .sidebar-label,body.gao-menu-collapsed .gao-menu-shell .sidebar-brand>span{opacity:0!important;pointer-events:none!important}body.gao-menu-collapsed .gao-menu-shell .gao-sidebar-logo{width:48px!important;object-position:left center}`;
css.textContent += `.lr150-dashboard{margin-top:8px}.lr150-dashboard-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:#eaf5ff;border:1px solid #c8e0f2;border-radius:8px;padding:13px 15px}.lr150-dashboard-head b{display:block;font-size:16px;color:#082d52}.lr150-dashboard-head small{display:block;color:#54708e;margin-top:3px}.lr150-dashboard-source{font-size:12px;color:#175887;background:#fff;border:1px solid #c8e0f2;border-radius:999px;padding:6px 9px}.lr150-dashboard-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:9px 0}.lr150-dash-card{background:#fff;border:1px solid #d7e4ef;border-top:3px solid #3188cc;border-radius:8px;padding:11px}.lr150-dash-card:nth-child(1){border-top-color:#dc2626}.lr150-dash-card:nth-child(3){border-top-color:#e4b32e}.lr150-dash-card:nth-child(4){border-top-color:#2b9a67}.lr150-dash-card small,.lr150-dash-card span{display:block;color:#54708e;font-size:11px}.lr150-dash-card strong{display:block;color:#082d52;font-size:22px;margin:5px 0}.lr150-dash-card em{font-style:normal;font-size:11px;font-weight:500}.lr150-dash-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.lr150-dash-panel{background:#fff;border:1px solid #d7e4ef;border-radius:8px;padding:12px;min-width:0}.lr150-dash-title{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:11px}.lr150-dash-title b{color:#082d52;font-size:13px}.lr150-dash-title small,.lr150-dash-title span{display:block;color:#54708e;font-size:11px;margin-top:3px}.lr150-dash-title button{border:0;background:transparent;color:#1167a6;font-weight:900;font-size:11px;cursor:pointer;white-space:nowrap}.lr150-crit-track{height:18px;border-radius:4px;background:#edf3f8;overflow:hidden;display:flex}.lr150-crit-track i{display:block;min-width:3px}.lr150-crit-legend{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;color:#54708e;font-size:11px}.lr150-crit-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px}.lr150-dash-note{font-size:11px;color:#54708e;line-height:1.45;margin:10px 0 0}.lr150-stock-lines{display:grid;gap:8px}.lr150-stock-lines span{display:grid;grid-template-columns:1fr auto;gap:4px;align-items:center}.lr150-stock-lines label{font-size:11px;color:#54708e}.lr150-stock-lines b{font-size:12px;color:#082d52}.lr150-stock-lines i{grid-column:1 / -1;height:7px;background:#edf3f8;border-radius:4px;overflow:hidden}.lr150-stock-lines i em{display:block;height:100%;background:#3188cc;border-radius:4px}.lr150-critical-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px;align-items:center;margin:8px 0}.lr150-critical-row b{display:block;color:#22425f;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lr150-critical-row small{display:block;color:#7890a8;font-size:10px;margin-top:2px}.lr150-critical-row strong{color:#b91c1c;font-size:13px}.lr150-critical-row i{grid-column:1 / -1;height:6px;background:#fee2e2;border-radius:4px;overflow:hidden}.lr150-critical-row i em{display:block;height:100%;background:#dc2626;border-radius:4px}.lr150-flow{display:grid;grid-template-columns:1fr 1fr;gap:8px}.lr150-flow span{border:1px solid #e1ebf3;border-radius:7px;padding:10px;background:#fbfdff}.lr150-flow b,.lr150-flow strong,.lr150-flow small{display:block}.lr150-flow b{font-size:11px;color:#54708e}.lr150-flow strong{font-size:17px;color:#082d52;margin:5px 0}.lr150-flow small{font-size:10px;color:#7890a8}.lr150-dash-footer{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;color:#607d9b;font-size:10px;border-top:1px solid #d7e4ef;padding-top:8px;margin-top:8px}@media(max-width:850px){.lr150-dashboard-cards{grid-template-columns:1fr 1fr}.lr150-dash-grid{grid-template-columns:1fr}}@media(max-width:520px){.lr150-dashboard-cards{grid-template-columns:1fr}.lr150-flow{grid-template-columns:1fr}}`;
css.textContent += `.lr150-period-bar{display:flex;align-items:end;gap:8px;flex-wrap:wrap;border:1px solid #d7e4ef;border-radius:8px;background:#fff;padding:9px 10px;margin:8px 0}.lr150-period-bar label{display:grid;gap:4px;color:#54708e;font-size:10px;font-weight:900}.lr150-period-bar select{min-width:180px;border:1px solid #b9d1e8;border-radius:6px;background:#fff;color:#082d52;padding:7px 9px;font-size:12px}.lr150-period-bar span{color:#7890a8;font-size:11px;margin-bottom:8px}`;
css.textContent += `.lr150-danger{border:1px solid #e3a3a3;background:#fff7f7;color:#a32626;border-radius:6px;padding:7px 9px;font-size:11px;font-weight:900;cursor:pointer}.lr150-danger:hover{background:#fee2e2}`;
css.textContent += `.lr150-history-box{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;border:1px solid #d7e4ef;border-radius:8px;background:#fff;padding:10px;margin-top:8px}.lr150-history-box>div{grid-column:1/-1}.lr150-history-box b{display:block;color:#082d52;font-size:13px}.lr150-history-box>div small,.lr150-history-box p{color:#54708e;font-size:11px;margin:3px 0}.lr150-history-box>span{display:grid;gap:2px;border:1px solid #e1ebf3;border-radius:7px;background:#fbfdff;padding:7px}.lr150-history-box strong{color:#082d52;font-size:12px}.lr150-history-box span small{color:#54708e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lr150-history-box em{font-style:normal;color:#7890a8;font-size:10px}@media(max-width:850px){.lr150-history-box{grid-template-columns:1fr 1fr}}@media(max-width:520px){.lr150-history-box{grid-template-columns:1fr}}`;
css.textContent += '.lr150-data-grid-tight .lr150-ideal-card{grid-column:2;background:#f5f9fd;border-color:#d7e4ef;color:#22425f}.lr150-dimension-nav{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.lr150-dimension-nav button{border:1px solid #b9d1e8;background:#fff;color:#082d52;border-radius:8px;padding:10px 14px;font:inherit;font-size:13px;font-weight:800;cursor:pointer}.lr150-dimension-nav button.active{background:#3188cc;border-color:#3188cc;color:#fff}.lr150-dimension-nav button:focus-visible{outline:3px solid #91c4eb;outline-offset:2px}';
css.textContent += '.lr150-ideal-card{display:grid!important;grid-template-columns:auto 1fr;align-items:center;gap:4px;cursor:text}.lr150-ideal-card b{grid-column:1/-1}.lr150-ideal-input{width:58px;border:1px solid #8bb8d9;border-radius:5px;background:#fff;color:#082d52;padding:4px 5px;font:inherit;font-weight:900;text-align:center}.lr150-ideal-input:focus{outline:2px solid #3188cc;outline-offset:1px}.lr150-ideal-card em{font-style:normal;font-size:10px;color:#54708e}.lr150-pending-qty{background:#fff7ed;color:#9a3412}.lr150-pending-qty strong{color:#9a3412}.lr150-pending-qty small{color:#9a3412!important}';
css.textContent += '.lr150-movement-flags{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0 6px}.lr150-movement-flags span{display:inline-flex;align-items:center;gap:5px;border:1px solid #d7e4ef;border-radius:999px;background:#fff;padding:6px 9px;color:#54708e;font-size:11px;font-weight:800}.lr150-movement-flags span.critical{color:#a32626;background:#fff3f3;border-color:#f1c4c4}.lr150-movement-flags i{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3188cc}.lr150-movement-flags .critical i{background:#dc2626}.lr150-movement-status{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:4px 6px;background:#fff3f3;color:#a32626;font-size:11px;font-weight:900;white-space:nowrap}.lr150-movement-status.return{background:#fff8df;color:#805600}.lr150-movement-status i{width:7px;height:7px;border-radius:50%;background:#dc2626}.lr150-movement-status.return i{background:#e4b32e}';
css.textContent += `.lr150-movement-nav{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 18px}.lr150-movement-nav button{flex:1 1 220px;text-align:left;border:1px solid #b9d1e8;border-radius:8px;background:#fff;color:#174a78;padding:12px 14px;cursor:pointer;font:inherit}.lr150-movement-nav b,.lr150-movement-nav span,.lr150-movement-nav small{display:block}.lr150-movement-nav b{font-size:15px;margin-bottom:5px}.lr150-movement-nav span{font-size:13px}.lr150-movement-nav small{font-size:12px;margin-top:6px}.lr150-movement-nav button.active{background:#eaf5ff;border:2px solid #3188cc;padding:11px 13px}.lr150-movement-nav button:focus-visible{outline:3px solid #91c4eb;outline-offset:2px}.lr150-movement-rule{font-size:12px;color:#54708e;margin:8px 0 12px}.lr150-movement-items{min-width:1000px;table-layout:fixed}.lr150-movement-items th,.lr150-movement-items td{width:auto!important;text-align:center}.lr150-movement-items th:first-child,.lr150-movement-items td:first-child{width:270px!important;text-align:left}.lr150-movement-items small{display:block;color:#607d9b;font-size:11px;margin-top:4px}.lr150-movement-items .lr150-transfer-qty{background:#eaf5ff;color:#082d52}`;
document.head.appendChild(css);

let last = '';
setInterval(() => {
  mountMenuToggle();
  if (location.pathname !== last) {
    last = location.pathname;
    setTimeout(mount, 250);
  } else if (route() && !document.querySelector('#gao-linen-risk-shell')) {
    mount();
  }
}, 700);
