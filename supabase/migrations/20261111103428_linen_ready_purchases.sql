create schema if not exists private;
create table public.linen_ready_orders (
 id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 supplier_id uuid not null references public.fabric_suppliers(id),
 order_number text not null check (length(trim(order_number)) between 1 and 100),
 product_reference text not null check (length(trim(product_reference)) between 1 and 150),
 product_name text not null check (length(trim(product_name)) between 1 and 300),
 ordered_pieces integer not null check (ordered_pieces > 0),
 received_pieces integer not null default 0 check (received_pieces between 0 and ordered_pieces),
 unit_price numeric(14,4) not null check (unit_price >= 0),
 ordered_date date not null,
 expected_date date,
 status text not null default 'ABERTA' check (status in ('ABERTA','CANCELADA')),
 notes text,
 revision integer not null default 1,
 created_at timestamptz not null default now(),
 created_by uuid not null references public.profiles(id),
 unique (organization_id, order_number, product_reference)
);
create table public.linen_ready_receipts (
 id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 order_id uuid not null references public.linen_ready_orders(id),
 accepted_pieces integer not null check (accepted_pieces > 0),
 unit_price numeric(14,4) not null check (unit_price >= 0),
 invoice_number text not null check (length(trim(invoice_number)) between 1 and 100),
 received_date date not null,
 rfid_confirmed boolean not null default false,
 rfid_snapshot_updated_at timestamptz,
 created_at timestamptz not null default now(),
 created_by uuid not null references public.profiles(id)
);
create index linen_ready_orders_org on public.linen_ready_orders(organization_id,product_reference);
create index linen_ready_receipts_order on public.linen_ready_receipts(order_id);
create index linen_ready_receipts_org on public.linen_ready_receipts(organization_id,created_at);
alter table public.linen_ready_orders enable row level security;
alter table public.linen_ready_receipts enable row level security;
revoke all on public.linen_ready_orders,public.linen_ready_receipts from anon,authenticated;
grant select on public.linen_ready_orders,public.linen_ready_receipts to authenticated;
grant all on public.linen_ready_orders,public.linen_ready_receipts to service_role;
create policy ready_orders_read on public.linen_ready_orders for select to authenticated using (
 public.fabric_user_has_permission(organization_id,'textiles.inventory.view') or public.fabric_user_has_permission(organization_id,'textiles.inventory.manage'));
create policy ready_receipts_read on public.linen_ready_receipts for select to authenticated using (
 public.fabric_user_has_permission(organization_id,'textiles.inventory.view') or public.fabric_user_has_permission(organization_id,'textiles.inventory.manage'));

create function private.linen_ready_purchase(p_org uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 order_key uuid := (p_data->>'id')::uuid;
 receipt_key uuid;
 actor uuid := auth.uid();
 purchase public.linen_ready_orders;
 receipt public.linen_ready_receipts;
 quantity integer;
 price numeric;
 before_data jsonb;
 latest_snapshot timestamptz;
 result jsonb;
begin
 if actor is null or not public.fabric_user_has_permission(p_org,'textiles.inventory.manage') then
  raise exception 'Sem permissão para compras de enxoval.' using errcode='42501';
 end if;
 if p_action in ('create','receive','edit') then
  if coalesce(p_data->>'quantity','') !~ '^[1-9][0-9]{0,8}$' then
   raise exception 'Informe uma quantidade inteira positiva.';
  end if;
  if coalesce(p_data->>'unitPrice','') !~ '^[0-9]{1,10}(\.[0-9]{1,4})?$' then
   raise exception 'Preço inválido.';
  end if;
  quantity := (p_data->>'quantity')::integer;
  price := (p_data->>'unitPrice')::numeric;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,879));
 if p_action='create' then
  if not exists(select 1 from public.fabric_suppliers s where s.id=(p_data->>'supplierId')::uuid and s.organization_id=p_org) then
   raise exception 'Fornecedor de outra organização.';
  end if;
  select * into purchase from public.linen_ready_orders where id=order_key;
  if found then
   if purchase.organization_id<>p_org or purchase.product_reference<>trim(p_data->>'productReference')
     or purchase.ordered_pieces<>quantity or purchase.unit_price<>price or purchase.order_number<>trim(p_data->>'orderNumber')
     or purchase.supplier_id<>(p_data->>'supplierId')::uuid then
    raise exception 'Identificador já utilizado para outro pedido.';
   end if;
   return to_jsonb(purchase);
  end if;
  insert into public.linen_ready_orders(id,organization_id,supplier_id,order_number,product_reference,product_name,ordered_pieces,unit_price,ordered_date,expected_date,notes,created_by)
  values(order_key,p_org,(p_data->>'supplierId')::uuid,trim(p_data->>'orderNumber'),trim(p_data->>'productReference'),trim(p_data->>'productName'),quantity,price,(p_data->>'orderedDate')::date,nullif(p_data->>'expectedDate','')::date,p_data->>'notes',actor)
  returning * into purchase;
 else
  select * into purchase from public.linen_ready_orders where id=order_key and organization_id=p_org for update;
  if not found then raise exception 'Pedido não localizado.'; end if;
  before_data := to_jsonb(purchase);
  if p_action='receive' then
   receipt_key := (p_data->>'requestId')::uuid;
   select * into receipt from public.linen_ready_receipts where id=receipt_key;
   if found then
    if receipt.order_id<>order_key or receipt.organization_id<>p_org or receipt.accepted_pieces<>quantity
      or receipt.unit_price<>price or receipt.invoice_number<>trim(p_data->>'invoiceNumber') then
     raise exception 'Identificador já utilizado para outro recebimento.';
    end if;
    return to_jsonb(receipt);
   end if;
   if purchase.status='CANCELADA' then raise exception 'Pedido cancelado.'; end if;
   if quantity>purchase.ordered_pieces-purchase.received_pieces then raise exception 'Quantidade acima do saldo.'; end if;
   insert into public.linen_ready_receipts(id,organization_id,order_id,accepted_pieces,unit_price,invoice_number,received_date,created_by)
   values(receipt_key,p_org,order_key,quantity,price,trim(p_data->>'invoiceNumber'),(p_data->>'receivedDate')::date,actor) returning * into receipt;
   update public.linen_ready_orders set received_pieces=received_pieces+quantity,revision=revision+1 where id=order_key returning * into purchase;
   result := to_jsonb(receipt);
  elsif p_action='confirm_rfid' then
   select updated_at into latest_snapshot from public.linen_rfid_snapshots where organization_id=p_org for share;
   if latest_snapshot is null or latest_snapshot is distinct from (p_data->>'snapshotUpdatedAt')::timestamptz then
    raise exception 'A base RFID mudou. Atualize os dados antes de confirmar.';
   end if;
   select * into receipt from public.linen_ready_receipts where id=(p_data->>'receiptId')::uuid and order_id=order_key and organization_id=p_org for update;
   if not found or latest_snapshot<receipt.created_at then raise exception 'Atualize a base RFID incluindo este recebimento antes de confirmar.'; end if;
   if receipt.rfid_confirmed then return to_jsonb(receipt); end if;
   before_data := to_jsonb(receipt);
   update public.linen_ready_receipts set rfid_confirmed=true,rfid_snapshot_updated_at=latest_snapshot where id=receipt.id returning * into receipt;
   result := to_jsonb(receipt);
  elsif p_action in ('edit','cancel') then
   if purchase.status='CANCELADA' then raise exception 'Pedido cancelado.'; end if;
   if purchase.revision is distinct from (p_data->>'revision')::integer then raise exception 'Pedido alterado por outra pessoa. Atualize os dados.'; end if;
   if p_action='cancel' then
    update public.linen_ready_orders set status='CANCELADA',revision=revision+1 where id=order_key returning * into purchase;
   else
    if quantity<purchase.received_pieces then raise exception 'A quantidade não pode ser menor que a recebida.'; end if;
    update public.linen_ready_orders set ordered_pieces=quantity,unit_price=price,expected_date=nullif(p_data->>'expectedDate','')::date,notes=p_data->>'notes',revision=revision+1
    where id=order_key returning * into purchase;
   end if;
  else raise exception 'Ação inválida.';
  end if;
 end if;
 result := coalesce(result,to_jsonb(purchase));
 insert into public.audit_events(actor_profile_id,organization_id,module,entity,entity_id,action,before_data,after_data,source)
 values(actor,p_org,'enxoval','linen_ready_orders',order_key::text,p_action,before_data,result,'comprar-enxoval');
 return result;
end;
$$;
revoke all on function private.linen_ready_purchase(uuid,text,jsonb) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.linen_ready_purchase(uuid,text,jsonb) to authenticated;
create function public.linen_ready_purchase(p_org uuid,p_action text,p_data jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.linen_ready_purchase(p_org,p_action,p_data) $$;
revoke all on function public.linen_ready_purchase(uuid,text,jsonb) from public,anon;
grant execute on function public.linen_ready_purchase(uuid,text,jsonb) to authenticated;
