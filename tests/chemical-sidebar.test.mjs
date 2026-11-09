import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFile}from'node:fs/promises';
const source=await readFile(new URL('../chemicals-sidebar-v1.js',import.meta.url),'utf8');
function fixture(){
 const handlers={};const sidebar=[];let clicked='';
 function node(){const classes=new Set();return{dataset:{},children:[],attrs:{},className:'',classList:{contains:v=>classes.has(v),toggle(v,yes){yes?classes.add(v):classes.delete(v)}},setAttribute(k,v){this.attrs[k]=v},getAttribute(k){return this.attrs[k]},appendChild(n){this.children.push(n)},querySelectorAll(){return this.children},remove(){sidebar.splice(sidebar.indexOf(this),1)},closest(){return this}};}
 const buttons={};for(const id of ['painel','lancamento','historico','relave','principios','inventario','sugestao','importacao']){buttons[id]=node();buttons[id].dataset.sub=id;buttons[id].click=()=>{clicked=id};}
 buttons.painel.classList.toggle('active',true);
 const tabs={querySelector(selector){if(selector==='[data-sub].active')return buttons.painel;if(selector.includes('data-relave-tab'))return buttons.relave;const key=selector.match(/data-sub="([^"]+)"/)?.[1];return buttons[key]}};
 const home={after(n){sidebar.push(n)}};
 const document={head:{appendChild(){}},documentElement:{},createElement:node,addEventListener(type,handler){handlers[type]=handler},querySelector(selector){if(selector.includes('a[href='))return home;if(selector==='.gao-main .gao-tabs')return tabs;if(selector==='.gao-chemical-subnav')return sidebar[0];}};
 const context={document,location:{pathname:'/quimicos',hash:''},window:{addEventListener(){}},setTimeout(){},MutationObserver:class{observe(){}}};vm.createContext(context);vm.runInContext(source.replace(/\}\)\(\);\s*$/,'window.test={mount};})();'),context);
 return{sidebar,buttons,tabs,context,click(id){handlers.click({target:sidebar[0].children.find(b=>b.dataset.chemicalTarget===id)})},get clicked(){return clicked}};
}
test('Químicos cria um único submenu lateral mantendo as ações originais no conteúdo',()=>{const f=fixture();assert.equal(f.sidebar.length,1);assert.equal(f.sidebar[0].children.length,8);assert.equal(f.sidebar[0].attrs['aria-label'],'Submenu Químicos');f.context.window.test.mount();assert.equal(f.sidebar.length,1);f.click('lancamento');assert.equal(f.clicked,'lancamento');assert.equal(f.sidebar[0].children.filter(b=>b.classList.contains('active')).length,1);assert.ok(f.tabs.querySelector('[data-sub="lancamento"]'));});
test('submenu de químicos é removido quando outro módulo abre',()=>{const f=fixture();f.context.location.pathname='/enxoval-tecidos';f.context.window.test.mount();assert.equal(f.sidebar.length,0);});
test('Relave procura a barra do conteúdo sem confundir o submenu lateral',async()=>{const relave=await readFile(new URL('../chemicals-relave-v123.js',import.meta.url),'utf8');assert.match(relave,/const candidates=\[\.\.\.document\.querySelectorAll\('\.gao-main button,\.gao-main a'\)\]/);});
