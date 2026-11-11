// Meters belong to the cutting run. Planned and actual piece counts belong to each size.
export function createEnfestoControls(env, { modal, field, form, day }) {
  const { state, esc, br, rpc, fabricMatches } = env;
  const formatMeters = value => br(value, 3) + " m";
  const originOptions = fabricId => {
    const lots = env.liveBalances().filter(lot =>
      lot.quality_status === "APROVADO" &&
      fabricMatches(lot.fabric_id, fabricId) &&
      lot.onhand > lot.reserved
    );
    return lots.map(lot =>
      `<option value="${esc(lot.id)}">${esc(lot.lot_code)} · ${formatMeters(lot.onhand - lot.reserved)} livres</option>`
    ).join("");
  };
  const sources = () => [
    ...state.items.filter(item => state.orders.some(order =>
      order.id === item.order_id && !["CONCLUIDA", "CANCELADA"].includes(order.status)
    )).map(item => ({
      id: item.id, type: "os", name: item.product_name, size: "", quantity: env.orderStats(item).remaining,
      label: "OS " + state.orders.find(order => order.id === item.order_id).order_number,
    })),
    ...state.tracking.filter(item => item.quantity > item.delivered &&
      !/cancelad|conclu[ií]d|entregue/i.test(item.delivery_status || "")
    ).map(item => ({
      id: item.id, type: "programacao", name: item.product_name, size: item.size || "",
      quantity: Number(item.quantity) - Number(item.delivered),
      label: "Programação " + (item.source_item || ""),
    })),
  ];
  const row = (content, kind) => `<div data-fw-enfesto-line="${kind}" class="fw-enfesto-line">${content}<button type="button" data-fw-enfesto-remove>Remover linha</button></div>`;
  function pieceLine() {
    return row(
      `<label class="fw-field">Vincular à programação (opcional)<select data-fw-enfesto-source><option value="">Preencher peça</option>${sources().map(source =>
        `<option value="${esc(source.type + ":" + source.id)}">${esc(source.label + " · " + source.name)}</option>`
      ).join("")}</select></label>` +
      field("Peça / modelo", "product_name", "text", "", 'required maxlength="300"') +
      field("Tamanho", "size", "text", "", 'required maxlength="80" placeholder="Ex.: M ou único"') +
      field("Peças previstas", "planned_pieces", "number", "", 'required min="1" max="99999999" step="1"'),
      "pieces",
    );
  }
  function stockLine(fabricId, meters = "") {
    return row(
      `<label class="fw-field">Rolo / lote de estoque<select name="lot_id" required><option value="">Selecione o rolo</option>${originOptions(fabricId)}</select></label>` +
      field("Metros usados deste rolo", "meters", "number", meters, 'required min="0.001" step="0.001"'),
      "stock",
    );
  }
  function newCut() {
    const fabrics = env.fabricBuyingBalances();
    const d = modal("Planejar lote de corte", form("enfesto-plan",
      `<p>Informe os metros previstos para o enfesto inteiro e quantas peças pretende cortar de cada tamanho.</p>
       <div class="fw-enfesto-line">
       ${field("Data prevista do corte", "cut_on", "date", day(), "required")}
       <label class="fw-field">Tecido<select name="fabric_id" required>
       <option value="">Selecione o tecido</option>${fabrics.map(({ fabric }) =>
         `<option value="${esc(fabric.id)}">${esc(fabric.name)}</option>`
       ).join("")}</select></label>
       ${field("Metros previstos no total", "planned_m", "number", "", 'required min="0.001" step="0.001"')}</div>
       <div data-fw-enfesto-lines="pieces">${pieceLine()}</div>
       <button type="button" data-fw-enfesto-add="pieces">+ Peça ou tamanho</button>
       ${field("Observação (opcional)", "notes", "text", "", 'maxlength="500"')}`,
      "Salvar planejamento",
    ), "enfesto-plan");
    d.querySelector('[name="fabric_id"]')?.focus();
  }
  function finishCut(cut) {
    const fabric = state.fabric.find(item => item.id === cut.fabric_id);
    const d = modal("Registrar resultado do corte", form("enfesto-finish",
      `<p><b>${esc(fabric?.name || "Tecido")}</b> · Previsto ${formatMeters(cut.planned_m)}</p>
       <div class="fw-enfesto-line">
       ${field("Metros usados no total", "consumed_m", "number", "", 'required min="0.001" step="0.001"')}
       ${field("Desperdício (m)", "waste_m", "number", "0", 'required min="0" step="0.001"')}
       ${field("Sobra devolvida ao estoque (m)", "returned_m", "number", "0", 'required min="0" step="0.001"')}</div>
       <p>Inclua o desperdício nos metros usados. Informe à parte a sobra reaproveitável que já voltou ao estoque. A baixa desconta os metros usados.</p>
       <div>${cut.outputs.map(item => `<div class="fw-enfesto-line">
         <div class="fw-field"><b>${esc(item.product_name)} · ${esc(item.size)}</b><span>${br(item.planned_pieces, 0)} peças previstas</span></div>
         ${field("Peças cortadas", "pieces", "number", "", 'required min="0" max="99999999" step="1"')}</div>`
       ).join("")}</div>
       <label class="fw-field">Rolo único identificado (opcional)<select name="single_lot"><option value="">Deixar baixa pendente</option>
       ${originOptions(cut.fabric_id)}</select></label>`, "Salvar resultado"
    ), "enfesto-finish");
    d.dataset.cutId = cut.id;
  }
  function postStock(cut) {
    const d = modal("Conferir baixa de tecido", form("enfesto-stock",
      `<p>Total registrado no corte: <b>${formatMeters(cut.consumed_m)}</b>. Informe os metros usados de cada rolo, incluindo o desperdício. A sobra devolvida fica fora da baixa.</p>
       <div data-fw-enfesto-lines="stock">${stockLine(cut.fabric_id, cut.consumed_m)}</div>
       <button type="button" data-fw-enfesto-add="stock">+ Rolo</button>`
    ), "enfesto-stock");
    d.dataset.cutId = cut.id;
    d.dataset.fabricId = cut.fabric_id;
  }
  function history() {
    return `<div class="fw-panel"><button type="button" data-fw-enfesto-new>Planejar lote de corte</button>
      ${(state.enfestos || []).map(cut => {
        const fabric = state.fabric.find(item => item.id === cut.fabric_id);
        const planned = cut.planned_m != null;
        const finished = cut.consumed_m != null;
        const plannedPieces = cut.outputs.reduce((sum, item) => sum + Number(item.planned_pieces || 0), 0);
        const pieces = cut.outputs.reduce((sum, item) => sum + Number(item.pieces || 0), 0);
        const status = !finished ? "Aguardando corte" : cut.stock_posted_at ? "Baixa registrada" : "Baixa pendente de conferência";
        return `<details class="fw-catalog-edit" data-fw-detail-key="enfesto-${esc(cut.id)}"><summary><b>${esc(cut.cut_on.split("-").reverse().join("/"))} · ${esc(fabric?.name || "Tecido")} · ${finished ? formatMeters(cut.consumed_m) + " usados · " + br(pieces, 0) + " peças cortadas" : formatMeters(cut.planned_m) + " previstos · " + br(plannedPieces, 0) + " peças previstas"}</b><small>${status}</small></summary>
          ${planned && finished ? `<p>Previsto ${formatMeters(cut.planned_m)} · Desperdício ${formatMeters(cut.waste_m)} · Sobra devolvida ${formatMeters(cut.returned_m)}</p>` : ""}
          <ul>${cut.outputs.map(item => `<li>${esc(item.product_name)} · ${esc(item.size)} · ${planned ? br(item.planned_pieces, 0) + " previstas" : ""}${planned && finished ? " / " : ""}${finished ? br(item.pieces, 0) + " cortadas" : ""}</li>`).join("")}</ul>
          ${cut.notes ? `<p>${esc(cut.notes)}</p>` : ""}
          ${!finished ? `<button type="button" data-fw-enfesto-finish="${esc(cut.id)}">Registrar resultado</button>` : cut.stock_posted_at ? `<ul>${cut.allocations.map(item => {
            const lot = state.lots.find(l => l.id === item.lot_id);
            return `<li>${esc(lot?.lot_code || item.lot_id)} · ${formatMeters(item.meters)}</li>`;
          }).join("")}</ul>` : `<button type="button" data-fw-enfesto-post="${esc(cut.id)}">Conferir rolos e baixar</button>`}</details>`;
      }).join("") || "<p>Nenhum lote de corte registrado.</p>"}
      </div>`;
  }
  function click(button) {
    if (button.hasAttribute("data-fw-enfesto-new")) {
      newCut();
      return true;
    }
    if (button.dataset.fwEnfestoFinish) {
      const cut = state.enfestos.find(item => item.id === button.dataset.fwEnfestoFinish);
      if (cut && cut.consumed_m == null) finishCut(cut);
      return true;
    }
    if (button.dataset.fwEnfestoPost) {
      const cut = state.enfestos.find(item => item.id === button.dataset.fwEnfestoPost);
      if (cut) postStock(cut);
      return true;
    }
    if (button.dataset.fwEnfestoAdd) {
      const kind = button.dataset.fwEnfestoAdd;
      const dialog = button.closest("dialog");
      dialog.querySelector(`[data-fw-enfesto-lines="${kind}"]`).insertAdjacentHTML(
        "beforeend", kind === "pieces" ? pieceLine() : stockLine(dialog.dataset.fabricId)
      );
      return true;
    }
    if (button.hasAttribute("data-fw-enfesto-remove")) {
      const line = button.closest("[data-fw-enfesto-line]");
      if (line.parentElement.children.length > 1) line.remove();
      return true;
    }
    return false;
  }
  document.addEventListener("change", event => {
    const input = event.target;
    if (input.matches("[data-fw-enfesto-source]")) {
      const [type, id] = input.value.split(":");
      const source = sources().find(item => item.type === type && item.id === id);
      const line = input.closest("[data-fw-enfesto-line]");
      const name = line.querySelector('[name="product_name"]');
      name.readOnly = Boolean(source);
      if (source) {
        name.value = source.name;
        line.querySelector('[name="size"]').value = source.size;
        line.querySelector('[name="planned_pieces"]').value = source.quantity > 0 ? source.quantity : "";
      }
    }
  });
  function save(dialog, formEl) {
    const val = (node, name) => node.querySelector(`[name="${name}"]`).value.trim();
    const action = formEl.dataset.fwBuyForm.slice("enfesto-".length);
    let data;
    if (action === "plan") {
      data = {
        id: dialog.dataset.request,
        fabric_id: val(formEl, "fabric_id"),
        cut_on: val(formEl, "cut_on"),
        planned_m: val(formEl, "planned_m"),
        notes: val(formEl, "notes"),
        outputs: [...formEl.querySelectorAll('[data-fw-enfesto-line="pieces"]')].map(line => {
          const [type, id] = line.querySelector("[data-fw-enfesto-source]").value.split(":");
          return {
            product_name: val(line, "product_name"),
            size: val(line, "size"),
            planned_pieces: Number(val(line, "planned_pieces")),
            ...(id ? { source_type: type, source_id: id } : {}),
          };
        }),
      };
    } else if (action === "finish") {
      const total = val(formEl, "consumed_m");
      const lotId = val(formEl, "single_lot");
      data = {
        id: dialog.dataset.cutId,
        consumed_m: total,
        waste_m: val(formEl, "waste_m"),
        returned_m: val(formEl, "returned_m"),
        actual_pieces: [...formEl.querySelectorAll('[name="pieces"]')].map(input => input.value === "" ? null : Number(input.value)),
        allocations: lotId ? [{ lot_id: lotId, meters: total }] : [],
      };
    } else {
      data = {
        id: dialog.dataset.cutId,
        allocations: [...formEl.querySelectorAll('[data-fw-enfesto-line="stock"]')].map(line => ({
          lot_id: val(line, "lot_id"),
          meters: val(line, "meters"),
        })),
      };
    }
    return rpc("fabric_save_enfesto", {
      p_org: state.org, p_action: action === "stock" ? "post_stock" : action, p_data: data,
    });
  }
  return { history, click, save };
}
