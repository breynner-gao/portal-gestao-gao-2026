import {buildTextileCosts,costCategories,shiftMonth} from './textile-cost-rules-v1.mjs?v=4';
import {renderTextileCosts,renderTextileCostReport,renderSpendingDetails,renderSpendingRow,spendingDetails} from './textile-cost-view-v1.mjs?v=5';
import {openReport} from './relave-report-export-v1.mjs?v=2';
const csv=v=>{let t=String(v??'');if(/^[=+@\-\t\r]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"';};
const decimal=(v,d=2)=>Number(v).toLocaleString('pt-BR',{useGrouping:false,minimumFractionDigits:d,maximumFractionDigits:d});
export function createTextileCostDashboard({state,render}){
 let category='';
 const model=(month=state.budgetMonth)=>buildTextileCosts(state,{month});
 function exportCsv(){const m=model();const rows=[['GAO Lavanderia','Gastos mensais e provisões','Mês selecionado',m.month],[],['Mês',...costCategories.map(([,l])=>l+' realizado (R$)'),'Realizado total (R$)','Provisão pendente (R$)','Total previsto (R$)'],...m.monthly.map(r=>[r.month,...costCategories.map(([k])=>decimal(r.actual[k]/100)),decimal(r.actualTotal/100),decimal(r.plannedTotal/100),decimal((r.actualTotal+r.plannedTotal)/100)]),[],['Provisões por categoria'],['Mês',...costCategories.map(([,l])=>l+' pendente (R$)'),'Provisão total (R$)'],...m.monthly.map(r=>[r.month,...costCategories.map(([k])=>decimal(r.planned[k]/100)),decimal(r.plannedTotal/100)]),[],['Lançamentos — datas de recebimento e previsão, sem baixa financeira'],['Tipo','Data','Mês','Categoria','Produto','Ordem','Documento','Fornecedor','Quantidade','Unidade','Preço unitário (R$)','Valor (R$)','Base']];for(const [label,list] of [['Realizado',m.actual],['Provisão',m.planned]])for(const r of list.filter(r=>!r.month||m.monthly.some(m=>m.month===r.month)))rows.push([label,r.date,r.month||'Sem previsão',costCategories.find(c=>c[0]===r.category)?.[1],r.description,r.order,r.document,r.supplier,decimal(r.quantity,3),r.unit,r.price==null?'':decimal(r.price,4),decimal(r.amount/100),r.basis]);rows.push([],['Calendário financeiro'],['Tipo','Data','Categoria','Produto','Ordem','Documento','Fornecedor','Valor (R$)','Base']);
 for(const [label,list] of [['Pedido ou OS',m.commitments],['Pagamento previsto',m.payments],['Pagamento registrado',m.paid],['Sem vencimento calculado',m.unscheduled]]){
  for(const r of list.filter(r=>label==='Sem vencimento calculado'||m.monthly.some(month=>month.month===r.month))){
   rows.push([label,label==='Sem vencimento calculado'?'':r.date,costCategories.find(c=>c[0]===r.category)?.[1],r.description,r.order,r.document,r.supplier,decimal(r.amount/100),r.basis]);
  }
 }
 const blob=new Blob(['\ufeff'+rows.map(r=>r.map(csv).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Gastos_Enxoval_'+state.budgetMonth+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 function report(){if(!state.loaded)return;const logo=getComputedStyle(document.documentElement).getPropertyValue('--liquid-logo').trim().replace(/^url\(["']?|["']?\)$/g,'');openReport(renderTextileCostReport(model(),{category,logo}),'Gastos_Enxoval_'+state.budgetMonth,{orientation:'landscape'});}
 function changeMonth(value){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(value))return false;
  state.budgetMonth=value;
  return true;
 }
 return {
  view:()=>renderTextileCosts(model(),{category,loaded:state.loaded,canManage:state.canManagePurchases,paymentError:state.paymentScheduleError}),
  bind(host){
   const dashboard=host.querySelector('[data-spend-dashboard]');
   if(!dashboard)return;
   const dialog=dashboard.querySelector('[data-spend-dialog]');
   if(!dialog)return;
   const rowDialog=dashboard.querySelector('[data-spend-row-dialog]');
   let opener,rowOpener,visibleRows=[];
   rowDialog?.addEventListener('close',()=>rowOpener?.focus({preventScroll:true}));
   function showDetails(target,view,selectedCategory='',month){
    opener=target;
    const selection=model(month);
    visibleRows=spendingDetails(selection,view==='ceiling'?'orders':view,selectedCategory).rows;
    dialog.innerHTML=renderSpendingDetails(selection,view,selectedCategory);
    dialog.showModal();
   }
   dialog.addEventListener('close',()=>opener?.focus({preventScroll:true}));
   dashboard.addEventListener('change',event=>{
    if(event.target.matches('[data-spend-month-input]')&&changeMonth(event.target.value))render();
    if(event.target.matches('[data-spend-filter]')){category=event.target.value;render();}
   });
   dashboard.addEventListener('click',event=>{
    const rowButton=event.target.closest('[data-spend-row]');
    if(rowButton?.hasAttribute?.('data-spend-row')){
     const row=visibleRows[Number(rowButton.dataset.spendRow)];
     if(!row||!rowDialog)return;
     rowOpener=rowButton;
     const ready=state.pieceOrders?.find(order=>order.id===row.orderId);
     rowDialog.innerHTML=renderSpendingRow(row,{canManage:state.canManagePurchases,
      readyEditable:ready&&ready.status!=='CANCELADA',factionEditable:Boolean(row.orderItemId)});
     rowDialog.showModal();
     return;
    }
    const target=event.target.closest('[data-spend-drill],[data-spend-month],[data-spend-category],[data-spend-prev],[data-spend-next],[data-spend-report],[data-spend-csv]');
    if(!target)return;
    const {spendDrill,spendDrillCategory,spendDrillMonth,spendMonth,spendCategory}=target.dataset;
    if(spendDrill){
     event.preventDefault();
     showDetails(target,spendDrill,spendDrillCategory,spendDrillMonth);
    }else if(spendMonth)showDetails(target,target.tagName==='circle'?'planned':'total','',spendMonth);
    else if(spendCategory)showDetails(target,'total',spendCategory);
    else if(target.hasAttribute('data-spend-prev')&&changeMonth(shiftMonth(state.budgetMonth,-1)))render();
    else if(target.hasAttribute('data-spend-next')&&changeMonth(shiftMonth(state.budgetMonth,1)))render();
    else if(target.hasAttribute('data-spend-report'))report();
    else if(target.hasAttribute('data-spend-csv'))exportCsv();
   });
   dashboard.addEventListener('keydown',event=>{
    const month=event.target.closest('[data-spend-month][role=button]');
    if(month&&['Enter',' '].includes(event.key)){
     event.preventDefault();
     showDetails(month,month.tagName==='circle'?'planned':'total','',month.dataset.spendMonth);
    }
   });
  }
 };
}
