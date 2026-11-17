import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../chemicals-purchase-v86.js',import.meta.url),'utf8');
const {purchasePeriod,buildRows}=runInNewContext(source.slice(0,source.indexOf(' function render()'))+
  'return {purchasePeriod,buildRows};})()', {window:{}});
const master={principles:[{code:'MSC',name:'Soda'}],offers:[{principle:'Soda',pack:1000}]};
const plan=purchasePeriod('2026-11-17','2026-11-17');
const soda=(stock,transit=0)=>buildRows({items:{Soda:{stock,transit}}},master,plan)[0];
const round=value=>Math.round(value*100)/100;

test('compra de dezembro desconta o consumo até 30 de novembro e arredonda por embalagem',()=>{
  assert.equal(plan.toClose,13);
  assert.equal(plan.closeDate,'2026-11-30');
  assert.equal(plan.nextDays,31);
  const row=soda(760);
  assert.equal(round(row.consumptionToClose),542.78);
  assert.equal(round(row.opening),217.22);
  assert.equal(round(row.consumptionNext),1294.32);
  assert.equal(round(row.need),1077.10);
  assert.equal(row.order,2000);
});

test('estoque em trânsito entra na projeção e falta do mês atual fica separada',()=>{
  assert.equal(round(soda(500,100).opening),57.22);
  const row=soda(100);
  assert.equal(round(row.currentGap),442.78);
  assert.equal(row.opening,0);
  assert.equal(row.need,row.consumptionNext);
  assert.equal(soda(2000).need,0);
});

test('posição antiga, último dia, mudança de ano e fevereiro usam dias do calendário',()=>{
  assert.equal(purchasePeriod('2026-10-30','2026-11-17').toClose,31);
  const december=purchasePeriod('2026-12-31','2026-12-31');
  assert.equal(december.toClose,0);
  assert.equal(december.nextMonth,'janeiro de 2027');
  assert.equal(purchasePeriod('2028-01-25','2028-01-26').nextDays,29);
  assert.equal(purchasePeriod('2026-11-18','2026-11-17'),null);
  assert.equal(purchasePeriod('2026-02-30','2026-11-17'),null);
});
