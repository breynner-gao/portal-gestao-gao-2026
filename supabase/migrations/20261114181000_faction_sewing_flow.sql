alter table public.fabric_faction_cut_plans add column sewing_due_on date, add column sewing_due_set boolean not null default false;

create function private.fabric_faction_sewing_due(p_org uuid,p_group uuid,p_due date)
returns void language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.fabric_user_has_permission(p_org,'textiles.production.manage') then
    raise exception 'Sem permissão para editar a previsão.' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_group::text,0));
  update public.fabric_faction_cut_plans p set sewing_due_on=p_due,sewing_due_set=true,updated_at=now(),updated_by=auth.uid()
  where p.organization_id=p_org and coalesce(p.group_id,p.id)=p_group and p.status='CONCLUIDO'
    and exists(select 1 from public.fabric_faction_cut_plans member
      join public.fabric_cut_batches c on c.id=member.cut_id and c.organization_id=member.organization_id
      where member.organization_id=p_org and coalesce(member.group_id,member.id)=p_group
        and c.produced_pieces>(select coalesce(sum(r.accepted_pieces+r.rejected_pieces),0)
          from public.fabric_faction_returns r where r.organization_id=p_org and r.cut_batch_id=c.id));
  if not found then raise exception 'O lote não tem peças pendentes.'; end if;
end;
$$;
revoke all on function private.fabric_faction_sewing_due(uuid,uuid,date) from public,anon;
grant execute on function private.fabric_faction_sewing_due(uuid,uuid,date) to authenticated;
create function public.fabric_faction_sewing_due(p_org uuid,p_group uuid,p_due date)
returns void language sql security invoker set search_path='' as $$
  select private.fabric_faction_sewing_due(p_org,p_group,p_due)
$$;
revoke all on function public.fabric_faction_sewing_due(uuid,uuid,date) from public,anon;
grant execute on function public.fabric_faction_sewing_due(uuid,uuid,date) to authenticated;

create or replace function public.fabric_validate_cut_return() returns trigger language plpgsql security definer set search_path='' as $$
declare
  sent integer;
  received integer;
begin
  perform 1 from public.fabric_production_order_items i where i.id=new.order_item_id and i.organization_id=new.organization_id for update;
  if new.cut_batch_id is not null then
    select c.produced_pieces into sent from public.fabric_cut_batches c where c.id=new.cut_batch_id
      and c.organization_id=new.organization_id and c.order_item_id=new.order_item_id and (
        c.sent_date is not null or exists(
          select 1 from public.fabric_faction_cut_plans p
          join public.fabric_faction_delivery_documents d on d.organization_id=p.organization_id and d.cut_group_id=coalesce(p.group_id,p.id)
          where p.organization_id=new.organization_id and p.cut_id=c.id and d.id=new.delivery_document_id
        )
      );
    if sent is null then raise exception 'Corte concluído não encontrado para esta ordem.'; end if;
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

create or replace function private.fabric_faction_delivery(p_org uuid,p_group uuid,p_id uuid,p_on date,p_name text,p_pdf text,p_lines jsonb,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  line jsonb;
  roll public.fabric_faction_cut_plans;
  accepted integer;
  rejected integer;
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
    accepted := (line->>'accepted')::integer;
    rejected := (line->>'rejected')::integer;
    if accepted is null or rejected is null or accepted<0 or rejected<0 or accepted::bigint+rejected<=0 then
      raise exception 'Informe as quantidades aceitas e rejeitadas.';
    end if;
    insert into public.fabric_faction_returns(
      organization_id,order_item_id,cut_batch_id,delivery_document_id,returned_at,accepted_pieces,rejected_pieces,
      faction_cost_amount,extras_cost_amount,notes,idempotency_key
    ) select p_org,i.id,roll.cut_id,p_id,p_on::timestamp at time zone 'America/Sao_Paulo',accepted,rejected,
      accepted*i.faction_cost_per_piece,accepted*i.extras_cost_per_piece,nullif(trim(p_notes),''),'faction-doc:'||p_id||':'||roll.cut_id
    from public.fabric_production_order_items i where i.id=roll.order_item_id and i.organization_id=p_org;
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
