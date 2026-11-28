create or replace function private.fabric_faction_remove_item(p_org uuid,p_item uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
 item public.fabric_production_order_items;
 parent_id uuid;
 parent_status text;
begin
 if auth.uid() is null or not coalesce(public.fabric_user_has_permission(p_org,'textiles.production.manage'),false)
 then raise exception 'Sem permissão para excluir itens da facção.' using errcode='42501'; end if;

 select i.order_id into parent_id from public.fabric_production_order_items i where i.id=p_item and i.organization_id=p_org;
 if not found then raise exception 'Item indisponível para exclusão.'; end if;
 select o.status into parent_status from public.fabric_production_orders o
 where o.id=parent_id and o.organization_id=p_org for update;
 if parent_status='CANCELADA' then return; end if;
 if parent_status is null or parent_status not in ('ABERTA','PARCIAL','ENVIADA')
 then raise exception 'A ordem já está encerrada.'; end if;
 select * into item from public.fabric_production_order_items where id=p_item and organization_id=p_org for update;
 if not found then raise exception 'Item indisponível para exclusão.'; end if;

 if exists(select 1 from public.fabric_cut_enfestos where organization_id=p_org and
   outputs @> jsonb_build_array(jsonb_build_object('source_type','os','source_id',p_item::text)))
 then raise exception 'Este item está vinculado a um enfesto e precisa permanecer no histórico.'; end if;

 if exists(select 1 from public.fabric_stock_movements m where m.organization_id=p_org and m.order_item_id=p_item)
 and not exists(select 1 from public.fabric_production_order_items i
   where i.organization_id=p_org and i.order_id=parent_id and i.id<>p_item)
 and not exists(select 1 from public.fabric_stock_movements m where m.organization_id=p_org and m.order_item_id=p_item
   group by m.lot_id having sum(m.reserved_delta_m)<>0 or bool_or(m.movement_type not in ('RESERVA','LIBERA_RESERVA') or m.stock_delta_m<>0))
 and not exists(select 1 from public.fabric_faction_cut_plans p where p.organization_id=p_org and p.order_item_id=p_item)
 and not exists(select 1 from public.fabric_cut_batches c where c.organization_id=p_org and c.order_item_id=p_item)
 and not exists(select 1 from public.fabric_faction_returns r where r.organization_id=p_org and r.order_item_id=p_item)
 and not exists(select 1 from public.fabric_faction_assignments a where a.organization_id=p_org and a.order_item_id=p_item)
 then
  update public.fabric_production_orders set status='CANCELADA',updated_at=now() where id=parent_id and organization_id=p_org;
  insert into public.fabric_production_audit(organization_id,entity,record_id,before_data,after_data,changed_by)
  values(p_org,'fabric_production_order_items',p_item,to_jsonb(item),jsonb_build_object('status','CANCELADA'),auth.uid());
  return;
 end if;

 begin
  delete from public.fabric_production_order_items where id=p_item and organization_id=p_org;
 exception when foreign_key_violation then
  raise exception 'Este item tem movimentação, lote, atribuição ou entrega e precisa permanecer no histórico.';
 end;
 insert into public.fabric_production_audit(organization_id,entity,record_id,before_data,changed_by)
 values(p_org,'fabric_production_order_items',item.id,to_jsonb(item),auth.uid());

 if not exists(select 1 from public.fabric_production_order_items i where i.order_id=parent_id and i.organization_id=p_org)
 then update public.fabric_production_orders set status='CANCELADA',updated_at=now() where id=parent_id and organization_id=p_org; end if;
end;
$$;

-- Serialize new reservations with cancellation, including requests from an older screen.
create function private.fabric_guard_cancelled_order_reservation() returns trigger
language plpgsql security definer set search_path='' as $$
declare
 parent_id uuid;
begin
 if new.movement_type<>'RESERVA' or new.order_item_id is null then return new; end if;
 select i.order_id into parent_id from public.fabric_production_order_items i
 where i.id=new.order_item_id and i.organization_id=new.organization_id for key share;
 if exists(select 1 from public.fabric_production_orders o
   where o.id=parent_id and o.organization_id=new.organization_id and o.status='CANCELADA')
 then raise exception 'Esta ordem foi cancelada. Atualize a Provisão Facção.'; end if;
 return new;
end;
$$;
revoke all on function private.fabric_guard_cancelled_order_reservation() from public,anon,authenticated;
create trigger fabric_guard_cancelled_order_reservation before insert on public.fabric_stock_movements
 for each row execute function private.fabric_guard_cancelled_order_reservation();
