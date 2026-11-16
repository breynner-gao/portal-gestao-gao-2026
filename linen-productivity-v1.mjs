import {localTimestamp} from './linen-operations-history-v1.mjs?v=1';

const activities=[
  ['return','Mercado → Depósito','peças'],
  ['supply','Depósito → Mercado','peças'],
  ['invoice','Recebimento de enxoval','peças'],
  ['quality','Inspeção de qualidade','inspeções'],
  ['tag','Cadastro RFID','peças'],
  ['inspect_used','Avaliação de peças usadas','avaliações'],
  ['sewing_receive','Entrada na Costura','peças'],
  ['sewing_return','Retorno da Costura','peças'],
  ['discard','Descarte confirmado','peças'],
  ['client_separate','Separação para cliente','peças'],
  ['client_close','Comandas concluídas','comandas']
];
const activityNames=new Map(activities.map(([key,label])=>[key,label]));
const n=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):0;
const format=value=>value==null?'—':value.toLocaleString('pt-BR',{maximumFractionDigits:1});
const dateLabel=value=>value.split('-').reverse().join('/');
const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

export function shiftDate(date,days){
  const value=new Date(date+'T00:00:00Z');
  value.setUTCDate(value.getUTCDate()+days);
  return value.toISOString().slice(0,10);
}

export function productivityRecords(movements,audit){
  const rows=[];
  for(const event of movements){
    const key=event.request?.direction;
    const quantity=n(event.quantity);
    if(!quantity||!['return','supply'].includes(key))continue;
    const time=localTimestamp(event.occurred_at);
    rows.push({key,quantity,date:time.slice(0,10),time,responsible:event.responsible});
  }
  for(const event of audit){
    const key=event.action;
    if(!activityNames.has(key)||['return','supply'].includes(key))continue;
    const quantity=key==='invoice'?(event.lines||[]).reduce((sum,line)=>sum+n(line.quantity),0):
      key==='client_separate'?n(event.quantity):1;
    if(!quantity)continue;
    const time=localTimestamp(event.created_at);
    rows.push({key,quantity,date:time.slice(0,10),time,responsible:event.responsible});
  }
  return rows;
}

export function dailyProductivity(records,targets,date){
  const start=shiftDate(date,-28);
  const prior=records.filter(record=>record.date>=start&&record.date<date);
  const days=[...new Set(prior.map(record=>record.date))].sort().slice(-5);
  const recent=prior.filter(record=>days.includes(record.date));
  const entries=records.filter(record=>record.date===date).sort((a,b)=>b.time?.localeCompare(a.time)||0);
  const rows=activities.map(([key,label,unit])=>{
    const actual=entries.filter(record=>record.key===key).reduce((sum,record)=>sum+record.quantity,0);
    const effective=targets.filter(row=>row.activity===key&&row.effective_on<=date).sort((a,b)=>b.effective_on.localeCompare(a.effective_on))[0];
    const target=n(effective?.target)||null;
    const history=recent.filter(record=>record.key===key);
    const average=days.length>=3&&history.length?history.reduce((sum,record)=>sum+record.quantity,0)/days.length:null;
    return {key,label,unit,actual,target,attainment:target?100*actual/target:null,
      remaining:target?Math.max(0,target-actual):null,average,projected:average==null?null:5*average};
  });
  return {rows,entries,days};
}

function table(headers,rows){
  return '<div class="leo-scroll"><table><thead><tr>'+headers.map(label=>'<th scope="col">'+html(label)+'</th>').join('')+
    '</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(value=>'<td>'+html(value)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}

export function productivityView({records,targets,date,today,canManage,saving}){
  const {rows,entries,days}=dailyProductivity(records,targets,date);
  const disabled=saving?'disabled':'';
  const summary=table(['Atividade','Unidade','Realizado','Meta','Atingimento','Faltam','Média por dia','Projeção · 5 dias'],
    rows.map(row=>[row.label,row.unit,format(row.actual),row.target===null?'Sem meta':format(row.target),
      row.attainment===null?'—':format(row.attainment)+'%',format(row.remaining),format(row.average),format(row.projected)]));
  const management=canManage?'<details class="leo-record"><summary>Definir meta diária</summary><form data-leo-target>'+
    '<label>Atividade<select name="activity">'+activities.map(([key,label,unit])=>'<option value="'+key+'">'+label+' ('+unit+')</option>').join('')+
    '</select></label><label>Meta por dia<input type="number" name="target" min="1" max="1000000" required></label>'+
    '<label>Vigência a partir de<input type="date" name="effective" value="'+html(today)+'" required></label>'+
    '<button '+disabled+'>Salvar meta</button></form><p>A meta vale a partir da data indicada até a próxima meta da atividade.</p></details>':'';
  return '<section class="leo-card"><form data-leo-report-date>'+
    '<label>Data do relatório<input type="date" name="date" value="'+html(date)+'" max="'+html(today)+'" required></label>'+
    '<button '+disabled+'>Consultar dia</button></form><h3>Produção de '+dateLabel(date)+'</h3>'+
    (!entries.length?'<p>Nenhuma atividade concluída registrada para esta data.</p>':'')+summary+
    '<p>A projeção estima cinco dias de operação pelo ritmo dos últimos cinco dias com registros, dentro dos 28 dias anteriores. O cálculo requer pelo menos três dias de operação e histórico na atividade.</p>'+
    (days.length>=3?'<p>Dias usados no cálculo: '+days.map(dateLabel).join(', ')+'.</p>':'')+management+'</section>'+
    (entries.length?'<section class="leo-card"><h3>Registros do dia</h3>'+table(['Horário','Atividade','Quantidade','Responsável'],
      entries.map(row=>[row.time.slice(11),activityNames.get(row.key),format(row.quantity),row.responsible||'—']))+'</section>':'');
}
