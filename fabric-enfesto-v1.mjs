// The cutting run owns the meters. Piece lines record only actual output.
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
      id: item.id, type: "os", name: item.product_name, size: "",
      label: "OS " + state.orders.find(order => order.id === item.order_id).order_number,
    })),
    ...state.tracking.filter(item => item.quantity > item.delivered &&
      !/cancelad|conclu[ií]d|entregue/i.test(item.delivery_status || "")
    ).map(item => ({
      id: item.id, type: "programacao", name: item.product_name, size: item.size || "",
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
      field("Peças cortadas", "pieces", "number", "", 'required min="1" max="99999999" step="1"'),
      "pieces",
    );
  }
  function stockLine(fabricId, meters = "") {
    return row(
      `<label class="fw-field">Rolo / lote de estoque<select name="lot_id" required><option value="">Selecione o rolo</option>${originOptions(fabricId)}</select></label>` +
      field("Metros deste rolo", "meters", "number", meters, 'required min="0.001" step="0.001"'),
      "stock",
    );
  }
  function newCut() {
    const fabrics = env.fabricBuyingBalances();
    const d = modal("Registrar lote de corte", form("enfesto-create",
      `<p>Informe o total efetivamente usado no enfesto e as peças que saíram por tamanho.</p><div class="fw-enfesto-line">
       ${field("Data do corte", "cut_on", "date", day(), "required")}
       <label class="fw-field">Tecido usado<select name="fabric_id" data-fw-enfesto-fabric required>
       <option value="">Selecione o tecido</option>${fabrics.map(({ fabric }) =>
         `<option value="${esc(fabric.id)}">${esc(fabric.name)}</option>`
       ).join("")}</select></label>
       ${field("Metros usados no total", "consumed_m", "number", "", 'required min="0.001" step="0.001"')}
       <label class="fw-field">Rolo único identificado (opcional)<select name="single_lot"><option value="">Deixar baixa pendente</option></select></label></div>
       <p>Se o total veio de mais de um rolo, deixe a baixa pendente para conferir a origem depois.</p>
       <div data-fw-enfesto-lines="pieces">${pieceLine()}</div>
       <button type="button" data-fw-enfesto-add="pieces">+ Peça ou tamanho</button>
       ${field("Observação (opcional)", "notes", "text", "", 'maxlength="500"')}`
    ), "enfesto-create");
    d.querySelector('[name="fabric_id"]')?.focus();
  }
  function postStock(cut) {
    const d = modal("Conferir baixa de tecido", form("enfesto-stock",
      `<p>Total registrado no corte: <b>${formatMeters(cut.consumed_m)}</b>. Informe os metros usados em cada rolo identificado.</p>
       <div data-fw-enfesto-lines="stock">${stockLine(cut.fabric_id, cut.consumed_m)}</div>
       <button type="button" data-fw-enfesto-add="stock">+ Rolo</button>`
    ), "enfesto-stock");
    d.dataset.cutId = cut.id;
    d.dataset.fabricId = cut.fabric_id;
  }
  function history() {
    return `<div class="fw-panel"><button type="button" data-fw-enfesto-new>Registrar lote de corte</button>
      ${(state.enfestos || []).map(cut => {
        const fabric = state.fabric.find(item => item.id === cut.fabric_id);
        const pieces = cut.outputs.reduce((sum, item) => sum + Number(item.pieces), 0);
        return `<details class="fw-catalog-edit" data-fw-detail-key="enfesto-${esc(cut.id)}"><summary><b>${esc(cut.cut_on.split("-").reverse().join("/"))} · ${esc(fabric?.name || "Tecido")} · ${formatMeters(cut.consumed_m)} · ${br(pieces, 0)} peças</b><small>${cut.stock_posted_at ? "Baixa registrada" : "Baixa pendente de conferência"}</small></summary>
          <ul>${cut.outputs.map(item => `<li>${esc(item.product_name)} · ${esc(item.size)} · ${br(item.pieces, 0)} peças</li>`).join("")}</ul>
          ${cut.notes ? `<p>${esc(cut.notes)}</p>` : ""}
          ${cut.stock_posted_at ? `<ul>${cut.allocations.map(item => {
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
    if (input.matches("[data-fw-enfesto-fabric]")) {
      input.form.elements.single_lot.innerHTML =
        '<option value="">Deixar baixa pendente</option>' + originOptions(input.value);
    }
    if (input.matches("[data-fw-enfesto-source]")) {
      const [type, id] = input.value.split(":");
      const source = sources().find(item => item.type === type && item.id === id);
      const line = input.closest("[data-fw-enfesto-line]");
      const name = line.querySelector('[name="product_name"]');
      name.readOnly = Boolean(source);
      if (source) {
        name.value = source.name;
        if (source.size) line.querySelector('[name="size"]').value = source.size;
      }
    }
  });
  function save(dialog, formEl) {
    const val = (node, name) => node.querySelector(`[name="${name}"]`).value.trim();
    const create = formEl.dataset.fwBuyForm === "enfesto-create";
    let data;
    if (create) {
      const total = val(formEl, "consumed_m");
      const lotId = val(formEl, "single_lot");
      data = {
        id: dialog.dataset.request,
        fabric_id: val(formEl, "fabric_id"),
        cut_on: val(formEl, "cut_on"),
        consumed_m: total,
        notes: val(formEl, "notes"),
        outputs: [...formEl.querySelectorAll('[data-fw-enfesto-line="pieces"]')].map(line => {
          const [type, id] = line.querySelector("[data-fw-enfesto-source]").value.split(":");
          return {
            product_name: val(line, "product_name"),
            size: val(line, "size"),
            pieces: Number(val(line, "pieces")),
            ...(id ? { source_type: type, source_id: id } : {}),
          };
        }),
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
      p_org: state.org, p_action: create ? "create" : "post_stock", p_data: data,
    });
  }
  return { history, click, save };
}
