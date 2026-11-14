alter table public.fabric_faction_cut_plans add column group_id uuid;
create index faction_cut_group on public.fabric_faction_cut_plans(organization_id,group_id) where group_id is not null;

create function private.fabric_faction_group(p_org uuid,p_group uuid,p_action text,p_lines jsonb,p_options jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  line jsonb;
  plan public.fabric_faction_cut_plans;
  target uuid;
  part jsonb;
  group_count integer := 0;
  total numeric;
  next_reserve numeric;
  previous_reserve numeric;
  split_group record;
begin
  if auth.uid() is null or not public.fabric_user_has_permission(p_org,'textiles.production.manage') then
    raise exception 'Sem permissão para operar o lote.' using errcode='42501';
  end if;
  if p_group is null then raise exception 'Informe o lote.'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)>1000 then
    raise exception 'Linhas do lote inválidas.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_group::text,0));
  if p_action='plan' then
    if jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Selecione até 100 combinações de produto e rolo.'; end if;
    if exists(select 1 from public.fabric_faction_cut_plans a where a.organization_id=p_org and a.group_id=p_group) then return p_group; end if;
    perform 1 from public.fabric_production_order_items i where i.organization_id=p_org and i.id in
      (select (value->>'order_item_id')::uuid from jsonb_array_elements(p_lines)) order by i.id for update;
    perform 1 from public.fabric_lots l where l.organization_id=p_org and l.id in
      (select (value->>'lot_id')::uuid from jsonb_array_elements(p_lines)) order by l.id for update;
    for line in select value from jsonb_array_elements(p_lines) loop
      if exists(select 1 from public.fabric_faction_cut_plans p where p.id=(line->>'id')::uuid) then
        raise exception 'Identificação de linha já usada.';
      end if;
      target := private.fabric_faction_cut_plan(p_org,'plan',line);
      update public.fabric_faction_cut_plans set group_id=p_group where id=target and organization_id=p_org and group_id is null and parent_id is null;
      if not found then raise exception 'Linha já vinculada a outro lote.'; end if;
    end loop;
    return p_group;
  end if;

  if not exists(select 1 from public.fabric_faction_cut_plans p where p.organization_id=p_org and coalesce(p.group_id,p.id)=p_group) then
    raise exception 'Lote não encontrado.';
  end if;
  perform 1 from public.fabric_production_order_items i where i.organization_id=p_org and i.id in
    (select p.order_item_id from public.fabric_faction_cut_plans p where p.organization_id=p_org and coalesce(p.group_id,p.id)=p_group) order by i.id for update;
  perform 1 from public.fabric_lots l where l.organization_id=p_org and l.id in
    (select p.lot_id from public.fabric_faction_cut_plans p where p.organization_id=p_org and coalesce(p.group_id,p.id)=p_group) order by l.id for update;
  select count(*) into group_count from public.fabric_faction_cut_plans p where p.organization_id=p_org and coalesce(p.group_id,p.id)=p_group;
  if p_action='split' then
    if (select count(distinct value->>'group_id') from jsonb_array_elements(p_lines)) not between 2 and 30 then
      raise exception 'Distribua em 2 a 30 lotes.';
    end if;
    if exists(select 1 from public.fabric_faction_cut_plans p where p.organization_id=p_org and coalesce(p.group_id,p.id)=p_group and p.status='FRACIONADO') then
      if exists(select 1 from jsonb_array_elements(p_lines) a where not exists(
        select 1 from public.fabric_faction_cut_plans p where p.organization_id=p_org and p.id=(a.value->>'id')::uuid and p.parent_id=(a.value->>'source')::uuid)) then
        raise exception 'O lote já foi fracionado.';
      end if;
      return p_group;
    end if;
    if exists(select 1 from jsonb_array_elements(p_lines) a where not exists(
      select 1 from public.fabric_faction_cut_plans p where p.organization_id=p_org and coalesce(p.group_id,p.id)=p_group and p.id=(a.value->>'source')::uuid)) then
      raise exception 'Linha de origem inválida.';
    end if;
    for split_group in select value->>'group_id' id from jsonb_array_elements(p_lines) group by 1 loop
      if split_group.id is null or exists(select 1 from public.fabric_faction_cut_plans p where p.organization_id=p_org and coalesce(p.group_id,p.id)=split_group.id::uuid) then
        raise exception 'Identificação de novo lote inválida.';
      end if;
    end loop;
  elsif p_action='finish' and jsonb_array_length(p_lines)<>group_count then
    raise exception 'Informe o resultado de todas as linhas.';
  end if;
  for plan in select * from public.fabric_faction_cut_plans p where p.organization_id=p_org and coalesce(p.group_id,p.id)=p_group order by p.id for update loop
    if p_action in ('start','cancel') then
      perform private.fabric_faction_cut_plan(p_org,p_action,jsonb_build_object('id',plan.id,'notes',p_options->>'notes'));
    elsif p_action='finish' then
      select value into line from jsonb_array_elements(p_lines) where (value->>'id')::uuid=plan.id;
      if line is null then raise exception 'Linha de consumo ausente.'; end if;
      if (line->>'pieces')::integer=0 then
        if plan.status='CONCLUIDO' and plan.cut_id is null then continue; end if;
        if plan.status<>'INICIADO' or coalesce(trim(line->>'notes'),'')='' or (line->>'consumed_m')::numeric<0 then raise exception 'Justifique a linha sem produção.'; end if;
        if (line->>'consumed_m')::numeric<>round((line->>'consumed_m')::numeric,3) then raise exception 'Informe até três casas decimais.'; end if;
        update public.fabric_faction_cut_plans set status='CONCLUIDO',notes=line->>'notes',updated_at=now(),updated_by=auth.uid() where id=plan.id;
        perform public.fabric_post_stock_movement(p_org,plan.lot_id,'LIBERA_RESERVA',plan.reserved_m,plan.order_item_id,'group-zero-release:'||plan.id,'Encerramento da reserva sem peças');
        if (line->>'consumed_m')::numeric>0 then
          perform public.fabric_post_stock_movement(p_org,plan.lot_id,'AJUSTE_SAIDA',(line->>'consumed_m')::numeric,plan.order_item_id,'group-zero-use:'||plan.id,'Consumo sem peças cortadas');
        end if;
      else
        perform private.fabric_faction_cut_plan(p_org,'finish',line);
      end if;
    elsif p_action='dispatch' then
      if plan.cut_id is null then continue; end if;
      update public.fabric_cut_batches set supplier_id=(p_options->>'supplier_id')::uuid,
        sent_date=(p_options->>'sent_date')::date,expected_date=(p_options->>'expected_date')::date,notes=p_options->>'notes'
        where id=plan.cut_id and organization_id=p_org;
    elsif p_action='split' then
      if plan.status<>'PLANEJADO' then raise exception 'Só lotes ainda não iniciados podem ser fracionados.'; end if;
      total:=0; previous_reserve:=0;
      for part in select value from jsonb_array_elements(p_lines) where (value->>'source')::uuid=plan.id loop
        if coalesce((part->>'pieces')::integer,0)<=0 then raise exception 'Quantidade inválida.'; end if;
        total:=total+(part->>'pieces')::integer;
        if total>plan.pieces then raise exception 'Fracionamento acima da quantidade prevista.'; end if;
        next_reserve:=round(plan.reserved_m*total/plan.pieces,3);
        insert into public.fabric_faction_cut_plans(id,organization_id,order_item_id,lot_id,parent_id,group_id,pieces,unit_m,reserved_m)
          values((part->>'id')::uuid,p_org,plan.order_item_id,plan.lot_id,plan.id,(part->>'group_id')::uuid,(part->>'pieces')::integer,plan.unit_m,next_reserve-previous_reserve);
        previous_reserve:=next_reserve;
      end loop;
      if total<>plan.pieces then raise exception 'Distribua todas as peças de cada linha.'; end if;
      update public.fabric_faction_cut_plans set status='FRACIONADO',updated_at=now(),updated_by=auth.uid() where id=plan.id;
    else raise exception 'Operação de lote inválida.';
    end if;
  end loop;
  return p_group;
end;
$$;
revoke all on function private.fabric_faction_group(uuid,uuid,text,jsonb,jsonb) from public,anon;
grant execute on function private.fabric_faction_group(uuid,uuid,text,jsonb,jsonb) to authenticated;
create function public.fabric_faction_group(p_org uuid,p_group uuid,p_action text,p_lines jsonb,p_options jsonb)
returns uuid language sql security invoker set search_path='' as $$
  select private.fabric_faction_group(p_org,p_group,p_action,p_lines,p_options)
$$;
revoke all on function public.fabric_faction_group(uuid,uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.fabric_faction_group(uuid,uuid,text,jsonb,jsonb) to authenticated;

-- Record the invoice and report snapshot in the same transaction as the returns.
create table public.fabric_faction_delivery_documents (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  cut_group_id uuid not null,
  delivered_on date not null,
  filename text not null,
  report jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
);
alter table public.fabric_faction_delivery_documents enable row level security;
revoke all on public.fabric_faction_delivery_documents from public,anon,authenticated;
grant select on public.fabric_faction_delivery_documents to authenticated;
create policy faction_delivery_document_read on public.fabric_faction_delivery_documents for select to authenticated
  using(public.fabric_user_has_permission(organization_id,'textiles.inventory.view'));
create table private.fabric_faction_delivery_pdfs (
  id uuid primary key references public.fabric_faction_delivery_documents(id),
  content bytea not null
);
alter table private.fabric_faction_delivery_pdfs enable row level security;
revoke all on private.fabric_faction_delivery_pdfs from public,anon,authenticated;
alter table public.fabric_faction_returns add column delivery_document_id uuid references public.fabric_faction_delivery_documents(id);

create function private.fabric_faction_delivery(p_org uuid,p_group uuid,p_id uuid,p_on date,p_name text,p_pdf text,p_lines jsonb,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  line jsonb;
  roll public.fabric_faction_cut_plans;
  receipt uuid;
  report_lines jsonb;
  pdf bytea;
begin
  if auth.uid() is null or not public.fabric_user_has_permission(p_org,'textiles.production.manage') then
    raise exception 'Sem permissão para registrar entrega.' using errcode='42501';
  end if;
  if p_id is null or p_group is null or p_on is null or p_on>(now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Informe uma data de entrega válida.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_group::text,0));
  if exists(select 1 from public.fabric_faction_delivery_documents d where d.id=p_id and d.organization_id=p_org and d.cut_group_id=p_group) then return p_id; end if;
  if p_name is null or length(p_name)>180 or p_name!~* '\.pdf$' or p_pdf is null or length(p_pdf)>6990508 then
    raise exception 'Anexe a nota fiscal em PDF de até 5 MB.';
  end if;
  pdf:=decode(p_pdf,'base64');
  if octet_length(pdf)>5242880 or substring(pdf for 5)<>decode('255044462d','hex') then raise exception 'O anexo não é um PDF válido de até 5 MB.'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'Informe os itens entregues.'; end if;
  if jsonb_array_length(p_lines)<>(select count(distinct value->>'id') from jsonb_array_elements(p_lines)) then raise exception 'Linhas de entrega repetidas ou inválidas.'; end if;
  perform 1 from public.fabric_production_order_items i where i.organization_id=p_org and i.id in (
    select p.order_item_id from public.fabric_faction_cut_plans p where p.organization_id=p_org and coalesce(p.group_id,p.id)=p_group
  ) order by i.id for update;
  insert into public.fabric_faction_delivery_documents(id,organization_id,cut_group_id,delivered_on,filename,report)
    values(p_id,p_org,p_group,p_on,p_name,'{}');
  insert into private.fabric_faction_delivery_pdfs values(p_id,pdf);
  for line in select value from jsonb_array_elements(p_lines) loop
    select * into roll from public.fabric_faction_cut_plans p
      where p.organization_id=p_org and coalesce(p.group_id,p.id)=p_group and p.cut_id=(line->>'id')::uuid;
    if not found then raise exception 'Produto não pertence ao lote.'; end if;
    receipt:=private.fabric_faction_deliver_cut(p_org,roll.cut_id,gen_random_uuid(),(line->>'accepted')::integer,(line->>'rejected')::integer,p_notes);
    update public.fabric_faction_returns set delivery_document_id=p_id,returned_at=(p_on::timestamp at time zone 'America/Sao_Paulo')
      where id=receipt and organization_id=p_org;
  end loop;
  select jsonb_agg(jsonb_build_object(
    'ordem',o.order_number,'produto',i.product_name,'referencia',i.product_reference,
    'lote',coalesce(p.group_id,p.id),'origem',coalesce(parent.group_id,parent.id),'rolo',l.lot_code,'tecido',f.name,
    'previstas',p.pieces,'cortadas',coalesce(c.produced_pieces,0),'previsto_m',p.reserved_m,
    'real_m',coalesce(c.consumed_m,(select m.quantity_m from public.fabric_stock_movements m where m.organization_id=p_org and m.idempotency_key='group-zero-use:'||p.id),0),
    'liberado_m',greatest(0,p.reserved_m-coalesce(c.consumed_m,(select m.quantity_m from public.fabric_stock_movements m where m.organization_id=p_org and m.idempotency_key='group-zero-use:'||p.id),0)),
    'adicional_m',greatest(0,coalesce(c.consumed_m,(select m.quantity_m from public.fabric_stock_movements m where m.organization_id=p_org and m.idempotency_key='group-zero-use:'||p.id),0)-p.reserved_m),
    'aceitas',coalesce(r.accepted_pieces,0),'rejeitadas',coalesce(r.rejected_pieces,0),
    'saldo_lote',greatest(0,coalesce(c.produced_pieces,0)-(select coalesce(sum(rr.accepted_pieces+rr.rejected_pieces),0) from public.fabric_faction_returns rr where rr.cut_batch_id=c.id and rr.organization_id=p_org)),
    'aceitas_os', (select coalesce(sum(rr.accepted_pieces),0) from public.fabric_faction_returns rr where rr.order_item_id=i.id and rr.organization_id=p_org)
  ) order by p.id) into report_lines
  from public.fabric_faction_cut_plans p
  join public.fabric_production_order_items i on i.id=p.order_item_id and i.organization_id=p_org
  join public.fabric_production_orders o on o.id=i.order_id and o.organization_id=p_org
  join public.fabric_lots l on l.id=p.lot_id and l.organization_id=p_org
  join public.fabric_catalog f on f.id=l.fabric_id and f.organization_id=p_org
  left join public.fabric_faction_cut_plans parent on parent.id=p.parent_id and parent.organization_id=p_org
  left join public.fabric_cut_batches c on c.id=p.cut_id and c.organization_id=p_org
  left join public.fabric_faction_returns r on r.cut_batch_id=c.id and r.delivery_document_id=p_id
  where p.organization_id=p_org and coalesce(p.group_id,p.id)=p_group;
  update public.fabric_faction_delivery_documents set report=report_lines where id=p_id;
  return p_id;
end;
$$;
revoke all on function private.fabric_faction_delivery(uuid,uuid,uuid,date,text,text,jsonb,text) from public,anon;
grant execute on function private.fabric_faction_delivery(uuid,uuid,uuid,date,text,text,jsonb,text) to authenticated;
create function public.fabric_faction_delivery(p_org uuid,p_group uuid,p_id uuid,p_on date,p_name text,p_pdf text,p_lines jsonb,p_notes text)
returns uuid language sql security invoker set search_path='' as $$
  select private.fabric_faction_delivery(p_org,p_group,p_id,p_on,p_name,p_pdf,p_lines,p_notes)
$$;
revoke all on function public.fabric_faction_delivery(uuid,uuid,uuid,date,text,text,jsonb,text) from public,anon;
grant execute on function public.fabric_faction_delivery(uuid,uuid,uuid,date,text,text,jsonb,text) to authenticated;

create function private.fabric_faction_pdf(p_org uuid,p_id uuid)
returns text language plpgsql security definer set search_path='' as $$
begin
  if not public.fabric_user_has_permission(p_org,'textiles.inventory.view') then raise exception 'Sem permissão para abrir a NF.' using errcode='42501'; end if;
  return (select encode(p.content,'base64') from private.fabric_faction_delivery_pdfs p join public.fabric_faction_delivery_documents d on d.id=p.id where d.id=p_id and d.organization_id=p_org);
end;
$$;
revoke all on function private.fabric_faction_pdf(uuid,uuid) from public,anon;
grant execute on function private.fabric_faction_pdf(uuid,uuid) to authenticated;
create function public.fabric_faction_pdf(p_org uuid,p_id uuid)
returns text language sql security invoker set search_path='' as $$
  select private.fabric_faction_pdf(p_org,p_id)
$$;
revoke all on function public.fabric_faction_pdf(uuid,uuid) from public,anon;
grant execute on function public.fabric_faction_pdf(uuid,uuid) to authenticated;

