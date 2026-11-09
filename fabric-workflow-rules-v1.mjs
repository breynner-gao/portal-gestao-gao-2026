export function normalizeFabricNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let text = String(value ?? '').trim().replace(/[\sR$]/g, '');
  if (text.includes(',') && text.includes('.')) text = text.replace(/\./g, '').replace(',', '.');
  else if (text.includes(',')) text = text.replace(',', '.');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

const nonnegative = value => Math.max(0, normalizeFabricNumber(value));

export function normalizeFabricCatalogText(value) {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
}

const normalizeFabricQuality = value => normalizeFabricCatalogText(value).replace(/^Q/, '');

export function fabricCatalogVariantKey({ code = '', color_reference = '', quality_code = '' } = {}) {
  return [normalizeFabricCatalogText(code), normalizeFabricCatalogText(color_reference), normalizeFabricQuality(quality_code)].join('|');
}

export function fabricInvoiceAliasKey({
  supplier_id = '', supplier_item_code = '', supplier_item_description = '',
  invoice_color_reference = '', invoice_quality_code = ''
} = {}) {
  return [normalizeFabricCatalogText(supplier_id), normalizeFabricCatalogText(supplier_item_code),
    normalizeFabricCatalogText(supplier_item_description), normalizeFabricCatalogText(invoice_color_reference),
    normalizeFabricQuality(invoice_quality_code)].join('|');
}

export function calculateFabricCoverage({
  needPieces = 0,
  openOrderPieces = 0,
  consumptionMPerPiece = 0,
  openOrderUnreservedM = 0,
  physicalMeters = 0,
  reservedMeters = 0,
  confirmedIncomingMeters = 0
} = {}) {
  const need = nonnegative(needPieces);
  const open = nonnegative(openOrderPieces);
  const uncoveredPieces = Math.max(0, need - open);
  const materialNeedMeters = uncoveredPieces * nonnegative(consumptionMPerPiece) + nonnegative(openOrderUnreservedM);
  const freeMeters = Math.max(0, nonnegative(physicalMeters) - nonnegative(reservedMeters));
  const incomingMeters = nonnegative(confirmedIncomingMeters);
  const releasableMeters = Math.min(freeMeters, materialNeedMeters);
  return {
    uncoveredPieces,
    materialNeedMeters,
    freeMeters,
    releasableMeters,
    pendingMeters: Math.max(0, materialNeedMeters - releasableMeters),
    purchaseSuggestionMeters: Math.max(0, materialNeedMeters - freeMeters - incomingMeters)
  };
}

export function calculateFabricOrderCost({
  plannedPieces = 0,
  acceptedPieces = 0,
  plannedMetersPerPiece = 0,
  fabricPricePerMeter = 0,
  plannedFactionPerPiece = 0,
  plannedExtrasPerPiece = 0,
  actualMetersUsed = 0,
  actualFactionCost = 0,
  actualExtrasCost = 0
} = {}) {
  const planned = nonnegative(plannedPieces);
  const accepted = nonnegative(acceptedPieces);
  const price = nonnegative(fabricPricePerMeter);
  const plannedUnitCost = nonnegative(plannedMetersPerPiece) * price
    + nonnegative(plannedFactionPerPiece)
    + nonnegative(plannedExtrasPerPiece);
  const plannedTotalCost = planned * plannedUnitCost;
  const actualFabricCost = nonnegative(actualMetersUsed) * price;
  const actualTotalCost = actualFabricCost + nonnegative(actualFactionCost) + nonnegative(actualExtrasCost);
  return {
    plannedUnitCost,
    plannedTotalCost,
    actualFabricCost,
    actualTotalCost,
    actualUnitCost: accepted > 0 ? actualTotalCost / accepted : null
  };
}

export function calculateFabricLoss({
  producedPieces = 0,
  acceptedPieces = 0,
  standardMetersPerPiece = 0,
  actualMetersUsed = 0,
  fabricPricePerMeter = 0
} = {}) {
  const produced = nonnegative(producedPieces);
  const theoreticalMeters = produced * nonnegative(standardMetersPerPiece);
  const lossMeters = Math.max(0, nonnegative(actualMetersUsed) - theoreticalMeters);
  return {
    theoreticalMeters,
    lossMeters,
    lossPercent: theoreticalMeters > 0 ? lossMeters / theoreticalMeters * 100 : 0,
    lossValue: lossMeters * nonnegative(fabricPricePerMeter),
    acceptancePercent: produced > 0 ? Math.min(100, nonnegative(acceptedPieces) / produced * 100) : 0
  };
}

export function summarizeFabricPurchaseOrder({ orderStatus = 'ABERTA', items = [], receipts = [], lots = [] } = {}) {
  const epsilon = 0.0005;
  const lotById = new Map(lots.map(lot => [String(lot.id), String(lot.quality_status || '').toUpperCase()]));
  const lines = items.map(item => {
    const orderedMeters = nonnegative(item.ordered_m);
    const receivedMeters = nonnegative(item.received_m);
    const pendingMeters = Math.max(0, orderedMeters - receivedMeters);
    const lineReceipts = receipts.filter(receipt => String(receipt.purchase_order_item_id) === String(item.id));
    const qualities = lineReceipts.map(receipt => lotById.get(String(receipt.lot_id))).filter(Boolean);
    const quality = qualities.includes('REPROVADO')
      ? 'REPROVADO'
      : qualities.includes('PENDENTE') || (lineReceipts.length && qualities.length < lineReceipts.length)
        ? 'PENDENTE'
        : qualities.length && qualities.every(status => status === 'APROVADO')
          ? 'APROVADO'
          : '';
    let label;
    if (receivedMeters <= epsilon) label = 'Aguardando recebimento';
    else {
      const qualityLabel = quality === 'REPROVADO' ? 'lote reprovado'
        : quality === 'PENDENTE' ? 'aguardando inspeção'
          : quality === 'APROVADO' ? 'aprovado' : 'qualidade não identificada';
      label = (pendingMeters > epsilon ? 'Parcial' : 'Recebido') + ' • ' + qualityLabel;
    }
    return { id: item.id, orderedMeters, receivedMeters, pendingMeters, quality, label };
  });
  const orderedMeters = lines.reduce((sum, line) => sum + line.orderedMeters, 0);
  const receivedMeters = lines.reduce((sum, line) => sum + line.receivedMeters, 0);
  const complete = lines.length > 0 && lines.every(line => line.pendingMeters <= epsilon);
  const allApproved = complete && lines.every(line => line.quality === 'APROVADO');
  const hasRejected = lines.some(line => line.quality === 'REPROVADO');
  const cancelled = String(orderStatus).toUpperCase() === 'CANCELADA';
  const status = cancelled ? 'CANCELADA'
    : complete && hasRejected ? 'REPROVADA'
      : allApproved ? 'LIBERADA'
        : complete ? 'AGUARDA_QUALIDADE'
          : receivedMeters > epsilon ? 'PARCIAL' : 'ABERTA';
  const labels = {
    CANCELADA: 'Cancelado',
    REPROVADA: 'Recebido • lote reprovado',
    LIBERADA: 'Concluído • liberado no estoque',
    AGUARDA_QUALIDADE: 'Recebido • aguardando inspeção',
    PARCIAL: 'Recebimento parcial',
    ABERTA: 'Aguardando recebimento'
  };
  return {
    status,
    label: labels[status],
    orderedMeters,
    receivedMeters,
    pendingMeters: Math.max(0, orderedMeters - receivedMeters),
    lines
  };
}

export function groupPendingFabricLotsByInvoice(lots = []) {
  const groups = new Map();
  for (const lot of lots) {
    if (!['PENDENTE', 'REPROVADO'].includes(String(lot.quality_status || '').toUpperCase())) continue;
    const invoice = String(lot.invoice_number || '').trim() || `Sem NF • ${lot.lot_code || lot.id}`;
    if (!groups.has(invoice)) groups.set(invoice, []);
    groups.get(invoice).push(lot);
  }
  return [...groups.entries()].map(([invoice, invoiceLots]) => ({ invoice, lots: invoiceLots }));
}

export function latestFabricConsumptionByVariant(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = String(row.variant_key || '').trim();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()].map(([variantKey, history]) => {
    history.sort((a, b) => String(a.source_date || '').localeCompare(String(b.source_date || '')) || Number(a.source_row || 0) - Number(b.source_row || 0));
    const latest = history[history.length - 1];
    return {
      ...latest,
      variant_key: variantKey,
      source_history: history,
      historical_consumptions: [...new Set(history.map(row => Number(row.consumption_m_per_piece)).filter(Number.isFinite))]
    };
  }).sort((a, b) => String(a.product_name || '').localeCompare(String(b.product_name || '')) || String(a.size || '').localeCompare(String(b.size || '')) || String(a.color_description || '').localeCompare(String(b.color_description || '')));
}

export function fabricCostReferenceLabel(row = {}) {
  const sourceBlock = ({
    MODELO_A: 'Base de custo A',
    MODELO_B: 'Base de custo B',
    VARIANTES: 'Custo por produto e cor'
  })[String(row.source_block || '').toUpperCase()] || String(row.source_block || 'Fonte da planilha');
  return [row.product_name, row.fabric_description, row.color_description,
    row.supplier_name, sourceBlock, row.source_row ? `linha ${row.source_row}` : '']
    .filter(value => String(value ?? '').trim())
    .join(' • ');
}

export function serviceOrderDueDate(date, days = 21) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new Error('Data de envio inválida');
  const [y,m,d]=date.split('-').map(Number);
  const value=new Date(Date.UTC(y,m-1,d));
  if(value.toISOString().slice(0,10)!==date)throw new Error('Data de envio inválida');
  value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
}
