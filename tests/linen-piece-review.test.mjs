import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowView} from '../linen-management-workflow-v1.mjs';

const piece={id:'piece-1',version:3,product_id:'sku',legacy_identifier:'A-102',status:'inspection_pending',
  chip_condition:'working',condition:'Costura solta <teste>',defect:'seam',quantity:1,released:0};
const products=[{id:'sku',code:'20',name:'Lençol'}];
const render=(item,canManage=true,tags=[])=>workflowView('chip',{items:[item],products,tags},{canManage,saving:false});

test('avalia e corrige o cadastro com defeito e cancelamento justificado',()=>{
  const html=render(piece);
  assert.match(html,/data-leo-workflow="inspect_piece"/);
  assert.match(html,/data-leo-workflow="edit_piece"/);
  assert.match(html,/data-leo-workflow="archive_piece"/);
  assert.match(html,/value="A-102"/);
  assert.match(html,/Costura solta &lt;teste&gt;/);
  assert.match(html,/Motivo do cancelamento/);
});

test('mantém cancelados no histórico e não oferece cancelamento para peça com vínculo RFID',()=>{
  const archived=render({...piece,status:'archived',archive_reason:'Duplicado'});
  assert.match(archived,/Cadastros cancelados/);
  assert.match(archived,/Duplicado/);
  assert.doesNotMatch(archived,/data-leo-workflow="edit_piece"/);
  assert.doesNotMatch(render(piece,true,[{item_id:'piece-1'}]),/data-leo-workflow="archive_piece"/);
  assert.doesNotMatch(render({...piece,status:'repairing'}),/data-leo-workflow="edit_piece"/);
  assert.doesNotMatch(render(piece,false),/data-leo-workflow=/);
});

test('erro de cadastro é uma opção própria e aparece na peça avaliada',()=>{
  const html=render({...piece,defect:'registration'});
  assert.match(html,/<option value="registration" selected>Erro de cadastro<\/option>/);
  assert.match(html,/<p>Funcionando · Erro de cadastro · /);
});
