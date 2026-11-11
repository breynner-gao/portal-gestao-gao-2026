import {
  buildBuyingRows,
} from "./linen-buying-rules-v1.mjs?v=1";
import { buyingView, buyingStyles, buyingSortStyles, buyingSortLabel, sortBuyingRows } from "./linen-buying-view-v1.mjs?v=4";
import { compactDimensionKey } from "./linen-risk-rules-v150.mjs?v=226";
export function createBuyingController(env) {
  const { state, esc, n, br, rpc, reload, render, uid } = env;
  let sort = null;
  let query = "",
    expanded = new Set();
  const style = document.createElement("style");
  style.textContent = buyingStyles + buyingSortStyles;
  document.head.appendChild(style);
  const day = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date(),
    );
  const options = (selected = "") =>
    '<option value="">Selecione o fornecedor</option>' +
    state.suppliers
      .map(
        (s) =>
          `<option value="${s.id}" ${s.id === selected ? "selected" : ""}>${esc(s.trade_name || s.legal_name)}</option>`,
      )
      .join("");
  const field = (label, name, type, value = "", extra = "") =>
    `<label class="fw-field">${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  const form = (action, fields) =>
    `<form data-fw-buy-form="${action}">${fields}<button type="submit">Salvar e atualizar</button><button type="button" data-fw-buy-close>Cancelar</button></form>`;
  function model() {
    const snapshot = env.buyingSnapshot();
    const rows = buildBuyingRows({
      snapshot,
      recipes: state.recipes.filter((r) =>
        state.fabric.some((f) => f.id === r.fabric_id),
      ),
      pieceOrders: state.pieceOrders || [],
      pieceReceipts: state.pieceReceipts || [],
      snapshotUpdatedAt: window.GAO_LINEN_SOURCE_UPDATED_AT,
    });
    const pools = env.fabricBuyingBalances();
    return {
      rows: rows.map(row => ({
        ...row,
        pool: row.recipe
          ? pools.find(pool => env.fabricMatches(row.recipe.fabric_id, pool.fabric.id))
          : undefined,
      })),
      pools,
    };
  }
  const rowFor = (key) => model().rows.find((r) => r.key === key);
  function belongs(record, row) {
    return record.product_reference
      ? String(record.product_reference) === row.key
      : compactDimensionKey(record.product_name) ===
          compactDimensionKey(row.name);
  }
  function readyOrdersHTML(key = null) {
    const orders = (state.pieceOrders || []).filter(
      (o) => !key || String(o.product_reference) === key,
    );
    return `<div class="fw-panel"><h3>Compras de peças prontas</h3>${
      orders
        .map((o) => {
          const supplier = state.suppliers.find((s) => s.id === o.supplier_id),
            receipts = (state.pieceReceipts || []).filter(
              (r) => r.order_id === o.id,
            );
          return `<details class="fw-catalog-edit" data-fw-detail-key="ready-${o.id}"><summary><b>OC ${esc(o.order_number)} · ${esc(o.product_name)}</b><small>${esc(supplier?.trade_name || supplier?.legal_name || "")} · ${br(o.received_pieces, 0)} / ${br(o.ordered_pieces, 0)} recebidas · ${o.status === "CANCELADA" ? "Cancelada" : o.received_pieces >= o.ordered_pieces ? "Recebida" : "Em andamento"}</small></summary><p>Previsão: ${esc(o.expected_date || "não informada")} · R$ ${br(o.unit_price, 4)}/peça</p><div class="fw-buy-actions">${o.status !== "CANCELADA" && n(o.received_pieces) < n(o.ordered_pieces) ? `<button type="button" data-fw-ready-receive="${o.id}">Receber peças</button>` : ""}${o.status !== "CANCELADA" ? `<button type="button" data-fw-ready-edit="${o.id}">Editar pedido</button><button type="button" data-fw-ready-cancel="${o.id}">Cancelar saldo pendente</button>` : ""}</div>${receipts.map((r) => `<p>NF ${esc(r.invoice_number)} · ${br(r.accepted_pieces, 0)} peças · ${esc(r.received_date)} · R$ ${br(r.unit_price, 4)}/peça${r.rfid_confirmed ? " · Incorporado ao RFID" : ` · Saldo complementar <button type="button" data-fw-ready-rfid="${r.id}">Já incorporado à base RFID</button>`}</p>`).join("")}</details>`;
        })
        .join("") || "<p>Nenhum pedido de peças prontas registrado.</p>"
    }</div>`;
  }
  function ongoingHTML(key = null) {
    const row = key ? rowFor(key) : null,
      items = state.items.filter(
        (i) =>
          (!row || belongs(i, row)) &&
          state.orders.some(
            (o) => o.id === i.order_id && o.status !== "CANCELADA",
          ),
      ),
      tracking = state.tracking.filter(
        (t) => (!row || belongs(t, row)) && n(t.quantity) > n(t.delivered),
      );
    return (
      readyOrdersHTML(key) +
      `<div class="fw-panel"><h3>Corte e facção</h3>${items
        .map((i) => {
          const o = state.orders.find((o) => o.id === i.order_id),
            s = env.orderStats(i);
          return `<details class="fw-catalog-edit"><summary><b>OS ${esc(o?.order_number)} · ${esc(i.product_name)}</b> · ${br(s.remaining, 0)} peças pendentes</summary><p>${br(s.issued, 3)} m enviados · ${br(s.accepted, 0)} peças recebidas</p><button type="button" data-fw-buy-os="${i.id}">Abrir corte e envio</button><button type="button" data-fw-buy-return="${i.id}">Registrar retorno</button></details>`;
        })
        .join(
          "",
        )}${tracking.map((t) => `<details class="fw-catalog-edit"><summary><b>Programação ${esc(t.source_item)} · ${esc(t.product_name)}</b> · ${br(n(t.quantity) - n(t.delivered), 0)} peças pendentes</summary><p>Corte: ${esc(t.cut_status)} · Previsão: ${esc(t.expected_date || "não informada")}</p><button type="button" data-fw-buy-tracking="${t.id}">Atualizar programação / recebimento</button><button type="button" data-fw-reconcile="${t.id}">Registrar consumo ou sobra</button></details>`).join("")}${!items.length && !tracking.length ? "<p>Nenhuma programação desta peça.</p>" : ""}</div>`
    );
  }
  function fabricOrdersSummary(key = null) {
    const fabricId = key ? rowFor(key)?.recipe?.fabric_id : null;
    const lines = state.purchaseItems.filter(
      (i) =>
        n(i.ordered_m) > n(i.received_m) &&
        (!key || (fabricId && env.fabricMatches(i.fabric_id, fabricId))),
    );
    const pending = state.purchaseOrders.filter(
      (o) =>
        o.status !== "CANCELADA" &&
        lines.some((i) => i.purchase_order_id === o.id),
    );
    return (
      '<div class="fw-panel"><h3>Compras de tecido</h3>' +
      pending
        .map((o) => {
          const meters = lines
            .filter((i) => i.purchase_order_id === o.id)
            .reduce((sum, i) => sum + n(i.ordered_m) - n(i.received_m), 0);
          return (
            "<p><b>OC " +
            esc(o.order_number) +
            "</b> · " +
            br(meters, 3) +
            " m " +
            (o.logistics_stage === "COTACAO" ? "em cotação" : "a receber") +
            " · " +
            esc(o.expected_date || "sem previsão") +
            ' <button type="button" data-fw-buy-open-po="' +
            esc(o.id) +
            '">Abrir / receber tecido</button></p>'
          );
        })
        .join("") +
      (pending.length ? "" : "<p>Nenhuma compra de tecido pendente.</p>") +
      "</div>"
    );
  }
  function view() {
    if (!state.loaded)
      return '<p class="fw-note" role="status">Carregando estoque e pedidos do enxoval…</p>';
    const plan = model();
    return buyingView({
      ...plan,
      ongoing: ongoingHTML() + fabricOrdersSummary(),
      query,
      sort,
    });
  }
  function sortColumn(button) {
    const key = button.dataset.fwBuySort;
    const direction = sort?.key === key
      ? (sort.direction === "asc" ? "desc" : "asc")
      : (key === "name" ? "asc" : "desc");
    sort = { key, direction };
    const heading = button.closest(".fw-buy-heading");
    const list = heading.nextElementSibling;
    const rows = new Map([...list.querySelectorAll("[data-fw-buy-row]")]
      .map((element) => [element.dataset.fwBuyKey, element]));
    for (const row of sortBuyingRows(model().rows, sort)) {
      const element = rows.get(row.key);
      if (element) list.appendChild(element);
    }
    for (const control of heading.querySelectorAll("[data-fw-buy-sort]")) {
      const column = control.dataset.fwBuySort;
      control.setAttribute("aria-pressed", String(column === key));
      control.querySelector("[data-fw-buy-sort-arrow]").textContent = buyingSortLabel(column, sort);
    }
  }
  function restore(host) {
    for (const d of host.querySelectorAll("details[data-fw-detail-key]"))
      if (expanded.has(d.dataset.fwDetailKey)) d.open = true;
  }
  function modal(title, content, kind = "") {
    const d = document.createElement("dialog");
    d.className = "fw-recipe-dialog fw-buy-dialog";
    d.dataset.fwBuyDialog = kind;
    d.dataset.request = uid();
    d.innerHTML = `<header class="fw-modal-head"><h2>${esc(title)}</h2><button type="button" data-fw-buy-close aria-label="Fechar">×</button></header><div class="fw-panel"><p role="alert" data-fw-buy-error class="fw-error" hidden></p>${content}</div>`;
    document.body.appendChild(d);
    d.addEventListener("cancel", (e) => {
      if (d.dataset.saving === "true") e.preventDefault();
      else d.remove();
    });
    d.showModal();
    return d;
  }
  function tool(kind, key = null) {
    if (!state.loaded)
      throw Error("Aguarde os dados do enxoval ou clique em Atualizar dados.");
    state.mode = true;
    state.tab = "buying";
    const views = {
      stock: [
        "Estoque de tecidos",
        () =>
          env.stockPanels("stock") +
          "<details><summary>Lotes recebidos por nota fiscal</summary>" +
          env.stockPanels("lots") +
          "</details>",
      ],
      purchases: [
        "Pedidos e recebimentos",
        () => readyOrdersHTML(key) + env.purchaseOrderView(),
      ],
      receipt: ["Receber nota fiscal", () => env.stockPanels("receipt")],
      supplier: ["Cadastrar fornecedor", () => env.stockPanels("suppliers")],
      catalog: [
        "Cadastros de produtos e fornecedores",
        () =>
          env.standardsManagementView() +
          '<details class="fw-panel"><summary>Referências comerciais por fornecedor</summary>' +
          env.stockPanels("catalog") +
          "</details>" +
          env.stockPanels("suppliers") +
          env.recipeView(),
      ],
      quality: ["Qualidade de tecidos", env.qualityView],
      cost: ["Custos e perdas", env.costView],
      orders: [
        "Pedidos desta peça",
        () => ongoingHTML(key) + fabricOrdersSummary(key),
      ],
    };
    const v = views[kind];
    if (!v) return;
    const d = modal(v[0], v[1](), kind);
    d.dataset.productKey = key || "";
    if (kind === "purchases" && key) {
      const row = rowFor(key);
      if (row?.recipe)
        d.querySelectorAll("[data-fw-purchase-row]").forEach((el) => {
          const orderId = el.dataset.fwDetailKey?.replace(/^oc-/, "");
          el.hidden = !state.purchaseItems.some(
            (i) =>
              i.purchase_order_id === orderId &&
              env.fabricMatches(i.fabric_id, row.recipe.fabric_id),
          );
        });
    }
    if (kind === "purchases")
      d.querySelector(".fw-new-order")?.insertAdjacentHTML(
        "afterbegin",
        '<p><button type="button" data-fw-buy-tool="supplier">+ Cadastrar fornecedor</button></p>',
      );
    return d;
  }
  function quantity(key) {
    const input = [...document.querySelectorAll("[data-fw-buy-quantity]")].find(
        (x) => x.dataset.fwBuyQuantity === key,
      ),
      value = Number(input?.value);
    if (!Number.isSafeInteger(value) || value <= 0)
      throw Error("Informe uma quantidade inteira positiva de peças.");
    return value;
  }
  function pieceDraft(key) {
    const row = rowFor(key);
    if (!row || !row.ready)
      throw Error("Atualize a cobertura dos pedidos antes de comprar.");
    const qty = quantity(key);
    const d = modal(
      "Comprar peças prontas",
      `<p><b>${esc(row.name)}</b> · ${br(row.toOrder, 0)} peças ainda sem cobertura.</p>` +
        form(
          "create",
          `<input type="hidden" name="productReference" value="${esc(key)}"><input type="hidden" name="productName" value="${esc(row.name)}">${field("Número da OC", "orderNumber", "text", "", "required")}<label class="fw-field">Fornecedor<select name="supplierId" required>${options()}</select></label><button type="button" data-fw-buy-tool="supplier">+ Fornecedor</button>${field("Quantidade de peças", "quantity", "number", qty, 'min="1" step="1" required')}${field("Preço por peça (R$)", "unitPrice", "number", "", 'min="0" step=".0001" required')}${field("Data do pedido", "orderedDate", "date", day(), "required")}${field("Previsão de entrega", "expectedDate", "date", "")}${field("Observação", "notes", "text", "")}`,
        ),
      "ready-create",
    );
    d.dataset.productKey = key;
  }
  function readyOperation(action, id) {
    const o = state.pieceOrders.find((o) => o.id === id);
    if (!o) return;
    let content = "",
      title = "";
    if (action === "receive") {
      title = "Receber peças prontas";
      content = form(
        "receive",
        `<input type="hidden" name="id" value="${id}"><p>${esc(o.product_name)} · faltam ${br(n(o.ordered_pieces) - n(o.received_pieces), 0)} peças.</p>${field("Quantidade recebida", "quantity", "number", n(o.ordered_pieces) - n(o.received_pieces), 'min="1" step="1" required')}${field("Custo realizado por peça (R$)", "unitPrice", "number", o.unit_price, 'min="0" step=".0001" required')}${field("Nota fiscal", "invoiceNumber", "text", "", "required")}${field("Data do recebimento", "receivedDate", "date", day(), "required")}<p class="fw-buy-help">As peças entram no saldo complementar. Quando forem incluídas no RFID, confirme pelo próprio recebimento para não duplicar o estoque.</p>`,
      );
    } else if (action === "edit") {
      title = "Editar pedido de peças";
      content = form(
        "edit",
        `<input type="hidden" name="id" value="${id}"><input type="hidden" name="revision" value="${o.revision}">${field("Quantidade total pedida", "quantity", "number", o.ordered_pieces, `min="${Math.max(1, n(o.received_pieces))}" step="1" required`)}${field("Preço previsto (R$/peça)", "unitPrice", "number", o.unit_price, 'min="0" step=".0001" required')}${field("Previsão de entrega", "expectedDate", "date", o.expected_date || "")}${field("Observação", "notes", "text", o.notes || "")}`,
      );
    } else if (action === "cancel") {
      title = "Cancelar saldo pendente";
      content = form(
        "cancel",
        `<input type="hidden" name="id" value="${id}"><input type="hidden" name="revision" value="${o.revision}"><p>Cancelar o saldo não recebido da OC ${esc(o.order_number)}? Os recebimentos e o histórico serão preservados.</p>`,
      );
    }
    modal(title, content, "ready-" + action);
  }
  function produce(key) {
    const row = rowFor(key);
    if (!row?.recipe || !row.ready)
      throw Error("Confira a ficha técnica e os pedidos em andamento.");
    const qty = quantity(key);
    const d = modal(
      "Programar corte e facção",
      `<p><b>${esc(row.name)}</b></p>` +
        form(
          "produce",
          `<input type="hidden" name="productReference" value="${esc(key)}">${field("Peças para esta OS", "quantity", "number", qty, 'min="1" step="1" required')}<p>O sistema gera a OS ligada ao tecido GAO. Corte, envio e retorno podem ser registrados no próprio pedido. Esta programação não registra saída física de tecido.</p>`,
        ),
      "produce",
    );
    d.dataset.recipeId = row.recipe.id;
  }
  function returnDialog(id) {
    const i = state.items.find((i) => i.id === id),
      s = env.orderStats(i);
    modal(
      "Receber retorno da facção",
      `<p>${esc(i.product_name)} · ${br(s.remaining, 0)} peças pendentes.</p>` +
        form(
          "return",
          `<input type="hidden" name="id" value="${id}">${field("Peças aceitas", "accepted", "number", s.remaining, 'min="0" step="1" required')}${field("Peças rejeitadas", "rejected", "number", 0, 'min="0" step="1" required')}${field("Sobra devolvida (m)", "returned", "number", 0, 'min="0" step=".001" required')}${field("Custo da facção nesta entrega (R$)", "faction", "number", (s.remaining * n(i.faction_cost_per_piece)).toFixed(2), 'min="0" step=".01" required')}${field("Aviamentos nesta entrega (R$)", "extras", "number", (s.remaining * n(i.extras_cost_per_piece)).toFixed(2), 'min="0" step=".01" required')}${field("Observação", "notes", "text", "")}`,
        ),
      "return",
    );
  }
  async function save(d, formEl) {
    if (d.dataset.saving === "true") return;
    d.dataset.saving = "true";
    const buttons = [...d.querySelectorAll("button")];
    buttons.forEach((b) => (b.disabled = true));
    const error = d.querySelector("[data-fw-buy-error]");
    error.hidden = true;
    try {
      const values = Object.fromEntries(new FormData(formEl)),
        action = formEl.dataset.fwBuyForm;
      let result;
      if (action === "produce") {
        const row = rowFor(values.productReference),
          qty = Number(values.quantity);
        if (!row?.ready || !row.recipe || row.recipe.id !== d.dataset.recipeId)
          throw Error("O vínculo mudou. Atualize o planejamento.");
        if (!Number.isSafeInteger(qty) || qty <= 0)
          throw Error("Quantidade inválida.");
        if (
          qty > row.toOrder &&
          !confirm(
            "A quantidade supera a necessidade atual. Confirmar esta programação adicional?",
          )
        )
          return;
        const lots = state.lots.filter((l) =>
          env.fabricMatches(l.fabric_id, row.recipe.fabric_id),
        );
        const price =
          lots.reduce(
            (a, l) => a + n(l.quantity_received_m) * n(l.effective_price_per_m),
            0,
          ) / (lots.reduce((a, l) => a + n(l.quantity_received_m), 0) || 1);
        result = await rpc("fabric_create_orders_for_demand", {
          p_organization_id: state.org,
          p_demand_as_of: row.source.asOf || day(),
          p_lines: [
            {
              source_item_key: row.key,
              product_reference: row.key,
              product_name: row.name,
              requested_pieces: qty + n(row.source.pendingServiceOrders),
              recipe_id: row.recipe.id,
              planned_price_per_m: price,
            },
          ],
          p_idempotency_key: "buy-os-" + d.dataset.request,
        });
      } else if (action === "return") {
        await env.returnForm(values.id, {
          ...values,
          requestId: d.dataset.request,
        });
      } else if (action) {
        if (action === "create") {
          const row = rowFor(values.productReference);
          if (!row?.ready)
            throw Error("Atualize o planejamento antes de comprar.");
          if (
            Number(values.quantity) > row.toOrder &&
            !confirm(
              "A compra supera a necessidade atual. Confirmar quantidade adicional?",
            )
          )
            return;
        }
        result = await rpc("linen_ready_purchase", {
          p_org: state.org,
          p_action: action,
          p_data: {
            ...values,
            ...(action === "create" ? { id: d.dataset.request } : {}),
            requestId: d.dataset.request,
          },
        });
      } else {
        result =
          formEl.dataset.fwForm === "qualityBatch"
            ? await env.saveQualityBatch(formEl)
            : await env.submit(formEl);
      }
      await reload();
      if (action === "return") {
        await env.syncOrderStatuses();
        await reload();
      }
      state.notice =
        action === "create"
          ? "Pedido de peças registrado."
          : action === "receive"
            ? "Recebimento registrado."
            : "Alteração salva.";
      render();
      d.close();
      d.remove();
      const parent = [
        ...document.querySelectorAll("dialog[data-fw-buy-dialog][open]"),
      ].at(-1);
      if (
        parent &&
        ["purchases", "orders"].includes(parent.dataset.fwBuyDialog) &&
        formEl.dataset.fwForm !== "supplier"
      ) {
        const kind = parent.dataset.fwBuyDialog,
          key = parent.dataset.productKey || null;
        const openKeys = [
          ...parent.querySelectorAll("details[open][data-fw-detail-key]"),
        ].map((el) => el.dataset.fwDetailKey);
        const hiddenKeys = [
          ...parent.querySelectorAll("details[hidden][data-fw-detail-key]"),
        ].map((el) => el.dataset.fwDetailKey);
        parent.close();
        parent.remove();
        const refreshed = tool(kind, key);
        for (const el of refreshed.querySelectorAll(
          "details[data-fw-detail-key]",
        )) {
          if (openKeys.includes(el.dataset.fwDetailKey)) el.open = true;
          if (hiddenKeys.includes(el.dataset.fwDetailKey)) el.hidden = true;
        }
      }

      // A supplier created in a child dialog becomes available without losing the parent draft.
      if (formEl.dataset.fwForm === "supplier") {
        const supplier = Array.isArray(result) ? result[0] : result;
        for (const select of document.querySelectorAll(
          "dialog [name=supplier_id],dialog [name=supplierId]",
        )) {
          const previous = select.value;
          select.innerHTML = options(supplier?.id || previous);
          const parent = select.closest('[data-fw-form="purchaseOrder"]');
          if (parent) env.refreshPurchaseReferences(parent);
        }
      }
      window.dispatchEvent(new Event("gao-production-updated"));
    } catch (e) {
      error.textContent = e.message || String(e);
      error.hidden = false;
    } finally {
      d.dataset.saving = "false";
      buttons.forEach((b) => (b.disabled = false));
    }
  }
  document.addEventListener("input", (e) => {
    if (!e.target.matches("[data-fw-buy-search]")) return;
    query = e.target.value;
    document.querySelectorAll("[data-fw-buy-row]").forEach((el) => {
      el.hidden = !el.dataset.search.includes(
        query.trim().toLocaleLowerCase("pt-BR"),
      );
    });
  });
  document.addEventListener(
    "toggle",
    (e) => {
      const key = e.target.dataset?.fwDetailKey;
      if (!key) return;
      e.target.open ? expanded.add(key) : expanded.delete(key);
    },
    true,
  );
  document.addEventListener(
    "submit",
    (e) => {
      const d = e.target.closest("[data-fw-buy-dialog]");
      if (!d) return;
      const formEl = e.target.closest("form");
      if (!formEl) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      save(d, formEl);
    },
    true,
  );
  document.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest("button,a");
      if (!b) return;
      if (b.matches("[data-fw-buy-sort]")) {
        sortColumn(b);
        return;
      }
      const own =
        b.matches(
          "[data-fw-buy-close],[data-fw-buy-tool],[data-fw-buy-piece],[data-fw-buy-produce],[data-fw-buy-fabric],[data-fw-buy-orders],[data-fw-buy-os],[data-fw-buy-tracking],[data-fw-buy-return],[data-fw-ready-receive],[data-fw-ready-edit],[data-fw-ready-cancel],[data-fw-ready-rfid],[data-fw-buy-open-po]",
        ) ||
        (b.matches("[data-fw-return]") && state.tab === "buying") ||
        (b.matches('a[href^="#os-cut-"]') && state.tab === "buying") ||
        (b.matches(
          "[data-fw-open-lot-quality],[data-fw-quality-invoice],[data-fw-quality-all]",
        ) &&
          state.tab === "buying");
      if (!own) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      try {
        if (b.matches("[data-fw-buy-close]")) {
          const d = b.closest("dialog");
          if (d.dataset.saving !== "true") {
            d.close();
            d.remove();
          }
          return;
        }
        if (b.dataset.fwBuyOpenPo) {
          const d = tool("purchases");
          for (const el of d.querySelectorAll("[data-fw-purchase-row]")) {
            el.hidden =
              el.dataset.fwDetailKey !== "oc-" + b.dataset.fwBuyOpenPo;
            if (!el.hidden) el.open = true;
          }
          return;
        }
        if (b.dataset.fwBuyTool) {
          tool(b.dataset.fwBuyTool);
          return;
        }
        if (b.dataset.fwBuyPiece) {
          pieceDraft(b.dataset.fwBuyPiece);
          return;
        }
        if (b.dataset.fwBuyProduce) {
          produce(b.dataset.fwBuyProduce);
          return;
        }
        if (b.dataset.fwBuyFabric) {
          const pool = env.fabricBuyingBalances().find(item => item.fabric.id === b.dataset.fwBuyFabric);
          if (pool) env.openFabricPurchaseDraft({ fabric: pool.fabric }, {});
          return;
        }
        if (b.dataset.fwBuyOrders) {
          tool("orders", b.dataset.fwBuyOrders);
          return;
        }
        if (b.dataset.fwBuyOs || b.matches('a[href^="#os-cut-"]')) {
          const id = b.dataset.fwBuyOs || b.getAttribute("href").slice(8);
          modal("Corte e envio da OS", env.productionView(id), "production");
          return;
        }
        if (b.dataset.fwBuyTracking) {
          modal(
            "Programação e recebimento",
            env.trackingView(b.dataset.fwBuyTracking),
            "tracking",
          );
          return;
        }
        if (b.dataset.fwBuyReturn || b.dataset.fwReturn) {
          returnDialog(b.dataset.fwBuyReturn || b.dataset.fwReturn);
          return;
        }
        for (const [attr, action] of [
          ["fwReadyReceive", "receive"],
          ["fwReadyEdit", "edit"],
          ["fwReadyCancel", "cancel"],
        ])
          if (b.dataset[attr]) {
            readyOperation(action, b.dataset[attr]);
            return;
          }
        if (b.dataset.fwReadyRfid) {
          const r = state.pieceReceipts.find(
            (r) => r.id === b.dataset.fwReadyRfid,
          );
          modal(
            "Confirmar integração ao RFID",
            form(
              "confirm_rfid",
              `<input type="hidden" name="id" value="${r.order_id}"><input type="hidden" name="receiptId" value="${r.id}"><input type="hidden" name="snapshotUpdatedAt" value="${esc(window.GAO_LINEN_SOURCE_UPDATED_AT || "")}"><p>Confirme somente se as ${br(r.accepted_pieces, 0)} peças da NF ${esc(r.invoice_number)} já estão na base RFID atual. Elas sairão do saldo complementar.</p><label><input type="checkbox" required> Conferi que o RFID já considera este recebimento</label>`,
            ),
            "rfid",
          );
          return;
        }
        if (b.matches("[data-fw-open-lot-quality]")) {
          const lot = state.lots.find(
            (l) => l.id === b.dataset.fwOpenLotQuality,
          );
          state.qualityLot = lot?.id;
          state.qualityInvoice =
            String(lot?.invoice_number || "").trim() ||
            "Sem NF • " + (lot?.lot_code || lot?.id);
          tool("quality");
          return;
        }
        if (b.matches("[data-fw-quality-invoice]"))
          state.qualityInvoice = b.dataset.fwQualityInvoice;
        if (b.matches("[data-fw-quality-all]")) state.qualityLot = null;
        const d = b.closest("[data-fw-buy-dialog]");
        if (d) {
          d.close();
          d.remove();
        }
        tool("quality");
      } catch (error) {
        state.error = error.message;
        render();
      }
    },
    true,
  );
  return { view, model, restore, tool };
}
