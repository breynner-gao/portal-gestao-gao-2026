create function public.fabric_cancel_purchase_order(p_organization_id uuid,p_order_id uuid)
returns void language plpgsql security invoker set search_path=''
as $$
declare current_status text;
begin
 if not coalesce(public.fabric_user_has_permission(p_organization_id,'textiles.inventory.manage'),false) then
  raise exception 'Sem permissão para excluir pedidos de tecido.' using errcode='42501';
 end if;
 select status into current_status from public.fabric_purchase_orders
 where id=p_order_id and organization_id=p_organization_id for update;
 if not found then raise exception 'Pedido não encontrado.'; end if;
 if current_status='CANCELADA' then return; end if;
 if current_status<>'ABERTA' or exists(
  select 1 from public.fabric_purchase_order_items i
  where i.purchase_order_id=p_order_id and i.organization_id=p_organization_id and (
   i.received_m>0 or exists(select 1 from public.fabric_purchase_order_receipts r
    where r.purchase_order_item_id=i.id and r.organization_id=p_organization_id)
  )
 ) then raise exception 'Só é possível excluir pedidos sem recebimento.'; end if;
 update public.fabric_purchase_orders set status='CANCELADA',updated_at=now()
 where id=p_order_id and organization_id=p_organization_id;
end;
$$;
revoke all on function public.fabric_cancel_purchase_order(uuid,uuid) from public, anon, authenticated;
grant execute on function public.fabric_cancel_purchase_order(uuid,uuid) to authenticated;
