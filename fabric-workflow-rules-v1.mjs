export function normalizeFabricNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let text = String(value ?? '').trim().replace(/[\sR$]/g, '');
  if (text.includes(',') && text.includes('.')) text = text.replace(/\./g, '').replace(',', '.');
  else if (text.includes(',')) text = text.replace(',', '.');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

const nonnegative = value => Math.max(0, normalizeFabricNumber(value));

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
