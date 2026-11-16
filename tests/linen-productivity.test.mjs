import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyProductivity,productivityRecords} from '../linen-productivity-v1.mjs';

test('mede realizados, meta vigente e projeção sem usar o dia parcial',()=>{
  const records=[
    ...[10,12,8].map((quantity,i)=>({key:'supply',quantity,date:'2026-11-1'+(3+i)})),
    {key:'supply',quantity:14,date:'2026-11-16'}
  ];
  const targets=[
    {activity:'supply',effective_on:'2026-11-10',target:10},
    {activity:'supply',effective_on:'2026-11-16',target:20},
    {activity:'supply',effective_on:'2026-11-17',target:30}
  ];
  const row=dailyProductivity(records,targets,'2026-11-16').rows.find(x=>x.key==='supply');
  assert.equal(row.actual,14);
  assert.equal(row.target,20);
  assert.equal(row.attainment,70);
  assert.equal(row.remaining,6);
  assert.equal(row.average,10);
  assert.equal(row.projected,50);
  const unknown=dailyProductivity([],[],'2026-11-16').rows[0];
  assert.equal(unknown.target,null);
  assert.equal(unknown.average,null);
  assert.equal(unknown.projected,null);
});

test('usa a data de São Paulo e conta quantidades executadas, excluindo abertura de pedidos',()=>{
  const moves=[{occurred_at:'2026-11-17T02:59:59Z',quantity:30,request:{direction:'return'}}];
  const audit=[
    {created_at:'2026-11-16T18:00:00Z',action:'invoice',lines:[{quantity:4},{quantity:3}]},
    {created_at:'2026-11-16T19:00:00Z',action:'client_open',quantity:20},
    {created_at:'2026-11-16T20:00:00Z',action:'client_separate',quantity:5},
    {created_at:'2026-11-16T21:00:00Z',action:'quality'}
  ];
  const rows=productivityRecords(moves,audit);
  assert.deepEqual(rows.map(({key,quantity,date})=>[key,quantity,date]),[
    ['return',30,'2026-11-16'],['invoice',7,'2026-11-16'],
    ['client_separate',5,'2026-11-16'],['quality',1,'2026-11-16']
  ]);
});
