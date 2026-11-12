// The audit snapshot provides data and documents. Rendering stays in Portal code.
function readConstant(source,name){
  const match=source.match(new RegExp('^const '+name+'\\s*=\\s*(.*?)(?:;|\\.map\\()', 'ms'));
  if(!match) throw Error('O histórico está incompleto.');
  return JSON.parse(match[1].replace(/'([^'\\]*)'/g,(_,value)=>JSON.stringify(value)));
}
function downloadAttachment(snapshot,name){
  const start=snapshot.indexOf('id="file-'+name+'">');
  if(start<0) return;
  const from=snapshot.indexOf('>',start)+1;
  const base64=snapshot.slice(from,snapshot.indexOf('</script>',from));
  const chunks=[];
  for(let offset=0;offset<base64.length;offset+=65536){
    const decoded=atob(base64.slice(offset,offset+65536));
    chunks.push(Uint8Array.from(decoded,character=>character.charCodeAt(0)));
  }
  return new Blob(chunks,{type:'application/octet-stream'});
}
export function mountAudit(host,snapshot,theme,saveBlob){
  const script=snapshot.slice(snapshot.lastIndexOf('<script>')+8,snapshot.lastIndexOf('</script>'));
  const data=JSON.parse(script.match(/^const data=(.*);$/m)[1]);
  const attachmentNames=JSON.parse(script.match(/^const attachmentNames = (.*);$/m)[1]);
  const indcomAudit=readConstant(script,'indcomAudit');
  const billingTitles=readConstant(script,'bioTitles');
  const root=host.attachShadow({mode:'open'});
  const style=document.createElement('style');
  const originalStyle=snapshot.match(/<style>(.*?)<\/style>/s)[1].replace(':root',':host');
  const scopedTheme=theme
    .replaceAll(':root',':host')
    .replaceAll('html.liquid-lite-audit body > header','.liquid-lite-audit > header')
    .replace('html.liquid-lite-audit {',':host {')
    .replaceAll('html.liquid-lite-audit','.liquid-lite-audit');
  style.textContent=originalStyle+'\n'+scopedTheme+'\n:host{display:block;min-width:0} main{padding-inline:0}';
  const layout=document.createElement('section');
  layout.className='liquid-lite-audit';
  // The caller verifies the snapshot checksum before mounting its static markup.
  layout.innerHTML=snapshot.slice(snapshot.indexOf('<header>'),snapshot.indexOf('</main>')+7);
  root.append(style,layout);
  root.addEventListener('click',event=>{
    const link=event.target.closest('a');
    if(!link) return;
    const key=link.dataset.attachment;
    if(key&&Object.hasOwn(attachmentNames,key)){
      event.preventDefault();
      const blob=downloadAttachment(snapshot,key);
      if(blob) saveBlob(blob,attachmentNames[key]);
    }else if(link.getAttribute('href')==='#refsTitle'){
      event.preventDefault();
      root.getElementById('refsTitle').scrollIntoView({block:'start'});
    }
  });

  const el=id=>root.getElementById(id);
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
    const source=el('ref-'+key);
    const link=source.cloneNode(false);
    link.removeAttribute('id');
    link.textContent=label;
    link.title='Baixar '+source.textContent;
    return link;
  }
  function fillCell(cell,value){
    if(typeof value==='string') cell.textContent=value;
    else cell.append(value);
  }
  function table(node,labels,lines){
    const t=document.createElement('table'), head=t.createTHead().insertRow();
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
  function render(){
    renderIndcom();
    const selected=inMonth().filter(r=>el('week').value==='all'||r.w===el('week').value);
    const totals=values(selected);
    const month = el('month').value;
    const bioPeriod = bioTitles.filter(([competence]) =>
      month === 'all' ? months.includes(competence) : competence === month
    );
    const bioCents = bioPeriod.reduce((total,[,,cents]) => total + cents,0);
    const bioCard = document.createElement('div');
    bioCard.className = 'card key';
    const bioLabel = document.createElement('span');
    const bioWeight = document.createElement('strong');
    const bioDetail = document.createElement('small');
    bioLabel.textContent = 'BIOREVERSE · Peso estimado';
    bioWeight.textContent = bioPeriod.length ? kg(bioCents / 1.70) + ' kg' : 'Sem título';
    bioDetail.textContent = 'Valor dos títulos ÷ R$ 1,70/kg · competência mensal completa';
    bioCard.append(bioLabel,bioWeight,bioDetail);
    el('cards').replaceChildren(...[0,3,6,11,'bio',9].map(i=>{
      if(i === 'bio') return bioCard;
      const card=document.createElement('div');
      card.className='card'+([3,6].includes(i)?' key':'');
      const title=document.createElement('span'), value=document.createElement('strong');
      title.textContent=columns[i];value.textContent=totals[i]===null?'Sem dados':kg(totals[i])+' kg';
      card.append(title,value);
      if(i===11){
        title.textContent='PDFs · INDCOM + BIOREVERSE';
        const detail=document.createElement('small');
        detail.textContent='INDCOM '+(totals[8]===null?'sem PDFs':kg(totals[8])+' kg')+' · BIOREVERSE '+(totals[10]===null?'sem PDFs':kg(totals[10])+' kg');
        card.append(detail);
      }
      return card;
    }));
    const weekly=mode==='weekly';
    el('title').textContent=(weekly?'Resumo por semana ISO':'Resumo mensal')+' · kg';
    const groups=group(selected,r=>weekly?r.w:r.d.slice(0,7));
    const lines=groups.map(([k,rs])=>[weekly?k:monthName(k),interval(rs),...values(rs).map(kg)]);
    const linkedColumns=columns.map((label,index)=>{
      if(index===8) return evidence('indcom',label);
      if(index===10||index===11) {
        const link=document.createElement('a');
        link.href='#refsTitle';
        link.textContent=label;
        return link;
      }
      return evidence('workbook',label);
    });
    const body=table(el('summary'),[weekly?'Semana ISO':'Mês','Datas no recorte',...linkedColumns],[...lines,['Total','',...totals.map(kg)]]);
    body.lastElementChild.className='total';
    table(el('daily'),['Data','Semana ISO',...linkedColumns.map(link=>link.cloneNode(true))],selected.map(r=>[date(r.d),r.w,...values([r]).map(kg)]));
    el('dailyTitle').textContent='Conferência por data · '+selected.length+' dias';
    const pdfs=selected.flatMap(r=>[
      ...r.pdf.map(([n,os,p])=>[date(r.d),r.w,'INDCOM',evidence('indcom',n),os,kg(p)]),
      ...(r.bio?[[date(r.d),r.w,'BIOREVERSE',evidence(bioArchiveByMonth[r.d.slice(0,7)],r.bio[0]),'—',kg(r.bio[1])]]:[])
    ]);
    el('pdfTitle').textContent='Manifestos INDCOM e BIOREVERSE · '+pdfs.length+' PDFs únicos';
    if(pdfs.length) table(el('pdf'),['Data','Semana ISO','Empresa','Manifesto ou arquivo','OS','Peso (kg)'],pdfs);
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
