import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../linen-operations-ui-v1.mjs',import.meta.url),'utf8');
const table=source.slice(source.indexOf('  function table('),source.indexOf('  function history('));

function render(eligible,canManage=true,decision='yes'){
  const row={id:'order',product_key:'ID:2581',product_name:'Fronha',remaining:733,eligible};
  return runInNewContext(table+'table([row])',{
    row,canWrite:true,canManage,snapshot:{updated_at:'2026-11-16'},saving:false,page:'return',
    choices:new Map([['order',{decision,quantity:'30'}]]),transferKey:row=>row.id,
    qty:String,esc:String,directionLabel:()=>'',stockFields:()=>'Campos da conferência'
  });
}

test('item a conferir aceita quantidade e oferece conferência na linha ao gestor', () => {
  const html=render(null);
  assert.match(html,/<option value="yes" selected\s*>Sim/);
  assert.doesNotMatch(html,/<input data-leo-quantity[^>]*disabled/);
  assert.match(html,/<input data-leo-quantity[^>]*max="733"/);
  assert.match(html,/<form data-leo-stock>/);
  assert.match(html,/<button[^>]*data-leo-save[^>]*disabled/);
});

test('saldo conferido limita o lançamento e quem só movimenta não ganha acesso à conferência', () => {
  assert.match(render(300),/<input data-leo-quantity[^>]*max="300"/);
  assert.doesNotMatch(render(300),/<button[^>]*data-leo-save[^>]*disabled/);
  assert.doesNotMatch(render(null,false),/<form data-leo-stock>/);
  assert.doesNotMatch(render(null,false,'no'),/<button[^>]*data-leo-save[^>]*disabled/);
});
