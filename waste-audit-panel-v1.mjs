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
  root.innerHTML=`<div class="waste-audit-filters">
    <label>Mês <select id="wa-month"></select></label>
    <label>Semana ISO <select id="wa-week"></select></label>
    <div class="waste-audit-mode">
      <button type="button" id="wa-monthly" aria-pressed="true">Por mês</button>
      <button type="button" id="wa-weekly" aria-pressed="false">Por semana ISO</button>
    </div>
  </div>
  <div id="wa-cards" class="waste-grid"></div>
  <dialog id="wa-detail" class="waste-audit-dialog" aria-labelledby="wa-detailTitle">
    <div class="waste-audit-dialog-head"><div><h3 id="wa-detailTitle"></h3><p id="wa-detailPeriod"></p></div>
    <form method="dialog"><button type="submit" aria-label="Fechar detalhamento">Fechar</button></form></div>
    <p id="wa-detailStatus" role="status"></p>
    <label id="wa-detailFilter" hidden>Buscar no detalhamento <input id="wa-detailSearch" type="search"></label>
    <div class="waste-audit-scroll" id="wa-detailRows"></div>
  </dialog>
  <section class="waste-section"><h3 id="wa-title"></h3><div class="waste-audit-scroll" id="wa-summary"></div></section>
  <section class="waste-section"><h3>Conciliação INDCOM</h3><div class="waste-audit-scroll" id="wa-indcom"></div></section>
  <details class="waste-section"><summary>Títulos BIOREVERSE</summary><div class="waste-audit-scroll" id="wa-bioFinance"></div></details>
  <details class="waste-section"><summary id="wa-dailyTitle">Conferência diária</summary><div class="waste-audit-scroll" id="wa-daily"></div></details>
  <details class="waste-section"><summary id="wa-pdfTitle">Manifestos</summary><div class="waste-audit-scroll" id="wa-pdf"></div></details>
  <section class="waste-section"><h3 id="wa-refsTitle">Documentos de referência</h3><ul id="wa-references"></ul>
    <p id="wa-downloadStatus" role="status"></p>
    <p class="waste-sub">Os manifestos abrem o pacote da coletora. Use o identificador da linha para localizar o PDF. As fontes podem registrar a mesma coleta. Os PDFs usam a data do manifesto, o Forms usa a data da coleta e o SEMAND usa a data do transporte ou da emissão.</p>
  </section>`;
  const el=id=>root.querySelector('#wa-'+id);
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
  const columns=['Triagem','Forms INDCOM','Forms BIOREVERSE','Forms total','SEMAND INDCOM','SEMAND BIOREVERSE','SEMAND total','MTR cancelado','PDFs INDCOM','Triagem − Forms','PDFs BIOREVERSE','PDFs total'];
  const options=(node,items)=>node.replaceChildren(...items.map(([val,label])=>new Option(label,val)));
  options(el('month'),[['all','Todos os meses · junho a novembro de 2026'],...months.map(m=>[m,monthName(m)+(m<'2026-08'?' · histórico':'')])]);
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
    const [t,fi,fb,si,sb,c,p,f]=Array.from({length:8},(_,i)=>sum(rows,i));
    const st=si===null&&sb===null?null:(si||0)+(sb||0);
    const bio=rows.filter(r=>r.bio).map(r=>r.bio[1]);
    const bp=bio.length?bio.reduce((a,b)=>a+b,0):null;
    const pdfTotal=p===null&&bp===null?null:(p||0)+(bp||0);
    return [t,fi,fb,f,si,sb,st,c,p,t===null||f===null?null:t-f,bp,pdfTotal];
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
  function renderIndcom(){
    const month=el('month').value;
    const lines=indcomAudit.filter(([m])=>month==='all'||m===month).map(([m,est,doc,source,status])=>{
      const v=values(data.filter(r=>r.d.startsWith(m)));
      const diff=est===null||doc===null?null:est-doc;
      const sourceKey=m==='2026-10'?'indcomInvoice':m==='2026-11'?'workbook':'indcom';
      return [monthName(m)+(m==='2026-11'?' · parcial':''),evidence('indcomFinance',kg(est)),kg(doc),diff>0?'+'+kg(diff):kg(diff),
        evidence(sourceKey,source),evidence('indcom',kg(v[8])),evidence('workbook',kg(v[1])),evidence('workbook',kg(v[4])),status];
    });
    if(!lines.length){el('indcom').textContent='Sem conciliação INDCOM neste mês.';return}
    const body=table(el('indcom'),['Mês da coleta','Estimado pelo valor','Apurado','Diferença','Fonte da apuração','PDFs','Forms','SEMAND','Resultado'],lines);
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
    const body=table(el('bioFinance'),['Competência','Vencimento','Valor do título','Estimado (kg)','PDFs (kg)','Base da competência','Composição do total'],lines);
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
    3:{name:'forms',headers:['Data da coleta','Coletora','Linha original','Registro no Forms','Carrinhos','Peso (kg)','Foto referenciada'],
      row:r=>[date(r[0]),r[1],r[2],r[3],r[4]??'—',kg(r[5]),r[6]]},
    6:{name:'semand',headers:['Data de referência','MTR','Transportadora','Fluxo','Situação','CDF','Indicado (kg)','Recebido (kg)','Considerado (kg)'],
      include:r=>r[4]==='Recebido'||r[4]==='Salvo',
      row:r=>[date(r[0]),r[1],r[2],r[3],r[4],r[5]??'—',kg(r[6]),kg(r[7]),kg(r[4]==='Recebido'?r[7]:r[6])]},
  };
  let detailRequest=0;
  async function openDetail(id,label,weight,selected,bioPeriod,pdfs){
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
      if(source){
        const dates=new Set(selected.map(r=>r.d));
        headers=source.headers;
        lines=(await sourceRecords(source.name)).filter(r=>dates.has(r[0])&&(!source.include||source.include(r))).map(source.row);
      }else if(id===11){
        headers=['Data','Semana ISO','Empresa','Manifesto ou arquivo','OS','Peso (kg)'];
        lines=pdfs();
      }else if(id==='bio'){
        headers=['Competência','Vencimento','Valor do título','Peso estimado (kg)','Comprovante'];
        lines=bioPeriod.map(([competence,due,cents])=>[monthName(competence),date(due),'R$ '+kg(cents),kg(cents/1.70),
          evidence('bioFinance','Registro financeiro')]);
      }else{
        headers=['Data','Semana ISO','Triagem (kg)','Forms (kg)','Diferença (kg)'];
        lines=selected.filter(r=>r.v[0]!==null||r.v[7]!==null).map(r=>{
          const v=values([r]);
          return [date(r.d),r.w,kg(v[0]),kg(v[3]),kg(v[9])];
        });
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
  function detailCard(card,id,label,weight,selected,bioPeriod,pdfs){
    card.type='button';
    card.classList.add('waste-audit-detail-card');
    card.setAttribute('aria-label',label+', '+weight+'. Ver registros de origem.');
    card.setAttribute('aria-haspopup','dialog');
    const action=document.createElement('small');
    action.className='waste-audit-card-action';
    action.textContent='Ver origem';
    card.append(action);
    card.onclick=()=>openDetail(id,label,weight,selected,bioPeriod,pdfs);
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
    const bioCard = document.createElement('button');
    bioCard.className = 'waste-kpi waste-audit-emphasis';
    const bioLabel = document.createElement('span');
    const bioWeight = document.createElement('strong');
    const bioDetail = document.createElement('small');
    bioLabel.textContent = 'BIOREVERSE · Peso estimado';
    bioWeight.textContent = bioPeriod.length ? kg(bioCents / 1.70) + ' kg' : 'Sem título';
    bioDetail.textContent = 'Valor dos títulos ÷ R$ 1,70/kg · competência mensal completa';
    bioCard.append(bioLabel,bioWeight,bioDetail);
    const pdfs=()=>selected.flatMap(r=>[
      ...r.pdf.map(([n,os,p])=>[date(r.d),r.w,'INDCOM',evidence('indcom',n),os,kg(p)]),
      ...(r.bio?[[date(r.d),r.w,'BIOREVERSE',evidence(bioArchiveByMonth[r.d.slice(0,7)],r.bio[0]),'—',kg(r.bio[1])]]:[])
    ]);
    el('cards').replaceChildren(...[0,3,6,11,'bio',9].map(i=>{
      if(i === 'bio') return detailCard(bioCard,i,bioLabel.textContent,bioWeight.textContent,selected,bioPeriod,pdfs);
      const card=document.createElement('button');
      card.className='waste-kpi'+([3,6].includes(i)?' waste-audit-emphasis':'');
      const title=document.createElement('span'), value=document.createElement('strong');
      title.textContent=columns[i];value.textContent=totals[i]===null?'Sem dados':kg(totals[i])+' kg';
      card.append(title,value);
      if(i===11){
        title.textContent='PDFs · INDCOM + BIOREVERSE';
        const detail=document.createElement('small');
        detail.textContent='INDCOM '+(totals[8]===null?'sem PDFs':kg(totals[8])+' kg')+' · BIOREVERSE '+(totals[10]===null?'sem PDFs':kg(totals[10])+' kg');
        card.append(detail);
      }
      return detailCard(card,i,title.textContent,value.textContent,selected,bioPeriod,pdfs);
    }));
    const weekly=mode==='weekly';
    el('title').textContent=(weekly?'Resumo por semana ISO':'Resumo mensal')+' · kg';
    const groups=group(selected,r=>weekly?r.w:r.d.slice(0,7));
    const lines=groups.map(([k,rs])=>[weekly?k:monthName(k),interval(rs),...values(rs).map(kg)]);
    const linkedColumns=columns.map((label,index)=>{
      if(index===8) return evidence('indcom',label);
      if(index===10||index===11) {
        const link=document.createElement('a');
        link.href='#wa-refsTitle';
        link.textContent=label;
        return link;
      }
      return evidence('workbook',label);
    });
    const body=table(el('summary'),[weekly?'Semana ISO':'Mês','Datas no recorte',...linkedColumns],[...lines,['Total','',...totals.map(kg)]]);
    body.lastElementChild.className='total';
    table(el('daily'),['Data','Semana ISO',...linkedColumns.map(link=>link.cloneNode(true))],selected.map(r=>[date(r.d),r.w,...values([r]).map(kg)]));
    el('dailyTitle').textContent='Conferência por data · '+selected.length+' dias';
    const manifests=pdfs();
    el('pdfTitle').textContent='Manifestos INDCOM e BIOREVERSE · '+manifests.length+' PDFs únicos';
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
  renderBioFinance();refreshWeeks();render();
}
