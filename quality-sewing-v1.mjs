const activities={entrada:'Avaliação de entrada',reparo:'Pequenos reparos',remodelagem:'Remodelagem',peca_nova:'Avaliação de peças novas',chipagem:'Chipagem',troca_chip:'Troca de chip',condicao:'Avaliação da condição e descarte',retirada_chip:'Retirada de chip',auditoria:'Auditoria'};
const historicalLabels={'REPARO':'reparo','CHIPAGEM':'chipagem','AUDITORIA':'auditoria','AVALIAÇÃO DESCARTE':'condicao','AVALIAÇÃO PARA LIBERAR PEÇAS NOVAS':'peca_nova','AVALIAÇÃO DE ENTRADA NA COSTURA':'entrada','REMODELAGEM':'remodelagem','RETIRADA DE CHIP':'retirada_chip'};
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=values=>values.map(v=>'<option>'+escape(v)+'</option>').join('');
const input=(name,label,type='text',required=false)=>'<label>'+label+'<input name="'+name+'" type="'+type+'" '+(required?'required ':'')+(type==='number'?'min="0" step="1"':'maxlength="160"')+'></label>';
const select=(name,label,values,required=true)=>'<label>'+label+'<select name="'+name+'" '+(required?'required':'')+'><option value="">Selecione</option>'+options(values)+'</select></label>';
const status=['Em execução','Aguardando conferência','Liberada','Precisa de ajuste'];
const reason=['Costura aberta','Rasgo','Desgaste','Medida','Acabamento','Mancha','Outro'];
const fields={
 entrada:()=>select('condition','Condição observada',reason)+select('destination','Encaminhamento',['Reparo','Remodelagem','Avaliar descarte','Outro']),
 reparo:()=>select('defect','Defeito',reason)+select('repair','Reparo realizado',['Bainha','Costura','Remendo','Troca de componente','Outro'])+select('status','Situação',status)+input('previous','Referência do serviço anterior')+input('return_reason','Motivo do retorno'),
 remodelagem:()=>input('original_size','Tamanho original','text',true)+input('change','Alteração realizada','text',true)+input('result_piece','Tipo resultante','text',true)+input('result_size','Tamanho resultante','text',true)+input('result_qty','Quantidade resultante','number',true)+select('status','Situação',status),
 peca_nova:()=>input('supplier','Fornecedor')+input('approved','Aprovadas','number',true)+input('pending','Pendentes','number',true)+input('rejected','Reprovadas','number',true)+select('reason','Motivo da pendência ou reprovação',reason,false)+select('finish','Costuras e acabamento',['Conformes','Com defeitos','Não verificados'])+select('register','Chipagem e cadastro',['Pendentes','Concluídos','Não se aplica'])+input('released','Liberadas para uso','number',true)+input('sample','Identificação da peça ou amostra')+select('method','Método da medição',['Peça plana retangular aberta','Outro formato ou método'],false)+['length','width','weight'].map((k,i)=>'<label>'+['Comprimento (cm)','Largura (cm)','Peso unitário sem embalagem (g)'][i]+'<input type="number" min="0.01" step="any" name="'+k+'"></label>').join('')+'<label>Gramatura (g/m²)<output name="grammage">—</output></label>',
 chipagem:()=>select('reading','Teste de leitura',['Aprovado','Falhou','Não realizado'])+select('register','Cadastro',['Pendente','Concluído']),
 troca_chip:()=>input('piece_ref','Identificação interna da peça','text',true)+input('reason','Motivo da troca','text',true)+select('reading','Teste de leitura',['Aprovado','Falhou','Não realizado'])+select('register','Cadastro',['Pendente','Concluído']),
 condicao:()=>select('condition','Condição observada',reason)+select('recommendation','Recomendação',['Continuar em uso','Reparar','Remodelar','Reavaliar','Recomendar descarte'])+select('decision','Decisão final',['Aguardando decisão','Liberada','Descarte aprovado','Descarte efetivado'])+input('authorizer','Responsável pela autorização')+input('decision_date','Data da decisão','date'),
 retirada_chip:()=>input('reason','Motivo da retirada','text',true)+input('destination','Destino do chip'),
 auditoria:()=>input('scope','O que foi conferido','text',true)+input('divergence','Divergência encontrada')+input('action','Providência')
};
function grams(d){return d.method==='Peça plana retangular aberta'&&[d.length,d.width,d.weight].every(v=>Number(v)>0)?Number(d.weight)*10000/(Number(d.length)*Number(d.width)):null}
const number=n=>Number(n).toLocaleString('pt-BR');
const dateNow=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
async function pages(api,table,sort,filter=''){
 const rows=[];
 for(let offset=0;;offset+=500){
  const batch=await api(table,'select=*&order='+sort+'&limit=500&offset='+offset+filter);
  rows.push(...batch);
  if(batch.length<500)return rows;
 }
}
const sewingShare=new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1});
function productionCards(rows,teamRows=rows){
 const teamTotals=new Map();
 for(const row of teamRows){
  if(row.quantity!=null)teamTotals.set(row.label,(teamTotals.get(row.label)||0)+Number(row.quantity));
 }
 const teamTotal=[...teamTotals.values()].reduce((sum,quantity)=>sum+quantity,0);
 const people=new Map();
 for(const row of rows){
  const key=row.operator_id||row.responsible;
  if(!people.has(key))people.set(key,{name:row.responsible,activities:new Map(),total:0,measured:false});
  const person=people.get(key);
  const stats=person.activities;
  const activity=stats.get(row.label)||{quantity:0,count:0};
  if(row.quantity!=null){const quantity=Number(row.quantity);activity.quantity+=quantity;activity.count++;person.total+=quantity;person.measured=true;}
  stats.set(row.label,activity);
 }
 return '<p class="sew-share-note">Cartões ordenados pelo volume lançado. O percentual total usa todas as atividades do recorte. Cada atividade também mostra sua participação no total da equipe.</p><div class="sew-production">'+[...people.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'pt-BR')).map(person=>
  '<article><h3>'+escape(person.name)+'</h3><p class="sew-total"><span>Participação total</span><strong>'+(person.measured&&teamTotal>0?sewingShare.format(person.total/teamTotal):'—')+'</strong><small>'+(person.measured?number(person.total)+' de '+number(teamTotal)+' unidades lançadas':'Sem quantidade informada')+'</small></p><ul>'+[...person.activities].map(([label,value])=>
   {
    const total=teamTotals.get(label);
    const share=value.count&&total>0?sewingShare.format(value.quantity/total):'—';
    return '<li><span>'+escape(label)+'</span><span class="sew-share"><strong>'+(value.count?number(value.quantity):'—')+'</strong><small>'+share+'</small></span></li>';
   }).join('')+'</ul></article>').join('')+'</div>';
}
function openProductionTV(root,loadToday){
 const dialog=document.createElement('dialog');
 dialog.className='sew-tv';
 dialog.innerHTML='<header><div><h2>Produção da Costura</h2><p data-tv-status role="status">Carregando produção…</p></div><div><button type="button" data-tv-full>Tela cheia</button> <button type="button" data-tv-close>Fechar</button></div></header><div data-tv-cards></div><p>Quantidades lançadas por atividade.</p>';
 root.append(dialog);
 const status=dialog.querySelector('[data-tv-status]');
 const cards=dialog.querySelector('[data-tv-cards]');
 async function refresh(){
  if(!dialog.open||!dialog.isConnected){clearInterval(timer);return;}
  const date=dateNow();
  try{
   const rows=await loadToday(date);
   if(!dialog.open||!dialog.isConnected)return;
   cards.innerHTML=rows.length?productionCards(rows):'<p>Nenhum lançamento no dia.</p>';
   status.textContent=date.split('-').reverse().join('/')+' · Atualizado às '+new Date().toLocaleTimeString('pt-BR',{timeZone:'America/Sao_Paulo'});
  }catch{status.textContent='Atualização indisponível. Nova tentativa em até 60 segundos.';}
 }
 dialog.querySelector('[data-tv-close]').onclick=()=>dialog.close();
 const full=dialog.querySelector('[data-tv-full]');
 full.hidden=!dialog.requestFullscreen;
 full.onclick=async()=>{
  try{if(document.fullscreenElement===dialog)await document.exitFullscreen();else await dialog.requestFullscreen();}
  catch{status.textContent='Tela cheia indisponível neste navegador.';}
 };
 const timer=setInterval(refresh,60000);
 dialog.addEventListener('close',()=>{clearInterval(timer);dialog.remove();},{once:true});
 dialog.showModal();
 void refresh();
}
function sewingWeek(date){
 const monday=new Date(date+'T00:00:00Z');
 monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
 const thursday=new Date(monday);
 thursday.setUTCDate(thursday.getUTCDate()+3);
 const year=thursday.getUTCFullYear();
 const week=Math.ceil(((thursday-Date.UTC(year,0,1))/86400000+1)/7);
 return {key:monday.toISOString().slice(0,10),label:'S'+String(week).padStart(2,'0')+' · '+year};
}
const sewingMonth=date=>new Intl.DateTimeFormat('pt-BR',{month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(date+'-01T00:00:00Z'));
const sewingDay=date=>date.split('-').reverse().join('/');
function sewingBuckets(rows,month,week){
 const groups=new Map();
 for(const row of rows){
  const date=row.service_date, iso=sewingWeek(date);
  const [key,label]=!month?[date.slice(0,7),sewingMonth(date.slice(0,7))]:!week?[iso.key,iso.label]:[date,sewingDay(date)];
  const group=groups.get(key)||{key,label,total:0,measured:false};
  if(row.quantity!=null){group.total+=Number(row.quantity);group.measured=true;}
  groups.set(key,group);
 }
 return [...groups.values()].sort((a,b)=>a.key.localeCompare(b.key));
}
function sewingTrend(groups){
 const points=groups.flatMap((g,index)=>g.measured?[[index+.5,g.total]]:[]);
 if(points.length<2)return null;
 const mean=column=>points.reduce((sum,p)=>sum+p[column],0)/points.length;
 const x=mean(0),y=mean(1);
 const slope=points.reduce((sum,p)=>sum+(p[0]-x)*(p[1]-y),0)/points.reduce((sum,p)=>sum+(p[0]-x)**2,0);
 return [points[0][0],points.at(-1)[0]].map(value=>[value,y+slope*(value-x)]);
}
function sewingChart(groups,month,week,day){
 const trend=sewingTrend(groups);
 const max=Math.max(1,...groups.map(g=>g.total),...(trend||[]).map(point=>point[1]));
 const line=trend?'<svg class="sew-trend" viewBox="0 0 '+groups.length+' 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="'+trend.map(([x,y])=>x+','+(100-100*y/max)).join(' ')+'" fill="none" stroke="#ffc078" stroke-width="2" vector-effect="non-scaling-stroke" stroke-dasharray="6 4"/></svg>':'';
 const trail=['Meses',month&&sewingMonth(month),week&&groups.length&&sewingWeek(groups[0].key).label,day&&sewingDay(day)].filter(Boolean);
 return '<section class="sew-chart"><h3>Evolução da produção</h3><p>'+escape(trail.join(' › '))+'</p>'
  +(month?'<button type="button" data-sew-back>← '+(day?'Dias':week?'Semanas':'Meses')+'</button>':'')
  +'<p>'+(day?'Lançamentos do dia abaixo.':!month?'Selecione um mês para ver as semanas ISO.':!week?'Selecione uma semana para ver os dias do mês.':'Selecione um dia para ver os lançamentos.')+'</p>'
  +'<small>Quantidade informada por atividade. Uma peça pode aparecer em mais de uma atividade.</small>'
  +(groups.length?'<p class="sew-chart-legend"><span>■ Quantidade</span>'+(trend?'<span>╌ Tendência linear</span>':'')+'</p><div class="sew-chart-scroll"><div class="sew-column-chart" style="--periods:'+groups.length+';min-width:'+Math.max(0,groups.length*72)+'px">'+line+groups.map(g=>'<button type="button" data-sew-bucket="'+g.key+'" aria-pressed="'+(day===g.key)+'"><span class="sew-column-plot">'+(g.measured?'<span class="sew-column" style="height:'+(100*g.total/max)+'%"></span>':'')+'</span><strong>'+escape(g.label)+'</strong><span>'+(g.measured?number(g.total):'—')+'</span></button>').join('')+'</div></div>':'<p>Nenhum lançamento no recorte.</p>')+'</section>';
}
function renderPanel(root,rows,manage){
 root.innerHTML='<h2>'+(manage?'Painel da Costura':'Meus lançamentos')+'</h2><form class="sew-grid">'+input('from','De','date')+input('to','Até','date')+select('person','Profissional',[...new Set(rows.map(r=>r.responsible))].sort(),false)+select('activity','Atividade',Object.values(activities),false)+select('piece','Tipo de peça',[...new Set(rows.map(r=>r.piece_type).filter(Boolean))].sort(),false)+input('customer','Cliente')+input('lot','Lote')+select('period','Agrupar por',['Dia','Mês'],false)+'</form><div data-results></div>';
 const form=root.querySelector('form'), result=root.querySelector('[data-results]');
 let month='',week='',day='';
 const table=(heads,body)=>'<div class="sew-table"><table><thead><tr>'+heads.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+body.map(row=>'<tr>'+row.map(x=>'<td>'+escape(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 function update(){
  const f=Object.fromEntries(new FormData(form));
  const matching=rows.filter(r=>(!f.from||r.service_date>=f.from)&&(!f.to||r.service_date<=f.to)&&(!f.activity||r.label===f.activity)&&(!f.piece||r.piece_type===f.piece)&&(!f.customer||r.customer?.toLowerCase().includes(f.customer.toLowerCase()))&&(!f.lot||r.lot?.toLowerCase().includes(f.lot.toLowerCase())));
  const chartRows=matching.filter(r=>!f.person||r.responsible===f.person).filter(r=>(!month||r.service_date.startsWith(month))&&(!week||sewingWeek(r.service_date).key===week));
  const filtered=day?chartRows.filter(r=>r.service_date===day):chartRows;
  const groups=new Map();
  for(const r of filtered){
   const parts=[f.period==='Dia'?r.service_date:r.service_date.slice(0,7),r.responsible,r.label];
   const key=JSON.stringify(parts), group=groups.get(key)||[...parts,0,0,0];
   group[3]++;if(r.quantity!=null)group[4]+=r.quantity;else group[5]++;
   groups.set(key,group);
  }
  result.innerHTML=(manage?sewingChart(sewingBuckets(chartRows,month,week),month,week,day):'')+(manage&&filtered.length?productionCards(filtered,matching.filter(r=>(!month||r.service_date.startsWith(month))&&(!week||sewingWeek(r.service_date).key===week)&&(!day||r.service_date===day))):'')+'<p>'+number(filtered.length)+' lançamentos no recorte. Quantidades são comparáveis dentro da mesma atividade. Uma peça pode passar por vários serviços.</p>'+table(['Período','Profissional','Atividade','Lançamentos','Quantidade informada','Sem quantidade em peças'],[...groups.values()].map(g=>[...g.slice(0,4),number(g[4]),g[5]]))+'<h3 data-records-title tabindex="-1">Lançamentos</h3><p>O histórico da planilha conserva as quantidades e descrições originais. O tipo de peça aparece quando foi informado.</p><div data-records></div>';
  result.querySelector('[data-sew-back]')?.addEventListener('click',()=>{if(day)day='';else if(week)week='';else month='';update();result.querySelector('[data-sew-back], [data-sew-bucket]')?.focus();});
  result.querySelectorAll('[data-sew-bucket]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.sewBucket;if(!month)month=key;else if(!week)week=key;else day=key;update();if(day){const title=result.querySelector('[data-records-title]');title?.focus();title?.scrollIntoView({block:'start'});}else result.querySelector('[data-sew-bucket], [data-sew-back]')?.focus();}));
  const records=result.querySelector('[data-records]');
  for(const r of filtered){
   const details=document.createElement('details'), title=document.createElement('summary');
   title.textContent=[r.service_date,r.responsible,r.label,r.piece_type,r.quantity??r.source_quantity].filter(v=>v!=null&&v!=='').join(' · ');
   const metadata=document.createElement('p');metadata.textContent=(r.source_row?'Planilha · linha '+r.source_row+' · carimbo '+r.recorded_local:'Portal · '+r.id+' · lançado em '+new Date(r.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))+[r.customer,r.lot].filter(Boolean).map(v=>' · '+v).join('');
   const body=document.createElement('p');
   const labels={condition:'Condição',destination:'Encaminhamento',defect:'Defeito',repair:'Reparo',status:'Situação',previous:'Referência anterior',return_reason:'Motivo do retorno',original_size:'Tamanho original',change:'Alteração',result_piece:'Peça resultante',result_size:'Tamanho resultante',result_qty:'Quantidade resultante',supplier:'Fornecedor',approved:'Aprovadas',pending:'Pendentes',rejected:'Reprovadas',reason:'Motivo',finish:'Costura e acabamento',register:'Cadastro',released:'Liberadas',sample:'Amostra',method:'Método',length:'Comprimento (cm)',width:'Largura (cm)',weight:'Peso (g)',grammage:'Gramatura (g/m²)',reading:'Leitura',piece_ref:'Peça',recommendation:'Recomendação',decision:'Decisão',authorizer:'Autorizador',decision_date:'Data da decisão',scope:'Conferência',divergence:'Divergência',action:'Providência',notes:'Observações'};
   body.textContent=Object.entries(r.details||{}).map(([k,v])=>(labels[k]||k)+': '+v).join(' · ');
   details.append(title,metadata,body);records.append(details);
  }
 }
 form.addEventListener('input',()=>{month='';week='';day='';update();});update();
}
export async function mountSewing(host,api){
 host.innerHTML='<style>.sew-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,190px),1fr));gap:12px;margin:12px 0}.sew-grid label{display:grid;gap:5px;align-content:start}.sew-grid input,.sew-grid select{min-width:0;width:100%;padding:8px}.sew-table{overflow:auto}.sew-table table{width:100%;border-collapse:collapse}.sew-table th,.sew-table td{text-align:left;padding:8px;border-bottom:1px solid #b8c8d7}#q142 .sew details{padding:8px 0;border-bottom:1px solid #b8c8d7}#q142 .sew output{display:block;padding:8px}.sew-production{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:12px;margin:12px 0}.sew-production article{background:#192632;border:1px solid #40566e;border-radius:12px;padding:14px;color:#eef4ff}.sew-production h3{margin:0 0 10px;color:#eef4ff}.sew-production ul{list-style:none;margin:0;padding:0}.sew-production li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 0;border-top:1px solid #304054}.sew-production strong{color:#8ed5fa}.sew-share{display:grid;text-align:right;gap:3px}.sew-share small{color:#c0dbef;white-space:nowrap}.sew-share-note{color:#aec2d8}.sew-total{display:grid;gap:3px;margin:0 0 12px}.sew-total strong{font-size:1.5em}.sew-total small{color:#aec2d8}.sew-tv{width:min(96vw,1500px);max-width:none;max-height:96vh;padding:24px;border:1px solid #40566e;border-radius:14px;background:#111820;color:#eef4ff;font-size:clamp(16px,1.6vw,28px);overflow:auto}.sew-tv:fullscreen{width:100%;height:100%;max-height:none}.sew-tv::backdrop{background:#000b}.sew-tv header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;background:transparent;border:0}.sew-tv h2{color:#eef4ff;margin:0}.sew-tv button{background:#192632;color:#eef4ff}.sew-chart{border:1px solid #40566e;border-radius:12px;padding:14px;margin:12px 0}.sew-chart h3{color:#eef4ff;margin-top:0}.sew-chart-legend{display:flex;gap:16px;flex-wrap:wrap}.sew-chart-legend span:first-child{color:#8ed5fa}.sew-chart-legend span:nth-child(2){color:#ffc078}.sew-chart-scroll{overflow-x:auto}.sew-column-chart{display:grid;grid-template-columns:repeat(var(--periods),minmax(0,1fr));position:relative;--plot-height:clamp(145px,24vh,235px)}.sew-column-chart button{display:grid;grid-template-rows:var(--plot-height) auto auto;align-content:start;gap:4px;padding:0 4px 8px;background:transparent;color:#eef4ff;border:0;border-radius:0;min-width:0;overflow-wrap:anywhere}.sew-column-chart button:hover,.sew-column-chart button:focus-visible,.sew-column-chart button[aria-pressed=true]{background:#253746;outline:1px solid #8ed5fa;outline-offset:-1px}.sew-column-plot{display:flex;align-items:end;justify-content:center;border-bottom:1px solid #40566e}.sew-column{display:block;width:68%;max-width:72px;border-radius:4px 4px 0 0;background:#5bacec}.sew-trend{position:absolute;top:0;left:0;width:100%;height:var(--plot-height);pointer-events:none;z-index:1;overflow:hidden}</style><div class="q142-card sew"><a href="/#qualidade">← Qualidade</a><h1>Costura</h1><p role="status">Verificando acesso…</p></div>';
 const root=host.querySelector('.sew'), message=root.querySelector('[role=status]');
 try{
  await window.GAO_AUTH_READY;
  const access=await api('rpc/quality_sewing_access');
  if(!access.write&&!access.manage){message.textContent='Acesso à Costura não concedido.';return;}
  const session=await window.GAO_AUTH_READY;
  const user=(window.GAO_AUTH_SESSION||session).user;
  const operators=await api('rpc/quality_sewing_operators');
  const names=new Map(operators.map(r=>[r.id,r.label]));
  const identity=names.get(user.id)||user.email||user.id;
  root.insertAdjacentHTML('beforeend','<div class="q142-tabs">'+(access.write?'<button type="button" data-entry>Lançar serviço</button>':'')+'<button type="button" data-panel>'+(access.manage?'Painel da Costura':'Meus lançamentos')+'</button>'+(access.manage?'<button type="button" data-tv>Modo TV</button>':'')+'</div><section data-content></section>');
  const content=root.querySelector('[data-content]');
  message.textContent='';
  const labelCurrent=r=>({...r,responsible:names.get(r.operator_id)||(r.operator_id===user.id?identity:r.operator_id),label:activities[r.activity]||r.activity});
  root.querySelector('[data-tv]')?.addEventListener('click',()=>openProductionTV(root,async date=>{
   const rows=await pages(api,'quality_sewing_entries','service_date.desc,id.asc','&service_date=eq.'+encodeURIComponent(date));
   return rows.map(labelCurrent);
  }));
  let screen=0;
  const panel=async()=>{
   const version=++screen;content.textContent='Carregando lançamentos…';
   try{
    const [current,history]=await Promise.all([pages(api,'quality_sewing_entries','service_date.desc,id.asc'),access.manage?pages(api,'quality_sewing_history','service_date.desc,source_row.asc'):[]]);
    if(version!==screen)return;
    renderPanel(content,[...current.map(labelCurrent),...history.map(r=>({...r,label:activities[historicalLabels[r.activity]]||r.activity}))].sort((a,b)=>b.service_date.localeCompare(a.service_date)),access.manage);
   }catch{if(version===screen)content.textContent='Não foi possível carregar os lançamentos. Clique no painel para tentar novamente.';}
  };
  const entry=()=>{
   ++screen;
   content.innerHTML='<h2>Lançar serviço</h2><p>Responsável: '+escape(identity)+'</p><form><div class="sew-grid">'+input('service_date','Data do serviço','date',true)+'<label>Atividade<select name="activity" required><option value="">Selecione</option>'+Object.entries(activities).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('')+'</select></label>'+input('piece_type','Tipo de peça','text',true)+input('quantity','Quantidade de peças','number',true)+input('lot','Lote ou referência da entrada')+input('customer','Cliente ou origem')+'</div><div class="sew-grid" data-fields></div>'+input('notes','Observações')+' <button class="q142-btn q142-primary" type="submit">Salvar lançamento</button><p role="status"></p></form>';
   const form=content.querySelector('form'), feedback=form.querySelector('[role=status]'), detail=form.querySelector('[data-fields]');
   form.elements.service_date.value=dateNow();form.elements.quantity.min=1;
   form.elements.activity.onchange=()=>{detail.innerHTML=fields[form.elements.activity.value]?.()||'';};
   form.addEventListener('input',()=>{
    const output=detail.querySelector('output');if(!output)return;
    const d=Object.fromEntries(new FormData(form)), g=grams(d);
    output.value=g===null?'—':g.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
   });
   let id=crypto.randomUUID();
   let previousPayload;
   form.onsubmit=async e=>{
    e.preventDefault();const data=Object.fromEntries(new FormData(form));
    const {service_date,activity,piece_type,quantity,lot,customer,...d}=data;
    const qty=Number(quantity);let error='';
    if(activity==='peca_nova'){
     if(Number(d.approved)+Number(d.pending)+Number(d.rejected)!==qty)error='Aprovadas, pendentes e reprovadas devem somar a quantidade avaliada.';
     else if((Number(d.pending)||Number(d.rejected))&&!d.reason)error='Selecione o motivo da pendência ou reprovação.';
     else if(Number(d.released)>Number(d.approved)||(Number(d.released)>0&&d.register==='Pendentes'))error='Libere apenas peças aprovadas com chipagem e cadastro concluídos ou dispensados.';
     else if((d.length||d.width||d.weight)&&(!d.sample.trim()||!d.method))error='Identifique a amostra e o método de medição.';
     const g=grams(d);if(g!==null)d.grammage=g.toFixed(1);
    }
    if(activity==='remodelagem'&&Number(d.result_qty)<1)error='Informe a quantidade resultante.';
    if(activity==='condicao'&&d.decision!=='Aguardando decisão'&&(!d.authorizer.trim()||!d.decision_date))error='Informe o responsável e a data da decisão.';
    if(error){feedback.textContent=error;return;}
    const submit=e.submitter;submit.disabled=true;feedback.textContent='Salvando…';
    try{
     const body={service_date,activity,piece_type:piece_type.trim(),quantity:qty,lot:lot.trim()||null,customer:customer.trim()||null,details:Object.fromEntries(Object.entries(d).filter(([,v])=>v!==''))};
     const payload=JSON.stringify(body);
     if(previousPayload&&previousPayload!==payload)id=crypto.randomUUID();
     previousPayload=payload;
     await api('quality_sewing_entries','on_conflict=id',{method:'POST',prefer:'resolution=ignore-duplicates,return=minimal',body:{id,...body}});
     id=crypto.randomUUID();previousPayload=undefined;form.reset();form.elements.service_date.value=dateNow();detail.replaceChildren();feedback.textContent='Lançamento salvo.';
    }catch{feedback.textContent='Não foi possível confirmar o lançamento. Tente salvar novamente.';}
    finally{submit.disabled=false;}
   };
  };
  root.querySelector('[data-entry]')?.addEventListener('click',entry);
  root.querySelector('[data-panel]').addEventListener('click',panel);
  if(access.write)entry();else await panel();
 }catch{message.textContent='Não foi possível abrir a Costura. Atualize a página para tentar novamente.';}
}
