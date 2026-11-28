import { mountWasteChart } from './waste-audit-chart-v1.mjs?v=8';

const references = {
  workbook:'Planilha de auditoria',
  indcom:'Manifestos INDCOM',
  june:'Comprovantes de junho',
  july:'Comprovantes de julho',
  october:'Comprovantes de outubro',
  indcomInvoice:'Nota fiscal INDCOM',
  bioInvoice:'Nota fiscal BIOREVERSE',
  indcomFinance:'Financeiro INDCOM',
  bioFinance:'Financeiro BIOREVERSE',
};

export function mountAudit(root,history,downloadDocument,loadSource){
  const {records:data,indcom_audit:indcomAudit,billing_titles:billingTitles,documents:attachmentNames}=history;
  const annual=attachmentNames.annual2026;
  const crmTriage=attachmentNames.crm_triage_2026;
  root.innerHTML=`<div class="waste-audit-filters">
    <label>Mês <select id="wa-month"></select></label>
    <label>Semana ISO <select id="wa-week"></select></label>
    <div class="waste-audit-mode">
      <button type="button" id="wa-monthly" aria-pressed="true">Por mês</button>
      <button type="button" id="wa-weekly" aria-pressed="false">Por semana ISO</button>
    </div>
  </div>
  <section class="waste-section wa-chart" id="wa-chart" aria-label="Gráfico por coletora"></section>
  <div id="wa-cards" class="waste-grid"></div>
  ${annual?`<section class="waste-section" aria-labelledby="wa-annualTitle">
    <h3 id="wa-annualTitle">Auditoria de resíduos de 2026</h3>
    <p id="wa-annualCutoff" class="waste-sub"></p>
    <p id="wa-annualTriage" class="waste-sub"></p>
    ${crmTriage?`<section aria-labelledby="wa-scheduleTitle">
      <h4 id="wa-scheduleTitle">Conciliação por dia de coleta</h4>
      <p class="waste-sub">Escala informada: Indicom às segundas, quartas e sextas. Bioreverse às terças, quintas e sábados.</p>
      <p class="waste-sub">A data do documento é a data da coleta. Quando falta peso na Bioreverse em um dia previsto, a tabela mostra a primeira coleta documentada da Indicom no mesmo dia ou depois para conferir a cobertura.</p>
      <label>Mês da conciliação <select id="wa-scheduleMonth"></select></label>
      <div class="waste-audit-scroll" id="wa-scheduleSummary"></div>
      <details><summary id="wa-scheduleGapTitle">Lacunas da Bioreverse</summary>
        <p class="waste-sub">Uma lacuna sinaliza falta de peso positivo no registro da Bioreverse. A coleta da Indicom é uma referência de cobertura. Uma mesma coleta pode aparecer para mais de uma lacuna e seu peso deve ser contado uma única vez.</p>
        <div class="waste-audit-scroll" id="wa-scheduleGaps"></div>
      </details>
      <details><summary>Conferir a escala e os pesos dia a dia</summary><div class="waste-audit-scroll" id="wa-scheduleDays"></div></details>
    </section>`:''}
    ${crmTriage?`<section aria-labelledby="wa-ratesTitle">
      <h4 id="wa-ratesTitle">Fechamento das coletoras · tolerância de ±5%</h4>
      <div class="waste-grid" id="wa-closureCards"></div>
      <p id="wa-closureRange" class="waste-sub"></p>
      <p class="waste-sub">Os percentuais de lixo e coleta usam o peso total triado no CRM. O desvio usa o peso do lixo GAO: (Indicom + Bioreverse − lixo GAO) ÷ lixo GAO × 100.</p>
      <div class="waste-audit-scroll" id="wa-ratesMonths"></div>
      <details><summary>Percentuais por semana ISO</summary><div class="waste-audit-scroll" id="wa-ratesWeeks"></div></details>
      <p class="waste-sub">Dias sem documento e pesos em conferência podem afetar o fechamento. Pesos já registrados na soma das coletoras entram uma única vez.</p>
    </section>`:''}
    <div class="waste-audit-scroll" id="wa-annualMonths"></div>
    <details><summary>Detalhar por semana ISO</summary><div class="waste-audit-scroll" id="wa-annualWeeks"></div></details>
    <details><summary>Conferência dos MTRs da Indicom</summary><div class="waste-audit-scroll" id="wa-annualIndicom"></div></details>
    <details><summary>Conferência da Bioreverse</summary><div class="waste-audit-scroll" id="wa-annualBio"></div></details>
  </section>`:''}
  <dialog id="wa-detail" class="waste-audit-dialog" aria-labelledby="wa-detailTitle">
    <div class="waste-audit-dialog-head"><div><h3 id="wa-detailTitle"></h3><p id="wa-detailPeriod"></p></div>
    <form method="dialog"><button type="submit" aria-label="Fechar detalhamento">Fechar</button></form></div>
    <p id="wa-detailStatus" role="status"></p>
    <label id="wa-detailFilter" hidden>Buscar no detalhamento <input id="wa-detailSearch" type="search"></label>
    <div class="waste-audit-scroll" id="wa-detailRows"></div>
  </dialog>
  <section class="waste-section"><h3 id="wa-title"></h3><div class="waste-audit-scroll" id="wa-summary"></div></section>
  <section class="waste-section"><h3>Conciliação INDCOM</h3><div class="waste-audit-scroll" id="wa-indcom"></div></section>
  <details class="waste-section"><summary id="wa-bioTitle">Títulos BIOREVERSE</summary><div class="waste-audit-scroll" id="wa-bioFinance"></div></details>
  <details class="waste-section"><summary id="wa-dailyTitle">Conferência diária</summary><div class="waste-audit-scroll" id="wa-daily"></div></details>
  <details class="waste-section"><summary id="wa-pdfTitle">Manifestos</summary><div class="waste-audit-scroll" id="wa-pdf"></div></details>
  <section class="waste-section"><h3 id="wa-refsTitle">Documentos de referência</h3><ul id="wa-references"></ul>
    <p id="wa-downloadStatus" role="status"></p>
    <p class="waste-sub">Os links disponíveis abrem os pacotes de documentos da coletora. As fontes podem registrar a mesma coleta. Os manifestos usam a data do documento e o SEMAND usa a data do transporte ou da emissão. A coluna de arquivo identifica os PDFs do lote auditado.</p>
  </section>`;
  const el=id=>root.querySelector('#wa-'+id);
  const updateChart=mountWasteChart(el('chart'),data,annual);
  function referenceLink(key,label){
    const link=document.createElement('a');
    link.href='#wa-refsTitle';
    link.dataset.attachment=key;
    link.textContent=label;
    return link;
  }
  for(const [key,label] of Object.entries(references)){
    if(!Object.hasOwn(attachmentNames,key)) continue;
    const item=document.createElement('li');
    item.append(referenceLink(key,label));
    el('references').append(item);
  }
  root.onclick=async event=>{
    const link=event.target.closest('a');
    if(!link) return;
    const key=link.dataset.attachment;
    if(key&&Object.hasOwn(attachmentNames,key)){
      event.preventDefault();
      const status=link.closest('dialog')?el('detailStatus'):el('downloadStatus');
      status.textContent='Preparando documento…';
      try{await downloadDocument(key,attachmentNames[key]);status.textContent='Documento enviado para download.';}
      catch(error){status.textContent=error.message;}
    }else if(link.getAttribute('href')==='#wa-refsTitle'){
      event.preventDefault();
      el('refsTitle').scrollIntoView({block:'start'});
    }
  };

  const nf=new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const kg=x=>x===null?'—':nf.format(x/100);
  const date=s=>s.split('-').reverse().join('/');
  const monthName=s=>new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s+'-01T12:00:00Z'));
  const months=[...new Set(data.map(r=>r.d.slice(0,7)))];
  const columns=['Triagem GAO','SEMAND INDCOM','SEMAND BIOREVERSE','SEMAND total','MTR cancelado','PDFs INDCOM','Documentos BIOREVERSE','Documentos total'];
  const visibleMetrics=[0,4,5,6,7,8,10,11];
  const options=(node,items)=>node.replaceChildren(...items.map(([val,label])=>new Option(label,val)));
  options(el('month'),[['all','Todos os meses'],...months.map(m=>[m,monthName(m)+(m<'2026-08'?' · histórico':'')])]);
  let mode='monthly';
  function group(rows,key){
    const groups=new Map();
    for(const row of rows){
      const id=key(row);
      if(!groups.has(id))groups.set(id,[]);
      groups.get(id).push(row);
    }
    return [...groups];
  }
  function sum(rows,i){
    const values=rows.map(r=>r.v[i]).filter(x=>x!==null);
    return values.length?values.reduce((a,b)=>a+b,0):null;
  }
  function values(rows){
    const [t,si,sb,c,p]=[0,3,4,5,6].map(i=>sum(rows,i));
    const st=si===null&&sb===null?null:(si||0)+(sb||0);
    const bio=rows.filter(r=>r.bio).map(r=>r.bio[1]);
    const bp=bio.length?bio.reduce((a,b)=>a+b,0):null;
    const pdfTotal=p===null&&bp===null?null:(p||0)+(bp||0);
    return [t,null,null,null,si,sb,st,c,p,null,bp,pdfTotal];
  }
  const inMonth=()=>data.filter(r=>el('month').value==='all'||r.d.startsWith(el('month').value));
  const interval=rows=>date(rows[0].d)+' a '+date(rows.at(-1).d);
  function refreshWeeks(){
    options(el('week'),[['all','Todas as semanas'],...group(inMonth(),r=>r.w).map(([w,rs])=>[w,w+' · '+interval(rs)])]);
  }
  const bioArchiveByMonth={'2026-06':'june','2026-07':'july','2026-10':'october'};
  function evidence(key,label){
    if(!key || label==='—') return label;
    if(!Object.hasOwn(attachmentNames,key)) return label;
    return referenceLink(key,label);
  }
  function fillCell(cell,value){
    if(typeof value==='string') cell.textContent=value;
    else cell.append(value);
  }
  function table(node,labels,lines){
    const t=document.createElement('table'), head=t.createTHead().insertRow();
    t.className='waste-table';
    for(const label of labels){const th=document.createElement('th');th.scope='col';fillCell(th,label);head.append(th)}
    const body=t.createTBody();
    for(const line of lines){
      const tr=body.insertRow();
      for(const value of line){fillCell(tr.insertCell(),value)}
    }
    node.replaceChildren(t);
    return body;
  }
  function renderCollectionSchedule(){
    if(!annual||!crmTriage) return;
    const monthFilter=el('scheduleMonth');
    const companies=['Indicom','Bioreverse'];
    const weekday=new Intl.DateTimeFormat('pt-BR',{weekday:'short',timeZone:'UTC'});
    const end=annual.cutoff<crmTriage.cutoff?annual.cutoff:crmTriage.cutoff;
    const dayMap=new Map(data.filter(row=>row.crm_triage&&row.d>=crmTriage.start&&row.d<=end).map(row=>[row.d,{
      day:row.d,week:row.w,triaged:row.crm_triage[0],documented:[null,null]
    }]));
    for(const [index,source] of [annual.indicom,annual.bioreverse].entries()){
      for(const entry of source){
        const [day,week]=entry;
        const amount=index===0?entry[4]:entry[3];
        if(!day||day<crmTriage.start||day>end||amount==null) continue;
        if(!dayMap.has(day)) dayMap.set(day,{day,week,triaged:null,documented:[null,null]});
        const weights=dayMap.get(day).documented;
        weights[index]=(weights[index]??0)+amount;
      }
    }
    const days=[...dayMap.values()].sort((a,b)=>a.day.localeCompare(b.day));
    for(const row of days){
      row.calendarDay=new Date(row.day+'T12:00:00Z');
      const dayNumber=row.calendarDay.getUTCDay();
      row.expected=dayNumber===0?null:(dayNumber%2===1?0:1);
    }
    let nextIndicom=null;
    for(let i=days.length-1;i>=0;i--){
      const row=days[i];
      if(row.documented[0]>0) nextIndicom=row;
      if(row.expected===1&&!(row.documented[1]>0)) row.coverage=nextIndicom;
    }
    options(monthFilter,[['all','Todos os meses'],...annual.months.map(([month])=>[month,monthName(month)])]);
    const sumWeights=values=>{
      const available=values.filter(value=>value!=null);
      return available.length?available.reduce((a,b)=>a+b,0):null;
    };
    const renderSchedule=()=>{
      const scoped=days.filter(row=>monthFilter.value==='all'||row.day.startsWith(monthFilter.value));
      table(el('scheduleSummary'),['Coletora','Dias com peso na escala','Dias com peso fora da escala','Peso na escala (kg)','Peso fora da escala (kg)','Triagem nos dias coincidentes (kg)','Coletora nos dias coincidentes (kg)'],companies.map((company,index)=>{
        const on=scoped.filter(row=>row.expected===index&&row.documented[index]>0);
        const off=scoped.filter(row=>row.expected!==index&&row.documented[index]>0);
        const pairs=on.filter(row=>row.triaged!=null);
        return [company,String(on.length),String(off.length),kg(sumWeights(on.map(row=>row.documented[index]))),kg(sumWeights(off.map(row=>row.documented[index]))),
          kg(sumWeights(pairs.map(row=>row.triaged))),kg(sumWeights(pairs.map(row=>row.documented[index])))];
      }));
      const gaps=scoped.filter(row=>row.expected===1&&!(row.documented[1]>0));
      el('scheduleGapTitle').textContent='Lacunas da Bioreverse · '+gaps.length+' dias';
      if(gaps.length){
        table(el('scheduleGaps'),['Data prevista','Semana ISO','Triagem GAO (kg)','Registro da Bioreverse','Coleta Indicom para conferir','Peso dessa coleta Indicom (kg)'],gaps.map(row=>[
          date(row.day),row.week,kg(row.triaged),row.documented[1]===0?'Peso zero':'Sem registro',
          row.coverage?date(row.coverage.day)+(row.coverage.day===row.day?' · mesmo dia':''):'Sem coleta Indicom posterior no recorte',
          kg(row.coverage?.documented[0]??null)
        ]));
      }else{
        el('scheduleGaps').textContent='Nenhuma lacuna no recorte.';
      }
      table(el('scheduleDays'),['Data','Semana ISO','Dia','Coletora prevista','Triagem GAO (kg)','Indicom · PDF (kg)','Bioreverse · planilha (kg)','Coletora prevista − triagem (kg)','Conferência'],scoped.map(row=>{
        const off=row.documented.flatMap((value,index)=>index!==row.expected&&value>0?[companies[index]]:[]);
        const expectedWeight=row.expected==null?null:row.documented[row.expected];
        const delta=row.triaged!=null&&expectedWeight>0?expectedWeight-row.triaged:null;
        const notes=[];
        if(off.length) notes.push('Fora da escala: '+off.join(', '));
        if(row.triaged==null) notes.push('Sem peso de triagem');
        if(row.expected===1&&!(expectedWeight>0)){
          notes.push(row.documented[1]===0?'Bioreverse com peso zero':'Bioreverse sem registro');
          if(row.coverage) notes.push('Conferir cobertura Indicom em '+date(row.coverage.day));
        }else if(row.expected===0&&!(expectedWeight>0)) notes.push('Indicom sem peso positivo');
        return [date(row.day),row.week,weekday.format(row.calendarDay),companies[row.expected]??'Sem coleta prevista',kg(row.triaged),...row.documented.map(kg),
          kg(delta),notes.join(' · ')||'Data coincidente'];
      }));
    };
    monthFilter.onchange=renderSchedule;
    renderSchedule();
  }
  function renderTriageRates(){
    if(!annual||!crmTriage) return;
    const end=annual.cutoff<crmTriage.cutoff?annual.cutoff:crmTriage.cutoff;
    const crmDays=data.filter(row=>row.crm_triage&&row.d>=crmTriage.start&&row.d<=end);
    const weight=(rows,index)=>{
      const measured=rows.map(row=>row.crm_triage[index]).filter(value=>value!=null);
      return measured.length?measured.reduce((a,b)=>a+b,0):null;
    };
    const percent=(value,base)=>value!=null&&base>0?nf.format(value/base*100)+'%':'—';
    const signed=(value,format)=>value==null?'—':(value>0?'+':'')+format(value);
    const closure=(days,indicom,bioreverse)=>{
      const waste=weight(days,0),base=weight(days,1);
      const collected=indicom==null&&bioreverse==null?null:(indicom??0)+(bioreverse??0);
      const delta=waste!=null&&collected!=null?collected-waste:null;
      const partial=indicom==null||bioreverse==null;
      const within=waste>0&&delta!=null&&Math.abs(delta)*100<=waste*5;
      const status=waste==null||collected==null?'Sem base para comparar':waste<=0?'Lixo GAO zerado'
        :partial?'Conferência parcial':within?'Dentro da tolerância':'Fora da tolerância';
      return {waste,base,collected,delta,status};
    };
    const metrics=(days,indicom,bioreverse)=>{
      const {waste,base,collected,delta,status}=closure(days,indicom,bioreverse);
      return [kg(base),percent(waste,base),percent(bioreverse,base),percent(indicom,base),percent(collected,base),
        signed(delta,kg),signed(delta,value=>percent(value,waste)),status];
    };
    const labels=['Peso total triado (kg)','Lixo GAO','Bioreverse','Indicom','Soma das coletoras','Diferença (kg)','Desvio sobre lixo GAO','Situação'];
    const sumDocumentColumn=i=>{
      const weights=annual.months.map(row=>row[i]).filter(weight=>weight!=null);
      return weights.length?weights.reduce((total,weight)=>total+weight,0):null;
    };
    const indicom=sumDocumentColumn(1),bioreverse=sumDocumentColumn(5);
    const summary=closure(crmDays,indicom,bioreverse);
    const cards=[
      ['Lixo triado GAO',kg(summary.waste)+' kg'],
      ['Indicom + Bioreverse',kg(summary.collected)+' kg'],
      ['Desvio sobre lixo GAO',signed(summary.delta,value=>percent(value,summary.waste))],
      ['Fechamento',summary.status]
    ];
    el('closureCards').replaceChildren(...cards.map(([label,value])=>{
      const card=document.createElement('div');
      card.className='waste-kpi';
      const caption=document.createElement('span');
      caption.textContent=label;
      const amount=document.createElement('strong');
      amount.textContent=value;
      card.append(caption,amount);
      return card;
    }));
    el('closureRange').textContent=summary.waste>0?'Acumulado até '+date(end)+' · Faixa aceitável de '+kg(summary.waste*.95)+' a '+kg(summary.waste*1.05)+' kg.':'';
    const monthly=table(el('ratesMonths'),['Mês',...labels],[
      ...annual.months.map(row=>[monthName(row[0]),...metrics(crmDays.filter(day=>day.d.startsWith(row[0])),row[1],row[5])]),
      ['Acumulado até '+date(end),...metrics(crmDays,indicom,bioreverse)]
    ]);
    monthly.lastElementChild.className='total';
    table(el('ratesWeeks'),['Mês','Semana ISO',...labels],annual.weeks.map(row=>[
      monthName(row[0]),row[1],...metrics(crmDays.filter(day=>day.d.startsWith(row[0])&&day.w===row[1]),row[2],row[6])
    ]));
  }
  function renderAnnual(){
    if(!annual) return;
    renderTriageRates();
    renderCollectionSchedule();
    el('annualCutoff').textContent='Documentos disponíveis até '+date(annual.cutoff)+'. Os pesos em conferência aparecem nas colunas de pendências.';
    const triaged=data.filter(row=>row.d.startsWith('2026-')&&row.v[0]!=null);
    const totalTriaged=sum(triaged,0);
    el('annualTriage').textContent=triaged.length
      ?(crmTriage?'CRM GAO · Triagem: ':'Triagem GAO: ')+kg(totalTriaged)+' kg registrados de '+date(triaged[0].d)+' a '+date(triaged.at(-1).d)+(crmTriage?'. Consulta até '+date(crmTriage.cutoff)+'.':'.')
      :'Sem dados de triagem GAO no ano.';
    const monthWeight=key=>sum(triaged.filter(row=>row.d.startsWith(key)),0);
    const labels=['Triagem GAO (kg)','PDFs Indicom (kg)','Indicom · lote validado (kg)','Indicom · histórico anterior (kg)',
      'Indicom · possível duplicidade (kg)','Bioreverse · fornecedor (kg)','Bioreverse · histórico ou MTR-GO recebido (kg)',
      'Bioreverse · sem comprovante por coleta (kg)','PDFs Indicom indisponíveis','Registros somente GAO'];
    const metrics=row=>[...row.slice(0,7).map(kg),...row.slice(7,9).map(String)];
    const total=Array.from({length:9},(_,i)=>annual.months.reduce((sum,row)=>sum+(row[i+1]??0),0));
    const monthly=table(el('annualMonths'),['Mês',...labels,'Cobertura'],[
      ...annual.months.map(([month,...row])=>[monthName(month),kg(monthWeight(month)),...metrics(row),row[9]??'—']),
      ['Acumulado',kg(totalTriaged),...metrics(total),'Até '+date(annual.cutoff)]
    ]);
    monthly.lastElementChild.className='total';
    table(el('annualWeeks'),['Mês','Semana ISO',...labels],annual.weeks.map(([month,week,...row])=>[monthName(month),week,kg(sum(triaged.filter(record=>record.d.startsWith(month)&&record.w===week),0)),...metrics(row)]));
    table(el('annualIndicom'),['Data','Semana ISO','MTR','OS','Peso (kg)','Conferência','PDF de origem'],
      annual.indicom.map(([day,week,mtr,os,weight,status,file])=>[date(day),week,mtr,os??'—',kg(weight),status,file??'—']));
    table(el('annualBio'),['Data','Semana ISO','NF','Peso do fornecedor (kg)','Conferência','Linha na planilha'],
      annual.bioreverse.map(([day,week,nf,weight,status,line])=>[day?date(day):'—',week??'—',nf??'—',kg(weight),status,String(line)]));
  }
  function renderIndcom(){
    const month=el('month').value;
    const lines=indcomAudit.filter(([m])=>month==='all'||m===month).map(([m,est,doc,source,status])=>{
      const v=values(data.filter(r=>r.d.startsWith(m)));
      const diff=est===null||doc===null?null:est-doc;
      const sourceKey=m==='2026-10'?'indcomInvoice':m==='2026-11'?'workbook':'indcom';
      return [monthName(m)+(m==='2026-11'?' · parcial':''),evidence('indcomFinance',kg(est)),kg(doc),diff>0?'+'+kg(diff):kg(diff),
        evidence(sourceKey,source),evidence('indcom',kg(v[8])),evidence('workbook',kg(v[4])),status];
    });
    if(!lines.length){el('indcom').textContent='Sem conciliação INDCOM neste mês.';return}
    const body=table(el('indcom'),['Mês da coleta','Estimado pelo valor','Apurado','Diferença','Fonte da apuração','PDFs','SEMAND','Resultado'],lines);
    for(const row of body.rows){
      const delta=row.cells[3];
      delta.className=delta.textContent.startsWith('+')?'pos':delta.textContent.startsWith('-')?'neg':'';
    }
  }
  const bioTitles = billingTitles.map(([due,cents,inOriginalTotal])=>{
    const [year,month] = due.split('-').map(Number);
    const competence = new Date(Date.UTC(year,month-2,1)).toISOString().slice(0,7);
    return [competence,due,cents,inOriginalTotal];
  });
  function renderBioFinance(){
    const estimate = cents => kg(cents / 1.70);
    const lines = bioTitles.map(([month,due,cents,inOriginalTotal])=>{
      const pdf = values(data.filter(r=>r.d.startsWith(month)))[10];
      return [monthName(month),date(due),evidence('bioFinance','R$ '+kg(cents)),estimate(cents),evidence(bioArchiveByMonth[month],kg(pdf)),
        month==='2026-09'?evidence('bioInvoice','NF 26748 e vencimento'):'Mês anterior ao vencimento',
        inOriginalTotal?'Incluído no total anterior':'Título adicional'];
    });
    const original = bioTitles.filter(row=>row[3]).reduce((total,row)=>total+row[2],0);
    const additional = bioTitles.filter(row=>!row[3]).reduce((total,row)=>total+row[2],0);
    lines.push(['Total anterior','','R$ '+kg(original),estimate(original),'','','']);
    lines.push(['Títulos adicionais','','R$ '+kg(additional),estimate(additional),'','','']);
    const body=table(el('bioFinance'),['Competência','Vencimento','Valor do título','Estimado (kg)','Peso documental (kg)','Base da competência','Composição do total'],lines);
    body.rows[body.rows.length-2].className='total';
    body.lastElementChild.className='total';
  }
  const sourceCache=new Map();
  function sourceRecords(name){
    if(!sourceCache.has(name)){
      sourceCache.set(name,loadSource(name).catch(error=>{sourceCache.delete(name);throw error;}));
    }
    return sourceCache.get(name);
  }
  const sourceDetails={
    0:{name:'triagem',headers:['Data','Comanda','Cliente','Sequência','Hora da triagem','Equipe','Bruto (kg)','Líquido (kg)','Linha original'],
      row:r=>[date(r[0]),r[1],r[2],r[3],r[4],r[5],kg(r[6]),kg(r[7]),r[8]]},
    6:{name:'semand',headers:['Data de referência','MTR','Transportadora','Fluxo','Situação','CDF','Indicado (kg)','Recebido (kg)','Considerado (kg)'],
      include:r=>r[4]==='Recebido'||r[4]==='Salvo',
      row:r=>[date(r[0]),r[1],r[2],r[3],r[4],r[5]??'—',kg(r[6]),kg(r[7]),kg(r[4]==='Recebido'?r[7]:r[6])]},
  };
  let detailRequest=0;
  async function openDetail(id,label,weight,selected,pdfs){
    const request=++detailRequest;
    const dialog=el('detail'),status=el('detailStatus'),container=el('detailRows'),filter=el('detailFilter'),search=el('detailSearch');
    el('detailTitle').textContent=label+' · '+weight;
    const month=el('month').selectedOptions[0].textContent;
    const week=el('week').selectedOptions[0].textContent;
    el('detailPeriod').textContent=id==='bio'?month+' · competência mensal completa':month+' · '+week;
    status.textContent='Carregando registros…';
    container.replaceChildren();
    filter.hidden=true;
    search.value='';
    dialog.showModal();
    try{
      let headers,lines;
      const source=sourceDetails[id];
      if(id===0&&crmTriage){
        headers=['Data','Semana ISO','Lixo triado (kg)','Total da triagem (kg)','% de lixo','Situação'];
        lines=selected.filter(row=>row.crm_triage).map(row=>{
          const [waste,total]=row.crm_triage;
          return [date(row.d),row.w,kg(waste),kg(total),waste!==null&&total>0?nf.format(waste/total*100)+'%':'—',
            waste===null?'Sem lançamento no CRM':'CRM GAO · Triagem'];
        });
      }else if(source){
        const dates=new Set(selected.map(r=>r.d));
        headers=source.headers;
        lines=(await sourceRecords(source.name)).filter(r=>dates.has(r[0])&&(!source.include||source.include(r))).map(source.row);
      }else if(id===8||id===10||id===11){
        headers=['Data','Semana ISO','Empresa','Manifesto ou arquivo','OS','Peso (kg)'];
        lines=pdfs().filter(row=>id===11||row[2]===(id===8?'INDCOM':'BIOREVERSE'));
      }
      if(!dialog.open||request!==detailRequest) return;
      const searchable=lines.map(row=>row.map(value=>value?.textContent??String(value)).join(' ').toLocaleLowerCase('pt-BR'));
      const renderRows=()=>{
        const term=search.value.trim().toLocaleLowerCase('pt-BR');
        const visible=term?lines.filter((_,index)=>searchable[index].includes(term)):lines;
        status.textContent=visible.length?visible.length+' registro(s) no recorte.':'Nenhum registro encontrado neste recorte.';
        if(visible.length) table(container,headers,visible);
        else container.replaceChildren();
      };
      filter.hidden=lines.length<2;
      search.oninput=renderRows;
      renderRows();
    }catch(error){if(dialog.open&&request===detailRequest) status.textContent=error.message;}
  }
  function detailCard(card,id,label,weight,selected,pdfs){
    card.type='button';
    card.classList.add('waste-audit-detail-card');
    card.setAttribute('aria-label',label+', '+weight+'. Ver registros de origem.');
    card.setAttribute('aria-haspopup','dialog');
    const action=document.createElement('small');
    action.className='waste-audit-card-action';
    action.textContent='Ver origem';
    card.append(action);
    card.onclick=()=>openDetail(id,label,weight,selected,pdfs);
    return card;
  }

  function render(){
    renderIndcom();
    const selected=inMonth().filter(r=>el('week').value==='all'||r.w===el('week').value);
    const totals=values(selected);
    const month = el('month').value;
    const bioPeriod = bioTitles.filter(([competence]) =>
      month === 'all' ? months.includes(competence) : competence === month
    );
    const bioCents = bioPeriod.reduce((total,[,,cents]) => total + cents,0);
    el('bioTitle').textContent='Títulos BIOREVERSE · '+(bioPeriod.length?kg(bioCents/1.70)+' kg estimados':'sem título no mês');
    updateChart(selected,el('month').value,el('week').value);
    const bioEvidence=r=>{
      const link=evidence(bioArchiveByMonth[r.d.slice(0,7)],r.bio[0]);
      if(!r.bio_correction)return link;
      const cell=document.createElement('span');
      cell.append(document.createTextNode(r.bio_correction.source+' · '+r.bio_correction.reference+' · PDF original '+kg(r.bio_correction.original_centi_kg)+' kg ('),link,document.createTextNode(')'));
      return cell;
    };
    const pdfs=()=>selected.flatMap(r=>[
      ...r.pdf.map(([n,os,p,archive])=>[date(r.d),r.w,'INDCOM',archive?n+' · '+archive:evidence('indcom',n),os,kg(p)]),
      ...(r.bio?[[date(r.d),r.w,'BIOREVERSE',bioEvidence(r),'—',kg(r.bio[1])]]:[])
    ]);
    el('cards').replaceChildren(...[0,6,8,10,11].map(i=>{
      const card=document.createElement('button');
      card.className='waste-kpi'+([3,6].includes(i)?' waste-audit-emphasis':'');
      const title=document.createElement('span'), value=document.createElement('strong');
      title.textContent=columns[visibleMetrics.indexOf(i)];value.textContent=totals[i]===null?'Sem dados':kg(totals[i])+' kg';
      card.append(title,value);
      return detailCard(card,i,title.textContent,value.textContent,selected,pdfs);
    }));
    const weekly=mode==='weekly';
    el('title').textContent=(weekly?'Resumo por semana ISO':'Resumo mensal')+' · kg';
    const groups=group(selected,r=>weekly?r.w:r.d.slice(0,7));
    const lines=groups.map(([k,rs])=>[weekly?k:monthName(k),interval(rs),...visibleMetrics.map(i=>kg(values(rs)[i]))]);
    const linkedColumns=columns.map((label,column)=>{
      const index=visibleMetrics[column];
      if(index===8||(index===0&&crmTriage)) return label;
      if(index===10||index===11) {
        const link=document.createElement('a');
        link.href='#wa-refsTitle';
        link.textContent=label;
        return link;
      }
      return evidence('workbook',label);
    });
    const body=table(el('summary'),[weekly?'Semana ISO':'Mês','Datas no recorte',...linkedColumns],[...lines,['Total','',...visibleMetrics.map(i=>kg(totals[i]))]]);
    body.lastElementChild.className='total';
    table(el('daily'),['Data','Semana ISO',...linkedColumns.map(link=>typeof link==='string'?link:link.cloneNode(true))],selected.map(r=>[date(r.d),r.w,...visibleMetrics.map(i=>kg(values([r])[i]))]));
    el('dailyTitle').textContent='Conferência por data · '+selected.length+' dias';
    const manifests=pdfs();
    el('pdfTitle').textContent='Manifestos INDCOM e BIOREVERSE · '+manifests.length+' documentos';
    if(manifests.length) table(el('pdf'),['Data','Semana ISO','Empresa','Manifesto ou arquivo','OS','Peso (kg)'],manifests);
    else el('pdf').textContent='Nenhum manifesto no recorte.';
  }
  el('month').onchange=()=>{refreshWeeks();render()};
  el('week').onchange=()=>{if(el('week').value!=='all')setMode('weekly');else render()};
  function setMode(next){
    mode=next;
    for(const id of ['monthly','weekly'])el(id).setAttribute('aria-pressed',String(id===mode));
    render();
  }
  el('monthly').onclick=()=>setMode('monthly');
  el('weekly').onclick=()=>setMode('weekly');
  renderAnnual();renderBioFinance();refreshWeeks();render();
}
