(()=>{'use strict';
const HASH='#relave', STORE='gao.chemicals.relave.v118', DATA='/assets/relave-gao-2026.json';
const n=v=>Number(String(v??'').replace(',','.'))||0, fmt=(v,d=2)=>Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}), pct=v=>fmt(v*100,2)+'%', esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fields={
 surgical:[['surgicalOil','Óleo'],['surgicalBlood','Sangue'],['surgicalTorn','Rasgado'],['surgicalResidue','Resíduo'],['surgicalClean','Limpo'],['surgicalGlue','Cola / fita'],['surgicalPermanent','Permanente']],
 sheet:[['sheetYellow','Amarelo'],['sheetBlood','Sangue'],['sheetTorn','Rasgado'],['sheetResidue','Resíduo'],['sheetClean','Limpo'],['sheetGlue','Cola / fita'],['sheetPermanent','Permanente'],['sheetIroning','Passadoria'],['sheetInk','Tinta'],['sheetKnot','Nó']]
};
const chtKeys=['surgicalOil','surgicalBlood','surgicalResidue','sheetYellow','sheetBlood','sheetResidue'];
const gaoKeys=['surgicalTorn','surgicalClean','surgicalGlue','surgicalPermanent','sheetTorn','sheetClean','sheetGlue','sheetPermanent','sheetIroning','sheetInk','sheetKnot'];
let historical=[], mounted=false;
function calc(x){const sum=ks=>ks.reduce((a,k)=>a+n(x[k]),0),cht=sum(chtKeys),gao=sum(gaoKeys),other=n(x.otherRelave),priv=n(x.privateRelave),total=cht+gao+other+priv,tri=n(x.totalSorted);return {...x,chtKg:cht,gaoKg:gao,relaveTotal:total,pctTotal:tri?total/tri:0,pctCHT:tri?cht/tri:0,pctGAO:tri?gao/tri:0,sheetTotal:sum(fields.sheet.map(x=>x[0])),surgicalTotal:sum(fields.surgical.map(x=>x[0]))}}
function local(){try{return JSON.parse(localStorage.getItem(STORE)||'{}').entries||[]}catch{return[]}}
function all(){const map=new Map();historical.forEach(x=>map.set('h:'+x.date+':'+x.command,x));local().forEach(x=>map.set('l:'+x.id,x));return [...map.values()].map(calc).sort((a,b)=>String(a.date).localeCompare(String(b.date)))}
function weekNo(date){const d=new Date(date+'T12:00:00'),jan=new Date(d.getFullYear(),0,1);return Math.ceil((((d-jan)/86400000)+jan.getDay()+1)/7)}
function saveEntry(x){const st=(()=>{try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch{return{}}})();st.entries=Array.isArray(st.entries)?st.entries:[];st.entries.push(x);st.updatedAt=new Date().toISOString();localStorage.setItem(STORE,JSON.stringify(st))}
function css(){if(document.getElementById('rel118css'))return;const s=document.createElement('style');s.id='rel118css';s.textContent=`
#rel118{font-family:inherit;color:#082f55}.r118-tabs{display:flex;gap:8px;margin:0 0 18px}.r118-tabs button{border:1px solid #b8d4ea;background:#fff;color:#173f63;border-radius:10px;padding:10px 16px;font-weight:800;cursor:pointer}.r118-tabs button.active{background:#3193d0;color:#fff;border-color:#3193d0}.r118-card{background:#fff;border:1px solid #cfe0ed;border-radius:16px;padding:22px;margin-bottom:18px;box-shadow:0 10px 28px #163b5c0b}.r118-ey{font-size:12px;letter-spacing:2px;color:#0877bd;font-weight:900}.r118-card h2{margin:7px 0 5px;font-size:24px}.r118-sub{color:#547594}.r118-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:18px}.r118-kpi{border:1px solid #cfe0ed;border-radius:14px;padding:14px;background:#f9fcff}.r118-kpi span{display:block;color:#607f9c;font-size:12px}.r118-kpi strong{font-size:22px;display:block;margin-top:5px}.r118-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.r118-form label,.r118-causes label{font-weight:800;font-size:13px}.r118-form input,.r118-form select,.r118-causes input{width:100%;box-sizing:border-box;margin-top:6px;border:1px solid #b9d3e8;border-radius:9px;padding:10px;background:#fff}.r118-groups{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}.r118-group{border:1px solid #cfe0ed;border-radius:14px;padding:15px}.r118-group h3{margin:0 0 12px}.r118-causes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.r118-auto{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:14px}.r118-auto div{padding:12px;border-radius:12px;background:#eef7ff}.r118-auto b{display:block;font-size:18px;margin-top:4px}.r118-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}.r118-btn{border:0;border-radius:10px;padding:11px 18px;font-weight:900;cursor:pointer}.r118-primary{background:#2f92cf;color:#fff}.r118-table{width:100%;border-collapse:collapse;font-size:13px}.r118-table th{background:#1f5684;color:#fff;text-align:left;padding:10px;white-space:nowrap}.r118-table td{padding:9px 10px;border-bottom:1px solid #d8e5ef;white-space:nowrap}.r118-chart{height:250px;border:1px solid #d7e5ef;border-radius:14px;padding:10px;background:#fff}.r118-chart svg{width:100%;height:100%}.r118-two{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}.r118-bar{display:grid;grid-template-columns:170px 1fr 70px;gap:8px;align-items:center;margin:8px 0}.r118-bar i{height:14px;background:#2f92cf;border-radius:7px;display:block}.r118-note{padding:11px 13px;background:#eef7ff;border-radius:10px;margin-top:12px;color:#365d7d}.r118-hide{display:none!important}@media(max-width:1000px){.r118-grid,.r118-form{grid-template-columns:repeat(2,1fr)}.r118-groups,.r118-two{grid-template-columns:1fr}}`;
document.head.appendChild(s)}
function findChemicalTabs(){
 const candidates=[...document.querySelectorAll('button,a')];
 const hist=candidates.find(e=>(e.textContent||'').trim()==='Histórico');
 if(!hist)return null;
 let bar=hist.parentElement;
 for(let i=0;i<4&&bar;i++,bar=bar.parentElement){
   const txt=bar.textContent||'';
   if(txt.includes('Painel')&&txt.includes('Lançamento')&&txt.includes('Inventário')&&txt.includes('Sugestão de compra')) return {bar,hist};
 }
 return null;
}
function ensureTab(){
 const hit=findChemicalTabs(); if(!hit)return;
 const {bar,hist}=hit;
 if(bar.querySelector('[data-relave-tab]'))return;
 const tag=hist.tagName==='A'?'a':'button', b=document.createElement(tag);
 b.dataset.relaveTab='1'; b.textContent='Relave';
 if(tag==='button')b.type='button'; else b.href='#relave';
 b.className=hist.className||'';
 b.style.cssText='border:0;background:transparent;padding:10px 14px;font-weight:800;color:#54708e;cursor:pointer;border-radius:10px;text-decoration:none';
 b.onclick=e=>{e.preventDefault(); history.replaceState({},'',location.pathname+location.search+HASH); mounted=false; mount();};
 hist.after(b);
}
function restoreChemicalContent(){
 document.querySelectorAll('[data-r118-hidden="1"]').forEach(el=>{el.style.display=el.dataset.r118Display||'';delete el.dataset.r118Hidden;delete el.dataset.r118Display});
 document.getElementById('rel118')?.remove(); mounted=false;
}
function getMountPoint(){
 const hit=findChemicalTabs(); if(!hit)return null;
 let card=hit.bar;
 for(let i=0;i<3&&card.parentElement;i++){
   if(card.parentElement.children.length>1) card=card.parentElement; else break;
 }
 return {hit,card};
}
function lineChart(points,valueKey,label){if(!points.length)return '<div class="r118-chart">Sem dados.</div>';const vals=points.map(x=>n(x[valueKey])),max=Math.max(...vals,0.01),W=760,H=220,pad=34;const xy=vals.map((v,i)=>[pad+(W-pad*2)*(i/(Math.max(1,vals.length-1))),H-pad-(H-pad*2)*(v/max)]);const path=xy.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');return `<div class="r118-chart"><b>${label}</b><svg viewBox="0 0 ${W} ${H}"><line x1="${pad}" y1="${H-pad}" x2="${W-pad}" y2="${H-pad}" stroke="#aac4d8"/><path d="${path}" fill="none" stroke="#247fc0" stroke-width="3"/>${xy.map((p,i)=>i%Math.ceil(points.length/10)===0?`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#247fc0"/><text x="${p[0]}" y="${H-8}" font-size="10" text-anchor="middle">${esc(points[i].label)}</text>`:'').join('')}</svg></div>`}
function weekly(rows){const m=new Map();rows.forEach(r=>{const k=r.week||weekNo(r.date);const q=m.get(k)||{week:k,totalSorted:0,relaveTotal:0,chtKg:0,gaoKg:0};q.totalSorted+=n(r.totalSorted);q.relaveTotal+=n(r.relaveTotal);q.chtKg+=n(r.chtKg);q.gaoKg+=n(r.gaoKg);m.set(k,q)});return [...m.values()].sort((a,b)=>a.week-b.week).map(x=>({...x,label:'S'+x.week,pct:x.totalSorted?x.relaveTotal/x.totalSorted:0}))}
function dashboard(){const rows=all().filter(r=>n(r.totalSorted)>0),w=weekly(rows),last=w.at(-1)||{},prev=w.at(-2)||{},sum=rows.reduce((a,r)=>a+n(r.relaveTotal),0),tri=rows.reduce((a,r)=>a+n(r.totalSorted),0);const causes=[...fields.surgical,...fields.sheet,['otherRelave','Outros'],['privateRelave','Privativos']].map(([k,l])=>[l,rows.reduce((a,r)=>a+n(r[k]),0)]).sort((a,b)=>b[1]-a[1]).slice(0,8),mx=Math.max(...causes.map(x=>x[1]),1);return `<div class="r118-card"><div class="r118-ey">GESTÃO À VISTA</div><h2>Relave da Lavanderia</h2><div class="r118-sub">Histórico 2026 + novos lançamentos. CHT e GAO são calculados automaticamente pelas causas.</div><div class="r118-grid"><div class="r118-kpi"><span>% relave • semana ${last.week||'-'}</span><strong>${pct(last.pct||0)}</strong></div><div class="r118-kpi"><span>Relave • semana ${last.week||'-'}</span><strong>${fmt(last.relaveTotal)} kg</strong></div><div class="r118-kpi"><span>Relave acumulado 2026</span><strong>${fmt(sum)} kg</strong></div><div class="r118-kpi"><span>% acumulado</span><strong>${pct(tri?sum/tri:0)}</strong></div></div><div class="r118-two">${lineChart(w,'pct','% Relave por semana')}${lineChart(w,'relaveTotal','Kg de relave por semana')}</div><div class="r118-two"><div class="r118-card" style="margin:0"><h3>Composição CHT × GAO</h3>${lineChart(w,'chtKg','CHT • kg por semana')}${lineChart(w,'gaoKg','GAO • kg por semana')}</div><div class="r118-card" style="margin:0"><h3>Principais causas acumuladas</h3>${causes.map(([l,v])=>`<div class="r118-bar"><span>${esc(l)}</span><i style="width:${Math.max(2,v/mx*100)}%"></i><b>${fmt(v)} kg</b></div>`).join('')}</div></div></div>`}
function input(label,id,type='number'){return `<label>${label}<input id="r118-${id}" type="${type}" ${type==='number'?'min="0" step="0.01"':''}></label>`}
function launch(){return `<div class="r118-card"><div class="r118-ey">LANÇAMENTO DIÁRIO</div><h2>Registrar Relave</h2><div class="r118-sub">Lance apenas os pesos das causas. Relave CHT, Relave GAO, Relave Total e percentuais são calculados automaticamente.</div><div class="r118-form">${input('Data','date','date')}${input('Responsável','responsible','text')}${input('Comanda','command','text')}${input('Total triado (kg)','totalSorted')}</div><div class="r118-groups"><div class="r118-group"><h3>Cirúrgico</h3><div class="r118-causes">${fields.surgical.map(([k,l])=>input(l,k)).join('')}</div></div><div class="r118-group"><h3>Lençol</h3><div class="r118-causes">${fields.sheet.map(([k,l])=>input(l,k)).join('')}</div></div></div><div class="r118-form" style="margin-top:14px">${input('Relave Outros','otherRelave')}${input('Relave Privativos','privateRelave')}</div><div class="r118-auto"><div>Relave CHT<b id="r118-cht">0,00 kg</b></div><div>Relave GAO<b id="r118-gao">0,00 kg</b></div><div>Relave total<b id="r118-total">0,00 kg</b></div><div>% total de relave<b id="r118-pct">0,00%</b></div></div><div class="r118-note"><b>CHT:</b> Cirúrgico Óleo + Sangue + Resíduo + Lençol Amarelo + Sangue + Resíduo. <b>GAO:</b> Rasgado + Limpo + Cola/Fita + Permanente + Passadoria + Tinta + Nó, conforme a lógica da planilha oficial.</div><div class="r118-actions"><button class="r118-btn r118-primary" id="r118-save">Salvar lançamento</button></div></div>`}
function history(){const rows=all().slice().reverse();return `<div class="r118-card"><div class="r118-ey">HISTÓRICO</div><h2>Relave do Dia</h2><div style="overflow:auto"><table class="r118-table"><thead><tr><th>Data</th><th>Semana</th><th>Responsável</th><th>Comanda</th><th>Total triado</th><th>Relave total</th><th>% Relave</th><th>CHT</th><th>GAO</th><th>Lençol</th><th>Cirúrgico</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${String(r.date).split('-').reverse().join('/')}</td><td>${r.week||weekNo(r.date)}</td><td>${esc(r.responsible)}</td><td>${esc(r.command)}</td><td>${fmt(r.totalSorted)} kg</td><td><b>${fmt(r.relaveTotal)} kg</b></td><td>${pct(r.pctTotal)}</td><td>${fmt(r.chtKg)} kg</td><td>${fmt(r.gaoKg)} kg</td><td>${fmt(r.sheetTotal)} kg</td><td>${fmt(r.surgicalTotal)} kg</td></tr>`).join('')}</tbody></table></div></div>`}
function bindLaunch(root){const ids=[...fields.surgical,...fields.sheet].map(x=>x[0]).concat(['otherRelave','privateRelave','totalSorted']);const recalc=()=>{const x={};ids.forEach(k=>x[k]=n(root.querySelector('#r118-'+k)?.value));const c=calc(x);root.querySelector('#r118-cht').textContent=fmt(c.chtKg)+' kg';root.querySelector('#r118-gao').textContent=fmt(c.gaoKg)+' kg';root.querySelector('#r118-total').textContent=fmt(c.relaveTotal)+' kg';root.querySelector('#r118-pct').textContent=pct(c.pctTotal)};ids.forEach(k=>root.querySelector('#r118-'+k)?.addEventListener('input',recalc));const d=root.querySelector('#r118-date');if(d&&!d.value)d.value=new Date().toISOString().slice(0,10);root.querySelector('#r118-save').onclick=()=>{const x={};['date','responsible','command','totalSorted','otherRelave','privateRelave',...fields.surgical.map(x=>x[0]),...fields.sheet.map(x=>x[0])].forEach(k=>x[k]=root.querySelector('#r118-'+k)?.value||'');if(!x.date||!n(x.totalSorted)){alert('Informe a data e o total triado.');return}x.id=crypto.randomUUID?.()||Date.now().toString(36);x.week=weekNo(x.date);x.savedAt=new Date().toISOString();saveEntry(calc(x));alert('Relave salvo. CHT, GAO e totais calculados automaticamente.');render('dash')};}
function render(tab='dash'){const root=document.getElementById('rel118');if(!root)return;root.innerHTML=`<div class="r118-tabs"><button data-t="dash" class="${tab==='dash'?'active':''}">Painel</button><button data-t="launch" class="${tab==='launch'?'active':''}">Novo lançamento</button><button data-t="hist" class="${tab==='hist'?'active':''}">Histórico</button></div>${tab==='dash'?dashboard():tab==='launch'?launch():history()}`;root.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>render(b.dataset.t));if(tab==='launch')bindLaunch(root)}
function mount(){
 ensureTab();
 if(location.hash!==HASH){restoreChemicalContent();return}
 css();
 const mp=getMountPoint(); if(!mp)return;
 const {hit,card}=mp;
 const relBtn=hit.bar.querySelector('[data-relave-tab]');
 if(relBtn){relBtn.style.background='#3193d0';relBtn.style.color='#fff'}
 let host=document.getElementById('rel118');
 if(!host){host=document.createElement('section');host.id='rel118';host.style.cssText='margin:18px 0 40px;width:100%';card.insertAdjacentElement('afterend',host)}
 // Esconde somente os blocos de conteúdo que vêm depois da barra de abas, preservando cabeçalho, sidebar e navegação.
 let sib=host.nextElementSibling;
 while(sib){if(sib.id!=='rel118'){sib.dataset.r118Hidden='1';sib.dataset.r118Display=sib.style.display||'';sib.style.display='none'}sib=sib.nextElementSibling}
 render('dash');mounted=true;
}
fetch(DATA).then(r=>r.json()).then(d=>{historical=d.rows||[];mount()}).catch(()=>mount());
window.addEventListener('popstate',()=>setTimeout(mount,80));window.addEventListener('hashchange',()=>setTimeout(mount,80));document.addEventListener('click',()=>setTimeout(ensureTab,100));setInterval(()=>{ensureTab();if(location.hash===HASH&&!mounted)mount()},1000);setTimeout(()=>{ensureTab();mount()},500);
})();
