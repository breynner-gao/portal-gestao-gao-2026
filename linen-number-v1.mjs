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
const numericHeaders=new Set(['ESTOQUE IDEAL','MEDIA DIARIA','ESTOQUE CLIENTE','AREA CRITICA','MERCADO','DEPOSITO GAO','ESTOQUE GAO','RELAVE GERAL','RELAVE','QUALIDADE','DESENGOMA GAO','DESENGOMA','COSTURA','ESTOQUE TOTAL','TROCAS CLIENTE','TROCAS AREA CRITICA','TROCAS MERCADO','TROCAS GAO','TROCAS TOTAIS','TROCAS IDEAIS','PEDIDO FINAL','NECESSIDADE COMPRA','FACCAO','EM FACCAO','EM PRODUCAO','PECAS FACCAO','QUANTIDADE']);
export function normalizeLinenHeader(header){
 let text=String(header).trim();
 // UTF-8 decoded as Latin-1, observed in the RFID export: depÃ³sito_gao.
 for(let pass=0;pass<2&&/[ÃÂ]/.test(text);pass++){
  if([...text].some(c=>c.charCodeAt(0)>255))break;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from([...text],c=>c.charCodeAt(0)));}catch{break;}
 }
 const plain=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('_',' ').replace(/\s+/g,' ').trim().toUpperCase();
 return plain==='DEPOSITO GAO'||text==='dep√≥sito_gao'?'deposito_gao':text;
}
const key=header=>String(header).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replaceAll('_',' ').replace(/\s+/g,' ').trim().toUpperCase();
export function normalizeImportedLinenRows(rows){return rows.map(row=>{
 const result={};
 for(const [original,value] of Object.entries(row)){
  const header=normalizeLinenHeader(original);
  const number=numericHeaders.has(key(header))?parseLinenNumber(value):NaN;
  const normalized=Number.isFinite(number)?number:value;
  if(Object.hasOwn(result,header)&&String(result[header])!==String(normalized))throw Error('Duas colunas de '+header+' possuem valores diferentes. Confira o cabeçalho da planilha.');
  result[header]=normalized;
 }
 return result;
});}
export function formatLinenCsvValue(value){if(typeof value!=='number'||!Number.isFinite(value))return String(value??'');return value.toLocaleString('pt-BR',{useGrouping:false,minimumFractionDigits:Number.isInteger(value)?0:2,maximumFractionDigits:20});}
