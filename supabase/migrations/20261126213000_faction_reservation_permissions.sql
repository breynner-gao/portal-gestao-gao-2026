insert into public.permission_catalog(code,module,resource,action,label)
values ('textiles.production.reserve','enxoval','facção','reservar','Consultar lotes operacionais e reservar tecido para corte')
on conflict (code) do nothing;

create function private.fabric_faction_reservation_stock(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null
    or not public.fabric_user_has_permission(p_org,'textiles.production.manage')
    or not public.fabric_user_has_permission(p_org,'textiles.production.reserve') then
  raise exception 'Sem permissão para consultar os lotes da reserva.' using errcode='42501';
 end if;
 return (
  select jsonb_build_object(
   'cutoff',(select coalesce(c.counted_on,c.reported_on) from public.fabric_faction_stock_counts c
     where c.organization_id=p_org order by c.reported_on desc,c.source_key desc,c.line_no limit 1),
   'lots',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'lot_code',l.lot_code,
      'fabric_id',l.fabric_id,'received_date',l.received_date,'quality_status',l.quality_status))
     from public.fabric_lots l where l.organization_id=p_org and l.quality_status='APROVADO'),'[]'::jsonb),
   'moves',coalesce((select jsonb_agg(jsonb_build_object('lot_id',m.lot_id,'order_item_id',m.order_item_id,
      'movement_type',m.movement_type,'quantity_m',m.quantity_m,'stock_delta_m',m.stock_delta_m,
      'reserved_delta_m',m.reserved_delta_m,'created_at',m.created_at))
     from public.fabric_stock_movements m join public.fabric_lots l
       on l.id=m.lot_id and l.organization_id=m.organization_id
     where m.organization_id=p_org and l.quality_status='APROVADO'),'[]'::jsonb)
  )
 );
end
$$;

create function public.fabric_faction_reservation_stock(p_org uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.fabric_faction_reservation_stock(p_org)
$$;

create function private.fabric_faction_reservation(
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
 and (p_action='LIBERA_RESERVA' or (l.quality_status='APROVADO' and l.received_date>coalesce(
  (select coalesce(c.counted_on,c.reported_on) from public.fabric_faction_stock_counts c
   where c.organization_id=p_org order by c.reported_on desc,c.source_key desc,c.line_no limit 1),'-infinity'::date)))
 for update;
 if not found then raise exception 'O lote não está disponível para reserva no corte.'; end if;
 return public.fabric_post_stock_movement(p_org,p_lot,p_action,p_meters,p_item,
  'faction-operator:'||p_key,case when p_action='RESERVA' then 'Reserva para corte no Portal da Facção' else 'Liberação no Portal da Facção' end);
end
$$;

create function public.fabric_faction_reservation(
 p_org uuid,p_lot uuid,p_item uuid,p_action text,p_meters numeric,p_key text
)
returns jsonb language sql security invoker set search_path='' as $$
 select private.fabric_faction_reservation(p_org,p_lot,p_item,p_action,p_meters,p_key)
$$;

revoke all on function private.fabric_faction_reservation_stock(uuid),public.fabric_faction_reservation_stock(uuid),
 private.fabric_faction_reservation(uuid,uuid,uuid,text,numeric,text),
 public.fabric_faction_reservation(uuid,uuid,uuid,text,numeric,text) from public,anon;
grant execute on function private.fabric_faction_reservation_stock(uuid),public.fabric_faction_reservation_stock(uuid),
 private.fabric_faction_reservation(uuid,uuid,uuid,text,numeric,text),
 public.fabric_faction_reservation(uuid,uuid,uuid,text,numeric,text) to authenticated;

insert into public.member_permissions(membership_id,permission_code,allowed)
select m.id,'textiles.production.reserve',true
from public.memberships m
join public.profiles p on p.id=m.profile_id
join public.organizations o on o.id=m.organization_id
join public.member_permissions ops on ops.membership_id=m.id and ops.permission_code='textiles.production.manage' and ops.allowed
where p.username='dionedpx' and p.active and m.active and m.role_name='Facção' and o.active and o.kind='gao'
on conflict (membership_id,permission_code) do update set allowed=true;
