import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const admin = await readFile(new URL('../admin-access-v1.mjs', import.meta.url), 'utf8');

test('Costura e Qualidade da Produção podem ser liberadas separadamente', () => {
  const helpers = admin.slice(admin.indexOf('function permittedModule('), admin.indexOf('function enforceNavigation('));
  const check = (route, permissions) => {
    const context = { admin: false, permissions: new Set(permissions) };
    return runInNewContext(helpers + 'permittedModule(linkModule({getAttribute:()=>route}))', {context, route});
  };
  assert.equal(check('/#producao', ['production.sewing.execute']), true);
  assert.equal(check('/#qualidade-costura', ['production.sewing.execute']), true);
  assert.equal(check('/#qualidade-costura', ['production.sewing.view']), true);
  assert.equal(check('/#producao-qualidade', ['production.sewing.execute']), false);
  assert.equal(check('/#producao-qualidade', ['production.quality.view']), true);
  assert.equal(check('/#qualidade', ['production.quality.view']), false);
  assert.equal(check('/#qualidade-costura', ['quality.routine.execute']), false);
});

test('permissão da facção abre somente seu portal e bloqueia as telas gerais de enxoval', () => {
  const helpers = admin.slice(admin.indexOf('function permittedModule('), admin.indexOf('function enforceNavigation('));
  const allowed = (route, permissions, admin = false) => runInNewContext(
    helpers + 'permittedModule(linkModule({getAttribute:()=>route}))',
    {context: {admin, permissions: new Set(permissions)}, route}
  );
  const faction = ['textiles.production.manage'];
  assert.equal(allowed('/enxoval-tecidos/faccao', faction), true);
  assert.equal(allowed('/enxoval-tecidos/faccao/?tela=corte', faction), true);
  for (const route of ['/enxoval-tecidos', '/#enxoval', '/#compras', '/producao/gestao-enxoval', '/#administracao']) {
    assert.equal(allowed(route, faction), false, route);
  }
  assert.equal(allowed('/enxoval-tecidos/faccao', ['production.sewing.execute']), false);
  assert.equal(allowed('/enxoval-tecidos', ['textiles.inventory.view']), true);
  assert.equal(allowed('/enxoval-tecidos', [], true), true);
});
