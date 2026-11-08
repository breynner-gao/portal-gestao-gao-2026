import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../security-session-v614.js', import.meta.url), 'utf8');

function simulate({ authGate = false, idleMs = 0 } = {}) {
  const start = 1_000_000;
  let now = start;
  let tick;
  const appended = [];
  const document = {
    hidden: false,
    querySelector(selector) {
      if (selector === '#gao-supabase-auth-gate') return authGate ? {} : null;
      return null;
    },
    getElementById(id) {
      if (id === 'gao-session-warning') return appended.find(item => item.id === id) || null;
      return null;
    },
    createElement() {
      return { id: '', innerHTML: '', querySelector: () => ({}) };
    },
    body: { appendChild: element => appended.push(element) }
  };
  class FakeDate extends Date {
    static now() { return now; }
  }
  vm.runInNewContext(source, {
    Date: FakeDate,
    document,
    location: { pathname: '/enxoval-tecidos' },
    addEventListener() {},
    setInterval(callback) { tick = callback; return 1; },
    setTimeout() {},
    localStorage: { removeItem() {} },
    sessionStorage: { clear() {} },
    window: {}
  });
  now = start + idleMs;
  tick();
  return appended;
}

test('não exibe aviso de expiração sobre a tela de login do Supabase', () => {
  const appended = simulate({ authGate: true, idleMs: 26 * 60 * 1000 });
  assert.equal(appended.some(element => element.id === 'gao-session-warning'), false);
});

test('mantém o aviso de expiração para uma sessão autenticada inativa', () => {
  const appended = simulate({ authGate: false, idleMs: 26 * 60 * 1000 });
  assert.equal(appended.some(element => element.id === 'gao-session-warning'), true);
});
