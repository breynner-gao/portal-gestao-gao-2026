create function public.fabric_edit_purchase_order(
 p_organization_id uuid,p_order_id uuid,p_version timestamptz,p_order_number text,
 p_ordered_date date,p_expected_date date,p_notes text,p_logistics_stage text,
 p_carrier text,p_tracking_code text,p_lines jsonb
)
returns uuid language plpgsql security invoker set search_path=''
as $$
declare
  purchase public.fabric_purchase_orders;
  item public.fabric_purchase_order_items;
  line jsonb;
  meters numeric;
  price numeric;
begin
  if not coalesce(public.fabric_user_has_permission(p_organization_id,'textiles.inventory.manage'),false)
  then raise exception 'Sem permissão para editar pedidos de tecido.' using errcode='42501'; end if;
  if coalesce(length(btrim(p_order_number)),0) not between 1 and 100 or p_ordered_date is null
    or coalesce(p_logistics_stage,'') not in ('COTACAO','CONFIRMADO','EM_TRANSPORTE')
  then raise exception 'Preencha o número, a data e o acompanhamento do pedido.'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines)>500
  then raise exception 'Itens do pedido inválidos.'; end if;

  -- Lock items before their parent, as the receipt function does.
  perform 1 from public.fabric_purchase_order_items
   where organization_id=p_organization_id and purchase_order_id=p_order_id order by id for update;
  select * into purchase from public.fabric_purchase_orders
   where organization_id=p_organization_id and id=p_order_id for update;
  if not found or purchase.status='CANCELADA' then raise exception 'Pedido indisponível para edição.'; end if;
  if purchase.updated_at is distinct from p_version then raise exception 'O pedido foi atualizado. Reabra a edição para conferir os dados.'; end if;
  if exists(select 1 from jsonb_array_elements(p_lines) a group by a->>'id' having count(*)>1)
  then raise exception 'Item repetido na edição.'; end if;

  for line in select value from jsonb_array_elements(p_lines) loop
    select * into item from public.fabric_purchase_order_items where id=(line->>'id')::uuid
     and organization_id=p_organization_id and purchase_order_id=p_order_id;
    if not found then raise exception 'Item não pertence a este pedido.'; end if;
    meters := (line->>'ordered_m')::numeric;
    price := (line->>'purchase_price_per_m')::numeric;
    if meters is null or meters<=0 or meters>=100000000000 or round(meters,3)<>meters
      or price is null or price<0 or price>=10000000000 or round(price,4)<>price
    then raise exception 'Informe quantidade e preço válidos para cada item.'; end if;
    if (item.ordered_m,item.purchase_price_per_m) is not distinct from (meters,price) then continue; end if;
    if item.received_m>0 or exists(select 1 from public.fabric_purchase_order_receipts
      where organization_id=p_organization_id and purchase_order_item_id=item.id)
    then raise exception 'Quantidade e preço de itens com recebimento ficam bloqueados.'; end if;
    update public.fabric_purchase_order_items set ordered_m=meters,purchase_price_per_m=price where id=item.id;
  end loop;

  update public.fabric_purchase_orders set order_number=btrim(p_order_number),ordered_date=p_ordered_date,
    expected_date=p_expected_date,notes=nullif(btrim(p_notes),''),logistics_stage=p_logistics_stage,
    carrier=nullif(btrim(p_carrier),''),tracking_code=nullif(btrim(p_tracking_code),''),updated_at=clock_timestamp()
    where id=p_order_id and organization_id=p_organization_id;
  return p_order_id;
exception when unique_violation then
  raise exception 'Já existe uma ordem com esse número para o fornecedor.';
end;
$$;
revoke all on function public.fabric_edit_purchase_order(uuid,uuid,timestamptz,text,date,date,text,text,text,text,jsonb) from public,anon;
grant execute on function public.fabric_edit_purchase_order(uuid,uuid,timestamptz,text,date,date,text,text,text,text,jsonb) to authenticated;
