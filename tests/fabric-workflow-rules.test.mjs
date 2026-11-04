import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFabricCoverage,
  calculateFabricLoss,
  calculateFabricOrderCost,
  normalizeFabricNumber
} from '../fabric-workflow-rules-v1.mjs';

test('não duplica a quantidade de peças já coberta por ordens abertas', () => {
  const result = calculateFabricCoverage({
    needPieces: 40,
    openOrderPieces: 12,
    consumptionMPerPiece: 1.5,
    openOrderUnreservedM: 4,
    physicalMeters: 20,
    reservedMeters: 3,
    confirmedIncomingMeters: 2
  });
  assert.equal(result.uncoveredPieces, 28);
  assert.equal(result.materialNeedMeters, 46);
  assert.equal(result.releasableMeters, 17);
  assert.equal(result.pendingMeters, 29);
  assert.equal(result.purchaseSuggestionMeters, 27);
});

test('converte números digitados no padrão brasileiro', () => {
  assert.equal(normalizeFabricNumber('1.234,56'), 1234.56);
});

test('calcula custo unitário planejado e realizado por peça aceita', () => {
  const result = calculateFabricOrderCost({
    plannedPieces: 10,
    acceptedPieces: 8,
    plannedMetersPerPiece: 2,
    fabricPricePerMeter: 5,
    plannedFactionPerPiece: 3,
    plannedExtrasPerPiece: 1,
    actualMetersUsed: 19,
    actualFactionCost: 25,
    actualExtrasCost: 7
  });
  assert.equal(result.plannedUnitCost, 14);
  assert.equal(result.actualFabricCost, 95);
  assert.equal(result.actualTotalCost, 127);
  assert.equal(result.actualUnitCost, 15.875);
});

test('não calcula custo unitário quando nenhuma peça foi aceita', () => {
  const result = calculateFabricOrderCost({ plannedPieces: 2, acceptedPieces: 0 });
  assert.equal(result.actualUnitCost, null);
});

test('calcula perda de tecido e valor da perda além do consumo padrão das peças cortadas', () => {
  const result = calculateFabricLoss({
    producedPieces: 9,
    acceptedPieces: 8,
    standardMetersPerPiece: 2,
    actualMetersUsed: 20,
    fabricPricePerMeter: 5
  });
  assert.equal(result.theoreticalMeters, 18);
  assert.equal(result.lossMeters, 2);
  assert.equal(result.lossValue, 10);
  assert.equal(result.acceptancePercent, 8 / 9 * 100);
});
