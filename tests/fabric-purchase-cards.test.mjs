import test from 'node:test';
import assert from 'node:assert/strict';
import {groupPurchaseCards, supplierCards} from '../fabric-purchase-cards-v1.mjs';

test('consolida fornecedores por ID e usa somente pedidos do recorte',()=>{
  const rows=[
    {supplierId:'a',supplier:'Santista',ordered:10,received:3},
    {supplierId:'a',supplier:'Santista',ordered:5,received:5},
    {supplierId:'b',supplier:'Santista',ordered:2,received:0},
  ];
  const groups=groupPurchaseCards(rows);
  assert.equal(groups.length,2);
  assert.deepEqual([groups[0].orders.length,groups[0].ordered,groups[0].received,groups[0].pending],[2,15,8,7]);
  assert.equal(groupPurchaseCards(rows.slice(0,1))[0].pending,7);
  assert.match(supplierCards(groups),/data-fw-purchase-supplier="a"/);
  assert.match(supplierCards(groups),/data-fw-purchase-supplier="b"/);
});
