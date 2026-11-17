(()=>{
 const ROUTE='/quimicos/inventario', KEY='gao.chemicals.inventory.v74', MASTER='gao.chemicals.master.v78';let last='', mounting=false;
 const fmt=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:3});const norm=s=>String(s||'').trim().toUpperCase();
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const data=()=>fetch('/assets/chemicals-history-v71.json?v=106').then(r=>{if(!r.ok)throw Error('Não foi possível carregar a referência de consumo.');return r.json()});
 const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
 const master=()=>{try{return JSON.parse(localStorage.getItem(MASTER)||'{}')}catch{return {}}};
 function resolve(a,M){return window.GAO_CHEM_V84?.resolve(a,M)||((M.principles||[]).find(p=>norm(p.code)===norm(a)||norm(p.name)===norm(a))?.name)||null}
 function aggregate(d,M){const out={};for(const [a,v] of Object.entries(d.avgWeeklyLiters||{})){const p=resolve(a,M);if(p)out[p]=(out[p]||0)+Number(v||0)}return out}
 function offers(p,M){return (M.offers||[]).filter(o=>norm(o.principle)===norm(p))}
 function label(o){return `${o.supplier||'-'} — ${o.commercialName||o.product||'-'}${Number(o.pack)>0?' — '+fmt(o.pack)+' L':''}`}
 function migrateItems(items,M){const out={};for(const [k,v] of Object.entries(items||{})){const p=resolve(k,M)||k;if(!out[p])out[p]={stock:0,transit:0,preferredOffer:null,offerKey:''};out[p].stock+=Number(v.stock||0);out[p].transit+=Number(v.transit||0);if(v.preferredOffer){out[p].preferredOffer=v.preferredOffer;out[p].offerKey=v.offerKey||''}}return out}
 function native(){return document.getElementById('chemical-inventory-host')||[...document.querySelectorAll('section.data-panel')].find(x=>x.id!=='chem-v106'&&/Inventário de químicos/i.test(x.textContent||''))}
 function css(){if(document.getElementById('c106invcss'))return;const s=document.createElement('style');s.id='c106invcss';s.textContent=`#chem-v106{color:#082d52}#chem-v106 table{width:100%;border-collapse:collapse;min-width:1100px}#chem-v106 th{background:#194a78;color:#fff;text-align:left;padding:11px 12px}#chem-v106 td{padding:10px 12px;border-bottom:1px solid #dce8f1}#chem-v106 input,#chem-v106 select{width:100%;border:1px solid #b9d2e7;border-radius:10px;padding:11px;background:#fff;box-sizing:border-box}#chem-v106 .fields{display:grid;grid-template-columns:220px 1fr;gap:14px;margin:14px 0}#chem-v106 label{font-weight:800;display:block;margin-bottom:6px}#chem-v106 .prod{font-weight:900}#chem-v106 .pending{background:#fff3d6;color:#9a5b00;border-radius:999px;padding:5px 9px;font-weight:800;font-size:12px}#chem-v106 .actions{display:flex;justify-content:flex-end;margin-top:16px}#chem-v106 button{border:0;border-radius:10px;padding:12px 18px;font-weight:900;background:#3188c9;color:#fff;cursor:pointer}#chem-v106 .note{color:#607b94;font-size:14px}#chem-v106 .sync{margin-top:10px;padding:9px 12px;border-radius:10px;background:#eef8ff;color:#245a80;font-size:13px}`;document.head.appendChild(s)}
 function selectedMatch(pref,o){if(!pref)return false;return norm(pref.supplier)===norm(o.supplier)&&norm(pref.commercialName||pref.product)===norm(o.commercialName||o.product)&&Number(pref.pack||0)===Number(o.pack||0)}
 async function mount(force=false){
   if(location.pathname!==ROUTE||mounting)return;
   if(!force&&document.getElementById('chem-v106'))return;
   mounting=true;
   try{
     css(); const p=native(); if(!p)return;
     await window.GAO_CHEM_DB_LOAD?.();
     if(!p.isConnected||location.pathname!==ROUTE)return;
     if(!window.GAO_CHEM_DB_READY){
       p.querySelector('[role=status]').textContent='Não foi possível conectar o inventário. Atualize a página e tente novamente.';
       return;
     }
     const [d,M]=await Promise.all([data(),Promise.resolve(master())]), avg=aggregate(d,M), stored=load(), latest=stored.latest||{}, items=migrateItems(latest.items,M), unmapped=Object.keys(d.avgWeeklyLiters||{}).filter(a=>!resolve(a,M));
     if(!p.isConnected||location.pathname!==ROUTE)return;
     for(const principle of M.principles||[])if(principle.name&&!Object.hasOwn(avg,principle.name))avg[principle.name]=0;
     if(!Object.keys(avg).length){
       p.querySelector('[role=status]').innerHTML='Cadastre os princípios ativos para iniciar o inventário. <a href="/quimicos/produtos">Abrir cadastros</a>';
       return;
     }
     document.getElementById('chem-v106')?.remove();
     p.style.display='none';
     const x=document.createElement('section');x.id='chem-v106';x.className='data-panel';
     x.innerHTML=`<div><div style="font-size:12px;letter-spacing:2px;color:#0877bd;font-weight:900">ESTOQUE FÍSICO</div><h2>Inventário de químicos por princípio ativo</h2><div class="note">Selecione o <b>fornecedor / produto comercial / apresentação</b> correspondente à posição física. O princípio ativo continua sendo a referência analítica.</div><div class="sync">Cadastro comercial carregado: <b>${(M.suppliers||[]).length} fornecedor(es)</b> e <b>${(M.offers||[]).length} produto(s)/apresentação(ões)</b>.</div>${unmapped.length?`<div style="margin-top:12px;padding:10px;background:#fff4d8;border-radius:10px;color:#8a5600"><b>Pendente de vínculo histórico:</b> ${unmapped.map(esc).join(', ')}.</div>`:''}</div><form><div class="fields"><div><label>Data do inventário</label><input id="i106date" type="date" required value="${esc(latest.date||new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date()))}"></div><div><label>Observação</label><input id="i106note" value="${esc(latest.note||'')}"></div></div><div style="overflow:auto"><table><thead><tr><th>Princípio ativo</th><th>Fornecedor / produto comercial / apresentação</th><th>Consumo médio semanal</th><th>Saldo atual (L)</th><th>Em trânsito (L)</th></tr></thead><tbody>${Object.entries(avg).sort((a,b)=>a[0].localeCompare(b[0])).map(([name,w])=>{const ops=offers(name,M),it=items[name]||{},pref=it.preferredOffer;return `<tr data-p="${esc(name)}"><td class="prod">${esc(name)}</td><td>${ops.length?`<select class="offer"><option value="">Selecione o fornecedor / produto</option>${ops.map((o,i)=>`<option value="${i}" ${(selectedMatch(pref,o)||(!pref&&ops.length===1))?'selected':''}>${esc(label(o))}</option>`).join('')}</select>`:'<span class="pending">Produto comercial pendente</span>'}</td><td>${fmt(w)} L/sem</td><td><input class="stock" type="number" min="0" step="0.001" aria-label="Saldo atual de ${esc(name)} em litros" value="${esc(it.stock??'')}"></td><td><input class="transit" type="number" min="0" step="0.001" aria-label="Em trânsito de ${esc(name)} em litros" value="${esc(it.transit??'')}"></td></tr>`}).join('')}</tbody></table></div><div class="actions"><button id="i106save" type="submit">Salvar inventário</button></div><p role="status" class="note"></p></form>`;
     p.after(x);
     const form=x.querySelector('form'),button=x.querySelector('#i106save'),status=form.querySelector('[role=status]');
     form.onsubmit=async event=>{
       event.preventDefault();
       if(button.disabled)return;
       const cur=load(),out=migrateItems(cur.latest?.items,M);
       let filled=0;
       for(const row of form.querySelectorAll('tbody tr')){
         const name=row.dataset.p,stock=row.querySelector('.stock').value,transit=row.querySelector('.transit').value;
         if(stock===''&&transit==='')continue;
         const ops=offers(name,M),selection=row.querySelector('.offer')?.value;
         const offer=selection?ops[Number(selection)]:(ops.length===1?ops[0]:null);
         out[name]={stock:stock===''?out[name]?.stock??0:Number(stock),transit:transit===''?out[name]?.transit??0:Number(transit),preferredOffer:offer||null,offerKey:offer?[offer.principle,offer.commercialName||offer.product,offer.supplier,offer.pack].join('|'):''};
         filled++;
       }
       if(!filled){status.textContent='Informe o saldo ou o trânsito de pelo menos um produto.';return;}
       const snap={date:x.querySelector('#i106date').value,note:x.querySelector('#i106note').value,items:out,basis:'principle-active-v106',savedAt:new Date().toISOString()};
       const snapshots=Array.isArray(cur.snapshots)?cur.snapshots:[];
       button.disabled=true;status.textContent='Salvando inventário…';
       try{
         await window.GAO_CHEM_SAVE_INVENTORY({latest:snap,snapshots:[...snapshots,snap].slice(-52)});
         status.innerHTML='Inventário salvo. <a href="/quimicos/compras">Abrir sugestão de compra</a>';
       }catch(error){
         status.textContent=/permission|policy|42501/i.test(error.message)?'Seu perfil não tem permissão para salvar o inventário de químicos.':'Não foi possível salvar o inventário. Confira a conexão e tente novamente.';
       }finally{button.disabled=false}
     };
   } catch(error){
     const status=native()?.querySelector('[role=status]');
     if(status)status.textContent=error.message;
   } finally {mounting=false}
 }
 function cleanup(){document.getElementById('chem-v106')?.remove();document.querySelectorAll('section.data-panel').forEach(e=>{if(/Inventário de químicos/i.test(e.textContent||''))e.style.display=''})}
 function tick(){if(location.pathname!==last){last=location.pathname;cleanup();if(location.pathname===ROUTE)setTimeout(()=>mount(),120)}else if(location.pathname===ROUTE&&!document.getElementById('chem-v106')&&window.GAO_CHEM_DB_READY!==false)mount()}
 window.addEventListener('gao-chem-db-ready',()=>{if(location.pathname===ROUTE){cleanup();setTimeout(()=>mount(true),30)}});
 window.addEventListener('storage',e=>{if(e.key===MASTER&&location.pathname===ROUTE){cleanup();setTimeout(()=>mount(true),30)}});
 setInterval(tick,400);addEventListener('popstate',tick);tick();
})();
