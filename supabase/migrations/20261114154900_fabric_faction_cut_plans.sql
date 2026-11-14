create table public.fabric_faction_cut_plans (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  order_item_id uuid not null,
  lot_id uuid not null,
  parent_id uuid references public.fabric_faction_cut_plans(id),
  pieces integer not null check (pieces > 0),
  unit_m numeric(12,4) not null check (unit_m > 0),
  reserved_m numeric(14,3) not null check (reserved_m > 0),
  status text not null default 'PLANEJADO' check (status in ('PLANEJADO','INICIADO','FRACIONADO','CANCELADO','CONCLUIDO')),
  cut_id uuid unique references public.fabric_cut_batches(id),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  updated_at timestamptz not null default now(),
  updated_by uuid not null default auth.uid(),
  foreign key (order_item_id, organization_id) references public.fabric_production_order_items(id, organization_id),
  foreign key (lot_id, organization_id) references public.fabric_lots(id, organization_id)
);
create trigger faction_cut_plan_audit after insert or update on public.fabric_faction_cut_plans
  for each row execute function public.fabric_audit_production();
create index fabric_faction_cut_plans_order on public.fabric_faction_cut_plans(organization_id,order_item_id,lot_id);
alter table public.fabric_faction_cut_plans enable row level security;
revoke all on public.fabric_faction_cut_plans from public, anon, authenticated;
grant select on public.fabric_faction_cut_plans to authenticated;
create policy faction_cut_plan_read on public.fabric_faction_cut_plans for select to authenticated
  using (public.fabric_user_has_permission(organization_id,'textiles.inventory.view'));

create function private.fabric_faction_cut_plan(p_org uuid, p_action text, p_data jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  id_arg uuid := (p_data->>'id')::uuid;
  item_arg uuid;
  roll_arg uuid;
  plan public.fabric_faction_cut_plans;
  item public.fabric_production_order_items;
  qty integer;
  consumed numeric;
  reserved numeric;
  roll_cost numeric;
  free_m numeric;
  open_m numeric;
  open_pieces integer;
  done integer;
  part jsonb;
  part_pieces integer;
  assigned integer := 0;
  previous_m numeric := 0;
  next_m numeric;
  note text := nullif(trim(p_data->>'notes'),'');
begin
  if auth.uid() is null or not public.fabric_user_has_permission(p_org,'textiles.production.manage') then
    raise exception 'Sem permissão para operar o corte.' using errcode='42501';
  end if;
  if id_arg is null then raise exception 'Identificação do lote obrigatória.'; end if;
  if p_action='plan' then
    item_arg := (p_data->>'order_item_id')::uuid;
    roll_arg := (p_data->>'lot_id')::uuid;
  else
    select p.order_item_id,p.lot_id into item_arg,roll_arg from public.fabric_faction_cut_plans p
      where p.id=id_arg and p.organization_id=p_org;
  end if;
  select * into item from public.fabric_production_order_items i
    where i.id=item_arg and i.organization_id=p_org for update;
  if not found then raise exception 'Ordem do lote não encontrada.'; end if;
  select l.effective_price_per_m into roll_cost from public.fabric_lots l where l.id=roll_arg and l.organization_id=p_org for update;
  if not found then raise exception 'Rolo do lote não encontrado.'; end if;
  select * into plan from public.fabric_faction_cut_plans p where p.id=id_arg and p.organization_id=p_org for update;

  if p_action='plan' then
    qty := (p_data->>'pieces')::integer;
    if plan.id is not null then
      if (plan.order_item_id,plan.lot_id,plan.pieces) is distinct from (item_arg,roll_arg,qty) then
        raise exception 'Identificação já usada em outro planejamento.';
      end if;
      return id_arg;
    end if;
    if qty is null or qty<=0 then raise exception 'Informe a quantidade do lote.'; end if;
    if not exists(select 1 from public.fabric_production_orders o where o.id=item.order_id and o.organization_id=p_org and o.status not in ('CONCLUIDA','CANCELADA')) then
      raise exception 'A ordem não está aberta.';
    end if;
    if not exists(select 1 from public.fabric_lots l where l.id=roll_arg and l.organization_id=p_org and l.quality_status='APROVADO') then
      raise exception 'Selecione um rolo aprovado.';
    end if;
    select coalesce(sum(p.pieces),0),coalesce(sum(p.reserved_m) filter(where p.lot_id=roll_arg),0)
      into open_pieces,open_m from public.fabric_faction_cut_plans p
      where p.organization_id=p_org and p.order_item_id=item_arg and p.status in ('PLANEJADO','INICIADO');
    select greatest(
      (select coalesce(sum(c.produced_pieces),0) from public.fabric_cut_batches c where c.organization_id=p_org and c.order_item_id=item_arg),
      (select coalesce(sum(r.accepted_pieces+r.rejected_pieces),0) from public.fabric_faction_returns r where r.organization_id=p_org and r.order_item_id=item_arg)
    ) into done;
    if qty+open_pieces+done>item.ordered_pieces then raise exception 'Quantidade acima do saldo da ordem.'; end if;
    select coalesce(sum(m.reserved_delta_m),0) into reserved from public.fabric_stock_movements m
      where m.organization_id=p_org and m.order_item_id=item_arg and m.lot_id=roll_arg;
    next_m := round(qty*item.consumption_m_per_piece,3);
    if next_m<=0 or next_m>reserved-open_m then raise exception 'Reserva livre insuficiente no rolo.'; end if;
    insert into public.fabric_faction_cut_plans(id,organization_id,order_item_id,lot_id,pieces,unit_m,reserved_m)
      values(id_arg,p_org,item_arg,roll_arg,qty,item.consumption_m_per_piece,next_m);
  elsif p_action='start' and plan.status='INICIADO' then
    return id_arg;
  elsif p_action='start' and plan.status='PLANEJADO' then
    update public.fabric_faction_cut_plans set status='INICIADO',updated_at=now(),updated_by=auth.uid() where id=id_arg;
  elsif p_action='cancel' and plan.status='CANCELADO' then
    return id_arg;
  elsif p_action='cancel' and plan.status='PLANEJADO' then
    if note is null then raise exception 'Informe o motivo do cancelamento.'; end if;
    update public.fabric_faction_cut_plans set status='CANCELADO',notes=note,updated_at=now(),updated_by=auth.uid() where id=id_arg;
  elsif p_action='split' and plan.status='FRACIONADO' then
    if not exists (select 1 from public.fabric_faction_cut_plans p where p.parent_id=id_arg and p.id=(p_data->'parts'->0->>'id')::uuid) then
      raise exception 'Lote já fracionado. Atualize a tela.';
    end if;
    return id_arg;
  elsif p_action='split' and plan.status='PLANEJADO' then
    if jsonb_typeof(p_data->'parts') is distinct from 'array' then raise exception 'Informe os novos lotes.'; end if;
    if jsonb_array_length(p_data->'parts') not between 2 and 30 then raise exception 'Informe de 2 a 30 lotes.'; end if;
    for part in select value from jsonb_array_elements(p_data->'parts') loop
      part_pieces := (part->>'pieces')::integer;
      if part_pieces is null or part_pieces<=0 or part_pieces>plan.pieces-assigned then raise exception 'Quantidades do fracionamento inválidas.'; end if;
      assigned := assigned+part_pieces;
      next_m := round(plan.reserved_m*assigned/plan.pieces,3);
      insert into public.fabric_faction_cut_plans(id,organization_id,order_item_id,lot_id,parent_id,pieces,unit_m,reserved_m)
        values((part->>'id')::uuid,p_org,item_arg,roll_arg,id_arg,part_pieces,plan.unit_m,next_m-previous_m);
      previous_m := next_m;
    end loop;
    if assigned<>plan.pieces then raise exception 'A soma dos lotes precisa corresponder ao lote de origem.'; end if;
    update public.fabric_faction_cut_plans set status='FRACIONADO',updated_at=now(),updated_by=auth.uid() where id=id_arg;
  elsif p_action='finish' and plan.status='CONCLUIDO' then
    return id_arg;
  elsif p_action='finish' and plan.status='INICIADO' then
    if not exists(select 1 from public.fabric_lots l where l.id=roll_arg and l.organization_id=p_org and l.quality_status='APROVADO') then
      raise exception 'O rolo precisa estar aprovado para concluir o corte.';
    end if;
    qty := (p_data->>'pieces')::integer;
    consumed := (p_data->>'consumed_m')::numeric;
    if qty is null or qty not between 1 and plan.pieces or consumed is null or consumed<=0 or consumed<>round(consumed,3) then
      raise exception 'Informe a quantidade cortada e os metros consumidos.';
    end if;
    if (qty<>plan.pieces or consumed<>plan.reserved_m) and note is null then
      raise exception 'Justifique a diferença em peças ou metros.';
    end if;
    select coalesce(sum(m.stock_delta_m-m.reserved_delta_m),0) into free_m from public.fabric_stock_movements m
      where m.organization_id=p_org and m.lot_id=roll_arg;
    if consumed>plan.reserved_m+free_m then raise exception 'Saldo livre insuficiente para o consumo adicional.'; end if;
    update public.fabric_faction_cut_plans set status='CONCLUIDO',notes=note,updated_at=now(),updated_by=auth.uid() where id=id_arg;
    insert into public.fabric_stock_movements(organization_id,lot_id,order_item_id,movement_type,quantity_m,stock_delta_m,reserved_delta_m,unit_cost_per_m,idempotency_key,notes)
      values(p_org,roll_arg,item_arg,'ENVIO_FACCAO',consumed,-consumed,-plan.reserved_m,roll_cost,'plan-use:'||id_arg,'Consumo e encerramento de reserva do lote');
    insert into public.fabric_cut_batches(id,organization_id,order_item_id,lot_id,consumed_m,produced_pieces)
      values(id_arg,p_org,item_arg,roll_arg,consumed,qty);
    update public.fabric_faction_cut_plans set cut_id=id_arg where id=id_arg;
  else
    raise exception 'Esta operação não se aplica à situação atual do lote.';
  end if;
  return id_arg;
end;
$$;
revoke all on function private.fabric_faction_cut_plan(uuid,text,jsonb) from public, anon;
grant execute on function private.fabric_faction_cut_plan(uuid,text,jsonb) to authenticated;
create function public.fabric_faction_cut_plan(p_org uuid,p_action text,p_data jsonb)
returns uuid language sql security invoker set search_path='' as $$
  select private.fabric_faction_cut_plan(p_org,p_action,p_data)
$$;
revoke all on function public.fabric_faction_cut_plan(uuid,text,jsonb) from public,anon;
grant execute on function public.fabric_faction_cut_plan(uuid,text,jsonb) to authenticated;

create function private.fabric_preserve_cut_commitments() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  committed numeric;
  remaining numeric;
begin
  if tg_table_name='fabric_stock_movements' then
    if new.reserved_delta_m>=0 then return new; end if;
    perform 1 from public.fabric_lots l where l.id=new.lot_id and l.organization_id=new.organization_id for update;
    select coalesce(sum(p.reserved_m),0) into committed from public.fabric_faction_cut_plans p
      where p.organization_id=new.organization_id and p.order_item_id=new.order_item_id and p.lot_id=new.lot_id and p.status in ('PLANEJADO','INICIADO');
    select coalesce(sum(m.reserved_delta_m),0)+new.reserved_delta_m into remaining from public.fabric_stock_movements m
      where m.organization_id=new.organization_id and m.order_item_id=new.order_item_id and m.lot_id=new.lot_id;
  else
    select i.ordered_pieces into remaining from public.fabric_production_order_items i
      where i.organization_id=new.organization_id and i.id=new.order_item_id for update;
    select coalesce(sum(p.pieces),0) into committed from public.fabric_faction_cut_plans p
      where p.organization_id=new.organization_id and p.order_item_id=new.order_item_id and p.status in ('PLANEJADO','INICIADO');
    remaining := remaining-new.produced_pieces-(select coalesce(sum(c.produced_pieces),0) from public.fabric_cut_batches c
      where c.organization_id=new.organization_id and c.order_item_id=new.order_item_id);
  end if;
  if remaining<committed then raise exception 'A operação compromete o saldo reservado para outro lote de corte.'; end if;
  return new;
end;
$$;
revoke all on function private.fabric_preserve_cut_commitments() from public,anon,authenticated;
create trigger fabric_preserve_cut_reserve before insert on public.fabric_stock_movements
  for each row execute function private.fabric_preserve_cut_commitments();
create trigger fabric_preserve_cut_pieces before insert on public.fabric_cut_batches
  for each row execute function private.fabric_preserve_cut_commitments();

alter table public.fabric_faction_returns add column cut_batch_id uuid references public.fabric_cut_batches(id);
create index fabric_faction_returns_cut_batch on public.fabric_faction_returns(cut_batch_id) where cut_batch_id is not null;

create function private.fabric_faction_deliver_cut(p_org uuid, p_cut uuid, p_key uuid, p_accepted integer, p_rejected integer, p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  batch public.fabric_cut_batches;
  item public.fabric_production_order_items;
  result uuid;
  delivery_key text := 'faction-cut-return:'||p_key;
begin
  if auth.uid() is null or not public.fabric_user_has_permission(p_org,'textiles.production.manage') then
    raise exception 'Sem permissão para registrar entrega.' using errcode='42501';
  end if;
  if p_key is null or p_accepted is null or p_rejected is null or p_accepted<0 or p_rejected<0 or p_accepted+p_rejected<=0 then
    raise exception 'Informe peças aceitas e rejeitadas.';
  end if;
  select * into batch from public.fabric_cut_batches c where c.id=p_cut and c.organization_id=p_org;
  if not found or not exists(select 1 from public.fabric_faction_cut_plans p where p.cut_id=p_cut and p.organization_id=p_org) then
    raise exception 'Lote de corte não encontrado.';
  end if;
  select * into item from public.fabric_production_order_items i where i.id=batch.order_item_id and i.organization_id=p_org for update;
  select r.id into result from public.fabric_faction_returns r where r.organization_id=p_org and r.cut_batch_id=p_cut and r.idempotency_key=delivery_key;
  if result is not null then return result; end if;
  select * into batch from public.fabric_cut_batches c where c.id=p_cut and c.organization_id=p_org for update;
  if batch.sent_date is null then raise exception 'Registre o envio à facção antes da entrega.'; end if;
  if p_accepted+p_rejected+(
    select coalesce(sum(r.accepted_pieces+r.rejected_pieces),0)
    from public.fabric_faction_returns r where r.cut_batch_id=p_cut and r.organization_id=p_org
  )>batch.produced_pieces then raise exception 'Entrega acima do saldo do lote.'; end if;
  insert into public.fabric_faction_returns(organization_id,order_item_id,cut_batch_id,accepted_pieces,rejected_pieces,
    faction_cost_amount,extras_cost_amount,notes,idempotency_key)
    values(p_org,item.id,p_cut,p_accepted,p_rejected,p_accepted*item.faction_cost_per_piece,
    p_accepted*item.extras_cost_per_piece,nullif(trim(p_notes),''),delivery_key)
    returning id into result;
  return result;
end;
$$;
revoke all on function private.fabric_faction_deliver_cut(uuid,uuid,uuid,integer,integer,text) from public,anon;
grant execute on function private.fabric_faction_deliver_cut(uuid,uuid,uuid,integer,integer,text) to authenticated;
create function public.fabric_faction_deliver_cut(p_org uuid,p_cut uuid,p_key uuid,p_accepted integer,p_rejected integer,p_notes text)
returns uuid language sql security invoker set search_path='' as $$
  select private.fabric_faction_deliver_cut(p_org,p_cut,p_key,p_accepted,p_rejected,p_notes)
$$;
revoke all on function public.fabric_faction_deliver_cut(uuid,uuid,uuid,integer,integer,text) from public,anon;
grant execute on function public.fabric_faction_deliver_cut(uuid,uuid,uuid,integer,integer,text) to authenticated;

create or replace function public.fabric_validate_cut_return() returns trigger language plpgsql security definer set search_path='' as $$
declare
  sent integer;
  received integer;
begin
  perform 1 from public.fabric_production_order_items i where i.id=new.order_item_id and i.organization_id=new.organization_id for update;
  if new.cut_batch_id is not null then
    select c.produced_pieces into sent from public.fabric_cut_batches c where c.id=new.cut_batch_id
      and c.organization_id=new.organization_id and c.order_item_id=new.order_item_id and c.sent_date is not null;
    if sent is null then raise exception 'Corte enviado não encontrado para esta ordem.'; end if;
    select coalesce(sum(r.accepted_pieces+r.rejected_pieces),0) into received from public.fabric_faction_returns r
      where r.organization_id=new.organization_id and r.cut_batch_id=new.cut_batch_id;
  elsif exists(select 1 from public.fabric_cut_batches c where c.order_item_id=new.order_item_id and c.organization_id=new.organization_id) then
    select coalesce(sum(c.produced_pieces),0) into sent from public.fabric_cut_batches c
    where c.order_item_id=new.order_item_id and c.organization_id=new.organization_id and c.sent_date is not null
      and not exists(select 1 from public.fabric_faction_cut_plans p where p.cut_id=c.id and p.organization_id=new.organization_id);
    select coalesce(sum(r.accepted_pieces+r.rejected_pieces),0) into received from public.fabric_faction_returns r
      where r.organization_id=new.organization_id and r.order_item_id=new.order_item_id and r.cut_batch_id is null;
  else
    return new;
  end if;
  if received+new.accepted_pieces+new.rejected_pieces>sent then raise exception 'Entrega acima do saldo disponível.'; end if;
  return new;
end;
$$;
