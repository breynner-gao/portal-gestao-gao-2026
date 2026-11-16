import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const auth = await readFile(new URL('../supabase-auth-v1.js', import.meta.url), 'utf8');

test('login permite mostrar e ocultar a senha digitada sem submeter o formulário', () => {
  const password = {type: 'password', value: 'exemplo'};
  const toggle = { addEventListener(type, handler) {if (type === 'click') this.click = handler;} };
  const gate = {
    querySelector(selector) {
      return ({
        '#gao-auth-password': password,
        '#gao-auth-password-toggle': toggle,
        form: {addEventListener(){}}
      })[selector];
    }
  };
  const context = {
    window: {}, signingOut: false,
    document: {
      getElementById: () => null,
      createElement: tag => tag === 'style' ? {} : gate,
      head: {appendChild(){}}, body: {appendChild(){}}
    }
  };
  const showGate = auth.slice(auth.indexOf('const showGate='), auth.indexOf('let signingOut='));
  runInNewContext(showGate + 'showGate()', context);
  assert.match(gate.innerHTML, /<button type="button" id="gao-auth-password-toggle"/);
  toggle.click();
  assert.equal(password.type, 'text');
  assert.equal(toggle.textContent, 'Ocultar senha');
  toggle.click();
  assert.equal(password.type, 'password');
  assert.equal(toggle.textContent, 'Mostrar senha');
  assert.equal(password.value, 'exemplo');
});
