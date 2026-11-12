import { renderDailyReport } from './relave-daily-report-v1.mjs?v=1';

const layout="<style>\n*{box-sizing:border-box}:host{display:block;margin:0;background:#10151e;color:#eef4ff;font:15px system-ui,sans-serif;line-height:1.5}header{background:#19222f;border-bottom:1px solid #304054;padding:16px max(20px,calc((100vw - 1180px)/2));display:flex;justify-content:space-between;align-items:center;gap:16px}.brand{color:#74caff;font-weight:850;letter-spacing:.05em}small,.muted{color:#acbdd1}main{padding:16px 12px 28px}h1,h2,p{margin:0}h1{font-size:clamp(32px,5vw,48px);line-height:1.1;margin:5px 0 10px}h2{font-size:18px}.top,.controls,.legend{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.top{justify-content:space-between;margin-bottom:22px}.panel,.card{background:#1a2431;border:1px solid #324255;border-radius:13px;padding:16px}.panel{margin-top:14px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.card{text-align:left;color:inherit;font:inherit}.card strong{display:block;font-size:27px}.card span{color:#aac0d7}.bad{color:#ffc078}.good{color:#65dfbd}button,select,input{font:inherit;color:inherit;border:1px solid #435770;border-radius:8px;padding:8px 12px;background:#131c28}button{cursor:pointer}button:hover{border-color:#83c8ff}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #78c7ff;outline-offset:2px}.primary{background:#8ad3ff;color:#0c2034;font-weight:750;border-color:#8ad3ff}.legend{margin:8px 0;color:#c4d1df;font-size:13px}.key{display:inline-block;width:16px;border-top:4px solid #59aaf3;margin-right:5px;vertical-align:middle}.rate{border-color:#52dab4}.target{border-top:2px dashed #ffc078}.chart{overflow:auto}.chart canvas{display:block;width:100%;min-width:450px;height:228px}.periods{display:grid;gap:5px;min-width:450px;margin-left:48px;margin-right:46px}.periods button{padding:6px 3px;font-size:12px}.split{display:grid;grid-template-columns:1fr 1fr;gap:14px}.rank{display:grid;grid-template-columns:minmax(90px,1fr) 1fr 85px;gap:8px;align-items:center;margin-top:10px}.rank meter{width:100%;accent-color:#59aaf3}.table{overflow:auto}table{width:100%;border-collapse:collapse;white-space:nowrap}th,td{text-align:left;padding:10px;border-bottom:1px solid #334356}th{color:#adc5df;font-size:13px}dialog{width:min(780px,calc(100% - 24px));max-height:90vh;overflow:auto;background:#1a2431;color:#eef4ff;border:1px solid #4b647f;border-radius:14px;padding:20px}dialog::backdrop{background:#08101acf}label{display:grid;gap:4px;color:#c2d2e6}input,select{min-width:0;width:100%}.fields,.item{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}.item{align-items:end;grid-template-columns:1fr 1fr 100px auto}.form-actions{margin-top:16px}output{display:block;color:#8fe2ca;margin:10px 0}#hint{margin-top:9px}button[aria-current=true]{background:#254565;border-color:#78c7ff} @media(max-width:650px){.split{grid-template-columns:1fr}.fields,.item{grid-template-columns:1fr 1fr}.card strong{font-size:23px}}\n</style><main>\n<div class=\"top\"><div><small>Produção / Relave</small><h1>Relave</h1><p class=\"muted\">Acompanhe a meta e confira as comandas que compõem o indicador.</p></div><button id=\"daily-report\">Relatório diário</button><button id=\"legacy\">Histórico e edição</button><button id=\"new\" class=\"primary\">+ Novo lançamento</button></div>\n<div class=\"controls\"><button id=\"all\">Todos os meses</button><button id=\"back\" hidden>Voltar um nível</button><strong id=\"scope\"></strong></div>\n<p id=\"archive-error\" role=\"status\" hidden>O histórico de expedição está indisponível. Indicadores e relatórios podem estar incompletos.</p><section id=\"cards\" class=\"cards panel\" aria-label=\"Indicadores\"></section>\n<section class=\"panel\"><h2>Evolução do relave interno GAO</h2><div class=\"legend\"><span><i class=\"key\"></i>Relave (kg)</span><span><i class=\"key rate\"></i>Relave (%)</span><span><i class=\"key target\"></i>Meta 2,50%</span></div><div class=\"chart\"><canvas id=\"graph\" role=\"img\" aria-label=\"Barras de kg de relave e linha do percentual por período\"></canvas><div id=\"periods\" class=\"periods\"></div></div><p id=\"hint\" class=\"muted\"></p></section>\n<div class=\"split\"><section class=\"panel\"><h2>Motivos por peso</h2><div id=\"reasons\"></div></section><section class=\"panel\"><h2>Tipos de enxoval por peso</h2><div id=\"types\"></div></section></div>\n<section class=\"panel\" id=\"weighing\"><h2>Conferência de peso · Relave interno GAO</h2>\n<p class=\"muted\">Compare o peso líquido da expedição com o peso líquido recebido na área suja, na mesma comanda.</p>\n<div id=\"weighSummary\" class=\"cards\" style=\"margin:12px 0\"></div>\n<div class=\"controls\"><label>Situação da pesagem<select id=\"weighFilter\"><option value=\"\">Todas</option><option>Aguardando pesagem</option><option>Em tratativa</option><option>Tratada</option><option>Conferida</option></select></label></div>\n<div class=\"table\"><table><thead><tr><th>Comanda</th><th>Data</th><th>Expedição</th><th>Área suja</th><th>Diferença</th><th>Situação</th><th>Ação</th></tr></thead><tbody id=\"weighRows\"></tbody></table></div></section>\n<section class=\"panel\" id=\"commands\"><h2>Comandas no recorte</h2><div class=\"controls\"><label>Buscar comanda<input id=\"command-search\" type=\"search\"></label><label>Situação da auditoria<select id=\"audit-filter\"><option value=\"\">Todas</option><option value=\"conflict\">Em conciliação</option><option value=\"audit\">Com auditoria</option></select></label></div><p id=\"command-count\" class=\"muted\"></p><div class=\"table\"><table><thead><tr><th>Comanda</th><th>Data</th><th>Cliente</th><th>Tipo de relave</th><th>Triado</th><th>Relave</th><th>%</th><th>Situação</th></tr></thead><tbody id=\"rows\"></tbody></table></div><button id=\"more-commands\" hidden>Mostrar mais comandas</button></section>\n</main>\n<dialog id=\"detail\"><div class=\"top\"><h2 id=\"detailTitle\"></h2><button data-close=\"detail\">Fechar</button></div><div id=\"detailBody\"></div></dialog>\n<dialog id=\"launch\"><div class=\"top\"><h2>Novo lançamento</h2><button data-close=\"launch\">Fechar</button></div><form id=\"form\"><p class=\"muted\">Informe o peso triado uma vez e adicione os pesos de relave por tipo e motivo.</p><div class=\"fields\"><label>Tipo de relave<select name=\"kind\" required><option value=\"\">Selecione o tipo</option><option value=\"internal\">Relave interno GAO</option><option value=\"customer\">Relave por ocorrência do cliente</option></select></label><label>Comanda<input name=\"id\" required maxlength=\"32\"></label><label>Data<input name=\"date\" required type=\"date\"></label><label>Cliente<input name=\"client\" maxlength=\"60\"></label><label>Responsável<input name=\"responsible\" required maxlength=\"80\"></label><label>Kg triados<input name=\"sorted\" required type=\"number\" min=\".01\" step=\".01\"></label></div><div id=\"items\"></div><button type=\"button\" id=\"add\">+ Adicionar ocorrência</button><output id=\"total\"></output><p class=\"muted\">Para registrar uma conferência sem relave, salve sem ocorrências.</p><div class=\"form-actions\"><button class=\"primary\">Salvar lançamento</button></div><p id=\"error\" role=\"alert\" class=\"bad\"></p></form></dialog>\n<dialog id=\"weighDialog\"><div class=\"top\"><h2>Conferência de peso</h2><button data-close=\"weighDialog\">Fechar</button></div>\n<form id=\"weighForm\"><p id=\"weighInfo\"></p>\n<div class=\"fields\"><label>Kg líquidos na área suja<input name=\"received\" required type=\"number\" min=\"0\" step=\".01\"></label><label>Responsável<input name=\"owner\" required maxlength=\"80\"></label></div>\n<output id=\"weighDelta\"></output>\n<label>Prazo da tratativa<input name=\"dueDate\" type=\"date\"></label><label>Causa apurada e ação da Qualidade<input name=\"action\" maxlength=\"250\" placeholder=\"Ex.: tara incorreta. Repesagem acompanhada.\"></label>\n<label style=\"display:flex;align-items:center;margin-top:12px\"><input name=\"resolved\" type=\"checkbox\" style=\"width:auto\"> Concluir tratativa</label>\n<div class=\"form-actions\"><button class=\"primary\">Salvar conferência</button></div><p id=\"weighError\" role=\"alert\" class=\"bad\"></p></form></dialog>\n<dialog id=\"report-dialog\"><div class=\"top\"><h2>Relatório diário de relave</h2><button data-close=\"report-dialog\">Fechar</button></div><form id=\"report-form\"><label>Data de fechamento<input type=\"date\" name=\"closingDate\" required></label><p id=\"report-error\" role=\"alert\"></p><button class=\"primary\" type=\"submit\">Abrir relatório</button></form></dialog>";

export function mountRelave(host,{records,archiveError,saveRecord,saveWeighing,openHistory}){
const view=host.attachShadow({mode:'open'});
view.innerHTML=layout;

const $=id=>view.getElementById(id);
const num=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const kg=n=>num.format(n)+' kg';
const pct=n=>num.format(n)+'%';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dayLabel=d=>d.slice(8,10)+'/'+d.slice(5,7);
const dateOf=d=>new Date(d+'T12:00:00Z');
function weekOf(d){const dt=dateOf(d);dt.setUTCDate(dt.getUTCDate()+4-(dt.getUTCDay()||7));const y=dt.getUTCFullYear();const week=Math.ceil(((dt-Date.UTC(y,0,1))/86400000+1)/7);return y+'-S'+String(week).padStart(2,'0')}
const typeNames=['Lençol','Cirúrgico','Privativo','Outros'],reasonNames=['Sangue','Cola / fita','Amarelado','Óleo','Passadoria','Resíduo','Rasgado','Limpo','Permanente','Tinta','Nó','Outros'];
const entries=records;
$('archive-error').hidden=!archiveError;
const kinds={internal:'Relave interno GAO',customer:'Relave por ocorrência do cliente'};
const kindOf=r=>r.kind||'internal';
let month='',week='',day='', groups=[];
const sumItems=items=>(items||[]).reduce((s,x)=>s+x.weight,0);
function totals(rows){const done=rows.filter(r=>!r.auditOnly&&r.items!==null);const sorted=done.reduce((s,r)=>s+r.sorted,0);const waste=done.reduce((s,r)=>s+sumItems(r.items),0);return {sorted,waste,rate:sorted?100*waste/sorted:null,pending:rows.filter(r=>r.items===null&&!r.auditOnly).length}}
const monthLabel=m=>new Intl.DateTimeFormat('pt-BR',{month:'short',year:'numeric',timeZone:'UTC'}).format(dateOf(m+'-01'));
const weekLabel=w=>w.slice(5)+'/'+w.slice(0,4);
const filtered=()=>entries.filter(r=>(!month||r.date.startsWith(month))&&(!week||weekOf(r.date)===week)&&(!day||r.date===day));
function rankings(id,items,key){const agg=new Map();items.forEach(x=>agg.set(x[key],(agg.get(x[key])||0)+x.weight));const sorted=[...agg].sort((a,b)=>b[1]-a[1]);$(id).innerHTML=sorted.map(([label,v])=>'<div class="rank"><span>'+esc(label)+'</span><meter aria-label="'+esc(label)+'" max="'+sorted[0][1]+'" value="'+v+'"></meter><strong>'+kg(v)+'</strong></div>').join('')||'<p class="muted">Nenhuma ocorrência no recorte.</p>'}
const weighing=new Map(entries.filter(r=>r.weighing).map(r=>[r,r.weighing]));
function weightDelta(r,received){return Math.round(received*100)-Math.round(sumItems(r.items)*100)}
function weightStatus(r,check){return !check?'Aguardando pesagem':!weightDelta(r,check.received)?'Conferida':check.resolved?'Tratada':'Em tratativa'}
const signedKg=cents=>(cents>0?'+':'')+kg(cents/100);
function renderWeighing(rows){
 const checks=rows.filter(r=>r.canWeigh&&r.command&&sumItems(r.items)>0).map(r=>({r,check:weighing.get(r),status:weightStatus(r,weighing.get(r))}));
 $('weighSummary').innerHTML=['Aguardando pesagem','Em tratativa','Tratada'].map(status=>'<button class="card" data-weight-filter="'+status+'"><span>'+status+'</span><strong>'+checks.filter(x=>x.status===status).length+'</strong></button>').join('');
 $('weighSummary').querySelectorAll('button').forEach(b=>b.onclick=()=>{$('weighFilter').value=b.dataset.weightFilter;render()});
 const filter=$('weighFilter').value;
 const visible=checks.filter(x=>!filter||x.status===filter);
 $('weighRows').innerHTML=visible.map(({r,check,status})=>'<tr><td><button data-entry="'+entries.indexOf(r)+'">'+esc(r.command||'Sem comanda')+'</button></td><td>'+dayLabel(r.date)+'</td><td>'+kg(sumItems(r.items))+'</td><td>'+(check?kg(check.received):'—')+'</td><td class="'+(check&&weightDelta(r,check.received)?'bad':'')+'">'+(check?signedKg(weightDelta(r,check.received)):'—')+'</td><td>'+status+'</td><td><button data-weigh="'+entries.indexOf(r)+'">'+(check?'Revisar':'Registrar peso')+'</button></td></tr>').join('')||'<tr><td colspan="7">Nenhuma comanda nesta situação.</td></tr>';
 $('weighRows').querySelectorAll('[data-entry]').forEach(b=>b.onclick=()=>openEntry(entries[Number(b.dataset.entry)]));
 $('weighRows').querySelectorAll('[data-weigh]').forEach(b=>b.onclick=()=>openWeighing(entries[Number(b.dataset.weigh)]));
}
let activeWeighing;
function updateWeighDelta(){
 const received=$('weighForm').elements.received.value;
 if(received===''){$('weighDelta').textContent='';return}
 const delta=weightDelta(activeWeighing,Number(received)), sent=sumItems(activeWeighing.items);
 $('weighDelta').textContent='Diferença (área suja − expedição) '+signedKg(delta)+' · '+pct(delta/sent);
}
function openWeighing(r){
 activeWeighing=r;
 const check=weighing.get(r), form=$('weighForm');
 $('weighInfo').textContent=r.command+' · '+kg(sumItems(r.items))+' líquidos na expedição';
 form.elements.received.value=check?num.format(check.received).replaceAll('.','').replace(',','.'):'';form.elements.owner.value=check?.owner||'';form.elements.dueDate.value=check?.dueDate||'';form.elements.action.value=check?.action||'';form.elements.resolved.checked=Boolean(check?.resolved);$('weighError').textContent='';updateWeighDelta();$('weighDialog').showModal();
}
$('weighFilter').onchange=render;
$('weighForm').oninput=updateWeighDelta;
$('weighForm').onsubmit=async e=>{
 e.preventDefault();
 const form=e.currentTarget.elements,received=Number(form.received.value),owner=form.owner.value.trim(),action=form.action.value.trim();
 const resolved=form.resolved.checked&&weightDelta(activeWeighing,received)!==0;
 if(!owner||(resolved&&!action)){$('weighError').textContent='Informe o responsável e descreva a causa e a ação antes de concluir a divergência.';return}
 const record=activeWeighing, previous=weighing.get(record);
 const check={received,owner,action,resolved,dueDate:form.dueDate.value,weighedAt:previous?.weighedAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 await commit(e.currentTarget,'weighError',async()=>{await saveWeighing(record,check);weighing.set(record,check);$('weighDialog').close();render()});
};
function render(){
 const rows=filtered(), internal=rows.filter(r=>kindOf(r)==='internal'), customer=rows.filter(r=>kindOf(r)==='customer'), t=totals(internal), ct=totals(customer);
 $('scope').textContent=[month&&monthLabel(month),week&&weekLabel(week),day&&dayLabel(day)].filter(Boolean).join(' › ');
 $('back').hidden=!month;
 const kpis=[['Relave interno GAO',t.rate===null?'—':pct(t.rate),t.rate===null?'Sem base':t.rate<=2.5?'Dentro da meta':'Acima da meta',t.rate===null?'':t.rate<=2.5?'good':'bad'],['Peso de relave',kg(t.waste),'Inclui privativos',''],['Peso triado conferido',kg(t.sorted),'Uma vez por comanda',''],['Diferença para a meta',t.rate===null?'—':(t.rate>=2.5?'+':'')+num.format(t.rate-2.5)+' p.p.','Meta de 2,50%',''],['Comandas pendentes',rows.filter(r=>r.items===null).length,'Triagem registrada, relave a conferir',''],[kinds.customer,ct.rate===null?'—':pct(ct.rate),ct.rate===null?'Sem peso triado conferido':kg(ct.waste)+' de relave / '+kg(ct.sorted)+' triados','']];
 $('cards').innerHTML=kpis.map(([label,value,note,cls])=>'<button class="card" data-command-list><span>'+label+'</span><strong class="'+cls+'">'+value+'</strong><small>'+note+'</small></button>').join('');
 view.querySelectorAll('[data-command-list]').forEach((b,i)=>b.onclick=()=>{if(i===5){showList(customer,kinds.customer);return}if(i===4){showList(rows.filter(r=>r.items===null),'Comandas pendentes');return}$('commands').scrollIntoView({behavior:'smooth'})});
 const base=day?entries.filter(r=>r.date.startsWith(month)&&weekOf(r.date)===week):rows;
 const key=r=>!month?r.date.slice(0,7):!week?weekOf(r.date):r.date;
 const label=!month?monthLabel:!week?weekLabel:dayLabel;
 const ids=[...new Set(base.map(key))].sort();
 groups=ids.map(k=>({id:k,label:label(k),...totals(base.filter(r=>key(r)===k&&kindOf(r)==='internal'))}));
 $('periods').style.gridTemplateColumns='repeat('+Math.max(1,groups.length)+',minmax(0,1fr))';
 $('periods').replaceChildren(...groups.map(g=>{const b=document.createElement('button');b.textContent=g.label;b.title=kg(g.waste)+' · '+(g.rate===null?'Sem base':pct(g.rate));b.setAttribute('aria-current',String(day===g.id));b.onclick=()=>selectPeriod(g.id);return b}));
 $('hint').textContent=!month?'Clique no mês para abrir as semanas ISO.':!week?'Clique na semana para abrir os dias.':'Clique no dia para conferir as comandas.';
 rankings('reasons',internal.flatMap(r=>r.items||[]),'reason');rankings('types',internal.flatMap(r=>r.items||[]),'type');
 renderCommandRows();
 renderWeighing(internal);
 draw();
}
let commandLimit=150;
function renderCommandRows(){
 const query=$('command-search').value.trim().toLowerCase(), filter=$('audit-filter').value;
 const rows=filtered().filter(r=>r.command.toLowerCase().includes(query)&&(!filter||(filter==='audit'?r.audit:r.conflict))).reverse();
 const displayed=rows.slice(0,commandLimit);
 $('command-count').textContent=`Exibindo ${displayed.length} de ${rows.length} comandas.`;
 $('more-commands').hidden=displayed.length===rows.length;
 $('rows').innerHTML=displayed.map(r=>{
  const t=totals([r]);
  const status=r.auditOnly?'Só na auditoria':r.conflict?'Em conciliação':r.archived?'Histórico de expedição':r.items===null?'Pendente':'Conferida';
  return '<tr><td><button data-id="'+entries.indexOf(r)+'">'+esc(r.command||'Sem comanda')+'</button></td><td>'+dayLabel(r.date)+'</td><td>'+esc(r.client||'—')+'</td><td>'+kinds[kindOf(r)]+'</td><td>'+(r.auditOnly?'—':kg(r.sorted))+'</td><td>'+(r.auditOnly||r.items===null?'—':kg(t.waste))+'</td><td>'+(t.rate===null?'—':pct(t.rate))+'</td><td>'+status+'</td></tr>';
 }).join('');
 view.querySelectorAll('#rows [data-id]').forEach(b=>b.onclick=()=>openEntry(entries[Number(b.dataset.id)]));
}
$('command-search').oninput=$('audit-filter').onchange=()=>{commandLimit=150;renderCommandRows()};
$('more-commands').onclick=()=>{commandLimit+=150;renderCommandRows()};
function selectPeriod(id){if(!month)month=id;else if(!week)week=id;else day=id;render()}
function draw(){
 const canvas=$('graph'),w=canvas.clientWidth,h=canvas.clientHeight,dpr=devicePixelRatio||1;
 canvas.width=w*dpr;canvas.height=h*dpr;
 const c=canvas.getContext('2d');c.scale(dpr,dpr);
 const l=48,right=w-46,top=18,b=h-20,dx=(right-l)/Math.max(1,groups.length);
 const kgMax=Math.max(10,Math.ceil(Math.max(0,...groups.map(g=>g.waste))/40)*40);
 const pMax=Math.max(4,Math.ceil(Math.max(0,...groups.map(g=>g.rate||0))/2)*2);
 const y=(val,max)=>b-val/max*(b-top);
 c.font='11px system-ui';
 for(let i=0;i<=4;i++){const yy=y(i,4);c.strokeStyle='#344659';c.beginPath();c.moveTo(l,yy);c.lineTo(right,yy);c.stroke();c.fillStyle='#acbdd1';c.textAlign='right';c.fillText(Math.round(kgMax*i/4)+' kg',l-5,yy+4);c.textAlign='left';c.fillText(num.format(pMax*i/4)+'%',right+5,yy+4)}
 groups.forEach((g,i)=>{const x=l+(i+.5)*dx,bw=Math.min(48,dx*.55),yy=y(g.waste,kgMax);c.fillStyle=g.id===day?'#9ad8ff':'#59aaf3';c.fillRect(x-bw/2,yy,bw,b-yy)});
 c.setLineDash([5,4]);c.strokeStyle='#ffc078';c.beginPath();c.moveTo(l,y(2.5,pMax));c.lineTo(right,y(2.5,pMax));c.stroke();c.setLineDash([]);
 c.lineWidth=2.5;c.strokeStyle='#52dab4';c.beginPath();let connected=false;
 groups.forEach((g,i)=>{if(g.rate===null){connected=false;return}const x=l+(i+.5)*dx,yy=y(g.rate,pMax);if(connected)c.lineTo(x,yy);else c.moveTo(x,yy);connected=true});c.stroke();
 groups.forEach((g,i)=>{if(g.rate===null)return;c.fillStyle='#52dab4';c.beginPath();c.arc(l+(i+.5)*dx,y(g.rate,pMax),4,0,Math.PI*2);c.fill()});
}
function showList(rows,title){$('detailTitle').textContent=title;$('detailBody').replaceChildren(...rows.map(r=>{const b=document.createElement('button');b.textContent=(r.command||'Sem comanda')+' · '+dayLabel(r.date)+' · '+r.client;b.onclick=()=>openEntry(r);return b}));if(!rows.length)$('detailBody').textContent='Nenhuma comanda neste recorte.';if(!$('detail').open)$('detail').showModal()}
function openEntry(r){
 const t=totals([r]);$('detailTitle').textContent='Comanda '+(r.command||'Sem comanda');
 $('detailBody').innerHTML='<p class="muted">'+kinds[kindOf(r)]+'</p><p>'+esc(r.client||'—')+' · '+dayLabel(r.date)+' · '+kg(r.sorted)+' triados</p><p class="muted">'+(t.rate===null?'Triagem registrada. Falta confirmar se houve relave e registrar o peso, se houver.':kg(t.waste)+' de relave · '+pct(t.rate))+'</p>'+(r.items?.length?'<div class="table"><table><thead><tr><th>Enxoval</th><th>Motivo</th><th>Relave</th></tr></thead><tbody>'+r.items.map(i=>'<tr><td>'+esc(i.type)+'</td><td>'+esc(i.reason)+'</td><td>'+kg(i.weight)+'</td></tr>').join('')+'</tbody></table></div>':'');
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
 if(r.canWeigh){
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
function openLaunch(record){
 editing=record;
 const form=$('form');form.reset();$('items').replaceChildren();$('error').textContent='';
 $('launch').querySelector('h2').textContent=record?'Editar lançamento':'Novo lançamento';
 form.elements.date.value=record?.date||new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
 if(record){
  form.elements.id.value=record.command;form.elements.client.value=record.client;form.elements.kind.value=kindOf(record);
  form.elements.sorted.value=record.sorted;form.elements.responsible.value=record.responsible;
  record.items.forEach(addItem);updateTotal();
 }else addItem();
 $('launch').showModal();
}
$('new').onclick=()=>openLaunch();
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
 $('report-error').textContent='';$('report-dialog').showModal();
};
$('report-form').onsubmit=event=>{
 event.preventDefault();
 const date=event.currentTarget.elements.closingDate.value;
 const logo=getComputedStyle(document.documentElement).getPropertyValue('--liquid-logo').match(/data:image\/(?:png|webp);base64,[A-Za-z0-9+/=]+/)?.[0];
 try{
  const report=renderDailyReport(entries.map(r=>({...r,weighing:weighing.get(r)})),date,logo);
  const page=window.open('','_blank');
  if(!page)throw Error('Permita pop-ups para abrir o relatório.');
  page.opener=null;
  page.document.open();page.document.write(report);page.document.close();
  page.document.getElementById('save-pdf').onclick=()=>page.print();
  $('report-dialog').close();
 }catch(error){$('report-error').textContent=error.message}
};
$('form').onsubmit=async e=>{
 e.preventDefault();
 const form=e.currentTarget,f=new FormData(form),command=f.get('id').trim(),client=f.get('client').trim(),responsible=f.get('responsible').trim(),date=f.get('date'),kind=f.get('kind'),sorted=Number(f.get('sorted')),items=formItems();
 if(!command||!responsible||!Object.hasOwn(kinds,kind)||(kind==='customer'&&!client)||entries.some(r=>r!==editing&&kindOf(r)===kind&&r.date===date&&r.command?.toLowerCase()===command.toLowerCase())||sumItems(items)>sorted+.00001){
  $('error').textContent='Confira os campos, os pesos e a comanda. Para ocorrência do cliente, informe o cliente. Use uma comanda por data e tipo.';return;
 }
 await commit(form,'error',async()=>{
  const record=await saveRecord({command,date,kind,client,responsible,sorted,items},editing?.key);
  if(editing){entries.splice(entries.indexOf(editing),1,record);weighing.delete(editing)}else entries.push(record);
  if(record.weighing)weighing.set(record,record.weighing);$('launch').close();month=date.slice(0,7);week=weekOf(date);day=date;render();openEntry(record);
 });
};
view.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
const observer=new ResizeObserver(draw);observer.observe($('graph'));render();return ()=>observer.disconnect();

}
