const n = value => {
  const num = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(num) ? num : 0;
};

const pick = (row, ...keys) => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return 0;
};

const hasValue = (row, ...keys) => keys.some(key =>
  row[key] !== undefined &&
  row[key] !== null &&
  String(row[key]).trim() !== ''
);

export const normalizeItemKey = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const compactDimensionKey = value => normalizeItemKey(value)
  .replace(/(\d)\s+(\d{2})\s+X\s+(\d)\s+(\d{2})/g, '$1$2X$3$4')
  .replace(/\s*X\s*/g, 'X')
  .trim();

const withoutMlKey = value => compactDimensionKey(value).replace(/\bML\b/g, '').replace(/\s+/g, ' ').trim();

const addMapQty = (map, key, quantity) => {
  if (!key || !quantity) return;
  map[key] = (map[key] || 0) + quantity;
};

const TOLERANCIA_EXCEDENTE_CIRCULACAO = 30;

// Fallback operacional: garante que a facção não volte a zero quando o
// navegador tiver uma base antiga salva ou a planilha online estiver indisponível.


export function buildFactionMap(rows) {
  const map = {};
  (rows || []).forEach(row => {
    const status = String(pick(row, 'Status', 'status', 'STATUS', 'Situação', 'Situacao', 'Status da produção', 'Status da producao') || '')
      .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^A-Z0-9]+/gi, '').toUpperCase();
    if (['CONCLUIDO', 'FINALIZADO', 'ENTREGUE', 'PRODUZIDO', 'ENCERRADO', 'CANCELADO'].includes(status)) return;
    const product = pick(row, 'PRODUTO', 'produto', 'produto_nome', 'Produto', 'Item');
    const quantity = n(pick(row, 'QUANTIDADE', 'quantidade', 'Quantidade', 'QUANTIDADE DE', 'Quantidade de', 'ENTREGA', 'entrega'));
    const key = normalizeItemKey(product);
    const compact = compactDimensionKey(product);
    const noMl = withoutMlKey(product);
    addMapQty(map, key, quantity);
    if (compact !== key) addMapQty(map, compact, quantity);
    if (noMl !== key && noMl !== compact) addMapQty(map, noMl, quantity);
  });
  return map;
}

export function factionQuantityFor(row, map = {}) {
  const keys = [
    normalizeItemKey(row.produtoNome),
    compactDimensionKey(row.produtoNome),
    withoutMlKey(row.produtoNome)
  ].filter(Boolean);
  const key = keys.find(candidate => map[candidate] !== undefined && n(map[candidate]) > 0);
  if (key) return n(map[key]);
  return 0;
}

export function applyFactionToRows(rows, map = {}) {
  return (rows || []).map(row => {
    const pecasFaccao = Math.max(n(row.pecasFaccao), factionQuantityFor(row, map));
    return {
      ...row,
      emProducao: pecasFaccao,
      pecasFaccao,
      pedidoReal: Math.max(0, n(row.compraSugerida) - pecasFaccao)
    };
  });
}

export function summarizeOrderByCategory(rows) {
  const map = new Map();
  (rows || []).filter(isReplacementOrderItem).forEach(row => {
    const key = row.categoriaOficial || 'Sem categoria';
    const item = map.get(key) || { categoria: key, itens: 0, necessidade: 0, faccao: 0, pedidoReal: 0 };
    item.itens += 1;
    item.necessidade += Math.max(0, n(row.compraSugerida));
    item.faccao += Math.max(0, n(row.pecasFaccao));
    item.pedidoReal += Math.max(0, n(row.pedidoReal));
    map.set(key, item);
  });
  return [...map.values()].sort((a, b) => b.pedidoReal - a.pedidoReal || a.categoria.localeCompare(b.categoria, 'pt-BR'));
}

export function isReplacementOrderItem(row) {
  return n(row?.pedidoReal) > 0;
}

export function listDecisionItems(rows) {
  return sortOrderItems((rows || [])
    .map(row => ({
      produtoId: row.produtoId,
      produtoNome: row.produtoNome || row.produtoId || '',
      categoria: row.categoriaOficial || 'Sem categoria',
      subcategoria: row.subcategoriaTroca || '',
      criticidade: row.criticidade || '',
      cliente: Math.max(0, n(row.estoqueCliente)),
      areaCritica: Math.max(0, n(row.areaCritica)),
      mercado: Math.max(0, n(row.mercado)),
      estoqueGao: Math.max(0, n(row.estoqueGao ?? row.deposito)),
      relave: Math.max(0, n(row.relave)),
      qualidade: Math.max(0, n(row.qualidade)),
      desengoma: Math.max(0, n(row.desengoma)),
      costura: Math.max(0, n(row.costura)),
      processo: Math.max(0, n(row.estoqueProcesso)),
      descarte: Math.max(0, n(row.costura)),
      bloqueado: Math.max(0, n(row.estoqueBloqueado)),
      totalUtil: Math.max(0, n(row.estoqueUtil)),
      trocasClienteArea: n(row.trocasClienteArea),
      trocasMercado: n(row.trocasMercado),
      trocasGao: n(row.trocasDeposito),
      trocasTotal: n(row.trocasTotais),
      trocasIdeal: n(row.trocaReferencia ?? row.trocasIdeais),
      idealInformado: n(row.trocasIdeais) > 0,
      necessidade: Math.max(0, n(row.compraSugerida)),
      faccao: Math.max(0, n(row.pecasFaccao)),
      pedidoReal: Math.max(0, n(row.pedidoReal)),
      indicacao: row.condutaDimensionamento || ''
    })), 'pedido');
}

export function listOrderItems(rows) {
  return listDecisionItems((rows || []).filter(isReplacementOrderItem));
}

export function listMovementItems(rows) {
  return (rows || [])
    .flatMap(row => {
      const items = [];
      if (n(row.movimentoDepositoMercado) > 0) {
        items.push({
          produtoId: row.produtoId,
          produtoNome: row.produtoNome || row.produtoId || '',
          categoria: row.categoriaOficial || 'Sem categoria',
          subcategoria: row.subcategoriaTroca || '',
          acao: 'Estoque GAO para mercado',
          direcao: 'supply',
          quantidade: n(row.movimentoDepositoMercado),
          origem: 'Estoque GAO',
          destino: 'Mercado',
          mercadoAtual: n(row.mercado),
          deposito: n(row.estoqueGao ?? row.deposito),
          indicacao: row.sugestaoMovimento || ''
        });
      }
      if (n(row.retiradaMercadoDeposito) > 0) {
        items.push({
          produtoId: row.produtoId,
          produtoNome: row.produtoNome || row.produtoId || '',
          categoria: row.categoriaOficial || 'Sem categoria',
          subcategoria: row.subcategoriaTroca || '',
          acao: 'Mercado para estoque GAO',
          direcao: 'return',
          quantidade: n(row.retiradaMercadoDeposito),
          origem: 'Mercado',
          destino: 'Estoque GAO',
          mercadoAtual: n(row.mercado),
          deposito: n(row.estoqueGao ?? row.deposito),
          indicacao: row.sugestaoMovimento || ''
        });
      }
      return items.map(item => ({ ...item,
        estoqueCirculacao: n(row.estoqueCirculacao),
        metaCirculacao: n(row.metaCirculacao),
        trocasCirculacao: n(row.trocasCirculacao),
        trocasIdeal: n(row.trocaReferencia),
        mediaDiaria: n(row.mediaDiaria),
        excedenteCirculacao: n(row.excedenteCirculacao)
      }));
    })
    .map(item => {
      const delta = item.direcao === 'supply' ? item.quantidade : -item.quantidade;
      const mercadoApos = item.mercadoAtual + delta;
      const circulacaoApos = item.estoqueCirculacao + delta;
      return { ...item, mercadoApos, depositoApos: item.deposito - delta,
        circulacaoApos, trocasCirculacaoApos: item.mediaDiaria > 0 ? circulacaoApos / item.mediaDiaria : 0,
        faltaCirculacao: Math.max(0, item.metaCirculacao - circulacaoApos),
        necessidadeMovimento: item.direcao === 'supply' ? Math.max(0, item.metaCirculacao - item.estoqueCirculacao) : 0,
        saldoPendente: item.direcao === 'supply'
          ? Math.max(0, item.metaCirculacao - item.estoqueCirculacao - item.quantidade)
          : 0 };
    })
    .sort((a, b) => {
      const rank = { 'Estoque GAO para mercado': 1, 'Mercado para estoque GAO': 2 };
      return (rank[a.acao] || 9) - (rank[b.acao] || 9) ||
        b.quantidade - a.quantidade ||
        String(a.produtoNome).localeCompare(String(b.produtoNome), 'pt-BR');
    });
}

function movementRecommendation({ media, mercado, deposito, estoqueCirculacao, trocaReferencia }) {
  const apuravel = n(media) > 0 && n(trocaReferencia) > 0;
  const metaCirculacao = apuravel ? Math.ceil(n(media) * n(trocaReferencia)) : 0;
  const excedenteCirculacao = apuravel ? Math.max(0, estoqueCirculacao - metaCirculacao) : 0;
  const retiradaMercadoDeposito = Math.min(Math.max(0, Math.floor(n(mercado))),
    Math.max(0, Math.floor(excedenteCirculacao - TOLERANCIA_EXCEDENTE_CIRCULACAO)));
  const deficitCirculacao = apuravel ? Math.max(0, Math.ceil(metaCirculacao - estoqueCirculacao)) : 0;
  const movimentoDepositoMercado = Math.min(deficitCirculacao, Math.max(0, Math.floor(n(deposito))));
  let sugestaoMovimento = 'Sem movimentação sugerida';
  if (!apuravel) {
    sugestaoMovimento = 'Não apurado: consumo médio ou referência de trocas indisponível';
  } else if (retiradaMercadoDeposito > 0) {
    sugestaoMovimento = `Retirar ${retiradaMercadoDeposito} pç do mercado para estoque GAO`;
  } else if (excedenteCirculacao > TOLERANCIA_EXCEDENTE_CIRCULACAO) {
    sugestaoMovimento = 'Excedente em circulação, sem saldo no mercado para retirada';
  } else if (excedenteCirculacao > 0) {
    sugestaoMovimento = 'Manter excedente de até 30 pç em circulação';
  } else if (movimentoDepositoMercado > 0) {
    sugestaoMovimento = `Mover ${movimentoDepositoMercado} pç do estoque GAO para mercado`;
  } else if (deficitCirculacao > 0) {
    sugestaoMovimento = 'Circulação abaixo do ideal e estoque GAO sem saldo para envio';
  }
  return {
    estoqueCirculacao,
    trocasCirculacao: apuravel ? estoqueCirculacao / n(media) : 0,
    metaCirculacao,
    excedenteCirculacao,
    retiradaMercadoDeposito,
    deficitCirculacao,
    movimentoDepositoMercado,
    sugestaoMovimento
  };
}

// Recalcula uma linha normalizada quando o gestor ajusta a troca ideal na tela.
// O estoque informado permanece intacto; somente as metas e decisões derivadas mudam.
export function updateIdealReference(row, value) {
  const ideal = Math.max(0, n(value));
  const media = n(row.mediaDiaria);
  const metaCirculacao = media > 0 && ideal > 0 ? Math.ceil(media * ideal) : 0;
  const compraPorIdeal = media > 0 && ideal > 0 ? Math.max(0, metaCirculacao - n(row.estoqueUtil)) : 0;
  const compraSugerida = compraPorIdeal;
  const pedidoReal = Math.max(0, compraSugerida - n(row.pecasFaccao));
  const movimentacao = movementRecommendation({
    media,
    mercado: n(row.mercado),
    deposito: n(row.deposito),
    estoqueCirculacao: n(row.estoqueCirculacao),
    trocaReferencia: ideal
  });
  return {
    ...row,
    trocasIdeais: ideal,
    trocaReferencia: ideal,
    idealInformado: true,
    compraPorIdeal,
    compraSugerida,
    pedidoReal,
    ...movimentacao
  };
}

export function sortOrderItems(rows, sortBy = 'pedido') {
  const list = [...(rows || [])];
  const byText = key => (a, b) => String(a[key] || '').localeCompare(String(b[key] || ''), 'pt-BR') || (b.pedidoReal - a.pedidoReal);
  if (sortBy === 'produto') return list.sort(byText('produtoNome'));
  if (sortBy === 'categoria') return list.sort(byText('categoria'));
  if (sortBy === 'subcategoria') return list.sort(byText('subcategoria'));
  if (sortBy === 'necessidade') return list.sort((a, b) => b.necessidade - a.necessidade || String(a.produtoNome).localeCompare(String(b.produtoNome), 'pt-BR'));
  if (sortBy === 'faccao') return list.sort((a, b) => b.faccao - a.faccao || String(a.produtoNome).localeCompare(String(b.produtoNome), 'pt-BR'));
  if (sortBy === 'criticidade') {
    const rank = { vermelho: 1, amarelo: 2, verde: 3 };
    return list.sort((a, b) => (rank[a.criticidade] || 9) - (rank[b.criticidade] || 9) || (b.pedidoReal - a.pedidoReal));
  }
  return list.sort((a, b) => b.pedidoReal - a.pedidoReal || String(a.produtoNome).localeCompare(String(b.produtoNome), 'pt-BR'));
}

function splitDelimitedLine(line, delimiter) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }
  cells.push(value.trim());
  return cells;
}

export function parseDelimitedRows(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const sample = lines[0];
  const delimiter = [';', '\t', ','].sort((a, b) => sample.split(b).length - sample.split(a).length)[0];
  const headers = splitDelimitedLine(lines[0], delimiter).map(header => header.trim());
  return lines.slice(1).map(line => {
    const cells = splitDelimitedLine(line, delimiter);
    return headers.reduce((row, header, index) => {
      row[header] = cells[index] ?? '';
      return row;
    }, {});
  });
}

export function classifyRisk(trocasTotais) {
  const t = n(trocasTotais);
  if (t <= 6) return 'vermelho';
  if (Math.floor(t) === 7) return 'amarelo';
  return 'verde';
}

export function classificationFor(row) {
  const parts = classificationPartsFor(row);
  return `${parts.categoriaOficial} ${parts.subcategoriaTroca.toLowerCase()}`;
}

export function classificationPartsFor(row) {
  const categoria = String(row.categoria || '').toUpperCase();
  const ideal = n(pick(row, 'Trocas Ideais', 'trocas_ideais'));
  if (categoria.includes('CIRURG')) return { categoriaOficial: 'Cirúrgico', subcategoriaTroca: 'Crítico' };
  if (categoria.includes('HOT')) return { categoriaOficial: 'Hotelaria', subcategoriaTroca: ideal >= 8 ? 'Alto giro' : 'Normal' };
  if (categoria.includes('PACIENTE')) return { categoriaOficial: 'Paciente', subcategoriaTroca: ideal >= 9 ? 'Crítico' : 'Normal' };
  if (categoria.includes('PROFISSIONAL')) return { categoriaOficial: 'Profissional', subcategoriaTroca: ideal >= 9 ? 'Crítico' : 'Normal' };
  return { categoriaOficial: 'Outros', subcategoriaTroca: ideal >= 9 ? 'Alto giro' : 'Normal' };
}

function exchangeReference(row, informedIdeal) {
  const ideal = n(informedIdeal);
  if (ideal > 0) return ideal;
  const categoria = String(row.categoria || '').toUpperCase();
  if (categoria.includes('CIRURG')) return 10;
  if (categoria.includes('PROFISSIONAL') || categoria.includes('PACIENTE')) return 9;
  return 8;
}

export function recommendAction({ trocasTotais, trocasDeposito, estoqueBloqueado }) {
  const total = n(trocasTotais);
  const deposito = n(trocasDeposito);
  const bloqueado = n(estoqueBloqueado);
  if (total <= 6) return 'Comprar emergencial';
  if (Math.floor(total) === 7) return 'Compra preventiva';
  if (bloqueado > 0) return 'Avaliar costura';
  if (deposito < 0.5) return 'Comprar emergencial';
  if (deposito < 1) return 'Compra preventiva';
  return 'Acompanhar';
}

function dimensioningAction({ criticidade, trocasDeposito, trocasMercado, estoqueBloqueado, compraSugerida }) {
  if (criticidade === 'vermelho') return 'Comprar emergencial';
  if (n(trocasDeposito) < 1) return 'Repor estoque GAO';
  if (n(compraSugerida) > 0) return 'Comprar para completar ideal';
  if (criticidade === 'amarelo') return 'Compra preventiva';
  if (n(trocasMercado) < 1.5) return 'Repor mercado';
  if (n(estoqueBloqueado) > 0) return 'Avaliar costura';
  return 'Acompanhar';
}

function criticalPoint({ trocasClienteArea, trocasMercado, trocasDeposito, estoqueBloqueado, criticidade }) {
  if (criticidade === 'vermelho') return 'Troca total';
  if (n(trocasDeposito) < 1) return 'Estoque GAO';
  if (n(trocasMercado) < 1.5) return 'Mercado';
  if (n(trocasClienteArea) < 5) return 'Cliente / área crítica';
  if (n(estoqueBloqueado) > 0) return 'Costura / avaliação';
  return 'Dentro da régua';
}

export function normalizeRow(row) {
  const media = n(pick(row, 'media_diaria', 'Média diária'));
  const estoqueCliente = n(pick(row, 'estoque_cliente'));
  const areaCritica = n(pick(row, 'area_critica'));
  const mercado = n(pick(row, 'mercado'));
  // "Estoque GAO" na planilha tratada e subtotal dos outros pontos, nao deposito.
  const estoqueGao = n(pick(row, 'depósito_gao', 'dep√≥sito_gao', 'deposito_gao', 'estoque_gao'));
  const deposito = estoqueGao;
  const relave = n(pick(row, 'relave_geral', 'relave'));
  const qualidade = n(pick(row, 'qualidade'));
  const desengoma = n(pick(row, 'desengoma_gao', 'desengoma'));
  const costura = n(pick(row, 'costura'));
  const estoqueProcesso = relave + qualidade + desengoma;
  const estoqueBloqueado = costura;
  const estoqueUtil = Math.max(0, estoqueCliente + areaCritica + mercado + deposito + estoqueProcesso);
  const trocasCalculadas = media ? estoqueUtil / media : 0;
  const trocasClienteCalculada = media ? estoqueCliente / media : 0;
  const trocasAreaCritica = media ? areaCritica / media : 0;
  const trocasClienteArea = media ? (estoqueCliente + areaCritica) / media : 0;
  const trocasMercado = media ? mercado / media : 0;
  const trocasDeposito = media ? deposito / media : 0;
  const trocasIdeais = n(pick(row, 'Trocas Ideais'));
  const trocaReferencia = exchangeReference(row, trocasIdeais);
  const trocasTotaisInformadas = n(pick(row, 'Trocas Totais', 'trocas_totais'));
  const trocasTotaisBase = media ? trocasCalculadas : trocasTotaisInformadas;
  const trocasTotais = trocasTotaisBase;
  const pedidoFinal = n(pick(row, 'Pedido Final'));
  const necessidadeCompra = n(pick(row, 'Necessidade compra'));
  const compraPorIdeal = media && trocaReferencia ? Math.max(0, Math.ceil((trocaReferencia * media) - estoqueUtil)) : 0;
  const compraTratada = hasValue(row, 'Pedido Final')
    ? pedidoFinal
    : (hasValue(row, 'Necessidade compra') ? necessidadeCompra : null);
  const compraSugerida = media && trocaReferencia ? compraPorIdeal : Math.max(0, compraTratada || 0);
  const pecasFaccao = n(pick(row, 'Facção', 'Faccao', 'Em Facção', 'Em Faccao', 'Em Produção', 'Em Producao', 'pecas_faccao', 'em_faccao', 'em_producao'));
  const pedidoReal = Math.max(0, compraSugerida - pecasFaccao);
  const criticidade = classifyRisk(trocasTotais);
  const estoqueCirculacao = Math.max(0, estoqueCliente + areaCritica + mercado + estoqueProcesso);
  const movimentacao = movementRecommendation({ media, mercado, deposito, estoqueCirculacao, trocaReferencia });
  const pontoCritico = criticalPoint({ trocasClienteArea, trocasMercado, trocasDeposito, estoqueBloqueado, criticidade });
  const condutaDimensionamento = dimensioningAction({ criticidade, trocasDeposito, trocasMercado, estoqueBloqueado, compraSugerida });
  const sazonalidadeAreaCritica = trocasClienteCalculada < 5 && trocasClienteArea >= 5;
  const classificacaoTroca = classificationFor(row);
  const classificacaoPartes = classificationPartsFor(row);
  return {
    categoria: row.categoria || '',
    produtoId: pick(row, 'produto_id'),
    produtoNome: row.produto_nome || '',
    fornecedor: row.Fornecedor || '',
    cor: row.Cor || '',
    mediaDiaria: media,
    estoqueCliente,
    areaCritica,
    mercado,
    deposito,
    estoqueGao,
    relave,
    qualidade,
    desengoma,
    costura,
    estoqueTotal: n(pick(row, 'Estoque Total')),
    trocasCliente: n(pick(row, 'Trocas Cliente')),
    trocasClienteCalculada,
    trocasAreaCritica,
    trocasClienteArea,
    trocasMercado,
    trocasTotais,
    trocasIdeais,
    trocaReferencia,
    pedidoFinal,
    ...movimentacao,
    compraPorIdeal,
    compraSugerida,
    emProducao: pecasFaccao,
    pecasFaccao,
    pedidoReal,
    estoqueProcesso,
    estoqueBloqueado,
    trocasDeposito,
    estoqueUtil,
    categoriaOficial: classificacaoPartes.categoriaOficial,
    subcategoriaTroca: classificacaoPartes.subcategoriaTroca,
    classificacaoTroca,
    criticidade,
    pontoCritico,
    condutaDimensionamento,
    sazonalidadeAreaCritica,
    leituraOperacional: sazonalidadeAreaCritica ? 'Cliente oscila com área crítica' : 'Leitura estável',
    acaoRecomendada: recommendAction({ trocasTotais, trocasDeposito, estoqueBloqueado })
  };
}

export function summarizeRows(rows) {
  const normalized = rows.map(normalizeRow).filter(row => row.mediaDiaria > 0);
  return {
    rows: normalized,
    totalItens: normalized.length,
    criticos: normalized.filter(row => row.criticidade === 'vermelho').length,
    atencao: normalized.filter(row => row.criticidade === 'amarelo').length,
    seguros: normalized.filter(row => row.criticidade === 'verde').length,
    compraEmergencial: normalized.filter(row => row.acaoRecomendada === 'Comprar emergencial').length,
    compraPreventiva: normalized.filter(row => row.acaoRecomendada === 'Compra preventiva').length,
    pedidoFinal: normalized.reduce((sum, row) => sum + Math.max(0, row.pedidoFinal), 0)
  };
}

export function summarizeDimensioning(rows) {
  const normalized = rows.map(row => row.mediaDiaria !== undefined ? row : normalizeRow(row)).filter(row => row.mediaDiaria > 0);
  const classMap = new Map();
  normalized.forEach(row => {
    const key = row.classificacaoTroca || 'Sem classificação';
    const item = classMap.get(key) || {
      area: key,
      total: 0,
      criticos: 0,
      atencao: 0,
      depositoBaixo: 0,
      mercadoBaixo: 0,
      compraSugerida: 0,
      pecasFaccao: 0,
      pedidoReal: 0,
      trocaClienteArea: 0,
      trocaMercado: 0,
      trocaDeposito: 0
    };
    item.total += 1;
    item.criticos += row.criticidade === 'vermelho' ? 1 : 0;
    item.atencao += row.criticidade === 'amarelo' ? 1 : 0;
    item.depositoBaixo += row.pontoCritico === 'Estoque GAO' ? 1 : 0;
    item.mercadoBaixo += row.pontoCritico === 'Mercado' ? 1 : 0;
    item.compraSugerida += Math.max(0, row.compraSugerida);
    item.pecasFaccao += Math.max(0, row.pecasFaccao);
    item.pedidoReal += Math.max(0, row.pedidoReal);
    item.trocaClienteArea += row.trocasClienteArea;
    item.trocaMercado += row.trocasMercado;
    item.trocaDeposito += row.trocasDeposito;
    classMap.set(key, item);
  });
  const classRows = [...classMap.values()].map(item => ({
    ...item,
    trocaClienteArea: item.total ? item.trocaClienteArea / item.total : 0,
    trocaMercado: item.total ? item.trocaMercado / item.total : 0,
    trocaDeposito: item.total ? item.trocaDeposito / item.total : 0
  })).sort((a, b) => (b.criticos - a.criticos) || (b.depositoBaixo - a.depositoBaixo) || (b.compraSugerida - a.compraSugerida));

  const criticalItems = normalized
    .filter(row => row.criticidade !== 'verde' || row.pontoCritico !== 'Dentro da régua' || row.compraSugerida > 0)
    .sort((a, b) => {
      const rank = { vermelho: 3, amarelo: 2, verde: 1 };
      return (rank[b.criticidade] - rank[a.criticidade]) ||
        (b.compraSugerida - a.compraSugerida) ||
        (a.trocasDeposito - b.trocasDeposito);
    });

  return {
    rows: normalized,
    classRows,
    criticalItems,
    totals: {
      totalItens: normalized.length,
      criticos: normalized.filter(row => row.criticidade === 'vermelho').length,
      atencao: normalized.filter(row => row.criticidade === 'amarelo').length,
      depositoBaixo: normalized.filter(row => row.pontoCritico === 'Estoque GAO').length,
      mercadoBaixo: normalized.filter(row => row.pontoCritico === 'Mercado').length,
      compraSugerida: normalized.reduce((sum, row) => sum + Math.max(0, row.compraSugerida), 0),
      pecasFaccao: normalized.reduce((sum, row) => sum + Math.max(0, row.pecasFaccao), 0),
      pedidoReal: normalized.reduce((sum, row) => sum + Math.max(0, row.pedidoReal), 0)
    }
  };
}
