create table public.fabric_faction_reconciled_lots (
 id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 lot_id uuid not null references public.fabric_lots(id),
 order_item_id uuid not null,
 previous_m numeric(14,3) not null,
 counted_m numeric(14,3) not null,
 confirmed_at timestamptz not null default now(),
 confirmed_by uuid not null references public.profiles(id),
 unique(organization_id,lot_id)
);
alter table public.fabric_faction_reconciled_lots enable row level security;
revoke all on public.fabric_faction_reconciled_lots from public,anon,authenticated;
grant select on public.fabric_faction_reconciled_lots to authenticated;
create policy fabric_faction_reconciled_lots_read on public.fabric_faction_reconciled_lots for select to authenticated
 using (public.fabric_user_has_permission(organization_id,'textiles.production.manage') and
  (public.fabric_user_has_permission(organization_id,'textiles.inventory.view') or
   public.fabric_user_has_permission(organization_id,'textiles.production.reserve')));

create function private.fabric_faction_confirm_lot(
 p_org uuid,p_lot uuid,p_item uuid,p_previous numeric,p_counted numeric,p_request uuid
)
returns void language plpgsql security definer set search_path='' as $$
declare
 item_fabric uuid;
 lot public.fabric_lots;
 onhand numeric;
 reserved numeric;
begin
 if auth.uid() is null or not public.fabric_user_has_permission(p_org,'textiles.production.manage')
  or not (public.fabric_user_has_permission(p_org,'textiles.inventory.view') or public.fabric_user_has_permission(p_org,'textiles.production.reserve')) then
  raise exception 'Sem permissão para conferir rolo para corte.' using errcode='42501';
 end if;
 if p_request is null or p_previous is null or p_counted is null or not (p_counted between 0 and 99999999999)
  or p_counted<>round(p_counted,3) then raise exception 'Informe uma contagem válida em metros.'; end if;
 select i.fabric_id into item_fabric from public.fabric_production_order_items i
 join public.fabric_production_orders o on o.id=i.order_id and o.organization_id=i.organization_id
 where i.id=p_item and i.organization_id=p_org and o.status not in ('CANCELADA','CONCLUIDA') for update of i;
 if not found then raise exception 'Ordem de produção indisponível.'; end if;
 select * into lot from public.fabric_lots l where l.organization_id=p_org and l.id=p_lot for update;
 if not found or lot.quality_status<>'APROVADO' or not coalesce(public.fabric_same_standard(p_org,lot.fabric_id,item_fabric),false) then
  raise exception 'Selecione um rolo aprovado e compatível com o tecido da ordem.';
 end if;
 if exists(select 1 from public.fabric_faction_reconciled_lots r where r.id=p_request and r.organization_id=p_org and r.lot_id=p_lot
    and r.order_item_id=p_item and r.previous_m=p_previous and r.counted_m=p_counted) then return; end if;
 if exists(select 1 from public.fabric_faction_reconciled_lots r where r.organization_id=p_org and r.lot_id=p_lot) then
  raise exception 'Este rolo já foi conferido. Atualize os dados antes de reservar.';
 end if;
 if lot.received_date>coalesce(
   (select coalesce(c.counted_on,c.reported_on) from public.fabric_faction_stock_counts c
    where c.organization_id=p_org order by c.reported_on desc,c.source_key desc,c.line_no limit 1),'-infinity'::date) then
   raise exception 'Este lote já entra na posição de corte.';
 end if;
 select coalesce(sum(m.stock_delta_m),0),coalesce(sum(m.reserved_delta_m),0) into onhand,reserved
 from public.fabric_stock_movements m where m.organization_id=p_org and m.lot_id=p_lot;
 if onhand<>p_previous then raise exception 'O saldo mudou. Atualize os dados e confira novamente.'; end if;
 if p_counted>onhand then raise exception 'A contagem excede o registro do lote. Confira o recebimento do tecido.'; end if;
 if p_counted<reserved then raise exception 'A contagem é menor que a reserva já feita neste rolo.'; end if;
 if p_counted<onhand then
  insert into public.fabric_stock_movements(organization_id,lot_id,movement_type,quantity_m,stock_delta_m,
   reserved_delta_m,unit_cost_per_m,idempotency_key,notes,created_by)
  values(p_org,p_lot,'AJUSTE_SAIDA',onhand-p_counted,p_counted-onhand,
   0,lot.effective_price_per_m,'faction-lot-count:'||p_request,'Ajuste por contagem física do rolo na Facção',auth.uid());
 end if;
 insert into public.fabric_faction_reconciled_lots(id,organization_id,lot_id,order_item_id,previous_m,counted_m,confirmed_by)
 values(p_request,p_org,p_lot,p_item,onhand,p_counted,auth.uid());
end
$$;

create function public.fabric_faction_confirm_lot(
 p_org uuid,p_lot uuid,p_item uuid,p_previous numeric,p_counted numeric,p_request uuid
)
returns void language sql security invoker set search_path='' as $$
 select private.fabric_faction_confirm_lot(p_org,p_lot,p_item,p_previous,p_counted,p_request)
$$;

revoke all on function private.fabric_faction_confirm_lot(uuid,uuid,uuid,numeric,numeric,uuid),
 public.fabric_faction_confirm_lot(uuid,uuid,uuid,numeric,numeric,uuid) from public,anon;
grant execute on function private.fabric_faction_confirm_lot(uuid,uuid,uuid,numeric,numeric,uuid),
 public.fabric_faction_confirm_lot(uuid,uuid,uuid,numeric,numeric,uuid) to authenticated;

create or replace function private.fabric_faction_reservation(
 p_org uuid,p_lot uuid,p_item uuid,p_action text,p_meters numeric,p_key text
)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null
    or not public.fabric_user_has_permission(p_org,'textiles.production.manage')
    or not public.fabric_user_has_permission(p_org,'textiles.production.reserve') then
  raise exception 'Sem permissão para reservar tecido para corte.' using errcode='42501';
 end if;
 if p_action is null or p_action not in ('RESERVA','LIBERA_RESERVA') or p_item is null
    or p_meters is null or p_meters<=0 or p_meters>99999999999 or p_meters<>round(p_meters,3)
    or p_key is null or length(trim(p_key)) not between 8 and 180 then
  raise exception 'Dados inválidos para a reserva de tecido.';
 end if;
 perform 1 from public.fabric_production_order_items i
 join public.fabric_production_orders o on o.id=i.order_id and o.organization_id=i.organization_id
 where i.id=p_item and i.organization_id=p_org and o.status not in ('CANCELADA','CONCLUIDA')
 for update of i;
 if not found then raise exception 'Ordem de produção indisponível para reserva.'; end if;
 perform 1 from public.fabric_lots l where l.organization_id=p_org and l.id=p_lot
 and (p_action='LIBERA_RESERVA' or (l.quality_status='APROVADO' and (
  exists(select 1 from public.fabric_faction_reconciled_lots r where r.organization_id=p_org and r.lot_id=l.id)
  or l.received_date>coalesce(
   (select coalesce(c.counted_on,c.reported_on) from public.fabric_faction_stock_counts c
    where c.organization_id=p_org order by c.reported_on desc,c.source_key desc,c.line_no limit 1),'-infinity'::date))))
 for update;
 if not found then raise exception 'O lote não está disponível para reserva no corte.'; end if;
 return public.fabric_post_stock_movement(p_org,p_lot,p_action,p_meters,p_item,
  'faction-operator:'||p_key,case when p_action='RESERVA' then 'Reserva para corte no Portal da Facção' else 'Liberação no Portal da Facção' end);
end
$$;

