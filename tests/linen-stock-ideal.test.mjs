import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeRow,applyIdealReferences} from '../linen-risk-rules-v150.mjs';
test('trocas e compra usam estoque ideal, excluindo costura e estoque lavanderia',()=>{
 const raw={produto_id:1,produto_nome:'TESTE',media_diaria:999,estoque_ideal:100,estoque_cliente:100,area_critica:20,mercado:30,qualidade:10,desengoma_gao:10,relave_geral:20,deposito_gao:60,costura:500,estoque_lavanderia:99999,'Trocas Ideais':3};
 const row=normalizeRow(raw);assert.equal(row.estoqueUtil,250);assert.equal(row.trocasTotais,2.5);assert.equal(row.compraSugerida,50);
 const [saved]=applyIdealReferences([JSON.parse(JSON.stringify(row))],new Map([['ID:1',2]]));assert.equal(saved.compraSugerida,0);assert.equal(saved.metaCirculacao,200);assert.equal(saved.trocasTotais,2.5);
});
test('base antiga sem estoque ideal fica sem cálculo em vez de usar média diária',()=>{const row=normalizeRow({produto_nome:'TESTE',media_diaria:999,estoque_cliente:250});assert.equal(row.calculoDisponivel,false);assert.equal(row.compraSugerida,0);});
