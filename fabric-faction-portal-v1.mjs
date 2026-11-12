const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const br=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3});
const date=value=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});
const labels={RECEBIMENTO:'Recebimento',PRODUCAO:'Produção',INVENTARIO:'Inventário',AJUSTE:'Solicitação de ajuste',PENDENTE:'Pendente',CONFERIDO:'Conferido',REJEITADO:'Rejeitado'};
const detailsLabels={boas:'Peças boas',refugo:'Refugos',destinado_m:'Destinado (m)',incorporado_m:'Incorporado (m)',sobra_m:'Sobra (m)',perda_m:'Perda (m)',em_processo_m:'Em processo (m)',metros:'Quantidade (m)',nota:'Observação'};
const detailList=details=>Object.entries(details||{}).filter(([,v])=>v!==null&&v!=='').map(([k,v])=>`<p><strong>${esc(detailsLabels[k]||k)}</strong> · ${esc(typeof v==='number'?br.format(v):v)}</p>`).join('');
const num=(name,label,step='0.001')=>`<label>${label}<input name="${name}" type="number" min="0" step="${step}"></label>`;
const group=(name,label,fields)=>`<fieldset data-kind="${name}" hidden disabled><legend>${label}</legend>${fields}</fieldset>`;

export async function mountFactionPortal(host,rpc){
 const rows=await rpc('fabric_faction_portal_orders',{});
 host.innerHTML=rows.length?rows.map(r=>`<section class="card"><h2>OS ${esc(r.ordem)} · ${esc(r.produto)}</h2>
 <p>${esc(r.codigo)} · ${esc(r.tecido)} · ${r.largura==null?'Largura a confirmar':br.format(r.largura)+' m de largura'}</p>
 <p><strong>${br.format(r.pecas)} peças</strong> · ${br.format(r.remetido_m)} m remetidos · ${esc(r.situacao)}</p>
 ${['CANCELADA','CONCLUIDA'].includes(r.situacao)?'':`<details><summary>Novo registro</summary><form data-faction-item="${esc(r.id)}">
  <label>Tipo<select name="kind">${Object.entries(labels).slice(0,4).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
  ${group('RECEBIMENTO','Recebimento',num('received','Tecido recebido (m)'))}
  ${group('PRODUCAO','Lote de produção',num('good','Peças boas','1')+num('scrap','Peças refugadas','1')+num('destined','Tecido destinado ao lote (m)')+num('incorporated','Incorporado nas peças (m)')+num('returned','Sobra reaproveitável (m)')+num('loss','Perda definitiva (m)')+num('inProcess','Ainda em processo (m)'))}
  ${group('INVENTARIO','Inventário',num('physical','Saldo físico (m)'))}
  <label>Observação ou justificativa<textarea name="note" maxlength="2000"></textarea></label>
  <button type="submit">Enviar à GAO</button><p role="status"></p>
 </form></details>`}
 <details><summary>Registros enviados (${r.registros.length})</summary>${r.registros.map(s=>`<article><strong>${esc(labels[s.tipo])} · ${esc(labels[s.situacao])}</strong><small> · ${date(s.data)}</small>${detailList(s.dados)}${s.parecer?`<p>Parecer GAO · ${esc(s.parecer)}</p>`:''}</article>`).join('')||'<p>Sem registros enviados.</p>'}</details>
 </section>`).join(''):'<p>Nenhuma ordem atribuída a esta conta.</p>';
 for(const form of host.querySelectorAll('[data-faction-item]')){
  let key=crypto.randomUUID();
  const sync=()=>{
   for(const fieldset of form.querySelectorAll('[data-kind]')){
    const enabled=fieldset.dataset.kind===form.elements.kind.value;
    fieldset.hidden=!enabled;fieldset.disabled=!enabled;
    for(const field of fieldset.querySelectorAll('input'))field.required=enabled;
   }
   form.elements.note.required=form.elements.kind.value==='AJUSTE';
  };
  form.elements.kind.onchange=sync;sync();
  form.onsubmit=async event=>{
   event.preventDefault();
   const status=form.querySelector('[role=status]'), button=form.querySelector('button');
   const fields=new FormData(form);
   const value=name=>fields.has(name)?Number(fields.get(name)):null;
   const kind=fields.get('kind');
   button.disabled=true;status.textContent='Enviando…';
   try{
    await rpc('fabric_faction_submit',{p_item:form.dataset.factionItem,p_key:key,p_kind:kind,p_good:value('good'),p_scrap:value('scrap'),
     p_received:value(({RECEBIMENTO:'received',PRODUCAO:'destined',INVENTARIO:'physical'})[kind]),p_incorporated:value('incorporated'),
     p_returned:value('returned'),p_loss:value('loss'),p_in_process:value('inProcess'),p_note:String(fields.get('note')).trim()});
    key=crypto.randomUUID();form.reset();sync();status.textContent='Registro enviado.';
    try{await mountFactionPortal(host,rpc)}catch{status.textContent='Registro enviado. Atualize a página para consultar.'}
   }catch(error){status.textContent=error.message}
   finally{button.disabled=false}
  };
 }
}

export function createFactionDesk({rpc,getOrganization,getItems}){
 const view=()=>`<section class="fw-panel"><h3>Vincular ordem à facção</h3><p>A conta precisa estar ativa no Portal. A facção acessa somente os itens atribuídos a ela.</p>
 <form data-faction-assignment><label class="fw-field">Item da OS<select name="item" required><option value="">Selecione</option>
 ${getItems().map(i=>`<option value="${esc(i.id)}">OS ${esc(i.number)} · ${esc(i.product_name)} · ${esc(i.product_reference)}</option>`).join('')}</select></label>
 <label class="fw-field">E-mail da facção<input name="email" type="email" required maxlength="254"></label><button>Vincular conta</button></form>
 <p><a href="/faccao.html" target="_blank" rel="noopener">Abrir portal da facção</a></p><p role="status" data-faction-status></p>
 <h3>Registros para conferência</h3><button type="button" data-faction-refresh>Consultar registros</button><div data-faction-queue></div></section>`;
 function bind(host){
  const form=host.querySelector('[data-faction-assignment]'), status=host.querySelector('[data-faction-status]');
  const queue=host.querySelector('[data-faction-queue]'), org=getOrganization();
  form.onsubmit=async e=>{
   e.preventDefault();const button=form.querySelector('button');button.disabled=true;
   try{await rpc('fabric_faction_assign',{p_org:org,p_item:form.elements.item.value,p_email:form.elements.email.value});status.textContent='Conta vinculada.';form.reset()}
   catch(error){status.textContent=error.message}finally{button.disabled=false}
  };
  const load=async()=>{
   try{
    const entries=await rpc('fabric_faction_gao_queue',{p_org:org});
    queue.innerHTML=entries.map(r=>`<details><summary>OS ${esc(r.order_number)} · ${esc(r.product_name)} · ${esc(labels[r.kind])} · ${esc(labels[r.status])}</summary>
    <p>${date(r.created_at)}</p>${detailList(r.details)}${r.status==='PENDENTE'?'<form data-faction-review="'+esc(r.id)+'"><label class="fw-field">Parecer<textarea name="note" required maxlength="2000"></textarea></label><button name="decision" value="yes">Conferir</button> <button name="decision" value="no">Rejeitar</button></form>':'<p>Parecer · '+esc(r.review_note)+'</p>'}</details>`).join('')||'<p>Sem registros.</p>';
    for(const review of queue.querySelectorAll('[data-faction-review]'))review.onsubmit=async e=>{
     e.preventDefault();
     const controls=[...review.querySelectorAll('button')];controls.forEach(button=>button.disabled=true);
     try{
      await rpc('fabric_faction_gao_review',{p_org:org,p_id:review.dataset.factionReview,p_accept:e.submitter.value==='yes',p_note:review.elements.note.value});
      await load();status.textContent='Parecer registrado.';
     }catch(error){status.textContent=error.message}finally{controls.forEach(button=>button.disabled=false)}
    };
   }catch(error){status.textContent=error.message}
  };
  host.querySelector('[data-faction-refresh]').onclick=load;
 }
 return {view,bind};
}
