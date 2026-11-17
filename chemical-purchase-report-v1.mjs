import { reportCss } from './relave-daily-report-v1.mjs?v=8';
import { openReport } from './relave-report-export-v1.mjs?v=2';

const database = 'https://fquzuxdqvhecijjuxbmg.supabase.co/rest/v1/';
const apiKey = 'sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
const weeksInReport = 8;
const monthsInReport = 6;
const forecastMonths = 3;
const minRecordedWeeks = 4;
const monthLabel = new Intl.DateTimeFormat('pt-BR', {month: 'short', year: 'numeric', timeZone: 'UTC'});
const fmt = new Intl.NumberFormat('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const brl = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});
const liters = value => fmt.format(value) + ' L';
const date = value => value.split('-').reverse().join('/');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => (
  {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]
));

function distinctWeeks(records) {
  const weeksByKey = new Map();
  for (const week of records) {
    const key = week.week_year + '-' + week.week_number;
    if (!weeksByKey.has(key) || week.calendar_basis === 'ISO') weeksByKey.set(key, week);
  }
  return [...weeksByKey.values()].sort((a,b) => a.sunday.localeCompare(b.sunday));
}

function productLabel(product, resolve) {
  const principle = resolve(product.code) || resolve(product.name);
  return {name: principle || product.name, reference: principle && principle !== product.name ? product.name : ''};
}

export function weeklyConsumption(records, resolve) {
  const weeks = distinctWeeks(records).slice(-weeksInReport);
  const products = new Map();
  for (const [index, week] of weeks.entries()) {
    for (const row of week.chemical_consumptions || []) {
      const product = row.chemical_products;
      if (!product || row.consumption_liters == null) continue;
      const volume = Number(row.consumption_liters);
      if (!Number.isFinite(volume) || volume < 0) continue;
      if (!products.has(row.product_id)) {
        products.set(row.product_id, {...productLabel(product, resolve), values: weeks.map(() => null)});
      }
      const series = products.get(row.product_id).values;
      series[index] = (series[index] ?? 0) + volume;
    }
  }
  return {weeks, products: [...products.values()].sort((a,b) => a.name.localeCompare(b.name,'pt-BR'))};
}

function monthRange(issuedOn, offset, count) {
  const [year, month] = issuedOn.split('-').map(Number);
  return Array.from({length: count}, (_, index) => {
    const start = new Date(Date.UTC(year, month - 1 + offset + index, 1));
    return {key: start.toISOString().slice(0,7), label: monthLabel.format(start)};
  });
}

const reportMonths = issuedOn => monthRange(issuedOn, 1 - monthsInReport, monthsInReport);

const total = () => ({volume: 0, cost: 0, priced: 0, unpriced: 0});

function addConsumption(target, volume, cost) {
  target.volume += volume;
  if (cost === null) target.unpriced++;
  else {
    target.cost += cost;
    target.priced++;
  }
}

function recordedCost(row, volume) {
  if (volume === 0) return 0;
  const cost = Number(row.calculated_cost);
  if (Number.isFinite(cost) && cost > 0) return cost;
  const price = Number(row.price_per_liter);
  return Number.isFinite(price) && price > 0 ? volume * price : null;
}

export function monthlyConsumption(records, issuedOn, resolve) {
  const months = new Map(reportMonths(issuedOn).map(month => [month.key, {...month, ...total(), weeks: 0}]));
  const products = new Map();
  for (const week of distinctWeeks(records)) {
    const month = months.get(week.saturday.slice(0,7));
    if (!month || week.saturday > issuedOn) continue;
    let hasConsumption = false;
    for (const row of week.chemical_consumptions || []) {
      const product = row.chemical_products;
      const volume = Number(row.consumption_liters);
      if (row.consumption_liters == null || !Number.isFinite(volume) || volume < 0) continue;
      const cost = recordedCost(row, volume);
      hasConsumption = true;
      addConsumption(month, volume, cost);
      if (!products.has(row.product_id)) {
        products.set(row.product_id, {
          ...(product ? productLabel(product, resolve) : {name: 'Produto sem identificação', reference: ''}),
          byMonth: new Map()
        });
      }
      const {byMonth} = products.get(row.product_id);
      if (!byMonth.has(month.key)) byMonth.set(month.key, total());
      addConsumption(byMonth.get(month.key), volume, cost);
    }
    if (hasConsumption) month.weeks++;
  }
  return {months: [...months.values()], products: [...products.values()].sort((a,b) => a.name.localeCompare(b.name,'pt-BR'))};
}

async function loadConsumption(issuedOn, filters) {
  const session = window.GAO_AUTH_SESSION || await window.GAO_AUTH_READY;
  if (!session?.access_token) throw new Error('Sessão indisponível.');
  const headers = {apikey: apiKey, Authorization: 'Bearer ' + session.access_token};
  const query = new URLSearchParams({
    select: 'week_year,week_number,calendar_basis,sunday,saturday,organizations!inner(kind,active),chemical_consumptions(product_id,consumption_liters,price_per_liter,calculated_cost,chemical_products(code,name))',
    'organizations.kind': 'eq.gao',
    'organizations.active': 'eq.true',
    deleted_at: 'is.null',
    sunday: 'lte.' + issuedOn,
    order: 'sunday.desc',
    ...filters
  });
  const result = await fetch(database + 'chemical_weeks?' + query, {headers, signal: AbortSignal.timeout(12000)});
  if (!result.ok) throw new Error('Histórico de consumo indisponível.');
  return result.json();
}

function purchaseTable(rows, totals) {
  const headers = [
    'Princípio ativo', 'Consumo até o fechamento', 'Saldo para o próximo mês',
    'Consumo do próximo mês', 'Necessidade do próximo mês', 'Fornecedor / produto',
    'Apresentação', 'Preço/kg', 'Preço/L', 'Emb.', 'Comprar', 'Valor estimado'
  ];
  const orders = rows.filter(row => row.need > 0 && row.selected);
  if (!orders.length) return '<p>Nenhum pedido com opção de fornecimento selecionada.</p>';
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>
    ${orders.map(row => {
      const offer = row.selected;
      const price = Number(offer.priceL || Number(offer.priceKg || 0) * Number(offer.density || 0));
      const cells = [
        row.n, liters(row.consumptionToClose), liters(row.opening), liters(row.consumptionNext),
        liters(row.need), (offer.supplier || '—') + ' · ' + (offer.commercialName || offer.product || row.n),
        liters(row.pack), offer.priceKg ? brl.format(offer.priceKg) + '/kg' : '—', brl.format(price) + '/L',
        row.packs, liters(row.order), brl.format(row.order * price)
      ];
      return `<tr>${cells.map((cell, i) => i === 0
        ? `<th scope="row">${escape(cell)}</th>`
        : `<td>${escape(cell)}</td>`).join('')}</tr>`;
    }).join('')}</tbody><tfoot><tr>
    <th scope="row" colspan="9">Total da solicitação</th>
    <td>${orders.reduce((sum,row) => sum + row.packs,0).toLocaleString('pt-BR')}</td>
    <td>${liters(totals.liters)}</td><td>${brl.format(totals.value)}</td>
    </tr></tfoot></table></div>`;
}

function costCell(entry) {
  if (!entry || !entry.priced && !entry.unpriced) return '—';
  if (!entry.priced) return 'Sem custo';
  return brl.format(entry.cost) + (entry.unpriced ? ' *' : '');
}

function monthlySection(monthly, issuedOn, safeLogo) {
  const heading = `<header><div class="brand">${safeLogo}<span>GESTÃO DE QUÍMICOS</span></div>
    <h2>Consumo mensal de químicos</h2><p>Gasto registrado em reais, por mês e por produto</p></header>`;
  if (!monthly?.products.length) return `<section class="trends">${heading}
    <p>${monthly ? 'Sem lançamentos de consumo nas semanas encerradas do período.' : 'Não foi possível carregar o consumo mensal.'}</p></section>`;
  const {months, products} = monthly;
  const current = issuedOn.slice(0,7);
  const label = month => escape(month.label) + (month.key === current ? ' (parcial)' : '');
  const hasUnpriced = months.some(month => month.unpriced);
  return `<section class="trends">${heading}
    <p class="note">Últimos ${monthsInReport} meses. Cada semana encerrada entra no mês da data de encerramento. O custo vem do lançamento ou do preço por litro gravado nele.</p>
    <h3>Total consumido por mês</h3>
    <div class="table-wrap"><table class="monthly-summary"><thead><tr><th scope="col">Mês</th><th scope="col">Semanas com lançamento</th><th scope="col">Consumo em litros</th><th scope="col">Custo do consumo</th></tr></thead><tbody>
    ${months.map(month => `<tr><th scope="row">${label(month)}</th><td>${month.weeks}</td><td>${month.weeks ? liters(month.volume) : '—'}</td><td>${costCell(month)}</td></tr>`).join('')}
    </tbody></table></div>
    <h3>Gasto mensal por produto</h3>
    <div class="table-wrap"><table class="monthly-products"><thead><tr><th scope="col">Produto</th>${months.map(month => `<th scope="col">${label(month)}</th>`).join('')}</tr></thead><tbody>
    ${products.map(product => `<tr><th scope="row">${escape(product.name)}${product.reference ? `<br><small>${escape(product.reference)}</small>` : ''}</th>
      ${months.map(month => `<td>${costCell(product.byMonth.get(month.key))}</td>`).join('')}</tr>`).join('')}
    </tbody><tfoot><tr><th scope="row">Total por mês</th>${months.map(month => `<td>${costCell(month)}</td>`).join('')}</tr></tfoot></table></div>
    <p class="note">— Sem lançamento no período.${hasUnpriced ? ' * Total parcial: há consumo sem custo registrado.' : ''}</p></section>`;
}

function weeklyClosings(key) {
  const [year, month] = key.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Math.floor((days - 1 + first) / 7) + (first === 0 ? 1 : 0);
}

function forecastSeries(history, future, current, key) {
  const observed = history.flatMap((month, index) => {
    if (month.weeks === 0 || (key === 'cost' && month.priced === 0)) return [];
    const partial = month.key === current || month.weeks < minRecordedWeeks || (key === 'cost' && month.unpriced > 0);
    return [{index, value: month[key], weeks: month.weeks, partial}];
  });
  const base = observed.filter(point => !point.partial);
  if (base.length < 3) return {observed, trend: [], forecast: [], baseCount: base.length};
  const center = base.reduce((sum, point) => sum + point.index, 0) / base.length;
  const rate = base.reduce((sum, point) => sum + point.value / point.weeks, 0) / base.length;
  const slope = base.reduce((sum, point) => sum + (point.index - center) * (point.value / point.weeks - rate), 0) /
    base.reduce((sum, point) => sum + (point.index - center) ** 2, 0);
  const predict = (index, weeks) => Math.max(0, rate + slope * (index - center)) * weeks;
  return {
    observed,
    trend: base.map(({index, weeks}) => ({index, value: predict(index, weeks)})),
    forecast: future.map(({key}, i) => {
      const index = history.length + i;
      return {index, value: predict(index, weeklyClosings(key))};
    }),
    baseCount: base.length
  };
}

export function monthlyForecast(months, issuedOn) {
  const current = issuedOn.slice(0,7);
  const future = monthRange(issuedOn, 1, forecastMonths);
  return {
    periods: [...months, ...future],
    future,
    volume: forecastSeries(months, future, current, 'volume'),
    cost: forecastSeries(months, future, current, 'cost')
  };
}

const axisNumber = new Intl.NumberFormat('pt-BR', {notation: 'compact', maximumFractionDigits: 1});
const chartMonth = new Intl.DateTimeFormat('pt-BR', {month: 'short', timeZone: 'UTC'});
const chartNumber = new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 0});
const chartColors = {recorded: '#245783', partial: '#d5e4ef', trend: '#77519c', projection: '#087d73'};

function forecastChart(title, unit, format, periods, first, firstFuture, {observed, trend, forecast, baseCount}) {
  const left = 56, right = 752, axisBottom = 162;
  const step = (right - left) / (periods.length - first);
  const x = index => left + (index - first + .5) * step;
  const boundary = x(firstFuture) - step / 2;
  const nTicks = 4;
  const max = Math.max(1, ...[...observed, ...trend, ...forecast].map(point => point.value));
  const magnitude = .5 * Math.pow(10, Math.floor(Math.log10(max / nTicks)));
  const tick = Math.ceil(max / (nTicks * magnitude)) * magnitude;
  const y = value => axisBottom - 106 * value / (nTicks * tick);
  const line = (points, color, dash = '') => points.length
    ? `<polyline fill="none" stroke="${color}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" ${dash} points="${points.map(point => x(point.index) + ',' + y(point.value)).join(' ')}"/>` : '';
  const grid = Array.from({length: nTicks + 1}, (_, i) => {
    const value = i * tick;
    return `<line x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}" stroke="#dce5ed"/><text x="${left - 9}" y="${y(value) + 4}" text-anchor="end">${axisNumber.format(value)}</text>`;
  }).join('');
  const zones = firstFuture < periods.length
    ? `<rect x="${boundary}" y="6" width="${right - boundary}" height="200" rx="10" fill="#eaf6f3"/>
      <line x1="${boundary}" x2="${boundary}" y1="36" y2="${axisBottom}" stroke="#9cc8c0" stroke-dasharray="3 4"/>
      <text x="${boundary + 13}" y="24" class="forecast-zone">Projeção</text>` : '';
  const barWidth = Math.min(42, step * .48);
  const trendByIndex = new Map(trend.map(point => [point.index, point.value]));
  const valueLabel = (index, value, level, color) =>
    `<text x="${x(index)}" y="${y(level) - 11}" text-anchor="middle" class="forecast-value" style="fill:${color}">${chartNumber.format(value)}</text>`;
  const bars = observed.map(({index, value, partial}) => {
    const color = partial ? chartColors.partial : chartColors.recorded;
    return `<rect x="${x(index) - barWidth / 2}" y="${y(value)}" width="${barWidth}" height="${Math.max(1, axisBottom - y(value))}"
      rx="4" fill="${color}"${partial ? ' stroke="#7090a8" stroke-dasharray="3 3"' : ''}><title>${escape(periods[index].label)} · ${escape(format(value))}${partial ? ' · Parcial' : ''}</title></rect>`;
  }).join('');
  const dots = forecast.map(({index, value}) =>
    `<circle cx="${x(index)}" cy="${y(value)}" r="4.2" fill="#fff" stroke="${chartColors.projection}" stroke-width="2.6"><title>${escape(periods[index].label)} · Projeção de ${escape(format(value))}</title></circle>`).join('');
  const labels = periods.slice(first).map((p, i) => {
    const [year, month] = p.key.split('-');
    const name = chartMonth.format(new Date(Date.UTC(Number(year), Number(month) - 1, 1))).replace('.', '');
    return `<text x="${x(i + first)}" y="183" text-anchor="middle" class="forecast-month">${name}</text>
      <text x="${x(i + first)}" y="198" text-anchor="middle" class="forecast-year">${year}</text>`;
  }).join('');
  return `<article class="forecast-chart"><h3>${title} <span>${unit}</span></h3><div class="table-wrap">
    <svg viewBox="0 0 768 212" role="img" aria-label="${title} por mês em ${unit}, com tendência e projeção quando há dados suficientes">
    ${zones}<text x="${left + 8}" y="24" class="forecast-zone">Histórico</text>${grid}${bars}
    ${line(trend, chartColors.trend)}${line(forecast, chartColors.projection, 'stroke-dasharray="6 4"')}${dots}
    ${observed.map(({index, value}) => valueLabel(index, value, Math.max(value, trendByIndex.get(index) ?? 0), '#173b57')).join('')}
    ${forecast.map(({index, value}) => valueLabel(index, value, value, '#08675f')).join('')}${labels}
    </svg></div>${forecast.length ? '' : `<p class="note">Projeção indisponível. ${baseCount} de 3 meses necessários para o cálculo.</p>`}</article>`;
}

function forecastSection(monthly, issuedOn) {
  if (!monthly?.months.some(month => month.weeks)) return '';
  const {periods, future, volume, cost} = monthlyForecast(monthly.months, issuedOn);
  const showForecast = volume.forecast.length || cost.forecast.length;
  const first = volume.observed[0].index;
  const firstFuture = monthly.months.length;
  const chartPeriods = showForecast ? periods : monthly.months;
  return `<section class="trends forecast-section"><h2>Tendência e projeção mensal</h2>
    <div class="legend forecast-legend"><span><i class="forecast-key-recorded"></i>Registrado</span><span><i class="forecast-key-partial"></i>Parcial</span>
      ${showForecast ? '<span><i class="forecast-key-trend"></i>Tendência</span><span><i class="forecast-key-projection"></i>Projeção</span>' : ''}</div>
    ${forecastChart('Consumo de químicos', 'L', liters, chartPeriods, first, firstFuture, volume)}
    ${forecastChart('Gasto com consumo', 'R$', value => brl.format(value), chartPeriods, first, firstFuture, cost)}
    ${showForecast ? `<h3>Estimativa dos próximos ${forecastMonths} meses</h3>
      <div class="table-wrap"><table class="monthly-summary"><thead><tr><th scope="col">Mês</th><th scope="col">Consumo projetado</th><th scope="col">Gasto projetado</th></tr></thead><tbody>
      ${future.map((month, i) => `<tr><th scope="row">${escape(month.label)}</th>
        <td>${volume.forecast[i] ? liters(volume.forecast[i].value) : '—'}</td>
        <td>${cost.forecast[i] ? brl.format(cost.forecast[i].value) : '—'}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
    <p class="note">Tendência linear do consumo e do gasto médios por semana nos meses encerrados com pelo menos quatro semanas registradas. A projeção considera quantas semanas ISO encerram em cada mês. Meses parciais ficam fora do cálculo. O gasto projetado estima o custo do consumo.</p></section>`;
}

function consumptionChart(product, weeks, issuedOn) {
  const max = Math.max(1, ...product.values);
  return `<article class="chart">
    <h3>${escape(product.name)}</h3>
    ${product.reference ? `<p class="note">${escape(product.reference)}</p>` : ''}
    <ul class="bars" aria-label="Consumo semanal em litros">
    ${weeks.map((week, i) => {
      const volume = product.values[i];
      const label = `S${String(week.week_number).padStart(2, '0')}/${week.week_year}`;
      const legacy = week.calendar_basis === 'LEGACY';
      const partial = week.saturday >= issuedOn;
      const period = date(week.sunday) + ' a ' + date(week.saturday);
      return `<li title="${period}${legacy ? ' · Calendário anterior' : ''}${partial ? ' · Em andamento' : ''}">
        <div class="bar-track">${volume === null ? '' : `<div class="bar${partial ? ' partial' : ''}" style="height:${100 * volume / max}%"></div>`}</div>
        <strong>${volume === null ? '—' : fmt.format(volume)}</strong>
        <span>${label}${legacy ? ' †' : ''}${partial ? ' *' : ''}</span>
      </li>`;
    }).join('')}</ul>
  </article>`;
}

const css = `
  @page{size:A4 landscape}
  main{max-width:1160px}.meta{display:flex;flex-wrap:wrap;gap:4px 18px;margin:12px 0}
  .table-wrap{overflow-x:auto}table{min-width:830px}tbody th{background:#f5f8fa}
  td,th{vertical-align:top}td:last-child{font-weight:bold}
  tfoot th,tfoot td{background:#e2edf4;border-top:2px solid #2269a4;font-weight:bold}
  .order-dates{display:flex;flex-wrap:wrap;gap:6px 24px;margin-top:10px;color:#d5f3f8}
  h3{font-size:14px;margin:0;color:#102d45}
  .monthly-summary{min-width:480px;margin:6px 0 12px}
  .monthly-products{min-width:720px;margin:6px 0 8px}
  .monthly-products td,.monthly-summary td{white-space:nowrap}
  .monthly-products tbody td:last-child{font-weight:normal}
  .forecast-section>h2{font-size:21px;margin:0 0 8px}
  .forecast-legend{margin:4px 0 14px;gap:10px 20px}
  .forecast-legend i{margin-right:5px;border:0;width:17px;vertical-align:middle}
  .forecast-legend .forecast-key-recorded,.forecast-legend .forecast-key-partial{height:9px;width:12px;border-radius:2px;background:${chartColors.recorded}}
  .forecast-legend .forecast-key-partial{background:${chartColors.partial};border:1px dashed #7090a8}
  .forecast-legend .forecast-key-trend{border-top:2px solid ${chartColors.trend}}
  .forecast-legend .forecast-key-projection{border-top:2px dashed ${chartColors.projection}}
  .forecast-chart{padding:14px 14px 6px;margin-bottom:12px;border:1px solid #dbe5ed;border-radius:12px;background:#fff}
  .forecast-chart h3{margin:0 0 6px;display:flex;align-items:center;gap:8px}
  .forecast-chart h3 span{padding:2px 7px;border-radius:5px;background:#edf3f8;color:#264d69;font-size:10px}
  .forecast-chart svg{min-width:530px;max-height:none;height:auto}
  .forecast-chart svg text{font:10px Arial,sans-serif;fill:#526b80}
  .forecast-chart svg .forecast-zone{font-size:11px;font-weight:700;fill:#2d5b69}
  .forecast-chart svg .forecast-value{font-size:11px;font-weight:700}
  .forecast-chart svg .forecast-month{font-size:11px;font-weight:700;fill:#173b57}
  .forecast-chart svg .forecast-year{font-size:9px}
  .chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .chart{border:1px solid #dbe5ed;border-radius:8px;padding:10px}
  .bars{display:flex;list-style:none;margin:8px 0 0;padding:0}
  .bars li{flex:1 1 0;min-width:0;text-align:center;font-size:10px;font-variant-numeric:tabular-nums}
  .bars strong,.bars span{display:block;margin-top:4px}
  .bars span{color:#526b80}
  .bar-track{height:75px;display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid #9ab2c5}
  .bar{width:60%;border-radius:3px 3px 0 0;background:#2269a4}
  .bar.partial{background:#087e73}
  @media screen and (max-width:740px){main{margin:0;padding:12px}.chart-grid{grid-template-columns:1fr}}
  @media screen and (max-width:420px){.chart{padding:8px 4px}.bars li{font-size:9px}.cards{gap:4px}.cards b{font-size:15px}}
  @media print{table,.monthly-summary,.monthly-products,.forecast-chart svg{min-width:0}.forecast-chart{padding:6px 8px 3px;margin-bottom:8px}.forecast-chart svg{max-height:48mm}.table-wrap{overflow:visible}.chart-grid{display:block;column-count:2;column-gap:10px}.chart{margin-bottom:10px}}
`;

export function renderChemicalPurchaseReport({rows, totals, inventoryDate, period, issuedOn, history, monthly, logo}) {
  const safeLogo = /^data:image\/(?:webp|png);base64,[A-Za-z0-9+/=]+$/.test(logo || '')
    ? `<img src="${logo}" alt="GAO Lavanderia">` : '<strong>GAO Lavanderia</strong>';
  const cards = [
    ['Valor estimado', brl.format(totals.value), 'Compra de ' + period.nextMonth],
    ['Volume a comprar', liters(totals.liters), fmt.format(totals.kg) + ' kg equivalentes'],
    ['Custo médio ponderado', brl.format(totals.avgL) + '/L', brl.format(totals.avgKg) + '/kg']
  ];
  const gaps = rows.filter(row => row.currentGap > 0);
  const missingOffers = rows.filter(row => row.need > 0 && !row.selected);
  const title = 'Solicitação de compra — Produtos químicos';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>GAO · ${title}</title><style>${reportCss}${css}</style></head><body><div class="print"></div><main>
    <header><div class="brand">${safeLogo}<span>GESTÃO DE QUÍMICOS</span></div>
      <h1>${title}</h1><p>${escape(period.nextMonth)} · ${period.nextDays} dias de consumo projetado</p>
      <div class="order-dates"><span><strong>Data do pedido</strong> ${date(issuedOn)}</span>
      <span><strong>Início previsto do consumo</strong> ${date(period.startDate)}</span></div></header>
    <div class="cards">${cards.map(([name,value,detail]) => `<div><strong>${name}</strong><b>${escape(value)}</b><small>${escape(detail)}</small></div>`).join('')}</div>
    <div class="meta"><span><strong>Inventário base</strong> ${date(inventoryDate)}</span>
      <span><strong>Fechamento</strong> ${date(period.closeDate)} · ${period.toClose} dias após o inventário</span></div>
    <p class="note">A projeção considera o recebimento do volume em trânsito até o fechamento.</p>
    <h2>Itens da solicitação</h2>${purchaseTable(rows, totals)}
    ${gaps.length ? `<h2>Falta prevista antes do fechamento</h2><p>${gaps.map(row => escape(row.n) + ' · ' + liters(row.currentGap)).join(' | ')}</p>` : ''}
    ${missingOffers.length ? `<h2>Necessidade sem fornecedor selecionado</h2><p>${missingOffers.map(row => escape(row.n) + ' · ' + liters(row.need)).join(' | ')}</p>` : ''}
    ${monthlySection(monthly, issuedOn, safeLogo)}
    ${forecastSection(monthly, issuedOn)}
    <section class="trends"><header><div class="brand">${safeLogo}<span>GESTÃO DE QUÍMICOS</span></div><h2>Consumo semanal por produto</h2>
    <p>Histórico de consumo registrado no SGQ · Litros</p></header>
    ${history?.products.length ? `<p class="note">${history.weeks.length} semanas registradas. † Calendário anterior. * Semana em andamento. — Sem lançamento para o produto na semana.</p>
      <div class="chart-grid">${history.products.map(product => consumptionChart(product, history.weeks, issuedOn)).join('')}</div>`
     : `<p>${history ? 'Nenhum consumo semanal disponível para este acesso.' : 'Não foi possível carregar o histórico de consumo. Emita a solicitação novamente para tentar consultar os dados.'}</p>`}
    </section></main></body></html>`;
}

export async function openChemicalPurchaseReport(page, data, resolve) {
  const logo = getComputedStyle(document.documentElement).getPropertyValue('--liquid-logo')
    .match(/data:image\/(?:png|webp);base64,[A-Za-z0-9+/=]+/)?.[0];
  const [firstMonth] = reportMonths(data.issuedOn);
  const records = await loadConsumption(data.issuedOn, {saturday: 'gte.' + firstMonth.key + '-01'}).catch(() => null);
  const monthly = records && monthlyConsumption(records, data.issuedOn, resolve);
  const weeklyRecords = records && distinctWeeks(records).length >= weeksInReport
    ? records
    : await loadConsumption(data.issuedOn, {limit: String(weeksInReport * 2)}).catch(() => records);
  if (page.closed) return;
  const history = weeklyRecords && weeklyConsumption(weeklyRecords, resolve);
  openReport(renderChemicalPurchaseReport({...data, history, monthly, logo}), 'gao-compra-quimicos-' + data.issuedOn, {page, orientation: 'landscape'});
}
