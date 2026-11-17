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

test('movimentação usa o saldo da origem sem solicitar conferência manual', () => {
  const html=render(300);
  assert.match(html,/<option value="yes" selected\s*>Sim/);
  assert.match(html,/<input data-leo-quantity[^>]*max="300"/);
  assert.doesNotMatch(html,/<input data-leo-quantity[^>]*disabled/);
  assert.doesNotMatch(html,/<button[^>]*data-leo-save[^>]*disabled/);
  assert.doesNotMatch(html,/Conferir saldo|data-leo-stock/);
});

test('saldo zero ou produto sem posição bloqueia confirmar saída e permite registrar pendência', () => {
  for(const available of [null,0]){
    assert.match(render(available),/<button[^>]*data-leo-save[^>]*disabled/);
    const no=render(available,false,'no');
    assert.doesNotMatch(no,/<button[^>]*data-leo-save[^>]*disabled/);
    assert.doesNotMatch(no,/<input data-leo-quantity/);
    assert.match(no,/Registrar pendência/);
    assert.match(no,/0 peças movimentadas/);
  }
});

test('posição semanal deduz saídas e credita entradas confirmadas na mesma versão',async () => {
  const {movementRows}=await import('../linen-management-views-v1.mjs');
  const sku='ID:2593',version='2026-11-16T12:00:00Z';
  const proposal={product_key:sku,direction:'return',planned:375};
  const requests=[{...proposal,id:'req',snapshot_version:version}];
  const events=[
    {request_id:'req',stock_version:version,quantity:184,remaining:191},
    {request_id:'req',stock_version:'2026-11-09T12:00:00Z',quantity:4,remaining:187}
  ];
  const weeklyStock=new Map([[sku,{market:400,depot:10}]]);
  const [row]=movementRows([proposal],requests,events,[],version,weeklyStock);
  assert.equal(row.eligible,216);
  assert.equal(row.remaining,187);
  const [checked]=movementRows([proposal],requests,events,[{product_key:sku,snapshot_version:version,market:40}],version,weeklyStock);
  assert.equal(checked.eligible,40);
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

test('registrar que não houve movimentação mantém o saldo de origem e o restante', async () => {
  const {movementRows}=await import('../linen-management-views-v1.mjs');
  const version='2026-11-16T12:00:00Z';
  const request={id:'req',product_key:'ID:3154',direction:'return',planned:159,snapshot_version:version};
  const no={request_id:'req',stock_version:version,occurred_at:version,quantity:0,remaining:159};
  const stock=new Map([[request.product_key,{market:679,depot:0}]]);
  const [pending]=movementRows([request],[request],[no],[],version,stock);
  assert.equal(pending.lastUnmoved,true);
  assert.equal(pending.eligible,679);
  assert.equal(pending.done,0);
  assert.equal(pending.remaining,159);
  const moved={...no,occurred_at:'2026-11-16T13:00:00Z',quantity:50,remaining:109};
  const [partial]=movementRows([request],[request],[no,moved],[],version,stock);
  assert.equal(partial.lastUnmoved,false);
  assert.equal(partial.eligible,629);
  assert.equal(partial.remaining,109);
});
