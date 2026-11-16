import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyIdealReferences, listMovementItems, normalizeRow} from '../linen-risk-rules-v150.mjs';
import {buildBuyingRows} from '../linen-buying-rules-v1.mjs';
import {buyingView} from '../linen-buying-view-v1.mjs';

test('o ideal salvo vale na importação seguinte e alimenta as duas decisões', () => {
  const stock = normalizeRow({produto_id:42,produto_nome:'FRONHA',categoria:'Hotelaria',media_diaria:100,mercado:120,estoque_cliente:700,deposito_gao:100,'Trocas Ideais':8});
  const base = [stock, {...stock,produtoId:43}];
  const [edited, independent] = applyIdealReferences(base, new Map([['ID:42', 10]]));
  const [movement] = listMovementItems([edited]);
  assert.equal(movement.trocasIdeal, 10);
  assert.equal(movement.metaCirculacao, 1000);
  assert.equal(movement.quantidade, 100);
  assert.equal(movement.saldoPendente, 80);
  assert.equal(independent.trocaReferencia, 8);
  assert.equal(stock.trocaReferencia, 8);
  const [need] = buildBuyingRows({snapshot:[{...edited,metaTrocas:edited.metaCirculacao,necessidade:edited.compraSugerida,coverageReady:true}]});
  assert.equal(need.target, 1000);
  assert.equal(need.toOrder, 80);
  assert.match(buyingView({rows:[need]}), /10 trocas ideais/);
});

test('ajuste do ideal sem média não apaga a necessidade informada', () => {
  const row = normalizeRow({produto_nome:'FRONHA 50 X 70',categoria:'Hotelaria','Pedido Final':23});
  const [edited] = applyIdealReferences([row], new Map([['NOME:FRONHA 50X70', 15]]));
  assert.equal(edited.trocaReferencia, 15);
  assert.equal(edited.compraSugerida, 23);
  assert.equal(edited.pedidoReal, 23);
});

test('a busca em necessidades permite consultar a meta de item coberto', () => {
  const [covered] = buildBuyingRows({snapshot:[{
    produtoId:42,produtoNome:'FRONHA',estoqueUtil:900,necessidade:0,pedidoReal:0,
    trocaReferencia:8,metaTrocas:800,coverageReady:true
  }]});
  assert.match(buyingView({rows:[covered]}), /data-fw-buy-covered hidden/);
  const result = buyingView({rows:[covered],query:'fronha'});
  assert.doesNotMatch(result, /data-fw-buy-covered hidden/);
  assert.match(result, /8 trocas ideais/);
});
