import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {filterTransferHistory, transferWorkbook} from '../linen-operations-history-v1.mjs';

const item = (id, time, product='ID:1', direction='supply', person='operador') => ({
  id, occurred_at:time, quantity:30, remaining:70, responsible_id:person, responsible:'Operador de teste',
  request:{product_key:product,product_code:'001',product_name:'Toalha',direction}
});

test('histórico combina produto, sentido, responsável e intervalo inclusivo de São Paulo', () => {
  const result=filterTransferHistory([
    item('A','2026-11-16T02:59:59Z'),
    item('B','2026-11-16T03:00:00Z'),
    item('C','2026-11-17T02:59:59Z'),
    item('D','2026-11-17T03:00:00Z'),
    item('E','2026-11-16T20:00:00Z','ID:2'),
    item('F','2026-11-16T20:00:00Z','ID:1','return'),
    item('G','2026-11-16T20:00:00Z','ID:1','supply','outro')
  ],{product:'ID:1',direction:'supply',responsible:'operador',start:'2026-11-16',end:'2026-11-16'});
  assert.deepEqual(result.map(row=>row.id),['C','B']);
  assert.throws(()=>filterTransferHistory([], {start:'2026-11-17',end:'2026-11-16'}),/data inicial/);
});

test('Excel mantém a seleção em ordem, quantidades numéricas e a aba de filtros', () => {
  const xlsx={utils:{
    book_new:()=>new Map(),
    aoa_to_sheet:rows=>({rows,'!ref':'A1:H3'}),
    book_append_sheet:(book,sheet,name)=>book.set(name,sheet)
  }};
  const events=[item('C','2026-11-17T02:59:59Z'),item('B','2026-11-16T03:00:00Z')];
  const book=transferWorkbook(xlsx,events,{direction:'supply',start:'2026-11-16'},{product:'Toalha'},new Date('2026-11-17T04:00:00Z'));
  const history=book.get('Movimentações').rows;
  assert.deepEqual(history.slice(1).map(r=>r[7]),['C','B']);
  assert.equal(history[1][0].t,'n');
  assert.equal(history[1][4],30);
  assert.equal(history[1][6],70);
  assert.deepEqual(book.get('Filtros').rows.at(-1),['Total exportado',2]);
  assert.throws(()=>transferWorkbook(xlsx,[],{},{}),/Nenhum registro/);
});

test('endereço antigo encaminha à única aba Movimentações do Enxoval', async () => {
  const core=await readFile(new URL('../portal-sgq-core.js',import.meta.url),'utf8');
  const redirect=core.slice(core.indexOf('if(location.pathname'),core.indexOf('const I='));
  const visits=[];
  runInNewContext('(()=>{'+redirect+'})()',{
    location:{pathname:'/producao/gestao-enxoval',replace:path=>visits.push(path)}
  });
  assert.deepEqual(visits,['/enxoval-tecidos#movimentacoes-enxoval']);
});

test('Produção mostra Gestão de Enxoval com destino direto para Movimentações', async () => {
  const core=await readFile(new URL('../portal-sgq-core.js',import.meta.url),'utf8');
  const submenu=core.slice(core.indexOf('const qualitySubnav='),core.indexOf(';const R='));
  const html=runInNewContext(submenu+';qualitySubnav()', {location:{hash:'#producao'}});
  assert.match(html,/<a href="\/enxoval-tecidos#movimentacoes-enxoval">Gestão de Enxoval<\/a>/);
});
