const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const q = (v, d = 0) =>
  v === null
    ? "A conferir"
    : Number(v || 0).toLocaleString("pt-BR", { maximumFractionDigits: d });
const metric = (title, value) =>
  `<span class="fw-buy-metric"><small>${title}</small><b>${value}</b></span>`;
const buyingColumns = [
  ["name", "Peça"],
  ["target", "Meta pelas trocas"],
  ["available", "Estoque útil¹"],
  ["production", "Corte / facção"],
  ["incoming", "Peças a receber"],
  ["toOrder", "Falta cobrir"],
];
const compareNames = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" }).compare;

export function sortBuyingRows(rows, sort) {
  if (!sort || !buyingColumns.some(([key]) => key === sort.key)) return rows;
  const { key, direction } = sort;
  const sign = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "name") return sign * compareNames(a.name ?? "", b.name ?? "");
    const left = a[key], right = b[key];
    if (!Number.isFinite(left)) return Number.isFinite(right) ? 1 : 0;
    if (!Number.isFinite(right)) return -1;
    return sign * (left - right);
  });
}

export function buyingSortLabel(key, sort) {
  const active = sort?.key === key;
  return active ? (sort.direction === "asc" ? "↑" : "↓") : "↕";
}

function buyingHeading(sort) {
  return `<div class="fw-buy-heading" role="group" aria-label="Ordenar peças por coluna">${buyingColumns.map(([key, label]) =>
    `<button type="button" data-fw-buy-sort="${key}" aria-pressed="${sort?.key === key}" title="Ordenar por ${label}">${label} <span data-fw-buy-sort-arrow>${buyingSortLabel(key, sort)}</span></button>`
  ).join("")}</div>`;
}
export function buyingView({
  rows = [],
  pools = [],
  ongoing = "",
  query = "",
  sort = null,
} = {}) {
  const active = sortBuyingRows(rows, sort).filter(
    (r) =>
      r.toOrder === null ||
      r.toOrder > 0 ||
      r.production > 0 ||
      r.incoming > 0 ||
      r.addedStock > 0,
  );
  return `<div class="fw-buy-toolbar"><label>Buscar peça<input type="search" data-fw-buy-search value="${esc(query)}" placeholder="Nome ou código da peça"></label><div><button type="button" data-fw-buy-map>Ver mapa de trocas</button><button type="button" data-fw-buy-tool="purchases">Pedidos e recebimentos</button><button type="button" data-fw-buy-tool="stock">Consultar estoque</button><button type="button" data-fw-buy-tool="supplier">+ Fornecedor</button><details class="fw-buy-more"><summary>Mais opções</summary><button type="button" data-fw-buy-tool="receipt">Receber NF sem pedido</button><button type="button" data-fw-buy-tool="quality">Qualidade dos tecidos</button><button type="button" data-fw-buy-tool="catalog">Cadastros e fichas</button><button type="button" data-fw-buy-tool="cost">Custos e perdas</button></details></div></div><p class="fw-buy-help">A necessidade de enxoval é acompanhada em peças. Os metros efetivamente usados são apurados depois do corte, por lote de enfesto.</p>${buyingHeading(sort)}<div class="fw-buy-list">${active.map((r) => `<details class="fw-buy-row" data-fw-detail-key="buy-${esc(r.key)}" data-fw-buy-row data-fw-buy-key="${esc(r.key)}" data-search="${esc((r.key + " " + r.name).toLocaleLowerCase("pt-BR"))}" ${query && !(r.key + " " + r.name).toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")) ? "hidden" : ""}><summary><span><b>${esc(r.name)}</b><small>${esc(r.key)}</small></span><span data-label="Meta">${q(r.target)}</span><span data-label="Estoque útil">${q(r.available)}${r.addedStock ? "<small>+" + q(r.addedStock) + " recebidas após a base RFID</small>" : ""}</span><span data-label="Corte / facção">${q(r.production)}</span><span data-label="A receber">${q(r.incoming)}</span><span data-label="Falta cobrir" class="fw-buy-missing">${q(r.toOrder)}</span></summary><div class="fw-buy-detail">${r.receiptReview ? '<p class="fw-error">A base RFID foi atualizada depois de um recebimento. Confirme no pedido se estas peças já entraram na base para evitar contar duas vezes.</p>' : !r.ready ? '<p class="fw-error">Aguarde a atualização dos pedidos em andamento antes de emitir uma nova compra.</p>' : ""}${r.recipe ? `<p><b>Tecido vinculado:</b> ${esc(r.pool?.fabric.name || "Padrão GAO")} <button type="button" data-fw-edit-recipe="${esc(r.recipe.id)}">Editar vínculo</button></p>${r.pool ? `<div class="fw-buy-metrics">${metric("Estoque livre do tecido", q(r.pool.free, 3) + " m")}${metric("Reservado", q(r.pool.reserved, 3) + " m")}${metric("A receber", q(r.pool.incoming, 3) + " m")}</div>` : ""}` : `<p class="fw-buy-help">Tecido sem vínculo único. <button type="button" data-fw-link-recipe="${esc(r.key)}">Vincular tecido</button></p>`}<div class="fw-buy-actions">${r.toOrder > 0 ? `<label>Quantidade de peças<input type="number" min="1" step="1" inputmode="numeric" data-fw-buy-quantity="${esc(r.key)}" value="${r.toOrder}"></label><button type="button" data-fw-buy-piece="${esc(r.key)}">Comprar peças prontas</button>${r.recipe ? `<button type="button" data-fw-buy-produce="${esc(r.key)}">Programar corte / facção</button>` : ""}` : ""}${r.pool ? `<button type="button" data-fw-buy-fabric="${esc(r.pool.fabric.id)}">Pedir tecido em metros</button>` : ""}<button type="button" data-fw-buy-orders="${esc(r.key)}">Ver pedidos desta peça</button></div>${r.toOrder === 0 ? '<p class="fw-buy-ok">Necessidade coberta pelo estoque e pelos pedidos registrados.</p>' : ""}</div></details>`).join("") || (rows.length ? '<p class="fw-note">Nenhuma pendência na base atual.</p>' : '<p class="fw-note">Base RFID sem peças carregadas. Abra Importações para carregar a posição de estoque.</p>')}</div><p class="fw-buy-help">¹ Inclui cliente, área crítica, mercado, depósito e processo considerados no mapa. Costura bloqueada fica fora. As peças prontas recebidas ficam identificadas até confirmar a integração na base RFID.</p><details class="fw-panel" data-fw-detail-key="buy-ongoing"><summary><b>Pedidos e facção em andamento</b> · abrir para acompanhar e receber</summary>${ongoing}</details><details class="fw-panel" data-fw-detail-key="buy-fabrics"><summary><b>Saldo e compras de tecidos</b></summary><div class="fw-table-scroll"><table><thead><tr><th>Tecido GAO</th><th>Estoque livre</th><th>Reservado</th><th>A receber</th><th>Pedido</th></tr></thead><tbody>${pools.map((p) => `<tr><td>${esc(p.fabric.name)}</td><td>${q(p.free, 3)} m</td><td>${q(p.reserved, 3)} m</td><td>${q(p.incoming, 3)} m</td><td><button type="button" data-fw-buy-fabric="${esc(p.fabric.id)}">Pedir em metros</button></td></tr>`).join("")}</tbody></table></div></details>`;
}
export const buyingStyles = `.fw-buy-toolbar,.fw-buy-toolbar>div,.fw-buy-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.fw-buy-toolbar{justify-content:space-between;margin:18px 0}.fw-buy-toolbar label{display:grid;gap:6px}.fw-buy-toolbar button,.fw-buy-actions button,.fw-buy-detail button,.fw-buy-list+details button{min-height:44px;border:1px solid #b9d1e8;border-radius:8px;padding:10px 14px;background:#fff;color:#174a78;font-weight:700;cursor:pointer}.fw-buy-actions>button{background:#287fba;color:white}.fw-buy-toolbar input,.fw-buy-actions input{border:1px solid #b9d1e8;border-radius:8px;padding:10px;font:inherit}.fw-buy-actions input{width:100px}.fw-buy-actions label{display:grid;gap:5px;color:#54708e;font-size:13px}.fw-buy-help{font-size:13px;line-height:1.5;color:#54708e}.fw-buy-heading,.fw-buy-row>summary{display:grid;grid-template-columns:minmax(240px,2fr) repeat(5,minmax(90px,1fr));gap:14px;align-items:center}.fw-buy-heading{padding:14px;color:#54708e;font-size:12px}.fw-buy-row{border:1px solid #d4e2ee;border-radius:10px;background:white;margin:9px 0;overflow:hidden}.fw-buy-row>summary{padding:16px;cursor:pointer;list-style:none;font-size:14px}.fw-buy-row>summary>span:first-child:before{content:'▸';display:inline-block;margin-right:8px;color:#237fbd}.fw-buy-row[open]>summary>span:first-child:before{content:'▾'}.fw-buy-row summary small{display:block;color:#7890a8;font-size:12px;margin-top:4px}.fw-buy-row[open]>summary{background:#edf6fd}.fw-buy-missing{font-size:20px;font-weight:800;color:#174a78}.fw-buy-detail{padding:18px;border-top:1px solid #d4e2ee}.fw-buy-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.fw-buy-metric{padding:12px;background:#f3f8fc;border-radius:8px}.fw-buy-metric small,.fw-buy-metric b{display:block}.fw-buy-metric small{font-size:12px;color:#54708e}.fw-buy-metric b{font-size:22px;margin-top:5px}.fw-buy-ok{color:#19864c}.fw-buy-more{position:relative}.fw-buy-more summary{cursor:pointer;padding:12px;border:1px solid #b9d1e8;border-radius:8px}.fw-buy-more[open]{background:white}.fw-buy-more button{display:block;margin:6px}.fw-buy-row[hidden]{display:none!important}.fw-buy-dialog .fw-panel{margin:0}.fw-buy-dialog details>summary{cursor:pointer;padding:12px}.fw-buy-dialog input,.fw-buy-dialog select{max-width:100%}@media(max-width:1100px){.fw-buy-heading{display:flex;flex-wrap:wrap;gap:6px;padding:6px 0}.fw-buy-heading button{border-color:#d5e3ef!important}.fw-buy-row>summary{grid-template-columns:repeat(3,1fr);gap:14px}.fw-buy-row>summary>span:first-child{grid-column:1/-1}.fw-buy-row>summary>span[data-label]:before{content:attr(data-label);display:block;color:#54708e;font-size:11px;margin-bottom:4px}.fw-buy-metrics{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.fw-buy-row>summary{grid-template-columns:repeat(2,1fr)}.fw-buy-toolbar>div{width:100%}.fw-buy-toolbar label,.fw-buy-toolbar input{width:100%;box-sizing:border-box}.fw-buy-actions>button{width:100%}.fw-buy-detail{padding:12px}.fw-buy-metric b{font-size:19px}}`;

export const buyingSortStyles = `
.fw-buy-heading button{display:flex;justify-content:space-between;align-items:center;gap:6px;text-align:left;min-height:44px;padding:6px 8px;border:1px solid transparent;border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.fw-buy-heading button:hover,.fw-buy-heading button[aria-pressed="true"]{background:#e8f1fa;color:#153f64}
.fw-buy-heading button:focus-visible{outline:2px solid #2475ab;outline-offset:2px}
.fw-buy-heading [data-fw-buy-sort-arrow]{font-weight:700;flex-shrink:0}
`;
