(()=>{
 const ROUTE='/quimicos/compras', INVKEY='gao.chemicals.inventory.v74', MASTER='gao.chemicals.master.v78';
 const HIST={WP35:334.084,MSC:292.266,EAM:107.949,SOL:79.967,AVRA:74.808,WSD:71.684,CAB:54.146,CLORO:29.807,TUBINGAL:15.448,HAD:10.578};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=v=>String(v||'').trim().toUpperCase();
 const money=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}), fmt=n=>Number(n||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
 const inv=()=>{try{return JSON.parse(localStorage.getItem(INVKEY)||'{}').latest||{}}catch{return {}}};
 const master=()=>{try{return JSON.parse(localStorage.getItem(MASTER)||'{}')}catch{return {}}};
 function resolve(a,M){return window.GAO_CHEM_V84?.resolve(a,M)||((M.principles||[]).find(p=>norm(p.code)===norm(a)||norm(p.name)===norm(a))?.name)||null}
 function histByPrinciple(M){const o={};for(const [a,v] of Object.entries(HIST)){const p=resolve(a,M);if(p)o[p]=(o[p]||0)+v}return o}
 function css(){if(document.getElementById('chem86css'))return;const s=document.createElement('style');s.id='chem86css';s.textContent=`
 #chem-v87{overflow:hidden!important}.chem86-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.chem86-head h2{margin:4px 0 5px}.chem86-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}.chem86-kpi{border:1px solid #cfe0ef;border-radius:14px;padding:14px;background:#fff}.chem86-kpi.att{background:#fff7e8;border-color:#f2b84b}.chem86-kpi strong{display:block;font-size:23px;color:#082d52;margin-top:5px}.chem86-note{background:#eef7ff;border:1px solid #b9daf5;border-radius:11px;padding:11px 13px;margin:12px 0;color:#244b6d}.chem86-scroll{width:100%;overflow-x:auto;overscroll-behavior-x:contain}.chem86-table{width:100%;min-width:1450px;border-collapse:collapse;table-layout:auto}.chem86-table th{background:#194a78;color:#fff;text-align:left;padding:10px 9px;white-space:nowrap}.chem86-table td{padding:10px 9px;border-bottom:1px solid #dce7f0;vertical-align:middle}.chem86-table select{width:100%;min-width:330px;max-width:460px}.chem86-cover{font-weight:800}.chem86-cover.danger{color:#c62828}.chem86-cover.warn{color:#b26a00}.chem86-cover.ok{color:#17823b}.chem86-buy{font-weight:800;color:#b94b00}.chem86-total td{background:#eaf4fc;font-weight:800;border-top:2px solid #194a78}.chem86-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:14px}.chem86-sum{border:1px solid #c8dceb;border-radius:12px;padding:12px;background:#f8fbfe}.chem86-sum span{display:block;font-size:12px;color:#58748e}.chem86-sum strong{font-size:18px;color:#082d52}.chem86-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}.chem86-btn{border:0;border-radius:10px;padding:11px 16px;font-weight:800;cursor:pointer}.chem86-primary{background:#2d8bc9;color:#fff}.chem86-secondary{background:#eaf2f8;color:#123e66}.chem86-empty{color:#b42318;font-weight:800}body{overflow-x:hidden!important}@media(max-width:1000px){.chem86-kpis,.chem86-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
 `;document.head.appendChild(s)}
 function candidates(){return [...document.querySelectorAll('section.data-panel')].filter(e=>/Sugestão de compra|Planejamento de abastecimento/i.test(e.textContent||''))}
 function totals(rows){let liters=0,kg=0,value=0;for(const r of rows){if(r.need<=0||!r.selected)continue;const L=Number(r.order||0),dens=Number(r.selected.density||0),pl=Number(r.selected.priceL||Number(r.selected.priceKg||0)*dens);liters+=L;kg+=L*dens;value+=L*pl}return{liters,kg,value,avgL:liters?value/liters:0,avgKg:kg?value/kg:0}}
 const coverClass=d=>d<7?'danger':d<15?'warn':'ok';
 const dayMs=86400000;
 const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date());
 const dateLabel=date=>date.split('-').reverse().join('/');
 function purchasePeriod(inventoryDate,plannedOn=today()){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(inventoryDate||'')||inventoryDate>plannedOn)return null;
  const inventory=Date.parse(inventoryDate+'T00:00:00Z');
  if(!Number.isFinite(inventory)||new Date(inventory).toISOString().slice(0,10)!==inventoryDate)return null;
  const [year,month]=plannedOn.split('-').map(Number);
  const start=Date.UTC(year,month,1),after=Date.UTC(year,month+1,1);
  return {
   toClose:(start-inventory)/dayMs-1,
   closeDate:new Date(start-dayMs).toISOString().slice(0,10),
   startDate:new Date(start).toISOString().slice(0,10),
   nextDays:(after-start)/dayMs,
   nextMonth:new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(start)
  };
 }
 function buildRows(I,M,period){
  if(!period)return [];
  const items=I.items||{},H=histByPrinciple(M),offers=M.offers||[];
  return Object.entries(H).map(([n,w])=>{
   const stock=Number(items[n]?.stock||0),transit=Number(items[n]?.transit||0),daily=w/7;
   const consumptionToClose=daily*period.toClose,consumptionNext=daily*period.nextDays;
   const projected=stock+transit-consumptionToClose;
   const opening=Math.max(0,projected),currentGap=Math.max(0,-projected);
   const need=Math.max(0,consumptionNext-opening);
   const cover=daily?stock/daily:0,coverTransit=daily?(stock+transit)/daily:0;
   const ops=offers.filter(o=>Number(o.pack)>0&&norm(o.principle)===norm(n));
   let selected=ops[0]||null;
   const pref=items[n]?.preferredOffer;
   if(pref)selected=ops.find(o=>norm(o.supplier)===norm(pref.supplier)&&norm(o.commercialName)===norm(pref.commercialName)&&Number(o.pack)===Number(pref.pack))||selected;
   const pack=Number(selected?.pack||0),packs=pack?Math.ceil(need/pack):0;
   return {n,w,daily,stock,transit,consumptionToClose,opening,currentGap,consumptionNext,need,cover,coverTransit,ops,selected,pack,packs,order:pack*packs};
  });
 }
 function render(){if(location.pathname!==ROUTE||document.getElementById('chem-v87'))return;css();const pending=document.querySelector('#chemical-purchases-host [role=status]');if(!window.GAO_CHEM_DB_READY){if(window.GAO_CHEM_DB_SYNC_ERROR&&pending)pending.textContent='Não foi possível conectar a sugestão de compra. Atualize a página e tente novamente.';return;}const panels=candidates();if(!panels.length)return;const native=panels[0];panels.forEach(p=>p.style.display='none');document.querySelectorAll('#chem-v71-purchase,#chem-v77,#chem-v85,#chem-v86').forEach(e=>e.remove());
  const I=inv(),M=master(),period=purchasePeriod(I.date),rows=buildRows(I,M,period),totalStock=rows.reduce((a,r)=>a+r.stock,0),totalTransit=rows.reduce((a,r)=>a+r.transit,0),totalNeed=rows.reduce((a,r)=>a+r.need,0),beforeClose=rows.filter(r=>r.currentGap>0);
  const host=document.createElement('section');host.id='chem-v87';host.className='data-panel';native.after(host);host.innerHTML=`<div class="chem86-head"><div><div class="eyebrow">PLANEJAMENTO DE ABASTECIMENTO</div><h2>Sugestão de compra</h2><div>Compra para ${period?esc(period.nextMonth):'o próximo mês'}.</div></div><div><b>Inventário:</b> ${esc(I.date?I.date.split('-').reverse().join('/'):'não localizado')}</div></div>${period?'':'<div class="chem86-note chem86-empty">Informe um inventário com data válida até hoje. <a href="/quimicos/inventario">Abrir inventário</a>.</div>'}<div class="chem86-kpis"><div class="chem86-kpi"><span>Estoque atual</span><strong>${fmt(totalStock)} L</strong></div><div class="chem86-kpi"><span>Em trânsito</span><strong>${fmt(totalTransit)} L</strong></div><div class="chem86-kpi"><span>Princípios com compra</span><strong>${rows.filter(r=>r.need>0).length}</strong></div><div class="chem86-kpi att"><span>Necessidade do próximo mês</span><strong>${fmt(totalNeed)} L</strong></div></div>${period?`<div class="chem86-note">O consumo é projetado por ${period.toClose} dia(s) após a data do inventário, até <b>${dateLabel(period.closeDate)}</b>. A sobra cobre parte dos ${period.nextDays} dias de <b>${esc(period.nextMonth)}</b>. O cálculo considera o volume em trânsito como recebido até o fechamento.</div>`:''}${beforeClose.length?`<div class="chem86-note" role="status"><b>Falta prevista antes do fechamento</b> · ${beforeClose.map(r=>esc(r.n)+' '+fmt(r.currentGap)+' L').join(' · ')}. Essas faltas estão separadas da compra do próximo mês.</div>`:''}<div class="chem86-scroll"><table class="chem86-table"><thead><tr><th>Princípio ativo</th><th>Média L/sem</th><th>Média L/dia</th><th>Estoque</th><th>Em trânsito</th><th>Suporte dias</th><th>Suporte c/ trânsito</th><th>Consumo até o fechamento</th><th>Saldo para o próximo mês</th><th>Consumo do próximo mês</th><th>Necessidade do próximo mês</th><th>Fornecedor / produto / apresentação</th><th>Preço/kg</th><th>Preço/L</th><th>Emb.</th><th>Comprar</th><th>Valor estimado</th></tr></thead><tbody>${rows.map(r=>`<tr data-chemical-name="${esc(r.n)}" data-current-cover="${r.cover}" data-next-need="${r.need}"><td><b>${esc(r.n)}</b></td><td>${fmt(r.w)}</td><td>${fmt(r.daily)}</td><td>${fmt(r.stock)} L</td><td>${fmt(r.transit)} L</td><td class="chem86-cover ${coverClass(r.cover)}">${fmt(r.cover)} dias</td><td>${fmt(r.coverTransit)} dias</td><td>${fmt(r.consumptionToClose)} L</td><td>${fmt(r.opening)} L</td><td>${fmt(r.consumptionNext)} L</td><td>${fmt(r.need)} L</td><td>${r.ops.length?`<select data-offer="${esc(r.n)}">${r.ops.map((o,i)=>`<option value="${i}" ${o===r.selected?'selected':''}>${esc(o.supplier||'Fornecedor')} — ${esc(o.commercialName||o.product||o.principle||r.n)} — ${o.pack} L</option>`).join('')}</select>`:'<b class="chem86-empty">Cadastrar opção comercial</b>'}</td><td data-pkg="${esc(r.n)}">${r.selected?.priceKg?money(r.selected.priceKg)+'/kg':'-'}</td><td data-pl="${esc(r.n)}">${r.selected?money(Number(r.selected.priceL||Number(r.selected.priceKg||0)*Number(r.selected.density||0)))+'/L':'-'}</td><td data-packs="${esc(r.n)}">${r.packs}</td><td class="${r.need>0?'chem86-buy':''}" data-order="${esc(r.n)}">${fmt(r.order)} L</td><td data-value="${esc(r.n)}">${r.selected?money(r.order*Number(r.selected.priceL||Number(r.selected.priceKg||0)*Number(r.selected.density||0))):'-'}</td></tr>`).join('')}</tbody><tfoot><tr class="chem86-total"><td colspan="15">TOTAL DA COMPRA PROJETADA</td><td id="chem86-total-liters">-</td><td id="chem86-total-value">-</td></tr></tfoot></table></div><div class="chem86-summary"><div class="chem86-sum"><span>Total a comprar</span><strong id="chem86-s-liters">-</strong></div><div class="chem86-sum"><span>Kg equivalentes</span><strong id="chem86-s-kg">-</strong></div><div class="chem86-sum"><span>Custo médio ponderado/L</span><strong id="chem86-s-avgl">-</strong></div><div class="chem86-sum"><span>Custo médio ponderado/kg</span><strong id="chem86-s-avgkg">-</strong></div><div class="chem86-sum"><span>Valor total estimado</span><strong id="chem86-s-value">-</strong></div></div><div class="chem86-actions"><button class="chem86-btn chem86-secondary" id="chem86-refresh">Atualizar dados</button><button class="chem86-btn chem86-primary" id="chem86-issue" ${period?'':'disabled'}>Emitir solicitação de compra</button></div>`;
  function refreshTotals(){const t=totals(rows);host.querySelector('#chem86-total-liters').textContent=fmt(t.liters)+' L';host.querySelector('#chem86-total-value').textContent=money(t.value);host.querySelector('#chem86-s-liters').textContent=fmt(t.liters)+' L';host.querySelector('#chem86-s-kg').textContent=fmt(t.kg)+' kg';host.querySelector('#chem86-s-avgl').textContent=money(t.avgL)+'/L';host.querySelector('#chem86-s-avgkg').textContent=money(t.avgKg)+'/kg';host.querySelector('#chem86-s-value').textContent=money(t.value)}
  host.querySelectorAll('[data-offer]').forEach(sel=>sel.onchange=()=>{const r=rows.find(a=>a.n===sel.dataset.offer),o=r.ops[Number(sel.value)]||{};r.selected=o;r.pack=Number(o.pack||0);r.packs=r.pack?Math.ceil(r.need/r.pack):0;r.order=r.pack*r.packs;const pl=Number(o.priceL||Number(o.priceKg||0)*Number(o.density||0));sel.closest('tr').querySelector('[data-pkg]').textContent=o.priceKg?money(o.priceKg)+'/kg':'-';sel.closest('tr').querySelector('[data-pl]').textContent=pl?money(pl)+'/L':'-';sel.closest('tr').querySelector('[data-packs]').textContent=r.packs;sel.closest('tr').querySelector('[data-order]').textContent=fmt(r.order)+' L';sel.closest('tr').querySelector('[data-value]').textContent=pl?money(r.order*pl):'-';refreshTotals()});
  refreshTotals();host.querySelector('#chem86-refresh').onclick=()=>{host.remove();render()};host.querySelector('#chem86-issue').onclick=()=>issue(rows,I,period,M);
 }
 async function issue(rows,I,period,M){
  if(!period)return;
  const page=window.open('','_blank');
  if(!page)return alert('Permita pop-ups para emitir a solicitação.');
  page.opener=null;
  page.document.title='Solicitação de compra';
  page.document.body.textContent='Carregando relatório de compras…';
  const reportData={rows,totals:totals(rows),inventoryDate:I.date,period,issuedOn:today()};
  try{
   const report=await import('./chemical-purchase-report-v1.mjs?v=2');
   await report.openChemicalPurchaseReport(page,reportData,code=>resolve(code,M));
  }catch{
   if(!page.closed)page.document.body.textContent='Não foi possível abrir o relatório. Atualize a página de compras e tente novamente.';
  }
 }
 function cleanup(){document.querySelectorAll('#chem-v87').forEach(e=>e.remove());document.querySelectorAll('section.data-panel').forEach(e=>{if(/Sugestão de compra|Planejamento de abastecimento/i.test(e.textContent||''))e.style.display=''})}
 function tryMount(){if(location.pathname!==ROUTE){cleanup();return} [80,220,500,900].forEach(ms=>setTimeout(()=>{if(location.pathname===ROUTE&&!document.getElementById('chem-v87'))render()},ms))}
 const push=history.pushState,rep=history.replaceState;history.pushState=function(){const r=push.apply(this,arguments);tryMount();return r};history.replaceState=function(){const r=rep.apply(this,arguments);tryMount();return r};addEventListener('popstate',tryMount);window.addEventListener('gao-chem-db-ready',tryMount);window.GAO_CHEM_DB_LOAD?.().then(tryMount);tryMount();
})();
