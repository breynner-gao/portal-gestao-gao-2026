import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFabricCoverage,
  calculateFabricLoss,
  calculateFabricOrderCost,
  normalizeFabricNumber,
  fabricCatalogVariantKey,
  fabricInvoiceAliasKey,
  summarizeFabricPurchaseOrder
} from '../fabric-workflow-rules-v1.mjs';

test('catálogo distingue variante homologada por código, referência e qualidade sem duplicar diferenças de caixa/espaços', () => {
  const base = fabricCatalogVariantKey({ code: ' AN048966464 ', color_reference: 'p53', quality_code: 'Q2' });
  assert.equal(base, fabricCatalogVariantKey({ code: 'an048966464', color_reference: ' P53 ', quality_code: '2' }));
  assert.notEqual(base, fabricCatalogVariantKey({ code: 'AN048966464', color_reference: 'V02', quality_code: '2' }));
  assert.notEqual(base, fabricCatalogVariantKey({ code: 'AN048966464', color_reference: 'P53', quality_code: '1' }));
});

test('relação de NF considera fornecedor, código, texto bruto, referência e Q', () => {
  const first = fabricInvoiceAliasKey({
    supplier_id: 'supplier-a', supplier_item_code: 'item-01',
    supplier_item_description: 'Tecido azul céu', invoice_color_reference: 'V02', invoice_quality_code: 'Q1'
  });
  assert.equal(first, fabricInvoiceAliasKey({
    supplier_id: 'SUPPLIER-A', supplier_item_code: ' ITEM-01 ',
    supplier_item_description: 'tecido azul céu', invoice_color_reference: 'v02', invoice_quality_code: '1'
  }));
  assert.notEqual(first, fabricInvoiceAliasKey({
    supplier_id: 'supplier-b', supplier_item_code: 'item-01',
    supplier_item_description: 'Tecido azul céu', invoice_color_reference: 'V02', invoice_quality_code: 'Q1'
  }));
});

test('mostra recebimento parcial e inspeção separada da liberação do tecido', () => {
  const result = summarizeFabricPurchaseOrder({
    orderStatus: 'PARCIAL',
    items: [{ id: 'item-1', ordered_m: 100, received_m: 40 }],
    receipts: [{ purchase_order_item_id: 'item-1', lot_id: 'lot-1', quantity_received_m: 40 }],
    lots: [{ id: 'lot-1', quality_status: 'PENDENTE' }]
  });
  assert.equal(result.status, 'PARCIAL');
  assert.equal(result.label, 'Recebimento parcial');
  assert.equal(result.orderedMeters, 100);
  assert.equal(result.receivedMeters, 40);
  assert.equal(result.lines[0].pendingMeters, 60);
  assert.equal(result.lines[0].label, 'Parcial • aguardando inspeção');
});

test('só marca o pedido como liberado quando todo o tecido recebido está aprovado', () => {
  const result = summarizeFabricPurchaseOrder({
    orderStatus: 'RECEBIDA',
    items: [{ id: 'item-1', ordered_m: 20, received_m: 20 }],
    receipts: [{ purchase_order_item_id: 'item-1', lot_id: 'lot-1', quantity_received_m: 20 }],
    lots: [{ id: 'lot-1', quality_status: 'APROVADO' }]
  });
  assert.equal(result.status, 'LIBERADA');
  assert.equal(result.label, 'Concluído • liberado no estoque');
  assert.equal(result.lines[0].label, 'Recebido • aprovado');
});

test('mantém pedidos cancelados fora do fluxo de recebimento e identifica lote reprovado', () => {
  const cancelled = summarizeFabricPurchaseOrder({ orderStatus: 'CANCELADA', items: [{ id: 'i', ordered_m: 5, received_m: 0 }] });
  const rejected = summarizeFabricPurchaseOrder({
    orderStatus: 'RECEBIDA',
    items: [{ id: 'i', ordered_m: 5, received_m: 5 }],
    receipts: [{ purchase_order_item_id: 'i', lot_id: 'l', quantity_received_m: 5 }],
    lots: [{ id: 'l', quality_status: 'REPROVADO' }]
  });
  assert.equal(cancelled.status, 'CANCELADA');
  assert.equal(cancelled.label, 'Cancelado');
  assert.equal(rejected.status, 'REPROVADA');
  assert.equal(rejected.lines[0].label, 'Recebido • lote reprovado');
});

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
