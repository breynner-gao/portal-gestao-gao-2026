// Numeric RFID fields may arrive in either decimal convention. IDs/names stay text.
export function parseLinenNumber(value){
 if(typeof value==='number')return Number.isFinite(value)?value:NaN;
 let text=String(value??'').trim().replace(/^R\$\s*/,'').replace(/[\s\u00a0\u202f]/g,'').replace(/^−/,'-');
 if(!text)return NaN;
 const exponent=text.match(/[eE][+-]?\d+$/)?.[0]||'';if(exponent)text=text.slice(0,-exponent.length);
 const dot=text.lastIndexOf('.'),comma=text.lastIndexOf(',');
 if(dot>=0&&comma>=0){
  const decimal=dot>comma?'.':',',group=decimal==='.'?',':'.',at=text.lastIndexOf(decimal),whole=text.slice(0,at),fraction=text.slice(at+1);
  const groupPattern=group==='.'?/^[+-]?\d{1,3}(?:\.\d{3})+$/:/^[+-]?\d{1,3}(?:,\d{3})+$/;
  if(!groupPattern.test(whole)||!/^\d+$/.test(fraction))return NaN;
  text=whole.split(group).join('')+'.'+fraction;
 }else{
  const marker=dot>=0?'.':comma>=0?',':null;
  if(marker){const count=text.split(marker).length-1;if(count>1){const grouped=marker==='.'?/^[+-]?\d{1,3}(?:\.\d{3})+$/:/^[+-]?\d{1,3}(?:,\d{3})+$/;if(!grouped.test(text))return NaN;text=text.split(marker).join('');}else text=text.replace(',','.');}
 }
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))return NaN;
 const parsed=Number(text+exponent);return Number.isFinite(parsed)?parsed:NaN;
}
const numericHeaders=new Set(['MEDIA DIARIA','ESTOQUE CLIENTE','AREA CRITICA','MERCADO','DEPOSITO GAO','ESTOQUE GAO','RELAVE GERAL','RELAVE','QUALIDADE','DESENGOMA GAO','DESENGOMA','COSTURA','ESTOQUE TOTAL','TROCAS CLIENTE','TROCAS AREA CRITICA','TROCAS MERCADO','TROCAS GAO','TROCAS TOTAIS','TROCAS IDEAIS','PEDIDO FINAL','NECESSIDADE COMPRA','FACCAO','EM FACCAO','EM PRODUCAO','PECAS FACCAO','QUANTIDADE']);
const key=header=>String(header).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('_',' ').replace(/\s+/g,' ').trim().toUpperCase();
export function normalizeImportedLinenRows(rows){return rows.map(row=>Object.fromEntries(Object.entries(row).map(([header,value])=>{if(!numericHeaders.has(key(header))&&header!=='dep√≥sito_gao')return [header,value];const number=parseLinenNumber(value);return [header,Number.isFinite(number)?number:value];})));}
export function formatLinenCsvValue(value){if(typeof value!=='number'||!Number.isFinite(value))return String(value??'');return value.toLocaleString('pt-BR',{useGrouping:false,minimumFractionDigits:Number.isInteger(value)?0:2,maximumFractionDigits:20});}
