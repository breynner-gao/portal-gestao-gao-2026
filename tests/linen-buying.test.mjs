import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBuyingRows,
  allocateBuyingFabric,
} from "../linen-buying-rules-v1.mjs";
const snapshot = [
  {
    produtoId: "P",
    produtoNome: "Lençol",
    necessidade: 800,
    pedidoReal: 500,
    pendingTracking: 200,
    pendingServiceOrders: 100,
    estoqueUtil: 200,
    coverageReady: true,
  },
];
test("necessidade líquida não desconta novamente o estoque RFID", () => {
  const [r] = buildBuyingRows({ snapshot });
  assert.equal(r.target, 1000);
  assert.equal(r.available, 200);
  assert.equal(r.production, 300);
  assert.equal(r.toOrder, 500);
});
test("compras prontas e recebimentos fora da base entram uma vez", () => {
  const orders = [
    {
      id: "O",
      product_reference: "P",
      ordered_pieces: 200,
      received_pieces: 80,
      status: "ABERTA",
    },
  ];
  const receipts = [
    {
      order_id: "O",
      accepted_pieces: 80,
      rfid_confirmed: false,
      created_at: "2026-11-10T12:00:00Z",
    },
  ];
  const [r] = buildBuyingRows({
    snapshot,
    pieceOrders: orders,
    pieceReceipts: receipts,
    snapshotUpdatedAt: "2026-11-09T12:00:00Z",
  });
  assert.equal(r.available, 280);
  assert.equal(r.incoming, 120);
  assert.equal(r.toOrder, 300);
});
test("RFID mais recente exige confirmar integração antes de nova sugestão", () => {
  const [r] = buildBuyingRows({
    snapshot,
    pieceOrders: [
      {
        id: "O",
        product_reference: "P",
        ordered_pieces: 80,
        received_pieces: 80,
        status: "ABERTA",
      },
    ],
    pieceReceipts: [
      {
        order_id: "O",
        accepted_pieces: 80,
        rfid_confirmed: false,
        created_at: "2026-11-09T12:00:00Z",
      },
    ],
    snapshotUpdatedAt: "2026-11-10T12:00:00Z",
  });
  assert.equal(r.toOrder, null);
  assert.equal(r.receiptReview, true);
});
test("vínculo ambíguo e cobertura incompleta não produzem zero falso", () => {
  const [r] = buildBuyingRows({
    snapshot: [{ ...snapshot[0], coverageReady: false }],
  });
  assert.equal(r.toOrder, null);
  const plan = allocateBuyingFabric(
    [{ key: "P", toOrder: 10, recipe: null }],
    [],
  );
  assert.equal(plan.rows[0].meters, null);
});
test("saldo de tecido compartilhado é alocado uma vez após compromissos abertos", () => {
  const recipes = { fabric_id: "F", consumption_m_per_piece: 2 };
  const rows = [
    { key: "A", toOrder: 10, recipe: recipes },
    { key: "B", toOrder: 10, recipe: recipes },
  ];
  const result = allocateBuyingFabric(rows, [
    {
      fabric: { id: "F" },
      recorded: 30,
      needed: 50,
      otherReserved: 0,
      incoming: 0,
      buy: 20,
    },
  ]);
  assert.equal(result.rows[0].freeMeters, 20);
  assert.equal(result.rows[1].freeMeters, 0);
  assert.equal(
    result.rows.reduce((s, r) => s + r.buyMeters, 0),
    20,
  );
});
test("compra a receber não é contada como estoque físico", () => {
  const result = allocateBuyingFabric(
    [
      {
        key: "A",
        toOrder: 10,
        recipe: { fabric_id: "F", consumption_m_per_piece: 2 },
      },
    ],
    [
      {
        fabric: { id: "F" },
        recorded: 5,
        needed: 20,
        otherReserved: 0,
        incoming: 10,
        buy: 5,
      },
    ],
  );
  assert.equal(result.rows[0].freeMeters, 5);
  assert.equal(result.rows[0].incomingMeters, 10);
  assert.equal(result.rows[0].buyMeters, 5);
});
