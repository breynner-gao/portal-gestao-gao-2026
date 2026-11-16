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

test('navegação da Gestão de Enxoval fica junto de Atualizar e respeita a visualização de Costura', async () => {
  const {views}=await import('../linen-management-views-v1.mjs');
  const renderSource=source.slice(source.indexOf('  function render(){'),source.indexOf('    host.querySelectorAll(\'[data-leo-decision]\')'));
  for(const sewingOnly of [false,true]){
    const page=sewingOnly?'costura':'return';
    const host={isConnected:true,querySelector:()=>null,querySelectorAll:()=>[]};
    runInNewContext(renderSource+'}render()',{
      native:true,host,loading:true,saving:false,sewingOnly,page,snapshot:null,views,esc:String,message:''
    });
    assert.match(host.innerHTML,/<div class="leo-head-actions">[\s\S]*<select data-leo-view-select[\s\S]*<button[^>]*data-leo-refresh/);
    assert.equal((host.innerHTML.match(/<option/g)||[]).length,sewingOnly?1:views.length);
    assert.match(host.innerHTML,new RegExp('<option value="'+page+'" selected'));
    assert.doesNotMatch(host.innerHTML,/class="leo-nav"/);
  }
});
