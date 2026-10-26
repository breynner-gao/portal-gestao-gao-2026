(()=>{
 const ROUTE='/quimicos/inventario', KEY='gao.chemicals.inventory.v74', MASTER='gao.chemicals.master.v78';let last='', mounting=false;
 const fmt=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:3});const norm=s=>String(s||'').trim().toUpperCase();
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const data=()=>fetch('/assets/chemicals-history-v71.json?v=105').then(r=>r.json());
 const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
 const master=()=>{try{return JSON.parse(localStorage.getItem(MASTER)||'{}')}catch{return {}}};
 const save=v=>localStorage.setItem(KEY,JSON.stringify(v));
 function resolve(a,M){return window.GAO_CHEM_V84?.resolve(a,M)||((M.principles||[]).find(p=>norm(p.code)===norm(a)||norm(p.name)===norm(a))?.name)||null}
 function aggregate(d,M){const out={};for(const [a,v] of Object.entries(d.avgWeeklyLiters||{})){const p=resolve(a,M);if(p)out[p]=(out[p]||0)+Number(v||0)}return out}
 function offers(p,M){return (M.offers||[]).filter(o=>norm(o.principle)===norm(p))}
 function label(o){return `${o.supplier||'-'} — ${o.commercialName||o.product||'-'}${Number(o.pack)>0?' — '+fmt(o.pack)+' L':''}`}
 function migrateItems(items,M){const out={};for(const [k,v] of Object.entries(items||{})){const p=resolve(k,M)||k;if(!out[p])out[p]={stock:0,transit:0,preferredOffer:null,offerKey:''};out[p].stock+=Number(v.stock||0);out[p].transit+=Number(v.transit||0);if(v.preferredOffer){out[p].preferredOffer=v.preferredOffer;out[p].offerKey=v.offerKey||''}}return out}
 function native(){return [...document.querySelectorAll('section.data-panel')].find(x=>x.id!=='chem-v105'&&/Inventário de químicos/i.test(x.textContent||''))}
 function css(){if(document.getElementById('c105invcss'))return;const s=document.createElement('style');s.id='c105invcss';s.textContent=`#chem-v105{color:#082d52}#chem-v105 table{width:100%;border-collapse:collapse;min-width:1100px}#chem-v105 th{background:#194a78;color:#fff;text-align:left;padding:11px 12px}#chem-v105 td{padding:10px 12px;border-bottom:1px solid #dce8f1}#chem-v105 input,#chem-v105 select{width:100%;border:1px solid #b9d2e7;border-radius:10px;padding:11px;background:#fff;box-sizing:border-box}#chem-v105 .fields{display:grid;grid-template-columns:220px 1fr;gap:14px;margin:14px 0}#chem-v105 label{font-weight:800;display:block;margin-bottom:6px}#chem-v105 .prod{font-weight:900}#chem-v105 .pending{background:#fff3d6;color:#9a5b00;border-radius:999px;padding:5px 9px;font-weight:800;font-size:12px}#chem-v105 .actions{display:flex;justify-content:flex-end;margin-top:16px}#chem-v105 button{border:0;border-radius:10px;padding:12px 18px;font-weight:900;background:#3188c9;color:#fff;cursor:pointer}#chem-v105 .note{color:#607b94;font-size:14px}#chem-v105 .sync{margin-top:10px;padding:9px 12px;border-radius:10px;background:#eef8ff;color:#245a80;font-size:13px}`;document.head.appendChild(s)}
 function selectedMatch(pref,o){if(!pref)return false;return norm(pref.supplier)===norm(o.supplier)&&norm(pref.commercialName||pref.product)===norm(o.commercialName||o.product)&&Number(pref.pack||0)===Number(o.pack||0)}
 async function mount(force=false){
   if(location.pathname!==ROUTE||mounting)return;
   if(!force&&document.getElementById('chem-v105'))return;
   mounting=true;
   try{
     css(); const p=native(); if(!p)return;
     // V102 hidrata o cadastro mestre do Supabase. Não renderiza o inventário antes dessa leitura terminar.
     if(window.GAO_CHEM_DB_READY===false){return}
     const [d,M]=await Promise.all([data(),Promise.resolve(master())]), avg=aggregate(d,M), stored=load(), latest=stored.latest||{}, items=migrateItems(latest.items,M), unmapped=Object.keys(d.avgWeeklyLiters||{}).filter(a=>!resolve(a,M));
     document.getElementById('chem-v105')?.remove();
     p.style.display='none';
     const x=document.createElement('section');x.id='chem-v105';x.className='data-panel';
     x.innerHTML=`<div><div style="font-size:12px;letter-spacing:2px;color:#0877bd;font-weight:900">ESTOQUE FÍSICO</div><h2>Inventário de químicos por princípio ativo</h2><div class="note">Selecione o <b>fornecedor / produto comercial / apresentação</b> correspondente à posição física. O princípio ativo continua sendo a referência analítica.</div><div class="sync">Cadastro comercial carregado: <b>${(M.suppliers||[]).length} fornecedor(es)</b> e <b>${(M.offers||[]).length} produto(s)/apresentação(ões)</b>.</div>${unmapped.length?`<div style="margin-top:12px;padding:10px;background:#fff4d8;border-radius:10px;color:#8a5600"><b>Pendente de vínculo histórico:</b> ${unmapped.map(esc).join(', ')}.</div>`:''}</div><div class="fields"><div><label>Data do inventário</label><input id="i105date" type="date" value="${esc(latest.date||new Date().toISOString().slice(0,10))}"></div><div><label>Observação</label><input id="i105note" value="${esc(latest.note||'')}"></div></div><div style="overflow:auto"><table><thead><tr><th>Princípio ativo</th><th>Fornecedor / produto comercial / apresentação</th><th>Consumo médio semanal</th><th>Saldo atual (L)</th><th>Em trânsito (L)</th></tr></thead><tbody>${Object.entries(avg).sort((a,b)=>a[0].localeCompare(b[0])).map(([name,w])=>{const ops=offers(name,M),it=items[name]||{},pref=it.preferredOffer;return `<tr data-p="${esc(name)}"><td class="prod">${esc(name)}</td><td>${ops.length?`<select class="offer"><option value="">Selecione o fornecedor / produto</option>${ops.map((o,i)=>`<option value="${i}" ${selectedMatch(pref,o)?'selected':''}>${esc(label(o))}</option>`).join('')}</select>`:'<span class="pending">Produto comercial pendente</span>'}</td><td>${fmt(w)} L/sem</td><td><input class="stock" type="number" min="0" step="0.001" value="${it.stock??''}"></td><td><input class="transit" type="number" min="0" step="0.001" value="${it.transit??''}"></td></tr>`}).join('')}</tbody></table></div><div class="actions"><button id="i105save">Salvar inventário</button></div>`;
     p.after(x);
     x.querySelector('#i105save').onclick=()=>{const currentM=master(),out={};x.querySelectorAll('tbody tr').forEach(tr=>{const name=tr.dataset.p,ops=offers(name,currentM),sel=tr.querySelector('.offer'),o=sel&&sel.value!==''?ops[+sel.value]:null;out[name]={stock:+(tr.querySelector('.stock').value||0),transit:+(tr.querySelector('.transit').value||0),preferredOffer:o||null,offerKey:o?[o.principle,o.commercialName||o.product,o.supplier,o.pack].join('|'):''}});const snap={date:x.querySelector('#i105date').value,note:x.querySelector('#i105note').value,items:out,basis:'principle-active-v105',savedAt:new Date().toISOString()};const cur=load(),arr=Array.isArray(cur.snapshots)?cur.snapshots:[];arr.push(snap);save({latest:snap,snapshots:arr.slice(-52)});alert('Inventário salvo com fornecedor/produto comercial vinculado.');};
   } finally {mounting=false}
 }
 function cleanup(){document.getElementById('chem-v105')?.remove();document.querySelectorAll('section.data-panel').forEach(e=>{if(/Inventário de químicos/i.test(e.textContent||''))e.style.display=''})}
 function tick(){if(location.pathname!==last){last=location.pathname;cleanup();if(location.pathname===ROUTE)setTimeout(()=>mount(),120)}else if(location.pathname===ROUTE&&!document.getElementById('chem-v105')&&window.GAO_CHEM_DB_READY!==false)mount()}
 window.addEventListener('gao-chem-db-ready',()=>{if(location.pathname===ROUTE){cleanup();setTimeout(()=>mount(true),30)}});
 window.addEventListener('storage',e=>{if(e.key===MASTER&&location.pathname===ROUTE){cleanup();setTimeout(()=>mount(true),30)}});
 setInterval(tick,400);addEventListener('popstate',tick);tick();
})();
