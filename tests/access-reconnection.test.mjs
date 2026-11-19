import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInContext, createContext} from 'node:vm';

const source = await readFile(new URL('../admin-access-v1.mjs', import.meta.url), 'utf8');
const refreshSource = source.slice(source.indexOf('function accessStatus('), source.indexOf("\nif(typeof window"));

function setup(outcomes) {
  const banners = [];
  const scheduled = [];
  const classes = new Set();
  const form = {quantity: '184', notes: 'Conferência em andamento'};
  const main = {
    form,
    classList: {add: name => classes.add(name)},
    setAttribute() {},
    querySelector: () => banners.find(item => item.dataset.accessDenied),
    appendChild: element => banners.push(element)
  };
  const nav = {};
  const document = {
    querySelector: selector => selector === '.gao-main' ? main : nav,
    getElementById: id => banners.find(item => item.id === id),
    createElement() {
      const element = {dataset: {}, setAttribute() {}, remove() {banners.splice(banners.indexOf(element), 1);}};
      return element;
    },
    body: {appendChild: element => banners.push(element)}
  };
  const sandbox = createContext({
    context: {uid: 'same-user'}, refreshing: false, accessPending: false,
    retryTimer: null, retryDelay: 2000,
    document, window: {}, token: () => 'session',
    can: () => false, permittedModule: () => false,
    ownContext: async () => {
      const outcome = outcomes.shift();
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
    enforceNavigation() {classes.delete('ga-route-denied');},
    setTimeout(callback, delay) {scheduled.push({callback, delay}); return scheduled.length;},
    clearTimeout() {}
  });
  runInContext(refreshSource, sandbox);
  return {sandbox, main, nav, form, banners, scheduled, classes, refresh: () => sandbox.refresh()};
}

test('falha temporária preserva formulário, bloqueia interação e recupera automaticamente', async () => {
  const failure = Object.assign(new Error('Servidor indisponível'), {status: 503});
  const app = setup([failure, {uid: 'same-user', permissions: new Set(['textiles.production.manage'])}]);
  await app.refresh();
  assert.equal(app.sandbox.context, null);
  assert.equal(app.main.inert, true);
  assert.equal(app.nav.inert, true);
  assert.equal(app.main.form, app.form);
  assert.equal(app.form.quantity, '184');
  assert.equal(app.classes.has('ga-route-denied'), false);
  assert.match(app.banners[0].textContent, /Reconectando/);
  assert.equal(app.scheduled[0].delay, 2000);
  await app.scheduled[0].callback();
  assert.equal(app.main.inert, false);
  assert.equal(app.nav.inert, false);
  assert.equal(app.banners.length, 0);
  assert.equal(app.main.form.notes, 'Conferência em andamento');
  assert.equal(app.sandbox.context.permissions.size, 1);
});

test('falha de rede e limite de requisições repetem com intervalo crescente até 30 segundos', async () => {
  const app = setup(Array.from({length: 6}, (_, index) => index === 0
    ? new TypeError('Failed to fetch')
    : Object.assign(new Error('Too many requests'), {status: 429})));
  await app.refresh();
  for (let index = 0; index < 5; index++) await app.scheduled[index].callback();
  assert.deepEqual(app.scheduled.map(item => item.delay), [2000, 4000, 8000, 16000, 30000, 30000]);
  assert.equal(app.banners.length, 1);
  assert.equal(app.sandbox.context, null);
});

test('sessão inválida e vínculo revogado bloqueiam acesso imediatamente', async () => {
  for (const status of [401, 403]) {
    const app = setup([Object.assign(new Error('Acesso recusado'), {status})]);
    await app.refresh();
    assert.equal(app.sandbox.context, null);
    assert.equal(app.classes.has('ga-route-denied'), true);
    assert.equal(app.scheduled.length, 0);
    assert.equal(app.banners.length, 1);
    assert.match(app.banners[0].textContent, status === 401 ? /sessão expirou/ : /não está autorizado/);
  }
});

test('verificações simultâneas compartilham a consulta em andamento', async () => {
  const app = setup([{uid: 'same-user'}]);
  let finish;
  let calls = 0;
  app.sandbox.ownContext = () => {
    calls++;
    return new Promise(resolve => {finish = resolve;});
  };
  const first = app.refresh();
  await app.refresh();
  assert.equal(calls, 1);
  finish({uid: 'same-user'});
  await first;
  assert.equal(app.sandbox.refreshing, false);
});
