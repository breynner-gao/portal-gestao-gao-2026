create table public.linen_management_specs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null references public.laundry_products(id),
  version integer not null,
  limits jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  unique(organization_id,product_id,version)
);
create table public.linen_management_invoices (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  access_key text not null check (access_key ~ '^[0-9]{44}$'),
  invoice_number text not null,
  supplier text not null,
  xml_document text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  unique(organization_id,access_key)
);
create table public.linen_management_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_id uuid not null references public.laundry_products(id),
  invoice_id uuid references public.linen_management_invoices(id),
  invoice_line integer,
  quantity integer not null check(quantity>0),
  released integer not null default 0 check(released between 0 and quantity),
  status text not null check(status in ('quarantine','rejected','approved','released','sewing','repairing','sewing_return','discard_pending','discarded')),
  chip_condition text,
  legacy_identifier text,
  spec_id uuid references public.linen_management_specs(id),
  quality jsonb,
  repair text,
  condition text,
  due_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  version integer not null default 1,
  unique(invoice_id,invoice_line),
  unique(organization_id,legacy_identifier)
);
create table public.linen_management_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  item_id uuid not null references public.linen_management_items(id),
  chip text not null,
  destination text not null check(destination in ('depot','market')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id)
);
create unique index linen_management_active_chip on public.linen_management_tags(organization_id,chip) where active;
create index linen_management_tag_item on public.linen_management_tags(item_id);
create table public.linen_management_settings (
  organization_id uuid primary key references public.organizations(id),
  sewing_hours integer not null check(sewing_hours between 1 and 8760)
);
create table public.linen_management_client_orders (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  client_id uuid not null references public.laundry_clients(id),
  product_id uuid not null references public.laundry_products(id),
  quantity integer not null check(quantity>0),
  separated integer not null default 0 check(separated between 0 and quantity),
  waybill text,
  weight numeric check(weight>0),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  version integer not null default 1
);
create index linen_management_client_orders_org on public.linen_management_client_orders(organization_id,client_id);
create table public.linen_management_audit (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  client_id uuid references public.laundry_clients(id),
  action text not null,
  record_id uuid,
  details jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  responsible text not null
);
create index linen_management_audit_org on public.linen_management_audit(organization_id,created_at desc,id);
create index linen_management_items_org on public.linen_management_items(organization_id,status,created_at desc);
do $$
declare t text;
begin
  foreach t in array array['linen_management_specs','linen_management_invoices','linen_management_items',
    'linen_management_tags','linen_management_settings','linen_management_client_orders','linen_management_audit']
  loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
    if t='linen_management_invoices' then
      grant select(id,organization_id,access_key,invoice_number,supplier,created_at,created_by)
        on public.linen_management_invoices to authenticated;
    else
      execute format('grant select on public.%I to authenticated',t);
    end if;
    execute format('create policy module_read on public.%I for select to authenticated using (public.fabric_user_has_permission(organization_id,%L)%s)',t,
      'textiles.inventory.view',case t when 'linen_management_client_orders' then ' and public.gao_can_access_laundry_client(client_id)'
      when 'linen_management_audit' then ' and (client_id is null or public.gao_can_access_laundry_client(client_id))' else '' end);
  end loop;
end;
$$;

create policy sewing_recovery_read on public.linen_management_items for select to authenticated using (
  status in ('sewing','repairing') and
  (public.fabric_user_has_permission(organization_id,'production.sewing.execute')
  or public.fabric_user_has_permission(organization_id,'production.sewing.view')));

create function private.linen_management_action(p_org uuid,p_event uuid,p_action text,p_data jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  item public.linen_management_items;
  spec public.linen_management_specs;
  log_row public.linen_management_audit;
  client_order public.linen_management_client_orders;
  actor uuid := auth.uid();
  actor_name text;
  product uuid;
  client uuid;
  record_key uuid;
  sku text;
  status_after text;
  old_data jsonb;
  audit_data jsonb := p_data-'xml' || jsonb_build_object('request_digest',md5(p_data::text));
  line jsonb;
  invoice_xml xml;
  v_quantity integer;
  deadline integer;
  measure text;
  measured numeric;
  measurement_values jsonb;
  width_cm numeric;
  length_cm numeric;
  weight_g numeric;
  compliant boolean;
  previous_chip text;
  destination text;
  snapshot_time timestamptz;
begin
  if actor is null or not (public.fabric_user_has_permission(p_org,'textiles.inventory.view')
    or (p_action in ('sewing_receive','sewing_return') and public.fabric_user_has_permission(p_org,'production.sewing.execute')))
  then raise exception 'Sem acesso à Gestão de Enxoval.' using errcode='42501'; end if;
  if p_action in ('sewing_receive','sewing_return') then
    if not (public.fabric_user_has_permission(p_org,'production.sewing.execute')
      or public.fabric_user_has_permission(p_org,'textiles.inventory.manage')
      or public.fabric_user_has_permission(p_org,'textiles.production.manage'))
    then raise exception 'Seu perfil não pode operar a costura.' using errcode='42501'; end if;
  elsif not public.fabric_user_has_permission(p_org,'textiles.inventory.manage')
  then raise exception 'Seu perfil não pode registrar esta operação.' using errcode='42501'; end if;
  if p_event is null or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Operação inválida.'; end if;
  select coalesce(nullif(full_name,''),username) into strict actor_name from public.profiles where id=actor and active;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text,154500));
  select * into log_row from public.linen_management_audit where id=p_event;
  if found then
    if log_row.organization_id=p_org and log_row.created_by=actor and log_row.action=p_action
      and log_row.details->>'request_digest'=md5(p_data::text)
      and (log_row.client_id is null or public.gao_can_access_laundry_client(log_row.client_id))
    then return log_row.record_id; end if;
    raise exception 'A referência já pertence a outra operação.';
  end if;
  product := nullif(p_data->>'product','')::uuid;
  if product is not null and not exists(select 1 from public.laundry_products where id=product and active)
  then raise exception 'Selecione um produto ativo do SGQ.'; end if;

  case p_action
  when 'invoice' then
    if coalesce(length(p_data->>'xml'),0) not between 1 and 2000000
      or p_data->>'xml' ~* '<!(DOCTYPE|ENTITY)'
      or jsonb_typeof(p_data->'lines') is distinct from 'array'
      or jsonb_array_length(p_data->'lines') not between 1 and 500
    then raise exception 'XML ou itens da NF-e inválidos.'; end if;
    invoice_xml := xmlparse(document (p_data->>'xml'));
    if (xpath('string(//*[local-name()="infNFe"]/@Id)',invoice_xml))[1]::text is distinct from 'NFe'||(p_data->>'key')
      or (xpath('string(//*[local-name()="ide"]/*[local-name()="nNF"])',invoice_xml))[1]::text is distinct from p_data->>'number'
      or cardinality(xpath('//*[local-name()="infNFe"]/*[local-name()="det"]',invoice_xml))<>jsonb_array_length(p_data->'lines')
    then raise exception 'A conferência deve corresponder ao XML da NF-e.'; end if;
    record_key := p_event;
    insert into public.linen_management_invoices(id,organization_id,access_key,invoice_number,supplier,xml_document,created_by)
    values(record_key,p_org,p_data->>'key',p_data->>'number',p_data->>'supplier',p_data->>'xml',actor);
    for line in select value from jsonb_array_elements(p_data->'lines') loop
      product := (line->>'product')::uuid;
      v_quantity := (line->>'quantity')::integer;
      if coalesce(v_quantity,0)<=0 or coalesce((line->>'line')::integer,0) not between 1 and 999
        or not exists(select 1 from public.laundry_products where id=product and active)
      then raise exception 'Vincule todos os itens a produtos ativos e informe as peças conferidas.'; end if;
      if not xpath_exists(format('//*[local-name()="infNFe"]/*[local-name()="det"][@nItem="%s"]',(line->>'line')::integer),invoice_xml)
      then raise exception 'Item ausente no XML.'; end if;
      insert into public.linen_management_items(organization_id,product_id,invoice_id,invoice_line,quantity,status,created_by)
      values(p_org,product,record_key,(line->>'line')::integer,v_quantity,'quarantine',actor);
    end loop;
  when 'spec' then
    if product is null or nullif(btrim(p_data->>'color'),'') is null then raise exception 'Informe o produto e a cor de referência.'; end if;
    foreach measure in array array['width','length','weight','grammage'] loop
      if (p_data->>(measure||'Min'))::numeric is null or (p_data->>(measure||'Max'))::numeric is null
        or (p_data->>(measure||'Min'))::numeric<=0 or (p_data->>(measure||'Min'))::numeric>(p_data->>(measure||'Max'))::numeric
      then raise exception 'Informe limites positivos e em ordem para todas as medidas.'; end if;
    end loop;
    insert into public.linen_management_specs(organization_id,product_id,version,limits,created_by)
    select p_org,product,coalesce(max(version),0)+1,p_data-'product',actor
    from public.linen_management_specs where organization_id=p_org and product_id=product
    returning id into record_key;
  when 'sewing_sla' then
    insert into public.linen_management_settings(organization_id,sewing_hours)
    values(p_org,(p_data->>'hours')::integer)
    on conflict(organization_id) do update set sewing_hours=excluded.sewing_hours;
  when 'inspect_used' then
    if product is null or coalesce(p_data->>'chipCondition','') not in ('missing','dead')
      or nullif(btrim(p_data->>'reason'),'') is null or nullif(btrim(p_data->>'piece'),'') is null
      or coalesce(p_data->>'destination','') not in ('sewing','discard_pending')
    then raise exception 'Informe identificação permanente, produto, condição, avaliação e encaminhamento.'; end if;
    select sewing_hours into deadline from public.linen_management_settings where organization_id=p_org;
    select * into item from public.linen_management_items
    where organization_id=p_org and legacy_identifier=upper(btrim(p_data->>'piece'));
    if found then
      if item.status<>'released' or item.product_id<>product then raise exception 'A peça já está em avaliação, foi descartada ou tem outro produto vinculado.'; end if;
      record_key := item.id;
      old_data := to_jsonb(item);
      update public.linen_management_items set released=0,status=p_data->>'destination',
        chip_condition=p_data->>'chipCondition',condition=btrim(p_data->>'reason'),repair=null,
        due_at=case when p_data->>'destination'='sewing' then now()+make_interval(hours=>deadline) end,
        version=version+1 where id=record_key;
    else
      insert into public.linen_management_items(organization_id,product_id,quantity,status,chip_condition,legacy_identifier,condition,due_at,created_by)
      values(p_org,product,1,p_data->>'destination',p_data->>'chipCondition',upper(btrim(p_data->>'piece')),btrim(p_data->>'reason'),
        case when p_data->>'destination'='sewing' then now()+make_interval(hours=>deadline) end,actor)
      returning id into record_key;
    end if;
  when 'client_open' then
    client := (p_data->>'client')::uuid;
    if product is null or client is null or not public.gao_can_access_laundry_client(client)
      or not exists(select 1 from public.laundry_clients where id=client and active)
    then raise exception 'Selecione um cliente permitido e um produto ativo.'; end if;
    if exists(select 1 from public.linen_management_client_orders where organization_id=p_org and client_id=client and product_id=product and completed_at is null)
    then raise exception 'Já existe uma solicitação aberta para este cliente e produto.'; end if;
    record_key := p_event;
    insert into public.linen_management_client_orders(id,organization_id,client_id,product_id,quantity,created_by)
    values(record_key,p_org,client,product,(p_data->>'quantity')::integer,actor);
  when 'client_separate','client_close' then
    select * into client_order from public.linen_management_client_orders
      where id=(p_data->>'item')::uuid and organization_id=p_org and completed_at is null;
    if not found or not public.gao_can_access_laundry_client(client_order.client_id)
    then raise exception 'Solicitação em aberto indisponível.'; end if;
    if client_order.version is distinct from (p_data->>'version')::integer
    then raise exception 'A solicitação mudou. Atualize antes de confirmar.'; end if;
    client := client_order.client_id;
    record_key := client_order.id;
    old_data := to_jsonb(client_order);
    if p_action='client_separate' then
      v_quantity := (p_data->>'quantity')::integer;
      if coalesce(v_quantity,0)<=0 or v_quantity>client_order.quantity-client_order.separated
      then raise exception 'Quantidade acima do saldo da solicitação.'; end if;
      select 'ID:'||code into sku from public.laundry_products where id=client_order.product_id;
      select updated_at into snapshot_time from public.linen_rfid_snapshots where organization_id=p_org for share;
      update public.linen_eligible_stock set depot=depot-v_quantity where organization_id=p_org
        and snapshot_version=snapshot_time and product_key=sku and depot>=v_quantity;
      if not found then raise exception 'Saldo elegível insuficiente no depósito.'; end if;
      update public.linen_management_client_orders set separated=separated+v_quantity,version=version+1 where id=record_key;
    else
      if client_order.separated<>client_order.quantity or nullif(btrim(p_data->>'waybill'),'') is null or coalesce((p_data->>'weight')::numeric,0)<=0
      then raise exception 'Conclua a separação e informe comanda e peso positivo.'; end if;
      update public.linen_management_client_orders set completed_at=now(),waybill=btrim(p_data->>'waybill'),
        weight=(p_data->>'weight')::numeric,version=version+1 where id=record_key;
    end if;
  else
    select * into item from public.linen_management_items where id=(p_data->>'item')::uuid and organization_id=p_org;
    if not found then raise exception 'Registro indisponível.'; end if;
    if item.version is distinct from (p_data->>'version')::integer then raise exception 'O registro mudou. Atualize a tela.'; end if;
    record_key := item.id;
    old_data := to_jsonb(item);
    case p_action
    when 'quality' then
      if item.status not in ('quarantine','rejected') then raise exception 'Item fora da quarentena.'; end if;
      select * into spec from public.linen_management_specs
      where id=(p_data->>'spec')::uuid and organization_id=p_org and product_id=item.product_id;
      if not found then raise exception 'Selecione uma ficha técnica do produto.'; end if;
      width_cm := (p_data->>'width')::numeric;
      length_cm := (p_data->>'length')::numeric;
      weight_g := (p_data->>'weight')::numeric;
      if coalesce(width_cm,0)<=0 or coalesce(length_cm,0)<=0 or coalesce(weight_g,0)<=0
        or nullif(btrim(p_data->>'sample'),'') is null or nullif(btrim(p_data->>'reason'),'') is null
        or nullif(btrim(p_data->>'color'),'') is null or coalesce(p_data->>'decision','') not in ('approve','reject')
      then raise exception 'Informe amostra, medidas positivas, cor e parecer.'; end if;
      measurement_values := jsonb_build_object('width',width_cm,'length',length_cm,'weight',weight_g,
        'grammage',weight_g*10000/(width_cm*length_cm));
      compliant := lower(btrim(p_data->>'color'))=lower(btrim(spec.limits->>'color'));
      foreach measure in array array['width','length','weight','grammage'] loop
        measured := (measurement_values->>measure)::numeric;
        compliant := compliant and measured between (spec.limits->>(measure||'Min'))::numeric and (spec.limits->>(measure||'Max'))::numeric;
      end loop;
      if p_data->>'decision'='approve' and not compliant then raise exception 'A amostra está fora dos limites da ficha técnica.'; end if;
      update public.linen_management_items set status=case p_data->>'decision' when 'approve' then 'approved' else 'rejected' end,
        spec_id=spec.id,quality=p_data||measurement_values||jsonb_build_object('compliant',compliant),version=version+1
        where id=record_key;
    when 'tag' then
      if item.status not in ('approved','sewing_return') or item.released>=item.quantity
        or coalesce(upper(btrim(p_data->>'chip')),'') !~ '^[A-Z0-9-]{3,128}$'
        or coalesce(p_data->>'destination','') not in ('market','depot') or p_data->>'readTest' is distinct from 'passed'
        or (item.status='sewing_return' and item.condition<>'utilizavel')
      then raise exception 'Só é possível cadastrar uma peça liberada com teste de leitura e destino.'; end if;
      destination := p_data->>'destination';
      previous_chip := nullif(upper(btrim(p_data->>'previousChip')),'');
      if previous_chip is not null then
        if item.invoice_id is not null or exists(select 1 from public.linen_management_tags
          where organization_id=p_org and chip=previous_chip and active and item_id<>record_key)
        then raise exception 'O chip anterior pertence a outro cadastro.'; end if;
      end if;
      if item.invoice_id is null then
        update public.linen_management_tags set active=false where organization_id=p_org and item_id=record_key and active;
      end if;
      insert into public.linen_management_tags(organization_id,item_id,chip,destination,created_by)
      values(p_org,record_key,upper(btrim(p_data->>'chip')),destination,actor);
      update public.linen_management_items set released=released+1,
        status=case when released+1=quantity then 'released' else status end,version=version+1 where id=record_key;
    when 'sewing_receive' then
      if item.status<>'sewing' then raise exception 'A ordem já foi recebida ou mudou de situação.'; end if;
      update public.linen_management_items set status='repairing',version=version+1 where id=record_key;
    when 'sewing_return' then
      if item.status<>'repairing' or nullif(btrim(p_data->>'repair'),'') is null
        or coalesce(p_data->>'condition','') not in ('utilizavel','sem_condicoes')
      then raise exception 'Informe o serviço realizado e a condição da peça.'; end if;
      status_after := case p_data->>'condition' when 'utilizavel' then 'sewing_return' else 'discard_pending' end;
      update public.linen_management_items set status=status_after,repair=btrim(p_data->>'repair'),
        condition=p_data->>'condition',version=version+1 where id=record_key;
    when 'discard' then
      if item.status<>'discard_pending' or nullif(btrim(p_data->>'reason'),'') is null
      then raise exception 'Descarte indisponível ou sem justificativa.'; end if;
      update public.linen_management_tags set active=false where organization_id=p_org and item_id=record_key and active;
      update public.linen_management_items set status='discarded',version=version+1 where id=record_key;
    else raise exception 'Operação desconhecida.';
    end case;
  end case;

  insert into public.linen_management_audit(id,organization_id,client_id,action,record_id,details,created_by,responsible)
  values(p_event,p_org,client,p_action,record_key,audit_data||jsonb_build_object('before',old_data),actor,actor_name);
  return record_key;
end;
$$;

create function public.linen_management_action(p_org uuid,p_event uuid,p_action text,p_data jsonb)
returns uuid language sql security invoker set search_path='' as $$
  select private.linen_management_action(p_org,p_event,p_action,p_data);
$$;
revoke all on function private.linen_management_action(uuid,uuid,text,jsonb),public.linen_management_action(uuid,uuid,text,jsonb) from public,anon;
grant execute on function private.linen_management_action(uuid,uuid,text,jsonb),public.linen_management_action(uuid,uuid,text,jsonb) to authenticated;
