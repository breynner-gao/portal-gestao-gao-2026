import {readDanfe,validInvoiceKey} from './linen-danfe-import-v1.mjs?v=1';
import {applyIdealReferences, idealReferenceKey, listMovementItems} from './linen-risk-rules-v150.mjs?v=230';
import {directionLabel, filterTransferHistory, localTimestamp, transferWorkbook} from './linen-operations-history-v1.mjs?v=2';

import {views,newFilters,movementRows,invoiceFromXml} from './linen-management-views-v1.mjs?v=5';
import {productivityView, productivityRecords, shiftDate} from './linen-productivity-v1.mjs?v=1';
import {workflowView,bindEvaluationProductPickers} from './linen-management-workflow-v1.mjs?v=5';

const HOST='gao-linen-operations';
const SB='https://fquzuxdqvhecijjuxbmg.supabase.co';
const API='sb_publishable_icrk6TaZexgiSIq63zX_ng_40JGaYlJ';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const qty=value=>Number(value).toLocaleString('pt-BR');
const stockQty=value=>Math.max(0,Math.floor(Number(value)||0));
const nativeHost='gao-linen-management';
const tabFromUrl=()=>new URL(location.href).searchParams.get('tela');

function mount(host) {
  const native=host.id===nativeHost;
  let page=views.some(([key])=>key===tabFromUrl())?tabFromUrl():'painel';
  let session, organization, canWrite=false, canManage=false, canSew=false;
  let snapshot, proposals=[], requests=[], events=[], balances=[], weeklyStock=new Map(), workflow={}, draft, invoiceRead=0;
  const choices=new Map(), outstanding=new Map(), workflowIds=new Map();
  let loading=true, saving=false, message='', failed=false, sewingOnly=false;
  let filters=newFilters();
  let reportDate=localTimestamp(new Date()).slice(0,10);

  async function api(path, body, prefer) {
    const response=await fetch(SB+path,{
      method:body?'POST':'GET', cache:'no-store',
      headers:{apikey:API,Authorization:'Bearer '+(window.GAO_AUTH_SESSION||session)?.access_token,'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},
      ...(body?{body:JSON.stringify(body)}:{})
    });
    const data=await response.json().catch(()=>null);
    if(!response.ok)throw Error(data?.message||'Não foi possível consultar o SGQ.');
    return data;
  }

  async function all(table, params) {
    const rows=[], limit=500;
    for(let offset=0;;offset+=limit){
      const batch=await api('/rest/v1/'+table+'?'+new URLSearchParams({...params,limit,offset}));
      rows.push(...batch);
      if(batch.length<limit)return rows;
    }
  }

  async function load({refreshOnly=false}={}) {
    loading=!refreshOnly; failed=false;
    if(!refreshOnly)render();
    try{
      session=await window.GAO_AUTH_READY;
      session=window.GAO_AUTH_SESSION||session;
      if(!session?.user?.id)throw Error('Entre no SGQ para consultar Gestão de Enxoval.');
      const memberships=await api('/rest/v1/memberships?select=id,organization_id,role_name,organizations!inner(kind,active)&active=eq.true&profile_id=eq.'+encodeURIComponent(session.user.id));
      const member=memberships.find(m=>m.organizations?.kind==='gao'&&m.organizations.active);
      if(!member)throw Error('Seu usuário não tem vínculo ativo com a GAO.');
      organization=member.organization_id;
      const permissions=new Set((await api('/rest/v1/member_permissions?select=permission_code&allowed=eq.true&membership_id=eq.'+member.id)).map(row=>row.permission_code));
      const canView=permissions.has('textiles.inventory.view')||member.role_name==='Administrador Geral';
      sewingOnly=!canView&&native&&page==='costura'&&['production.sewing.execute','production.sewing.view'].some(code=>permissions.has(code));
      if(!canView&&!sewingOnly)throw Error('Seu perfil não tem acesso ao estoque de enxoval.');
      canManage=permissions.has('textiles.inventory.manage')||member.role_name==='Administrador Geral';
      canWrite=canManage||permissions.has('textiles.production.manage');
      canSew=canWrite||permissions.has('production.sewing.execute');
      const org='eq.'+organization;
      if(sewingOnly){await loadWorkflow(org);return;}
      const [snapshots,ideals,saved,history,stock]=await Promise.all([
        api('/rest/v1/linen_rfid_snapshots?select=rows,as_of,informed_at,updated_at&organization_id='+org+'&limit=1'),
        all('linen_ideal_references',{select:'product_key,ideal',organization_id:org,order:'product_key'}),
        all('linen_transfer_requests',{select:'*',organization_id:org,order:'created_at.desc,id.desc'}),
        all('linen_transfer_events',{select:'*,request:linen_transfer_requests!inner(product_code,product_key,product_name,direction,organization_id)', 'request.organization_id':org,order:'occurred_at.desc,id.desc'}),
        all('linen_eligible_stock',{organization_id:org,order:'snapshot_version.desc,product_key'}),
      ]);
      snapshot=snapshots[0];
      requests=saved;
      balances=stock;
      events=history;
      weeklyStock=new Map((snapshot?.rows||[]).filter(row=>String(row.produtoId??'').trim()!=='0').map(row=>[
        idealReferenceKey(row),{depot:stockQty(row.estoqueGao??row.deposito),market:stockQty(row.mercado)}
      ]).filter(([key])=>key.startsWith('ID:')));
      const source=applyIdealReferences(snapshot?.rows||[],new Map(ideals.map(row=>[row.product_key,Number(row.ideal)])));
      proposals=listMovementItems(source).map(row=>({
        product_key:idealReferenceKey(row), product_code:row.produtoId, product_name:row.produtoNome,
        direction:row.direcao, planned:row.quantidade, gross:row.direcao==='supply'?row.deposito:row.mercadoAtual
      }));
      if(native && (page==='painel'||!['supply','return','pendencias'].includes(page)))await loadWorkflow(org);
    }catch(error){failed=true;message=error.message;}
    finally{loading=false;render();}
  }

  async function loadWorkflow(org) {
    const sources={
      painel:['items'],recepcao:['products','invoices'],ficha:['products','specs'],
      quarentena:['items','specs'],rfid:['items','tags'],chip:['items','products','tags'],
      costura:['items'],retorno:['items','tags'],descarte:['items'],
      cliente:['products','clients','client_orders'],compras:['purchases','client_orders'],
      configuracoes:['settings','audit'],produtividade:['activityLog','targets']
    };
    const definitions={
      products:['laundry_products',{select:'id,code,name,category',active:'eq.true',order:'name,id'}],
      clients:['laundry_clients',{select:'id,name',active:'eq.true',order:'name,id'}],
      invoices:['linen_management_invoices',{select:'id,access_key,invoice_number,supplier,created_at',order:'created_at.desc,id'}],
      items:['linen_management_items',{select:'*,product:laundry_products(name,code)',order:'created_at.desc,id'}],
      specs:['linen_management_specs',{select:'*,product:laundry_products(name,code)',order:'version.desc,id'}],
      tags:['linen_management_tags',{select:'*,item:linen_management_items(product:laundry_products(name,code))',order:'created_at.desc,id'}],
      settings:['linen_management_settings',{}],
      client_orders:['linen_management_client_orders',{select:'*,client:laundry_clients(name),product:laundry_products(name,code)',order:'created_at.desc,id'}],
      purchases:['linen_ready_orders',{select:'id,product_name,order_number,ordered_pieces,received_pieces,status',order:'created_at.desc,id'}],
      audit:['linen_management_audit',{select:'id,action,record_id,created_at,responsible',order:'created_at.desc,id'}],
      activityLog:['linen_management_audit',{select:'id,action,created_at,responsible,quantity:details->>quantity,lines:details->lines',
        and:'(created_at.gte.'+shiftDate(reportDate,-29)+',created_at.lt.'+shiftDate(reportDate,2)+')',order:'created_at.desc,id'}],
      targets:['linen_productivity_targets',{select:'activity,effective_on,target',order:'activity,effective_on.desc'}]
    };
    const entries=await Promise.all((sources[page]||[]).map(async name=>{
      const [table,params]=definitions[name];
      return [name,await all(table,['products','clients'].includes(name)?params:{...params,organization_id:org})];
    }));
    workflow=Object.fromEntries(entries);
  }

  function transferKey(row){return row.id||row.direction+'|'+row.product_key;}
  function inputId(data){
    const key=JSON.stringify(data);
    if(!outstanding.has(key))outstanding.set(key,crypto.randomUUID());
    return outstanding.get(key);
  }
  async function saveChoices(rows){
    if(saving||!canWrite||!snapshot||!rows.length)return;
    let payload;
    try{
      payload=rows.map(row=>{
        const entry=choices.get(transferKey(row));
        const amount=entry?.decision==='yes'?Number(entry.quantity):0;
        if(entry?.decision==='yes'&&row.eligible===null)throw Error('Produto ausente da posição semanal. Atualize a lista.');
        if(!Number.isSafeInteger(amount)||amount<0||(entry?.decision==='yes'&&(amount===0||amount>Math.min(row.remaining,row.eligible??0))))
          throw Error('Confira a quantidade de '+row.product_name+'.');
        const data={requestId:row.id||null,productKey:row.product_key,direction:row.direction,quantity:amount,expectedRemaining:row.remaining};
        return {...data,eventId:inputId(data)};
      });
    }catch(error){message=error.message;render();revealSaveMessage();return;}
    saving=true;message='';render();
    let saveFailed=false;
    try{
      await api('/rest/v1/rpc/linen_confirm_transfers',{p_org:organization,p_version:snapshot.updated_at,p_choices:payload});
      for(const {eventId,...data} of payload)outstanding.delete(JSON.stringify(data));
      for(const row of rows)choices.delete(transferKey(row));
      const pending=payload.filter(choice=>choice.quantity===0).length;
      message=pending===payload.length?'Pendência registrada sem movimentar estoque.':
        pending?'Movimentações e pendências salvas.':'Movimentação salva.';
      await load({refreshOnly:true});
    }catch(error){message=error.message;saveFailed=true;}
    finally{saving=false;render();if(saveFailed||failed)revealSaveMessage();}
  }

  function revealSaveMessage(){
    host.querySelector('[role=status]')?.scrollIntoView({block:'center'});
  }

  function table(rows){
    if(!rows.length)return '<p>Nenhum produto neste recorte.</p>';
    return '<div class="leo-scroll"><table><thead><tr><th>Produto</th><th>Solicitação e sentido</th><th>Previsto</th><th>Saldo na origem</th><th>Movimentado</th><th>Restante</th><th>Confirmação</th></tr></thead><tbody>'+
      rows.map((row,i)=>{
        const edit=canWrite&&row.remaining>0&&((row.id)||row.product_key.startsWith('ID:'));
        const draft=choices.get(transferKey(row));
        const limit=Math.min(row.remaining,row.eligible??row.remaining);
        const missingStock=row.eligible===null;
        const decision=draft?.decision||'';
        const status=row.remaining?(row.lastUnmoved?'Pendente · Não movimentado':row.id?'Pendente':'Em aberto'):'Concluído';
        return '<tr><td><strong>'+esc(row.product_name)+'</strong><small>'+esc(row.product_code||'')+'</small></td><td>'+directionLabel(row.direction)+'<small>'+esc(row.id||'Sugestão da posição semanal')+'</small></td><td>'+qty(row.planned)+'</td><td>'+(row.eligible===null?'Sem posição':qty(row.eligible))+'</td><td>'+qty(row.done)+'</td><td>'+qty(row.remaining)+'</td><td><small>'+status+'</small>'+
          (edit?'<div class="leo-confirm"><select data-leo-decision="'+i+'" aria-label="Movimentou '+esc(row.product_name)+'" '+(saving?'disabled':'')+'><option value="">Movimentou?</option><option value="yes" '+(decision==='yes'?'selected ':'')+'>Sim</option><option value="no" '+(decision==='no'?'selected':'')+'>Não</option></select>'+(decision==='yes'?'<input data-leo-quantity="'+i+'" aria-label="Quantidade movimentada de '+esc(row.product_name)+'" placeholder="Peças movidas" type="number" min="1" max="'+limit+'" step="1" value="'+esc(draft?.quantity||'')+'" '+(saving||missingStock||!limit?'disabled':'')+'>':'')+'<button type="button" data-leo-save="'+i+'" '+(!decision||saving||(decision==='yes'&&(missingStock||!limit))?'disabled':'')+'>'+ (decision==='no'?'Registrar pendência':decision==='yes'?'Confirmar quantidade':'Confirmar')+'</button></div>':'')+
          (edit&&row.eligible===0?'<small>Sem saldo registrado na origem.</small>':'')+
          (edit&&decision==='no'?'<small>0 peças movimentadas. O restante fica pendente.</small>':'')+
          (row.id?'<button type="button" data-leo-history="'+i+'">Ver histórico</button>':'')+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  }

  function history() {
    const products=new Map([...requests.map(row=>[row.product_key,row.product_name]),...events.map(e=>[e.request.product_key,e.request.product_name])]);
    const people=new Map(events.map(e=>[e.responsible_id,e.responsible]));
    const options=(items,selected)=>'<option value="">Todos</option>'+[...items].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR')).map(([value,label])=>'<option value="'+esc(value)+'" '+(value===selected?'selected':'')+'>'+esc(label)+'</option>').join('');
    let shown=[],error='';
    try{shown=filterTransferHistory(events,filters);}catch(reason){error=reason.message;}
    const selectors='<label>Produto<select name="product">'+options(products,filters.product)+'</select></label><label>Sentido<select name="direction">'+options(new Map([['return',directionLabel('return')],['supply',directionLabel('supply')]]),filters.direction)+'</select></label><label>De<input name="start" type="date" value="'+esc(filters.start)+'"></label><label>Até<input name="end" type="date" value="'+esc(filters.end)+'"></label><label>Responsável<select name="responsible">'+options(people,filters.responsible)+'</select></label>';
    const records=shown.length?'<div class="leo-scroll leo-history"><table><thead><tr><th>Data e hora</th><th>Produto</th><th>Sentido</th><th>Quantidade</th><th>Responsável</th><th>Saldo restante</th><th>Referência</th></tr></thead><tbody>'+shown.map(event=>'<tr><td>'+esc(localTimestamp(event.occurred_at))+'</td><td>'+esc(event.request.product_name)+'</td><td>'+directionLabel(event.request.direction)+'</td><td>'+(Number(event.quantity)===0?'0 · Não movimentado':qty(event.quantity))+'</td><td>'+esc(event.responsible)+'</td><td>'+qty(event.remaining)+'</td><td>'+esc(event.id)+'</td></tr>').join('')+'</tbody></table></div>':'<p>'+(error?esc(error):'Nenhum registro de movimentação confirmado neste recorte.')+'</p>';
    return {shown,labels:{product:products.get(filters.product),responsible:people.get(filters.responsible)},html:'<section class="gao-card"><h2>Histórico de movimentações</h2><form data-leo-filters>'+selectors+'<button type="submit">Filtrar</button><button type="button" data-leo-clear>Limpar filtros</button><button type="button" data-leo-export '+(!shown.length?'disabled':'')+'>Exportar Excel</button></form>'+records+'</section>'};
  }

  function go(target){
    if(saving||loading)return;
    page=target; message='';workflow={};
    if(native){
      const url=new URL(location.href);
      if(page==='painel')url.searchParams.delete('tela');else url.searchParams.set('tela',page);
      historyReplace(url);
    }
    return load();
  }

  function historyReplace(url){window.history.replaceState(window.history.state,'',url);}

  async function workflowSubmit(action,data){
    if(saving)return;
    const key=action+'|'+JSON.stringify(data);
    if(!workflowIds.has(key))workflowIds.set(key,crypto.randomUUID());
    saving=true;message='';
    host.querySelectorAll('button').forEach(button=>{if(!button.disabled){button.disabled=true;button.dataset.leoBusy='1';}});
    try{
      const rpc=action==='invoice'&&data.pdf?'linen_receive_danfe':['inspect_piece','edit_piece','archive_piece'].includes(action)?'linen_piece_review':'linen_management_action';
      await api('/rest/v1/rpc/'+rpc,{p_org:organization,p_event:workflowIds.get(key),p_action:action,p_data:data});
      workflowIds.delete(key);
      if(action==='invoice')draft=undefined;
      message=action==='archive_piece'?'Cadastro cancelado. O histórico foi preservado.':'Registro salvo no SGQ.';await load();
    }catch(error){
      message=error.message;host.querySelector('[role=status]').textContent=message;
      host.querySelectorAll('[data-leo-busy]').forEach(button=>{button.disabled=false;delete button.dataset.leoBusy;});
      return;
    }finally{saving=false;}
    render();
  }

  function render(){
    if(!host.isConnected)return;
    let rows=[],content='',report;
    if(loading)content='<p role="status">Carregando registros do SGQ…</p>';
    else if(!failed){
      const allRows=movementRows(proposals,requests,events,balances,snapshot?.updated_at,weeklyStock);
      if(native&&page==='painel'){
        const groups=[['return','Mercado para Depósito',allRows.filter(x=>x.direction==='return'&&x.remaining).reduce((a,b)=>a+b.remaining,0)],
          ['supply','Depósito para Mercado',allRows.filter(x=>x.direction==='supply'&&x.remaining).reduce((a,b)=>a+b.remaining,0)],
          ['pendencias','Solicitações pendentes',allRows.filter(x=>x.id&&x.remaining).length],
          ['quarentena','Peças em quarentena',(workflow.items||[]).filter(x=>['quarantine','rejected'].includes(x.status)).reduce((a,b)=>a+b.quantity,0)]];
        content='<div class="leo-kpis">'+groups.map(([key,label,total])=>'<button type="button" data-leo-view="'+key+'"><span>'+label+'</span><strong>'+qty(total)+'</strong></button>').join('')+'</div>'+
          '<section class="leo-card"><h2>Fluxo da operação</h2><div class="leo-flow">'+views.filter(([key])=>!['painel','configuracoes'].includes(key)).map(([key,label])=>'<button type="button" data-leo-view="'+key+'">'+label+'</button>').join('')+'</div></section>';
      }else if(!native||['return','supply','pendencias'].includes(page)){
        rows=allRows.filter(row=>!native?row.remaining>0:page==='pendencias'?row.id&&row.remaining>0:row.direction===page);
        const chosen=rows.filter(row=>choices.get(transferKey(row))?.decision);
        content='<section class="leo-card"><p>Selecione Sim e informe as peças movimentadas. Se nenhuma peça foi movimentada, selecione Não e registre a pendência.</p>'+
          '<button type="button" data-leo-list '+(!chosen.length||saving?'disabled':'')+'>Salvar lista</button>'+table(rows)+'</section>';
        if(!native||page==='pendencias'){report=history();content+=report.html;}
      }else if(page==='produtividade'){
        content=productivityView({records:productivityRecords(events,workflow.activityLog||[]),targets:workflow.targets||[],
          date:reportDate,today:localTimestamp(new Date()).slice(0,10),canManage,saving});
      }else if(page==='configuracoes'){
        report=history();content=workflowView(page,workflow,{canManage,canSew,saving,draft})+report.html;
      }else content=workflowView(page,workflow,{canManage,canSew,saving,draft});
    }
    const headerControls=(saving||loading?'disabled':'');
    const availableViews=views.filter(([key])=>!sewingOnly||key==='costura');
    const heading=native?'<header class="leo-head"><div><div class="gao-eyebrow">PRODUÇÃO</div><h1>Gestão de Enxoval</h1><p>Posição semanal '+esc(sewingOnly?'· fila de recuperação':snapshot?.informed_at||snapshot?.as_of||'a publicar')+'</p></div>'+
      '<div class="leo-head-actions"><label>Tela<select data-leo-view-select '+headerControls+'>'+availableViews.map(([key,label])=>'<option value="'+key+'" '+(key===page?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
      '<button type="button" data-leo-refresh '+headerControls+'>Atualizar</button></div></header>'+
      '<div class="leo-main"><h2>'+views.find(([key])=>key===page)[1]+'</h2>':'';
    host.innerHTML=heading+'<p role="status">'+esc(message)+'</p>'+content+(native?'</div>':'');
    host.querySelectorAll('[data-leo-view]').forEach(button=>button.onclick=()=>go(button.dataset.leoView));
    const viewSelect=host.querySelector('[data-leo-view-select]');
    if(viewSelect)viewSelect.onchange=async()=>{
      await go(viewSelect.value);
      host.querySelector('[data-leo-view-select]')?.focus({preventScroll:true});
    };
    host.querySelector('[data-leo-refresh]')?.addEventListener('click',()=>{message='';void load();});
    host.querySelector('[data-leo-report-date]')?.addEventListener('submit',event=>{
      event.preventDefault();
      if(saving)return;
      reportDate=new FormData(event.currentTarget).get('date');
      message='';void load();
    });
    host.querySelector('[data-leo-target]')?.addEventListener('submit',async event=>{
      event.preventDefault();
      if(saving||!canManage)return;
      const form=event.currentTarget;
      const values=new FormData(form);
      const controls=[form.querySelector('button'),viewSelect,host.querySelector('[data-leo-refresh]')].filter(Boolean);
      saving=true;controls.forEach(control=>{control.disabled=true;});
      try{
        await api('/rest/v1/linen_productivity_targets?on_conflict=organization_id,activity,effective_on',{
          organization_id:organization,activity:values.get('activity'),
          effective_on:values.get('effective'),target:Number(values.get('target'))
        },'resolution=merge-duplicates,return=minimal');
        message='Meta diária salva.';
        saving=false;await load();
      }catch(error){
        message=error.message;host.querySelector('[role=status]').textContent=message;
        controls.forEach(control=>{control.disabled=false;});
      }finally{saving=false;}
    });
    host.querySelectorAll('[data-leo-decision]').forEach(select=>select.onchange=()=>{
      const row=rows[Number(select.dataset.leoDecision)];
      const key=transferKey(row);
      const index=select.dataset.leoDecision;
      choices.set(key,{quantity:choices.get(key)?.quantity||'',decision:select.value});
      render();
      if(select.value==='yes')host.querySelector('[data-leo-quantity="'+index+'"]')?.focus({preventScroll:true});
    });
    host.querySelectorAll('[data-leo-quantity]').forEach(input=>input.oninput=()=>{
      const row=rows[Number(input.dataset.leoQuantity)];
      choices.get(transferKey(row)).quantity=input.value;
    });
    host.querySelectorAll('[data-leo-save]').forEach(button=>button.onclick=()=>saveChoices([rows[Number(button.dataset.leoSave)]]));
    host.querySelector('[data-leo-list]')?.addEventListener('click',()=>saveChoices(rows.filter(row=>choices.get(transferKey(row))?.decision)));
    host.querySelectorAll('[data-leo-history]').forEach(button=>button.onclick=()=>{
      filters={...newFilters(),product:rows[Number(button.dataset.leoHistory)].product_key};
      if(native&&page!=='pendencias'){page='pendencias';const url=new URL(location.href);url.searchParams.set('tela',page);historyReplace(url);}
      render();host.querySelector('[data-leo-filters]')?.scrollIntoView({block:'start'});
    });
    host.querySelector('[data-leo-filters]')?.addEventListener('submit',event=>{
      event.preventDefault();filters=Object.fromEntries(new FormData(event.currentTarget));render();
    });
    host.querySelector('[data-leo-clear]')?.addEventListener('click',()=>{filters=newFilters();render();});
    host.querySelector('[data-leo-export]')?.addEventListener('click',()=>{
      try{
        if(!window.XLSX)throw Error('O gerador de Excel ainda não está disponível.');
        const file=transferWorkbook(window.XLSX,report.shown,filters,report.labels);
        window.XLSX.writeFile(file,'historico-movimentacoes-enxoval.xlsx');
      }catch(error){message=error.message;render();}
    });
    host.querySelector('[data-leo-invoice-file]')?.addEventListener('change',async event=>{
      const file=event.target.files[0];
      if(!file||saving)return;
      const read=++invoiceRead;
      const pdf=/\.pdf$/i.test(file.name)||file.type==='application/pdf';
      draft=undefined;
      message=pdf?'Lendo DANFE. A leitura de um PDF digitalizado pode levar alguns instantes…':'Lendo XML…';
      render();
      try{
        let parsed;
        if(pdf)parsed=await readDanfe(file);
        else{
          if(file.size>2000000)throw Error('Selecione um XML de até 2 MB.');
          const xml=await file.text();
          parsed={...invoiceFromXml(xml),xml};
        }
        if(read!==invoiceRead||page!=='recepcao')return;
        draft=parsed;
        message=pdf&&(!draft.items.length||draft.incomplete)?'Complete os dados a partir do DANFE antes de salvar.':'';
      }catch(error){
        if(read!==invoiceRead||page!=='recepcao')return;
        message=error.message;
      }
      render();
    });
    const danfeItems=host.querySelector('[data-leo-danfe-items]');
    host.querySelector('[data-leo-add-danfe]')?.addEventListener('click',()=>{
      if(!saving&&danfeItems.children.length<500){
        danfeItems.append(host.querySelector('[data-leo-danfe-template]').content.cloneNode(true));
      }
    });
    danfeItems?.addEventListener('click',event=>{
      const remove=event.target.closest('[data-leo-remove-danfe]');
      if(remove&&!saving&&danfeItems.children.length>1)remove.closest('fieldset').remove();
    });
    if(page==='chip')bindEvaluationProductPickers(host,workflow.products||[]);
    host.querySelectorAll('[data-leo-workflow]').forEach(form=>{
      form.onsubmit=event=>{
        event.preventDefault();
        const data=Object.fromEntries(new FormData(form));
        const action=form.dataset.leoWorkflow;
        if(action==='invoice'){
          if(draft?.pdf){
            const key=data.key.replace(/\s/g,'');
            if(!validInvoiceKey(key)||!data.supplier.trim()){
              host.querySelector('[role=status]').textContent='Confira a chave de acesso de 44 dígitos e o fornecedor.';
              return;
            }
            const lines=[...danfeItems.children].map((row,index)=>({
              line:index+1,description:row.querySelector('[name=description]').value.trim(),
              amount:row.querySelector('[name=amount]').value,
              product:row.querySelector('[name=product]').value,
              quantity:row.querySelector('[name=quantity]').value
            }));
            void workflowSubmit(action,{key,number:String(Number(key.slice(25,34))),supplier:data.supplier.trim(),pdf:draft.pdf,lines});
            return;
          }
          const {key,number,issuer,xml,items}=draft;
          void workflowSubmit(action,{key,number,supplier:issuer,xml,lines:items.map(({line})=>({line,
            product:data['product-'+line],quantity:data['quantity-'+line]}))});
        }else void workflowSubmit(action,data);
      };
    });
    host.querySelectorAll('[data-leo-measure]').forEach(form=>form.oninput=()=>{
      const fields=new FormData(form);
      const [width,length,weight]=['width','length','weight'].map(key=>Number(fields.get(key)));
      form.querySelector('output').value=width>0&&length>0&&weight>0?new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1}).format(weight*10000/(width*length))+' g/m²':'';
    });
  }
  void load();
}

let currentHost;
function connect(){
  const host=document.getElementById(nativeHost)||document.getElementById(HOST);
  if(!host||host===currentHost)return;
  currentHost=host;
  const details=host.closest('details');
  if(!details||details.open)mount(host);
  else details.addEventListener('toggle',function start(){
    if(!details.open)return;
    details.removeEventListener('toggle',start);mount(host);
  });
}
connect();
new MutationObserver(connect).observe(document.getElementById('root'),{childList:true,subtree:true});
