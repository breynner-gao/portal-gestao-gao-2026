create function public.fabric_faction_release_cut_queue(p_org uuid,p_item uuid,p_request uuid,p_lines jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare
  v_line record;
  v_key text;
  v_delegated boolean;
begin
  if auth.uid() is null or not public.fabric_user_has_permission(p_org,'textiles.production.manage') then
    raise exception 'Sem permissão para retirar itens da fila de corte.' using errcode='42501';
  end if;
  v_delegated:=not public.fabric_user_has_permission(p_org,'textiles.inventory.view');
  if v_delegated and not public.fabric_user_has_permission(p_org,'textiles.production.reserve') then
    raise exception 'Sem permissão para liberar a reserva de tecido.' using errcode='42501';
  end if;
  if p_item is null or p_request is null or jsonb_typeof(p_lines) is distinct from 'array' or p_lines='[]'::jsonb then
    raise exception 'Informe o item e a reserva que será liberada.';
  end if;
  for v_line in select lot_id,meters from jsonb_to_recordset(p_lines) as line(lot_id uuid,meters numeric) order by lot_id
  loop
    if v_line.lot_id is null or v_line.meters is null or v_line.meters<=0 or v_line.meters<>round(v_line.meters,3) then
      raise exception 'Informe uma metragem válida para cada rolo.';
    end if;
    v_key:='cut-queue-release:'||p_request||':'||v_line.lot_id;
    if v_delegated then
      perform public.fabric_faction_reservation(p_org,v_line.lot_id,p_item,'LIBERA_RESERVA',v_line.meters,v_key);
    else
      perform public.fabric_post_stock_movement(p_org,v_line.lot_id,'LIBERA_RESERVA',v_line.meters,p_item,v_key,'Retirada da fila de corte');
    end if;
  end loop;
end;
$$;
revoke all on function public.fabric_faction_release_cut_queue(uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function public.fabric_faction_release_cut_queue(uuid,uuid,uuid,jsonb) to authenticated;
