const sheets = [
  { name: 'Tecidos', key: 'ID da variante', description: 'Descrição', fields: ['Código GAO','Largura (m)','Correspondência histórica','Situação do cadastro'] },
  { name: 'Peças', key: 'ID da peça', description: 'Peça / descrição original', fields: ['Código Sankhya','Tamanho / medida','ID tecido sugerido','Consumo m/peça','Linha da origem'] },
  { name: 'Histórico pedidos', key: 'Linha origem', description: 'Descrição original', fields: ['Data pedido','Consumo m/peça','Quantidade pedida','Tecido original'] },
  { name: 'Referências custos', key: 'Linha origem', description: 'Produto', fields: ['Consumo m/peça','Tecido R$/m','Facção R$/peça'] }
];

function parseSheet(xlsx, workbook, spec) {
  const sheet = workbook.Sheets[spec.name];
  if (!sheet) throw Error('Aba obrigatória ausente: '+spec.name);
  const range = xlsx.utils.decode_range(sheet['!ref'] || 'A1');
  if (range.e.r > 5000 || range.e.c > 100) throw Error('Aba acima do limite de importação: '+spec.name);
  const cells = xlsx.utils.sheet_to_json(sheet, {header:1, range:0, defval:null, raw:true, blankrows:true});
  const headings = (cells[4] || []).map(value=>String(value??'').trim());
  for (const header of [spec.key,spec.description,...spec.fields]) {
    if (!headings.includes(header)) throw Error('Coluna ausente na aba '+spec.name+': '+header);
  }
  return cells.slice(5).flatMap((values,index)=>{
    const id=String(values[headings.indexOf(spec.key)]??'').trim();
    if(!id) return [];
    const row=Object.fromEntries(headings.flatMap((heading,i)=>heading?[[heading,values[i]??null]]:[]));
    return [{sheet:spec.name, line:index+6, id, data:row, issues:[]}];
  });
}

export function readFabricWorkbook(xlsx, bytes) {
  const workbook=xlsx.read(bytes,{type:'array',cellDates:true});
  const rows=sheets.flatMap(spec=>parseSheet(xlsx,workbook,spec));
  const known=new Set(rows.filter(row=>row.sheet==='Tecidos').map(row=>row.id));
  const keys=new Set();
  for(const row of rows){
    const spec=sheets.find(sheet=>sheet.name===row.sheet);
    const d=row.data, id=row.sheet+'|'+row.id;
    if(keys.has(id))throw Error('Identificador repetido na aba '+row.sheet+': '+row.id);
    keys.add(id);
    if(typeof d[spec.description]!=='string'||!d[spec.description].trim())row.issues.push('Descrição ausente ou inválida');
    if(row.sheet==='Tecidos'){
      if(typeof d['Largura (m)']!=='number'||d['Largura (m)']<=0)row.issues.push('Largura a confirmar');
      if(row.id.startsWith('LEG-')||d['Correspondência histórica'])row.issues.push('Conferir correspondência com cadastro GAO');
    }
    if(row.sheet==='Peças'){
      const material=d['ID tecido sugerido'];
      if(!material||!known.has(String(material))||String(material).startsWith('LEG-'))row.issues.push('Vínculo com variante pendente');
      if(typeof d['Consumo m/peça']!=='number'||d['Consumo m/peça']<=0)row.issues.push('Consumo linear a confirmar');
      if(!d['Código Sankhya'])row.issues.push('Código Sankhya a confirmar');
    }
  }
  if(!rows.length)throw Error('Nenhuma referência encontrada.');
  return rows;
}

const esc = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fmt(record,key){
  const value=record.data[key];
  const date=value instanceof Date ? value : typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)?new Date(value):null;
  return date ? date.toLocaleDateString('pt-BR',{timeZone:'UTC'}) : value;
}
export function createFabricWorkbookImport({rpc,getOrganization}){
  let selected=null;
  let version=0;
  const view=()=>`<section class="fw-panel"><h3>Importação da planilha GAO</h3>
    <p>Confira tecidos, fichas e referências históricas. A importação registra uma versão para conferência, sem movimentar estoque ou aprovar preços.</p>
    <form data-fw-workbook-import><label class="fw-field">Planilha de controle<input type="file" accept=".xlsx" required></label>
    <button type="submit">Gerar prévia</button></form><p data-fw-import-status role="status"></p>
    <div data-fw-import-preview></div><button type="button" data-fw-import-archive>Consultar importações</button><div data-fw-import-batches></div></section>`;
  function bind(host){
    const form=host.querySelector('[data-fw-workbook-import]');
    if(!form)return;
    const status=host.querySelector('[data-fw-import-status]'), preview=host.querySelector('[data-fw-import-preview]');
    const organization=getOrganization();
    const request=(file,rows,commit)=>rpc('fabric_workbook_import',{p_organization_id:organization,p_filename:file,p_rows:rows,p_commit:commit});
    const renderPreview=()=>{
      if(!selected||selected.organization!==organization)return;
      const {file,rows,result}=selected;
      preview.innerHTML=`<h4>${esc(file)}</h4><p>${rows.length} referências · ${rows.filter(row=>row.issues.length).length} com pendências</p>
      <p>${result.new_rows} novas · ${result.existing_rows} existentes · ${result.conflicting_rows} conflitantes com a versão anterior</p>
      ${sheets.map(spec=>{
        const records=rows.filter(r=>r.sheet===spec.name);
        return `<details><summary>${esc(spec.name)} · ${records.length}</summary><div style="overflow:auto"><table><thead><tr><th>Linha</th><th>Identificador</th><th>Descrição</th>${spec.fields.map(f=>`<th>${esc(f)}</th>`).join('')}<th>Conferência</th></tr></thead><tbody>${records.map(r=>`<tr><td>${r.line}</td><td>${esc(r.id)}</td><td>${esc(fmt(r,spec.description))}</td>${spec.fields.map(f=>`<td>${esc(fmt(r,f)??'—')}</td>`).join('')}<td>${esc(r.issues.join(' · ')||'Referência')}</td></tr>`).join('')}</tbody></table></div></details>`;
      }).join('')}
      <button type="button" data-fw-import-commit ${result.batch_id?'disabled':''}>Registrar referências</button>`;
      preview.querySelector('[data-fw-import-commit]').onclick=async event=>{
        const button=event.currentTarget, snapshot=selected;
        button.disabled=true;
        try{
          const saved=await request(snapshot.file,snapshot.rows,true);
          if(selected!==snapshot)return;
          selected={...snapshot,result:saved};renderPreview();status.textContent='Importação registrada para conferência.';
        }catch(error){status.textContent=error.message;button.disabled=false}
      };
    };
    form.onsubmit=async event=>{
      event.preventDefault();
      const operation=++version;
      const file=form.querySelector('input').files[0];
      if(!file)return;
      selected=null;preview.replaceChildren();status.textContent='Validando a planilha…';
      try{
        if(!window.XLSX||file.size>5*1024*1024)throw Error('Use uma planilha .xlsx de até 5 MB e recarregue o portal se o leitor estiver indisponível.');
        const rows=readFabricWorkbook(window.XLSX,await file.arrayBuffer());
        const result=await request(file.name,rows,false);
        if(operation!==version)return;
        selected={organization,file:file.name,rows,result};renderPreview();status.textContent='Prévia pronta para conferência.';
      }catch(error){if(operation===version)status.textContent=error.message}
    };
    host.querySelector('[data-fw-import-archive]').onclick=async()=>{
      const batches=host.querySelector('[data-fw-import-batches]');
      try{
        const result=await rpc('fabric_workbook_import_history',{p_organization_id:organization});
        batches.innerHTML=result.length?'<ul>'+result.map(batch=>`<li><button type="button" data-batch-id="${esc(batch.id)}">${esc(batch.filename)}</button> · ${batch.row_count} referências · ${new Date(batch.created_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}</li>`).join('')+'</ul>':'<p>Nenhuma importação registrada.</p>';
        batches.querySelectorAll('[data-batch-id]').forEach(button=>button.onclick=async()=>{
          const operation=++version;
          try{
            const id=button.dataset.batchId;
            const {filename,rows}=await rpc('fabric_workbook_import_detail',{p_organization_id:organization,p_batch_id:id});
            if(operation!==version)return;
            selected={organization,file:filename,rows,result:{batch_id:id,new_rows:0,existing_rows:rows.length,conflicting_rows:0}};
            renderPreview();status.textContent='Versão registrada em consulta.';
          }catch(error){if(operation===version)status.textContent=error.message}
        });
      }catch(error){status.textContent=error.message}
    };
    renderPreview();
  }
  return {view,bind};
}
