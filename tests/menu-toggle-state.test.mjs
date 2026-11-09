import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/gao-ui-fix-v1.js',import.meta.url),'utf8');
function harness(mobile=false,stored='closed'){
 const classes=new Set(),events={},attrs={},storage=new Map([['gao-mobile-menu-state',stored]]);
 const body={classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){if(on===undefined)on=!classes.has(c);on?classes.add(c):classes.delete(c);return on;}}};
 const toggle={dataset:{},textContent:'☰',setAttribute:(k,v)=>attrs[k]=v,addEventListener:(k,fn)=>events[k]=fn};
 const backdrop={addEventListener(){}};const side={};
 const document={body,getElementById:id=>id==='gao-mobile-menu-toggle'?toggle:backdrop,addEventListener(){}};
 const context={document,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},window:{matchMedia:()=>({matches:mobile})}};
 const start=source.indexOf('let menuStateRestored');const prefix=start>=0?source.slice(start,source.indexOf('function ensureMobileMenu')):'';
 vm.createContext(context);vm.runInContext(prefix+source.slice(source.indexOf('function ensureMobileMenu'),source.indexOf('function setup()')),context);
 return{setup:()=>context.ensureMobileMenu(side),click:()=>events.click(),classes,attrs,storage};
}
test('desktop reabre preferência fechada e permanece aberto após atualização do conteúdo',()=>{const h=harness(false);h.setup();assert.ok(h.classes.has('gao-mobile-menu-closed'));h.click();h.setup();h.setup();assert.equal(h.classes.has('gao-mobile-menu-closed'),false);assert.equal(h.attrs['aria-expanded'],'true');assert.equal(h.storage.get('gao-mobile-menu-state'),'open');h.click();h.setup();assert.equal(h.attrs['aria-expanded'],'false');});
test('tablet alterna repetidamente sem duplicar o estado após remontagem',()=>{const h=harness(true);h.setup();for(let i=0;i<6;i++){h.click();h.setup();assert.equal(h.classes.has('gao-mobile-menu-closed'),i%2===1);}});
test('a preferência gravada deve ser lida somente na inicialização',()=>{const h=harness(false,'open');h.setup();h.storage.set('gao-mobile-menu-state','closed');h.setup();assert.equal(h.classes.has('gao-mobile-menu-closed'),false);});
