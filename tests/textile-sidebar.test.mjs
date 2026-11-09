import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../linen-risk-panel-v150.js',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('function mountTextileSubmenu('),source.indexOf('\nfunction render() {'));
test('submenu sai do conteúdo e fica imediatamente abaixo do módulo na lateral sem duplicar ao renderizar',()=>{
 const children=[];let mainNav;
 const link={after(node){mainNav=null;children.splice(children.indexOf(link)+1,0,node)}};const purchases={name:'Compras'};children.push(link,purchases);
 const document={querySelector(selector){return selector.includes('a[href=')?link:children.find(n=>n.classes?.has('gao-textile-subnav'))}};
 const shell={querySelector(){return mainNav}};
 const makeNav=()=>{const node={classes:new Set(),attributes:{},classList:{add(c){node.classes.add(c)}},setAttribute(k,v){node.attributes[k]=v},remove(){children.splice(children.indexOf(node),1)}};return node};
 const context={document};vm.createContext(context);vm.runInContext(helper,context);
 mainNav=makeNav();context.mountTextileSubmenu(shell);assert.equal(mainNav,null);assert.equal(children.length,3);assert.equal(children[1].attributes['aria-label'],'Submenu Enxoval e Tecidos');assert.equal(children[2],purchases);
 const previous=children[1];mainNav=makeNav();context.mountTextileSubmenu(shell);assert.equal(children.length,3);assert.notEqual(children[1],previous);assert.equal(mainNav,null);
});
test('apresentação lateral é vertical e seleção pelo tablet fecha a gaveta',async()=>{
 const mobile=await readFile(new URL('../src/gao-ui-fix-v1.js',import.meta.url),'utf8');
 assert.match(source,/\.gao-sidebar \.gao-textile-subnav\{display:grid!important;grid-template-columns:minmax\(0,1fr\)!important/);
 assert.match(mobile,/closest\?\.\('\.gao-nav a,\.gao-textile-subnav button,\.gao-chemical-subnav button'\)/);
});
