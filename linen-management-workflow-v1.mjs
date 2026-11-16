import {localTimestamp} from './linen-operations-history-v1.mjs?v=1';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const date=value=>value?localTimestamp(value).replace(/^(\d{4})-(\d\d)-(\d\d)/,'$3/$2/$1'):'—';
const status={
  quarantine:'Em quarentena',rejected:'Reprovada em quarentena',approved:'Aguardando RFID',
  released:'RFID registrado',sewing:'Aguardando costura',repairing:'Em reparo',
  sewing_return:'Aguardando RFID de recuperação',discard_pending:'Aguardando baixa',discarded:'Descartada'
};
const locationName={depot:'Depósito',market:'Mercado'};
const actions={invoice:'Recepção de NF-e',spec:'Versão de ficha técnica',quality:'Parecer de qualidade',tag:'Cadastro RFID',
  inspect_used:'Avaliação de peça usada',sewing_receive:'Recebimento na costura',sewing_return:'Retorno da costura',
  discard:'Baixa para descarte',client_open:'Solicitação de cliente',client_separate:'Separação de peças',
  client_close:'Conclusão da comanda',sewing_sla:'Prazo da costura'};
const field=(name,label,type='text',attrs='')=>'<label>'+label+'<input name="'+name+'" type="'+type+'" '+attrs+'></label>';
const select=(name,label,options,selected)=>'<label>'+label+'<select name="'+name+'" required><option value="">Selecione</option>'+
  options.map(([value,title])=>'<option value="'+esc(value)+'" '+(String(value)===String(selected)?'selected':'')+'>'+esc(title)+'</option>').join('')+'</select></label>';
const note=(name,label,required=true)=>'<label>'+label+'<textarea name="'+name+'" rows="2" maxlength="1500" '+(required?'required':'')+'></textarea></label>';
const form=(action,fields,label,saving,attrs='')=>'<form data-leo-workflow="'+action+'" '+attrs+'>'+fields+'<button '+(saving?'disabled':'')+'>'+label+'</button></form>';
const hidden=(name,value)=>'<input name="'+name+'" type="hidden" value="'+esc(value)+'">';
const itemInput=item=>hidden('item',item.id)+hidden('version',item.version);
const card=(title,body)=>'<section class="leo-card">'+(title?'<h3>'+title+'</h3>':'')+body+'</section>';
const group=(title,items,render)=>card(title,items.length?items.map(render).join(''):'<p>Nenhum registro nesta etapa.</p>');
const table=(columns,rows)=>rows.length?'<div class="leo-scroll"><table><thead><tr>'+columns.map(title=>'<th>'+title+'</th>').join('')+
  '</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(col=>'<td>'+esc(col)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<p>Nenhum registro nesta etapa.</p>';
const productOf=item=>item.product?.name||item.product_id||'';
const nameOf=item=>productOf(item)+' · '+(item.legacy_identifier||item.id);
const details=(title,body)=>'<details class="leo-record"><summary>'+esc(title)+'</summary>'+body+'</details>';
const link=(url,title)=>'<a class="leo-link" href="'+url+'">'+title+'</a>';
const dimensions=[['width','Largura (cm)'],['length','Comprimento (cm)'],['weight','Peso (g)'],['grammage','Gramatura (g/m²)']];
const decimal='min="0.001" step="any" required';
const integer='min="1" step="1" required';
const sourceName=item=>item.invoice_id?'Peça nova':'Peça usada/recuperada';

export function workflowView(page,model,{canManage,canSew,saving,draft}){
  const {products=[],clients=[],items=[],specs=[],invoices=[],client_orders:orders=[],purchases=[],settings=[],audit=[],tags=[]}=model;
  const choices=products.map(p=>[p.id,p.code+' · '+p.name]);
  const product=(name='product',selected)=>select(name,'Produto do SGQ',choices,selected);
  const itemsIn=(...states)=>items.filter(item=>states.includes(item.status));
  const pieceFacts=item=>'<p>'+esc(sourceName(item))+' · '+esc(status[item.status])+' · '+esc(item.quantity)+' peça(s) · '+esc(date(item.created_at))+'</p>';
  const qualityFacts=item=>item.quality?'<p>Amostra '+esc(item.quality.sample)+' · '+esc(Number(item.quality.grammage).toLocaleString('pt-BR',{maximumFractionDigits:1,minimumFractionDigits:1}))+' g/m² · '+esc(item.quality.reason)+'</p>':'';
  const tagForm=item=>form('tag',itemInput(item)+field('chip','Novo RFID','text','maxlength="128" required')+
    (item.invoice_id?'':field('previousChip','RFID anterior, se identificado','text','maxlength="128"'))+
    select('destination','Destino',Object.entries(locationName))+
    select('readTest','Teste de leitura',[['passed','Leitura confirmada']]),'Registrar RFID',saving);
  const tagHistory=table(['RFID','Produto','Destino','Situação','Data'],tags.map(row=>[row.chip,row.item?.product?.name,
    locationName[row.destination],row.active?'Ativo':'Inativo',date(row.created_at)]));

  if(page==='recepcao'){
    const upload=canManage?card('Importar NF-e','<label>Arquivo XML <input type="file" data-leo-xml accept=".xml,text/xml,application/xml"></label>'+
      (draft?'<p>NF-e <strong>'+esc(draft.number)+'</strong> · '+esc(draft.issuer)+'<br>'+esc(draft.key)+'</p>'+
        form('invoice',draft.items.map(row=>'<fieldset><legend>'+esc(row.line+' · '+row.code+' · '+row.name)+'</legend><p>Quantidade no XML '+esc(row.amount+' '+row.unit)+'</p>'+
          product('product-'+row.line,products.find(p=>p.code===row.code)?.id)+field('quantity-'+row.line,'Peças conferidas','number',integer)+'</fieldset>').join(''),
          'Confirmar e enviar à quarentena',saving):'')+
      '<p>Confira cada item e vincule ao produto cadastrado. PDF e imagem dependem de integração de extração.</p>'):'';
    return upload+card('Recebimentos no SGQ',table(['NF-e','Fornecedor','Chave','Recebimento'],invoices.map(x=>[x.invoice_number,x.supplier,x.access_key,date(x.created_at)])));
  }
  if(page==='ficha'){
    const create=canManage?card('Nova versão de ficha',form('spec',product()+field('color','Cor de referência','text','maxlength="120" required')+
      dimensions.map(([key,label])=>'<fieldset><legend>'+label+'</legend>'+field(key+'Min','Mínimo','number',decimal)+field(key+'Max','Máximo','number',decimal)+'</fieldset>').join(''),
      'Salvar versão',saving)+'<p>Cadastre os limites homologados para peças planas, medidos em uma peça aberta e sem embalagem.</p>'):'';
    return create+group('Fichas cadastradas',specs,row=>details(productOf(row)+' · versão '+row.version,
      '<p>Cor '+esc(row.limits.color)+' · '+esc(date(row.created_at))+'</p>'+
      table(['Medida','Mínimo','Máximo'],dimensions.map(([key,label])=>[label,row.limits[key+'Min'],row.limits[key+'Max']]))));
  }
  if(page==='quarentena')return group('Peças aguardando parecer',itemsIn('quarantine','rejected'),item=>{
    const available=specs.filter(row=>row.product_id===item.product_id);
    const editor=canManage?(available.length?form('quality',itemInput(item)+select('spec','Ficha técnica',available.map(row=>[row.id,'Versão '+row.version]),available[0].id)+
      field('sample','Identificação da amostra','text','required maxlength="150"')+dimensions.slice(0,3).map(([key,label])=>field(key,label,'number',decimal)).join('')+
      '<label>Gramatura calculada<output></output></label>'+field('color','Cor observada','text','required maxlength="120"')+
      select('decision','Parecer',[['approve','Aprovar'],['reject','Reprovar']])+note('reason','Condição e observações de qualidade')+
      field('evidence','Referência da evidência','text','maxlength="500"'),'Salvar parecer',saving,'data-leo-measure'):'<p>Cadastre os limites do produto na tela Ficha técnica.</p>'):'';
    return details(nameOf(item),pieceFacts(item)+qualityFacts(item)+editor);
  });
  if(page==='rfid'||page==='retorno'){
    const isReturn=page==='retorno';
    return group(isReturn?'Peças devolvidas pela costura':'Peças novas aprovadas',itemsIn(isReturn?'sewing_return':'approved'),item=>
      details(nameOf(item),pieceFacts(item)+qualityFacts(item)+'<p>RFID registrado em '+esc(item.released)+' de '+esc(item.quantity)+' peça(s).</p>'+
      (isReturn?'<p>Serviço '+esc(item.repair)+' · condição utilizável</p>':'')+(canManage?tagForm(item):'')))+
      (!isReturn?card('Histórico de RFID e destino',tagHistory)+card('Integração RFID','<p>A unicidade é verificada nos cadastros deste módulo. A publicação no sistema RFID externo e a disponibilização na posição física dependem da integração com esse cadastro.</p>'):'');
  }
  if(page==='chip'){
    const entry=canManage?card('Avaliar peça usada',form('inspect_used',product()+field('piece','Identificação permanente da peça','text','required maxlength="150"')+
      select('chipCondition','Condição do chip',[['missing','Sem chip'],['dead','Chip morto']])+
      select('destination','Encaminhamento',[['sewing','Costura'],['discard_pending','Avaliar descarte']])+note('reason','Condição observada'),
      'Registrar encaminhamento',saving)):'';
    return entry+card('Peças avaliadas',table(['Peça','Produto','Chip','Encaminhamento','Data'],items.filter(i=>i.chip_condition).map(i=>
      [i.legacy_identifier,productOf(i),i.chip_condition==='dead'?'Chip morto':'Sem chip',status[i.status],date(i.created_at)])));
  }
  if(page==='costura')return group('Ordens de recuperação',itemsIn('sewing','repairing'),item=>{
    const hours=Math.max(0,Math.floor((Date.now()-Date.parse(item.created_at))/3600000));
    const timing='<p>'+hours+' h desde o encaminhamento · '+(item.due_at?'Prazo '+esc(date(item.due_at)):'Prazo ainda não configurado')+
      (item.due_at&&Date.parse(item.due_at)<Date.now()?' <strong class="leo-alert">Em atraso</strong>':'')+'</p>';
    const editor=!canSew?'':item.status==='sewing'?form('sewing_receive',itemInput(item),'Receber peça',saving):
      form('sewing_return',itemInput(item)+note('repair','Serviço realizado')+select('condition','Condição após o serviço',[['utilizavel','Utilizável'],['sem_condicoes','Sem condição de uso']]),'Registrar devolução',saving);
    return details(nameOf(item),pieceFacts(item)+timing+editor);
  });
  if(page==='descarte')return group('Avaliações para descarte',itemsIn('discard_pending','discarded'),item=>details(nameOf(item),pieceFacts(item)+
    (item.status==='discard_pending'&&canManage?form('discard',itemInput(item)+note('reason','Justificativa da baixa'),'Confirmar baixa da peça',saving):'')))+
    card('Estoque e descarte','<p>Registre aqui peças retiradas de circulação para avaliação. A baixa encerra o registro individual e desativa o chip vinculado neste módulo. A baixa no RFID externo depende de integração.</p>');
  if(page==='cliente'){
    const create=canManage?card('Nova solicitação',form('client_open',select('client','Cliente',clients.map(row=>[row.id,row.name]))+product()+
      field('quantity','Peças solicitadas','number',integer),'Abrir solicitação',saving)):'';
    return create+group('Separação e comanda',orders,item=>details((item.client?.name||'Cliente')+' · '+productOf(item),
      '<p>Solicitadas '+esc(item.quantity)+' · Separadas '+esc(item.separated)+' · Faltantes '+esc(item.quantity-item.separated)+
        (item.completed_at?' · Comanda '+esc(item.waybill)+' · '+esc(item.weight)+' kg':'')+'</p>'+
      (item.completed_at||!canManage?'':item.separated<item.quantity?
        form('client_separate',itemInput(item)+field('quantity','Separar agora do depósito','number',integer+' max="'+(item.quantity-item.separated)+'"'),'Confirmar separação',saving):
        form('client_close',itemInput(item)+field('waybill','Número da comanda','text','required maxlength="100"')+field('weight','Peso líquido (kg)','number',decimal),
          'Concluir comanda',saving))));
  }
  if(page==='compras'){
    const missing=orders.filter(row=>!row.completed_at&&row.separated<row.quantity);
    return card('Necessidades para reposição',table(['Cliente','Produto','Saldo a separar'],missing.map(x=>[x.client?.name,productOf(x),x.quantity-x.separated]))+
      '<p>Confira pedidos em andamento antes de solicitar reposição.</p>'+link('/enxoval-tecidos','Enxoval e Tecidos')+
      link('/enxoval-tecidos/faccao','Portal da Facção'))+
      card('Pedidos de peças prontas no SGQ',table(['Pedido','Produto','Solicitadas','Recebidas','Situação'],purchases.map(row=>
        [row.order_number,row.product_name,row.ordered_pieces,row.received_pieces,row.status])));
  }
  if(page==='configuracoes')return card('Prazo da costura',canManage?
    form('sewing_sla',field('hours','Prazo em horas','number',integer+' max="8760" value="'+esc(settings[0]?.sewing_hours||'')+'"'),'Salvar prazo',saving):
    '<p>'+esc(settings[0]?.sewing_hours||'Não configurado')+'</p>')+card('Histórico das operações',table(['Data e hora','Operação','Registro','Responsável'],
    audit.map(row=>[date(row.created_at),actions[row.action]||row.action,row.record_id,row.responsible])));
  return '';
}
