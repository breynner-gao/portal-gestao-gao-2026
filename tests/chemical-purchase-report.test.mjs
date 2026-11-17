import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyConsumption, monthlyForecast, renderChemicalPurchaseReport, weeklyConsumption } from '../chemical-purchase-report-v1.mjs';

const consumption = (name, code, liters) => ({
  product_id: code,
  chemical_products: {name, code},
  consumption_liters: liters
});
const soda = liters => consumption('MSC', 'MSC', liters);
const cloro = liters => consumption('Cloro', 'CLORO', liters);
const entry = (number, start, end, records, basis = 'ISO') => ({
  week_year: 2026, week_number: number, calendar_basis: basis, sunday: start, saturday: end,
  chemical_consumptions: records
});
const history = weeklyConsumption([
  entry(45, '2026-11-02', '2026-11-08', [soda('141.35'), soda(10), cloro(0)]),
  entry(45, '2026-11-01', '2026-11-07', [soda(900)], 'LEGACY'),
  entry(44, '2026-10-25', '2026-10-31', [soda(200)], 'LEGACY'),
  entry(46, '2026-11-09', '2026-11-15', [soda(100), cloro(5)])
], code => code === 'MSC' ? 'Soda' : null);
const reportData = {
  rows: [{
    n: 'Soda', need: 1077.10, currentGap: 0, selected: {supplier: 'Fornecedor <A>', priceL: 5},
    consumptionToClose: 542.78, opening: 217.22, consumptionNext: 1294.32, pack: 1000, packs: 2, order: 2000
  }],
  totals: {value: 10000, liters: 2000, kg: 3058, avgL: 5, avgKg: 3.27},
  inventoryDate: '2026-11-17', issuedOn: '2026-11-17',
  period: {nextMonth: 'dezembro de 2026', closeDate: '2026-11-30', startDate: '2026-12-01', nextDays: 31, toClose: 13}
};

test('totais semanais somam os equipamentos em litros, preferem ISO e distinguem zero de ausência', () => {
  assert.deepEqual(history.weeks.map(week => week.week_number), [44, 45, 46]);
  assert.deepEqual(history.products.map(product => [product.name, product.values]), [
    ['Cloro', [null, 0, 5]], ['Soda', [200, 151.35, 100]]
  ]);
});

test('relatório preserva a solicitação e exibe um gráfico por produto registrado', () => {
  const html = renderChemicalPurchaseReport({...reportData, history});
  assert.match(html, /Fornecedor &lt;A&gt;/);
  assert.match(html, /10\.000,00/);
  assert.match(html, /1\.077,10 L/);
  assert.match(html, /30\/11\/2026/);
  assert.match(html, /<strong>Data do pedido<\/strong> 17\/11\/2026/);
  assert.match(html, /<strong>Início previsto do consumo<\/strong> 01\/12\/2026/);
  assert.match(html, /<tfoot><tr>\s*<th scope="row" colspan="9">Total da solicitação<\/th>\s*<td>2<\/td>\s*<td>2\.000,00 L<\/td><td>R\$\s10\.000,00<\/td>/);
  assert.match(html, /151,35/);
  assert.match(html, /S44\/2026 †/);
  assert.match(html, /<h3>Cloro<\/h3>/);
  assert.match(html, /<h3>Soda<\/h3>/);
  assert.match(html, /class="print"/);
  assert.match(renderChemicalPurchaseReport({...reportData, history: null}), /Não foi possível carregar o histórico/);
});

test('consumo mensal soma os custos originais por produto e usa o mês do encerramento', () => {
  const monthly = monthlyConsumption([
    entry(44, '2026-10-26', '2026-11-01', [
      {...soda(12), calculated_cost: '57.20', price_per_liter: '5.00'},
      {...soda(3), calculated_cost: null, price_per_liter: '4.00'},
      {...cloro(2), calculated_cost: '6.20'}
    ]),
    entry(44, '2026-10-25', '2026-10-31', [{...soda(999), calculated_cost: '9990'}], 'LEGACY'),
    entry(45, '2026-11-02', '2026-11-08', [{...soda(5), calculated_cost: '20'}]),
    entry(46, '2026-11-09', '2026-11-15', [soda(7), cloro(0)]),
    entry(47, '2026-11-16', '2026-11-22', [{...soda(999), calculated_cost: '9990'}])
  ], reportData.issuedOn, code => code === 'MSC' ? 'Soda' : null);

  assert.deepEqual(monthly.months.map(month => month.key), [
    '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'
  ]);
  assert.equal(monthly.months.at(-2).weeks, 0);
  const november = monthly.months.at(-1);
  assert.equal(november.weeks, 3);
  assert.equal(november.volume, 29);
  assert.equal(november.cost.toFixed(2), '95.40');
  assert.equal(november.unpriced, 1);
  const sodaTotal = monthly.products.find(p => p.name === 'Soda').byMonth.get('2026-11');
  assert.equal(sodaTotal.cost.toFixed(2), '89.20');
  assert.equal(sodaTotal.unpriced, 1);

  const html = renderChemicalPurchaseReport({...reportData, history, monthly});
  assert.match(html, /Consumo mensal de químicos[\s\S]*Gasto mensal por produto[\s\S]*Consumo semanal por produto/);
  assert.match(html, /nov\. de 2026 \(parcial\)/);
  assert.match(html, /R\$\s95,40/);
  assert.match(html, /R\$\s89,20 \*/);
  assert.match(html, /há consumo sem custo registrado/);
  assert.match(html, /<tfoot><tr><th scope="row">Total por mês/);
});

const closedMonth = (key, weeks, weeklyVolume, weeklyCost, unpriced = 0) => ({
  key, label: key, weeks, volume: weeklyVolume * weeks,
  cost: weeklyCost * weeks, priced: weeks, unpriced
});

test('projeção usa a tendência semanal dos meses completos e respeita o calendário futuro', () => {
  const months = [
    closedMonth('2026-07', 0, 0, 0),
    closedMonth('2026-08', 5, 100, 1000),
    closedMonth('2026-09', 4, 90, 900),
    closedMonth('2026-10', 4, 80, 800),
    closedMonth('2026-11', 3, 1000, 10000)
  ];
  const estimate = monthlyForecast(months, reportData.issuedOn);
  assert.deepEqual(estimate.future.map(month => month.key), ['2026-12', '2027-01', '2027-02']);
  assert.deepEqual(estimate.volume.forecast.map(point => point.value), [240, 250, 160]);
  assert.deepEqual(estimate.cost.forecast.map(point => point.value), [2400, 2500, 1600]);
  assert.equal(estimate.volume.observed.at(-1).partial, true);
  assert.equal(estimate.cost.baseCount, 3);
  assert.deepEqual(estimate.volume.trend.map(point => point.value), [500, 360, 320]);
  const html = renderChemicalPurchaseReport({...reportData, history, monthly: {months, products: []}});
  assert.match(html, /Consumo de químicos <span>L<\/span>[\s\S]*Gasto com consumo <span>R\$<\/span>/);
  assert.match(html, /stroke-dasharray="6 4"/);
  const chart = html.match(/<svg[\s\S]*?<\/svg>/)[0];
  assert.match(chart, /class="forecast-zone">Projeção/);
  assert.match(chart, /class="forecast-value"[^>]*>240<\/text>/);
  assert.doesNotMatch(chart, /class="forecast-month">jul/);
  assert.deepEqual([...chart.matchAll(/class="forecast-month">([^<]+)/g)].map(match => match[1]), [
    'ago', 'set', 'out', 'nov', 'dez', 'jan', 'fev'
  ]);
  assert.match(chart, /class="forecast-month">jan<\/text>\s*<text[^>]*class="forecast-year">2027/);

  assert.match(html, /jan\. de 2027<\/th>[\s\S]*250,00 L<\/td>[\s\S]*R\$\s2\.500,00/);
});

test('custos incompletos e meses sem cobertura ficam fora do ajuste, sem estimativas negativas', () => {
  const estimate = monthlyForecast([
    closedMonth('2026-07', 2, 999, 999),
    closedMonth('2026-08', 5, 42, 1000),
    closedMonth('2026-09', 4, 20, 900, 1),
    closedMonth('2026-10', 4, 1, 800),
    closedMonth('2026-11', 0, 0, 0)
  ], reportData.issuedOn);
  assert.equal(estimate.volume.baseCount, 3);
  assert.deepEqual(estimate.volume.forecast.map(point => point.value), [0, 0, 0]);
  assert.equal(estimate.cost.baseCount, 2);
  assert.deepEqual(estimate.cost.forecast, []);
  assert.equal(estimate.cost.observed[0].partial, true);
  assert.equal(estimate.cost.observed[2].partial, true);
});
