const num = (v) => Math.max(0, Number(v) || 0);
const round = (v) => Math.round(Math.max(0, v) * 1000) / 1000;
export function buildBuyingRows({
  snapshot = [],
  recipes = [],
  pieceOrders = [],
  pieceReceipts = [],
  snapshotUpdatedAt = null,
} = {}) {
  return snapshot.map((s) => {
    const key = String(s.produtoId || s.produtoNome),
      os = pieceOrders.filter((o) => String(o.product_reference) === key),
      ids = new Set(os.map((o) => o.id));
    const receipts = pieceReceipts.filter(
      (r) => ids.has(r.order_id) && !r.rfid_confirmed,
    );
    const readyReceived = receipts.reduce(
        (a, r) => a + num(r.accepted_pieces),
        0,
      ),
      added = readyReceived + num(s.receivedAfterSnapshot),
      incoming = os
        .filter((o) => o.status !== "CANCELADA")
        .reduce(
          (a, o) =>
            a + Math.max(0, num(o.ordered_pieces) - num(o.received_pieces)),
          0,
        );
    const receiptReview = receipts.some(
      (r) =>
        snapshotUpdatedAt &&
        new Date(snapshotUpdatedAt) > new Date(r.created_at),
    );
    const selected = recipes.filter(
      (r) =>
        r.active &&
        String(r.product_reference) === key &&
        num(r.consumption_m_per_piece) > 0,
    );
    const ready = s.coverageReady === true && !receiptReview;
    const stock = num(s.estoqueUtil),
      net = num(s.necessidade),
      production = num(s.pendingTracking) + num(s.pendingServiceOrders);
    return {
      key,
      name: s.produtoNome,
      source: s,
      target: s.metaTrocas ?? stock + net,
      rfidStock: stock,
      addedStock: added,
      available: receiptReview ? null : stock + added,
      production,
      incoming,
      receiptReview,
      receipts,
      recipe: selected.length === 1 ? selected[0] : null,
      ready,
      toOrder: ready
        ? Math.ceil(Math.max(0, num(s.pedidoReal) - incoming - added))
        : null,
    };
  });
}
export function allocateBuyingFabric(rows, pools, matches = (a, b) => a === b) {
  const result = rows.map((r) => ({
    ...r,
    meters:
      r.recipe && r.toOrder !== null
        ? round(r.toOrder * num(r.recipe.consumption_m_per_piece))
        : null,
    freeMeters: null,
    incomingMeters: null,
    buyMeters: null,
  }));
  for (const pool of pools) {
    const group = result.filter(
      (r) => r.recipe && matches(r.recipe.fabric_id, pool.fabric.id),
    );
    const newNeed = group.reduce((a, r) => a + num(r.meters), 0),
      prior = Math.max(0, num(pool.needed) - newNeed),
      physical = Math.max(0, num(pool.recorded) - num(pool.otherReserved));
    let free = Math.max(0, physical - prior),
      incoming = Math.max(
        0,
        num(pool.incoming) - Math.max(0, prior - physical),
      );
    for (const r of group) {
      r.pool = pool;
      if (r.meters === null) continue;
      r.freeMeters = round(Math.min(r.meters, free));
      free -= r.freeMeters;
      r.incomingMeters = round(
        Math.min(Math.max(0, r.meters - r.freeMeters), incoming),
      );
      incoming -= r.incomingMeters;
      r.buyMeters =
        pool.buy === null
          ? null
          : round(r.meters - r.freeMeters - r.incomingMeters);
    }
  }
  return { rows: result, pools };
}
