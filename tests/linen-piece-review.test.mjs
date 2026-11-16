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

test('avaliação só mostra produtos depois de escolher a categoria e preserva produto na edição',()=>{
  const catalog=[
    {...products[0],category:'HOTELARIA'},
    {id:'scrubs',name:'Privativo',code:'21',category:'PROFISSIONAL'},
    {id:'uncategorized',name:'Peça avulsa',code:'22',category:null}
  ];
  const html=workflowView('chip',{items:[piece],products:catalog},{canManage:true,saving:false});
  const formFor=action=>html.match(new RegExp('<form data-leo-workflow="'+action+'"[^>]*>([\\s\\S]*?)</form>'))[1];
  const entry=formFor('inspect_piece');
  assert.match(entry,/<option value="PROFISSIONAL"[^>]*>PROFISSIONAL<\/option>/);
  assert.match(entry,/<option value="Sem categoria"[^>]*>Sem categoria<\/option>/);
  assert.match(entry,/<select name="product"[^>]*disabled/);
  assert.doesNotMatch(entry,/Lençol|Privativo|Peça avulsa/);
  const editing=formFor('edit_piece');
  assert.match(editing,/<option value="HOTELARIA" selected>HOTELARIA<\/option>/);
  assert.match(editing,/<option value="sku" selected>20 · Lençol<\/option>/);
  assert.doesNotMatch(editing,/21 · Privativo|22 · Peça avulsa/);
});

test('trocar a categoria substitui as opções e limpa a seleção anterior',async()=>{
  const {bindEvaluationProductPickers}=await import('../linen-management-workflow-v1.mjs');
  const product={disabled:true,innerHTML:''};
  const category={value:'HOTELARIA',closest:()=>({querySelector:()=>product})};
  const catalog=[
    {...products[0],category:'HOTELARIA'},
    {id:'scrubs',name:'Privativo',code:'21',category:'PROFISSIONAL'}
  ];
  bindEvaluationProductPickers({querySelectorAll:()=>[category]},catalog);
  category.onchange();
  assert.match(product.innerHTML,/Lençol/);
  assert.doesNotMatch(product.innerHTML,/Privativo|selected/);
  assert.equal(product.disabled,false);
  category.value='PROFISSIONAL';
  category.onchange();
  assert.match(product.innerHTML,/Privativo/);
  assert.doesNotMatch(product.innerHTML,/Lençol|selected/);
  category.value='';
  category.onchange();
  assert.equal(product.disabled,true);
});
