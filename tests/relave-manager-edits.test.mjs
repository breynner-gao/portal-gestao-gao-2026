import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../chemicals-relave-v123.js', import.meta.url), 'utf8');
const saveSource = source.slice(source.indexOf('async function saveOperationRecord('), source.indexOf('async function excludeOperationRecord('));

function fixture(canEdit, withWeighing = true, kind = 'internal') {
  const key = 'l:existing';
  const weighing = {receivingCommand:'123',received:20,resolved:true};
  const original = {__key:key,id:'existing',date:'2026-11-15',command:'121',kind,relaveTotal:21,relaveItems:[],...(withWeighing?{weighing}:{})};
  let current = original;
  const api = runInNewContext(saveSource + '({saveOperationRecord,saveOperationWeighing})', {
    all: () => [current],
    state: () => ({overrides:{}}),
    updateEntry: (_, next) => {current={...current,...next};},
    requireRelaveManager: () => {if(!canEdit)throw Error('Conta de gestor necessária.');},
    syncRelaveOperation: async()=>{},
    operationRecord: row=>row,
    weekNo: ()=>47,
    n:Number
  });
  return {api,key,weighing,original,current:()=>current};
}

const corrected = {command:'122',date:'2026-11-16',kind:'internal',sorted:150,items:[{type:'Lençol',weight:21}]};

test('gestor pode corrigir comanda e data preservando o vínculo da pesagem', async()=>{
  const {api,key,weighing}=fixture(true);
  const updated=await api.saveOperationRecord(corrected,key);
  assert.equal(updated.command,'122');
  assert.equal(updated.date,'2026-11-16');
  assert.equal(updated.weighing,weighing);
  await assert.rejects(api.saveOperationRecord({...corrected,kind:'customer'},key),/tipo precisa permanecer/);
});

test('operador registra a primeira pesagem e a revisão requer perfil de gestor', async()=>{
  const {api,key,weighing,current}=fixture(false,false);
  await assert.rejects(api.saveOperationRecord(corrected,key),/Conta de gestor/);
  await api.saveOperationWeighing({key},weighing);
  assert.equal(current().weighing,weighing);
  await assert.rejects(api.saveOperationWeighing({key},{...weighing,received:22}),/Conta de gestor/);
});

test('a revisão permite ao gestor alterar a data da expedição junto da pesagem', async()=>{
  const {api,key,weighing,current}=fixture(true);
  const updated=await api.saveOperationWeighing({key,date:'2026-11-15'},weighing,'2026-11-14');
  assert.equal(updated.date,'2026-11-14');
  assert.equal(updated.weighing,weighing);
  assert.equal(current().date,'2026-11-14');
  await assert.rejects(api.saveOperationWeighing({key},weighing,'2026-02-31'),/data.*válida/);
  const operator=fixture(false,false);
  await assert.rejects(operator.api.saveOperationWeighing({key},weighing,'2026-11-14'),/Conta de gestor/);
  assert.equal(operator.current().date,'2026-11-15');
});

test('gestor vincula as três comandas na conferência da ocorrência', async()=>{
  const {api,key,current}=fixture(true,false,'customer');
  await assert.rejects(api.saveOperationWeighing({key},{receivingCommand:'0003'}),/comanda da expedição/);
  await api.saveOperationWeighing({key},{expeditionCommand:'0002',receivingCommand:'0003',received:20});
  assert.equal(current().command,'121');
  assert.equal(current().weighing.expeditionCommand,'0002');
  assert.equal(current().weighing.receivingCommand,'0003');
  const operator=fixture(false,false,'customer');
  await assert.rejects(operator.api.saveOperationWeighing({key},{expeditionCommand:'0004',receivingCommand:'0003',received:21}),/Conta de gestor/);
});

test('revisar número da expedição na ocorrência reabre o desvio e mantém a comanda da área suja', async()=>{
  const {api,key,current}=fixture(true,true,'customer');
  await api.saveOperationRecord({...corrected,kind:'customer',expeditionCommand:'0002',qualityWeight:29,returnedWeight:8},key);
  assert.equal(current().weighing.expeditionCommand,'0002');
  assert.equal(current().weighing.receivingCommand,'123');
  assert.equal(current().weighing.resolved,false);
  assert.equal(current().qualityWeight,29);
  assert.equal(current().returnedWeight,8);
});
