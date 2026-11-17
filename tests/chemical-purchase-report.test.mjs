import test from 'node:test';
import assert from 'node:assert/strict';
import { renderChemicalPurchaseReport, weeklyConsumption } from '../chemical-purchase-report-v1.mjs';

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
  period: {nextMonth: 'dezembro de 2026', closeDate: '2026-11-30', nextDays: 31, toClose: 13}
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
  assert.match(html, /151,35/);
  assert.match(html, /S44\/2026 †/);
  assert.match(html, /<h3>Cloro<\/h3>/);
  assert.match(html, /<h3>Soda<\/h3>/);
  assert.match(html, /class="print"/);
  assert.match(renderChemicalPurchaseReport({...reportData, history: null}), /Não foi possível carregar o histórico/);
});
