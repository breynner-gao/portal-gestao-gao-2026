import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ui = await readFile(new URL('../src/gao-ui-fix-v1.js', import.meta.url), 'utf8');
const core = await readFile(new URL('../portal-sgq-core.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const linen = await readFile(new URL('../linen-risk-panel-v150.js', import.meta.url), 'utf8');
const fabric = await readFile(new URL('../fabric-workflow-ui-v1.js', import.meta.url), 'utf8');

test('menu de tablet mantém os módulos em botões separados e fáceis de tocar', () => {
  assert.match(ui, /@media\(max-width:900px\)[\s\S]*?\.gao-nav\{[^}]*display:flex!important;[^}]*flex-flow:row wrap!important/);
  assert.match(ui, /\.gao-nav>a\{[^}]*min-height:48px!important/);
  assert.match(ui, /\.gao-nav>a\{[^}]*touch-action:manipulation!important/);
});

test('layout responsivo já está definido no HTML antes dos scripts do portal', () => {
  const head = index.slice(0, index.indexOf('<body'));
  assert.match(head, /id="gao-nav-responsive-early"/);
  assert.match(head, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.gao-shell\s+\.gao-nav\s*\{[^}]*display:flex!important/);
  assert.match(head, /\.gao-shell\s+\.gao-nav\s*>a\s*\{[^}]*min-height:48px!important/);
  assert.match(head, /\.gao-shell\s+\.gao-nav>\.gao-subnav\.gao-menu-open\s*\{[^}]*position:static!important;[^}]*display:flex!important/);
});

test('atalhos da Rouparia abrem em camada própria e não deslocam os módulos', () => {
  assert.match(ui, /\.gao-subnav\.gao-menu-open\{display:grid!important\}/);
  assert.match(ui, /\.gao-nav>\.gao-subnav\.gao-menu-open\{[^}]*order:1!important;[^}]*flex:1 0 100%!important;[^}]*display:flex!important/);
  assert.match(ui, /\.gao-nav>a\{[^}]*order:0!important/);
  assert.doesNotMatch(core, /\.gao-nav>a\[href="\/rouparia"\]:hover\+\.gao-subnav/);
});

test('clique no módulo Rouparia segue a rota; atalhos aparecem pela rota ativa', () => {
  assert.match(core, /\['rouparia','Rouparia'\][\s\S]*?class="gao-subnav gao-menu-open"[\s\S]*?href="\/rouparia\/contratos"/);
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

test('Enxoval e fluxo de tecido montam pela rota antiga com hash e pela rota direta', () => {
  assert.match(linen, /path === '\/enxoval-tecidos' \|\| location\.hash === '#enxoval' \|\| location\.hash === '#enxoval-tecidos'/);
  assert.match(fabric, /path==='\/enxoval-tecidos'\|\|location\.hash==='#enxoval'\|\|location\.hash==='#enxoval-tecidos'/);
  assert.match(index, /linen-risk-panel-v150\.js\?v=230/);
  assert.match(index, /fabric-workflow-ui-v1\.js\?v=13/);
  assert.match(index, /portal-sgq-core\.js\?v=13/);
  assert.match(index, /gao-ui-fix-v1\.js\?v=3/);
});
