import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDailyReport, customerOccurrenceTarget, customerOccurrenceStatus} from '../relave-daily-report-v1.mjs';

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
