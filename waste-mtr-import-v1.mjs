const pdfPackage='https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/';
const pdfBase=pdfPackage+'legacy/build/';
const normalized=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const datePattern='(\\d{2})/(\\d{2})/(\\d{4})';

function readDate(text,label){
  const match=text.match(new RegExp(label+'\\s*:?\\s*'+datePattern));
  if(!match) return null;
  const [,day,month,year]=match;
  const iso=year+'-'+month+'-'+day;
  const parsed=new Date(iso+'T12:00:00Z');
  return Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===iso?iso:null;
}
function linesFromItems(items){
  const rows=[];
  const sorted=items.filter(item=>item.str?.trim()).sort((a,b)=>b.transform[5]-a.transform[5]);
  for(const item of sorted){
    const [,,,,x,y]=item.transform;
    const previous=rows.at(-1);
    if(previous&&Math.abs(previous.y-y)<2) previous.cells.push({x,text:item.str.trim()});
    else rows.push({y,cells:[{x,text:item.str.trim()}]});
  }
  return rows.map(row=>row.cells.sort((a,b)=>a.x-b.x).map(cell=>cell.text).join(' '));
}
function sumManifestWeight(pages){
  let total=0,count=0;
  for(const lines of pages){
    const start=lines.findIndex(line=>/\bQTDE\b.*\bUNIDADE\b|\bQUANTIDADE\b.*\bUNIDADE\b/.test(normalized(line)));
    if(start<0) continue;
    for(const raw of lines.slice(start+1)){
      const line=normalized(raw);
      if(/OBSERVACAO DO RECEBIMENTO|OBSERVACOES GERAIS|ESTE MTR NAO SUBSTITUI/.test(line)) break;
      const match=line.match(/(?:^|\s)(\d[\d.]*,\d+|\d+)\s+(QUILOGRAMAS?|KG|TONELADAS?|T)\b/);
      if(!match) continue;
      const value=Number(match[1].replaceAll('.','').replace(',','.'));
      if(!Number.isFinite(value)) continue;
      total+=value*(match[2]==='T'||match[2].startsWith('TONELADA')?1000:1);
      count++;
    }
  }
  return count?Math.round(total*1e6)/1e6:null;
}
export function parseMtrPages(pages){
  const lines=pages[0]??[],text=normalized(lines.join('\n'));
  const protocol=text.match(/\bMTR\s*(?:N[º°O.]?\s*)?[:#-]?\s*(\d{6,20})\b/)?.[1];
  if(!protocol||!text.includes('MANIFESTO DE TRANSPORTE DE RESIDUOS')) return null;
  const section=text.split(/IDENTIFICACAO DO TRANSPORTADOR/)[1]?.split(/IDENTIFICACAO DO DESTINADOR/)[0]??'';
  const company=section.match(/RAZAO SOCIAL\s*:\s*(INDCOM|BIOREVERSE)\b/)?.[1];
  const responsibleIndex=lines.findIndex(line=>/NOME DO RESPONSAVEL PELA EMISSAO/.test(normalized(line)));
  const candidates=responsibleIndex<0?[]:lines.slice(responsibleIndex+1,responsibleIndex+4);
  const responsible=candidates.filter(line=>!/ASSINATURA|IDENTIFICACAO/.test(normalized(line))).map(line=>line.match(/^([\p{L}][\p{L} .'-]*?)\s+(?:Gerente|Diretor|Supervisor|Responsável|Coordenador|Técnico|Analista)\b/iu)?.[1]).find(Boolean);
  return {
    protocol,company,
    system:/SECRETARIA DE ESTADO DE MEIO AMBIENTE E DESENVOLVIMENTO SUSTENTAVEL/.test(text)?'SEMAD':/\bSINIR\b/.test(text)?'SINIR':null,
    issueDate:readDate(text,'DATA DA EMISSAO'),
    transportDate:readDate(text,'DATA DO TRANSPORTE'),
    responsible,
    weight:sumManifestWeight(pages)
  };
}
export async function readMtr(file,pdfLibrary){
  if(file.size>40000000) throw Error('O PDF deve ter até 40 MB.');
  const pdf=pdfLibrary??await import(pdfBase+'pdf.mjs');
  if(!pdfLibrary) pdf.GlobalWorkerOptions.workerSrc=pdfBase+'pdf.worker.mjs';
  const task=pdf.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,
    standardFontDataUrl:pdfPackage+'standard_fonts/',useSystemFonts:true});
  try{
    const document=await task.promise;
    const pages=[];
    for(let number=1;number<=document.numPages;number++){
      const page=await document.getPage(number);
      pages.push(linesFromItems((await page.getTextContent()).items));
    }
    return parseMtrPages(pages);
  }finally{await task.destroy();}
}
