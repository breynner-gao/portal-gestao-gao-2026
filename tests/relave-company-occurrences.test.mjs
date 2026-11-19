import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDailyReport, customerOccurrenceTarget, customerOccurrenceStatus, weightDifferenceLabel} from '../relave-daily-report-v1.mjs';

const date = '2026-11-18';
const rows = [
  {date, kind:'internal', command:'GAO', sorted:17570.24, items:[{weight:343.10,reason:'Mancha'}]},
  {date, kind:'customer', clientId:'client-a', client:'Hospital A', command:'A', sorted:619.26, items:[{weight:58.10,reason:'Mancha'}]},
  {date:'2026-11-19', kind:'internal', command:'NEXT', sorted:99999, items:[]}
];

function companyCard(report) {
  const start = report.indexOf('<strong>Relave por ocorrência do cliente · Visão da empresa</strong>');
  assert.ok(start >= 0);
  return report.slice(start, report.indexOf('</div>', start));
}

test('relatório mantém o percentual do cliente e calcula ocorrência sobre triagem total da GAO', () => {
  const report = renderDailyReport(rows,date);
  assert.match(report, /9,38%/);
  assert.match(companyCard(report), /0,33%/);
  assert.match(companyCard(report), /58,10 kg de relave do cliente \/ 17\.570,24 kg/);
  assert.match(report, /% no cliente/);
  assert.match(report, /% na empresa/);
});

test('relatório individual do cliente usa a triagem de toda a empresa no mesmo dia', () => {
  const companyRows = [
    ...rows,
    {date, kind:'internal', clientId:'client-b', command:'GAO-B', sorted:1000, items:[]},
    {date, kind:'customer', clientId:'client-b', client:'Hospital B', command:'B', sorted:500, items:[{weight:50,reason:'Mancha'}]}
  ];
  const report = renderDailyReport(companyRows,date,null,{id:'client-a',name:'Hospital A'});
  assert.match(companyCard(report), /58,10 kg de relave do cliente \/ 18\.570,24 kg/);
  assert.match(companyCard(report), /0,31%/);
  assert.doesNotMatch(report, /Hospital B/);
});

test('indicador consolidado soma as ocorrências dos clientes sem somar sua triagem à base GAO', () => {
  const report = renderDailyReport([
    ...rows,
    {date, kind:'customer', clientId:'client-b', client:'Hospital B', command:'B', sorted:500, items:[{weight:50,reason:'Mancha'}]}
  ],date);
  assert.match(companyCard(report), /108,10 kg de relave do cliente \/ 17\.570,24 kg/);
  assert.match(companyCard(report), /0,62%/);
  assert.match(report, /Hospital B/);
});

test('sem base conferida da empresa apresenta ausência de base e exclui registros só de auditoria', () => {
  const report = renderDailyReport([
    rows[1],
    {date, kind:'internal', command:'PENDING', sorted:1000, items:null},
    {date, kind:'internal', command:'AUDIT', sorted:1000, items:[], auditOnly:true}
  ],date);
  assert.match(companyCard(report), /<b>—<\/b>/);
  assert.match(companyCard(report), /Sem base conferida/);
});


test('meta de ocorrência do cliente aceita até 2% nas duas visões e informa ausência de base', () => {
  assert.equal(customerOccurrenceTarget, 2);
  assert.match(customerOccurrenceStatus(2), /Dentro da meta de até 2%/);
  assert.match(customerOccurrenceStatus(2.001), /Acima da meta de até 2%/);
  assert.match(customerOccurrenceStatus(null), /Sem base conferida/);
  const report = renderDailyReport(rows, date);
  assert.match(companyCard(report), /Dentro da meta de até 2%/);
  const start = report.indexOf('<strong>Relave por ocorrência do cliente</strong>');
  assert.ok(start >= 0);
  assert.match(report.slice(start, report.indexOf('</div>', start)), /Acima da meta de até 2%/);
  assert.match(report, /Meta de ocorrência do cliente até 2%/);
  assert.match(report, /stroke="#a64450" stroke-dasharray="6 3"/);
  assert.match(report, /Meta interna 2,50%/);
});


test('diferença de pesagem informa kg e percentual sobre a expedição, inclusive zero e redução', () => {
  assert.equal(weightDifferenceLabel(216.66,247), '+30,34 kg (+14,00%)');
  assert.equal(weightDifferenceLabel(296.1,334.6), '+38,50 kg (+13,00%)');
  assert.equal(weightDifferenceLabel(343.1,389.8), '+46,70 kg (+13,61%)');
  assert.equal(weightDifferenceLabel(100,90), '-10,00 kg (-10,00%)');
  assert.equal(weightDifferenceLabel(100,100), '0,00 kg (0,00%)');
  assert.equal(weightDifferenceLabel(0,10), '+10,00 kg (—)');
  assert.equal(weightDifferenceLabel(100,null), '—');
  const report = renderDailyReport([{
    date, kind:'internal', command:'42423', sorted:17570.24, canWeigh:true,
    items:[{weight:343.1, reason:'Mancha'}],
    weighing:{received:389.8, receivingCommand:'42465', resolved:true}
  }],date);
  assert.match(report, /Diferença \(kg e %\)/);
  assert.match(report, /\+46,70 kg \(\+13,61%\)/);
  assert.match(report, /peso da expedição × 100/);
});
