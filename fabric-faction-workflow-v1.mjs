export function createFactionWorkflow({
  state, esc, n, br, liveBalances, fabricMatches, internalName, physicalFactionMeters,
  orderStats, demandView, factionDesk, render, run, rpc, reload, uid,
  supplierOptionList, openFabricPurchaseDraft, submit, returnForm, syncOrderStatuses
}) {
  const stages = [
    ['provision', 'Provisão Facção', 'Planeje as peças, reserve tecidos e solicite os faltantes.'],
    ['cut', 'Corte', 'Confira o saldo de cada ordem e registre a quantidade deste corte.'],
    ['sewing', 'Costura', 'Acompanhe os lotes cortados, os envios e os retornos da facção.'],
  ];
  const meters = value => br(value, 3) + ' m';
  const pieces = value => br(value, 0);
  const sum = (rows, measure) => rows.reduce((total, row) => total + n(measure(row)), 0);
  const round = value => Math.round(value * 1000) / 1000;
  const date = new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo'});
  const dateLabel = value => value ? date.format(new Date(value.length === 10 ? value+'T12:00:00Z' : value)) : '—';
  let stage = 'provision';
  const selected = new Set();
  const draft = new Map();
  const button = (label, action, id, disabled = false) =>
    `<button type="button" data-faction-action="${action}" data-faction-id="${esc(id)}" ${disabled?'disabled':''}>${label}</button>`;
  const shortcut = (label, tab) => `<button type="button" data-fw-tab="${tab}">${label}</button>`;
  const table = (headers, rows, empty) => `<div class="fw-table-scroll"><table><thead><tr>${headers.map(h=>'<th scope="col">'+h+'</th>').join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}">${empty}</td></tr>`}</tbody></table></div>`;
  const panel = (title, body, controls='') => `<section class="fw-panel"><div class="fw-faction-toolbar"><h3>${title}</h3>${controls}</div>${body}</section>`;
  const section = (title, content) => `<details class="fw-panel" data-fw-detail-key="faction-${title}"><summary>${title}</summary>${content}</details>`;
  const metrics = entries => `<div class="fw-overview-grid">${entries.map(([label,value,description])=>`<article class="fw-overview-metric"><span>${label}</span><strong>${value}</strong><small>${description}</small></article>`).join('')}</div>`;

  const plans = () => state.cutPlans || [];
  const openPlans = () => plans().filter(plan=>['PLANEJADO','INICIADO'].includes(plan.status));
  const cutPlanRpc = (action,data) => rpc('fabric_faction_cut_plan',{p_org:state.org,p_action:action,p_data:data});
  const isManaged = cut => plans().some(plan=>plan.cut_id===cut.id);
  const legacyPending = (row, records) => Math.max(0,
    sum(row.cuts.filter(cut=>cut.sent_date&&!isManaged(cut)),cut=>cut.produced_pieces)-
    sum(records.filter(record=>record.order_item_id===row.item.id&&!record.cut_batch_id),record=>n(record.accepted_pieces)+n(record.rejected_pieces)));
  const deliveries = cut => state.returns.filter(record=>record.cut_batch_id===cut.id);
  const accounted = cut => sum(deliveries(cut),record=>n(record.accepted_pieces)+n(record.rejected_pieces));

  function getOrders() {
    const stock = liveBalances().filter(lot => lot.quality_status === 'APROVADO');
    const openPurchases = new Set(state.purchaseOrders.filter(row=>row.status!=='CANCELADA'&&row.logistics_stage!=='COTACAO').map(row=>row.id));
    return state.items.flatMap(item => {
      const order = state.orders.find(row => row.id === item.order_id);
      if (!order || order.status === 'CANCELADA') return [];
      const fabric = state.fabric.find(row => row.id === item.fabric_id);
      const lots = stock.filter(lot => fabricMatches(lot.fabric_id, item.fabric_id)).map(lot => ({
        ...lot,
        mine:round(sum(state.moves.filter(m=>m.lot_id===lot.id&&m.order_item_id===item.id),m=>m.reserved_delta_m)),
        committed:sum(openPlans().filter(plan=>plan.order_item_id===item.id&&plan.lot_id===lot.id),plan=>plan.reserved_m),
        free:Math.max(0,round(lot.onhand-lot.reserved))
      }));
      const cuts = state.cuts.filter(cut=>cut.order_item_id===item.id);
      const returns = orderStats(item);
      const cut = sum(cuts,batch=>batch.produced_pieces);
      const incoming = sum(state.purchaseItems.filter(p=>openPurchases.has(p.purchase_order_id)&&fabricMatches(p.fabric_id,item.fabric_id)),p=>Math.max(0,n(p.ordered_m)-n(p.received_m)));
      const cutting = sum(openPlans().filter(plan=>plan.order_item_id===item.id),plan=>plan.pieces);
      const remaining = Math.max(0,n(item.ordered_pieces)-Math.max(cut,returns.accepted+returns.rejected)-cutting);
      const reserved = round(sum(lots,lot=>lot.mine));
      const committed = round(sum(lots,lot=>lot.committed));
      const unit = n(item.consumption_m_per_piece);
      const committedByPieces=sum(openPlans().filter(plan=>plan.order_item_id===item.id),plan=>plan.reserved_m);
      const needed=round(remaining*unit+committedByPieces);
      const available = round(sum(lots,lot=>lot.free));
      const receivedByOrder = returns.accepted + returns.rejected;
      return [{item,order,fabric,lots,cuts,cut,cutting,remaining,reserved,committed,unit,needed,available,returns,receivedByOrder,
        physical:sum(lots,lot=>lot.onhand)+(fabric?physicalFactionMeters(fabric):0),
        incoming,shortage:Math.max(0,round(needed-reserved-available-incoming))}];
    });
  }
  const activeOrders = orders => orders.filter(({order})=>order.status!=='CONCLUIDA');
  const product = row => `<strong>${esc(row.item.product_name)}</strong><small>OS ${esc(row.order.order_number)} · Ref. ${esc(row.item.product_reference)}</small>`;
  const maxInLot = (row,lot) => Math.min(row.remaining,Math.floor((Math.max(0,lot.mine-n(lot.committed))+0.000499)/row.unit));
  const stockOptions = (lots, measure, chosen = '') => lots.map(lot =>
    `<option value="${esc(lot.id)}" ${lot.id===chosen?'selected':''}>${esc(lot.lot_code)} · ${meters(measure(lot))}</option>`).join('');

  function provision(orders) {
    const rows = activeOrders(orders).map(row=>{
      const {item,fabric,unit,physical,available,reserved,needed,shortage}=row;
      return `<tr>
        <td><input type="checkbox" data-faction-select="${esc(item.id)}" aria-label="Selecionar ${esc(item.product_name)}" ${selected.has(item.id)?'checked':''}></td>
        <td>${product(row)}<div class="fw-tabs"><button type="button" data-fw-buy-map>Mapa de trocas</button>${button('Ficha técnica','recipe',item.id,!item.recipe_id)}</div></td>
        <td>${pieces(item.ordered_pieces)}</td><td>${esc(fabric?internalName(fabric):'Tecido a vincular')}<small>${esc(fabric?.color_reference||'')}</small></td>
        <td>${br(unit,4)}</td><td>${meters(n(item.ordered_pieces)*unit)}</td>
        <td>${meters(physical)}<small>${meters(available)} disponíveis para reserva</small></td>
        <td>${meters(reserved)}<small>${meters(reserved-row.committed)} livres para novos lotes</small>${reserved>row.committed?button('Liberar reserva','release',item.id):''}</td>
        <td>${meters(Math.max(0,needed-reserved))}<small>${meters(row.incoming)} a receber por tecido</small><small>${meters(shortage)} estimados a solicitar</small></td>
        <td>${row.remaining===0?'Corte atendido':reserved>=needed?'Reservado':reserved>0?'Reserva parcial':'Aguardando reserva'}
        ${shortage>0?button('Solicitar faltante','request',item.id,!fabric):''}</td></tr>`;
    }).join('');
    const ordersTable = table(['<input type="checkbox" data-faction-select-all aria-label="Selecionar todas as ordens">','Produto / origem','Peças','Tecido','m/peça','Estimado total','Físico do tecido','Reserva da ordem','Falta reservar','Situação'],rows,'Gere uma ordem a partir do mapa de necessidades.');
    const requests = table(['Pedido / tecido','Solicitado','A receber','Situação'],state.purchaseItems.flatMap(item=>{
      const order=state.purchaseOrders.find(row=>row.id===item.purchase_order_id);
      if(!order||order.status==='CANCELADA'||n(item.received_m)>=n(item.ordered_m))return [];
      const fabric=state.fabric.find(row=>row.id===item.fabric_id);
      return `<tr><td>${esc(order.order_number)} · ${esc(fabric?internalName(fabric):'Tecido')}</td><td>${meters(item.ordered_m)}</td><td>${meters(n(item.ordered_m)-n(item.received_m))}</td><td>${esc(order.logistics_stage||order.status)}</td></tr>`;
    }).join(''),'Nenhum pedido de tecido com saldo a receber.');
    return panel('Ordens de produção',ordersTable,`<div class="fw-tabs">${button('Reservar para corte','reserve','')}${shortcut('Necessidade de compra','material-need')}</div>`) +
      section('Gerar ordem pelo mapa de necessidades',demandView(false)) +
      panel('Solicitações de tecido',requests,shortcut('Pedidos e recebimentos','purchases'));
  }

  function cutView(orders) {
    const rows = activeOrders(orders).map(row=>{
      const stored = draft.get(row.item.id) || {};
      const lots = row.lots.filter(lot=>maxInLot(row,lot)>0);
      const lot = lots.find(l=>l.id===stored.lot) || lots[0];
      const maximum = lot ? maxInLot(row,lot) : 0;
      const quantity = Math.min(stored.quantity||0,maximum);
      return `<tr data-faction-line="${esc(row.item.id)}" data-unit="${row.unit}">
        <td>${product(row)}<small>${esc(row.fabric?internalName(row.fabric):'Tecido a vincular')}</small></td>
        <td>${pieces(row.item.ordered_pieces)}</td><td>${pieces(row.cut+row.cutting)}</td><td>${pieces(row.cutting)}</td><td>${pieces(row.cut)}</td><td>${pieces(row.remaining)}</td>
        <td><select data-faction-roll aria-label="Rolo de ${esc(row.item.product_name)}" ${lot?'':'disabled'}>
          ${lot?stockOptions(lots,l=>round(l.mine-l.committed),lot.id):'<option>Sem reserva suficiente</option>'}
        </select></td>
        <td><input type="number" data-faction-cut-quantity min="1" max="${maximum}" step="1" inputmode="numeric" aria-label="Quantidade a cortar de ${esc(row.item.product_name)}" value="${quantity||''}" ${maximum?'':'disabled'}><small>Máx. com reserva: ${pieces(maximum)}</small></td>
        <td data-faction-estimate>${meters(quantity*row.unit)}</td><td>${meters(round(sum(row.lots,l=>l.mine-l.committed)))}</td>
        <td>${button('Gerar mapa e lote de corte','cut',row.item.id,!maximum||state.cutPlansError)}</td></tr>`;
    }).join('');
    const lots = orders.flatMap(row=>row.cuts.map(cut=>`<tr><td>${button(esc(cut.id.slice(0,8)),'map',cut.id)}<small>${dateLabel(cut.created_at)}</small></td>
      <td>${product(row)}</td><td>${pieces(cut.produced_pieces)}</td><td>${meters(cut.consumed_m)}</td><td>${cut.sent_date?'Enviado à facção':'Corte concluído'}</td></tr>`)).join('');
    const pending = plans().filter(plan=>plan.status!=='CONCLUIDO').flatMap(plan=>{
      const row=orders.find(row=>row.item.id===plan.order_item_id);
      if(!row)return [];
      const editable=plan.status==='PLANEJADO';
      const actions = button('Mapa','plan-map',plan.id) +
        (editable?button('Fracionar lote','split',plan.id)+button('Iniciar corte','start',plan.id)+button('Cancelar lote','cancel',plan.id):'') +
        (plan.status==='INICIADO'?button('Finalizar corte','finish',plan.id):'');
      return `<tr><td>${esc(plan.id.slice(0,8))}<small>${plan.parent_id?'Origem '+esc(plan.parent_id.slice(0,8)):''}</small></td>
        <td>${product(row)}</td><td>${pieces(plan.pieces)}</td><td>${meters(plan.reserved_m)}</td><td>${esc(plan.status)}</td><td><div class="fw-tabs">${actions}</div></td></tr>`;
    }).join('');
    return (state.cutPlansError?'<p role="alert">Não foi possível carregar o planejamento de corte. Atualize os dados.</p>':'')+
      metrics([['Em lotes abertos',pieces(sum(orders,r=>r.cutting)),'Peças planejadas ou com corte iniciado'],['Cortadas',pieces(sum(orders,r=>r.cut)),'Peças em lotes concluídos'],['Saldo para novos lotes',pieces(sum(orders,r=>r.remaining)),'Peças ainda disponíveis para corte']]) +
      panel('Quantidade que cabe neste corte',table(['Produto / tecido','Ordem','Distribuídas','Corte aberto','Cortadas','Saldo','Rolo reservado','Quantidade a cortar neste lote','Consumo previsto','Reserva livre','Ação'],rows,'Reserve tecido em Provisão Facção para começar.')) +
      panel('Lotes de corte',table(['Lote / origem','Produto','Peças','Reserva','Situação','Ação'],pending,'Nenhum lote planejado.')) +
      section('Cortes concluídos',table(['Lote / data','Produto','Peças cortadas','Consumo real','Situação'],lots,'Nenhum lote concluído.'));

  }

  function sewing(orders) {
    const managed = new Set(plans().filter(plan=>plan.cut_id).map(plan=>plan.cut_id));
    const lots = orders.flatMap(row=>row.cuts.map(cut=>`<tr><td>${button(esc(cut.id.slice(0,8)),'map',cut.id)}</td><td>${product(row)}</td><td>${pieces(cut.produced_pieces)}</td>
      <td>${managed.has(cut.id)?pieces(sum(deliveries(cut),r=>r.accepted_pieces)):'—'}</td>
      <td>${managed.has(cut.id)?pieces(cut.produced_pieces-accounted(cut)):'Ver retorno por OS'}</td>
      <td>${dateLabel(cut.sent_date)}</td><td>${dateLabel(cut.expected_date)}</td><td><div class="fw-tabs">${button(cut.sent_date?'Editar previsão':'Enviar à facção','dispatch',cut.id)}
      ${managed.has(cut.id)?button('Registrar entrega','deliver-lot',cut.id,!cut.sent_date||accounted(cut)>=cut.produced_pieces):''}</div></td></tr>`)).join('');
    const receiving = orders.filter(row=>row.cuts.some(cut=>cut.sent_date&&!managed.has(cut.id))).map(row=>{
      const legacyReturns=state.returns.filter(record=>record.order_item_id===row.item.id&&!record.cut_batch_id);
      const sent=sum(row.cuts.filter(cut=>cut.sent_date&&!managed.has(cut.id)),cut=>cut.produced_pieces);
      const accepted=sum(legacyReturns,r=>r.accepted_pieces), rejected=sum(legacyReturns,r=>r.rejected_pieces);
      const pending=Math.max(0,sent-accepted-rejected);
      return `<tr><td>${product(row)}</td><td>${pieces(sent)}</td><td>${pieces(accepted)}</td><td>${pieces(rejected)}</td>
       <td>${pieces(pending)}</td><td>${button('Registrar entrega','deliver',row.item.id,!pending)}</td></tr>`;
    }).join('');
    const returns = state.returns.flatMap(record=>{
      const row=orders.find(o=>o.item.id===record.order_item_id);
      return row?[`<tr><td>${dateLabel(record.returned_at)}</td><td>${product(row)}<small>${record.cut_batch_id?'Lote '+esc(record.cut_batch_id.slice(0,8)):'Retorno por OS'}</small></td><td>${pieces(record.accepted_pieces)}</td><td>${pieces(record.rejected_pieces)}</td><td>${esc(record.notes||'—')}</td></tr>`]:[];
    }).join('');
    return metrics([['Em costura',pieces(sum(orders,row=>Math.max(0,sum(row.cuts.filter(c=>c.sent_date),c=>c.produced_pieces)-row.receivedByOrder))),'Peças enviadas aguardando retorno'],['Entregues',pieces(sum(orders,row=>row.returns.accepted)),'Peças aceitas no retorno']]) +
      panel('Lotes recebidos do corte',table(['Lote','OS / produto','Cortadas','Entregues','Pendentes','Envio à facção','Previsão','Ação'],lots,'Finalize um corte para liberar as peças à costura.')) +
      panel('Entregas de cortes anteriores por ordem',table(['OS / produto','Enviadas','Aceitas','Rejeitadas','Pendentes','Ação'],receiving,'Envie um lote à facção para registrar o retorno.')) +
      panel('Histórico de entregas',table(['Data','OS / produto','Aceitas','Rejeitadas','Observação'],returns,'Nenhuma entrega registrada.'));
  }

  function consolidated(orders) {
    const balances = table(['Produto','Ordem','Saldo para corte','Cortadas','Em costura','Aceitas','Rejeitadas','Reserva'],
      orders.map(row=>`<tr><td>${product(row)}</td><td>${pieces(row.item.ordered_pieces)}</td><td>${pieces(row.remaining)}</td><td>${pieces(row.cut)}</td>
      <td>${pieces(Math.max(0,sum(row.cuts.filter(c=>c.sent_date),c=>c.produced_pieces)-row.receivedByOrder))}</td><td>${pieces(row.returns.accepted)}</td><td>${pieces(row.returns.rejected)}</td><td>${meters(row.reserved)}</td></tr>`).join(''),'Nenhuma ordem de produção.');
    const stock = table(['Tecido / lote','Físico','Reservado','Disponível'],liveBalances().map(lot=>{
      const fabric=state.fabric.find(f=>f.id===lot.fabric_id);
      return `<tr><td>${esc(lot.lot_code)} · ${esc(fabric?internalName(fabric):'Tecido')}</td><td>${meters(lot.onhand)}</td><td>${meters(lot.reserved)}</td><td>${meters(lot.quality_status==='APROVADO'?Math.max(0,lot.onhand-lot.reserved):0)}</td></tr>`;
    }).join(''),'Nenhum lote de tecido registrado.');
    const items = new Map(orders.map(row=>[row.item.id,row]));
    const movements = state.moves.filter(move=>items.has(move.order_item_id)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
    const history = table(['Data','Produto','Movimento','Metros','Observação'],movements.slice(0,50).map(move=>
      `<tr><td>${dateLabel(move.created_at)}</td><td>${product(items.get(move.order_item_id))}</td><td>${esc(move.movement_type)}</td>
      <td>${meters(move.quantity_m)}</td><td>${esc(move.notes||'—')}</td></tr>`).join(''),'Nenhuma movimentação vinculada.');
    return section('Saldos consolidados por ordem de produção',balances) +
      section('Estoque de tecidos compartilhado',stock+shortcut('Consultar estoque','stock')) +
      section('Histórico de movimentações',history+(movements.length>50?'<p>Mostrando os 50 registros mais recentes.</p>':''));

  }

  function view() {
    const main = stages.map(([value,label],index)=>`<button type="button" data-fw-faction-stage="${value}" aria-pressed="${value===stage}">${index+1}. ${label}</button>`).join('');
    const options = [['assigned','Minhas ordens'],['review','Vínculos e conferência']].map(([value,label])=>
      `<button type="button" data-fw-faction-stage="${value}" aria-pressed="${value===stage}">${label}</button>`).join('');
    const current = stages.find(([value])=>value===stage);
    let body;
    if (current) {
      const orders=getOrders();
      const stageView={provision,cut:cutView,sewing};
      body=`<header class="fw-faction-heading"><h3>${current[1]}</h3><p>${current[2]}</p></header>`+stageView[stage](orders)+consolidated(orders);
    } else {
      body=stage==='review'?factionDesk.view():'<section class="fw-panel" data-faction-assigned aria-live="polite">Carregando ordens atribuídas…</section>';
    }
    return '<div class="fw-faction-page"><nav class="fw-tabs fw-faction-tabs" aria-label="Etapas do Portal da Facção">'+main+'</nav>'+body+
      section('Ordens atribuídas e conferência','<div class="fw-tabs fw-faction-tabs">'+options+'</div>')+'</div>';
  }

  function openDialog(title, contents) {
    const dialog=document.createElement('dialog');
    dialog.className='fw-recipe-dialog';
    dialog.setAttribute('aria-labelledby','faction-dialog-title');
    dialog.innerHTML=`<header class="fw-modal-head"><h2 id="faction-dialog-title">${title}</h2><button type="button" aria-label="Fechar" data-faction-close>×</button></header><div class="fw-panel"><p data-faction-error role="alert" hidden></p>${contents}</div>`;
    dialog.querySelector('[data-faction-close]').onclick=()=>dialog.close();
    dialog.querySelectorAll('[data-fw-tab]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    const form=dialog.querySelector('[data-faction-form]');
    if(form) {
      const error=dialog.querySelector('[data-faction-error]');
      const buttons=[...dialog.querySelectorAll('button')];
      dialog.addEventListener('cancel',event=>{if(form.dataset.saving==='true')event.preventDefault();});
      form.onsubmit=async event=>{
        event.preventDefault();
        if(form.dataset.saving==='true')return;
        form.dataset.saving='true';
        buttons.forEach(button=>{button.disabled=true;});
        error.hidden=true;
        let recorded=false;
        try {
          const values=Object.fromEntries(new FormData(form));
          const kind=form.dataset.factionForm;
          if(kind==='faction-delivery') {
            await reload();
            const row=getOrders().find(row=>row.item.id===values.id);
            const pending=row?legacyPending(row,state.returns):0;
            const total=Number(values.accepted)+Number(values.rejected);
            if(total<=0||total>pending)throw Error('Informe uma quantidade de peças entre 1 e o saldo do envio.');
            values.faction=values.faction||String(n(values.accepted)*n(row.item.faction_cost_per_piece));
            values.extras=values.extras||String(n(values.accepted)*n(row.item.extras_cost_per_piece));
            if(Number(values.returned)>0) {
              const lots=new Set(state.moves.filter(move=>move.order_item_id===values.id&&move.movement_type==='ENVIO_FACCAO').map(move=>move.lot_id));
              if(lots.size>1)throw Error('Para devolução de tecido de vários rolos, use o lançamento de retorno em Produção e facção. Registre aqui as peças sem a sobra, se o retorno de tecido for separado.');
            }
            await returnForm(values.id,values);
          } else if(kind==='plan') {
            await cutPlanRpc('plan',{id:values.requestId,order_item_id:values.order_item_id,lot_id:values.lot_id,pieces:Number(values.pieces)});
          } else if(kind==='split') {
            const ids=JSON.parse(values.part_ids);
            const parts=new FormData(form).getAll('part').flatMap((qty,index)=>Number(qty)>0?[{id:ids[index],pieces:Number(qty)}]:[]);
            await cutPlanRpc('split',{id:values.id,parts});
          } else if(kind==='finish'||kind==='cancel') {
            await cutPlanRpc(kind,{id:values.id,pieces:Number(values.pieces),consumed_m:Number(values.consumed_m),notes:values.notes});
          } else if(kind==='deliver-lot') {
            await rpc('fabric_faction_deliver_cut',{p_org:state.org,p_cut:values.id,p_key:values.requestId,
              p_accepted:Number(values.accepted),p_rejected:Number(values.rejected),p_notes:values.notes});
          } else {
            form.dataset.fwForm=kind;
            try {await submit(form);}
            finally {delete form.dataset.fwForm;}
          }
          recorded=true;
          if(kind==='plan')draft.delete(values.order_item_id);
          await reload();
          await syncOrderStatuses();
          await reload();
          state.notice='Registro salvo.';
          dialog.close();
          render();
          window.dispatchEvent(new Event('gao-production-updated'));
        } catch (failure) {
          error.textContent=recorded?'Registro salvo. Feche a janela e atualize os dados.':failure.message;
          error.hidden=false;
        } finally {
          form.dataset.saving='false';
          buttons.forEach(button=>{button.disabled=recorded&&button.type==='submit';});
        }
      };
    }
    document.body.appendChild(dialog);
    dialog.showModal();
    return dialog;
  }

  function cutForm(row, trigger) {
    const line=trigger.closest('[data-faction-line]');
    const input=line.querySelector('[data-faction-cut-quantity]');
    const lot=row.lots.find(l=>l.id===line.querySelector('[data-faction-roll]').value);
    const quantity=Number(input.value);
    if(!lot||!quantity||!input.reportValidity()) {input.focus();return;}
    openDialog('Gerar mapa e lote de corte',`<p>${product(row)} · rolo ${esc(lot.lot_code)}</p>
      <p>${pieces(quantity)} peças · ${meters(quantity*row.unit)} da reserva da ordem serão vinculados a este lote.</p>
      <form data-faction-form="plan">
        <input type="hidden" name="requestId" value="${uid()}"><input type="hidden" name="order_item_id" value="${esc(row.item.id)}">
        <input type="hidden" name="lot_id" value="${esc(lot.id)}"><input type="hidden" name="pieces" value="${quantity}">
        <button>Gerar lote</button>
      </form>`);

  }

  async function reserve() {
    await run(async()=>{
      if(!selected.size)throw Error('Selecione as ordens que deseja reservar.');
      await reload();
      const rows=activeOrders(getOrders()).filter(row=>selected.has(row.item.id));
      const free=new Map(rows.flatMap(row=>row.lots.map(lot=>[lot.id,lot.free])));
      let posted=0;
      try {
        for(const row of rows) {
          let remaining=round(row.needed-row.reserved);
          for(const lot of row.lots) {
            const qty=round(Math.min(remaining,free.get(lot.id)));
            if(qty<=0)continue;
            const revision=state.moves.filter(move=>move.order_item_id===row.item.id&&move.lot_id===lot.id).length;
            const result=await rpc('fabric_post_stock_movement',{p_organization_id:state.org,p_lot_id:lot.id,p_movement_type:'RESERVA',
              p_quantity_m:qty,p_order_item_id:row.item.id,p_idempotency_key:'faction-reserve:'+row.item.id+':'+lot.id+':'+revision+':'+qty,
              p_notes:'Reserva para corte no Portal da Facção'});
            remaining=round(remaining-qty);
            free.set(lot.id,round(free.get(lot.id)-qty));
            if(result?.created!==false)posted=round(posted+qty);
          }
        }
      } catch (error) {
        await reload();
        throw Error(posted?`${meters(posted)} processados antes da interrupção. ${error.message}`:error.message);
      }
      if(!posted)throw Error('As ordens selecionadas já estão cobertas ou não há tecido livre para reservar.');
      selected.clear();
      state.notice='Reserva processada. Confira os saldos por ordem.';
    });
  }

  function planAction(action,plan,row) {
    const hidden=`<input type="hidden" name="id" value="${esc(plan.id)}">`;
    const roll=row.lots.find(lot=>lot.id===plan.lot_id);
    const summary=`<p>${product(row)} · rolo ${esc(roll?.lot_code||'—')} · ${pieces(plan.pieces)} peças · ${meters(plan.reserved_m)} reservados</p>`;
    if(action==='plan-map')return openDialog('Mapa de corte · '+esc(plan.id.slice(0,8)),summary+
      `<p>${esc(plan.status)}${plan.parent_id?' · Origem '+esc(plan.parent_id.slice(0,8)):''}</p><p>${esc(plan.notes||'')}</p>`);
    if(action==='start')return run(()=>cutPlanRpc('start',{id:plan.id}));
    if(action==='cancel')return openDialog('Cancelar lote',summary+
      `<form data-faction-form="cancel">${hidden}<label class="fw-field">Motivo<input name="notes" required maxlength="500"></label><button>Cancelar lote</button></form>`);
    if(action==='finish')return openDialog('Finalizar corte',summary+
      `<form data-faction-form="finish">${hidden}
      <label class="fw-field">Peças cortadas<input type="number" name="pieces" min="1" max="${plan.pieces}" step="1" value="${plan.pieces}" required></label>
      <label class="fw-field">Consumo real (m)<input type="number" name="consumed_m" min=".001" step=".001" value="${plan.reserved_m}" required></label>
      <label class="fw-field">Justificativa se houver diferença<input name="notes" maxlength="500"></label><button>Finalizar corte</button></form>`);
    if(action==='split') {
      const dialog=openDialog('Fracionar lote',summary+
        `<form data-faction-form="split">${hidden}<input type="hidden" name="part_ids"><div data-part-list></div>
        <p data-part-saldo role="status"></p><button type="button" data-add-part>+ Novo lote</button><button>Confirmar fracionamento</button></form>`);
      const form=dialog.querySelector('form'), ids=[];
      const list=form.querySelector('[data-part-list]'), status=form.querySelector('[data-part-saldo]');
      const update=()=>{
        const fields=[...list.querySelectorAll('input')];
        const total=fields.reduce((count,input)=>count+Number(input.value),0);
        status.textContent=`${pieces(plan.pieces-total)} peças por distribuir`;
        fields.at(-1).setCustomValidity(total===plan.pieces&&fields.filter(input=>Number(input.value)>0).length>1?'':'Distribua todas as peças em pelo menos dois lotes.');
      };
      const add=()=>{
        for(const input of list.querySelectorAll('input'))input.setCustomValidity('');
        ids.push(uid());
        form.elements.part_ids.value=JSON.stringify(ids);
        list.insertAdjacentHTML('beforeend',`<label class="fw-field">Lote ${ids.length}<input name="part" type="number" min="0" max="${plan.pieces}" step="1" value="0"></label>`);
        form.querySelector('[data-add-part]').disabled=ids.length>=30;
        update();
      };
      list.oninput=update;
      form.querySelector('[data-add-part]').onclick=add;
      add();add();
    }
  }

  function handleAction(trigger) {
    const {factionAction:action,factionId:id}=trigger.dataset;
    if(action==='reserve')return reserve();
    const orders=getOrders();
    const plan=plans().find(plan=>plan.id===id);
    if(plan&&['plan-map','start','split','cancel','finish'].includes(action)) {
      const row=orders.find(row=>row.item.id===plan.order_item_id);
      if(row)return planAction(action,plan,row);
      return;
    }
    const row=orders.find(o=>o.item.id===id||o.cuts.some(cut=>cut.id===id));
    if(!row)return;
    const cut=row.cuts.find(cut=>cut.id===id);
    if(action==='cut')return cutForm(row,trigger);
    if(action==='recipe') {
      const recipe=state.recipes.find(recipe=>recipe.id===row.item.recipe_id);
      const supplier=state.suppliers.find(supplier=>supplier.id===row.fabric?.supplier_id);
      return openDialog('Ficha técnica da ordem',`<p>${product(row)}</p><dl>
        <dt>Tecido e cor</dt><dd>${esc(row.fabric?internalName(row.fabric):'—')} · ${esc(row.fabric?.color||row.fabric?.color_reference||'—')}</dd>
        <dt>Fornecedor</dt><dd>${esc(supplier?.trade_name||supplier?.legal_name||'—')}</dd>
        <dt>Consumo registrado na ordem</dt><dd>${br(row.unit,4)} m/peça</dd>
        <dt>Ficha vinculada</dt><dd>${esc(recipe?.id||row.item.recipe_id)}</dd></dl>
        ${shortcut('Consultar fichas técnicas','recipes')} ${shortcut('Consultar fornecedores','suppliers')}`);
    }
    if(action==='request'&&row.shortage>0&&row.fabric)return openFabricPurchaseDraft({fabric:row.fabric,missing:row.shortage},{
      source_item:row.order.order_number,product_name:row.item.product_name
    });
    if(action==='release')return openDialog('Liberar reserva da ordem',`<form data-faction-form="release"><input type="hidden" name="order_item_id" value="${esc(id)}">
      <label class="fw-field">Rolo reservado<select name="lot_id" required>${stockOptions(row.lots.filter(l=>l.mine>l.committed),l=>round(l.mine-l.committed))}</select></label>
      <label class="fw-field">Metros a liberar<input name="quantity_m" type="number" min=".001" step=".001" max="${round(row.reserved-row.committed)}" required></label><button>Liberar reserva</button></form>`);
    if(action==='map') {
      const lot=state.lots.find(l=>l.id===cut.lot_id);
      return openDialog('Mapa de corte · '+esc(cut.id.slice(0,8)),`<p>${product(row)}</p><dl>
        <dt>Lote de tecido</dt><dd>${esc(lot?.lot_code||'—')} · NF ${esc(lot?.invoice_number||'—')}</dd>
        <dt>Peças cortadas</dt><dd>${pieces(cut.produced_pieces)}</dd>
        <dt>Consumo de referência da ordem</dt><dd>${br(row.unit,4)} m/peça</dd>
        <dt>Consumo real do lote</dt><dd>${meters(cut.consumed_m)}</dd></dl>`);
    }
    if(action==='dispatch') {
      const day=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      return openDialog('Envio e previsão da facção',`<form data-faction-form="dispatch"><input name="id" type="hidden" value="${esc(id)}">
       <label class="fw-field">Facção<select name="supplier_id" required>${supplierOptionList(cut.supplier_id)}</select></label>
       <label class="fw-field">Envio<input name="sent_date" type="date" value="${esc(cut.sent_date||day)}" required></label>
       <label class="fw-field">Previsão de entrega<input name="expected_date" type="date" value="${esc(cut.expected_date||'')}"></label>
       <label class="fw-field">Justificativa ao alterar o prazo padrão<input name="notes" value="${esc(cut.notes||'')}"></label><button>Salvar envio e previsão</button></form>`);
    }
    if(action==='deliver-lot') {
      const pending=Math.max(0,cut.produced_pieces-accounted(cut));
      return openDialog('Registrar entrega do lote '+esc(id.slice(0,8)),`<p>${product(row)} · ${pieces(pending)} peças pendentes</p>
        <form data-faction-form="deliver-lot"><input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="requestId" value="${uid()}">
        <label class="fw-field">Peças aceitas<input type="number" name="accepted" min="0" max="${pending}" step="1" value="0" required></label>
        <label class="fw-field">Peças rejeitadas<input type="number" name="rejected" min="0" max="${pending}" step="1" value="0" required></label>
        <label class="fw-field">Observação<input name="notes" maxlength="1000"></label><button>Registrar entrega</button></form>`);
    }
    if(action==='deliver') {
      const remaining=legacyPending(row,state.returns);
      return openDialog('Registrar entrega da OS '+esc(row.order.order_number),`<p>${esc(row.item.product_name)} · ${pieces(remaining)} peças pendentes</p>
        <form data-faction-form="faction-delivery"><input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="requestId" value="${uid()}">
        <label class="fw-field">Peças aceitas<input type="number" name="accepted" min="0" max="${remaining}" step="1" value="0" required></label>
        <label class="fw-field">Peças rejeitadas<input type="number" name="rejected" min="0" max="${remaining}" step="1" value="0" required></label>
        <label class="fw-field">Sobra de tecido (m)<input type="number" name="returned" min="0" step=".001" value="0" required></label>
        <label class="fw-field">Custo da facção (R$)<input type="number" name="faction" min="0" step=".01" placeholder="Calculado pelas peças aceitas"></label>
        <label class="fw-field">Custo de aviamentos (R$)<input type="number" name="extras" min="0" step=".01" placeholder="Calculado pelas peças aceitas"></label>
        <label class="fw-field">Observação<input name="notes" maxlength="1000"></label><button>Registrar entrega</button></form>`);
    }
  }

  function bind(host) {
    if(stage==='assigned'||stage==='review')factionDesk.bind(host);
    const page=host.querySelector('.fw-faction-page');
    if(!page)return;
    const master=page.querySelector('[data-faction-select-all]');
    const boxes=[...page.querySelectorAll('[data-faction-select]')];
    if(master) {
      const sync=()=>{
        const count=boxes.filter(box=>box.checked).length;
        master.checked=!!boxes.length&&count===boxes.length;
        master.indeterminate=count>0&&count<boxes.length;
        master.disabled=!boxes.length;
      };
      master.onchange=()=>{
        for(const box of boxes){box.checked=master.checked;box.onchange();}
      };
      for(const box of boxes)box.onchange=()=>{
        if(box.checked)selected.add(box.dataset.factionSelect);
        else selected.delete(box.dataset.factionSelect);
        sync();
      };
      sync();
    }
    page.addEventListener('click',event=>{
      const tab=event.target.closest('[data-fw-faction-stage]');
      if(tab) {
        stage=tab.dataset.fwFactionStage;
        render();
        host.querySelector(`[data-fw-faction-stage="${stage}"]`)?.focus({preventScroll:true});
        return;
      }
      const action=event.target.closest('[data-faction-action]');
      if(action)handleAction(action);
    });
    for(const line of page.querySelectorAll('[data-faction-line]')) {
      const roll=line.querySelector('[data-faction-roll]');
      const qty=line.querySelector('[data-faction-cut-quantity]');
      const save=()=>draft.set(line.dataset.factionLine,{lot:roll.value,quantity:Number(qty.value)||0});
      roll.onchange=()=>{save();render();};
      qty.oninput=()=>{save();line.querySelector('[data-faction-estimate]').textContent=meters(Number(qty.value)*Number(line.dataset.unit));};
    }
  }
  return {view,bind};
}
