import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../admin-access-v1.mjs', import.meta.url), 'utf8');
const api = source.slice(source.indexOf('async function api('), source.indexOf('const rpc='));

function requestWith(errorBody) {
  return runInNewContext(api + "api('/functions/v1/admin-users', {action:'create'})", {
    SB: 'https://example.test',
    KEY: 'test-key',
    token: () => 'test-session',
    fetch: async () => ({status:400,ok:false,json:async()=>errorBody})
  });
}

test('cadastro explica quando a validação rejeita o e-mail', async () => {
  await assert.rejects(requestWith({
    error:'Solicitação inválida.',
    details:{fieldErrors:{input:['Invalid email address']}}
  }), /Informe um e-mail de acesso válido/);
  await assert.rejects(requestWith({
    error:'Solicitação inválida.',
    details:{fieldErrors:{input:['UUID inválido']}}
  }), /Solicitação inválida/);
});
