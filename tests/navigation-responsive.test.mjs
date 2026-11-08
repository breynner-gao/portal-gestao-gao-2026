import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ui = await readFile(new URL('../src/gao-ui-fix-v1.js', import.meta.url), 'utf8');
const core = await readFile(new URL('../portal-sgq-core.js', import.meta.url), 'utf8');

test('menu de tablet mantém os módulos em botões separados e fáceis de tocar', () => {
  assert.match(ui, /@media\(max-width:900px\)[\s\S]*?\.gao-nav\{[^}]*display:flex!important;[^}]*flex-flow:row wrap!important/);
  assert.match(ui, /\.gao-nav>a\{[^}]*min-height:48px!important/);
  assert.match(ui, /\.gao-nav>a\{[^}]*touch-action:manipulation!important/);
});

test('atalhos da Rouparia abrem em camada própria e não deslocam os módulos', () => {
  assert.match(ui, /\.gao-subnav,\.gao-subnav:has\(a\.active\)\{[^}]*position:absolute!important/);
  assert.match(ui, /\.gao-subnav:not\(:has\(a\.active\)\)\{display:none!important\}/);
  assert.doesNotMatch(core, /\.gao-nav>a\[href="\/rouparia"\]:hover\+\.gao-subnav/);
});

test('clique no módulo Rouparia segue a rota; atalhos aparecem pela rota ativa', () => {
  assert.match(core, /\['rouparia','Rouparia'\][\s\S]*?href="\/rouparia\/contratos"/);
  assert.doesNotMatch(core, /roupariaLink\.addEventListener\('click',[\s\S]*?preventDefault\(\)/);
  assert.match(core, /\.gao-subnav:has\(a\.active\)\{display:grid\}/);
});

test('cada módulo principal tem um destino único', () => {
  const definition = core.match(/const H=(\(?k\)?=>[^;]+);/);
  assert.ok(definition, 'não encontrou o mapeamento dos destinos de menu');
  const href = new Function(`return (${definition[1]})`)();
  const expected = {
    painel: '/#painel', quimicos: '/quimicos', rouparia: '/rouparia',
    enxoval: '/enxoval-tecidos', compras: '/#compras', importacoes: '/#importacoes',
    administracao: '/#administracao', qualidade: '/qualidade',
    indicadores: '/#indicadores-performance',
  };
  for (const [module, destination] of Object.entries(expected)) {
    assert.equal(href(module), destination, `destino incorreto para ${module}`);
  }
});
