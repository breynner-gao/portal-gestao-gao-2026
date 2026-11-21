import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../linen-risk-panel-v150.js',import.meta.url),'utf8');

test('seleção de arquivo continua funcionando depois de uma atualização da tela por foco',()=>{
  let currentInput,reads=0;
  const makeInput=()=>({id:'lr150-file',value:'',addEventListener(name,callback){this['on'+name]=callback;},files:[{name:'relatorio-geral-4.xlsx'}],replaceWith(input){currentInput=input;}});
  currentInput=makeInput();
  const shell={querySelectorAll:()=>[currentInput],querySelector:selector=>selector==='#lr150-file'?currentInput:null,set innerHTML(value){currentInput=makeInput();}};
  const heading={querySelector:()=>({})};
  const host={querySelector:()=>heading};
  const document={activeElement:{},querySelector:selector=>({'#gao-linen-risk-shell':shell,'.page-stack .data-panel':host,'#lr150-file':currentInput}[selector]||null),querySelectorAll:()=>[]};
  const context={document,route:()=>true,state:{rows:[],baseRows:[]},br:String,dateBr:String,window:{},panel:()=>'',mountTextileSubmenu:()=>{},hideLegacyDimensioningForm:()=>{},readRfidFile:()=>reads++,syncSharedSnapshot:()=>{}};
  const render=source.slice(source.indexOf('function render() {'),source.indexOf('async function mount()'));
  const bind=source.slice(source.indexOf('function bind() {'),source.indexOf('function hideLegacyDimensioningForm'));
  const api=runInNewContext(render+bind+';({render,bind})',context);
  api.bind();
  const pickerInput=currentInput;
  api.render();api.render();
  assert.equal(currentInput,pickerInput,'o seletor original precisa receber o resultado da janela nativa');
  pickerInput.onchange({target:pickerInput});
  assert.equal(reads,1,'a importação precisa executar uma única vez após várias renderizações');
});

test('base local recém-importada não é substituída pela consulta de foco ainda em andamento',async()=>{
  let focus,finish,loads=0;
  const state={loaded:true,needsCloudSync:false,cloudUpdatedAt:'2026-11-19T00:00:00Z'};
  const context={window:{addEventListener:(name,callback)=>{focus=callback;}},route:()=>true,state,weeklyBusy:false,cloudContext:async()=>({}),loadSharedSnapshot:()=>new Promise(resolve=>finish=resolve),load:async()=>loads++,render:()=>{}};
  runInNewContext(source.slice(source.lastIndexOf("window.addEventListener('focus', async () => {")),context);
  const pending=focus();
  await new Promise(resolve=>setImmediate(resolve));
  state.needsCloudSync=true;
  finish({updated_at:'2026-11-21T00:00:00Z'});
  await pending;
  assert.equal(loads,0);
});

test('consulta já iniciada não apaga uma importação concluída enquanto aguardava a rede',async()=>{
  let finish;
  const context={state:{loaded:true,fileName:'antiga.xlsx'},rfidRevision:0,readCurrent:()=>null,cloudContext:async()=>({canWrite:true,organizationId:'gao'}),idealRevision:0,idealSaving:false,loadSharedSnapshot:()=>new Promise(resolve=>finish=resolve),readIdealReferences:async()=>new Map()};
  const loadSource=source.slice(source.indexOf('async function load(force'),source.indexOf('function summary()'));
  const api=runInNewContext(loadSource+';({load})',context);
  const pending=api.load(true);
  await new Promise(resolve=>setImmediate(resolve));
  context.rfidRevision++;
  context.state.fileName='relatorio-geral-4.xlsx';
  context.state.needsCloudSync=true;
  finish({rows:[{}],file_name:'antiga.xlsx'});
  await pending;
  assert.equal(context.state.fileName,'relatorio-geral-4.xlsx');
  assert.equal(context.state.needsCloudSync,true);
});
