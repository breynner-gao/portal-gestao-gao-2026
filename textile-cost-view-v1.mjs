import {costCategories,shiftMonth,cents} from './textile-cost-rules-v1.mjs?v=3';
export const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money=v=>(v/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const qty=v=>Number(v).toLocaleString('pt-BR',{maximumFractionDigits:3});
export const monthLabel=m=>new Intl.DateTimeFormat('pt-BR',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(m+'-01T12:00:00Z')).replace(' de ','/');
const sum=rows=>rows.reduce((s,r)=>s+r.amount,0);
const categoryLabel=k=>costCategories.find(c=>c[0]===k)?.[1]||k;
export function costChart(model){
 if(model.monthly.every(m=>!m.actualTotal&&!m.plannedTotal))return '<p class="fw-spend-empty">O gráfico aparecerá conforme forem registrados recebimentos, serviços e provisões no período.</p>';
 const first=model.monthly.findIndex(m=>m.count>0),selected=model.monthly.findIndex(m=>m.month===model.month);
 const monthly=model.monthly.slice(Math.min(first<0?selected:first,selected));
 const W=930,H=310,L=75,R=20,T=24,B=248,step=(W-L-R)/monthly.length;
 const top=Math.max(1,...monthly.map(m=>Math.max(m.actualTotal,m.plannedTotal))),max=top*1.15,y=v=>B-(B-T)*v/max;
 let graph='';for(let i=0;i<=4;i++){const val=max*i/4,yy=y(val);graph+='<line x1="'+L+'" y1="'+yy+'" x2="'+(W-R)+'" y2="'+yy+'" stroke="#dfE8ef"/><text x="'+(L-10)+'" y="'+(yy+4)+'" text-anchor="end" fill="#647b8d" font-size="11">'+esc((val/100).toLocaleString('pt-BR',{notation:'compact',maximumFractionDigits:1}))+'</text>';}
 for(const [i,m] of monthly.entries()){const x=L+i*step+step*.23;let base=B;const active=m.month===model.month;graph+='<g role="button" tabindex="0" aria-label="Consultar '+esc(monthLabel(m.month))+'" data-spend-month="'+m.month+'"><title>'+esc(monthLabel(m.month)+': realizado '+money(m.actualTotal)+' · provisão '+money(m.plannedTotal))+'</title>';
 if(active)graph+='<rect x="'+(L+i*step+2)+'" y="'+T+'" width="'+(step-4)+'" height="'+(B-T+40)+'" rx="8" fill="#e9f3fa"/>';
 for(const [key,,color] of costCategories){const height=(B-T)*m.actual[key]/max;graph+='<rect x="'+x+'" y="'+(base-height)+'" width="'+(step*.54)+'" height="'+height+'" rx="2" fill="'+color+'"/>';base-=height;}
 graph+='<rect x="'+(L+i*step)+'" y="'+T+'" width="'+step+'" height="'+(H-T)+'" fill="transparent"/><text x="'+(L+(i+.5)*step)+'" y="'+(B+25)+'" text-anchor="middle" fill="'+(active?'#123a59':'#647b8d')+'" font-weight="'+(active?'750':'400')+'" font-size="11">'+esc(monthLabel(m.month).replace('.',''))+'</text></g>';}
 const points=monthly.map((m,i)=>[L+(i+.5)*step,y(m.plannedTotal),m]);
 graph+='<polyline points="'+points.map(p=>p[0]+','+p[1]).join(' ')+'" fill="none" stroke="#ce8b28" stroke-width="2.5" stroke-dasharray="6 5"/>';
 graph+=points.map(([x,yy,m])=>'<circle role="button" tabindex="0" data-spend-month="'+m.month+'" aria-label="Consultar '+esc(monthLabel(m.month))+'" cx="'+x+'" cy="'+yy+'" r="4" fill="#ce8b28"><title>'+esc('Provisão '+monthLabel(m.month)+': '+money(m.plannedTotal))+'</title></circle>').join('');
 return '<div class="fw-spend-chart"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Gasto realizado e provisões por mês"><text x="15" y="16" fill="#647b8d" font-size="11">R$</text>'+graph+'</svg></div>';
}
export function costLedger(rows,{interactive=false}={}){return '<div class="fw-table-scroll"><table><thead><tr><th>Competência / previsão</th><th>Categoria / produto</th><th>Documento / ordem</th><th>Quantidade</th><th>Preço unitário</th><th>Valor</th>'+(interactive?'<th>Ação</th>':'')+'</tr></thead><tbody>'+rows.map((r,index)=>'<tr><td>'+esc(r.date?r.date.split('-').reverse().join('/'):'Sem previsão')+(r.overdue?'<small class="fw-spend-alert">Previsão vencida</small>':'')+'</td><td><b>'+esc(categoryLabel(r.category))+'</b><small>'+esc(r.description)+'</small></td><td><b>'+esc(r.order)+'</b><small>'+esc(r.document)+'</small><small>'+esc(r.supplier)+'</small></td><td>'+qty(r.quantity)+' '+r.unit+'</td><td>'+(r.price==null?'Custo da entrega':money(Math.round(r.price*100)))+'</td><td><b>'+money(r.amount)+'</b><small>'+esc(r.basis)+'</small></td>'+(interactive?'<td><button type="button" class="fw-spend-link" data-spend-row="'+index+'" aria-label="'+esc('Abrir '+r.description+' · '+(r.document||r.order||''))+'">Abrir</button></td>':'')+'</tr>').join('')+'</tbody><tfoot><tr><th colspan="5">Total dos lançamentos</th><th>'+money(sum(rows))+'</th>'+(interactive?'<td></td>':'')+'</tr></tfoot></table></div>'+(rows.length?'':'<p class="fw-spend-empty">Sem lançamentos neste recorte.</p>');}
export function spendingDetails(model,view,category=''){
 const inMonth=list=>list.filter(row=>row.month===model.month);
 const choices={
  actual:['Realizado no mês',inMonth(model.actual)],
  planned:['A realizar no mês',inMonth(model.planned)],
  total:['Total previsto no mês',[...inMonth(model.actual),...inMonth(model.planned)]],
  future:['Provisões dos próximos 6 meses',model.planned.filter(row=>row.month>model.month&&row.month<=shiftMonth(model.month,6))],
  orders:['Pedidos e OS emitidos no mês',inMonth(model.commitments)],
  cash:['Pagamentos previstos no mês',inMonth(model.payments)],
  unscheduled:['Valores sem vencimento calculado',model.unscheduled]
 };
 const [title,rows]=choices[view]||choices.total;
 return {title,rows:rows.filter(row=>!category||row.category===category)};
}
const drillLink=(view,label,category='',month='')=>'<button type="button" class="fw-spend-link" data-spend-drill="'+view+'"'+
 (category?' data-spend-drill-category="'+category+'"':'')+(month?' data-spend-drill-month="'+month+'"':'')+'>'+label+'</button>';

export function renderSpendingDetails(model,view,category=''){
 const detail=spendingDetails(model,view==='ceiling'?'orders':view,category);
 const total=sum(detail.rows);
 const ceiling=model.ceiling==null?null:cents(model.ceiling);
 const title=view==='ceiling'?'Teto mensal de gastos':detail.title;
 const summary=view==='ceiling'
  ?(ceiling===null?'Teto ainda não cadastrado':'Teto de '+money(ceiling)+' · '+(ceiling<total?'Excesso de ':'Saldo de ')+money(Math.abs(ceiling-total)))+' · '+money(total)+' em pedidos e OS'
  :money(total)+' · '+detail.rows.length+' lançamento(s)';
 return '<header class="fw-spend-dialog-head"><div><h4 id="fw-spend-dialog-title">'+esc(title)+
  (category?' · '+esc(categoryLabel(category)):'')+'</h4><p>'+monthLabel(model.month)+' · '+esc(summary)+
  '</p></div><form method="dialog"><button type="submit" autofocus>Fechar</button></form></header>'+
  '<div class="fw-spend-dialog-body">'+costLedger(detail.rows,{interactive:true})+'</div>';
}
export function renderSpendingRow(row,{canManage=false,readyEditable=false,factionEditable=false}={}){
 const action=(attr,id,label)=>id?'<button type="button" '+attr+'="'+esc(id)+'">'+label+'</button>':'';
 const order=row.category==='fabric'?action('data-fw-spend-purchase',row.orderId,'Abrir ordem de compra'):'';
 const quality=action('data-fw-open-lot-quality',row.lotId,'Abrir avaliação do lote');
 const ready=canManage&&readyEditable&&row.category==='ready'?action('data-fw-ready-edit',row.orderId,'Editar pedido de peças prontas'):'';
 const os=factionEditable?action('data-fw-buy-os',row.orderItemId,'Abrir ordem de serviço'):'';
 return '<header class="fw-spend-dialog-head"><div><h4 id="fw-spend-row-title">'+esc(row.description)+'</h4><p>'+
  esc([categoryLabel(row.category),row.order,row.document].filter(Boolean).join(' · '))+
  '</p></div><form method="dialog"><button type="submit" autofocus>Voltar aos lançamentos</button></form></header>'+
  '<div class="fw-spend-dialog-body">'+costLedger([row])+
  (order||quality||ready||os?'<div class="fw-spend-tools">'+order+quality+ready+os+'</div>':'')+'</div>';
}
const metricCard=(view,label,value,note,style='')=>'<button type="button" class="fw-spend-kpi '+style+
 '" data-spend-drill="'+view+'"><span>'+label+'</span><strong>'+value+'</strong><small>'+note+'</small></button>';

function paymentSettings(model,canManage,failed){
 if(failed)return '<p role="alert">Não foi possível carregar as condições financeiras salvas. Atualize os dados antes de usar a previsão.</p>';
 if(!canManage)return '';
 const selected=new Set([...model.unscheduled,...model.payments.filter(payment=>payment.month===model.month)].map(row=>row.sourceKey));
 const visible=model.paymentSources.filter(row=>row.month===model.month||selected.has(row.sourceKey));
 const groups=new Map();
 for(const row of visible){
  if(!groups.has(row.sourceKey))groups.set(row.sourceKey,[]);
  groups.get(row.sourceKey).push(row);
 }
 return '<details data-fw-detail-key="spend-terms"><summary>Conferir emissão da NF e prazo de pagamento</summary>'+
  '<p>Informe a emissão da NF nos recebimentos e o prazo em dias corridos. No saldo a receber, o prazo é aplicado à previsão de entrega. Use 30/60/90 para parcelas iguais.</p>'+
  [...groups].map(([key,rows])=>{
   const row=rows[0];
   return '<details data-fw-detail-key="spend-terms-'+esc(key)+'"><summary>'+esc(row.order+' · '+row.supplier+' · '+row.document)+' · '+money(sum(rows))+'</summary>'+
    '<form data-fw-form="paymentSchedule"><input type="hidden" name="source_key" value="'+esc(key)+'">'+
    (row.pending?'':'<label>Emissão da NF<input type="date" name="invoice_date" value="'+esc(row.invoiceDate)+'"></label>')+
    '<label>Prazo em dias<input name="payment_days" value="'+esc(row.days.join('/'))+'" placeholder="Ex.: 90 ou 30/60/90" maxlength="143"></label>'+
    '<button type="submit">Salvar condição</button></form></details>';
  }).join('')+(groups.size?'':'<p>Sem lançamentos para ajustar neste recorte.</p>')+'</details>';
}

function financialView(model,{canManage,paymentError,report}){
 const orders=spendingDetails(model,'orders').rows,cash=spendingDetails(model,'cash').rows;
 const ceiling=model.ceiling==null?null:cents(model.ceiling);
 const balance=ceiling===null?null:ceiling-sum(orders);
 const rows=Array.from({length:7},(_,index)=>{
  const month=shiftMonth(model.month,index);
  const due=model.payments.filter(row=>row.month===month),ordered=model.commitments.filter(row=>row.month===month);
  return '<tr><th scope="row">'+monthLabel(month)+'</th><td>'+drillLink('orders',money(sum(ordered)),'',month)+'</td>'+
   costCategories.map(([key])=>'<td>'+drillLink('cash',money(sum(due.filter(row=>row.category===key))),key,month)+'</td>').join('')+
   '<td><b>'+drillLink('cash',money(sum(due)),'',month)+'</b></td></tr>';
 }).join('');
 return '<section><h4>Pedidos e calendário de pagamentos</h4><div class="fw-spend-kpis">'+
  metricCard('orders','Pedidos e OS do mês',money(sum(orders)),'Pela emissão da OC ou OS')+
  metricCard('cash','Pagamentos previstos no mês',money(sum(cash)),'Pelo vencimento calculado, sem baixa financeira','fw-spend-amber')+
  metricCard('ceiling','Teto cadastrado',ceiling===null?'A definir':money(ceiling),
    balance===null?'Cadastre no orçamento mensal':(balance<0?'Excesso sobre o teto: ':'Saldo após pedidos e OS: ')+money(Math.abs(balance)))+
  metricCard('unscheduled','Sem vencimento calculado',money(sum(model.unscheduled)),'Falta prazo ou data de referência','fw-spend-amber')+'</div>'+
  '<p class="fw-spend-help">Pagamentos pela emissão da NF + prazo. Sem emissão registrada, a previsão usa a entrega prevista ou o recebimento e fica identificada como estimativa.</p>'+
  '<div class="fw-table-scroll"><table><thead><tr><th>Mês</th><th>Pedidos e OS</th>'+costCategories.map(([,label])=>'<th>'+label+'</th>').join('')+'<th>Pagamento previsto</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+
  (report?'':paymentSettings(model,canManage,paymentError))+'</section>';
}

export function renderTextileCosts(model,{category='',loaded=true,canManage=false,paymentError=false,report=false}={}){
 if(!loaded)return '<section class="fw-panel fw-spend" data-spend-dashboard><h3>Gastos mensais e provisões futuras</h3><p role="status">Carregando as compras, os recebimentos e as ordens da facção…</p></section>';
 const periodActual=model.actual.filter(r=>r.month===model.month),periodPlanned=model.planned.filter(r=>r.month===model.month),shownActual=periodActual.filter(r=>!category||r.category===category),shownPlanned=periodPlanned.filter(r=>!category||r.category===category);
 const card=(key,label,value,note,cls='')=>metricCard(key,label,money(value),note,cls);
 const composition='<h4>Composição de '+monthLabel(model.month)+'</h4>';
 const dialog=report?'':'<dialog class="fw-spend-dialog" data-spend-dialog aria-labelledby="fw-spend-dialog-title"></dialog><dialog class="fw-spend-dialog" data-spend-row-dialog aria-labelledby="fw-spend-row-title"></dialog>';
 const categories=costCategories.map(([key,label,color])=>{const a=sum(periodActual.filter(r=>r.category===key)),p=sum(periodPlanned.filter(r=>r.category===key));return '<button type="button" class="fw-spend-category" style="--cost-color:'+color+'" data-spend-category="'+key+'" aria-pressed="'+(category===key)+'"><span>'+label+'</span><strong>'+money(a)+'</strong><small>'+(periodActual.some(r=>r.category===key)?'Realizado no mês':'Sem lançamentos no mês')+'</small><b>+ '+money(p)+'</b><small>Pendente previsto no mês</small></button>';}).join('');
 const monthly='<div class="fw-table-scroll"><table class="fw-spend-months"><thead><tr><th>Mês</th>'+costCategories.map(([,label])=>'<th>'+label+'</th>').join('')+'<th>Realizado total</th><th>Provisão pendente</th><th>Total previsto</th></tr></thead><tbody>'+model.monthly.map(m=>'<tr '+(m.month===model.month?'class="fw-spend-selected"':'')+'><td><button type="button" data-spend-month="'+m.month+'">'+monthLabel(m.month)+'</button></td>'+costCategories.map(([k])=>'<td>'+money(m.actual[k])+'</td>').join('')+'<td><b>'+money(m.actualTotal)+'</b></td><td>'+money(m.plannedTotal)+'</td><td><b>'+money(m.actualTotal+m.plannedTotal)+'</b></td></tr>').join('')+'</tbody></table></div>';
 const future=Array.from({length:6},(_,i)=>shiftMonth(model.month,i+1)).map(m=>model.monthly.find(row=>row.month===m)).filter(Boolean);
 const forecast='<div class="fw-table-scroll"><table><thead><tr><th>Mês previsto</th>'+costCategories.map(([,l])=>'<th>'+l+'</th>').join('')+'<th>Total a realizar</th></tr></thead><tbody>'+future.map(m=>'<tr><td><button type="button" data-spend-month="'+m.month+'">'+monthLabel(m.month)+'</button></td>'+costCategories.map(([k])=>'<td>'+money(m.planned[k])+'</td>').join('')+'<td><b>'+money(m.plannedTotal)+'</b></td></tr>').join('')+'</tbody><tfoot><tr><th>Total dos 6 meses</th>'+costCategories.map(([k])=>'<th>'+money(future.reduce((s,m)=>s+m.planned[k],0))+'</th>').join('')+'<th>'+money(model.totals.future)+'</th></tr></tfoot></table></div>';
 return '<section class="fw-panel fw-spend" data-spend-dashboard><div class="fw-spend-heading"><div><small>GESTÃO DE GASTOS DO ENXOVAL</small><h3>Gastos mensais e provisões futuras</h3><p>Facção, tecidos e produtos prontos, como cobertores e toalhas.</p></div><div class="fw-spend-tools"><button type="button" data-spend-report>Relatório / WhatsApp</button><button type="button" data-spend-csv>Exportar Excel</button></div></div><div class="fw-spend-controls"><label>Mês de análise<input type="month" data-spend-month-input value="'+model.month+'"></label><button type="button" data-spend-prev aria-label="Mês anterior">←</button><button type="button" data-spend-next aria-label="Próximo mês">→</button><span>Valores em reais · '+monthLabel(model.month)+'</span></div><div class="fw-spend-kpis">'+card('actual','Realizado no mês',model.totals.actual,'Recebimentos e serviços registrados')+card('planned','A realizar no mês',model.totals.planned,'Saldo das ordens com previsão no mês','fw-spend-amber')+card('total','Total previsto no mês',model.totals.actual+model.totals.planned,'Realizado + provisões pendentes')+card('future','Próximos 6 meses',model.totals.future,'Provisões com data após o mês selecionado','fw-spend-amber')+'</div><div class="fw-spend-categories">'+categories+'</div>'+financialView(model,{canManage,paymentError,report})+'<div class="fw-spend-legend">'+costCategories.map(([,l,c])=>'<span><i style="background:'+c+'"></i>'+l+'</span>').join('')+'<span><i class="fw-spend-line"></i>Provisões pendentes</span></div>'+costChart(model)+'<p class="fw-spend-help">Colunas: realizado registrado por categoria. Linha pontilhada: provisões das ordens. Toque no mês para detalhar.</p><h4>Visão mensal da empresa</h4><p class="fw-spend-help">As quatro categorias mostram os valores realizados. As provisões aparecem nas duas últimas colunas.</p>'+monthly+'<h4>Provisões dos próximos 6 meses</h4><p class="fw-spend-help">Baseadas nos pedidos e nas OS em aberto, conforme as datas previstas. Novas compras ainda não lançadas não estão estimadas.</p>'+forecast+'<div class="fw-spend-pending">'+(model.undated.length?'<div><b>'+money(model.totals.undated)+' sem previsão definida</b><p>'+model.undated.length+' linhas aguardam a data de entrega do pedido ou do lote da facção.</p><details data-fw-detail-key="spend-undated"><summary>Ver valores sem mês definido</summary>'+costLedger(model.undated)+'</details></div>':'')+(model.overdue.length?'<div><b>'+money(model.totals.overdue)+' com previsão vencida</b><p>Atualize a previsão da ordem para programar o mês de realização.</p><details data-fw-detail-key="spend-overdue"><summary>Ver pendências vencidas</summary>'+costLedger(model.overdue)+'</details></div>':'')+'</div>'+composition+'<div class="fw-spend-tools"><label>Categoria<select data-spend-filter><option value="">Todas as categorias</option>'+costCategories.map(([k,l])=>'<option value="'+k+'" '+(category===k?'selected':'')+'>'+l+'</option>').join('')+'</select></label><button type="button" data-fw-tab="purchases">Abrir compras</button><button type="button" data-fw-tab="faction-desk">Abrir facção</button></div><details open data-fw-detail-key="spend-actual-'+model.month+'"><summary><b>Realizado · '+money(sum(shownActual))+'</b></summary>'+costLedger(shownActual)+'</details><details data-fw-detail-key="spend-planned-'+model.month+'"><summary><b>Provisões do mês · '+money(sum(shownPlanned))+'</b></summary>'+costLedger(shownPlanned)+'</details>'+(model.warnings.length?'<details data-fw-detail-key="spend-warnings"><summary>Conferências da base ('+model.warnings.length+')</summary><ul>'+model.warnings.map(w=>'<li>'+esc(({opening:'Saldo inicial sem NF excluído do gasto',orphan:'Recebimento sem ordem disponível',price:'Custo unitário ausente na OS',zero:'Custo de facção zerado na OS — conferir',amount:'Valor fora da faixa de cálculo'})[w.kind])+': '+esc(w.name)+'</li>').join('')+'</ul></details>':'')+'<details data-fw-detail-key="spend-basis"><summary>Base de cálculo dos indicadores</summary><p><b>Tecidos:</b> entradas com NF × custo efetivo do lote, no mês de recebimento. Pedido e recebimento não são somados duas vezes.</p><p><b>Facção e insumos:</b> valores informados nas entregas, no mês do registro. Provisão = peças ainda pendentes × custo unitário da OS.</p><p><b>Produtos prontos:</b> peças aceitas × preço do recebimento. Provisão = saldo ainda não recebido × preço do pedido.</p><p><b>Provisões:</b> usam as datas previstas dos itens de compra e dos lotes da facção. Pedidos cancelados e cotações não geram provisão. Sem data, o valor permanece destacado e não entra em um mês arbitrário.</p><p>Os gastos representam entradas e serviços registrados no Portal. Não há baixa de pagamento nesta base. O consumo do tecido na produção é acompanhado no custo por peça abaixo e não é somado novamente como compra.</p></details>'+dialog+'</section>';
}
export function renderTextileCostReport(model,{category='',logo=''}={}){const title='Gastos e provisões do enxoval';return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title><link rel="stylesheet" href="'+new URL('./textile-cost-v1.css?v=5',import.meta.url).href+'"><style>body{font:14px Segoe UI,Arial;color:#173c57;background:#edf4f8;margin:0}main{background:white;margin:20px auto;padding:30px;max-width:1200px}.fw-panel{border:0}header{padding:24px;border-radius:12px;background:#102f42;color:white}header img{max-width:150px;background:white;border-radius:8px}header h1{font-size:27px}.fw-table-scroll{overflow:visible}.fw-spend-kpis{grid-template-columns:repeat(4,1fr)}table{font-size:10px;width:100%;border-collapse:collapse}th,td{padding:8px;text-align:left;border-bottom:1px solid #dce6e9}th{background:#edf4f8}td small{display:block;font-size:9px}details{display:block}summary{font-weight:700}tr,figure{break-inside:avoid}.fw-spend-tools,.fw-spend-controls,.fw-spend-help button{display:none!important}.fw-spend table{min-width:0!important}.fw-spend-chart svg{min-width:0!important}.fw-spend-pending{display:block}@media print{.print{display:none}body{background:white}main{padding:0;margin:0}.fw-spend{padding:0}.fw-spend-category{print-color-adjust:exact}header{print-color-adjust:exact}.fw-spend-kpis{grid-template-columns:repeat(2,1fr)}@page{size:A4 landscape;margin:12mm}}</style></head><body><nav class="print"></nav><main><header>'+(logo?'<img src="'+esc(logo)+'" alt="GAO Lavanderia">':'')+'<p>GAO LAVANDERIA · ENXOVAL E TECIDOS</p><h1>'+title+'</h1><p>'+monthLabel(model.month)+(category?' · Detalhamento: '+esc(categoryLabel(category)):'')+' · Emitido em '+new Date().toLocaleString('pt-BR')+'</p></header>'+renderTextileCosts(model,{category,report:true}).replaceAll('<details ','<details open ')+'</main></body></html>';}
