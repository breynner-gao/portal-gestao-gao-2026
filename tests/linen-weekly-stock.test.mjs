import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareWeeklyStock} from '../linen-weekly-stock-v1.mjs';
import {applyIdealReferences,listMovementItems} from '../linen-risk-rules-v150.mjs';
const row={produto_id:'42',produto_nome:'FRONHA',categoria:'Hotelaria',media_diaria:100,estoque_cliente:700,area_critica:0,mercado:120,deposito_gao:100,relave:0,qualidade:0,desengoma:0,costura:0};
test('a nova posição calcula os dois sentidos a partir do estoque atualizado e mantém a meta salva',()=>{
  const ideas=new Map([['ID:42',10]]);
  const initial=applyIdealReferences(prepareWeeklyStock([row]),ideas);
  assert.equal(listMovementItems(initial)[0].direcao,'supply');
  const next=applyIdealReferences(prepareWeeklyStock([{...row,mercado:400}]),ideas);
  const [movement]=listMovementItems(next);
  assert.equal(movement.direcao,'return');
  assert.equal(movement.quantidade,70);
  assert.equal(next[0].trocaReferencia,10);
  assert.equal(next[0].compraSugerida,0);
});
test('planilha incompleta ou duplicada é recusada antes de substituir a posição',()=>{
  assert.throws(()=>prepareWeeklyStock([{...row,mercado:''}]),/Mercado/);
  assert.throws(()=>prepareWeeklyStock([row,row]),/duplicado/);
  assert.throws(()=>prepareWeeklyStock([]),/vazia/);
});
