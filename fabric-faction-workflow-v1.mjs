export function createFactionWorkflow({
  state, esc, n, br, liveBalances, historicalBalances, fabricMatches, internalName, physicalFactionMeters,
  orderStats, demandView, factionDesk, factionAvailableStock, factionInventoryForm, render, run, rpc, reload, uid,
  supplierOptionList, openFabricPurchaseDraft, submit, returnForm, syncOrderStatuses
}) {
  const stages = [
    ['provision', 'Provisão Facção', 'Planeje as peças, reserve tecidos e solicite os faltantes.'],
    ['cut', 'Corte', 'Defina o que cabe em cada corte e preserve o saldo da ordem.'],
    ['sewing', 'Costura', 'Receba os lotes e registre entregas parciais ou integrais.'],
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
  const cutSelected = new Set();
  const button = (label, action, id, disabled = false) =>
    `<button type="button" data-faction-action="${action}" data-faction-id="${esc(id)}" ${disabled?'disabled':''}>${label}</button>`;
  const shortcut = (label, tab) => `<button type="button" data-fw-tab="${tab}">${label}</button>`;
  const table = (headers, rows, empty) => `<div class="fw-table-scroll"><table><thead><tr>${headers.map(h=>'<th scope="col">'+h+'</th>').join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}">${empty}</td></tr>`}</tbody></table></div>`;
  const panel = (title, body, controls='') => `<section class="fw-panel"><div class="fw-faction-toolbar"><h3>${title}</h3>${controls}</div>${body}</section>`;
  const section = (title, content) => `<details class="fw-panel" data-fw-detail-key="faction-${title}"><summary>${title}</summary>${content}</details>`;
  const metrics = entries => `<div class="fw-overview-grid">${entries.map(([label,value,description])=>`<article class="fw-overview-metric"><span>${label}</span><strong>${value}</strong><small>${description}</small></article>`).join('')}</div>`;

  const plans = () => state.cutPlans || [];
  const openPlans = () => plans().filter(plan=>['PLANEJADO','INICIADO'].includes(plan.status));
  const isManaged = cut => plans().some(plan=>plan.cut_id===cut.id);
  const legacyPending = (row, records) => Math.max(0,
    sum(row.cuts.filter(cut=>cut.sent_date&&!isManaged(cut)),cut=>cut.produced_pieces)-
    sum(records.filter(record=>record.order_item_id===row.item.id&&!record.cut_batch_id),record=>n(record.accepted_pieces)+n(record.rejected_pieces)));
  const groupId = plan => plan.group_id||plan.id;
  const groupRows = id => plans().filter(plan=>groupId(plan)===id);
  const groups = () => [...new Set(plans().map(groupId))].map(groupRows);
  const groupRpc = (action,id,lines=[],options={}) => rpc('fabric_faction_group',{
    p_org:state.org,p_group:id,p_action:action,p_lines:lines,p_options:options
  });
  const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const groupCuts = id => groupRows(id).flatMap(plan=>state.cuts.filter(cut=>cut.id===plan.cut_id));
  const toBase64 = file => new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(',')[1]);
    reader.onerror=()=>reject(Error('Não foi possível ler o PDF.'));
    reader.readAsDataURL(file);
  });
  const deliveries = cut => state.returns.filter(record=>record.cut_batch_id===cut.id);
  const accounted = cut => sum(deliveries(cut),record=>n(record.accepted_pieces)+n(record.rejected_pieces));

  function getOrders() {
    const stock = liveBalances().filter(lot => lot.quality_status === 'APROVADO');
    const inventory = state.factionInventories?.[0];
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
        physical:inventory?(fabric?physicalFactionMeters(fabric,inventory.lines):null):
          sum(lots,lot=>lot.onhand)+(fabric?physicalFactionMeters(fabric):0),
        incoming,shortage:Math.max(0,round(needed-reserved-available-incoming))}];
    });
  }
  const activeOrders = orders => orders.filter(({order})=>order.status!=='CONCLUIDA');
  const product = row => `<strong>${esc(row.item.product_name)}</strong><small>OS ${esc(row.order.order_number)} · Ref. ${esc(row.item.product_reference)}</small>`;
  const maxInLot = (row,lot) => Math.min(row.remaining,Math.floor((Math.max(0,lot.mine-n(lot.committed))+0.000499)/row.unit));
  const stockOptions = (lots, measure, chosen = '') => lots.map(lot =>
    `<option value="${esc(lot.id)}" ${lot.id===chosen?'selected':''}>${esc(lot.lot_code)} · ${meters(measure(lot))}</option>`).join('');

  function hasProductionHistory(id) {
    return [state.moves,state.cuts,state.returns,plans()].some(rows=>rows.some(record=>record.order_item_id===id))||
      (state.enfestos||[]).some(record=>record.outputs?.some(output=>output.source_type==='os'&&output.source_id===id));
  }
  const isManual=order=>String(order.idempotency_key||'').startsWith('manual:');

  function provision(orders) {
    const rows = activeOrders(orders).map(row=>{
      const {item,fabric,unit,physical,available,reserved,needed,shortage}=row;
      const supplier=state.suppliers?.find(supplier=>supplier.id===fabric?.supplier_id);
      return `<tr>
        <td><input type="checkbox" data-faction-select="${esc(item.id)}" aria-label="Selecionar ${esc(item.product_name)}" ${selected.has(item.id)?'checked':''}></td>
        <td>${product(row)}<div class="fw-tabs">${isManual(row.order)?'<small>Lançado manualmente</small>':'<button type="button" data-fw-buy-map>Mapa de trocas</button>'}${button('Ficha técnica','recipe',item.id,!item.recipe_id)}</div></td>
        <td><input type="number" data-provision-quantity="${esc(item.id)}" min="1" max="2147483647" step="1" value="${n(item.ordered_pieces)}" aria-label="Quantidade da ordem de ${esc(item.product_name)}" required></td><td>${esc(fabric?internalName(fabric):'Tecido a vincular')}<small>${esc([fabric?.color||fabric?.color_reference,supplier?.trade_name||supplier?.legal_name].filter(Boolean).join(' · '))}</small></td>
        <td>${br(unit,4)}</td><td data-provision-estimate data-unit="${unit}">${meters(n(item.ordered_pieces)*unit)}</td>
        <td>${physical===null?'Sem contagem vinculada':meters(physical)}<small>${meters(available)} livres em lotes para reserva</small></td>
        <td>${meters(reserved)}<small>${meters(reserved-row.committed)} livres para novos lotes</small>${reserved>row.committed?button('Liberar reserva','release',item.id):''}</td>
        <td>${meters(Math.max(0,needed-reserved))}<small>${meters(row.incoming)} a receber por tecido</small><small>${meters(shortage)} estimados a solicitar</small></td>
        <td>${row.remaining===0?'Corte atendido':reserved>=needed?'Reservado':reserved>0?'Reserva parcial':'Aguardando reserva'}
        ${needed>reserved&&state.canOperateFaction&&(state.canReserveFaction||state.canViewInventory)?button('Conferir rolo','confirm-lot',item.id):''}
        ${shortage>0?button('Solicitar faltante','request',item.id,!fabric):''}
        ${state.canOperateFaction&&!hasProductionHistory(item.id)?button('Excluir item','remove-item',item.id):''}</td></tr>`;
    }).join('');
    const ordersTable = table(['<input type="checkbox" data-faction-select-all aria-label="Selecionar todas as ordens">','Produto / origem','Peças','Tecido','m/peça','Estimado total',state.factionInventories?.[0]?'Inventário físico':'Físico do tecido','Reserva da ordem','Falta reservar','Situação'],rows,'Adicione um produto manualmente ou gere a ordem pelo mapa de necessidades.');
    const requests = table(['Pedido / tecido','Solicitado','A receber','Situação'],state.purchaseItems.flatMap(item=>{
      const order=state.purchaseOrders.find(row=>row.id===item.purchase_order_id);
      if(!order||order.status==='CANCELADA'||n(item.received_m)>=n(item.ordered_m))return [];
      const fabric=state.fabric.find(row=>row.id===item.fabric_id);
      return `<tr><td>${esc(order.order_number)} · ${esc(fabric?internalName(fabric):'Tecido')}</td><td>${meters(item.ordered_m)}</td><td>${meters(n(item.ordered_m)-n(item.received_m))}</td><td>${esc(order.logistics_stage||order.status)}</td></tr>`;
    }).join(''),'Nenhum pedido de tecido com saldo a receber.');
    return panel('Ordens de produção',ordersTable,`<div class="fw-tabs">${state.canOperateFaction?button('Adicionar produto','manual-item',''):''}${button('Solicitar faltantes','request-selected','')}${button('Reservar para corte','reserve','')}</div>`) +
      '<p class="faction-notice">As ordens que usam o mesmo tecido compartilham o saldo do estoque. Uma reserva parcial já permite planejar o corte.</p>'+
      panel('Solicitações de tecido',requests,shortcut('Pedidos e recebimentos','purchases'))+
      section('Gerar ordem pelo mapa de necessidades',demandView(false));
  }

  function cutView(orders) {
    const rows = activeOrders(orders).map(row=>{
      const stored = draft.get(row.item.id) || {};
      const lots = row.lots.filter(lot=>maxInLot(row,lot)>0);
      const lot = lots.find(l=>l.id===stored.lot) || lots[0];
      const maximum = lot ? maxInLot(row,lot) : 0;
      const quantity = Math.min(stored.quantity||0,maximum);
      return `<tr data-faction-line="${esc(row.item.id)}" data-unit="${row.unit}">
        <td><input type="checkbox" data-cut-select aria-label="Incluir ${esc(row.item.product_name)}" ${cutSelected.has(row.item.id)?'checked':''} ${maximum?'':'disabled'}></td><td>${product(row)}<small>${esc(row.fabric?internalName(row.fabric):'Tecido a vincular')}</small></td>
        <td>${pieces(row.item.ordered_pieces)}</td><td>${pieces(row.cut+row.cutting)}</td><td>${pieces(row.cutting)}</td><td>${pieces(row.cut)}</td><td>${pieces(row.remaining)}</td>
        <td><select data-faction-roll aria-label="Rolo de ${esc(row.item.product_name)}" ${lot?'':'disabled'}>
          ${lot?stockOptions(lots,l=>round(l.mine-l.committed),lot.id):'<option>Sem reserva suficiente</option>'}
        </select></td>
        <td><input type="number" data-faction-cut-quantity min="1" max="${maximum}" step="1" inputmode="numeric" aria-label="Quantidade a cortar de ${esc(row.item.product_name)}" value="${quantity||''}" ${maximum?'':'disabled'}><small>Máx. com reserva: ${pieces(maximum)}</small></td>
        <td data-faction-estimate>${meters(quantity*row.unit)}</td><td>${meters(round(sum(row.lots,l=>l.mine-l.committed)))}</td></tr>`;
    }).join('');
    const lots = orders.flatMap(row=>row.cuts.map(cut=>`<tr><td>${button(esc(cut.id.slice(0,8)),'map',cut.id)}<small>${dateLabel(cut.created_at)}</small></td>
      <td>${product(row)}</td><td>${pieces(cut.produced_pieces)}</td><td>${meters(cut.consumed_m)}</td><td>${cut.sent_date?'Enviado à facção':'Corte concluído'}</td></tr>`)).join('');
    const pending = groups().filter(group=>['PLANEJADO','INICIADO'].includes(group[0].status)).map(group=>{
      const plan=group[0], id=groupId(plan);
      const editable=plan.status==='PLANEJADO';
      const actions=button('Mapa','group-map',id)+(editable?button('Fracionar lote','group-split',id)+button('Iniciar corte','group-start',id)+button('Cancelar lote','group-cancel',id):'')+
        (plan.status==='INICIADO'?button('Finalizar corte','group-finish',id):'');
      const names=group.map(line=>esc(orders.find(row=>row.item.id===line.order_item_id)?.item.product_name||'—')).join(' · ');
      const parent=plans().find(row=>row.id===plan.parent_id);
      return `<tr><td>${esc(id.slice(0,8))}<small>${parent?'Origem '+esc(groupId(parent).slice(0,8)):''}</small></td><td>${names}</td>
        <td>${pieces(sum(group,line=>line.pieces))}</td><td>${meters(sum(group,line=>line.reserved_m))}</td><td>${esc(plan.status)}</td><td><div class="fw-tabs">${actions}</div></td></tr>`;
    }).join('');
    const archived=groups().filter(group=>['FRACIONADO','CANCELADO'].includes(group[0].status));
    const history=archived.length?section('Lotes substituídos e cancelados',table(['Lote','Situação','Peças'],archived.map(group=>{
      const id=groupId(group[0]);
      return `<tr><td>${button(esc(id.slice(0,8)),'group-map',id)}</td><td>${group[0].status==='FRACIONADO'?'Substituído por fracionamento':'Cancelado'}</td><td>${pieces(sum(group,line=>line.pieces))}</td></tr>`;
    }).join(''),'Nenhum lote arquivado.')):'';
    return (state.cutPlansError?'<p role="alert">Não foi possível carregar o planejamento de corte. Atualize os dados.</p>':'')+
      metrics([['Em lotes abertos',pieces(sum(orders,r=>r.cutting)),'Peças planejadas ou com corte iniciado'],['Cortadas',pieces(sum(orders,r=>r.cut)),'Peças em lotes concluídos'],['Saldo para novos lotes',pieces(sum(orders,r=>r.remaining)),'Peças ainda disponíveis para corte']]) +
      panel('Quantidade que cabe neste corte',table(['Selecionar','Produto / tecido','Ordem','Distribuídas','Corte aberto','Cortadas','Saldo','Rolo reservado','Quantidade a cortar neste lote','Consumo previsto','Reserva livre'],rows,'Reserve tecido em Provisão Facção para começar.'),button('Gerar mapa e lote de corte','group-plan','',state.cutPlansError)) +
      panel('Lotes de corte',table(['Lote / origem','Produto','Peças','Reserva','Situação','Ação'],pending,'Nenhum lote planejado.')) +
      history+section('Cortes concluídos',table(['Lote / data','Produto','Peças cortadas','Consumo real','Situação'],lots,'Nenhum lote concluído.'));

  }

  function sewing(orders) {
    const managed = new Set(plans().filter(plan=>plan.cut_id).map(plan=>plan.cut_id));
    const lots = groups().filter(group=>group.some(plan=>plan.cut_id)).map(group=>{
      const id=groupId(group[0]), cuts=groupCuts(id);
      const received=sum(cuts,c=>c.produced_pieces);
      const accepted=sum(cuts,c=>sum(deliveries(c),r=>r.accepted_pieces));
      const processed=sum(cuts,accounted);
      const rejected=processed-accepted;
      const left=Math.max(0,received-processed);
      const names=[...new Set(group.map(line=>orders.find(row=>row.item.id===line.order_item_id)?.item.product_name).filter(Boolean))];
      const parent=plans().find(plan=>plan.id===group[0].parent_id);
      const due=group[0].sewing_due_set?group[0].sewing_due_on:cuts[0]?.expected_date;
      const status=left?(processed?'Entrega parcial':'Em costura'):(rejected?'Concluído com rejeição':'Entregue');
      return `<tr><td>${button(esc(id.slice(0,8)),'group-map',id)}<small>${esc(names.join(' · '))}</small>
        ${parent?`<small>Origem: ${esc(groupId(parent).slice(0,8))}</small>`:''}<span class="fw-status">${status}</span></td>
        <td>${pieces(received)}</td><td>${pieces(accepted)}${rejected?`<small>${pieces(rejected)} rejeitadas</small>`:''}</td><td>${pieces(left)}</td>
        <td><input type="date" data-sewing-due="${esc(id)}" value="${esc(due||'')}" aria-label="Previsão de entrega do lote ${esc(id.slice(0,8))}" ${left?'':'disabled'}></td>
        <td>${button('Registrar entrega','group-delivery',id,!left||state.deliveryDocumentsError)}</td></tr>`;
    }).join('');
    const legacyCuts=orders.flatMap(row=>row.cuts.filter(cut=>!managed.has(cut.id)).map(cut=>`<tr><td>${button(esc(cut.id.slice(0,8)),'map',cut.id)}</td>
      <td>${product(row)}</td><td>${pieces(cut.produced_pieces)}</td><td>${dateLabel(cut.sent_date)}</td><td>${dateLabel(cut.expected_date)}</td>
      <td>${button(cut.sent_date?'Editar previsão':'Enviar à facção','dispatch',cut.id)}</td></tr>`)).join('');
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
    const documents=state.deliveryDocuments||[];
    const docs=table(['Entrega / lote','Peças','Nota fiscal','Envio de documentos','Ação'],documents.map(doc=>
      `<tr><td>${esc(doc.id.slice(0,8))}<small>${esc(doc.cut_group_id.slice(0,8))} · ${dateLabel(doc.delivered_on)}</small></td>
      <td>${pieces(sum(doc.report||[],line=>line.aceitas))}${sum(doc.report||[],line=>line.rejeitadas)?`<small>${pieces(sum(doc.report,line=>line.rejeitadas))} rejeitadas</small>`:''}</td>
      <td>${esc(doc.filename)}</td><td>Disponível para baixar</td><td>${button('Ver pacote','documents',doc.id)}</td></tr>`).join(''),
      'Cada entrega parcial terá seu próprio registro e documentos.');
    const pending=sum(orders,row=>Math.max(0,sum(row.cuts,cut=>n(cut.produced_pieces))-row.receivedByOrder));
    const legacy=legacyCuts||receiving||returns?section('Histórico operacional',
      panel('Cortes anteriores',table(['Lote','OS / produto','Cortadas','Envio','Previsão','Ação'],legacyCuts,'Nenhum corte anterior.'))+
      panel('Entregas de cortes anteriores por ordem',table(['OS / produto','Enviadas','Aceitas','Rejeitadas','Pendentes','Ação'],receiving,'Nenhum retorno por ordem.'))+
      panel('Histórico de entregas',table(['Data','OS / produto','Aceitas','Rejeitadas','Observação'],returns,'Nenhuma entrega registrada.'))):'';
    return metrics([['Em costura',pieces(Math.max(0,pending))+' peças','Saldo dos lotes já cortados'],
      ['Entregues',pieces(sum(orders,row=>row.returns.accepted))+' peças','Peças aceitas no recebimento'],
      ['Entregas registradas',pieces(documents.length),'Entregas com nota fiscal e relatórios']])+
      panel('Lotes recebidos do corte',table(['Lote / produtos','Recebidas','Entregues','Pendentes','Previsão de entrega','Ação'],lots,
        'Finalize um corte para liberar as peças à costura.'),'<span>Entregas independentes por lote</span>')+
      panel('Entregas e documentos',docs)+legacy;

  }

  function consolidated(orders) {
    const balances = table(['Produto','Ordem','Não distribuídas','Em corte','Em costura','Entregues','Saldo de entrega'],
      orders.map(row=>`<tr><td>${product(row)}</td><td>${pieces(row.item.ordered_pieces)}</td><td>${pieces(row.remaining)}</td><td>${pieces(row.cutting)}</td>
      <td>${pieces(Math.max(0,row.cut-row.receivedByOrder))}</td><td>${pieces(row.returns.accepted)}</td><td>${pieces(Math.max(0,n(row.item.ordered_pieces)-row.returns.accepted))}</td></tr>`).join(''),'Nenhuma ordem de produção.');
    const items = new Map(orders.map(row=>[row.item.id,row]));
    const movements = state.moves.filter(move=>items.has(move.order_item_id)).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)));
    const history = table(['Data','Produto','Movimento','Metros','Observação'],movements.slice(0,50).map(move=>
      `<tr><td>${dateLabel(move.created_at)}</td><td>${product(items.get(move.order_item_id))}</td><td>${esc(move.movement_type)}</td>
      <td>${meters(move.quantity_m)}</td><td>${esc(move.notes||'—')}</td></tr>`).join(''),'Nenhuma movimentação vinculada.');
    return section('Saldos consolidados por ordem de produção',balances) +
      section('Histórico de movimentações',history+(movements.length>50?'<p>Mostrando os 50 registros mais recentes.</p>':''));

  }

  function view() {
    const main = stages.map(([value,label])=>`<button type="button" data-fw-faction-stage="${value}" aria-pressed="${value===stage}">${label}</button>`).join('');
    const options = [['assigned','Minhas ordens'],['review','Vínculos e conferência']].map(([value,label])=>
      `<button type="button" data-fw-faction-stage="${value}" aria-pressed="${value===stage}">${label}</button>`).join('');
    const current = stages.find(([value])=>value===stage);
    const flow=stages.map(([key,label],index)=>`<span ${key===stage?'aria-current="step"':''}>${index+1}. ${label}</span>`).join('<span aria-hidden="true">→</span>');
    let body;
    if (current) {
      const orders=getOrders();
      const stageView={provision,cut:cutView,sewing};
      body=`<header class="fw-faction-heading"><small>OPERAÇÃO / PRODUÇÃO</small><h3>${current[1]}</h3><p>${current[2]}</p></header>
        <div class="faction-flow" aria-label="Fluxo da produção">${flow}</div>`+stageView[stage](orders)+consolidated(orders);
    } else if(stage==='stock') {
      body='<header class="fw-faction-heading"><h3>Estoque de tecido disponível</h3></header>'+factionAvailableStock();
    } else {
      body=stage==='review'?factionDesk.view():'<section class="fw-panel" data-faction-assigned aria-live="polite">Carregando ordens atribuídas…</section>';
    }
    return '<div class="fw-faction-page"><aside class="faction-stage-nav"><nav class="fw-tabs fw-faction-tabs" aria-label="Etapas do Portal da Facção"><strong>PRODUÇÃO</strong>'+main+`<button type="button" data-fw-faction-stage="stock" aria-pressed="${stage==='stock'}">Estoque de tecido disponível</button>`+'</nav>'+
      '<details class="faction-access"><summary>Ordens atribuídas</summary><div class="fw-tabs fw-faction-tabs">'+options+'</div></details></aside><div class="faction-stage-content">'+body+'</div></div>';

  }

  function openDialog(title, contents, extraClass='') {
    const dialog=document.createElement('dialog');
    dialog.className='fw-recipe-dialog '+extraClass;
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
          if(kind==='confirm-lot') {
            const lot=form.elements.lot.selectedOptions[0];
            await rpc('fabric_faction_confirm_lot',{
              p_org:state.org,p_lot:values.lot,p_item:values.item,p_previous:Number(lot.dataset.onhand),
              p_counted:Number(values.meters),p_request:values.request
            });
          } else if(kind==='manual-item') {
            await rpc('fabric_faction_manual_item',{p_org:state.org,p_recipe:values.recipe,p_pieces:Number(values.quantity),p_request:values.request});
          } else if(kind==='remove-item') {
            await rpc('fabric_faction_remove_item',{p_org:state.org,p_item:values.id});
            selected.delete(values.id);
            draft.delete(values.id);
            cutSelected.delete(values.id);
          } else if(kind==='faction-delivery') {
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
          } else if(kind==='group-plan') {
            const lines=[...form.querySelectorAll('[data-plan-entry]')].flatMap(entry=>{
              const quantity=Number(entry.querySelector('input').value);
              const [order_item_id,lot_id]=entry.querySelector('select').value.split(':');
              return quantity?[{id:entry.dataset.planEntry,order_item_id,lot_id,pieces:quantity}]:[];
            });
            if(!lines.length)throw Error('Informe as peças a cortar.');
            await groupRpc('plan',values.id,lines);
            lines.forEach(line=>{draft.delete(line.order_item_id);cutSelected.delete(line.order_item_id);});
          } else if(kind==='group-split') {
            const lines=[...form.querySelectorAll('[data-split-source]')].flatMap(input=>Number(input.value)>0?[{
              id:input.dataset.line,source:input.dataset.splitSource,group_id:input.dataset.destination,pieces:Number(input.value)
            }]:[]);
            await groupRpc('split',values.id,lines);
          } else if(kind==='group-finish') {
            const lines=[...form.querySelectorAll('[data-finish-id]')].map(input=>({
              id:input.dataset.finishId,pieces:Number(input.value),consumed_m:Number(values['meters-'+input.dataset.finishId]),notes:values.notes
            }));
            await groupRpc('finish',values.id,lines);
          } else if(kind==='group-cancel'||kind==='group-dispatch') {
            await groupRpc(kind.slice(6),values.id,[],values);
          } else if(kind==='group-delivery') {
            const lines=[...form.querySelectorAll('[data-delivery-id]')].flatMap(input=>{
              const accepted=Number(input.value),rejected=Number(values['rejected-'+input.dataset.deliveryId]);
              return accepted||rejected?[{id:input.dataset.deliveryId,accepted,rejected}]:[];
            });
            if(!lines.length)throw Error('Informe as quantidades entregues.');
            const cuts=groupCuts(values.id);
            if(lines.some(line=>{const cut=cuts.find(c=>c.id===line.id);return !cut||line.accepted+line.rejected>cut.produced_pieces-accounted(cut);})) {
              throw Error('A soma das peças aceitas e rejeitadas deve caber no saldo da linha.');
            }
            const file=values.invoice;
            if(!file||file.size>5242880||!file.name.toLowerCase().endsWith('.pdf'))throw Error('Selecione a nota fiscal em PDF de até 5 MB.');
            await rpc('fabric_faction_delivery',{p_org:state.org,p_group:values.id,p_id:values.requestId,p_on:values.delivered_on,
              p_name:file.name,p_pdf:await toBase64(file),p_lines:lines,p_notes:values.notes});
          } else {
            form.dataset.fwForm=kind;
            try {await submit(form);}
            finally {delete form.dataset.fwForm;}
          }
          recorded=true;
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

  function groupPlan(orders) {
    const selectedOrders=activeOrders(orders);
    const choices=selectedOrders.flatMap(row=>row.lots.filter(lot=>maxInLot(row,lot)>0).map(lot=>({
      value:row.item.id+':'+lot.id, label:row.item.product_name+' · '+lot.lot_code, maximum:maxInLot(row,lot), unit:row.unit
    })));
    if(!choices.length)return openDialog('Gerar mapa e lote de corte','<p>Reserve tecido para pelo menos uma ordem na Provisão.</p>');
    const seeds=[...draft].filter(([id,saved])=>saved.quantity>0&&cutSelected.has(id)&&choices.some(c=>c.value===id+':'+saved.lot));
    if(!seeds.length)return openDialog('Gerar mapa e lote de corte','<p>Selecione os produtos e informe a quantidade a cortar na tabela.</p>');
    const dialog=openDialog('Gerar mapa e lote de corte',`<form data-faction-form="group-plan"><input type="hidden" name="id" value="${uid()}">
      <div data-plan-list></div><button type="button" data-plan-add>+ Produto ou rolo</button><button>Gerar mapa e lote</button></form>`);
    const list=dialog.querySelector('[data-plan-list]');
    const add=(value='',qty='')=>{
      list.insertAdjacentHTML('beforeend',`<fieldset data-plan-entry="${uid()}"><label class="fw-field">Produto e rolo
        <select required>${choices.map(choice=>`<option value="${esc(choice.value)}" ${choice.value===value?'selected':''}>${esc(choice.label)}</option>`).join('')}</select></label>
        <label class="fw-field">Quantidade<input type="number" min="1" step="1" value="${qty||''}" required></label>
        <output></output> <button type="button" data-plan-remove>Remover</button></fieldset>`);
      const entry=list.lastElementChild, select=entry.querySelector('select'), quantity=entry.querySelector('input');
      const update=()=>{
        const choice=choices.find(choice=>choice.value===select.value);
        quantity.max=choice.maximum;
        entry.querySelector('output').textContent=meters(Number(quantity.value||0)*choice.unit)+' · máximo '+pieces(choice.maximum);
      };
      select.onchange=update;quantity.oninput=update;update();
      entry.querySelector('[data-plan-remove]').onclick=()=>{if(list.children.length>1)entry.remove();};
    };
    for(const [id,saved] of seeds)add(id+':'+saved.lot,saved.quantity);
    dialog.querySelector('[data-plan-add]').onclick=()=>add();
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
            const key='faction-reserve:'+row.item.id+':'+lot.id+':'+revision+':'+qty;
            const result=state.canReserveFaction?await rpc('fabric_faction_reservation',{
              p_org:state.org,p_lot:lot.id,p_item:row.item.id,p_action:'RESERVA',p_meters:qty,p_key:key
            }):await rpc('fabric_post_stock_movement',{
              p_organization_id:state.org,p_lot_id:lot.id,p_movement_type:'RESERVA',p_quantity_m:qty,
              p_order_item_id:row.item.id,p_idempotency_key:key,p_notes:'Reserva para corte no Portal da Facção'
            });
            remaining=round(remaining-qty);
            free.set(lot.id,round(free.get(lot.id)-qty));
            if(result?.created!==false)posted=round(posted+qty);
          }
        }
      } catch (error) {
        await reload();
        throw Error(posted?`${meters(posted)} processados antes da interrupção. ${error.message}`:error.message);
      }
      if(!posted){
        if(rows.some(row=>row.needed>row.reserved))
          throw Error('As ordens selecionadas estão sem saldo livre em rolos. Use Conferir rolo na ordem para liberar um saldo físico de lote antigo.');
        throw Error('As ordens selecionadas já estão cobertas.');
      }
      selected.clear();
      state.notice='Reserva processada. Confira os saldos por ordem.';
    });
  }

  function download(content,name,type) {
    const blob=new Blob([content],{type}), url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download=name;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }

  function showDocuments(doc) {
    const dialog=openDialog('Documentos da entrega',`<p>${dateLabel(doc.delivered_on)} · ${esc(doc.filename)}</p>
      <div class="fw-tabs"><button type="button" data-document-pdf>Baixar nota fiscal</button><button type="button" data-document-cut>Baixar relatório de corte</button>
      <button type="button" data-document-stock>Baixar relatório de recebimento</button></div>`);
    dialog.querySelector('[data-document-pdf]').onclick=async()=>{
      const error=dialog.querySelector('[data-faction-error]');
      try {
        const data=await rpc('fabric_faction_pdf',{p_org:state.org,p_id:doc.id});
        if(!data)throw Error('Nota fiscal indisponível.');
        download(Uint8Array.from(atob(data),char=>char.charCodeAt(0)),doc.filename,'application/pdf');
      } catch(failure){error.textContent=failure.message;error.hidden=false;}
    };
    const csv=(fields,name)=>{
      const cell=value=>'"'+String(typeof value==='string'&&/^\s*[=+@-]/.test(value)?"'"+value:value??'').replaceAll('"','""')+'"';
      const rows=(doc.report||[]).map(row=>fields.map(field=>cell(row[field])).join(';'));
      download('\uFEFF'+[fields.join(';'),...rows].join('\r\n'),name,'text/csv;charset=utf-8');
    };
    dialog.querySelector('[data-document-cut]').onclick=()=>csv(['ordem','produto','referencia','lote','origem','rolo','tecido','previstas','cortadas','previsto_m','real_m','liberado_m','adicional_m'],'relatorio-corte.csv');
    dialog.querySelector('[data-document-stock]').onclick=()=>csv(['ordem','produto','referencia','lote','aceitas','rejeitadas','saldo_lote','aceitas_os'],'relatorio-recebimento.csv');
  }

  function groupAction(action,id,orders) {
    const group=groupRows(id), cuts=groupCuts(id);
    if(!group.length)return;
    const hidden=`<input type="hidden" name="id" value="${esc(id)}">`;
    const label=plan=>{
      const row=orders.find(row=>row.item.id===plan.order_item_id);
      const lot=state.lots.find(lot=>lot.id===plan.lot_id);
      return (row?product(row):'Produto')+' · rolo '+esc(lot?.lot_code||'—');
    };
    if(action==='group-map')return openDialog('Mapa de corte · '+esc(id.slice(0,8)),
      table(['Produto / rolo','Peças previstas','Reserva','Cortadas','Consumo real'],group.map(plan=>{
        const cut=cuts.find(cut=>cut.id===plan.cut_id);
        return `<tr><td>${label(plan)}</td><td>${pieces(plan.pieces)}</td><td>${meters(plan.reserved_m)}</td><td>${cut?pieces(cut.produced_pieces):'—'}</td><td>${cut?meters(cut.consumed_m):'—'}</td></tr>`;
      }).join(''),'Nenhuma linha.'));
    if(action==='group-start')return run(()=>groupRpc('start',id));
    if(action==='group-cancel')return openDialog('Cancelar lote',
      `<form data-faction-form="group-cancel">${hidden}<label class="fw-field">Motivo<input name="notes" required maxlength="500"></label><button>Cancelar lote</button></form>`);
    if(action==='group-finish')return openDialog('Finalizar corte',`<form data-faction-form="group-finish">${hidden}
      ${group.map(plan=>`<fieldset><legend>${label(plan)}</legend>
        <label class="fw-field">Peças cortadas<input type="number" data-finish-id="${esc(plan.id)}" name="pieces-${esc(plan.id)}" min="0" max="${plan.pieces}" step="1" value="${plan.pieces}" required></label>
        <label class="fw-field">Consumo real (m)<input type="number" name="meters-${esc(plan.id)}" min="0" step=".001" value="${plan.reserved_m}" required></label></fieldset>`).join('')}
      <label class="fw-field">Justificativa se houver diferença<input name="notes" maxlength="500"></label><button>Finalizar corte</button></form>`);
    if(action==='group-dispatch'&&cuts.length) {
      const cut=cuts[0];
      return openDialog('Envio e previsão da facção',`<form data-faction-form="group-dispatch">${hidden}
        <label class="fw-field">Facção<select name="supplier_id" required>${supplierOptionList(cut.supplier_id)}</select></label>
        <label class="fw-field">Envio<input name="sent_date" type="date" value="${esc(cut.sent_date||today())}" required></label>
        <label class="fw-field">Previsão<input name="expected_date" type="date" value="${esc(cut.expected_date||'')}"></label>
        <label class="fw-field">Justificativa ao alterar o prazo padrão<input name="notes" value="${esc(cut.notes||'')}"></label><button>Salvar envio e previsão</button></form>`);
    }
    if(action==='group-delivery') {
      const rows=cuts.filter(cut=>cut.produced_pieces>accounted(cut)).map(cut=>{
        const left=cut.produced_pieces-accounted(cut);
        const plan=group.find(plan=>plan.cut_id===cut.id);
        const accepted=sum(deliveries(cut),record=>record.accepted_pieces);
        return `<tr><td>${label(plan)}</td><td>${pieces(cut.produced_pieces)}</td><td>${pieces(accepted)}</td><td>${pieces(left)}</td>
          <td><input type="number" name="accepted-${esc(cut.id)}" data-delivery-id="${esc(cut.id)}" aria-label="Entregar agora · ${esc(cut.id.slice(0,8))}" min="0" max="${left}" step="1" value="${left}" required></td>
          <td><input type="number" name="rejected-${esc(cut.id)}" aria-label="Rejeitadas · ${esc(cut.id.slice(0,8))}" min="0" max="${left}" step="1" value="0" required></td></tr>`;
      }).join('');
      return openDialog('Entrega parcial ou integral · '+esc(id.slice(0,8)),`<form data-faction-form="group-delivery">${hidden}
        <input name="requestId" type="hidden" value="${uid()}">
        ${table(['Produto / rolo','Cortadas','Já entregues','Pendentes','Entregar agora','Rejeitadas'],rows,'O lote está concluído.')}
        <label class="fw-field">Data efetiva da entrega<input type="date" name="delivered_on" value="${today()}" max="${today()}" required></label>
        <label class="fw-field">Nota fiscal em PDF<input type="file" name="invoice" accept=".pdf,application/pdf" required></label>
        <label class="fw-field">Observação<input name="notes" maxlength="1000"></label>
        <p>O pacote reúne a nota fiscal, o relatório de corte e o relatório de recebimento.</p><button>Confirmar entrega</button></form>`);
    }
    if(action==='group-split') {
      const dialog=openDialog('Fracionar lote',`<form data-faction-form="group-split">${hidden}<div data-split-list></div>
        <p data-part-saldo role="status"></p><button type="button" data-add-part>+ Novo lote</button><button>Confirmar fracionamento</button></form>`);
      const list=dialog.querySelector('[data-split-list]'), status=dialog.querySelector('[data-part-saldo]');
      const update=()=>{
        const fields=[...list.querySelectorAll('input')];
        const remaining=group.map(plan=>plan.pieces-fields.filter(input=>input.dataset.splitSource===plan.id).reduce((total,input)=>total+Number(input.value),0));
        status.textContent=remaining.map((left,index)=>'Linha '+(index+1)+': '+pieces(left)+' por distribuir').join(' · ');
        const populated=new Set(fields.filter(input=>Number(input.value)>0).map(input=>input.dataset.destination));
        fields.at(-1).setCustomValidity(remaining.every(left=>left===0)&&populated.size>=2?'':'Distribua todas as peças em pelo menos dois lotes.');
        for(const fieldset of list.children)fieldset.querySelector('output').textContent=meters([...fieldset.querySelectorAll('input')].reduce((total,input,index)=>total+Number(input.value)*Number(group[index].unit_m),0))+' previstos';
      };
      const add=()=>{
        for(const field of list.querySelectorAll('input'))field.setCustomValidity('');
        const destination=uid();
        list.insertAdjacentHTML('beforeend',`<fieldset><legend>Lote ${list.children.length+1}</legend>${group.map((plan,index)=>`<label class="fw-field">Linha ${index+1} · ${label(plan)}
          <input name="part" data-split-source="${esc(plan.id)}" data-line="${uid()}" data-destination="${destination}" type="number" min="0" max="${plan.pieces}" step="1" value="0"></label>`).join('')}<output></output></fieldset>`);
        dialog.querySelector('[data-add-part]').disabled=list.children.length>=30;
        update();
      };
      list.oninput=update;
      dialog.querySelector('[data-add-part]').onclick=add;
      add();add();
    }
  }

  function confirmLot(row) {
    const candidates=historicalBalances().filter(lot=>lot.quality_status==='APROVADO'&&lot.onhand>0&&fabricMatches(lot.fabric_id,row.item.fabric_id));
    if(!candidates.length)return openDialog('Conferir rolo','<p>Nenhum lote antigo aprovado e compatível foi encontrado para este tecido. Se o rolo ainda não está no cadastro, registre o recebimento antes de reservar.</p>');
    const options=candidates.map(lot=>`<option value="${esc(lot.id)}" data-onhand="${lot.onhand}" data-reserved="${lot.reserved}">${esc(lot.lot_code)} · ${meters(lot.onhand)} registrados</option>`).join('');
    const dialog=openDialog('Conferir rolo para corte',`<p>${product(row)}</p>
      <form data-faction-form="confirm-lot">
      <input type="hidden" name="item" value="${esc(row.item.id)}">
      <input type="hidden" name="request" value="${esc(uid())}">
      <label class="fw-field">Lote cadastrado<select name="lot" required><option value="">Selecione o lote da etiqueta</option>${options}</select></label>
      <label class="fw-field">Saldo físico do rolo em metros<input name="meters" type="number" min="0" step=".001" required></label>
      <label class="fw-field"><input type="checkbox" required> Conferi a etiqueta, a cor e a metragem deste rolo na facção.</label>
      <p>O saldo conferido ficará disponível para reserva, descontadas as reservas já feitas. A diferença para o cadastro será registrada no histórico do lote.</p>
      <button type="submit">Confirmar saldo do rolo</button></form>`);
    const fields=dialog.querySelector('form').elements;
    fields.lot.onchange=()=>{
      const lot=fields.lot.selectedOptions[0];
      fields.meters.value='';
      fields.meters.min=lot.dataset.reserved||'0';
      fields.meters.max=lot.dataset.onhand||'';
    };
  }

  function handleAction(trigger) {
    const {factionAction:action,factionId:id}=trigger.dataset;
    if(action==='reserve')return reserve();
    if(action==='inventory'&&state.canOperateFaction&&!state.factionInventoryError){
      const dialog=openDialog('Lançar inventário de tecidos',factionInventoryForm(),'fw-inventory-dialog');
      const lines=dialog.querySelector('[data-inventory-lines]');
      const add=dialog.querySelector('[data-inventory-add]');
      lines.onclick=event=>{
        const remove=event.target.closest('[data-inventory-remove]');
        if(remove&&lines.children.length>1){
          remove.closest('[data-inventory-line]').remove();
          add.focus();
        }
      };
      add.onclick=()=>{
        if(lines.children.length>=500)return;
        lines.append(dialog.querySelector('template[data-inventory-template]').content.cloneNode(true));
        lines.lastElementChild.querySelector('input').focus();
      };
      return;
    }
    if(action==='manual-item'&&state.canOperateFaction){
      if(!state.loaded||state.factionCatalogError)
        return openDialog('Adicionar produto','<p>Não foi possível carregar as fichas da facção. Feche a janela e clique em Atualizar dados.</p>');
      const options=state.recipes.filter(recipe=>recipe.active&&state.fabric.some(fabric=>fabric.id===recipe.fabric_id&&fabric.active))
        .slice().sort((a,b)=>a.product_name.localeCompare(b.product_name,'pt-BR')).map(recipe=>{
          const fabric=state.fabric.find(row=>row.id===recipe.fabric_id);
          const label=[recipe.product_name,recipe.product_reference,internalName(fabric),fabric.color_reference,br(recipe.consumption_m_per_piece,4)+' m/peça'].filter(Boolean).join(' · ');
          return `<option value="${esc(recipe.id)}">${esc(label)}</option>`;
        }).join('');
      if(!options)return openDialog('Adicionar produto','<p>Cadastre primeiro uma ficha técnica ativa vinculada a um tecido ativo.</p>');
      return openDialog('Adicionar produto',`<form data-faction-form="manual-item">
        <input type="hidden" name="request" value="${esc(uid())}">
        <label class="fw-field">Produto e ficha técnica<select name="recipe" required><option value="">Selecione</option>${options}</select></label>
        <label class="fw-field">Quantidade de peças<input type="number" name="quantity" min="1" max="2147483647" step="1" required></label>
        <button type="submit">Criar OS manual</button></form>`);
    }
    const orders=getOrders();
    if(action==='confirm-lot'&&state.canOperateFaction&&(state.canReserveFaction||state.canViewInventory)){
      const row=orders.find(({item})=>item.id===id);
      if(row)return confirmLot(row);
      return;
    }
    if(action==='request-selected') {
      const rows=activeOrders(orders).filter(row=>selected.has(row.item.id)&&row.fabric);
      if(!rows.length)return openDialog('Solicitar faltantes','<p>Selecione as ordens de produção na Provisão.</p>');
      const shortage=rows.reduce((groups,row)=>{
        const group=groups.find(group=>fabricMatches(group.fabric.id,row.fabric.id));
        const uncovered=Math.max(0,row.needed-row.reserved);
        if(group){group.need+=uncovered;group.orders.push(row);}
        else groups.push({fabric:row.fabric,need:uncovered,coverage:row.available+row.incoming,orders:[row]});
        return groups;
      },[]).filter(group=>round(group.need-group.coverage)>0);
      const dialog=openDialog('Solicitar faltantes',table(['Tecido','Ordens','Faltam','Ação'],shortage.map((group,index)=>
        `<tr><td>${esc(internalName(group.fabric))}</td><td>${group.orders.map(row=>esc(row.order.order_number)).join(', ')}</td>
         <td>${meters(round(group.need-group.coverage))}</td><td><button type="button" data-shortage-index="${index}">Preparar pedido</button></td></tr>`
      ).join(''),'O saldo e os pedidos a receber cobrem as ordens selecionadas.'));
      for(const control of dialog.querySelectorAll('[data-shortage-index]'))control.onclick=()=>{
        const group=shortage[Number(control.dataset.shortageIndex)];
        dialog.close();
        openFabricPurchaseDraft({fabric:group.fabric,missing:round(group.need-group.coverage)},{
          source_item:group.orders.map(row=>'OS '+row.order.order_number).join(', '),
          product_name:group.orders.map(row=>row.item.product_name).join(', ')
        });
      };
      return;
    }
    if(action==='group-plan')return groupPlan(orders);
    if(action.startsWith('group-'))return groupAction(action,id,orders);
    if(action==='documents') {
      const doc=(state.deliveryDocuments||[]).find(row=>row.id===id);
      if(doc)return showDocuments(doc);
      return;
    }
    const row=orders.find(o=>o.item.id===id||o.cuts.some(cut=>cut.id===id));
    if(!row)return;
    if(action==='remove-item'&&state.canOperateFaction&&!hasProductionHistory(row.item.id)){
      return openDialog('Excluir item da provisão',`<form data-faction-form="remove-item">
        <input type="hidden" name="id" value="${esc(row.item.id)}">
        <p>${product(row)}</p><p>Confirme a exclusão deste item da programação. O Portal preserva o registro da exclusão para auditoria.</p>
        <button type="submit">Confirmar exclusão</button></form>`);
    }
    const cut=row.cuts.find(cut=>cut.id===id);
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
    for(const field of page.querySelectorAll('[data-sewing-due]')) {
      field.onchange=()=>run(()=>rpc('fabric_faction_sewing_due',{p_org:state.org,p_group:field.dataset.sewingDue,p_due:field.value||null}));
    }
    for(const field of page.querySelectorAll('[data-provision-quantity]')) {
      const estimate=field.closest('tr').querySelector('[data-provision-estimate]');
      field.oninput=()=>{estimate.textContent=field.validity.valid?meters(Number(field.value)*Number(estimate.dataset.unit)):'—';};
      field.onchange=()=>{
        if(!field.reportValidity())return;
        run(()=>rpc('fabric_faction_order_quantity',{p_org:state.org,p_item:field.dataset.provisionQuantity,p_quantity:Number(field.value)}));
      };
    }
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
      const checkbox=line.querySelector('[data-cut-select]');
      const save=()=>draft.set(line.dataset.factionLine,{lot:roll.value,quantity:Number(qty.value)||0});
      roll.onchange=()=>{save();render();};
      checkbox.onchange=()=>{if(checkbox.checked)cutSelected.add(line.dataset.factionLine);else cutSelected.delete(line.dataset.factionLine);};
      qty.oninput=()=>{save();checkbox.checked=Number(qty.value)>0;checkbox.onchange();line.querySelector('[data-faction-estimate]').textContent=meters(Number(qty.value)*Number(line.dataset.unit));};
    }
  }
  return {view,bind};
}
