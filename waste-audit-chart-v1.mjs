const companies=['INDCOM','BIOREVERSE'];
const colors=['#79baff','#54d9b1','#f7c66a'];
const sources={
  forms:{label:'Forms · peso coletado',indices:[1,2]},
  semand:{label:'SEMAND · peso considerado',indices:[3,4]},
  pdf:{label:'PDFs · peso dos manifestos',indices:[6,10]},
};
const units={month:'mês',week:'semana ISO',day:'dia'};
const money=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
const shortDate=new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',timeZone:'UTC'});
const shortMonth=new Intl.DateTimeFormat('pt-BR',{month:'short',year:'numeric',timeZone:'UTC'});
const asDate=value=>new Date(value+'T12:00:00Z');
const iso=date=>date.toISOString().slice(0,10);
const shift=(date,n)=>{const result=new Date(date);result.setUTCDate(result.getUTCDate()+n);return result;};
const formatKg=value=>value==null?'Sem registro':money.format(value/100)+' kg';

function periodLabel(key,level){
  if(level==='month') return shortMonth.format(asDate(key+'-01'));
  if(level==='week') return key.replace(/^(\d{4})-S(\d+)$/,'S$2/$1');
  return shortDate.format(asDate(key));
}
function periodKey(row,level){
  if(level==='month') return row.d.slice(0,7);
  return level==='week'?row.w:row.d;
}
export function seriesFor(records,source,level){
  const groups=new Map();
  for(const record of records){
    const key=periodKey(record,level);
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(record);
  }
  return [...groups].map(([key,rows])=>{
    const expected=level==='month'?new Date(Date.UTC(+key.slice(0,4),+key.slice(5,7),0)).getUTCDate():level==='week'?7:1;
    const values=sources[source].indices.map(index=>rows.map(r=>index===10?r.bio?.[1]??null:r.v[index]));
    const triage=rows.map(row=>row.v[0]).filter(value=>value!==null);
    return {
      triaged:triage.length?triage.reduce((sum,value)=>sum+value,0):null,
      triageComplete:triage.length===expected,
      key,rows,label:periodLabel(key,level),partial:rows.length<expected,
      weights:values.map(series=>series.some(value=>value!==null)?series.reduce((sum,value)=>sum+(value??0),0):null),
      complete:values.map(series=>series.length===expected&&series.every(value=>value!==null)),
    };
  });
}
export function trendFor(points,company){
  const samples=points.flatMap((point,index)=>point.complete[company]?[{x:index,y:point.weights[company]}]:[]);
  if(samples.length<2) return [];
  const meanX=samples.reduce((sum,point)=>sum+point.x,0)/samples.length;
  const meanY=samples.reduce((sum,point)=>sum+point.y,0)/samples.length;
  const slope=samples.reduce((sum,point)=>sum+(point.x-meanX)*(point.y-meanY),0)/
    samples.reduce((sum,point)=>sum+(point.x-meanX)**2,0);
  const first=samples[0].x,last=samples.at(-1).x;
  return [first,last].map(index=>({index,value:Math.max(0,meanY+slope*(index-meanX))}));
}
function projectionDates(last,level){
  const cutoff=asDate(last);
  if(level==='month') return [1,2,3].map(n=>shortMonth.format(new Date(Date.UTC(cutoff.getUTCFullYear(),cutoff.getUTCMonth()+n,1))));
  if(level==='week'){
    const first=shift(cutoff,((8-cutoff.getUTCDay())%7)||7);
    return [0,7,14].map(n=>shortDate.format(shift(first,n))+' a '+shortDate.format(shift(first,n+6)));
  }
  return [1,2,3].map(n=>shortDate.format(shift(cutoff,n)));
}
export function forecastFor(records,source,level){
  if(!records.length||source==='pdf') return null;
  const periods=seriesFor(records,source,level);
  const averages=companies.map((_,company)=>{
    const complete=periods.filter(period=>period.complete[company]).slice(-4);
    return complete.length<3?null:Math.round(complete.reduce((sum,period)=>sum+period.weights[company],0)/complete.length);
  });
  if(averages.every(value=>value===null)) return null;
  return {averages,labels:projectionDates(records.at(-1).d,level),cutoff:records.at(-1).d};
}
function draw(canvas,points,source){
  const bounds=canvas.getBoundingClientRect();
  if(bounds.width<1) return;
  const scale=window.devicePixelRatio||1,width=bounds.width,height=246;
  canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
  const ctx=canvas.getContext('2d');
  ctx.scale(scale,scale);
  const left=62,right=12,top=14,bottom=224;
  const span=(width-left-right)/Math.max(1,points.length);
  const x=index=>left+(index+.5)*span;
  const plotted=points.map(point=>({
    ...point,
    weights:[...point.weights,point.triaged],
    complete:[...(source==='pdf'?point.weights.map(value=>value!==null):point.complete),point.triageComplete],
  }));
  const trends=colors.map((_,series)=>trendFor(plotted,series));
  const max=Math.max(100,...plotted.flatMap(point=>point.weights.map(value=>value??0)),...trends.flatMap(trend=>trend.map(p=>p.value)));
  const ceiling=Math.ceil(max/(10**Math.floor(Math.log10(max))))*(10**Math.floor(Math.log10(max)));
  const y=value=>bottom-value/ceiling*(bottom-top);
  ctx.font='11px system-ui';
  ctx.textAlign='right';
  for(let step=0;step<=4;step++){
    const value=ceiling*step/4,row=y(value);
    ctx.strokeStyle='#344255';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,row);ctx.lineTo(width-right,row);ctx.stroke();
    ctx.fillStyle='#b1c1d4';ctx.fillText(money.format(value/100),left-7,row+4);
  }
  const bar=Math.max(2,Math.min(18,span*.20));
  colors.forEach((color,series)=>{
    ctx.fillStyle=color;
    for(const [index,point] of plotted.entries()){
      const value=point.weights[series];
      if(value===null) continue;
      const center=x(index)+(series-1)*1.25*bar;
      ctx.globalAlpha=point.partial ? .48 : .85;
      ctx.fillRect(center-bar/2,y(value),bar,Math.max(1,bottom-y(value)));
    }
  });
  ctx.globalAlpha=1;
  trends.forEach((trend,series)=>{
    if(!trend.length) return;
    ctx.strokeStyle=colors[series];ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.beginPath();
    ctx.moveTo(x(trend[0].index),y(trend[0].value));ctx.lineTo(x(trend[1].index),y(trend[1].value));ctx.stroke();
  });
  ctx.setLineDash([]);
}
function button(label,onClick){
  const node=document.createElement('button');node.type='button';node.textContent=label;node.onclick=onClick;return node;
}

export function mountWasteChart(root,records){
  let scoped=records,month=null,week=null,source='forms',observer;
  root.innerHTML=`<div class="wa-chart-head"><div><h3>Lixo triado e volume por coletora · kg</h3><p class="waste-sub" data-wa-chart-path></p></div>
    <label>Fonte <select data-wa-chart-source></select></label></div>
    <div class="wa-chart-legend"><span>INDCOM</span><span>BIOREVERSE</span><span class="wa-chart-triage">Lixo triado</span><small>Linha tracejada · tendência</small></div>
    <div data-wa-chart-content></div><div data-wa-chart-forecast></div>`;
  const get=name=>root.querySelector('[data-wa-chart-'+name+']');
  const sourceInput=get('source');
  for(const [key,definition] of Object.entries(sources)) sourceInput.add(new Option(definition.label,key));
  sourceInput.onchange=()=>{source=sourceInput.value;render();};
  function render(){
    observer?.disconnect();
    const level=week?'day':month?'week':'month';
    const view=scoped.filter(row=>(!month||row.d.startsWith(month))&&(!week||row.w===week));
    const points=seriesFor(view,source,level),path=get('path'),content=get('content');
    path.replaceChildren();
    if(month) path.append(button('Todos os meses',()=>{month=null;week=null;render();}),document.createTextNode(' › '));
    if(week) path.append(button(periodLabel(month,'month'),()=>{week=null;render();}),document.createTextNode(' › '));
    path.append(document.createTextNode(week?periodLabel(week,'week')+' · Dias':month?periodLabel(month,'month')+' · Semanas ISO':'Meses · clique no período para ver as semanas ISO'));
    content.replaceChildren();
    if(!points.length) content.textContent='Sem dados no recorte.';
    else {
      const scroll=document.createElement('div');scroll.className='wa-chart-scroll';
      const plot=document.createElement('div');plot.className='wa-chart-plot';
      plot.style.setProperty('--wa-points',points.length);
      const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
      const actions=document.createElement('div');actions.className='wa-chart-actions';
      const labels=document.createElement('div');labels.className='wa-chart-axis';
      const details=document.createElement('p');details.className='waste-sub';details.setAttribute('role','status');
      details.textContent=level==='week'?'Clique na semana para ver os dias.':'Selecione um período para conferir os pesos.';
      for(const point of points){
        const summary=point.label+' · '+companies.map((name,i)=>name+': '+formatKg(point.weights[i])).join(' · ')+' · Lixo triado: '+formatKg(point.triaged)+(point.partial?' · período parcial':'');
        const action=button('',()=>{
          if(level==='month'){month=point.key;render();}
          else if(level==='week'){week=point.key;render();}
          else details.textContent=summary;
        });
        action.setAttribute('aria-label',summary);action.title=summary;
        action.onfocus=()=>{details.textContent=summary;};
        actions.append(action);
        const label=document.createElement('span');label.textContent=point.label+(point.partial?' *':'');labels.append(label);
      }
      plot.append(canvas,actions,labels);scroll.append(plot);content.append(scroll,details);
      const current=new ResizeObserver(()=>{if(!root.isConnected){current.disconnect();return;}draw(canvas,points,source);});
      observer=current;current.observe(plot);
    }
    const forecast=get('forecast'),estimate=forecastFor(records,source,level);
    forecast.replaceChildren();
    const title=document.createElement('h4');title.textContent='Projeção por '+units[level];forecast.append(title);
    const note=document.createElement('p');note.className='waste-sub';
    if(!estimate){
      note.textContent=source==='pdf'?'Tendência dos pesos documentados. Selecione Forms ou SEMAND para projetar com períodos completos.':'Dados insuficientes para projetar este período.';
      forecast.append(note);return;
    }
    note.textContent='Base até '+shortDate.format(asDate(estimate.cutoff))+'. Média dos últimos 3 a 4 períodos completos por coletora. * Período parcial.';
    const list=document.createElement('div');list.className='wa-chart-projections';
    for(const label of estimate.labels){
      const tile=document.createElement('div');tile.className='waste-kpi';
      const caption=document.createElement('strong');caption.textContent=label;tile.append(caption);
      for(const [index,name] of companies.entries()){
        const metric=document.createElement('small');metric.textContent=name+' · '+(estimate.averages[index]===null?'Base insuficiente':formatKg(estimate.averages[index]));tile.append(metric);
      }
      list.append(tile);
    }
    forecast.append(note,list);
  }
  return selected=>{scoped=selected;month=null;week=null;render();};
}
