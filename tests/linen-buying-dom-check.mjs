import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const { parseHTML } = await import(process.env.LINKEDOM_MODULE);
const root = new URL("../", import.meta.url);
const { window, document } = parseHTML(
  '<html><head></head><body><nav class="gao-textile-subnav"><button data-fw-tab="buying">Comprar enxoval</button><button data-dimension-view="map">Mapa</button></nav><section id="gao-linen-risk-shell"><div class="lr150-shell">Mapa</div></section></body></html>',
);
Object.assign(globalThis, { window, document, confirm: () => true });
window.GAO_AUTH_READY = Promise.resolve();
window.GAO_AUTH_SESSION = {
  access_token: "synthetic",
  user: { id: "operator" },
};
window.GAO_LINEN_SOURCE_UPDATED_AT = "2026-11-10T12:00:00Z";
window.GAO_LINEN_NEED_SNAPSHOT = [
  {
    produtoId: "P1",
    produtoNome: "Lençol branco",
    necessidade: 800,
    estoqueUtil: 200,
    pedidoReal: 500,
    coverageReady: true,
    asOf: "2026-11-10",
  },
];
const original = document.createElement.bind(document);
document.createElement = (name) => {
  const el = original(name);
  if (name === "dialog") {
    el.showModal = () => el.setAttribute("open", "");
    el.close = () => el.removeAttribute("open");
  }
  return el;
};
globalThis.FormData = class {
  constructor(form) {
    this.form = form;
  }
  entries() {
    return [...this.form.querySelectorAll("[name]")].map((el) => [
      el.name || el.getAttribute("name"),
      el.value ?? el.getAttribute("value") ?? "",
    ]);
  }
  [Symbol.iterator]() {
    return this.entries()[Symbol.iterator]();
  }
};
const rules = await import(new URL("fabric-workflow-rules-v1.mjs", root));
const standards = await import(new URL("fabric-standard-rules-v1.mjs", root));
const linen = await import(new URL("linen-risk-rules-v150.mjs", root));
const buying = await import(new URL("linen-buying-controller-v1.mjs", root));
const data = {
  memberships: [
    { organization_id: "org", organizations: { kind: "gao", active: true } },
  ],
  fabric_catalog: [
    {
      id: "fabric",
      standard_id: "standard",
      code: "PER",
      name: "Percal",
      supplier_id: "supplier",
      active: true,
      homologated: true,
      standard_link_approved: true,
    },
  ],
  fabric_suppliers: [{ id: "supplier", legal_name: "Fornecedor exemplo" }],
  fabric_standards: [
    {
      id: "standard",
      code: "GAO-TEC-011",
      name: "Percal branco",
      active: true,
      material_kind: "TECIDO",
    },
  ],
  fabric_product_recipes: [
    {
      id: "recipe",
      active: true,
      product_reference: "P1",
      product_name: "Lençol branco",
      fabric_id: "fabric",
      consumption_m_per_piece: 2.5,
    },
  ],
  fabric_faction_tracking: [
    {
      id: "track",
      product_reference: "P1",
      product_name: "Lençol branco",
      source_item: "1",
      quantity: 300,
      delivered: 0,
      delivery_status: "PENDENTE",
      cut_status: "PENDENTE",
    },
  ],
  fabric_lots: [
    {
      id: "lot",
      fabric_id: "fabric",
      lot_code: "A",
      quantity_received_m: 500,
      quality_status: "APROVADO",
      effective_price_per_m: 10,
    },
  ],
  fabric_stock_movements: [
    { id: "move", lot_id: "lot", stock_delta_m: 500, reserved_delta_m: 0 },
  ],
  linen_ready_orders: [],
  linen_ready_receipts: [],
  fabric_production_orders: [],
  fabric_production_order_items: [],
};
const calls = [];
const fetch = async (url, opts) => {
  const table = new URL(url).pathname.split("/").at(-1),
    body = opts?.body ? JSON.parse(opts.body) : null;
  let response = data[table] || [];
  if (table === "linen_ready_purchase") {
    calls.push(body);
    const d = body.p_data;
    if (body.p_action === "create") {
      const o = {
        id: d.id,
        product_reference: d.productReference,
        product_name: d.productName,
        ordered_pieces: +d.quantity,
        received_pieces: 0,
        supplier_id: d.supplierId,
        unit_price: +d.unitPrice,
        order_number: d.orderNumber,
        status: "ABERTA",
        revision: 1,
      };
      data.linen_ready_orders.push(o);
      response = o;
    }
    if (body.p_action === "receive") {
      const o = data.linen_ready_orders.find((o) => o.id === d.id);
      o.received_pieces += +d.quantity;
      const r = {
        id: d.requestId,
        order_id: d.id,
        accepted_pieces: +d.quantity,
        unit_price: +d.unitPrice,
        invoice_number: d.invoiceNumber,
        received_date: d.receivedDate,
        created_at: "2026-11-11T12:00:00Z",
        rfid_confirmed: false,
      };
      data.linen_ready_receipts.push(r);
      response = r;
    }
  }
  if (table === "fabric_save_enfesto") {
    calls.push(body);
    data.fabric_cut_enfestos = [{ ...body.p_data, stock_posted_at: null }];
    response = body.p_data.id;
  }
  return { ok: true, text: async () => JSON.stringify(response) };
};
const vmContext = {
  ...rules,
  ...standards,
  ...linen,
  ...buying,
  document,
  window,
  Event: window.Event,
  MutationObserver: class {
    observe() {}
  },
  setInterval() {},
  location: { pathname: "/enxoval-tecidos", hash: "" },
  crypto,
  FormData: globalThis.FormData,
  fetch,
};
const source = (
  await readFile(new URL("fabric-workflow-ui-v1.js", root), "utf8")
)
  .replace(/^(?:import[^\n]+\n)+/, "")
  .replace(/\}\)\(\);\s*$/, "mount();})();");
vm.runInNewContext(source, vmContext);
const tick = () => new Promise((r) => setTimeout(r, 20));
await tick();
const row = () => document.querySelector("[data-fw-buy-row]");
assert.equal(row().querySelector(".fw-buy-missing").textContent, "500");
row().open = true;
row().dispatchEvent(new window.Event("toggle", { bubbles: true }));
row().querySelector("[data-fw-buy-piece]").click();
let modal = () => [...document.querySelectorAll("dialog[open]")].at(-1);
assert.match(modal().textContent, /Comprar peças prontas/);
const submit = async (values) => {
  const form = modal().querySelector("form");
  for (const [name, value] of Object.entries(values)) {
    const el = form.querySelector(`[name=${name}]`);
    Object.defineProperty(el, "value", { value, configurable: true });
  }
  form.dispatchEvent(
    new window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await tick();
};
await submit({
  orderNumber: "OC-TESTE",
  supplierId: "supplier",
  quantity: "50",
  unitPrice: "15",
});
assert.equal(calls.at(-1).p_action, "create");
assert.equal(row().querySelector(".fw-buy-missing").textContent, "450");
row().querySelector("[data-fw-buy-orders]").click();
assert.match(modal().textContent, /OC-TESTE/);
modal().querySelector("[data-fw-ready-receive]").click();
await submit({ quantity: "20", invoiceNumber: "NF-TESTE" });
assert.equal(calls.at(-1).p_action, "receive");
assert.match(modal().textContent, /20 \/ 50 recebidas/);
assert.equal(row().querySelector(".fw-buy-missing").textContent, "450");
assert.match(row().textContent, /20 recebidas após/);
modal().querySelector("[data-fw-buy-close]").click();
document.querySelector('[data-fw-buy-tool="enfestos"]').click();
modal().querySelector("[data-fw-enfesto-new]").click();
assert.match(modal().textContent, /Metros usados no total/);
modal().querySelector('[data-fw-enfesto-add="pieces"]').click();
const cutLines = [...modal().querySelectorAll('[data-fw-enfesto-line="pieces"]')];
for (const [i, line] of cutLines.entries()) {
  Object.defineProperty(line.querySelector("[data-fw-enfesto-source]"), "value", { value: "", configurable: true });
  for (const [name, value] of Object.entries({ product_name: "Calça", size: i === 0 ? "P" : "G", pieces: "12" })) {
    Object.defineProperty(line.querySelector(`[name=${name}]`), "value", { value, configurable: true });
  }
}
await submit({ fabric_id: "fabric", consumed_m: "50.125", single_lot: "" });
const savedCut = calls.at(-1).p_data;
assert.equal(savedCut.consumed_m, "50.125");
assert.deepEqual(savedCut.outputs.map(item => item.size), ["P", "G"]);
assert.deepEqual(savedCut.allocations, []);
assert.match(modal().textContent, /Baixa pendente de conferência/);
modal().querySelector("[data-fw-buy-close]").click();
document.querySelector("[data-fw-buy-map]").click();
assert.equal(document.querySelector("#gao-fabric-flow").hidden, true);
console.log(
  "PASS DOM: central mounts using actual textile module, saves ready purchase and partial receipt, refreshes order dialog and keeps stock coverage, opens existing map.",
);
