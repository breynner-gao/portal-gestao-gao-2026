import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ui = await readFile(new URL('../src/gao-ui-fix-v1.js', import.meta.url), 'utf8');
const core = await readFile(new URL('../portal-sgq-core.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const linen = await readFile(new URL('../linen-risk-panel-v150.js', import.meta.url), 'utf8');
const faction = await readFile(new URL('../fabric-faction-workflow-v1.mjs', import.meta.url), 'utf8');
const fabric = await readFile(new URL('../fabric-workflow-ui-v1.js', import.meta.url), 'utf8');

test('tablet usa gaveta lateral vertical e botão móvel próprio', () => {
  assert.match(ui, /\.gao-mobile-menu-toggle/);
  assert.match(ui, /\.gao-mobile-menu-backdrop/);
  assert.match(ui, /body\.gao-mobile-menu-closed \.gao-sidebar/);
  assert.match(ui, /@media\(max-width:900px\)[\s\S]*?\.gao-sidebar\{[^}]*position:fixed!important/);
  assert.match(ui, /body\.gao-mobile-menu-closed \.gao-sidebar\{transform:translateX\(-110%\)!important/);
  assert.match(ui, /@media\(max-width:900px\)[\s\S]*?\.gao-nav\{[^}]*display:grid!important;[^}]*grid-template-columns:minmax\(0,1fr\)!important/);
  assert.doesNotMatch(ui, /\.gao-nav\{[^}]*flex-flow:row wrap!important/);
});

test('recolher no desktop esconde a lateral inteira sem faixa cortada', () => {
  assert.match(ui, /body\.gao-menu-collapsed \.gao-sidebar\{[^}]*width:0!important;[^}]*flex:0 0 0!important/);
  assert.match(ui, /\.gao-mobile-menu-toggle\{position:fixed!important/);
  assert.match(ui, /\.gao-sidebar \.gao-menu-toggle\{display:none!important\}/);
});

test('layout responsivo já está definido no HTML antes dos scripts do portal', () => {
  const head = index.slice(0, index.indexOf('<body'));
  assert.match(head, /id="gao-nav-responsive-early"/);
  assert.match(head, /@media\s*\(max-width:\s*900px\)[\s\S]*?\.gao-shell\s+\.gao-sidebar\s*\{[^}]*position:fixed!important/);
  assert.match(head, /\.gao-shell\s+\.gao-nav\s*\{[^}]*display:grid!important/);
  assert.match(head, /\.gao-shell\s+\.gao-nav>\.gao-subnav\.gao-menu-open\s*\{[^}]*position:static!important;[^}]*display:grid!important/);
});

test('atalhos da Rouparia abrem em camada própria e não deslocam os módulos', () => {
  assert.match(ui, /\.gao-subnav\.gao-menu-open\{display:grid!important\}/);
  assert.match(ui, /\.gao-nav>\.gao-subnav\.gao-menu-open\{[^}]*position:static!important;[^}]*display:grid!important/);
  assert.match(ui, /\.gao-subnav a\{[^}]*min-height:44px!important/);
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
    indicadores: '/#indicadores-performance', producao: '/#producao',
  };
  for (const [module, destination] of Object.entries(expected)) {
    assert.equal(href(module), destination, `destino incorreto para ${module}`);
  }
});

test('Enxoval e fluxo de tecido montam pela rota antiga com hash e pela rota direta', () => {
  assert.match(linen, /path === '\/enxoval-tecidos' \|\| location\.hash === '#enxoval' \|\| location\.hash === '#enxoval-tecidos'/);
  assert.match(fabric, /path==='\/enxoval-tecidos'\|\|location\.hash==='#enxoval'\|\|location\.hash==='#enxoval-tecidos'/);
  assert.match(index, /linen-risk-panel-v150\.js\?v=\d+(?=")/);
  assert.match(index, /fabric-workflow-ui-v1\.js\?v=\d+(?=")/);
  assert.match(index, /portal-sgq-core\.js\?v=\d+(?=")/);
  assert.match(index, /gao-ui-fix-v1\.js\?v=\d+(?=")/);
});

test('gaveta tem controle acessível e persiste preferência de abertura', () => {
  assert.match(ui, /gao-mobile-menu-toggle/);
  assert.match(ui, /aria-expanded/);
  assert.match(ui, /gao-mobile-menu-state/);
  assert.match(ui, /gao-mobile-menu-backdrop/);
  assert.match(ui, /if\(toggle\.textContent!==label\)toggle\.textContent=label/);
});

test('Portal da Facção tem entrada no menu principal e carrega no mesmo painel do Enxoval', () => {
  const href = new Function('return '+core.match(/const H=([^;]+);/)[1])();
  const route = new Function('location','return ('+core.match(/const R=(.*?)\};const H=/)[1]+'})()');
  assert.match(core, /\['faccao','Portal da Facção'\]/);
  assert.equal(href('faccao'), '/enxoval-tecidos/faccao');
  assert.equal(route({pathname:href('faccao'),hash:''}), 'faccao');
  assert.match(core, /r==='enxoval'\|\|r==='faccao'/);
  assert.match(linen, /path === '\/enxoval-tecidos\/faccao'/);
  assert.match(fabric, /directFactionRoute\?'faction-desk':'overview'/);
  assert.match(faction, /\['provision', 'Provisão Facção',[\s\S]*?\['cut', 'Corte',[\s\S]*?\['sewing', 'Costura',/);
});

test('as três etapas da Facção exibem as ordens e lotes do portal em tabelas', async () => {
  const {createFactionWorkflow} = await import('../fabric-faction-workflow-v1.mjs');
  const state = {
    orders:[{id:'1',status:'ABERTA',order_number:'2'}],
    items:[{id:'item',order_id:'1',product_name:'Camisa P53',product_reference:'53',ordered_pieces:200,consumption_m_per_piece:1.2,fabric_id:'p53'}],
    fabric:[{id:'p53',name:'Azul P53'}], suppliers:[],
    moves:[{order_item_id:'item',lot_id:'roll',reserved_delta_m:144}],
    cuts:[{id:'corte-01',order_item_id:'item',produced_pieces:80,consumed_m:94}],
    purchaseItems:[],purchaseOrders:[],returns:[]
  };
  let onClick;
  const page={querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(type,handler)=>{onClick=handler;}};
  const host={querySelector:q=>q==='.fw-faction-page'?page:null};
  const wf=createFactionWorkflow({
    state,esc:String,n:value=>Number(value)||0,br:String,physicalFactionMeters:()=>0,
    fabricMatches:(a,b)=>a===b,internalName:row=>row.name,demandView:()=>'',render(){},
    liveBalances:()=>[{id:'roll',fabric_id:'p53',lot_code:'R1',quality_status:'APROVADO',onhand:200,reserved:144}],
    orderStats:()=>({accepted:0,rejected:0})
  });
  wf.bind(host);
  assert.match(wf.view(), /Ordens de produção[\s\S]*?Camisa P53[\s\S]*?144 m/);
  const open = stage=>onClick({target:{closest:q=>q==='[data-fw-faction-stage]'?{dataset:{fwFactionStage:stage}}:null}});
  open('cut');
  assert.match(wf.view(),/Quantidade a cortar neste lote[\s\S]*?Máx. com reserva: 120/);
  open('sewing');
  assert.match(wf.view(),/Lotes recebidos do corte[\s\S]*?corte-01[\s\S]*?80/);
});

test('Costura libera corte concluído para entregar e mostra previsão na linha', async () => {
  const {createFactionWorkflow} = await import('../fabric-faction-workflow-v1.mjs');
  const state = {
    orders:[{id:'os',status:'ABERTA',order_number:2}],
    items:[{id:'item',order_id:'os',product_name:'Camisa P53',ordered_pieces:80,consumption_m_per_piece:1}],
    cuts:[{id:'corte-01',order_item_id:'item',produced_pieces:80}],
    cutPlans:[{id:'corte-01',cut_id:'corte-01',order_item_id:'item',sewing_due_set:true,sewing_due_on:'2026-11-20'}],
    returns:[{cut_batch_id:'corte-01',order_item_id:'item',accepted_pieces:20,rejected_pieces:0}],
    fabric:[],lots:[],moves:[],purchaseItems:[],purchaseOrders:[],deliveryDocuments:[]
  };
  let selectStage;
  const page={querySelector:()=>null,querySelectorAll:()=>[],addEventListener:(_type,handler)=>{selectStage=handler;}};
  const wf=createFactionWorkflow({
    state,esc:value=>String(value??''),n:value=>Number(value)||0,br:String,liveBalances:()=>[],
    orderStats:()=>({accepted:20,rejected:0}),demandView:()=>'',render(){}
  });
  wf.bind({querySelector:q=>q==='.fw-faction-page'?page:null});
  selectStage({target:{closest:()=>({dataset:{fwFactionStage:'sewing'}})}});
  const html=wf.view();
  assert.match(html,/Entregas registradas/);
  assert.match(html,/Entrega parcial<\/span><\/td>\s*<td>80<\/td><td>20<\/td><td>60<\/td>/);
  assert.match(html,/data-sewing-due="corte-01" value="2026-11-20"/);
  assert.match(html,/data-faction-action="group-delivery" data-faction-id="corte-01"\s*>Registrar entrega/);
  assert.doesNotMatch(html,/Aguardando envio/);
});

test('Provisão oferece lançamento manual e permite excluir somente linhas sem histórico', async () => {
  const {createFactionWorkflow}=await import('../fabric-faction-workflow-v1.mjs');
  const state={
    canOperateFaction:true,
    orders:[{id:'os',order_number:2,status:'ABERTA',idempotency_key:'manual:request'}],
    items:['livre','reservado'].map(id=>({id,order_id:'os',product_name:id,ordered_pieces:4,consumption_m_per_piece:1})),
    fabric:[],suppliers:[],cuts:[],returns:[],purchaseOrders:[],purchaseItems:[],
    moves:[{order_item_id:'reservado',reserved_delta_m:4}]
  };
  const wf=createFactionWorkflow({state,esc:String,n:value=>Number(value)||0,br:String,liveBalances:()=>[],
    orderStats:()=>({accepted:0,rejected:0}),demandView:()=>''});
  assert.match(wf.view(),/Adicionar produto/);
  assert.match(wf.view(),/Lançado manualmente/);
  assert.match(wf.view(),/data-faction-action="remove-item" data-faction-id="livre"/);
  assert.doesNotMatch(wf.view(),/data-faction-action="remove-item" data-faction-id="reservado"/);
});
