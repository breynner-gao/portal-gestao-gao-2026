const pdfPackage='https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/';
const ocrPackage='https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/';
const maxPdfSize=5_000_000;
const loadOcr=()=>new Promise((resolve,reject)=>{
  if(globalThis.Tesseract){resolve(globalThis.Tesseract);return;}
  const script=document.createElement('script');
  script.src=ocrPackage+'tesseract.min.js';
  script.onload=()=>resolve(globalThis.Tesseract);
  script.onerror=()=>{script.remove();reject(Error('Leitor de PDF digitalizado indisponível.'));};
  document.head.append(script);
});
let ocrLibrary;
const normalize=text=>text.normalize('NFD').replace(/\p{M}/gu,'').toUpperCase();
const decimal=text=>Number(text.replaceAll('.','').replace(',','.'));

export function validInvoiceKey(key){
  if(!/^\d{44}$/.test(key)||key.slice(20,22)!=='55')return false;
  const sum=[...key.slice(0,43)].reverse().reduce((total,digit,index)=>total+Number(digit)*(2+index%8),0);
  return Number(key[43])===(11-sum%11)%11%10;
}

export function parseDanfe(pages){
  const text=normalize(pages.join('\n'));
  const keys=[...new Set((text.match(/(?<!\d)(?:\d{44}|\d{4}(?:[ \t]+\d{4}){10})(?!\d)/g)||[])
    .map(value=>value.replace(/\s/g,'')).filter(validInvoiceKey))];
  const key=keys.length===1?keys[0]:'';
  const header=text.split(/DESTINATARIO\s*\/\s*REMETENTE/)[0];
  const issuer=header.match(/^\s*([\p{L}\d][\p{L}\d &.'/-]{2,60})\s+(?:DOCUMENTO AUXILIAR\s*\n\s*)?([\p{L}\d][\p{L}\d &.'/-]{2,60}\bLTDA)\b/mu)?.slice(1).join(' ').replace(/DOCUMENTO AUXILIAR /g,'')||
    header.match(/^\s*([\p{L}\d][\p{L}\d &.'/-]{2,90}\b(?:LTDA|S\.?A\.?|EIRELI))\b/mu)?.[1]||'';
  const items=[];
  for(const page of pages){
    const start=page.search(/itens da nota fiscal|descri[çc][aã]o do produto|dados dos produtos/i);
    if(start<0)continue;
    const table=page.slice(start).split(/(?:dados|informa[çc][oõ]es) adicionais/i)[0];
    const rows=table.split('\n');
    for(const [index,raw] of rows.entries()){
      const row=raw.replace(/[|\[\]{}()—]/g,' ').trim();
      const fiscalColumns=row.match(/\s+[\dA-Z]{7,10}\s+[^\p{L}\d]{0,4}[\dOIl]{3,4}\s+\d\.?\d{3}/iu);
      const quantity=row.match(/\b(UN[Ilj]?|UND|PC|PÇ|KG|CX|MT|M|PAR)\s*[:;./-]?\s*([\d.]+,\d{1,4})\b/iu);
      const regular=row.match(/^([\w.-]+)[ /,]+(.+?)\s+\d{3,4}\s+\d\.?\d{3}[ /]*([A-Z]{1,6})\s*([\d.]+,\d{1,4})\b/i);
      const rawDescription=fiscalColumns&&quantity&&fiscalColumns.index<quantity.index
        ?row.slice(0,fiscalColumns.index):null;
      const description=rawDescription?.match(/^([\w.-]+)[ /,]+(.+)$/);
      const parsed=description&&quantity?[description[1],description[2],quantity[1],quantity[2]]:regular?.slice(1);
      if(!parsed)continue;
      const [code,printedName,unit,amount]=parsed;
      let name=printedName.replace(/\s+[\d]{8,9}\s*[^\p{L}\d]*$/u,'').trim();
      const continuation=rows[index+1]?.match(/^\s*[|\[\]]?\s*(\d{1,3}[,.]\d{2})\s*[|\[\]]?\s*$/)?.[1];
      if(continuation&&/\bX$/i.test(name))name+=' '+continuation;
      if(decimal(amount)>0)items.push({line:items.length+1,code,name,unit,amount:decimal(amount)});
    }
  }
  return {key,number:key?String(Number(key.slice(25,34))):'',issuer,items};
}

function textLines(items){
  const rows=[];
  for(const item of items.filter(item=>item.str?.trim()).sort((a,b)=>b.transform[5]-a.transform[5])){
    const y=item.transform[5];
    if(!rows.length||Math.abs(rows.at(-1).y-y)>2)rows.push({y,items:[]});
    rows.at(-1).items.push(item);
  }
  return rows.map(row=>row.items.sort((a,b)=>a.transform[4]-b.transform[4]).map(item=>item.str.trim()).join(' ')).join('\n');
}

export async function readDanfe(file){
  if(file.size>maxPdfSize)throw Error('Selecione um PDF de até 5 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(new TextDecoder().decode(bytes.subarray(0,5))!=='%PDF-')throw Error('Selecione um arquivo PDF válido.');
  const chunks=[];
  for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
  const encoded=btoa(chunks.join(''));
  const pages=[];
  let task,worker;
  try{
    const pdfBase=pdfPackage+'legacy/build/';
    const pdf=await import(pdfBase+'pdf.mjs');
    pdf.GlobalWorkerOptions.workerSrc=pdfBase+'pdf.worker.mjs';
    task=pdf.getDocument({data:bytes,isEvalSupported:false,standardFontDataUrl:pdfPackage+'standard_fonts/'});
    const doc=await task.promise;
    if(doc.numPages>20)throw Error('O DANFE deve ter até 20 páginas.');
    for(let i=1;i<=doc.numPages;i++){
      const page=await doc.getPage(i);
      const text=textLines((await page.getTextContent()).items);
      const textResult=parseDanfe([text]);
      if(textResult.items.length&&textResult.key){pages.push(text);continue;}
      ocrLibrary??=loadOcr().catch(error=>{ocrLibrary=undefined;throw error;});
      worker??=await (await ocrLibrary).createWorker('por');
      const original=page.getViewport({scale:1});
      let bestText=text,bestResult=textResult;
      for(const [size,mode] of [[2600,'6'],[3200,'6'],[2600,'4']]){
        await worker.setParameters({tessedit_pageseg_mode:mode});
        const viewport=page.getViewport({scale:size/Math.max(original.width,original.height)});
        const canvas=document.createElement('canvas');
        canvas.width=Math.ceil(viewport.width);
        canvas.height=Math.ceil(viewport.height);
        await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
        const recognized=(await worker.recognize(canvas)).data.text;
        canvas.width=0;
        const result=parseDanfe([recognized]);
        if(result.items.length>bestResult.items.length||
          (result.items.length===bestResult.items.length&&result.key&&!bestResult.key)){
          bestText=recognized;
          bestResult=result;
        }
      }
      pages.push(bestText);
    }
  }catch{
    return {...parseDanfe(pages),pdf:encoded,incomplete:true};
  }finally{
    await Promise.allSettled([worker?.terminate(),task?.destroy()]);
  }
  return {...parseDanfe(pages),pdf:encoded};
}
