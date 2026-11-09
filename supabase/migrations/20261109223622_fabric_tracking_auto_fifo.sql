-- One GAO fabric balance; allocate net consumption and reservation FIFO under lot locks.
create function public.fabric_reconcile_tracking_auto(p_organization_id uuid,p_tracking_id uuid,p_reserved_m numeric,p_consumed_m numeric,p_returned_m numeric,p_notes text,p_revision uuid,p_expected_revision uuid default null)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare t public.fabric_faction_tracking; recipe_fabric uuid; recipe_count integer; current_revision uuid; l record; net_left numeric; reserve_left numeric; return_left numeric; capacity numeric; used numeric; held numeric; back numeric; allocations jsonb:='[]'; oldrow public.fabric_tracking_reconciliations; base_net jsonb:='{}'; extra numeric;
begin
 if auth.uid() is null or not public.fabric_user_has_permission(p_organization_id,'textiles.production.manage') then raise exception 'Sem permissão para conciliar tecido';end if;
 if p_reserved_m is null or p_consumed_m is null or p_returned_m is null or p_reserved_m<0 or p_consumed_m<0 or p_returned_m<0 or p_returned_m>p_consumed_m or greatest(p_reserved_m,p_consumed_m,p_returned_m)>99999999999 or p_reserved_m::text='NaN' or p_consumed_m::text='NaN' or p_returned_m::text='NaN' then raise exception 'Metros inválidos';end if;
 if p_reserved_m<>round(p_reserved_m,3) or p_consumed_m<>round(p_consumed_m,3) or p_returned_m<>round(p_returned_m,3) then raise exception 'Use no máximo três casas decimais';end if;
 select * into t from public.fabric_faction_tracking where id=p_tracking_id and organization_id=p_organization_id for update;
 if not found then raise exception 'Programação não encontrada';end if;
 select revision into current_revision from public.fabric_tracking_reconciliations where tracking_id=t.id and organization_id=p_organization_id limit 1;
 if current_revision=p_revision then return p_revision;end if;
 if current_revision is distinct from p_expected_revision then raise exception 'Conciliação alterada por outra pessoa. Feche e atualize os dados.';end if;
 select count(*),(array_agg(fabric_id))[1] into recipe_count,recipe_fabric from public.fabric_product_recipes where organization_id=p_organization_id and product_reference=t.product_reference and active;
 if recipe_count<>1 then raise exception 'Vincule uma única ficha técnica ativa à peça antes de conciliar';end if;
 -- Same lock order as the underlying posting function, preventing overspending across concurrent requests.
 perform 1 from public.fabric_lots where organization_id=p_organization_id and (quality_status='APROVADO' and public.fabric_same_standard(p_organization_id,fabric_id,recipe_fabric) or id in(select lot_id from public.fabric_tracking_reconciliations where tracking_id=t.id and organization_id=p_organization_id)) order by id for update;
 net_left:=p_consumed_m-p_returned_m;reserve_left:=p_reserved_m;return_left:=p_returned_m;
 -- Preserve prior consumption costs; allocate only additional net consumption FIFO.
 for l in select r.* from public.fabric_tracking_reconciliations r join public.fabric_lots fl on fl.id=r.lot_id and fl.organization_id=r.organization_id where r.tracking_id=t.id and r.organization_id=p_organization_id and fl.quality_status='APROVADO' and public.fabric_same_standard(p_organization_id,fl.fabric_id,recipe_fabric) order by fl.received_date asc nulls last,fl.created_at,fl.id loop
  used:=least(net_left,greatest(0,l.consumed_m-l.returned_m));net_left:=net_left-used;
  base_net:=base_net||jsonb_build_object(l.lot_id::text,used);
 end loop;
 for l in select fl.* from public.fabric_lots fl where fl.organization_id=p_organization_id and fl.quality_status='APROVADO' and public.fabric_same_standard(p_organization_id,fl.fabric_id,recipe_fabric) order by fl.received_date asc nulls last,fl.created_at asc,fl.id loop
  select * into oldrow from public.fabric_tracking_reconciliations where organization_id=p_organization_id and tracking_id=t.id and lot_id=l.id;
  select coalesce(sum(stock_delta_m-reserved_delta_m),0)+coalesce(oldrow.reserved_m+oldrow.consumed_m-oldrow.returned_m,0) into capacity from public.fabric_stock_movements where organization_id=p_organization_id and lot_id=l.id;
  used:=coalesce((base_net->>l.id::text)::numeric,0);extra:=least(net_left,greatest(0,capacity-used));net_left:=net_left-extra;used:=used+extra;
  -- Existing consumption is preserved ahead of new lots; reservations use remaining capacity.
  held:=least(reserve_left,greatest(0,capacity-used));reserve_left:=reserve_left-held;
  back:=case when return_left>0 and (used>0 or held>0 or coalesce(oldrow.consumed_m,0)>0) then return_left else 0 end;return_left:=return_left-back;
  if used+held+back>0 then allocations:=allocations||jsonb_build_array(jsonb_build_object('lot_id',l.id,'reserved_m',held,'consumed_m',used+back,'returned_m',back));end if;
 end loop;
 if net_left>0 or reserve_left>0 then raise exception 'Saldo total do tecido GAO insuficiente para o consumo e a reserva informados';end if;
 -- A fully returned cut needs an origin for the return trace even when the net balance is zero.
 if return_left>0 then
  select fl.* into l from public.fabric_lots fl where fl.organization_id=p_organization_id and fl.quality_status='APROVADO' and public.fabric_same_standard(p_organization_id,fl.fabric_id,recipe_fabric) order by fl.received_date asc nulls last,fl.created_at,fl.id limit 1;
  if l.id is null then raise exception 'Não há estoque aprovado vinculado ao padrão GAO';end if;
  allocations:=allocations||jsonb_build_array(jsonb_build_object('lot_id',l.id,'reserved_m',0,'consumed_m',return_left,'returned_m',return_left));
 end if;
 return public.fabric_reconcile_tracking(p_organization_id,p_tracking_id,allocations,p_notes,p_revision,p_expected_revision);
end $$;
revoke all on function public.fabric_reconcile_tracking_auto(uuid,uuid,numeric,numeric,numeric,text,uuid,uuid) from public,anon;
grant execute on function public.fabric_reconcile_tracking_auto(uuid,uuid,numeric,numeric,numeric,text,uuid,uuid) to authenticated;
