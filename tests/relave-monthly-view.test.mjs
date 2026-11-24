import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyClientOccurrences } from '../relave-operation-v1.mjs';
import { renderDailyReport } from '../relave-daily-report-v1.mjs';

test('visão mensal usa toda a triagem disponível do cliente e só calcula o percentual no período coberto', () => {
  const client = 'HEJ - Hospital Estadual de Jataí Dr. Serafim de Carvalho';
  const history = {
    triage: { [client]: [['2026-11-01','A',10000],['2026-11-11','B',90000]], HMAP: [['2026-11-02','C',200000]] },
    events: [
      { client, date:'2026-11-01', order:'A', kg:10, type:'RELAVE' },
      { client, date:'2026-11-01', order:'A', kg:1, type:'LIXO' }
    ]
  };
  const records = [
    {kind:'customer', client:'Hospital Estadual de Jataí Dr. Serafim de Carvalho', date:'2026-11-01', command:'A', sorted:100, items:[{weight:12}]},
    {kind:'customer', client, date:'2026-11-24', command:'D', sorted:50, items:[{weight:5}]},
    {kind:'customer', client:'Sem base', date:'2026-11-24', command:'E', sorted:50, items:[{weight:2}]},
    {kind:'internal', client, date:'2026-11-01', command:'F', sorted:500, items:[{weight:30}]}
  ];
  assert.deepEqual(monthlyClientOccurrences(history,records,'2026-11'),{
    first:'2026-11-01', last:'2026-11-11', clients:[
      {name:client, triaged:1000, waste:17, coveredWaste:12, rate:1.2},
      {name:'Sem base', triaged:0, waste:2, coveredWaste:0, rate:null},
      {name:'HMAP', triaged:2000, waste:0, coveredWaste:0, rate:0}
    ]
  });
});

test('relatório imprime os percentuais junto aos pontos nos três gráficos', () => {
  const date='2026-11-18';
  const rows=[
    {kind:'internal', date, sorted:2000, items:[{weight:50}]},
    {kind:'customer', date, client:'HMAP', sorted:1000, items:[{weight:20}]}
  ];
  const graphs=[...renderDailyReport(rows,date).matchAll(/<svg[^>]+aria-label="Evolução percentual do relave"[\s\S]*?<\/svg>/g)];
  assert.equal(graphs.length,3);
  for(const [graph] of graphs){
    assert.match(graph, /class="point-rate"[^>]+>2,50%<\/text>/);
    assert.match(graph, /class="point-rate"[^>]+>2,00%<\/text>/);
  }
});
