export const views=[
  ['painel','Painel da operação'],
  ['return','Mercado para Depósito'],
  ['supply','Depósito para Mercado'],
  ['pendencias','Pendências'],
  ['recepcao','Recepção e nota fiscal'],
  ['ficha','Ficha técnica'],
  ['quarentena','Quarentena e qualidade'],
  ['rfid','Cadastro RFID e destino'],
  ['chip','Avaliação de peças usadas'],
  ['costura','Costura'],
  ['retorno','Retorno da costura'],
  ['descarte','Descarte'],
  ['cliente','Cliente novo e comanda'],
  ['compras','Compras e portais'],
  ['configuracoes','Configurações e histórico'],
  ['produtividade','Produtividade diária']
];

export const newFilters=()=>({product:'',direction:'',start:'',end:'',responsible:''});

export function movementRows(proposals, requests, events, balances, version) {
  const key=row=>row.direction+'|'+row.product_key;
  const moved=new Map();
  const fulfilled=new Set();
  for(const event of events){
    moved.set(event.request_id,(moved.get(event.request_id)||0)+event.quantity);
    if(event.remaining===0&&Date.parse(event.stock_version)===Date.parse(version))fulfilled.add(event.request_id);
  }
  const saved=new Map();
  for(const row of requests) {
    if(!saved.has(key(row)) && (row.planned>(moved.get(row.id)||0)||fulfilled.has(row.id)||Date.parse(row.snapshot_version)===Date.parse(version))) {
      saved.set(key(row),row);
    }
  }
  const eligible=new Map(balances.filter(row=>Date.parse(row.snapshot_version)===Date.parse(version))
    .map(row=>[row.product_key,row]));
  const merged=proposals.map(row=>({...row,...saved.get(key(row))}));
  const shown=new Set(merged.map(row=>row.id));
  merged.push(...requests.filter(row=>!shown.has(row.id)));
  return merged.map(row=>{
    const done=moved.get(row.id)||0;
    return {...row,done,remaining:row.planned-done,
      eligible:eligible.get(row.product_key)?.[row.direction==='supply'?'depot':'market']??null};
  });
}

export function invoiceFromXml(text, Parser=globalThis.DOMParser) {
  if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('O XML contém declarações incompatíveis com a NF-e.');
  const doc=new Parser().parseFromString(text,'application/xml');
  const by=(node,name)=>node?.getElementsByTagNameNS('*',name);
  const get=(node,name)=>by(node,name)?.[0]?.textContent.trim()||'';
  const invoice=by(doc,'infNFe')?.[0];
  const key=invoice?.getAttribute('Id')?.replace(/^NFe/,'');
  const issuer=by(invoice,'emit')?.[0];
  const number=get(invoice,'nNF');
  if(by(doc,'parsererror').length||!/^\d{44}$/.test(key||'')||!number||!issuer)throw Error('Selecione um XML válido de NF-e.');
  const items=[...by(invoice,'det')].map(row=>{
    const product=by(row,'prod')[0];
    return {line:Number(row.getAttribute('nItem')),code:get(product,'cProd'),name:get(product,'xProd'),
      unit:get(product,'uCom'),amount:get(product,'qCom')};
  });
  if(!items.length)throw Error('A NF-e não contém itens.');
  return {key,number,issuer:get(issuer,'xNome'),taxId:get(issuer,'CNPJ'),items};
}
