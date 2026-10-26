// Regras locais para o addon funcionar mesmo quando o servidor não processa módulos .mjs.
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
function calculateFabricPlan({ stockM = 0, reservedM = 0, blockedM = 0, incomingM = 0, requiredM = 0, averageMonthlyM = 0, safetyM = 0 }) {
  const availableM = Math.max(0, n(stockM) - n(reservedM) - n(blockedM));
  const projectedM = Math.max(0, availableM + n(incomingM));
  const releaseNowM = Math.min(availableM, Math.max(0, n(requiredM)));
  const pendingReleaseM = Math.max(0, n(requiredM) - releaseNowM);
  const targetM = Math.max(n(requiredM), n(averageMonthlyM)) + Math.max(0, n(safetyM));
  return { availableM, projectedM, releaseNowM, pendingReleaseM, targetM, purchaseSuggestionM: Math.max(0, targetM - projectedM) };
}
function calculateLoss({ theoreticalM = 0, actualM = 0 }) {
  const theoretical = Math.max(0, n(theoreticalM));
  const actual = Math.max(0, n(actualM));
  const lossM = Math.max(0, actual - theoretical);
  return { lossM, lossPercent: theoretical ? lossM / theoretical * 100 : 0, yieldPercent: actual ? theoretical / actual * 100 : 0 };
}
function calculatePurchaseCost({ quantityM = 0, pricePerM = 0, freight = 0, otherCost = 0 }) {
  const quantity = Math.max(0, n(quantityM));
  const totalCost = Math.max(0, quantity * Math.max(0, n(pricePerM)) + Math.max(0, n(freight)) + Math.max(0, n(otherCost)));
  return { totalCost, effectivePricePerM: quantity ? totalCost / quantity : 0 };
}

const KEY = 'gao-fabric-planning-v1';
const empty = { fabrics: [], incoming: [], requirements: [], cuts: [], suppliers: [], xmlProducts: [], fabricTypes: ['CAMISARIA', 'SARJA', 'BRIM PESADA', 'MALHA', 'LENÇOL', 'OUTRO'], structures: ['2X1', '2X2', '3X1', '3X2', '4X1', '180 FIOS', '200 FIOS', '500 FIOS'] };
const read = () => { try { return { ...empty, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...empty }; } };
const save = data => localStorage.setItem(KEY, JSON.stringify(data));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const num = value => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
let data = read();
if (!Array.isArray(data.structures) || !data.structures.length) { data.structures = [...empty.structures]; save(data); }
if (!Array.isArray(data.fabricTypes) || !data.fabricTypes.length) { data.fabricTypes = [...empty.fabricTypes]; save(data); }
let tab = 'partial';
let editingFabricId = null;

function fabric(id) { return data.fabrics.find(item => item.id === id); }
function incomingFor(id) { return data.incoming.filter(item => item.fabricId === id && item.status !== 'cancelled' && !item.stockApplied && item.lotDecision !== 'STOCK').reduce((sum, item) => sum + Number(item.qtyM || 0), 0); }
function suppliersFor(id) {
  return [...new Set(data.incoming.filter(item => item.fabricId === id && item.status !== 'cancelled' && item.supplier).map(item => item.supplier.trim()))];
}
function requirementPlan(item) {
  const f = fabric(item.fabricId) || {};
  return { ...item, fabric: f, requiredM: Number(item.qtyPieces || 0) * Number(item.consumptionM || 0), ...calculateFabricPlan({ stockM: f.stockM, reservedM: f.reservedM, blockedM: f.blockedM, incomingM: incomingFor(item.fabricId), requiredM: Number(item.qtyPieces || 0) * Number(item.consumptionM || 0), averageMonthlyM: f.averageMonthlyM, safetyM: f.safetyM }) };
}
function selectFabrics() { return data.fabrics.map(item => `<option value="${esc(item.id)}">${esc(item.code)} — ${esc(item.name)}${item.fabricType ? ` • ${esc(item.fabricType)}` : ''}${item.color ? ` (${esc(item.color)})` : ''}</option>`).join(''); }
function fabricTypeOptions(selected = '') {
  const options = [...new Set([...(data.fabricTypes || []), ...(selected && !(data.fabricTypes || []).includes(selected) ? [selected] : [])])];
  return `<option value="">Tipo de tecido</option>${options.map(type => `<option value="${esc(type)}" ${selected === type ? 'selected' : ''}>${esc(type)}</option>`).join('')}<option value="__custom__">Outro (cadastrar na lista)</option>`;
}
function weaveOptions(selected = '') {
  const options = [...new Set([...(data.structures || []), ...(selected && !(data.structures || []).includes(selected) ? [selected] : [])])];
  return `<option value="">Construção / referência</option>${options.map(type => `<option value="${esc(type)}" ${selected === type ? 'selected' : ''}>${esc(type)}</option>`).join('')}<option value="__custom__">Outra (cadastrar na lista)</option>`;
}
function structuresView() {
  return `<div class="gfp-structures"><div><b>Lista de construções e referências</b><small>Edite ou crie opções para qualquer tecido: sarja 2X1/3X1, lençol 180/200/500 fios, ou outra classificação.</small></div><div class="gfp-structure-list">${(data.structures || []).map(item => `<span>${esc(item)}<button type="button" data-gfp-delete-structure="${esc(item)}" title="Excluir">×</button></span>`).join('') || '<em>Nenhuma opção cadastrada.</em>'}</div><form data-gfp-form="structure" class="gfp-form"><input name="structure" placeholder="Nova construção ou referência (ex.: 300 FIOS)" required><button>Adicionar à lista</button></form></div>`;
}
function fabricTypesView() {
  return `<div class="gfp-structures"><div><b>Lista de tipos de tecido</b><small>Edite ou crie os tipos usados no cadastro dos produtos.</small></div><div class="gfp-structure-list">${(data.fabricTypes || []).map(item => `<span>${esc(item)}<button type="button" data-gfp-delete-fabric-type="${esc(item)}" title="Excluir">×</button></span>`).join('') || '<em>Nenhum tipo cadastrado.</em>'}</div><form data-gfp-form="fabricType" class="gfp-form"><input name="fabricType" placeholder="Novo tipo (ex.: LENÇOL 200 FIOS)" required><button>Adicionar tipo</button></form></div>`;
}
function qualityFields(current = {}) {
  return `<div class="gfp-quality-fields"><b>Análise de qualidade do lote recebido</b><small>Informe os resultados medidos no fornecedor ou no recebimento. Campos não medidos podem ficar em branco.</small><input name="warpStrength" type="text" inputmode="decimal" data-decimal="true" placeholder="Resistência de urdume" value="${esc(current.warpStrength)}"><input name="weftStrength" type="text" inputmode="decimal" data-decimal="true" placeholder="Resistência de trama" value="${esc(current.weftStrength)}"><input name="foundGsm" type="text" inputmode="decimal" data-decimal="true" placeholder="Gramatura encontrada (g/m²)" value="${esc(current.foundGsm)}"><input name="foundWidthM" type="text" inputmode="decimal" data-decimal="true" placeholder="Largura encontrada (m)" value="${esc(current.foundWidthM)}"><input name="shrinkageWarp" type="text" inputmode="decimal" data-decimal="true" placeholder="Encolhimento urdume (%)" value="${esc(current.shrinkageWarp)}"><input name="shrinkageWeft" type="text" inputmode="decimal" data-decimal="true" placeholder="Encolhimento trama (%)" value="${esc(current.shrinkageWeft)}"><select name="qualityStatus"><option value="pending" ${current.qualityStatus === 'pending' || !current.qualityStatus ? 'selected' : ''}>Qualidade pendente</option><option value="approved" ${current.qualityStatus === 'approved' ? 'selected' : ''}>Aprovado</option><option value="rejected" ${current.qualityStatus === 'rejected' ? 'selected' : ''}>Reprovado</option></select><input name="qualityNotes" placeholder="Observações do laudo" value="${esc(current.qualityNotes)}"></div>`;
}
function lotWorkflowView() {
  const label = item => item.lotDecision === 'STOCK' ? 'Enviado ao estoque' : item.lotDecision === 'CUTTING' ? 'Enviado à confecção' : item.lotDecision === 'REJECTED' ? 'Recusado' : item.qualityStatus === 'approved' ? 'Aceito / aguardando destino' : item.qualityStatus === 'rejected' ? 'Reprovado' : 'Pendente de auditoria';
  const cls = item => item.lotDecision === 'REJECTED' || item.qualityStatus === 'rejected' ? 'rejected' : item.lotDecision === 'STOCK' || item.lotDecision === 'CUTTING' ? 'approved' : 'pending';
  return `<div class="gfp-title gfp-list-title"><b>Controle operacional dos lotes</b><small>Audite, aceite ou recuse e depois defina o destino do tecido.</small></div><table class="gfp-workflow-table"><thead><tr><th>Tecido / lote</th><th>Fornecedor</th><th>Qualidade</th><th>Destino</th><th>Observação</th><th>Ações</th></tr></thead><tbody>${data.incoming.map(item => { const f = fabric(item.fabricId) || {}; return `<tr><td><b>${esc(f.name || '—')}</b><small>Lote: ${esc(item.lot || '—')} • Cor: ${esc(item.colorRef || '—')} • ${num(item.qtyM)} m</small></td><td>${esc(item.supplier || '—')}</td><td><span class="gfp-quality-status ${cls(item)}">${label(item)}</span></td><td>${item.lotDecision === 'STOCK' ? 'ESTOQUE' : item.lotDecision === 'CUTTING' ? 'CONFECÇÃO' : item.lotDecision === 'REJECTED' ? 'RECUSADO' : '—'}</td><td>${esc(item.workflowNotes || item.qualityNotes || '—')}</td><td class="gfp-actions"><button type="button" data-gfp-lot-action="edit" data-gfp-lot-id="${esc(item.id)}">Editar / auditar</button><button type="button" data-gfp-lot-action="accept" data-gfp-lot-id="${esc(item.id)}">Aceitar</button><button type="button" data-gfp-lot-action="reject" data-gfp-lot-id="${esc(item.id)}">Recusar</button><button type="button" data-gfp-lot-action="stock" data-gfp-lot-id="${esc(item.id)}">Enviar estoque</button><button type="button" data-gfp-lot-action="cutting" data-gfp-lot-id="${esc(item.id)}">Enviar confecção</button></td></tr>`; }).join('') || '<tr><td colspan="6" class="gfp-empty">Nenhum lote lançado.</td></tr>'}</tbody></table>`;
}
function openLotEditor(id) {
  const item = data.incoming.find(row => row.id === id); if (!item) return;
  const modal = document.createElement('div'); modal.className = 'gfp-modal';
  modal.innerHTML = `<div class="gfp-modal-card"><button type="button" class="gfp-modal-close">×</button><h3>Auditar lote</h3><p>Edite os dados, descreva a ocorrência e defina a decisão do lote.</p><form id="gfp-lot-workflow-form" class="gfp-form"><input name="colorRef" placeholder="Referência da cor" value="${esc(item.colorRef)}" required><input name="lot" placeholder="Lote" value="${esc(item.lot)}" required><input name="qtyM" type="text" data-decimal="true" inputmode="decimal" placeholder="Quantidade (m)" value="${esc(item.qtyM)}" required><input name="pricePerM" type="text" data-decimal="true" inputmode="decimal" placeholder="Preço por metro" value="${esc(item.pricePerM)}"><input name="receivedDate" type="date" value="${esc(item.receivedDate)}"><select name="qualityStatus"><option value="pending" ${!item.qualityStatus || item.qualityStatus === 'pending' ? 'selected' : ''}>Pendente</option><option value="approved" ${item.qualityStatus === 'approved' ? 'selected' : ''}>Aceito</option><option value="rejected" ${item.qualityStatus === 'rejected' ? 'selected' : ''}>Reprovado</option></select><input name="warpStrength" type="text" data-decimal="true" inputmode="decimal" placeholder="Resistência urdume" value="${esc(item.warpStrength)}"><input name="weftStrength" type="text" data-decimal="true" inputmode="decimal" placeholder="Resistência trama" value="${esc(item.weftStrength)}"><input name="foundGsm" type="text" data-decimal="true" inputmode="decimal" placeholder="Gramatura encontrada" value="${esc(item.foundGsm)}"><input name="foundWidthM" type="text" data-decimal="true" inputmode="decimal" placeholder="Largura encontrada" value="${esc(item.foundWidthM)}"><textarea name="qualityNotes" placeholder="Descrição da análise / não conformidade">${esc(item.qualityNotes)}</textarea><textarea name="workflowNotes" placeholder="Observação da decisão e destino">${esc(item.workflowNotes)}</textarea><select name="lotDecision"><option value="" ${!item.lotDecision ? 'selected' : ''}>Sem destino definido</option><option value="STOCK" ${item.lotDecision === 'STOCK' ? 'selected' : ''}>Enviar para estoque</option><option value="CUTTING" ${item.lotDecision === 'CUTTING' ? 'selected' : ''}>Enviar para confecção</option><option value="REJECTED" ${item.lotDecision === 'REJECTED' ? 'selected' : ''}>Recusar lote</option></select><button>Salvar auditoria e decisão</button></form></div>`;
  document.body.appendChild(modal); const close = () => modal.remove(); modal.querySelector('.gfp-modal-close').onclick = close;
  modal.querySelector('form').addEventListener('submit', event => { event.preventDefault(); const values = Object.fromEntries(new FormData(event.target).entries()); Object.assign(item, { ...values, qtyM: parseDecimal(values.qtyM), pricePerM: parseDecimal(values.pricePerM), warpStrength: values.warpStrength ? parseDecimal(values.warpStrength) : '', weftStrength: values.weftStrength ? parseDecimal(values.weftStrength) : '', foundGsm: values.foundGsm ? parseDecimal(values.foundGsm) : '', foundWidthM: values.foundWidthM ? parseDecimal(values.foundWidthM) : '', auditedAt: new Date().toISOString() }); save(data); close(); renderOwn(); });
  prepareFabricInputs();
}
function summary() {
  const plans = data.requirements.map(requirementPlan);
  return { required: plans.reduce((s, x) => s + x.requiredM, 0), pending: plans.reduce((s, x) => s + x.pendingReleaseM, 0), buy: plans.reduce((s, x) => s + x.purchaseSuggestionM, 0) };
}
function supplierSummary() {
  const rows = data.fabrics.flatMap(f => suppliersFor(f.id).map(supplier => `<tr><td><b>${esc(f.name)}</b><small>${esc(f.code)}</small></td><td>${esc(supplier)}</td><td>${num(data.incoming.filter(item => item.fabricId === f.id && item.supplier === supplier && item.status !== 'cancelled').reduce((sum, item) => sum + Number(item.qtyM || 0), 0))} m</td></tr>`));
  return `<section class="gfp-suppliers"><div><b>Fornecedores por tecido</b><small>O mesmo tecido pode ter vários fornecedores. Cadastre cada um em um lote/entrada.</small></div>${rows.length ? `<table><thead><tr><th>Tecido</th><th>Fornecedor</th><th>Compra em aberto</th></tr></thead><tbody>${rows.join('')}</tbody></table>` : '<p class="gfp-muted">Nenhum fornecedor vinculado ainda. Use “Registrar compra / entrada por lote” e informe o fornecedor.</p>'}</section>`;
}
function panel() {
  const s = summary();
  return `<div class="gao-fabric-planning">
    <div class="gfp-head"><div><p>PLANEJAMENTO INDUSTRIAL</p><h3>Tecidos, compras e liberação para facção</h3><small>Estoque físico, compras em aberto, histórico de consumo e pedidos parciais.</small></div><span>GAO</span></div>
    <div class="gfp-cards"><article><small>Necessidade atual</small><strong>${num(s.required)} m</strong></article><article><small>Saldo pendente de tecido</small><strong>${num(s.pending)} m</strong></article><article><small>Sugestão de compra</small><strong>${num(s.buy)} m</strong></article></div>${supplierSummary()}
    <nav class="gfp-tabs"><button data-gfp-tab="purchase" class="${tab === 'purchase' ? 'active' : ''}">Compra de tecido</button><button data-gfp-tab="stock" class="${tab === 'stock' ? 'active' : ''}">Estoque organizado</button><button data-gfp-tab="partial" class="${tab === 'partial' ? 'active' : ''}">Liberação parcial</button><button data-gfp-tab="loss" class="${tab === 'loss' ? 'active' : ''}">Corte e rendimento</button></nav>
    ${tab === 'purchase' ? purchaseView() : ''}${tab === 'stock' ? stockView() : ''}${tab === 'partial' ? partialView() : ''}${tab === 'loss' ? lossView() : ''}
  </div>`;
}
function purchaseView() {
  return `<section class="gfp-box"><div class="gfp-title"><b>Necessidade de compra de tecido</b><small>Quando o material já estiver fisicamente no GAO, clique em <b>Está no estoque</b>. O sistema transfere a compra aberta para o estoque físico.</small></div><table><thead><tr><th>Tecido</th><th>Necessário agora</th><th>Disponível</th><th>Compra em aberto</th><th>Histórico médio</th><th>Saldo projetado</th><th>Comprar</th><th>Situação</th></tr></thead><tbody>${data.fabrics.length ? data.fabrics.map(f => { const plans = data.requirements.filter(r => r.fabricId === f.id).map(requirementPlan); const required = plans.reduce((s, x) => s + x.requiredM, 0); const open = incomingFor(f.id); const p = calculateFabricPlan({ stockM:f.stockM, reservedM:f.reservedM, blockedM:f.blockedM, incomingM:open, requiredM:required, averageMonthlyM:f.averageMonthlyM, safetyM:f.safetyM }); const hasOpen = data.incoming.some(item => item.fabricId === f.id && item.status !== 'cancelled' && !item.stockApplied && item.lotDecision !== 'STOCK'); return `<tr><td><b>${esc(f.name)}</b><small>${esc(f.code)}${f.color ? ` • ${esc(f.color)}` : ''}</small></td><td>${num(required)} m</td><td>${num(p.availableM)} m</td><td>${num(open)} m</td><td>${num(f.averageMonthlyM)} m</td><td>${num(p.projectedM)} m</td><td class="gfp-buy">${num(p.purchaseSuggestionM)} m</td><td>${hasOpen ? `<button type="button" class="gfp-stock-action" data-gfp-mark-fabric-stock="${esc(f.id)}">Está no estoque</button>` : '<span class="gfp-quality-status approved">Estoque atualizado</span>'}</td></tr>`; }).join('') : '<tr><td colspan="8" class="gfp-empty">Cadastre os tecidos para calcular a compra.</td></tr>'}</tbody></table><form data-gfp-form="fabric" class="gfp-form"><b>Cadastrar produto tecido</b><input name="code" placeholder="Código" required><input name="name" placeholder="Nome do tecido" required><input name="composition" placeholder="Composição"><input name="color" placeholder="Cor"><input name="widthM" type="number" step="0.001" min="0" placeholder="Largura (m)"><input name="gsm" type="number" step="0.1" min="0" placeholder="Gramatura (g/m²)"><input name="stockM" type="number" step="0.001" min="0" placeholder="Estoque inicial (m)" required><input name="reservedM" type="number" step="0.001" min="0" placeholder="Reservado (m)"><input name="blockedM" type="number" step="0.001" min="0" placeholder="Bloqueado (m)"><input name="averageMonthlyM" type="number" step="0.001" min="0" placeholder="Média mensal (m)"><input name="safetyM" type="number" step="0.001" min="0" placeholder="Estoque segurança (m)"><button>Salvar produto tecido</button></form></section>`;
}
function stockView() {
  const fabricRows = data.fabrics.map(f => { const p = calculateFabricPlan({stockM:f.stockM,reservedM:f.reservedM,blockedM:f.blockedM}); return `<tr><td>${esc(f.code)}</td><td><b>${esc(f.name)}</b><small>${esc(f.composition || 'Composição não informada')} • ${num(f.widthM)} m largura • ${num(f.gsm)} g/m²</small></td><td>${num(f.stockM)} m</td><td>${num(f.reservedM)} m</td><td>${num(f.blockedM)} m</td><td><b>${num(p.availableM)} m</b></td><td>${num(incomingFor(f.id))} m</td></tr>`; }).join('');
  const lotRows = data.incoming.filter(item => item.status !== 'cancelled').map(item => { const f = fabric(item.fabricId) || {}; const applied = Boolean(item.stockApplied || item.lotDecision === 'STOCK'); return `<tr><td><b>${esc(f.name || '—')}</b><small>Lote ${esc(item.lot || '—')}</small></td><td>${esc(item.supplier || '—')}</td><td>${num(item.qtyM)} m</td><td>${applied ? '<span class="gfp-quality-status approved">Já considerado</span>' : '<span class="gfp-quality-status pending">Fora do estoque</span>'}</td><td>${applied ? '—' : `<button type="button" class="gfp-stock-action" data-gfp-mark-stock="${esc(item.id)}">Considerar no estoque</button>`}</td></tr>`; }).join('');
  return `<section class="gfp-box"><div class="gfp-title"><b>Estoque de tecidos</b><small>Para uma entrada que já está fisicamente no GAO, use “Considerar no estoque”. O lote será somado uma única vez ao físico e deixará de aparecer como compra em aberto.</small></div><table><thead><tr><th>Código</th><th>Tecido</th><th>Físico</th><th>Reservado</th><th>Bloqueado</th><th>Disponível</th><th>Compras abertas</th></tr></thead><tbody>${fabricRows || '<tr><td colspan="7" class="gfp-empty">Nenhum tecido cadastrado.</td></tr>'}</tbody></table><div class="gfp-title gfp-list-title"><b>Entradas e lotes</b><small>Marque aqui os materiais que já estão no estoque físico.</small></div><table class="gfp-stock-lots"><thead><tr><th>Tecido / lote</th><th>Fornecedor</th><th>Quantidade</th><th>Situação</th><th>Ação</th></tr></thead><tbody>${lotRows || '<tr><td colspan="5" class="gfp-empty">Nenhum lote registrado.</td></tr>'}</tbody></table><form data-gfp-form="incoming" class="gfp-form"><b>Registrar compra / entrada por lote</b><select name="fabricId" required><option value="">Escolha o tecido</option>${selectFabrics()}</select><select name="supplierId" required><option value="">Selecione o fornecedor cadastrado</option>${data.suppliers.map(s => `<option value="${esc(s.id)}">${esc(s.tradeName || s.legalName)}</option>`).join('')}</select><input name="lot" placeholder="Lote" required><input name="invoice" placeholder="Nota fiscal"><input name="qtyM" type="text" inputmode="decimal" data-decimal="true" placeholder="Quantidade (m)" required><input name="pricePerM" type="text" inputmode="decimal" data-decimal="true" placeholder="Preço por metro" required><input name="freight" type="text" inputmode="decimal" data-decimal="true" placeholder="Frete"><input name="otherCost" type="text" inputmode="decimal" data-decimal="true" placeholder="Outros custos"><input name="expectedDate" type="date" required><input name="receivedDate" type="date" placeholder="Data recebimento"><select name="status"><option value="confirmed">Confirmada</option><option value="partial">Parcial</option><option value="cancelled">Cancelada</option></select><button>Adicionar lote</button></form></section>`;
}
function partialView() {
  return `<section class="gfp-box"><div class="gfp-title"><b>Liberação parcial para facção</b><small>Confira o tecido disponível e clique em <b>Enviar para facção</b>. O sistema registra a quantidade liberada e a data do envio.</small></div><table><thead><tr><th>Peça / tecido</th><th>Quantidade</th><th>Consumo total</th><th>Disponível agora</th><th>Liberar agora</th><th>Pendente</th><th>Status</th><th>Ação</th></tr></thead><tbody>${data.requirements.map(requirementPlan).map(p => { const sent = n(p.releasedM); const canSend = Math.max(0, p.releaseNowM - sent); return `<tr><td><b>${esc(p.product)}</b><small>${esc(p.fabric?.name || 'Tecido não cadastrado')}</small></td><td>${num(p.qtyPieces)} pç</td><td>${num(p.requiredM)} m</td><td>${num(p.availableM)} m</td><td>${num(canSend)} m</td><td class="gfp-pending">${num(Math.max(0, p.pendingReleaseM - sent))} m</td><td><span class="gfp-status ${canSend ? 'partial' : 'ready'}">${canSend ? (sent ? 'Parcial' : 'Aguardando envio') : 'Enviado'}</span></td><td>${canSend ? `<button type="button" class="gfp-stock-action" data-gfp-release-fabric="${esc(p.id)}">Enviar para facção</button>` : '<span class="gfp-quality-status approved">Enviado</span>'}</td></tr>`; }).join('') || '<tr><td colspan="8" class="gfp-empty">Cadastre uma necessidade de produção.</td></tr>'}</tbody></table><form data-gfp-form="requirement" class="gfp-form"><b>Adicionar necessidade da facção</b><input name="product" placeholder="Peça/produto" required><select name="fabricId" required><option value="">Escolha o tecido</option>${selectFabrics()}</select><input name="qtyPieces" type="number" min="1" step="1" placeholder="Quantidade de peças" required><input name="consumptionM" type="number" min="0.001" step="0.001" placeholder="Consumo por peça (m)" required><button>Calcular liberação</button></form></section>`;
}
function lossView() {
  return `<section class="gfp-box"><div class="gfp-title"><b>Corte, rendimento e perda</b><small>Registre o consumo teórico e real para medir a perda do lote.</small></div><form data-gfp-form="loss" class="gfp-form"><input name="theoreticalM" type="number" min="0" step="0.001" placeholder="Consumo teórico (m)" required><input name="actualM" type="number" min="0" step="0.001" placeholder="Consumo real (m)" required><button>Calcular rendimento</button></form><div id="gfp-loss-result" class="gfp-result">Informe os metros teóricos e reais para calcular a perda.</div></section>`;
}
function renderOwn() { const host = document.querySelector('#gao-fabric-planning-host'); if (host) host.innerHTML = panel(); bindOwn(); }
function bindOwn() {
  document.querySelectorAll('[data-gfp-tab]').forEach(button => button.addEventListener('click', () => { tab = button.dataset.gfpTab; renderOwn(); }));
  document.querySelectorAll('[data-gfp-form]').forEach(form => form.addEventListener('submit', event => { event.preventDefault(); const values = Object.fromEntries(new FormData(form).entries()); if (form.dataset.gfpForm === 'fabric') data.fabrics.push({ ...values, id: crypto.randomUUID(), stockM:+values.stockM, reservedM:+values.reservedM||0, blockedM:+values.blockedM||0, averageMonthlyM:+values.averageMonthlyM||0, safetyM:+values.safetyM||0 }); if (form.dataset.gfpForm === 'incoming') data.incoming.push({ ...values, id: crypto.randomUUID(), qtyM:+values.qtyM }); if (form.dataset.gfpForm === 'requirement') data.requirements.push({ ...values, id: crypto.randomUUID(), qtyPieces:+values.qtyPieces, consumptionM:+values.consumptionM }); if (form.dataset.gfpForm === 'loss') { const result = calculateLoss(values); const target = document.querySelector('#gfp-loss-result'); if (target) target.innerHTML = `<b>Perda:</b> ${num(result.lossM)} m (${num(result.lossPercent)}%) · <b>Rendimento:</b> ${num(result.yieldPercent)}%`; return; } save(data); renderOwn(); }));
}
function mount() {
  if (!location.pathname.startsWith('/enxoval-tecidos/tecidos')) return;
  const tabs = [...document.querySelectorAll('.supplier-tabs')].find(item => /Tecidos, consumo e corte/i.test(item.closest('section')?.textContent || item.parentElement?.textContent || '')) || document.querySelector('.supplier-tabs');
  const panelHost = tabs?.closest('section.data-panel') || tabs?.parentElement;
  if (!panelHost || !tabs) return;
  let button = tabs.querySelector('[data-gfp-open]');
  let own = panelHost.querySelector('#gao-fabric-planning-host');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Compras de tecido';
    button.dataset.gfpOpen = 'true';
    tabs.appendChild(button);
  }
  if (!own) {
    own = document.createElement('div');
    own.id = 'gao-fabric-planning-host';
    own.hidden = true;
    panelHost.appendChild(own);
  }
  const showOwn = active => {
    [...panelHost.children].forEach(node => { if (node !== own && node !== tabs) node.hidden = active; });
    panelHost.classList.toggle('gfp-only-active', active);
    if (active) tabs.querySelectorAll('button:not([data-gfp-open])').forEach(item => item.classList.remove('active'));
    own.hidden = !active;
    button.classList.toggle('active', active);
    if (active) renderOwn();
  };
  if (button.dataset.gfpBound !== 'true') {
    button.dataset.gfpBound = 'true';
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); showOwn(true); }, true);
  }
  tabs.querySelectorAll('button:not([data-gfp-open])').forEach(item => {
    if (item.dataset.gfpBound === 'true') return;
    item.dataset.gfpBound = 'true';
    const isFabricCoreTab = /^Tecidos$/i.test(item.textContent.trim());
    item.addEventListener('click', event => { if (isFabricCoreTab) { event.preventDefault(); event.stopPropagation(); showOwn(true); } else showOwn(false); }, true);
  });
  const fabricCoreTab = [...tabs.querySelectorAll('button:not([data-gfp-open])')].find(item => /^Tecidos$/i.test(item.textContent.trim()));
  if (fabricCoreTab?.classList.contains('active') && own.hidden) showOwn(true);
  if (!panelHost.dataset.gfpObserved) {
    panelHost.dataset.gfpObserved = 'true';
    const observer = new MutationObserver(() => {
      if (!own.isConnected || own.hidden) return;
      [...panelHost.children].forEach(node => { if (node !== own && node !== tabs) node.hidden = true; });
      panelHost.classList.add('gfp-only-active');
      button.classList.add('active');
    });
    observer.observe(panelHost, { childList: true, subtree: true });
  }
}
// Layout final: cada tipo de informação fica em uma tela própria.
function catalogView() {
  return `<section class="gfp-box"><div class="gfp-title"><b>Cadastro de tecidos</b><small>Cadastre o tecido uma única vez. Fornecedor e lote ficam na tela seguinte.</small></div><table><thead><tr><th>Código</th><th>Tecido</th><th>Composição</th><th>Largura</th><th>Gramatura</th><th>Estoque mínimo</th></tr></thead><tbody>${data.fabrics.map(f => `<tr><td>${esc(f.code)}</td><td><b>${esc(f.name)}</b><small>${esc(f.color || '')}</small></td><td>${esc(f.composition || '—')}</td><td>${num(f.widthM)} m</td><td>${num(f.gsm)} g/m²</td><td>${num(f.safetyM)} m</td></tr>`).join('') || '<tr><td colspan="6" class="gfp-empty">Nenhum tecido cadastrado.</td></tr>'}</tbody></table><form data-gfp-form="fabric" class="gfp-form"><b>Novo tecido</b><input name="code" placeholder="Código" required><input name="name" placeholder="Nome do tecido" required><input name="composition" placeholder="Composição"><input name="color" placeholder="Cor"><input name="widthM" type="number" step="0.001" min="0" placeholder="Largura (m)"><input name="gsm" type="number" step="0.1" min="0" placeholder="Gramatura (g/m²)"><input name="stockM" type="number" step="0.001" min="0" placeholder="Estoque inicial (m)" required><input name="reservedM" type="number" step="0.001" min="0" placeholder="Reservado (m)"><input name="blockedM" type="number" step="0.001" min="0" placeholder="Bloqueado (m)"><input name="averageMonthlyM" type="number" step="0.001" min="0" placeholder="Média mensal (m)"><input name="safetyM" type="number" step="0.001" min="0" placeholder="Estoque mínimo (m)"><button>Salvar tecido</button></form></section>`;
}
function supplierView() {
  return `<section class="gfp-box"><div class="gfp-title"><b>Fornecedores e lotes</b><small>O mesmo tecido pode ter vários fornecedores, cada um com lote, preço e prazo próprios.</small></div><table><thead><tr><th>Tecido</th><th>Fornecedor</th><th>Lote</th><th>Quantidade</th><th>Preço/m</th><th>Chegada</th><th>Status</th></tr></thead><tbody>${data.incoming.map(item => { const f = fabric(item.fabricId) || {}; return `<tr><td>${esc(f.name || '—')}</td><td><b>${esc(item.supplier)}</b></td><td>${esc(item.lot)}</td><td>${num(item.qtyM)} m</td><td>R$ ${num(item.pricePerM)}</td><td>${esc(item.expectedDate || '—')}</td><td>${esc(item.status || '—')}</td></tr>`; }).join('') || '<tr><td colspan="7" class="gfp-empty">Nenhum fornecedor/lote registrado.</td></tr>'}</tbody></table><form data-gfp-form="incoming" class="gfp-form"><b>Vincular fornecedor e lote</b><select name="fabricId" required><option value="">Escolha o tecido</option>${selectFabrics()}</select><input name="supplier" placeholder="Fornecedor" required><input name="lot" placeholder="Lote" required><input name="qtyM" type="number" step="0.001" min="0.001" placeholder="Quantidade (m)" required><input name="pricePerM" type="number" step="0.01" min="0" placeholder="Preço por metro" required><input name="freight" type="number" step="0.01" min="0" placeholder="Frete"><input name="otherCost" type="number" step="0.01" min="0" placeholder="Outros custos"><input name="invoice" placeholder="Nota fiscal"><input name="expectedDate" type="date" required><input name="receivedDate" type="date" placeholder="Recebimento"><select name="status"><option value="confirmed">Confirmada</option><option value="partial">Parcial</option><option value="cancelled">Cancelada</option></select><button>Salvar lote</button></form></section>`;
}
function productionView() {
  const rows = data.incoming.filter(item => item.lotDecision === 'CUTTING' || item.releaseStatus === 'PARTIAL' || item.releaseStatus === 'SENT').map(item => { const f = fabric(item.fabricId) || {}; return `<tr><td><b>${esc(f.name || '—')}</b><small>Código: ${esc(f.code || '—')} • Lote: ${esc(item.lot || '—')}</small></td><td>${esc(item.supplier || '—')}</td><td>${num(item.qtyM)} m</td><td>${esc(item.colorRef || '—')}</td><td><span class="gfp-quality-status approved">EM CONFECÇÃO</span></td><td>${esc(item.auditedAt ? new Date(item.auditedAt).toLocaleDateString('pt-BR') : '—')}</td></tr>`; }).join('');
  const released = data.requirements.filter(item => n(item.releasedM) > 0).map(item => { const f = fabric(item.fabricId) || {}; return `<tr><td><b>${esc(item.product || '—')}</b><small>${esc(f.name || 'Tecido não cadastrado')}</small></td><td>${num(item.releasedM)} m</td><td>${esc(item.releasedAt ? new Date(item.releasedAt).toLocaleDateString('pt-BR') : '—')}</td><td><span class="gfp-quality-status approved">ENVIADO PARA FACÇÃO</span></td></tr>`; }).join('');
  return `<section class="gfp-box"><div class="gfp-title"><b>Confecção / facção</b><small>Centraliza tudo que já saiu do estoque para produção. Nada desaparece: cada movimento permanece com lote, quantidade e data.</small></div><h4 class="gfp-subtitle">Lotes liberados para confecção</h4><table><thead><tr><th>Tecido / lote</th><th>Fornecedor</th><th>Quantidade</th><th>Cor</th><th>Status</th><th>Data</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="gfp-empty">Nenhum lote enviado para confecção.</td></tr>'}</tbody></table><h4 class="gfp-subtitle">Liberações para facção</h4><table><thead><tr><th>Peça</th><th>Metros enviados</th><th>Data</th><th>Status</th></tr></thead><tbody>${released || '<tr><td colspan="4" class="gfp-empty">Nenhuma liberação enviada para facção.</td></tr>'}</tbody></table></section>`;
}
function purchaseView() {
  return `<section class="gfp-box"><div class="gfp-title"><b>Necessidade de compra</b><small>“Disponível” é o estoque físico. Compras em aberto ficam separadas e não são repetidas em outra coluna.</small></div><table><thead><tr><th>Tecido</th><th>Necessário agora</th><th>Disponível</th><th>Compras em aberto</th><th>Histórico médio</th><th>Comprar</th><th>Situação</th></tr></thead><tbody>${data.fabrics.map(f => { const required = data.requirements.filter(r => r.fabricId === f.id).map(requirementPlan).reduce((s, x) => s + x.requiredM, 0); const open = incomingFor(f.id); const p = calculateFabricPlan({ stockM:f.stockM, reservedM:f.reservedM, blockedM:f.blockedM, incomingM:open, requiredM:required, averageMonthlyM:f.averageMonthlyM, safetyM:f.safetyM }); const hasOpen = data.incoming.some(item => item.fabricId === f.id && item.status !== 'cancelled' && !item.stockApplied && item.lotDecision !== 'STOCK'); const status = hasOpen ? `<button type="button" class="gfp-stock-action" data-gfp-mark-fabric-stock="${esc(f.id)}">Está no estoque</button>` : p.availableM > 0 ? '<span class="gfp-quality-status approved">Está no estoque</span>' : '<span class="gfp-quality-status pending">Sem estoque</span>'; return `<tr><td><b>${esc(f.name)}</b><small>${esc(f.code)}</small></td><td>${num(required)} m</td><td>${num(p.availableM)} m</td><td>${num(open)} m</td><td>${num(f.averageMonthlyM)} m</td><td class="gfp-buy">${num(p.purchaseSuggestionM)} m</td><td>${status}</td></tr>`; }).join('') || '<tr><td colspan="7" class="gfp-empty">Cadastre os tecidos para calcular a compra.</td></tr>'}</tbody></table></section>`;
}
function panel() {
  const s = summary();
  return `<div class="gao-fabric-planning"><div class="gfp-head"><div><p>PLANEJAMENTO INDUSTRIAL</p><h3>Tecidos, compras e liberação para facção</h3><small>Cadastro, fornecedores, compras e corte em fluxos separados.</small></div><span>GAO</span></div><div class="gfp-cards"><article><small>Necessidade atual</small><strong>${num(s.required)} m</strong></article><article><small>Saldo pendente</small><strong>${num(s.pending)} m</strong></article><article><small>Sugestão de compra</small><strong>${num(s.buy)} m</strong></article></div><nav class="gfp-tabs"><button data-gfp-tab="catalog" class="${tab === 'catalog' ? 'active' : ''}">Cadastro de tecidos</button><button data-gfp-tab="suppliers" class="${tab === 'suppliers' ? 'active' : ''}">Fornecedores e lotes</button><button data-gfp-tab="purchase" class="${tab === 'purchase' ? 'active' : ''}">Necessidade de compra</button><button data-gfp-tab="partial" class="${tab === 'partial' ? 'active' : ''}">Liberação parcial</button><button data-gfp-tab="production" class="${tab === 'production' ? 'active' : ''}>Confecção / facção</button><button data-gfp-tab="loss" class="${tab === 'loss' ? 'active' : ''}">Corte e rendimento</button></nav>${tab === 'catalog' ? catalogView() : ''}${tab === 'suppliers' ? supplierView() : ''}${tab === 'purchase' ? purchaseView() : ''}${tab === 'partial' ? partialView() : ''}${tab === 'production' ? productionView() : ''}${tab === 'loss' ? lossView() : ''}</div>`;
}
function catalogView() {
  return `<section class="gfp-box"><div class="gfp-title"><b>Novo tecido</b><small>Aqui entram somente as características permanentes do produto.</small></div><form data-gfp-form="fabric" class="gfp-form gfp-form-first"><input name="code" placeholder="Código" required><input name="name" placeholder="Nome do tecido" required><input name="composition" placeholder="Composição"><input name="color" placeholder="Cor"><input name="widthM" type="number" step="0.001" min="0" placeholder="Largura (m)"><input name="gsm" type="number" step="0.1" min="0" placeholder="Gramatura (g/m²)"><button>Salvar tecido</button></form><div class="gfp-title gfp-list-title"><b>Tecidos cadastrados</b><small>Consulta dos tecidos já registrados.</small></div><table><thead><tr><th>Código</th><th>Tecido</th><th>Composição</th><th>Cor</th><th>Largura</th><th>Gramatura</th></tr></thead><tbody>${data.fabrics.map(f => `<tr><td>${esc(f.code)}</td><td><b>${esc(f.name)}</b></td><td>${esc(f.composition || '—')}</td><td>${esc(f.color || '—')}</td><td>${num(f.widthM)} m</td><td>${num(f.gsm)} g/m²</td></tr>`).join('') || '<tr><td colspan="6" class="gfp-empty">Nenhum tecido cadastrado.</td></tr>'}</tbody></table></section>`;
}
function supplierView() {
  return `<section class="gfp-box"><div class="gfp-title"><b>Cadastro de fornecedores</b><small>Cadastre o fornecedor uma única vez e use-o em vários tecidos.</small></div><form data-gfp-form="supplier" class="gfp-form"><input name="legalName" placeholder="Razão social" required><input name="tradeName" placeholder="Nome fantasia"><input name="cnpj" placeholder="CNPJ"><input name="contact" placeholder="Contato"><input name="paymentTerms" placeholder="Condição de pagamento"><input name="leadDays" type="number" min="0" step="1" placeholder="Prazo de entrega (dias)"><button>Salvar fornecedor</button></form><table><thead><tr><th>Fornecedor</th><th>CNPJ</th><th>Contato</th><th>Prazo</th><th>Status</th></tr></thead><tbody>${data.suppliers.map(s => `<tr><td><b>${esc(s.tradeName || s.legalName)}</b><small>${esc(s.legalName)}</small></td><td>${esc(s.cnpj || '—')}</td><td>${esc(s.contact || '—')}</td><td>${esc(s.leadDays || '—')} dias</td><td>Ativo</td></tr>`).join('') || '<tr><td colspan="5" class="gfp-empty">Nenhum fornecedor cadastrado.</td></tr>'}</tbody></table><div class="gfp-title gfp-list-title"><b>Importar produtos da NF-e (XML)</b><small>O sistema lê fornecedor, produtos, códigos, quantidades, lotes e valores.</small></div><form data-gfp-form="xml" class="gfp-form"><input name="xmlFile" type="file" accept=".xml,text/xml,application/xml" required><button>Processar XML</button></form>${data.xmlProducts.length ? `<table><thead><tr><th>Produto</th><th>Código</th><th>Fornecedor</th><th>Quantidade</th><th>Valor unitário</th><th>Lote</th><th>NF</th></tr></thead><tbody>${data.xmlProducts.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.code || '—')}</td><td>${esc(p.supplier || '—')}</td><td>${num(p.quantity)} ${esc(p.unit || '')}</td><td>R$ ${num(p.unitPrice)}</td><td>${esc(p.lot || '—')}</td><td>${esc(p.invoice || '—')}</td></tr>`).join('')}</tbody></table>` : '<p class="gfp-muted">Nenhum produto importado por XML.</p>'}<div class="gfp-title gfp-list-title"><b>Entrada manual por lote e análise de qualidade</b><small>Selecione o fornecedor cadastrado; ele será gravado automaticamente no lote. A análise fica vinculada ao lote recebido.</small></div><form data-gfp-form="incoming" class="gfp-form"><select name="fabricId" required><option value="">Escolha o tecido</option>${selectFabrics()}</select><select name="supplierId" required><option value="">Selecione o fornecedor cadastrado</option>${data.suppliers.map(s => `<option value="${esc(s.id)}">${esc(s.tradeName || s.legalName)}</option>`).join('')}</select><input name="colorRef" placeholder="Referência da cor" required><input name="lot" placeholder="Lote" required><input name="qtyM" type="text" inputmode="decimal" data-decimal="true" placeholder="Quantidade (m)" required><input name="pricePerM" type="text" inputmode="decimal" data-decimal="true" placeholder="Preço por metro" required><input name="expectedDate" type="date" required><select name="status"><option value="confirmed">Confirmada</option><option value="partial">Parcial</option><option value="cancelled">Cancelada</option></select>${qualityFields()}<button>Salvar lote e análise</button></form><div class="gfp-title gfp-list-title"><b>Histórico de análises por lote</b><small>Assim é possível auditar o que foi medido em cada recebimento.</small></div><table><thead><tr><th>Tecido / lote</th><th>Fornecedor</th><th>Gramatura encontrada</th><th>Resistência trama</th><th>Resistência urdume</th><th>Resultado</th></tr></thead><tbody>${data.incoming.map(item => { const f = fabric(item.fabricId) || {}; return `<tr><td><b>${esc(f.name || '—')}</b><small>${esc(item.lot || '—')} • cor ${esc(item.colorRef || '—')}</small></td><td>${esc(item.supplier || '—')}</td><td>${item.foundGsm ? `${num(item.foundGsm)} g/m²` : '—'}</td><td>${esc(item.weftStrength || '—')}</td><td>${esc(item.warpStrength || '—')}</td><td><span class="gfp-quality-status ${esc(item.qualityStatus || 'pending')}">${item.qualityStatus === 'approved' ? 'Aprovado' : item.qualityStatus === 'rejected' ? 'Reprovado' : 'Pendente'}</span></td></tr>`; }).join('') || '<tr><td colspan="6" class="gfp-empty">Nenhuma análise de lote registrada.</td></tr>'}</tbody></table></section>`;
}
function xmlValue(node, local) {
  const found = node?.getElementsByTagNameNS?.('*', local)?.[0] || node?.getElementsByTagName?.(local)?.[0];
  return found?.textContent?.trim() || '';
}
function parseNfeXml(text) {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('XML inválido');
  const emit = xml.getElementsByTagNameNS('*', 'emit')[0] || xml.getElementsByTagName('emit')[0];
  const supplier = { legalName: xmlValue(emit, 'xNome'), tradeName: xmlValue(emit, 'xFant'), cnpj: xmlValue(emit, 'CNPJ') };
  const invoice = xmlValue(xml, 'nNF');
  const products = [...(xml.getElementsByTagNameNS('*', 'det').length ? xml.getElementsByTagNameNS('*', 'det') : xml.getElementsByTagName('det'))].map(det => { const prod = det.getElementsByTagNameNS('*', 'prod')[0] || det.getElementsByTagName('prod')[0] || det; return { code: xmlValue(prod, 'cProd'), name: xmlValue(prod, 'xProd'), unit: xmlValue(prod, 'uCom'), quantity: Number(String(xmlValue(prod, 'qCom')).replace(',', '.')) || 0, unitPrice: Number(String(xmlValue(prod, 'vUnCom')).replace(',', '.')) || 0, lot: xmlValue(det, 'nLote') || xmlValue(prod, 'nLote'), supplier: supplier.tradeName || supplier.legalName, cnpj: supplier.cnpj, invoice }; });
  return { supplier, products, invoice };
}
function bindOwn() {
  document.querySelectorAll('[data-gfp-tab]').forEach(button => button.addEventListener('click', () => { tab = button.dataset.gfpTab; renderOwn(); }));
  document.querySelectorAll('[data-gfp-form]').forEach(form => form.addEventListener('submit', async event => { event.preventDefault(); const values = Object.fromEntries(new FormData(form).entries());
    if (form.dataset.gfpForm === 'xml') { try { const file = form.querySelector('input[type=file]')?.files?.[0]; if (!file) return; const parsed = parseNfeXml(await file.text()); const existing = data.suppliers.find(s => s.cnpj && s.cnpj === parsed.supplier.cnpj); const supplier = existing || { ...parsed.supplier, id: crypto.randomUUID(), contact: '', paymentTerms: '', leadDays: 0 }; if (!existing) data.suppliers.push(supplier); data.xmlProducts.push(...parsed.products.map(item => ({ ...item, importedAt: new Date().toISOString() }))); save(data); renderOwn(); } catch (error) { alert(`Não foi possível ler o XML: ${error.message}`); } return; }
    if (form.dataset.gfpForm === 'structure') { const value = String(values.structure || '').trim().toUpperCase(); if (value && !(data.structures || []).includes(value)) data.structures.push(value); save(data); renderOwn(); return; }
    if (form.dataset.gfpForm === 'fabricType') { const value = String(values.fabricType || '').trim().toUpperCase(); if (value && !(data.fabricTypes || []).includes(value)) data.fabricTypes.push(value); save(data); renderOwn(); return; }
    if (form.dataset.gfpForm === 'supplier') data.suppliers.push({ ...values, id: crypto.randomUUID() });
    if (form.dataset.gfpForm === 'fabric') data.fabrics.push({ ...values, id: crypto.randomUUID(), fabricType: values.fabricType || 'OUTRO', weave: values.weave || '', stockM: 0, reservedM: 0, blockedM: 0, averageMonthlyM: 0, safetyM: 0 });
    if (form.dataset.gfpForm === 'incoming') { const supplierRecord = data.suppliers.find(item => item.id === values.supplierId); data.incoming.push({ ...values, supplier: supplierRecord?.tradeName || supplierRecord?.legalName || '', id: crypto.randomUUID(), qtyM: parseDecimal(values.qtyM), pricePerM: parseDecimal(values.pricePerM), freight: parseDecimal(values.freight), otherCost: parseDecimal(values.otherCost), foundGsm: parseDecimal(values.foundGsm), foundWidthM: parseDecimal(values.foundWidthM), warpStrength: values.warpStrength ? parseDecimal(values.warpStrength) : '', weftStrength: values.weftStrength ? parseDecimal(values.weftStrength) : '', shrinkageWarp: values.shrinkageWarp ? parseDecimal(values.shrinkageWarp) : '', shrinkageWeft: values.shrinkageWeft ? parseDecimal(values.shrinkageWeft) : '' }); }
    if (form.dataset.gfpForm === 'requirement') data.requirements.push({ ...values, id: crypto.randomUUID(), qtyPieces: +values.qtyPieces, consumptionM: +values.consumptionM });
    if (form.dataset.gfpForm === 'loss') { const result = calculateLoss(values); const target = document.querySelector('#gfp-loss-result'); if (target) target.innerHTML = `<b>Perda:</b> ${num(result.lossM)} m (${num(result.lossPercent)}%) · <b>Rendimento:</b> ${num(result.yieldPercent)}%`; return; }
    save(data); renderOwn();
  }));
}
function parseDecimal(value) {
  const text = String(value ?? '').trim().replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
}
function prepareFabricInputs() {
  document.querySelectorAll('#gao-fabric-planning-host input').forEach(input => {
    if (input.type === 'text' || input.tagName === 'TEXTAREA') input.style.textTransform = 'uppercase';
    if (['widthM','gsm','qtyM','pricePerM','freight','otherCost','leadDays','foundGsm','foundWidthM','warpStrength','weftStrength','shrinkageWarp','shrinkageWeft'].includes(input.name)) {
      input.dataset.decimal = 'true';
      input.type = 'text';
      input.inputMode = 'decimal';
    }
  });
  document.querySelectorAll('#gao-fabric-planning-host form[data-gfp-form="fabric"]').forEach(form => {
    const type = form.querySelector('[name="fabricType"]');
    const weave = form.querySelector('[name="weave"]');
    if (type && weave) weave.required = type.value === 'BRIM PESADA' || type.value === 'SARJA';
  });
}
document.addEventListener('change', event => {
  const customType = event.target.closest?.('#gao-fabric-planning-host [name="fabricType"]');
  if (customType && customType.value === '__custom__') { customType.value = ''; const field = document.querySelector('#gao-fabric-planning-host [data-gfp-form="fabricType"] input[name="fabricType"]'); field?.focus(); }
  const custom = event.target.closest?.('#gao-fabric-planning-host [name="weave"]');
  if (custom && custom.value === '__custom__') { custom.value = ''; const field = document.querySelector('#gao-fabric-planning-host [data-gfp-form="structure"] input[name="structure"]'); field?.focus(); }
  const type = event.target.closest?.('#gao-fabric-planning-host [name="fabricType"]');
  if (!type) return;
  const weave = type.form?.querySelector('[name="weave"]');
  if (weave) weave.required = type.value === 'BRIM PESADA' || type.value === 'SARJA';
}, true);
document.addEventListener('click', event => {
  const tabButton = event.target.closest?.('#gao-fabric-planning-host [data-gfp-tab]');
  if (tabButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    tab = tabButton.dataset.gfpTab;
    renderOwn();
    return;
  }
  const typeButton = event.target.closest?.('[data-gfp-delete-fabric-type]');
  if (typeButton) {
    const value = typeButton.dataset.gfpDeleteFabricType;
    if ((data.fabrics || []).some(item => item.fabricType === value)) { alert('Esse tipo está vinculado a um tecido e não pode ser excluído.'); return; }
    data.fabricTypes = (data.fabricTypes || []).filter(item => item !== value);
    save(data);
    renderOwn();
    return;
  }
  const button = event.target.closest?.('[data-gfp-delete-structure]');
  if (!button) return;
  const value = button.dataset.gfpDeleteStructure;
  if ((data.fabrics || []).some(item => item.weave === value)) { alert('Essa referência está vinculada a um tecido e não pode ser excluída.'); return; }
  data.structures = (data.structures || []).filter(item => item !== value);
  save(data);
  renderOwn();
}, true);
document.addEventListener('input', event => {
  const input = event.target;
  if (!input || !input.closest?.('#gao-fabric-planning-host')) return;
  if (input.type === 'text' && input.name !== 'xmlFile' && !input.dataset.decimal) input.value = input.value.toUpperCase();
  if (input.dataset.decimal) input.value = input.value.replace(/[^0-9,.\-]/g, '');
});
document.addEventListener('submit', event => {
  const form = event.target;
  if (!form.closest?.('#gao-fabric-planning-host')) return;
  form.querySelectorAll('input[data-decimal]').forEach(input => { input.value = String(parseDecimal(input.value)); });
  form.querySelectorAll('input[type="text"]:not([data-decimal]):not([name="xmlFile"])').forEach(input => { input.value = input.value.toUpperCase(); });
}, true);
document.addEventListener('click', event => {
  const button = event.target.closest?.('[data-gfp-edit-fabric]');
  if (!button) return;
  event.preventDefault();
  editingFabricId = button.dataset.gfpEditFabric;
  renderOwn();
}, true);
document.addEventListener('submit', event => {
  const form = event.target;
  if (!form.closest?.('#gao-fabric-planning-host') || form.dataset.gfpForm !== 'fabric' || !editingFabricId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const values = Object.fromEntries(new FormData(form).entries());
  const target = data.fabrics.find(item => item.id === editingFabricId);
  if (target) Object.assign(target, { code: values.code, name: values.name, fabricType: values.fabricType || 'OUTRO', weave: values.weave || '', composition: values.composition, color: values.color, widthM: parseDecimal(values.widthM), gsm: parseDecimal(values.gsm) });
  save(data);
  editingFabricId = null;
  renderOwn();
}, true);
function catalogView() {
  const current = data.fabrics.find(item => item.id === editingFabricId) || {};
  const editing = Boolean(editingFabricId && current.id);
  return `<section class="gfp-box"><div class="gfp-title"><b>${editing ? 'Editar tecido' : 'Novo tecido'}</b><small>Características permanentes do produto. Tipo e construção/referência são configuráveis para atender todos os tecidos da GAO.</small></div><form data-gfp-form="fabric" class="gfp-form gfp-form-first"><input name="code" placeholder="Código" value="${esc(current.code)}" required><input name="name" placeholder="Nome do tecido" value="${esc(current.name)}" required><select name="fabricType" required>${fabricTypeOptions(current.fabricType)}</select><select name="weave" data-weave-field>${weaveOptions(current.weave)}</select><input name="composition" placeholder="Composição" value="${esc(current.composition)}"><input name="color" placeholder="Cor" value="${esc(current.color)}"><input name="widthM" type="text" inputmode="decimal" data-decimal="true" placeholder="Largura (m)" value="${esc(current.widthM)}"><input name="gsm" type="text" inputmode="decimal" data-decimal="true" placeholder="Gramatura de referência (g/m²)" value="${esc(current.gsm)}"><button>${editing ? 'Salvar alteração' : 'Salvar tecido'}</button>${editing ? '<button type="button" data-gfp-cancel-edit>Cancelar</button>' : ''}</form><div class="gfp-title gfp-list-title"><b>Tecidos cadastrados</b><small>Edite qualquer produto já registrado.</small></div><table><thead><tr><th>Código</th><th>Tecido</th><th>Tipo</th><th>Construção</th><th>Composição</th><th>Cor</th><th>Largura</th><th>Gramatura</th><th>Ação</th></tr></thead><tbody>${data.fabrics.map(f => `<tr><td>${esc(f.code)}</td><td><b>${esc(f.name)}</b></td><td>${esc(f.fabricType || '—')}</td><td>${esc(f.weave || '—')}</td><td>${esc(f.composition || '—')}</td><td>${esc(f.color || '—')}</td><td>${num(f.widthM)} m</td><td>${num(f.gsm)} g/m²</td><td><button type="button" data-gfp-edit-fabric="${esc(f.id)}">Editar</button></td></tr>`).join('') || '<tr><td colspan="9" class="gfp-empty">Nenhum tecido cadastrado.</td></tr>'}</tbody></table>${fabricTypesView()}${structuresView()}</section>`;
}
// Tela operacional final: o lote deixa de ser apenas histórico e passa a ter decisão rastreável.
function supplierView() {
  return `<section class="gfp-box"><div class="gfp-title"><b>Cadastro de fornecedores</b><small>O fornecedor é cadastrado uma única vez e depois selecionado nas entradas.</small></div><form data-gfp-form="supplier" class="gfp-form"><input name="legalName" placeholder="Razão social" required><input name="tradeName" placeholder="Nome fantasia"><input name="cnpj" placeholder="CNPJ"><input name="contact" placeholder="Contato"><input name="paymentTerms" placeholder="Condição de pagamento"><input name="leadDays" type="number" min="0" step="1" placeholder="Prazo de entrega (dias)"><button>Salvar fornecedor</button></form><table><thead><tr><th>Fornecedor</th><th>CNPJ</th><th>Contato</th><th>Prazo</th><th>Status</th></tr></thead><tbody>${data.suppliers.map(s => `<tr><td><b>${esc(s.tradeName || s.legalName)}</b><small>${esc(s.legalName)}</small></td><td>${esc(s.cnpj || '—')}</td><td>${esc(s.contact || '—')}</td><td>${esc(s.leadDays || '—')} dias</td><td>Ativo</td></tr>`).join('') || '<tr><td colspan="5" class="gfp-empty">Nenhum fornecedor cadastrado.</td></tr>'}</tbody></table><div class="gfp-title gfp-list-title"><b>Importar produtos da NF-e (XML)</b><small>O sistema lê fornecedor, produtos, códigos, quantidades, lotes e valores.</small></div><form data-gfp-form="xml" class="gfp-form"><input name="xmlFile" type="file" accept=".xml,text/xml,application/xml" required><button>Processar XML</button></form>${data.xmlProducts.length ? `<table><thead><tr><th>Produto</th><th>Código</th><th>Fornecedor</th><th>Quantidade</th><th>Valor</th><th>Lote</th><th>NF</th></tr></thead><tbody>${data.xmlProducts.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.code || '—')}</td><td>${esc(p.supplier || '—')}</td><td>${num(p.quantity)} ${esc(p.unit || '')}</td><td>R$ ${num(p.unitPrice)}</td><td>${esc(p.lot || '—')}</td><td>${esc(p.invoice || '—')}</td></tr>`).join('')}</tbody></table>` : '<p class="gfp-muted">Nenhum produto importado por XML.</p>'}<div class="gfp-title gfp-list-title"><b>Lançar lote e análise de qualidade</b><small>Selecione o fornecedor cadastrado. Depois use o painel operacional abaixo para auditar e decidir o destino.</small></div><form data-gfp-form="incoming" class="gfp-form"><select name="fabricId" required><option value="">Escolha o tecido</option>${selectFabrics()}</select><select name="supplierId" required><option value="">Selecione o fornecedor cadastrado</option>${data.suppliers.map(s => `<option value="${esc(s.id)}">${esc(s.tradeName || s.legalName)}</option>`).join('')}</select><input name="colorRef" placeholder="Referência da cor" required><input name="lot" placeholder="Lote" required><input name="qtyM" type="text" inputmode="decimal" data-decimal="true" placeholder="Quantidade (m)" required><input name="pricePerM" type="text" inputmode="decimal" data-decimal="true" placeholder="Preço por metro" required><input name="expectedDate" type="date" required><select name="status"><option value="confirmed">Confirmada</option><option value="partial">Parcial</option><option value="cancelled">Cancelada</option></select>${qualityFields()}<button>Lançar lote</button></form>${lotWorkflowView()}</section>`;
}
document.addEventListener('click', event => {
  const releaseButton = event.target.closest?.('[data-gfp-release-fabric]');
  if (releaseButton) {
    event.preventDefault();
    event.stopPropagation();
    const requirement = data.requirements.find(row => row.id === releaseButton.dataset.gfpReleaseFabric);
    const target = requirement && fabric(requirement.fabricId);
    if (!requirement || !target) return;
    const plan = requirementPlan(requirement);
    const sent = n(requirement.releasedM);
    const amount = Math.max(0, Math.min(plan.releaseNowM, plan.requiredM - sent));
    if (!amount) return;
    target.stockM = Math.max(0, n(target.stockM) - amount);
    requirement.releasedM = sent + amount;
    requirement.releasedAt = new Date().toISOString();
    requirement.releaseStatus = requirement.releasedM >= plan.requiredM ? 'SENT' : 'PARTIAL';
    save(data);
    renderOwn();
    return;
  }
  const fabricStockButton = event.target.closest?.('[data-gfp-mark-fabric-stock]');
  if (fabricStockButton) {
    event.preventDefault();
    event.stopPropagation();
    const target = fabric(fabricStockButton.dataset.gfpMarkFabricStock);
    if (!target) return;
    const lots = data.incoming.filter(item => item.fabricId === target.id && item.status !== 'cancelled' && !item.stockApplied && item.lotDecision !== 'STOCK');
    if (!lots.length) return;
    target.stockM = n(target.stockM) + lots.reduce((sum, item) => sum + n(item.qtyM), 0);
    lots.forEach(item => { item.stockApplied = true; item.lotDecision = 'STOCK'; item.qualityStatus = item.qualityStatus || 'approved'; item.workflowNotes = 'Entrada considerada no estoque físico.'; item.auditedAt = new Date().toISOString(); });
    save(data);
    renderOwn();
    return;
  }
  const stockButton = event.target.closest?.('[data-gfp-mark-stock]');
  if (stockButton) {
    event.preventDefault();
    event.stopPropagation();
    const item = data.incoming.find(row => row.id === stockButton.dataset.gfpMarkStock);
    const target = item && fabric(item.fabricId);
    if (!item || !target || item.stockApplied || item.lotDecision === 'STOCK') return;
    target.stockM = n(target.stockM) + n(item.qtyM);
    item.stockApplied = true;
    item.lotDecision = 'STOCK';
    item.qualityStatus = item.qualityStatus || 'approved';
    item.workflowNotes = 'Entrada existente considerada no estoque físico.';
    item.auditedAt = new Date().toISOString();
    save(data);
    renderOwn();
    return;
  }
  const button = event.target.closest?.('[data-gfp-lot-action]');
  if (!button) return;
  const item = data.incoming.find(row => row.id === button.dataset.gfpLotId);
  if (!item) return;
  const action = button.dataset.gfpLotAction;
  if (action === 'edit') { openLotEditor(item.id); return; }
  if (action === 'accept') { item.qualityStatus = 'approved'; item.lotDecision = ''; item.auditedAt = new Date().toISOString(); item.workflowNotes = 'Lote aceito na auditoria.'; }
  if (action === 'reject') { item.qualityStatus = 'rejected'; item.lotDecision = 'REJECTED'; item.auditedAt = new Date().toISOString(); item.workflowNotes = 'Lote recusado na auditoria.'; }
  if (action === 'stock' || action === 'cutting') {
    if (item.qualityStatus !== 'approved') { alert('Aceite o lote na auditoria antes de enviar para estoque ou confecção.'); return; }
    if (action === 'stock' && !item.stockApplied) {
      const target = fabric(item.fabricId);
      if (target) target.stockM = n(target.stockM) + n(item.qtyM);
      item.stockApplied = true;
    }
    if (action === 'cutting' && !item.cutApplied) {
      const target = fabric(item.fabricId);
      // Se o lote ainda não havia sido lançado como físico, ele entra e sai
      // no mesmo movimento; se já estava em estoque, apenas é baixado.
      if (target && !item.stockApplied) {
        target.stockM = n(target.stockM) + n(item.qtyM);
        item.stockApplied = true;
      }
      if (target) target.stockM = Math.max(0, n(target.stockM) - n(item.qtyM));
      item.cutApplied = true;
    }
    item.lotDecision = action === 'stock' ? 'STOCK' : 'CUTTING'; item.auditedAt = new Date().toISOString(); item.workflowNotes = action === 'stock' ? 'Liberado para estoque.' : 'Liberado para confecção.';
  }
  save(data); renderOwn();
}, true);
document.addEventListener('click', event => {
  if (!event.target.closest?.('[data-gfp-cancel-edit]')) return;
  editingFabricId = null;
  renderOwn();
}, true);
const originalRenderOwn = renderOwn;
renderOwn = function() { originalRenderOwn(); prepareFabricInputs(); };
const panelWithProduction = panel;
const originalPartialView = partialView;
partialView = function() {
  const rows = data.requirements.map(requirementPlan).map(p => { const sent = n(p.releasedM); const canSend = Math.max(0, p.releaseNowM - sent); return `<tr><td><b>${esc(p.product)}</b><small>${esc(p.fabric?.name || 'Tecido não cadastrado')}</small></td><td>${num(p.qtyPieces)} pç</td><td>${num(p.requiredM)} m</td><td>${num(p.availableM)} m</td><td>${num(canSend)} m</td><td class="gfp-pending">${num(Math.max(0, p.pendingReleaseM - sent))} m</td><td><span class="gfp-status ${canSend ? 'partial' : 'ready'}">${canSend ? (sent ? 'Parcial' : 'Aguardando envio') : 'Enviado'}</span></td><td>${canSend ? `<button type="button" class="gfp-stock-action" data-gfp-release-fabric="${esc(p.id)}">Enviar para facção</button>` : '<span class="gfp-quality-status approved">Enviado</span>'}</td></tr>`; }).join('');
  return `<section class="gfp-box"><div class="gfp-title"><b>Peças para facção</b><small>Primeiro cadastre aqui o que a facção precisa produzir. Depois o sistema calcula o tecido e libera o envio.</small></div><form data-gfp-form="requirement" class="gfp-form gfp-form-first"><b>1. Cadastrar peça da facção</b><input name="product" placeholder="Peça/produto" required><select name="fabricId" required><option value="">Escolha o tecido</option>${selectFabrics()}</select><input name="qtyPieces" type="number" min="1" step="1" placeholder="Quantidade de peças" required><input name="consumptionM" type="number" min="0.001" step="0.001" placeholder="Consumo por peça (m)" required><button>Salvar necessidade</button></form><div class="gfp-title gfp-list-title"><b>2. Liberar tecido para a facção</b><small>Após cadastrar a peça, confira o disponível e clique em “Enviar para facção”.</small></div><table><thead><tr><th>Peça / tecido</th><th>Quantidade</th><th>Consumo total</th><th>Disponível</th><th>Liberar</th><th>Pendente</th><th>Status</th><th>Ação</th></tr></thead><tbody>${rows || '<tr><td colspan="8" class="gfp-empty">Nenhuma peça cadastrada para a facção.</td></tr>'}</tbody></table></section>`;
};
panel = function() { return panelWithProduction().replace(/class="(active)?>(Confecção \/ facção)/g, 'class="$1">$2').replace('>Cadastro de tecidos</button>', '>Cadastros</button>').replace('>Fornecedores e lotes</button>', '>Compras e lotes</button>').replace('>Necessidade de compra</button>', '>Compra de tecido</button>').replace('>Liberação parcial</button>', '>Peças para facção</button>').replace('>Confecção / facção</button>', '>Acompanhamento</button>').replace('>Corte e rendimento</button>', '>Corte e rendimento</button>'); };
const style = document.createElement('style');
style.textContent = `.gao-fabric-planning{margin-top:14px;color:#082d52}.gfp-head{display:flex;justify-content:space-between;gap:12px;align-items:center;background:#eaf5ff;border:1px solid #c8e0f2;border-radius:10px;padding:15px}.gfp-head p{margin:0;color:#1767a2;font-size:10px;font-weight:900;letter-spacing:.14em}.gfp-head h3{margin:4px 0;color:#082d52}.gfp-head small,.gfp-title small{color:#54708e}.gfp-head>span{background:#3188cc;color:#fff;border-radius:8px;padding:12px;font-weight:900}.gfp-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.gfp-cards article{background:#fff;border:1px solid #d7e4ef;border-top:3px solid #3188cc;border-radius:8px;padding:10px}.gfp-cards small{display:block;color:#54708e}.gfp-cards strong{display:block;font-size:20px;margin-top:4px}.gfp-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.gfp-tabs button{border:1px solid #b9d1e8;background:#fff;color:#174a78;border-radius:8px;padding:9px 12px;font-weight:900;cursor:pointer}.gfp-tabs button.active{background:#3188cc;color:#fff}.gfp-box{background:#fff;border:1px solid #d7e4ef;border-radius:10px;padding:12px;overflow:auto}.gfp-title{display:flex;justify-content:space-between;gap:10px;align-items:start;margin-bottom:10px}.gfp-title b{font-size:15px}.gfp-box table{width:100%;border-collapse:collapse;font-size:12px;min-width:900px}.gfp-box th{background:#f3f8fd;color:#54708e;text-align:left;padding:8px;border-bottom:1px solid #d7e4ef}.gfp-box td{padding:8px;border-bottom:1px solid #eef4f9}.gfp-box td small{display:block;color:#7890a8;margin-top:3px}.gfp-buy,.gfp-pending{font-weight:900;color:#a32626}.gfp-status{padding:4px 7px;border-radius:99px;font-weight:900}.gfp-status.partial{background:#fff4c7;color:#805600}.gfp-status.ready{background:#dcfce7;color:#166534}.gfp-quality-fields{width:100%;display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:7px;background:#f7fbff;border:1px solid #d7e8f4;border-radius:8px;padding:10px;margin-top:4px}.gfp-quality-fields b,.gfp-quality-fields small{grid-column:1/-1}.gfp-quality-fields small{color:#54708e}.gfp-quality-fields input,.gfp-quality-fields select{min-width:0!important}.gfp-quality-status{padding:4px 7px;border-radius:99px;font-weight:900}.gfp-quality-status.approved{background:#dcfce7;color:#166534}.gfp-quality-status.rejected{background:#fee2e2;color:#991b1b}.gfp-quality-status.pending{background:#fff4c7;color:#805600}.gfp-form{display:flex;flex-wrap:wrap;gap:7px;align-items:center;border-top:1px solid #e1ebf3;margin-top:12px;padding-top:12px}.gfp-form b{width:100%;font-size:13px}.gfp-form input,.gfp-form select{border:1px solid #b9d1e8;border-radius:7px;padding:8px;color:#082d52;min-width:135px}.gfp-form button{border:0;border-radius:7px;background:#3188cc;color:#fff;padding:9px 13px;font-weight:900;cursor:pointer}.gfp-result{margin-top:12px;padding:12px;border-radius:8px;background:#f3f8fd;color:#174a78}.gfp-empty{text-align:center;color:#7890a8;padding:20px!important}@media(max-width:700px){.gfp-cards{grid-template-columns:1fr}.gfp-title{display:block}.gfp-form input,.gfp-form select{width:100%}.gfp-quality-fields{grid-template-columns:1fr}}`;
document.head.appendChild(style);
const supplierStyle = document.createElement('style');
supplierStyle.textContent = `.gfp-suppliers{background:#fff;border:1px solid #d7e4ef;border-radius:10px;padding:10px;margin:10px 0}.gfp-suppliers>div{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.gfp-suppliers small{color:#54708e}.gfp-suppliers table{width:100%;border-collapse:collapse;font-size:12px}.gfp-suppliers th{background:#f3f8fd;color:#54708e;text-align:left;padding:7px;border-bottom:1px solid #d7e4ef}.gfp-suppliers td{padding:7px;border-bottom:1px solid #eef4f9}.gfp-suppliers td small{display:block;margin-top:2px}.gfp-suppliers p{margin:5px 0;color:#7890a8;font-size:12px}.gfp-only-active> :not(.supplier-tabs):not(#gao-fabric-planning-host){display:none!important}[data-gfp-edit-fabric],[data-gfp-cancel-edit],[data-gfp-mark-stock]{border:1px solid #b9d1e8;border-radius:6px;background:#fff;color:#174a78;padding:6px 10px;font-weight:800;cursor:pointer}[data-gfp-mark-stock]{background:#3188cc;color:#fff;border-color:#3188cc;white-space:nowrap}`;
document.head.appendChild(supplierStyle);
const structureStyle = document.createElement('style');
structureStyle.textContent = `.gfp-structures{margin-top:14px;border-top:1px solid #e1ebf3;padding-top:12px}.gfp-structures>div:first-child{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.gfp-structures small{color:#54708e}.gfp-structure-list{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.gfp-structure-list span{display:inline-flex;align-items:center;gap:6px;background:#f3f8fd;border:1px solid #cfe0ef;border-radius:99px;padding:5px 8px;color:#174a78;font-weight:800}.gfp-structure-list button{border:0;background:transparent;color:#9b2c2c;font-size:16px;line-height:1;cursor:pointer;padding:0 2px}`;
document.head.appendChild(structureStyle);
const workflowStyle = document.createElement('style');
workflowStyle.textContent = `.gfp-workflow-table{min-width:1180px}.gfp-actions{display:flex;gap:5px;flex-wrap:wrap}.gfp-actions button{border:1px solid #b9d1e8;border-radius:6px;background:#fff;color:#174a78;padding:6px 8px;font-weight:800;cursor:pointer}.gfp-actions button[data-gfp-lot-action="reject"]{color:#a32626;border-color:#efb4b4}.gfp-actions button[data-gfp-lot-action="stock"],.gfp-actions button[data-gfp-lot-action="cutting"]{color:#166534;border-color:#a9d8b9}.gfp-modal{position:fixed;inset:0;background:#09264299;z-index:100001;display:grid;place-items:center;padding:20px}.gfp-modal-card{width:min(780px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:16px;padding:22px;box-shadow:0 25px 80px #0004;position:relative}.gfp-modal-card h3{margin:0;color:#082d52}.gfp-modal-card p{color:#607d9b}.gfp-modal-close{position:absolute;right:16px;top:12px;border:0;background:#edf5fb;border-radius:8px;width:34px;height:34px;font-size:22px}.gfp-modal-card textarea{border:1px solid #b9d1e8;border-radius:7px;padding:8px;min-height:72px;min-width:220px;flex:1}`;
document.head.appendChild(workflowStyle);
setInterval(mount, 700);
