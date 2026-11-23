import test from 'node:test';import assert from 'node:assert/strict';
import {buildTextileCosts,localDay,shiftMonth} from '../textile-cost-rules-v1.mjs';
import {renderTextileCosts,renderTextileCostReport} from '../textile-cost-view-v1.mjs';
const options={month:'2026-11',today:'2026-11-21'};
const base=()=>({fabric:[{id:'f',name:'Percal'}],suppliers:[{id:'supplier',trade_name:'Fornecedor'}],purchaseOrders:[{id:'po',supplier_id:'supplier',order_number:'001',ordered_date:'2026-11-01',expected_date:'2026-12-10',status:'PARCIAL'}],purchaseItems:[{id:'pi',purchase_order_id:'po',fabric_id:'f',ordered_m:100,received_m:40,purchase_price_per_m:10}],purchaseReceipts:[{id:'receipt',purchase_order_item_id:'pi',lot_id:'lot',quantity_received_m:40,received_at:'2026-11-10'}],lots:[{id:'lot',fabric_id:'f',supplier_id:'supplier',quantity_received_m:40,effective_price_per_m:11,received_date:'2026-11-10',invoice_number:'123',lot_code:'L1'}]});
test('tecido recebido e saldo futuro não duplicam o pedido nem o recebimento',()=>{const m=buildTextileCosts(base(),options);assert.equal(m.totals.actual,44000);assert.equal(m.actual.length,1);assert.equal(m.planned.length,1);assert.equal(m.planned[0].amount,60000);assert.equal(m.planned[0].month,'2026-12');assert.equal(m.totals.future,60000);});
test('data do item prevalece e somatório de recebimentos protege contador desatualizado',()=>{const s=base();s.purchaseItems[0].received_m=10;s.purchaseItems[0].expected_date='2027-01-02';const m=buildTextileCosts(s,options);assert.equal(m.planned[0].quantity,60);assert.equal(m.planned[0].month,'2027-01');});
test('cancelamento e cotação removem somente provisões, preservando histórico realizado',()=>{for(const update of [{status:'CANCELADA'},{logistics_stage:'COTACAO'}]){const s=base();Object.assign(s.purchaseOrders[0],update);const m=buildTextileCosts(s,options);assert.equal(m.totals.actual,44000);assert.equal(m.planned.length,0);}});
test('produtos prontos consideram preço do recebimento e saldo ao preço do pedido',()=>{const m=buildTextileCosts({pieceOrders:[{id:'r',order_number:'T1',product_name:'Toalha',ordered_pieces:100,received_pieces:20,unit_price:12,expected_date:'2027-01-15'}],pieceReceipts:[{id:'rr',order_id:'r',accepted_pieces:20,unit_price:11.5,received_date:'2026-11-19'}]},options);assert.equal(m.actual[0].amount,23000);assert.equal(m.planned[0].amount,96000);assert.equal(m.planned[0].category,'ready');});
test('facção parcial usa peças pendentes, preserva custo informado e não repete tecido consumido',()=>{const m=buildTextileCosts({orders:[{id:'o',order_number:2,status:'ABERTA'}],items:[{id:'i',order_id:'o',product_name:'Lençol',ordered_pieces:100,faction_cost_per_piece:5,extras_cost_per_piece:2,consumption_m_per_piece:3,planned_price_per_m:10}],returns:[{id:'ret',order_item_id:'i',cut_batch_id:'c',accepted_pieces:20,rejected_pieces:5,faction_cost_amount:140,extras_cost_amount:30,returned_at:'2026-11-20T14:00:00Z'}],cuts:[{id:'c',order_item_id:'i',produced_pieces:100,expected_date:'2026-12-05'}]},options);assert.equal(m.totals.actual,17000);assert.equal(m.totals.future,52500);assert.equal(m.planned.find(r=>r.category==='faction').quantity,75);assert.equal(m.planned.some(r=>r.category==='fabric'),false);});
test('lotes fracionados respeitam previsão editada, saldo sem data e retornos antigos',()=>{const s={orders:[{id:'o',order_number:1,status:'ABERTA'}],items:[{id:'i',order_id:'o',ordered_pieces:200,faction_cost_per_piece:3,extras_cost_per_piece:0}],returns:[{id:'r',order_item_id:'i',accepted_pieces:20,rejected_pieces:0}],cuts:[{id:'c1',order_item_id:'i',produced_pieces:80,expected_date:'2026-11-10',created_at:'2026-11-01'},{id:'c2',order_item_id:'i',produced_pieces:70,expected_date:'2026-12-10',created_at:'2026-11-02'}],cutPlans:[{id:'p',cut_id:'c2',sewing_due_set:true,sewing_due_on:'2027-01-05',status:'CONCLUIDO'}]};const m=buildTextileCosts(s,options);assert.equal(m.planned.reduce((s,r)=>s+r.quantity,0),180);assert.equal(m.overdue[0].quantity,60);assert.equal(m.planned.find(r=>r.date==='2027-01-05').quantity,70);assert.equal(m.totals.undated,15000);});
test('OS encerrada não gera provisão e datas não são inventadas',()=>{const s={orders:[{id:'o',status:'CONCLUIDA'}],items:[{id:'i',order_id:'o',ordered_pieces:100,faction_cost_per_piece:5}]};assert.equal(buildTextileCosts(s,options).planned.length,0);s.orders[0].status='ABERTA';const m=buildTextileCosts(s,options);assert.equal(m.totals.undated,50000);assert.equal(m.totals.future,0);});
test('saldo de abertura sem NF fica fora da despesa; custo de frete entra somente uma vez',()=>{const m=buildTextileCosts({lots:[{id:'opening',lot_code:'saldo',quantity_received_m:50,purchase_price_per_m:10,received_date:'2026-11-01'},{id:'lot',invoice_number:'nf',quantity_received_m:10,purchase_price_per_m:10,freight_cost:20,other_cost:5,received_date:'2026-11-10'}]},options);assert.equal(m.totals.actual,12500);assert.equal(m.warnings[0].kind,'opening');});
test('competência respeita fuso de São Paulo e virada do ano',()=>{assert.equal(localDay('2026-12-01T01:00:00Z'),'2026-11-30');assert.equal(shiftMonth('2026-12',1),'2027-01');assert.equal(shiftMonth('2026-01',-1),'2025-12');});
test('meses, categorias e total geral são reconciliáveis',()=>{const m=buildTextileCosts(base(),options);for(const row of m.monthly){assert.equal(Object.values(row.actual).reduce((a,b)=>a+b,0),row.actualTotal);assert.equal(Object.values(row.planned).reduce((a,b)=>a+b,0),row.plannedTotal);}assert.equal(m.monthly.length,12);assert.equal(m.monthly.at(-1).month,'2027-05');});
test('painel e relatório mostram provisões, auditoria e texto escapado',()=>{const s=base();s.fabric[0].name='<script>ataque</script>';const m=buildTextileCosts(s,options),html=renderTextileCosts(m),report=renderTextileCostReport(m);assert.match(html,/Gastos mensais e provisões futuras/);assert.match(html,/Produtos prontos/);assert.match(html,/não são somados duas vezes/);assert.ok(!html.includes('<script>ataque'));assert.match(html,/&lt;script&gt;/);assert.match(report,/class="print"/);assert.match(report,/landscape/);assert.match(report,/Provisões dos próximos 6 meses/);});

test('detalhamento abre o diálogo sem mudar o mês do painel nem renderizar novamente',async()=>{
 const {createTextileCostDashboard}=await import('../textile-cost-dashboard-v1.mjs');
 const state={...base(),budgetMonth:'2026-11',loaded:true};
 let renders=0,opens=0,focusOptions;
 const handlers={},dialogEvents={};
 const dialog={innerHTML:'',showModal:()=>opens++,addEventListener:(name,handler)=>dialogEvents[name]=handler};
 const host={querySelector:()=>({querySelector:()=>dialog,addEventListener:(name,handler)=>handlers[name]=handler})};
 const dashboard=createTextileCostDashboard({state,render:()=>renders++});
 dashboard.bind(host);
 handlers.change({target:{matches:selector=>selector==='[data-spend-month-input]',value:'2026-12'}});
 assert.equal(state.budgetMonth,'2026-12');
 assert.equal(renders,1);
 const trigger={dataset:{spendDrill:'cash',spendDrillMonth:'2027-03',spendDrillCategory:'faction'},focus:options=>focusOptions=options};
 handlers.click({preventDefault(){},target:{closest:()=>trigger}});
 assert.equal(opens,1);
 assert.equal(renders,1);
 assert.equal(state.budgetMonth,'2026-12');
 assert.match(dialog.innerHTML,/Pagamentos previstos no mês · Facção/);
 assert.match(dialog.innerHTML,/mar\.\/2027/);
 dialogEvents.close();
 assert.deepEqual(focusOptions,{preventScroll:true});
});

test('uma OC de novembro aparece no mês do pedido e a 90 dias da NF no caixa, sem duplicar a entrega parcial',()=>{
 const state={
  purchaseOrders:[{id:'oc',status:'PARCIAL',order_number:'161',ordered_date:'2026-11-23',expected_date:'2026-12-15',payment_days:[90]}],
  purchaseItems:[{id:'item',purchase_order_id:'oc',ordered_m:100,received_m:40,purchase_price_per_m:1618.349}],
  lots:[{id:'lote',supplier_id:'fornecedor',invoice_number:'123',received_date:'2026-12-06',quantity_received_m:40,effective_price_per_m:1618.349}],
  purchaseReceipts:[{id:'receipt',lot_id:'lote',purchase_order_item_id:'item',quantity_received_m:40}],
  paymentSchedule:[{source_key:'invoice:fornecedor:123',invoice_date:'2026-11-30'}],
  budgets:[{month:'2026-11-01',ceiling_brl:200000}]
 };
 const model=buildTextileCosts(state,{month:'2026-11'});
 assert.equal(model.commitments[0].amount,16183490);
 assert.equal(model.commitments[0].month,'2026-11');
 assert.deepEqual(model.payments.map(row=>[row.date,row.amount,row.invoiceDate]),[
  ['2027-02-28',6473396,'2026-11-30'],['2027-03-15',9710094,null]
 ]);
 assert.equal(model.unscheduled.length,0);
 assert.match(renderTextileCosts(model),/data-spend-drill="orders"/);
});

test('parcelas preservam os centavos; registros sem prazo ficam fora dos meses de pagamento',()=>{
 const state={
  pieceOrders:[
   {id:'parcelado',status:'ABERTA',ordered_pieces:1,unit_price:100,ordered_date:'2026-11-01',expected_date:'2026-11-30'},
   {id:'sem-prazo',status:'ABERTA',ordered_pieces:1,unit_price:10,ordered_date:'2026-11-01',expected_date:'2026-12-01'}
  ],
  paymentSchedule:[{source_key:'order:parcelado',payment_days:[30,60,90]}]
 };
 const model=buildTextileCosts(state,{month:'2026-11'});
 assert.deepEqual(model.payments.map(row=>row.amount),[3334,3333,3333]);
 assert.deepEqual(model.unscheduled.map(row=>row.orderId),['sem-prazo']);
});
