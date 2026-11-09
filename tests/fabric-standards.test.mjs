import test from 'node:test';
import assert from 'node:assert/strict';
import {sameFabricStandard,groupFabricStandards,purchaseReferenceChoices} from '../fabric-standard-rules-v1.mjs';
const refs=[{id:'a',standard_id:'s1',supplier_id:'vendorA',active:true,homologated:true,standard_link_approved:true},{id:'b',standard_id:'s1',supplier_id:'vendorB',active:true,homologated:true,standard_link_approved:true},{id:'c',standard_id:'s2',supplier_id:'vendorB',active:true,homologated:true,standard_link_approved:true},{id:'d',standard_id:'s1',supplier_id:'vendorB',active:true,homologated:true,standard_link_approved:false}];
test('equivalência exige mesmo padrão e os dois vínculos aprovados',()=>{assert.equal(sameFabricStandard(refs,'a','b'),true);assert.equal(sameFabricStandard(refs,'a','c'),false);assert.equal(sameFabricStandard(refs,'a','d'),false);assert.equal(sameFabricStandard(refs,'a','a'),true);});
test('pedido oferece somente referências aprovadas do fornecedor escolhido',()=>{assert.deepEqual(purchaseReferenceChoices(refs,'s1','vendorB').map(r=>r.id),['b']);assert.equal(purchaseReferenceChoices(refs,'s1','').length,0);});
test('agrupamento mantém as referências de compra e não funde padrões pela cor',()=>{const groups=groupFabricStandards([{id:'s1',color:'Verde'},{id:'s2',color:'Verde'}],refs);assert.equal(groups.length,2);assert.equal(groups[0].references.length,3);assert.equal(groups[1].references[0].id,'c');});

test('vínculo interno de ficha técnica não é referência comercial de compra',()=>{assert.equal(purchaseReferenceChoices([{id:'internal',standard_id:'s',supplier_id:'v',active:true,homologated:true,standard_link_approved:true,internal_only:true}],'s','v').length,0);});
