const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function calculateFabricPlan({ stockM = 0, reservedM = 0, blockedM = 0, incomingM = 0, requiredM = 0, averageMonthlyM = 0, safetyM = 0 }) {
  const availableM = Math.max(0, n(stockM) - n(reservedM) - n(blockedM));
  const projectedM = Math.max(0, availableM + n(incomingM));
  const releaseNowM = Math.min(availableM, Math.max(0, n(requiredM)));
  const pendingReleaseM = Math.max(0, n(requiredM) - releaseNowM);
  const targetM = Math.max(n(requiredM), n(averageMonthlyM)) + Math.max(0, n(safetyM));
  const purchaseSuggestionM = Math.max(0, targetM - projectedM);
  return { availableM, projectedM, releaseNowM, pendingReleaseM, targetM, purchaseSuggestionM };
}

export function calculateLoss({ theoreticalM = 0, actualM = 0 }) {
  const theoretical = Math.max(0, n(theoreticalM));
  const actual = Math.max(0, n(actualM));
  const lossM = Math.max(0, actual - theoretical);
  return { lossM, lossPercent: theoretical ? lossM / theoretical * 100 : 0, yieldPercent: actual ? theoretical / actual * 100 : 0 };
}

export function calculatePurchaseCost({ quantityM = 0, pricePerM = 0, freight = 0, otherCost = 0 }) {
  const quantity = Math.max(0, n(quantityM));
  const total = Math.max(0, quantity * Math.max(0, n(pricePerM)) + Math.max(0, n(freight)) + Math.max(0, n(otherCost)));
  return { totalCost: total, effectivePricePerM: quantity ? total / quantity : 0 };
}
