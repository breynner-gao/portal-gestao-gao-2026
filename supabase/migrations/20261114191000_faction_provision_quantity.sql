create function private.fabric_faction_order_quantity(p_org uuid,p_item uuid,p_quantity integer)
returns void language plpgsql security definer set search_path='' as $$
declare
  item public.fabric_production_order_items;
  cut_pieces bigint;
  delivered_pieces bigint;
  planned_pieces bigint;
  reserved numeric;
begin
  if auth.uid() is null or not public.fabric_user_has_permission(p_org,'textiles.production.manage') then
    raise exception 'Sem permissão para alterar a ordem.' using errcode='42501';
  end if;
  if p_quantity is null or p_quantity<1 then raise exception 'Informe a quantidade de peças.'; end if;
  select * into item from public.fabric_production_order_items where id=p_item and organization_id=p_org for update;
  if item.id is null or not exists(select 1 from public.fabric_production_orders o
    where o.id=item.order_id and o.organization_id=p_org and o.status not in ('CONCLUIDA','CANCELADA')) then raise exception 'Ordem indisponível para alteração.'; end if;
  if p_quantity=item.ordered_pieces then return; end if;
  perform 1 from public.fabric_lots l where l.organization_id=p_org and l.id in (
    select m.lot_id from public.fabric_stock_movements m where m.organization_id=p_org and m.order_item_id=p_item)
    order by l.id for update;
  select coalesce(sum(produced_pieces),0) into cut_pieces from public.fabric_cut_batches where organization_id=p_org and order_item_id=p_item;
  select coalesce(sum(accepted_pieces+rejected_pieces),0) into delivered_pieces from public.fabric_faction_returns where organization_id=p_org and order_item_id=p_item;
  select coalesce(sum(pieces),0) into planned_pieces from public.fabric_faction_cut_plans where organization_id=p_org and order_item_id=p_item and status in ('PLANEJADO','INICIADO');
  select coalesce(sum(reserved_delta_m),0) into reserved from public.fabric_stock_movements where organization_id=p_org and order_item_id=p_item;
  if p_quantity<greatest(cut_pieces,delivered_pieces)+planned_pieces then raise exception 'A quantidade não pode ficar abaixo das peças já comprometidas.'; end if;
  if p_quantity<item.ordered_pieces and reserved>round((p_quantity-greatest(cut_pieces,delivered_pieces))*item.consumption_m_per_piece,3) then
    raise exception 'Libere o excedente da reserva antes de reduzir a quantidade.';
  end if;
  update public.fabric_production_order_items set ordered_pieces=p_quantity where id=p_item and organization_id=p_org;
end;
$$;
create trigger faction_order_quantity_audit after update of ordered_pieces on public.fabric_production_order_items
  for each row when(old.ordered_pieces is distinct from new.ordered_pieces) execute function public.fabric_audit_production();
revoke all on function private.fabric_faction_order_quantity(uuid,uuid,integer) from public,anon;
grant execute on function private.fabric_faction_order_quantity(uuid,uuid,integer) to authenticated;
create function public.fabric_faction_order_quantity(p_org uuid,p_item uuid,p_quantity integer)
returns void language sql security invoker set search_path='' as $$
  select private.fabric_faction_order_quantity(p_org,p_item,p_quantity)
$$;
revoke all on function public.fabric_faction_order_quantity(uuid,uuid,integer) from public,anon;
grant execute on function public.fabric_faction_order_quantity(uuid,uuid,integer) to authenticated;
