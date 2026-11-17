import test from 'node:test';
import assert from 'node:assert/strict';
import { sewingScore } from '../quality-sewing-v1.mjs';
import { renderSewingDailyReport, sewingDailyData } from '../sewing-daily-report-v1.mjs';

const date = '2026-11-17';
const personKey = row => row.operator_id || 'planilha:' + row.responsible;
const service = (operator_id, responsible, activity, label, quantity, details = {}) =>
  ({service_date: date, operator_id, responsible, activity, label, quantity, details});
const rows = [
  service('a', 'Ana <Silva>', 'reparo', 'Pequenos reparos', 10, {repair_group: 'Capote', status: 'Liberada'}),
  service('a', 'Ana <Silva>', 'remodelagem', 'Remodelagem', 2, {status: 'Em execução'}),
  {...service('a', 'Ana <Silva>', 'CHIPAGEM', 'Chipagem', 4), source_row: 11},
  service('b', 'Beatriz', 'condicao', 'Avaliação da condição e descarte', 8, {discard_sent_qty: 3}),
  service('b', 'Beatriz', 'auditoria', 'Auditoria', null),
  {...service('b', 'Beatriz', 'chipagem', 'Chipagem', 100), service_date: '2026-11-16'}
];

test('relatório consolida o dia por profissional e aplica a pontuação real da Costura', () => {
  const {totals, people} = sewingDailyData(rows, date, sewingScore, personKey);
  assert.deepEqual(totals, {entries: 5, pieces: 24, points: 39.5, missing: 1});
  assert.deepEqual(people.map(p => [p.name,p.pieces,p.points]), [
    ['Ana <Silva>', 16, 34], ['Beatriz', 8, 5.5]
  ]);
  assert.equal(people[0].activities.get('Remodelagem').points, 0);
  assert.equal(people[1].activities.get('Auditoria').missing, 1);
});

test('relatório contém gráfico, detalhamento, participação e totais com textos escapados', () => {
  const report = renderSewingDailyReport(sewingDailyData(rows, date, sewingScore, personKey), date);
  assert.match(report, /Data do serviço 17\/11\/2026/);
  assert.match(report, /Pontos por profissional/);
  assert.match(report, /Atividades por profissional/);
  assert.match(report, /Ana &lt;Silva&gt;/);
  assert.match(report, /<td>86,1%<\/td>/);
  assert.match(report, /<td>Total da equipe<\/td><td>5<\/td><td>24<\/td><td>39,5<\/td>/);
  assert.match(report, /Lançamentos sem quantidade informada: 1/);
  assert.match(report, /class="print"/);
  assert.match(renderSewingDailyReport(sewingDailyData([], date, sewingScore, personKey), date),
    /Nenhum lançamento para a data selecionada/);
});
