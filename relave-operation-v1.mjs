import { renderDailyReport, renderHistoricalCustomerReport, customerOccurrenceTarget, customerOccurrenceStatus, weightDifferenceLabel, regression } from './relave-daily-report-v1.mjs?v=12';
import { openReport } from './relave-report-export-v1.mjs?v=1';

const layout="<style>\n*{box-sizing:border-box}:host{display:block;width:100%;min-width:0;max-width:100%;margin:0;background:#10151e;color:#eef4ff;font:15px system-ui,sans-serif;line-height:1.5}header{background:#19222f;border-bottom:1px solid #304054;padding:16px max(20px,calc((100vw - 1180px)/2));display:flex;justify-content:space-between;align-items:center;gap:16px}.brand{color:#74caff;font-weight:850;letter-spacing:.05em}small,.muted{color:#acbdd1}main{padding:16px 12px 28px}h1,h2,p{margin:0}h1{font-size:clamp(32px,5vw,48px);line-height:1.1;margin:5px 0 10px}h2{font-size:18px}.top,.controls,.legend{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.top{justify-content:space-between;margin-bottom:22px}.panel,.card{background:#1a2431;border:1px solid #324255;border-radius:13px;padding:16px}.panel{margin-top:14px;min-width:0;max-width:100%}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:12px}.card{text-align:left;color:inherit;font:inherit}.card strong{display:block;font-size:27px}.card span{color:#aac0d7}.bad{color:#ffc078}.good{color:#65dfbd}button,select,input{font:inherit;color:inherit;border:1px solid #435770;border-radius:8px;padding:8px 12px;background:#131c28}button{cursor:pointer}button:hover{border-color:#83c8ff}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #78c7ff;outline-offset:2px}.primary{background:#8ad3ff;color:#0c2034;font-weight:750;border-color:#8ad3ff}.legend{margin:8px 0;color:#c4d1df;font-size:13px}.key{display:inline-block;width:16px;border-top:4px solid #59aaf3;margin-right:5px;vertical-align:middle}.rate{border-color:#52dab4}.target{border-top:2px dashed #ffc078}.chart{max-width:100%;overflow:auto}.chart canvas{display:block;width:100%;min-width:450px;height:228px}.periods{display:grid;gap:5px;min-width:450px;margin-left:48px;margin-right:46px}.periods button{padding:6px 3px;font-size:12px}.split{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.rank{display:grid;grid-template-columns:minmax(90px,1fr) minmax(40px,1fr) max-content;gap:8px;align-items:center;margin-top:10px}.rank strong{text-align:right;white-space:nowrap}.rank strong small{display:block;font-size:12px;font-weight:500}.rank meter{width:100%;accent-color:#59aaf3}.table{max-width:100%;overflow:auto}table{width:100%;border-collapse:collapse;white-space:nowrap}th,td{text-align:left;padding:10px;border-bottom:1px solid #334356}th{color:#adc5df;font-size:13px}dialog{width:min(780px,calc(100% - 24px));max-height:90vh;overflow:auto;background:#1a2431;color:#eef4ff;border:1px solid #4b647f;border-radius:14px;padding:20px}dialog::backdrop{background:#08101acf}label{display:grid;gap:4px;color:#c2d2e6}input,select,textarea{min-width:0;width:100%}textarea{font:inherit;color:inherit;background:#131c28;border:1px solid #435770;border-radius:8px;padding:8px;min-height:64px}#weighForm textarea{resize:vertical}label[hidden],div[hidden]{display:none!important}label a{color:#8ad3ff}.fields,.item{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}.item{align-items:end;grid-template-columns:1fr 1fr 100px auto}#launch .fields{align-items:start}#launch .fields input,#launch .fields select{height:40px}.client-tools{display:flex;align-items:center;flex-wrap:wrap;gap:4px 14px;margin:0 0 12px;color:#aac0d7;font-size:13px}.client-tools a,.client-tools button{color:#8ad3ff}.client-tools button{background:transparent;border:0;padding:0;text-decoration:underline}.client-tools button:hover,.client-tools a:hover{color:#eef4ff}.form-actions{margin-top:16px}output{display:block;color:#8fe2ca;margin:10px 0}#hint{margin-top:9px}button[aria-current=true]{background:#254565;border-color:#78c7ff} @media(max-width:650px){.split{grid-template-columns:minmax(0,1fr)}.fields,.item{grid-template-columns:repeat(2,minmax(0,1fr))}.card strong{font-size:23px;overflow-wrap:anywhere}.rank{grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto}.top>div,.controls>label{min-width:0;max-width:100%}.top button,.controls button{min-height:44px}} @media(max-width:400px){.fields,.item{grid-template-columns:minmax(0,1fr)}}\n</style><main>\n<div class=\"top\"><div><small>Produção / Relave</small><h1>Relave</h1><p class=\"muted\">Acompanhe a meta e confira as comandas que compõem o indicador.</p></div><button id=\"daily-report\">Relatório diário</button><button id=\"legacy\">Histórico e edição</button><button id=\"new\" class=\"primary\">+ Novo lançamento</button></div>\n<div class=\"controls\"><button id=\"all\">Todos os meses</button><button id=\"back\" hidden>Voltar um nível</button><strong id=\"scope\"></strong></div>\n<p id=\"archive-error\" role=\"status\" hidden>O histórico de expedição está indisponível. Indicadores e relatórios podem estar incompletos.</p><section id=\"cards\" class=\"cards panel\" aria-label=\"Indicadores\"></section>\n<section class=\"panel\"><h2>Evolução do relave interno GAO</h2><div class=\"legend\"><span><i class=\"key\"></i>Relave (kg)</span><span><i class=\"key rate\"></i>Relave (%)</span><span><i class=\"key target\"></i>Meta 2,50%</span></div><div class=\"chart\"><canvas id=\"graph\" role=\"img\" aria-label=\"Barras de kg de relave e linha do percentual por período\"></canvas><div id=\"periods\" class=\"periods\"></div></div><p id=\"hint\" class=\"muted\"></p></section>\n<div id=\"relave-rankings\" class=\"split\"><section class=\"panel\"><h2>Motivos por peso</h2><div id=\"reasons\"></div></section><section class=\"panel\"><h2>Tipos de enxoval por peso</h2><div id=\"types\"></div></section></div>\n<section class=\"panel\" id=\"weighing\"><h2>Conferência de peso · Relave interno GAO</h2>\n<p class=\"muted\">Compare o peso líquido da expedição com o peso líquido recebido na área suja, na mesma comanda.</p>\n<div id=\"weighSummary\" class=\"cards\" style=\"margin:12px 0\"></div>\n<div class=\"controls\"><label>Situação da pesagem<select id=\"weighFilter\"><option value=\"\">Todas</option><option>Aguardando pesagem</option><option>Em tratativa</option><option>Tratada</option><option>Conferida</option></select></label></div>\n<div class=\"table\"><table><thead><tr><th>Comanda da expedição</th><th>Data</th><th>Peso da expedição</th><th>Comanda da área suja</th><th>Peso na área suja</th><th>Diferença (kg e %)</th><th>Situação</th><th>Ação</th></tr></thead><tbody id=\"weighRows\"></tbody></table></div></section>\n<section class=\"panel\" id=\"commands\"><h2>Comandas no recorte</h2><div class=\"controls\"><label>Buscar por comanda ou cliente<input id=\"command-search\" type=\"search\"></label><label>Situação da auditoria<select id=\"audit-filter\"><option value=\"\">Todas</option><option value=\"conflict\">Em conciliação</option><option value=\"audit\">Com auditoria</option></select></label></div><p id=\"command-count\" class=\"muted\"></p><p id=\"command-feedback\" role=\"status\"></p><div class=\"table\"><table><thead><tr><th>Comanda</th><th>Data</th><th>Cliente</th><th>Tipo de relave</th><th>Triado</th><th>Relave</th><th>%</th><th>Situação</th><th>Ação</th></tr></thead><tbody id=\"rows\"></tbody></table></div><button id=\"more-commands\" hidden>Mostrar mais comandas</button></section>\n</main>\n<dialog id=\"detail\"><div class=\"top\"><h2 id=\"detailTitle\"></h2><button data-close=\"detail\">Fechar</button></div><div id=\"detailBody\"></div></dialog>\n<dialog id=\"launch\"><div class=\"top\"><h2>Novo lançamento</h2><button data-close=\"launch\">Fechar</button></div><form id=\"form\"><p class=\"muted\">Informe o peso triado uma vez e adicione os pesos de relave por tipo e motivo.</p><div class=\"fields\"><label>Tipo de relave<select name=\"kind\" required><option value=\"\">Selecione o tipo</option><option value=\"internal\">Relave interno GAO</option><option value=\"customer\">Relave por ocorrência do cliente</option></select></label><label>Comanda<input name=\"id\" required maxlength=\"32\"></label><label>Data<input name=\"date\" required type=\"date\"></label><label>Cliente<select name=\"clientId\"></select></label><label>Responsável<input name=\"responsible\" required maxlength=\"80\"></label><label>Kg triados<input name=\"sorted\" required type=\"number\" min=\".01\" step=\".01\"></label><label>Kg de lixo<input name=\"trashKg\" type=\"number\" inputmode=\"decimal\" min=\"0\" step=\".01\"></label></div><div class=\"client-tools\"><small id=\"previous-client\" hidden></small><a href=\"/#administracao-clientes\" target=\"_blank\" rel=\"noopener\">Cadastro de clientes</a><button type=\"button\" id=\"reload-clients\">Atualizar lista</button></div><div id=\"customer-details\" hidden><label>Descrição da ocorrência<textarea name=\"issue\" maxlength=\"1500\"></textarea></label><label>Ação da Qualidade<textarea name=\"action\" maxlength=\"1500\"></textarea></label></div><div id=\"items\"></div><button type=\"button\" id=\"add\">+ Adicionar ocorrência</button><output id=\"total\"></output><p class=\"muted\">Para registrar uma conferência sem relave, salve sem ocorrências.</p><div class=\"form-actions\"><button class=\"primary\">Salvar lançamento</button></div><p id=\"error\" role=\"alert\" class=\"bad\"></p></form></dialog>\n<dialog id=\"weighDialog\"><div class=\"top\"><h2>Conferência de peso</h2><button data-close=\"weighDialog\">Fechar</button></div>\n<form id=\"weighForm\"><p id=\"weighInfo\"></p>\n<div class=\"fields\"><label>Data da expedição<input name=\"expeditionDate\" type=\"date\" required></label><label>Comanda da área suja<input name=\"receivingCommand\" required maxlength=\"80\" placeholder=\"Número da comanda de recebimento\"></label><label>Kg líquidos na área suja<input name=\"received\" required type=\"number\" min=\"0\" step=\".01\"></label><label>Responsável<input name=\"owner\" required maxlength=\"80\"></label></div>\n<output id=\"weighDelta\"></output>\n<label>Prazo da tratativa<input name=\"dueDate\" type=\"date\"></label><label>Causa apurada e ação da Qualidade<textarea name=\"action\" rows=\"4\" maxlength=\"1500\" placeholder=\"Ex.: tara incorreta. Repesagem acompanhada.\"></textarea></label>\n<label style=\"display:flex;align-items:center;margin-top:12px\"><input name=\"resolved\" type=\"checkbox\" style=\"width:auto\"> Concluir tratativa</label>\n<div class=\"form-actions\"><button class=\"primary\">Salvar conferência</button></div><p id=\"weighError\" role=\"alert\" class=\"bad\"></p></form></dialog>\n<dialog id=\"report-dialog\"><div class=\"top\"><h2>Relatório diário de relave</h2><button data-close=\"report-dialog\">Fechar</button></div><form id=\"report-form\"><label>Tipo de relatório<select name=\"reportType\"><option value=\"internal\">Relatório diário de relave</option><option value=\"customer\">Relave por ocorrência · Cliente</option></select></label><label id=\"report-client\" hidden>Cliente cadastrado<select name=\"reportClientId\"></select></label><label>Data de fechamento<input type=\"date\" name=\"closingDate\" required></label><p id=\"report-error\" role=\"alert\"></p><button class=\"primary\" type=\"submit\">Abrir relatório</button></form></dialog>";

const isHistoricalRelave=row=>/\bRELAVE\b/i.test(row.type);
function monthlyClientKey(value){
 const name=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()
  .replace(/[^A-Z0-9]+/g,' ').trim();
 return /^(HEJ(?: |$)|HOSPITAL ESTADUAL DE JATAI(?: |$))/.test(name)?'HEJ':name;
}

export function monthlyClientOccurrences(history,records,month){
 const clients=new Map(), coverageDates=[];
 function client(name){
  const key=monthlyClientKey(name);
  if(!clients.has(key))clients.set(key,{name,triaged:0,waste:0,coveredWaste:0});
  return clients.get(key);
 }
 for(const [name,orders] of Object.entries(history?.triage||{})){
  for(const [date,,weight] of orders){
   if(!date.startsWith(month))continue;
   client(name).triaged+=weight;
   coverageDates.push(date);
  }
 }
 coverageDates.sort();
 const first=coverageDates[0], last=coverageDates.at(-1);
 const isCovered=date=>first&&date>=first&&date<=last;
 const imported=new Map();
 for(const event of history?.events||[]){
  if(!event.client||!event.date.startsWith(month)||!isHistoricalRelave(event))continue;
  const group=client(event.client), weight=Math.round(event.kg*100);
  group.waste+=weight;
  if(isCovered(event.date))group.coveredWaste+=weight;
  const command=String(event.order??'').trim().toLowerCase();
  if(command){
   const key=JSON.stringify([monthlyClientKey(event.client),event.date,command]);
   imported.set(key,(imported.get(key)||0)+weight);
  }
 }
 for(const record of records){
  if(record.kind!=='customer'||!record.client||record.auditOnly||!Array.isArray(record.items)||!record.date.startsWith(month))continue;
  const group=client(record.client);
  const weight=record.items.reduce((sum,item)=>sum+Math.round(item.weight*100),0);
  const command=String(record.command??'').trim().toLowerCase();
  const key=JSON.stringify([monthlyClientKey(record.client),record.date,command]);
  const difference=weight-(imported.get(key)||0);
  imported.delete(key);
  group.waste+=difference;
  if(isCovered(record.date))group.coveredWaste+=difference;
 }
 return { first,last,clients:[...clients.values()].map(group=>({
  name:group.name,triaged:group.triaged/100,waste:group.waste/100,coveredWaste:group.coveredWaste/100,
  rate:group.triaged>0?100*group.coveredWaste/group.triaged:null
 })).sort((a,b)=>b.waste-a.waste||a.name.localeCompare(b.name,'pt-BR')) };
}

export function mountRelave(host,{records,archiveError,canEdit=false,excludeRecord,saveRecord,saveWeighing,openHistory,loadClients}){
const view=host.attachShadow({mode:'open'});
view.innerHTML=layout;
const titleView=view.querySelector('h1');
titleView.insertAdjacentHTML('afterend','<p class="controls" aria-label="Tipo de relave"><button type="button" id="scope-internal" aria-pressed="true">Relave interno</button><button type="button" id="scope-customer" aria-pressed="false">Relave por ocorrência do cliente</button></p>');
view.querySelector('#customer-details').insertAdjacentHTML('beforeend',`<fieldset><legend>Rastreamento da ocorrência</legend><div class="fields">
 <label>Comanda da expedição<input name="expeditionCommand" maxlength="48"></label>
 <label>Comanda da área suja<input name="receivingCommand" maxlength="48"></label>
 <label>Volume da entrada na Qualidade<input name="qualityVolume" maxlength="48"></label>
 <label>Entrada na Qualidade (kg)<input name="qualityWeight" type="number" min="0" step="0.01"></label>
 <label>Devolução à Produção (kg)<input name="returnedWeight" type="number" min="0" step="0.01"></label>
 </div><p class="muted">GAO QUALIDADE · ENTRADA QUALIDADE. Na expedição e na área suja, use o item SEM CONDIÇÕES DE USO para o relave. A devolução segue para a Produção.</p></fieldset>`);
view.querySelector('#weighForm').insertAdjacentHTML('afterbegin','<label id="weigh-expedition" hidden>Comanda da expedição<input name="expeditionCommand" maxlength="48"></label>');
view.querySelector('#weighing h2').insertAdjacentHTML('afterend','<p class="muted">Diferença percentual = (peso na área suja − peso da expedição) ÷ peso da expedição × 100.</p>');
view.querySelector('#weighFilter').insertAdjacentHTML('beforeend','<option>Conferida</option>');
view.querySelector('style').textContent+='\nbutton[aria-pressed="true"]{border-color:#78c2ef;background:#254565} #customer-details fieldset{min-width:0;border:1px solid #40566e;border-radius:10px;margin:12px 0;padding:10px} #customer-details fieldset p{margin:6px 0}';
view.querySelector('.controls').insertAdjacentHTML('beforeend','<button type="button" id="open-customer-history">Histórico por cliente</button>');
view.querySelector('style').textContent+='\nbutton.rank{width:100%;text-align:left;background:transparent;border-color:transparent;padding:6px}button.rank:hover,button.rank[aria-pressed=true]{border-color:#78c2ef}button.rank[aria-pressed=true]{background:#254565}.trend{border-top:2px dashed #c6b8ff}.chart .periods{min-width:0;margin-right:0}#chart-filter{margin:8px 0}';
const graphSection=view.querySelector('#graph').closest('section');
graphSection.querySelector('.legend').insertAdjacentHTML('beforeend','<span id="chart-trend" hidden><i class="key trend"></i>Tendência do percentual</span>');
graphSection.querySelector('.chart').insertAdjacentHTML('beforebegin','<div class="controls" id="chart-filter" hidden><span id="chart-filter-label" role="status"></span><button type="button" id="clear-chart-filter">Limpar filtro</button></div>');
const historyDialog=document.createElement('dialog');
historyDialog.id='customer-history';
historyDialog.innerHTML='<div class="top"><h2>Histórico de ocorrências por cliente</h2><button type="button" id="close-customer-history">Fechar</button></div><div id="customer-history-body"></div>';
view.append(historyDialog);

const $=id=>view.getElementById(id);
$('clear-chart-filter').onclick=()=>{
 chartFilter=null;
 render();
 $('graph').closest('section').querySelector('h2').focus({preventScroll:true});
};
graphSection.querySelector('h2').tabIndex=-1;
const num=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const kg=n=>num.format(n)+' kg';
const pct=n=>num.format(n)+'%';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let customerHistory,customerHistoryRequest,customerHistoryError=false;
function loadCustomerHistory(){
 if(customerHistory)return Promise.resolve(customerHistory);
 if(customerHistoryRequest)return customerHistoryRequest;
 customerHistoryError=false;
 customerHistoryRequest=(async()=>{
  const session=window.GAO_AUTH_SESSION||await window.GAO_AUTH_READY;
  if(!session?.access_token)throw Error('Entre no portal para consultar o histórico.');
  const response=await fetch('https://fquzuxdqvhecijjuxbmg.supabase.co/rest/v1/chemical_portal_state?select=payload&state_key=eq.gao.chemicals.relave.customer-history.202608-20261111',{
   headers:{apikey:'sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ',Authorization:'Bearer '+session.access_token}
  });
  if(!response.ok)throw Error('Não foi possível consultar o histórico.');
  const data=(await response.json())[0]?.payload;
  if(!data||!Array.isArray(data.events)||!data.triage)throw Error('Histórico indisponível para esta conta.');
  customerHistory=data;
  return data;
 })().catch(error=>{customerHistoryError=true;throw error;}).finally(()=>{customerHistoryRequest=null;});
 return customerHistoryRequest;
}
function historicalTotals(data,includes){
 const sorted=Object.values(data.triage).flat().reduce((sum,row)=>sum+(includes(row[0])?row[2]:0),0)/100;
 const waste=data.events.reduce((sum,row)=>sum+(includes(row.date)&&isHistoricalRelave(row)?Math.round(row.kg*100):0),0)/100;
 return {sorted,waste,rate:sorted>0?100*waste/sorted:null};
}
async function openCustomerHistory(useSelection=false){
 const dialog=$('customer-history'), body=$('customer-history-body');
 dialog.showModal();
 body.textContent='Carregando histórico…';
 try{
  const data=await loadCustomerHistory();
  const {events,triage}=data;
  body.innerHTML='<p>01/08/2026 a 11/11/2026</p><div class="controls"><label>Mês<select id="ch-month"><option value="">Todo o período</option><option value="2026-08">Agosto</option><option value="2026-09">Setembro</option><option value="2026-10">Outubro</option><option value="2026-11">Novembro até dia 11</option></select></label><label>Cliente<select id="ch-client"><option value="">Todos do histórico</option></select></label><label>Indicador<select id="ch-type"><option value="all">Todas as ocorrências</option><option value="relave">Relave na descrição</option></select></label></div><p class="muted">Percentual = kg de ocorrências ÷ kg triados do mesmo cliente e período. A base inclui comandas sem ocorrência.</p><p id="ch-total" role="status"></p><button type="button" id="ch-report" class="primary">Gerar relatório por cliente</button><p id="ch-report-status" role="status"></p><div id="ch-rows"></div>';
  const clients=Object.keys(triage).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  for(const client of clients)$('ch-client').add(new Option(client,client));
  const table=(headers,rows,actions=[])=>'<div class="table"><table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map((row,i)=>'<tr>'+row.map(x=>'<td>'+esc(x)+'</td>').join('')+(actions[i]||'')+'</tr>').join('')+'</tbody></table></div>';
  function reportDay(client,date){
   const status=$('ch-report-status');
   const logo=getComputedStyle(document.documentElement).getPropertyValue('--liquid-logo').match(/data:image\/(?:png|webp);base64,[A-Za-z0-9+/=]+/)?.[0];
   try{
    const report=renderHistoricalCustomerReport(data,client,date,$('ch-type').value,logo,entries.map(row=>({...row,weighing:weighing.get(row)})));
    openReport(report,'gao-relave-historico-'+date);
    status.textContent='';
   }catch(error){status.textContent=error.message;}
  }
  $('ch-rows').onclick=event=>{
   const button=event.target.closest('[data-ch-report-day]');
   if(button)reportDay(button.dataset.client,button.dataset.chReportDay);
  };
  const ratio=(a,b)=>b>0?pct(100*a/b):'Sem base de triagem';
  const date=d=>d.split('-').reverse().join('/');
  function drawHistory(){
   const selectedMonth=$('ch-month').value, client=$('ch-client').value, relave=$('ch-type').value==='relave';
   const includes=d=>d.startsWith(selectedMonth)&&(!useSelection||inPeriod(d));
   let numerator=0,denominator=0;
   const companySorted=totals(entries.filter(row=>kindOf(row)==='internal'&&includes(row.date))).sorted;
   const sections=clients.filter(name=>!client||client===name).map(name=>{
    const orders=triage[name].filter(row=>includes(row[0]));
    const occurrences=events.filter(row=>row.client===name&&includes(row.date)&&(!relave||isHistoricalRelave(row)));
    const sorted=orders.reduce((sum,row)=>sum+row[2],0);
    const weight=occurrences.reduce((sum,row)=>sum+Math.round(row.kg*100),0);
    numerator+=weight;denominator+=sorted;
    return '<details class="card"><summary>'+esc(name)+' · '+ratio(weight,sorted)+' · '+kg(weight/100)+' / '+kg(sorted/100)+'</summary><p>Visão da empresa · '+(companySorted>0?ratio(weight,Math.round(companySorted*100)):'Sem base de triagem da empresa')+' · '+kg(weight/100)+' / '+kg(companySorted)+' triados na empresa no mesmo período</p><details><summary>Ocorrências ('+occurrences.length+')</summary>'+table(['Data','Comanda','Tipo','Peso','Relatório'],occurrences.map(row=>[date(row.date),row.order,row.type,kg(row.kg)]),occurrences.map(row=>'<td><button type="button" data-ch-report-day="'+esc(row.date)+'" data-client="'+esc(name)+'">Emitir dia</button></td>'))+'</details><details><summary>Comandas triadas ('+orders.length+')</summary>'+table(['Data','Comanda','Peso triado'],orders.map(row=>[date(row[0]),row[1],kg(row[2]/100)]))+'</details></details>';
   });
   $('ch-rows').innerHTML=sections.join('');
   $('ch-total').textContent=ratio(numerator,denominator)+' · '+kg(numerator/100)+' de relave por ocorrência do cliente / '+kg(denominator/100)+' triados do cliente · Meta até 2% nas duas visões · Visão da empresa: '+(companySorted>0?ratio(numerator,Math.round(companySorted*100)):'Sem base de triagem da empresa')+' / '+kg(companySorted)+' triados na empresa';
  }
  $('ch-report').onclick=()=>{
   const status=$('ch-report-status');
   status.textContent='';
   const period=useSelection?(day?date(day):week||month||'01/08/2026 a 11/11/2026'):$('ch-month').selectedOptions[0].textContent;
   const client=$('ch-client').selectedOptions[0].textContent;
   const indicator=$('ch-type').selectedOptions[0].textContent;
   const content=$('ch-rows').cloneNode(true);
   content.querySelectorAll('details').forEach(detail=>detail.open=true);
   content.querySelectorAll('button').forEach(button=>button.closest('td')?.replaceChildren());
   const logo=getComputedStyle(document.documentElement).getPropertyValue('--liquid-logo').match(/data:image\/(?:png|webp);base64,[A-Za-z0-9+/=]+/)?.[0];
   const report = '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GAO · Relatório de ocorrências por cliente</title><style>@page{size:A4;margin:12mm}body{font:14px system-ui;color:#102d45;margin:0}main{padding:24px}header{border-bottom:2px solid #2269a4;margin-bottom:14px}header img{width:105px}h1{font-size:22px}details{margin:12px 0}summary{font-weight:700;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;margin:8px 0}td,th{padding:5px;text-align:left;border-bottom:1px solid #dbe5ed}th{background:#e2edf4}thead{display:table-header-group}tr{break-inside:avoid}@media print{body{font-size:11px}main{padding:0}.print{display:none}}</style><body><div class="print"></div><main><header>'+(logo?'<img src="'+logo+'" alt="GAO Lavanderia">':'<strong>GAO Lavanderia</strong>')+'<h1>Relatório de ocorrências por cliente</h1><p>'+esc(period)+' · '+esc(client)+' · '+esc(indicator)+'</p></header><p><strong>'+esc($('ch-total').textContent)+'</strong></p><p>Percentual = kg de ocorrências ÷ kg triados do mesmo cliente e período.</p>'+content.innerHTML+'</main></body></html>';
   try {
    openReport(report,'gao-relave-historico');
   } catch(error) {
    status.textContent=error.message;
   }
  };
  for(const id of ['ch-month','ch-client','ch-type'])$(id).onchange=drawHistory;
  if(useSelection){
   $('ch-type').value='relave';
   $('ch-month').disabled=true;
   body.firstElementChild.textContent='Histórico importado · '+(day?date(day):week||month||'01/08/2026 a 11/11/2026');
  }
  drawHistory();
 }catch(error){body.textContent=error.message;}
}
$('open-customer-history').onclick=()=>openCustomerHistory();
$('close-customer-history').onclick=()=>$('customer-history').close();
const dayLabel=d=>d.slice(8,10)+'/'+d.slice(5,7);
const dateOf=d=>new Date(d+'T12:00:00Z');
function weekOf(d){const dt=dateOf(d);dt.setUTCDate(dt.getUTCDate()+4-(dt.getUTCDay()||7));const y=dt.getUTCFullYear();const week=Math.ceil(((dt-Date.UTC(y,0,1))/86400000+1)/7);return y+'-S'+String(week).padStart(2,'0')}
const typeNames=['Lençol','Cirúrgico','Privativo','Outros'],reasonNames=['Sangue','Cola / fita','Amarelado','Óleo','Passadoria','Resíduo','Rasgado','Limpo','Permanente','Tinta','Nó','Outros'];
const entries=records;
let scopeKind='internal';
const expeditionNumber=r=>kindOf(r)==='customer'?(r.weighing?.expeditionCommand||r.expeditionCommand||''):r.command;
const receivingNumber=r=>r.weighing?.receivingCommand||r.receivingCommand||'';
$('archive-error').hidden=!archiveError;
const kinds={internal:'Relave interno GAO',customer:'Relave por ocorrência do cliente'};
const kindOf=r=>r.kind||'internal';
let month='',week='',day='', groups=[], chartFilter=null;
const sumItems=items=>(items||[]).reduce((s,x)=>s+x.weight,0);
function totals(rows, itemFilter=null){const done=rows.filter(r=>!r.auditOnly&&r.items!==null);const sorted=done.reduce((s,r)=>s+r.sorted,0);const waste=done.reduce((s,r)=>s+sumItems(itemFilter?r.items.filter(item=>item[itemFilter.key]===itemFilter.label):r.items),0);return {sorted,waste,rate:sorted?100*waste/sorted:null,pending:rows.filter(r=>r.items===null&&!r.auditOnly).length}}
const monthLabel=m=>new Intl.DateTimeFormat('pt-BR',{month:'short',year:'numeric',timeZone:'UTC'}).format(dateOf(m+'-01'));
const weekLabel=w=>w.slice(5)+'/'+w.slice(0,4);
const inPeriod=date=>(!month||date.startsWith(month))&&(!week||weekOf(date)===week)&&(!day||date===day);
const filtered=()=>entries.filter(r=>inPeriod(r.date)&&kindOf(r)===scopeKind);
function rankings(id,items,key){
 const totals=new Map();
 for(const item of items)totals.set(item[key],(totals.get(item[key])||0)+Math.round(item.weight*100));
 const total=[...totals.values()].reduce((sum,value)=>sum+value,0);
 const sorted=[...totals].sort((a,b)=>b[1]-a[1]);
 $(id).innerHTML=sorted.map(([label,value])=>{
  const share=total>0?100*value/total:0;
  const pressed=chartFilter?.key===key&&chartFilter.label===label;
  return '<button type="button" class="rank" aria-pressed="'+pressed+'"><span>'+esc(label)+'</span>'+
   '<meter aria-label="Participação no relave" max="'+(total||1)+'" value="'+value+'"></meter>'+
   '<strong>'+kg(value/100)+'<small>'+pct(share)+'</small></strong></button>';
 }).join('')||'<p class="muted">Nenhuma ocorrência no recorte.</p>';
 $(id).querySelectorAll('button').forEach((button,index)=>{
  button.onclick=()=>{
   chartFilter=button.getAttribute('aria-pressed')==='true'?null:{key,label:sorted[index][0]};
   render();
   $(id).querySelectorAll('button')[index]?.focus({preventScroll:true});
   $('graph').closest('section').scrollIntoView({block:'nearest'});
  };
 });
}

const weighing=new Map(entries.filter(r=>r.weighing).map(r=>[r,r.weighing]));
function weightDelta(r,received){return Math.round(received*100)-Math.round(sumItems(r.items)*100)}
function weightStatus(r,check){return !check?'Aguardando pesagem':!weightDelta(r,check.received)?'Conferida':check.resolved?'Tratada':'Em tratativa'}
function weighingChecks(rows){
 return rows.filter(r=>r.canWeigh&&r.command&&sumItems(r.items)>0).map(r=>({r,check:weighing.get(r),status:weightStatus(r,weighing.get(r))}));
}
function pendingCommands(rows,checks){
 const pending=new Map(rows.filter(r=>r.items===null).map(r=>[r,'Relave a conferir']));
 for(const {r,status} of checks)if(status==='Aguardando pesagem'||status==='Em tratativa')pending.set(r,status);
 return pending;
}
function renderWeighing(checks){
 $('weighSummary').innerHTML=['Aguardando pesagem','Em tratativa','Tratada'].map(status=>'<button class="card" data-weight-filter="'+status+'"><span>'+status+'</span><strong>'+checks.filter(x=>x.status===status).length+'</strong></button>').join('');
 $('weighSummary').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('weighFilter').value=b.dataset.weightFilter;render()});
 const filter=$('weighFilter').value;
 const visible=checks.filter(x=>!filter||x.status===filter);
 $('weighRows').innerHTML=visible.map(({r,check,status})=>'<tr><td><button data-entry="'+entries.indexOf(r)+'">'+esc(expeditionNumber(r)||'Não informada')+'</button></td><td>'+dayLabel(r.date)+'</td><td>'+kg(sumItems(r.items))+'</td><td>'+esc(receivingNumber(r)||'—')+'</td><td>'+(check?kg(check.received):'—')+'</td><td class="'+(check&&weightDelta(r,check.received)?'bad':'')+'">'+(check?weightDifferenceLabel(sumItems(r.items),check.received):'—')+'</td><td>'+status+'</td><td><button ' +(!canEdit&&(check||kindOf(r)==='customer')?'data-entry':'data-weigh')+'="'+entries.indexOf(r)+'">'+(!canEdit&&(check||kindOf(r)==='customer')?'Ver comanda':check?'Revisar':'Registrar peso')+'</button></td></tr>').join('')||'<tr><td colspan="8">Nenhuma comanda nesta situação.</td></tr>';
 $('weighRows').querySelectorAll('[data-entry]').forEach(b=>b.onclick=()=>openEntry(entries[Number(b.dataset.entry)]));
 $('weighRows').querySelectorAll('[data-weigh]').forEach(b=>b.onclick=()=>openWeighing(entries[Number(b.dataset.weigh)]));
}
let activeWeighing;
function updateWeighDelta(){
 const received=$('weighForm').elements.received.value;
 if(received===''){$('weighDelta').textContent='';return}
 $('weighDelta').textContent='Diferença (área suja − expedição) '+weightDifferenceLabel(sumItems(activeWeighing.items),Number(received));
}
function openWeighing(r){
 activeWeighing=r;
 const check=weighing.get(r), form=$('weighForm');
 if(!canEdit&&(check||kindOf(r)==='customer')){openEntry(r);return;}
 const customer=kindOf(r)==='customer';
 $('weigh-expedition').hidden=!customer;
 form.elements.expeditionCommand.required=customer;
 form.elements.expeditionCommand.value=customer?expeditionNumber(r):'';
 $('weighInfo').textContent=(customer?'Comanda do cliente '+r.command+' · SEM CONDIÇÕES DE USO':r.command)+' · '+kg(sumItems(r.items))+' líquidos na expedição';
 form.elements.expeditionDate.value=r.date;
 form.elements.expeditionDate.disabled=!canEdit;
 form.elements.receivingCommand.value=receivingNumber(r);
 form.elements.received.value=check?num.format(check.received).replaceAll('.','').replace(',','.'):'';form.elements.owner.value=check?.owner||'';form.elements.dueDate.value=check?.dueDate||'';form.elements.action.value=check?.action||'';form.elements.resolved.checked=Boolean(check?.resolved);$('weighError').textContent='';updateWeighDelta();$('weighDialog').showModal();
}
$('weighFilter').onchange=render;
$('weighForm').oninput=updateWeighDelta;
$('weighForm').onsubmit=async e=>{
 e.preventDefault();
 const form=e.currentTarget.elements,received=Number(form.received.value),owner=form.owner.value.trim(),action=form.action.value.trim();
 const receivingCommand=form.receivingCommand.value.trim();
 const customer=kindOf(activeWeighing)==='customer', expeditionCommand=form.expeditionCommand.value.trim();
 if(customer&&!expeditionCommand){$('weighError').textContent='Informe a comanda da expedição.';return}
 if(!receivingCommand){$('weighError').textContent='Informe a comanda usada pela área suja.';return}
 const resolved=form.resolved.checked&&weightDelta(activeWeighing,received)!==0;
 if(!owner||(resolved&&!action)){$('weighError').textContent='Informe o responsável e descreva a causa e a ação antes de concluir a divergência.';return}
 const record=activeWeighing, previous=weighing.get(record);
 const check={receivingCommand,...(customer?{expeditionCommand}:{}),received,owner,action,resolved,dueDate:form.dueDate.value,weighedAt:previous?.weighedAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 const expeditionDate=canEdit?form.expeditionDate.value:undefined;
 if(expeditionDate&&expeditionDate!==record.date&&entries.some(other=>other!==record&&kindOf(other)===kindOf(record)&&other.date===expeditionDate&&other.command?.toLowerCase()===record.command.toLowerCase())){
  $('weighError').textContent='Já existe um lançamento para esta comanda na data informada.';return;
 }
 await commit(e.currentTarget,'weighError',async()=>{
  const saved=await saveWeighing(record,check,expeditionDate);
  const dateChanged=saved.date!==record.date;
  Object.assign(record,saved);
  weighing.set(record,saved.weighing);
  if(dateChanged&&month){
   month=record.date.slice(0,7);
   if(week)week=weekOf(record.date);
   if(day)day=record.date;
  }
  $('weighDialog').close();render();
 });
};
let clientMonth='', lastChartMonth;
function renderMonthlyClients(companyPanel){
 let panel=$('monthly-client-occurrences');
 if(!panel){
  panel=document.createElement('section');
  panel.id='monthly-client-occurrences';
  panel.className='panel';
  panel.innerHTML='<h2>Relave por ocorrência · Visão mensal do cliente</h2>'+
   '<p class="muted">Percentual = kg de relave por ocorrência ÷ kg líquidos triados do próprio cliente no mesmo período × 100.</p>'+
   '<div class="controls" style="margin:10px 0"><label>Mês de referência<select id="monthly-client-month"></select></label></div>'+
   '<p class="muted" id="monthly-client-coverage" role="status"></p><div class="table" id="monthly-client-table"></div>';
  companyPanel.after(panel);
  $('monthly-client-month').onchange=event=>{clientMonth=event.target.value;renderMonthlyClients(companyPanel);};
 }
 const months=new Set(entries.map(row=>row.date.slice(0,7)));
 for(const orders of Object.values(customerHistory?.triage||{})){
  for(const [date] of orders)months.add(date.slice(0,7));
 }
 const choices=[...months].sort().reverse();
 if(month!==lastChartMonth&&month)clientMonth=month;
 lastChartMonth=month;
 if(!months.has(clientMonth))clientMonth=choices[0]||'';
 const select=$('monthly-client-month');
 select.replaceChildren(...choices.map(value=>new Option(monthLabel(value),value)));
 select.value=clientMonth;
 select.disabled=!choices.length;
 const {first,last,clients}=monthlyClientOccurrences(customerHistory,entries,clientMonth);
 const [year,number]=clientMonth.split('-').map(Number);
 const lastDay=new Date(Date.UTC(year,number,0)).getUTCDate();
 const partial=last&&(dayLabel(first).slice(0,2)!=='01'||Number(last.slice(8,10))!==lastDay);
 $('monthly-client-coverage').textContent=customerHistoryError?'Base de triagem indisponível.':
  !customerHistory?'Carregando a base de triagem por cliente…':
  !last?'Sem base de triagem por cliente neste mês.':
  'Triagem disponível de '+dayLabel(first)+' a '+dayLabel(last)+
   (partial?' · Base parcial. O percentual considera as ocorrências até a última data da base.':'.');
 $('monthly-client-table').innerHTML=clients.length?
  '<table><thead><tr><th>Cliente</th><th>Kg triados do mês'+(partial?' (parcial)':'')+'</th><th>Kg de relave por ocorrência no mês</th>'+
  (partial?'<th>Kg de relave no período coberto</th>':'')+
  '<th>'+ (partial?'% no período coberto':'% no mês')+'</th><th>Meta até 2%</th></tr></thead><tbody>'+
  clients.map(row=>'<tr><td>'+esc(row.name)+'</td><td>'+(row.triaged>0?kg(row.triaged):'—')+
   '</td><td>'+kg(row.waste)+'</td>'+(partial?'<td>'+kg(row.coveredWaste)+'</td>':'')+
   '<td>'+(row.rate===null?'—':pct(row.rate))+'</td><td>'+customerOccurrenceStatus(row.rate)+'</td></tr>').join('')+
  '</tbody></table>':'<p class="muted">Nenhum cliente com dados neste mês.</p>';
}

function render(){
 const rows=filtered(), occurrence=scopeKind==='customer', t=totals(rows);
 const customer=entries.filter(r=>kindOf(r)==='customer'&&inPeriod(r.date));
 const checks=weighingChecks(rows), pending=pendingCommands(rows,checks);
 $('scope-internal').setAttribute('aria-pressed',String(!occurrence));
 $('scope-customer').setAttribute('aria-pressed',String(occurrence));
 view.querySelector('#weighing h2').textContent='Conferência de peso · '+(occurrence?'Relave por ocorrência do cliente':'Relave interno GAO');
 const graphPanel=$('graph').closest('section');
 graphPanel.querySelector('h2').textContent='Evolução do '+(occurrence?'relave por ocorrência do cliente':'relave interno GAO');
 graphPanel.querySelector('.key.target').parentElement.innerHTML='<i class="key target"></i>'+(occurrence?'Meta de ocorrência do cliente até 2%':'Meta interna 2,50%');
 const historical=customerHistory?historicalTotals(customerHistory,inPeriod):null;
 const useHistory=historical?.rate!=null||historical?.waste>0;
 const ct=useHistory?historical:totals(customer);
 const company=totals(entries.filter(r=>kindOf(r)==='internal'&&inPeriod(r.date)));
 const companyWaste=occurrence?t.waste:ct.waste;
 const companyRate=company.sorted>0?100*companyWaste/company.sorted:null;
 const customerNote=ct.rate!==null?kg(ct.waste)+' de relave / '+kg(ct.sorted)+' triados · '+(useHistory?'Histórico importado':'Lançamentos do portal'):useHistory?'Histórico sem peso triado no recorte':customerHistoryError?'Histórico indisponível · clique para tentar novamente':customerHistory?'Sem peso triado no recorte':'Carregando histórico…';
 $('scope').textContent=[month&&monthLabel(month),week&&weekLabel(week),day&&dayLabel(day)].filter(Boolean).join(' › ');
 $('back').hidden=!month;
 const kpis=occurrence?[[kinds.customer,t.rate===null?'—':pct(t.rate),customerOccurrenceStatus(t.rate),t.rate===null?'':t.rate<=customerOccurrenceTarget?'good':'bad'],['Peso de relave do cliente',kg(t.waste),'Relave por ocorrência do cliente',''],['Peso triado do cliente',kg(t.sorted),'Base das comandas do cliente',''],['Comandas pendentes do cliente',pending.size,'Relave por ocorrência do cliente','']]:[['Relave interno GAO',t.rate===null?'—':pct(t.rate),t.rate===null?'Sem base':t.rate<=2.5?'Dentro da meta':'Acima da meta',t.rate===null?'':t.rate<=2.5?'good':'bad'],['Peso de relave',kg(t.waste),'Inclui privativos',''],['Peso triado conferido',kg(t.sorted),'Uma vez por comanda',''],['Diferença para a meta',t.rate===null?'—':(t.rate>=2.5?'+':'')+num.format(t.rate-2.5)+' p.p.','Meta de 2,50%',''],['Comandas pendentes',pending.size,'Relave a conferir, pesagem ou tratativa',''],[kinds.customer,ct.rate===null?'—':pct(ct.rate),customerNote+' · '+customerOccurrenceStatus(ct.rate),ct.rate===null?'':ct.rate<=customerOccurrenceTarget?'good':'bad']];
 kpis.push(['Relave por ocorrência do cliente · Visão da empresa',companyRate===null?'—':pct(companyRate),kg(companyWaste)+' de relave do cliente / '+kg(company.sorted)+' triados na empresa · '+customerOccurrenceStatus(companyRate),companyRate===null?'':companyRate<=customerOccurrenceTarget?'good':'bad']);
 $('cards').innerHTML=kpis.map(([label,value,note,cls])=>'<button class="card" data-command-list><span>'+label+'</span><strong class="'+cls+'">'+value+'</strong><small>'+note+'</small></button>').join('');
 view.querySelectorAll('[data-command-list]').forEach((b,i)=>b.onclick=()=>{if(i===kpis.length-1){if(useHistory&&!occurrence)openCustomerHistory(true).finally(()=>{if(host.isConnected)render()});else showList(customer,'Relave por ocorrência do cliente · Visão da empresa');return}if(i===5){if(!customerHistory||useHistory||!customer.length)openCustomerHistory(true).finally(()=>{if(host.isConnected)render()});else showList(customer,kinds.customer);return}if(i===(occurrence?3:4)){showList([...pending.keys()],'Comandas pendentes',pending);return}$('commands').scrollIntoView({behavior:'smooth'})});
 let companyPanel=$('company-occurrences');
 if(!companyPanel){
  companyPanel=document.createElement('section');
  companyPanel.id='company-occurrences';
  companyPanel.className='panel';
  $('relave-rankings').after(companyPanel);
 }
 const clientsInPeriod=new Map();
 for(const row of customer){
  const key=row.clientId||row.client||'Cliente não informado';
  if(!clientsInPeriod.has(key))clientsInPeriod.set(key,{name:row.client||'Cliente não informado',rows:[]});
  clientsInPeriod.get(key).rows.push(row);
 }
 const clientRows=[...clientsInPeriod.values()].map(group=>{
  const total=totals(group.rows);
  const companyPercent=company.sorted>0?pct(100*total.waste/company.sorted):'—';
  return '<tr><td>'+esc(group.name)+'</td><td>'+kg(total.waste)+'</td><td>'+kg(total.sorted)+
   '</td><td>'+(total.rate===null?'—':pct(total.rate))+'</td><td>'+companyPercent+'</td><td>Cliente · '+customerOccurrenceStatus(total.rate)+'<br>Empresa · '+customerOccurrenceStatus(company.sorted>0?100*total.waste/company.sorted:null)+'</td></tr>';
 }).join('');
 companyPanel.innerHTML='<h2>Relave por ocorrência do cliente · Visão da empresa</h2>'+
  '<p class="muted">Kg de ocorrências de cada cliente ÷ '+kg(company.sorted)+
  ' triados do relave interno GAO no período selecionado. Meta de ocorrência do cliente até 2% nas duas visões.</p>'+
  '<div class="table"><table><thead><tr><th>Cliente</th><th>Relave do cliente</th>'+
  '<th>Triado do cliente</th><th>% no cliente</th><th>% na empresa</th><th>Meta até 2%</th></tr></thead>'+
  '<tbody>'+clientRows+'</tbody></table></div>';
 companyPanel.hidden=!customer.length;
 renderMonthlyClients(companyPanel);
 $('chart-filter').hidden=!chartFilter;
 $('chart-filter-label').textContent=chartFilter?(chartFilter.key==='reason'?'Motivo · ':'Tipo de enxoval · ')+chartFilter.label+' · % sobre todo o peso triado':'';
 const base=day?entries.filter(r=>kindOf(r)===scopeKind&&r.date.startsWith(month)&&weekOf(r.date)===week):rows;
 const key=r=>!month?r.date.slice(0,7):!week?weekOf(r.date):r.date;
 const label=!month?monthLabel:!week?weekLabel:dayLabel;
 const ids=[...new Set(base.map(key))].sort();
 groups=ids.map(k=>({id:k,label:label(k),...totals(base.filter(r=>key(r)===k),chartFilter)}));
 const chartWidth=Math.max(450,110+groups.length*62);
 $('graph').style.minWidth=chartWidth+'px';
 $('periods').style.width='max(calc(100% - 110px), '+(chartWidth-110)+'px)';
 $('chart-trend').hidden=!chartFilter||groups.filter(g=>g.rate!==null).length<2;
 $('periods').style.gridTemplateColumns='repeat('+Math.max(1,groups.length)+',minmax(0,1fr))';
 $('periods').replaceChildren(...groups.map(g=>{const b=document.createElement('button');b.textContent=g.label;b.title=kg(g.waste)+' · '+(g.rate===null?'Sem base':pct(g.rate));b.setAttribute('aria-current',String(day===g.id));b.onclick=()=>selectPeriod(g.id);return b}));
 $('hint').textContent=!month?'Clique no mês para abrir as semanas ISO.':!week?'Clique na semana para abrir os dias.':'Clique no dia para conferir as comandas.';
 rankings('reasons',rows.flatMap(r=>r.items||[]),'reason');rankings('types',rows.flatMap(r=>r.items||[]),'type');
 renderCommandRows();
 renderWeighing(checks);
 draw();
}
let commandLimit=150;
function renderCommandRows(){
 const query=$('command-search').value.trim().toLowerCase(), filter=$('audit-filter').value;
 const rows=filtered().filter(r=>[r.command,expeditionNumber(r),receivingNumber(r),r.client].some(value=>String(value||'').toLowerCase().includes(query))&&(!filter||(filter==='audit'?r.audit:r.conflict))).reverse();
 const displayed=rows.slice(0,commandLimit);
 $('command-count').textContent=`Exibindo ${displayed.length} de ${rows.length} comandas.`;
 $('more-commands').hidden=displayed.length===rows.length;
 $('rows').innerHTML=displayed.map(r=>{
  const t=totals([r]);
  const status=r.auditOnly?'Só na auditoria':r.conflict?'Em conciliação':r.archived?'Histórico de expedição':r.items===null?'Pendente':kindOf(r)==='customer'&&sumItems(r.items)>0?weightStatus(r,weighing.get(r)):'Conferida';
  return '<tr><td><button data-id="'+entries.indexOf(r)+'">'+esc(r.command||'Sem comanda')+'</button>'+ (kindOf(r)==='customer'?'<small class="muted" style="display:block">Expedição '+esc(expeditionNumber(r)||'—')+' · Área suja '+esc(receivingNumber(r)||'—')+'</small>':'')+'</td><td>'+dayLabel(r.date)+'</td><td>'+esc(r.client||'—')+'</td><td>'+kinds[kindOf(r)]+'</td><td>'+(r.auditOnly?'—':kg(r.sorted))+'</td><td>'+(r.auditOnly||r.items===null?'—':kg(t.waste))+'</td><td>'+(t.rate===null?'—':pct(t.rate))+'</td><td>'+status+'</td><td>'+ (canEdit?'<button class="bad" data-exclude="'+entries.indexOf(r)+'">Excluir</button>':'—')+'</td></tr>';
 }).join('');
 view.querySelectorAll('#rows [data-id]').forEach(b=>b.onclick=()=>openEntry(entries[Number(b.dataset.id)]));
 view.querySelectorAll('#rows [data-exclude]').forEach(button=>button.onclick=async()=>{
  const record=entries[Number(button.dataset.exclude)];
  if(!record||!confirm('Excluir a comanda '+(record.command||'sem número')+' do relave e dos indicadores?'))return;
  button.disabled=true;
  try{
   await excludeRecord(record);
   const index=entries.indexOf(record);
   if(index>=0)entries.splice(index,1);
   weighing.delete(record);
   render();
   $('command-feedback').textContent='Comanda '+(record.command||'sem número')+' excluída do relave.';
  }catch(error){$('command-feedback').textContent=error.message;button.disabled=false}
 });

}
$('command-search').oninput=$('audit-filter').onchange=()=>{commandLimit=150;renderCommandRows()};
$('more-commands').onclick=()=>{commandLimit+=150;renderCommandRows()};
function selectPeriod(id){if(!month)month=id;else if(!week)week=id;else day=id;render()}
function draw(){
 const canvas=$('graph'),w=canvas.clientWidth,h=canvas.clientHeight,dpr=devicePixelRatio||1;
 canvas.width=w*dpr;canvas.height=h*dpr;
 const c=canvas.getContext('2d');c.scale(dpr,dpr);
 if(!w||!h)return;
 const l=48,right=w-62,top=26,b=h-20,dx=(right-l)/Math.max(1,groups.length);
 const kgMax=Math.max(10,Math.ceil(Math.max(0,...groups.map(g=>g.waste))/40)*40);
 const points=groups.flatMap((g,i)=>g.rate===null?[]:[[i,g.rate]]);
 const fit=chartFilter?regression(points):null;
 const trend=fit?[points[0][0],points.at(-1)[0]].map(i=>[i,fit(i)]):[];
 const pMax=Math.max(4,Math.ceil(Math.max(0,...groups.map(g=>g.rate||0),...trend.map(p=>p[1]))/2)*2);
 const y=(val,max)=>b-val/max*(b-top);
 c.font='11px system-ui';
 for(let i=0;i<=4;i++){const yy=y(i,4);c.strokeStyle='#344659';c.beginPath();c.moveTo(l,yy);c.lineTo(right,yy);c.stroke();c.fillStyle='#acbdd1';c.textAlign='right';c.fillText(Math.round(kgMax*i/4)+' kg',l-5,yy+4);c.textAlign='left';c.fillText(num.format(pMax*i/4)+'%',right+5,yy+4)}
 groups.forEach((g,i)=>{const x=l+(i+.5)*dx,bw=Math.min(48,dx*.55),yy=y(g.waste,kgMax);c.fillStyle=g.id===day?'#9ad8ff':'#59aaf3';c.fillRect(x-bw/2,yy,bw,b-yy)});
 {const target=scopeKind==='internal'?2.5:customerOccurrenceTarget;c.setLineDash([5,4]);c.strokeStyle='#ffc078';c.beginPath();c.moveTo(l,y(target,pMax));c.lineTo(right,y(target,pMax));c.stroke();c.setLineDash([]);}
 if(trend.length){
  c.setLineDash([5,4]);c.strokeStyle='#c6b8ff';c.beginPath();
  c.moveTo(l+(trend[0][0]+.5)*dx,y(trend[0][1],pMax));
  c.lineTo(l+(trend[1][0]+.5)*dx,y(trend[1][1],pMax));
  c.stroke();c.setLineDash([]);
 }
 c.lineWidth=2.5;c.strokeStyle='#52dab4';c.beginPath();let connected=false;
 groups.forEach((g,i)=>{if(g.rate===null){connected=false;return}const x=l+(i+.5)*dx,yy=y(g.rate,pMax);if(connected)c.lineTo(x,yy);else c.moveTo(x,yy);connected=true});c.stroke();
 groups.forEach((g,i)=>{if(g.rate===null)return;c.fillStyle='#52dab4';c.beginPath();c.arc(l+(i+.5)*dx,y(g.rate,pMax),4,0,Math.PI*2);c.fill()});
 c.font='bold 12px system-ui';c.textAlign='center';c.fillStyle='#eef4ff';
 c.strokeStyle='#1a2431';c.lineWidth=3;c.lineJoin='round';
 groups.forEach((g,i)=>{
  if(g.rate===null)return;
  const x=l+(i+.5)*dx, yy=y(g.waste,kgMax)-7;
  c.strokeText(pct(g.rate),x,yy);c.fillText(pct(g.rate),x,yy);
 });
}
function showList(rows,title,statuses){$('detailTitle').textContent=title;$('detailBody').replaceChildren(...rows.map(r=>{const b=document.createElement('button');b.textContent=(r.command||'Sem comanda')+' · '+dayLabel(r.date)+' · '+r.client;const status=statuses?.get(r);if(status)b.textContent+=' · '+status;b.onclick=()=>{if(status&&status!=='Relave a conferir'){$('detail').close();openWeighing(r)}else openEntry(r)};return b}));if(!rows.length)$('detailBody').textContent='Nenhuma comanda neste recorte.';if(!$('detail').open)$('detail').showModal()}
function openEntry(r){
 const t=totals([r]);$('detailTitle').textContent='Comanda '+(r.command||'Sem comanda');
 $('detailBody').innerHTML='<p class="muted">'+kinds[kindOf(r)]+'</p><p>'+esc(r.client||'—')+' · '+dayLabel(r.date)+' · '+kg(r.sorted)+' triados</p><p class="muted">'+(t.rate===null?'Triagem registrada. Falta confirmar se houve relave e registrar o peso, se houver.':kg(t.waste)+' de relave · '+pct(t.rate))+'</p>'+(r.items?.length?'<div class="table"><table><thead><tr><th>Enxoval</th><th>Motivo</th><th>Relave</th></tr></thead><tbody>'+r.items.map(i=>'<tr><td>'+esc(i.type)+'</td><td>'+esc(i.reason)+'</td><td>'+kg(i.weight)+'</td></tr>').join('')+'</tbody></table></div>':'');
 if(r.trashKg!=null){const info=document.createElement('p');info.textContent='Lixo · '+kg(r.trashKg);$('detailBody').append(info)}
 const check=weighing.get(r);
 if(kindOf(r)==='customer'){
  const trace=document.createElement('p');
  trace.textContent='Cliente '+r.command+' · Expedição '+(expeditionNumber(r)||'—')+' · Área suja '+(receivingNumber(r)||'—');
  $('detailBody').append(trace);
  const handling=document.createElement('p');
  handling.textContent='GAO QUALIDADE · ENTRADA QUALIDADE '+(r.qualityWeight==null?'—':kg(r.qualityWeight))+(r.qualityVolume?' · Volume '+r.qualityVolume:'')+' · Devolução à Produção '+(r.returnedWeight==null?'—':kg(r.returnedWeight));
  $('detailBody').append(handling);
 }
 if(check?.receivingCommand&&kindOf(r)!=='customer'){const info=document.createElement('p');info.textContent='Comanda da área suja · '+check.receivingCommand;$('detailBody').append(info)}
 if(r.archived){
  const box=document.createElement('section');box.className='panel';
  const caption=document.createElement('h2');caption.textContent=r.conflict?'Conciliação de expedição':r.auditOnly?'Registro exclusivo da auditoria':'Origem dos pesos';
  box.append(caption);
  const formatValue=v=>v==null?'—':kg(v);
  const sources=[['Expedição (CSV)',r.auditOnly?null:sumItems(r.items)],['Qualidade (HTML)',r.audit?.quality],['Expedição (HTML)',r.audit?.expedition],['Conferência (HTML)',r.audit?.receiving]];
  for(const [label,value] of sources){const p=document.createElement('p');p.textContent=label+' · '+formatValue(value);box.append(p)}
  if(r.audit?.reasons?.length){const p=document.createElement('p');p.textContent='Motivos na auditoria · '+r.audit.reasons.join(', ');box.append(p)}
  const note=document.createElement('p');note.className='muted';note.textContent=r.auditOnly?'Sem correspondente no CSV. Registro fora dos indicadores.':'O indicador usa os kg triados e os kg de relave do CSV.';
  box.append(note);$('detailBody').append(box);
  if(r.auditOnly)$('detailBody').querySelectorAll('p')[2].textContent='Sem peso triado no CSV.';
 }
 if(r.canWeigh&&canEdit){
  const edit=document.createElement('button');edit.type='button';edit.textContent='Editar lançamento';
  edit.onclick=()=>{$('detail').close();openLaunch(r)};$('detailBody').append(edit);
 }
 if(!$('detail').open)$('detail').showModal()
}
function formItems(){return [...$('items').children].map(row=>({type:row.querySelector('.type').value,reason:row.querySelector('.reason').value,weight:Number(row.querySelector('input').value)}))}
function updateTotal(){const w=sumItems(formItems()),s=Number($('form').elements.sorted.value);$('total').textContent=kg(w)+' de relave'+(s?' · '+pct(100*w/s):'')}
const options=names=>names.map(n=>'<option>'+n+'</option>').join('');
function addItem(item){const row=document.createElement('div');row.className='item';row.innerHTML='<label>Enxoval<select class="type">'+options(typeNames)+'</select></label><label>Motivo<select class="reason">'+options(reasonNames)+'</select></label><label>Kg<input required type="number" min=".01" step=".01"></label><button type="button">Remover</button>';if(item?.type){row.querySelector('.type').value=item.type;row.querySelector('.reason').value=item.reason;row.querySelector('input').value=item.weight}
row.querySelector('button').onclick=()=>{row.remove();updateTotal()};$('items').append(row);updateTotal()}
$('graph').onclick=e=>{const x=e.clientX-$('graph').getBoundingClientRect().left;const g=groups[Math.floor((x-48)*groups.length/($('graph').clientWidth-94))];if(g)selectPeriod(g.id)};
$('all').onclick=()=>{month=week=day='';render()};
$('back').onclick=()=>{if(day)day='';else if(week)week='';else month='';render()};
let editing;
let clients=[];
let clientRequest;
async function populateClients(select, current=''){
 select.replaceChildren(new Option('Carregando clientes…',''));
 try{
  clientRequest??=loadClients().then(rows=>{clients=rows;return rows}).catch(error=>{clientRequest=null;throw error});
  await clientRequest;
  select.replaceChildren(new Option(clients.length?'Selecione o cliente':'Nenhum cliente disponível',''));
  for(const client of clients)select.add(new Option(client.name,client.id));
  select.value=clients.some(client=>client.id===current)?current:'';
 }catch{
  select.replaceChildren(new Option('Cadastro de clientes indisponível',''));
 }
}
function updateClientFields(){
 const form=$('form'), customer=form.elements.kind.value==='customer';
 $('customer-details').hidden=!customer;
 form.elements.clientId.required=customer;
 form.querySelector('input[name="id"]').closest('label').firstChild.textContent=customer?'Comanda do cliente':'Comanda';
 form.elements.receivingCommand.disabled=Boolean(editing?.weighing);
 form.elements.expeditionCommand.required=customer&&Boolean(editing?.weighing);
}
$('form').elements.kind.onchange=updateClientFields;
$('reload-clients').onclick=()=>{
 const select=$('form').elements.clientId;
 clientRequest=null;
 void populateClients(select,select.value||editing?.clientId);
};
function openLaunch(record){
 if(record&&!canEdit)return;
 editing=record;
 const form=$('form');form.reset();form.elements.kind.disabled=Boolean(record?.weighing);$('items').replaceChildren();$('error').textContent='';
 $('launch').querySelector('h2').textContent=record?'Editar lançamento':'Novo lançamento';
 form.elements.date.value=record?.date||new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
 if(!record)form.elements.kind.value=scopeKind;
 if(record){
  form.elements.id.value=record.command;form.elements.kind.value=kindOf(record);
  form.elements.sorted.value=record.sorted;form.elements.trashKg.value=record.trashKg??'';form.elements.responsible.value=record.responsible;
  form.elements.issue.value=record.issue||'';form.elements.action.value=record.action||'';
  form.elements.expeditionCommand.value=kindOf(record)==='customer'?expeditionNumber(record):'';
  form.elements.receivingCommand.value=receivingNumber(record);
  for(const field of ['qualityVolume','qualityWeight','returnedWeight'])form.elements[field].value=record[field]??'';
  record.items.forEach(addItem);updateTotal();
 }else addItem();
 const previousClient=$('previous-client');
 previousClient.hidden=!record?.client;
 previousClient.textContent=record?.client?'Cliente no registro: '+record.client:'';
 updateClientFields();
 void populateClients(form.elements.clientId,record?.clientId);
 $('launch').showModal();
}
$('new').onclick=()=>openLaunch();
for(const kind of ['internal','customer'])$('scope-'+kind).onclick=()=>{
 if(scopeKind===kind)return;
 chartFilter=null;
 scopeKind=kind;
 $('weighFilter').value='';
 $('audit-filter').value='';
 $('command-search').value='';
 render();
};
$('add').onclick=addItem;$('form').oninput=updateTotal;
async function commit(form,errorId,action){
 const button=form.querySelector('button[type=submit],.primary');
 button.disabled=true;
 $(errorId).textContent='';
 try{await action()}catch(error){$(errorId).textContent=error.message}
 finally{button.disabled=false}
}
$('legacy').onclick=openHistory;
$('daily-report').onclick=()=>{
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
 const input=$('report-form').elements.closingDate;
 input.value=day||today;input.max=today;
 const type=$('report-form').elements.reportType;
 type.value=scopeKind;type.onchange();
 $('report-error').textContent='';$('report-dialog').showModal();
};
$('report-form').elements.reportType.onchange=()=>{
 const form=$('report-form');
 const customer=form.elements.reportType.value==='customer';
 $('report-client').hidden=!customer;
 form.elements.reportClientId.required=customer;
 if(customer)void populateClients(form.elements.reportClientId,form.elements.reportClientId.value);
};
$('report-form').onsubmit=event=>{
 event.preventDefault();
 const date=event.currentTarget.elements.closingDate.value;
 const logo=getComputedStyle(document.documentElement).getPropertyValue('--liquid-logo').match(/data:image\/(?:png|webp);base64,[A-Za-z0-9+/=]+/)?.[0];
 try{
  const form=event.currentTarget;
  const customer=form.elements.reportType.value==='customer';
  const selected=customer?clients.find(row=>row.id===form.elements.reportClientId.value):null;
  if(customer&&!selected)throw Error('Selecione um cliente cadastrado.');
  const report=renderDailyReport(entries.map(r=>({...r,weighing:weighing.get(r)})),date,logo,selected);
  openReport(report,'gao-relave-'+(customer?'cliente-':'')+date);
  $('report-dialog').close();
 }catch(error){$('report-error').textContent=error.message}
};
$('form').onsubmit=async e=>{
 e.preventDefault();
 const form=e.currentTarget,f=new FormData(form),command=f.get('id').trim(),responsible=f.get('responsible').trim(),date=f.get('date'),kind=form.elements.kind.value,sorted=Number(f.get('sorted')),items=formItems();
 const trash=f.get('trashKg'),trashKg=trash===''?null:Number(trash);
 if(trashKg!==null&&(!Number.isFinite(trashKg)||trashKg<0)){
  $('error').textContent='Informe um peso de lixo válido em kg.';return;
 }
 const occurrence={};
 if(kind==='customer'){
  for(const field of ['expeditionCommand','receivingCommand','qualityVolume'])occurrence[field]=form.elements[field].value.trim();
  for(const field of ['qualityWeight','returnedWeight']){
   const value=form.elements[field].value;
   if(value!==''&&(!Number.isFinite(Number(value))||Number(value)<0)){$('error').textContent='Informe pesos válidos para a Qualidade e a devolução.';return;}
   occurrence[field]=value===''?null:Number(value);
  }
 }
 const selected=clients.find(row=>row.id===f.get('clientId'));
 const client=selected?.name||editing?.client||'';
 if(!command||!responsible||!Object.hasOwn(kinds,kind)||(kind==='customer'&&!selected)||entries.some(r=>r!==editing&&kindOf(r)===kind&&r.date===date&&r.command?.toLowerCase()===command.toLowerCase())||sumItems(items)>sorted+.00001){
  $('error').textContent='Confira os campos, os pesos e a comanda. Para ocorrência do cliente, selecione um cliente cadastrado. Use uma comanda por data e tipo.';return;
 }
 await commit(form,'error',async()=>{
  const record=await saveRecord({...occurrence,command,date,kind,client,clientId:selected?.id||editing?.clientId||null,issue:kind==='customer'?f.get('issue').trim():'',action:kind==='customer'?f.get('action').trim():'',responsible,sorted,trashKg,items},editing?.key);
  if(editing){entries.splice(entries.indexOf(editing),1,record);weighing.delete(editing)}else entries.push(record);
  if(record.weighing)weighing.set(record,record.weighing);$('launch').close();if(scopeKind!==kind)chartFilter=null;scopeKind=kind;month=date.slice(0,7);week=weekOf(date);day=date;render();openEntry(record);
 });
};
view.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
const observer=new ResizeObserver(draw);observer.observe($('graph'));render();loadCustomerHistory().catch(()=>{}).finally(()=>{if(host.isConnected)render()});return ()=>observer.disconnect();

}
