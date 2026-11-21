import {parseLinenNumber,normalizeImportedLinenRows} from './linen-number-v1.mjs?v=2';
import {normalizeRow} from './linen-risk-rules-v150.mjs?v=229';

const columns = [
  ['Média diária','media_diaria',['media_diaria','Média diária']],
  ['Cliente','estoque_cliente',['estoque_cliente']],
  ['Área crítica','area_critica',['area_critica']],
  ['Mercado','mercado',['mercado']],
  ['Estoque GAO','deposito_gao',['depósito_gao','dep√≥sito_gao','deposito_gao','estoque_gao']],
  ['Relave','relave_geral',['relave_geral','relave']],
  ['Qualidade','qualidade',['qualidade']],
  ['Desengoma','desengoma_gao',['desengoma_gao','desengoma']],
  ['Costura','costura',['costura']]
];

export function prepareWeeklyStock(rows) {
  if (!Array.isArray(rows) || !rows.length) throw Error('A planilha está vazia.');
  rows=normalizeImportedLinenRows(rows);
  const result=[], seen=new Set();
  for (const [index,row] of rows.entries()) {
    const line=index+2;
    if (!row || !Object.values(row).some(value=>String(value??'').trim())) continue;
    const id=String(row.produto_id??'').trim(), name=String(row.produto_nome??'').trim();
    if (!id || id==='0' || !name) throw Error(`Informe o código e o nome da peça na linha ${line}.`);
    if (seen.has(id)) throw Error(`Código de peça duplicado na linha ${line}: ${id}.`);
    const normalized={...row,produto_id:id,produto_nome:name};
    for (const [label,key,aliases] of columns) {
      const field=aliases.find(alias=>Object.hasOwn(row,alias));
      const raw=String(row[field]??'').trim();
      const value=parseLinenNumber(raw);
      if (!raw || !Number.isFinite(value) || value<0 || (key!=='media_diaria'&&!Number.isInteger(value))) {
        throw Error(`Confira ${label} na linha ${line}. Informe zero quando não houver saldo.`);
      }
      for (const alias of aliases) delete normalized[alias];
      normalized[key]=value;
    }
    seen.add(id);
    result.push(normalizeRow(normalized));
  }
  if (!result.length) throw Error('A planilha está vazia.');
  return result;
}
