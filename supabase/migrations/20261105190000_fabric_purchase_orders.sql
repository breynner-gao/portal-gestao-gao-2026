-- Supplier purchase orders are tracked separately from physical fabric stock.
create table public.fabric_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  supplier_id uuid not null,
  order_number text not null,
  ordered_date date not null default current_date,
  expected_date date,
  status text not null default 'ABERTA'
    check (status in ('ABERTA','PARCIAL','RECEBIDA','CANCELADA')),
  notes text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id),
  unique (organization_id, idempotency_key),
  unique (organization_id, supplier_id, order_number),
  unique (id, organization_id),
  foreign key (supplier_id, organization_id) references public.fabric_suppliers(id, organization_id)
);

create table public.fabric_purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  purchase_order_id uuid not null,
  fabric_id uuid not null,
  ordered_m numeric(14,3) not null check (ordered_m > 0),
  received_m numeric(14,3) not null default 0 check (received_m >= 0 and received_m <= ordered_m),
  purchase_price_per_m numeric(14,4) not null check (purchase_price_per_m >= 0),
  expected_date date,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id),
  unique (id, organization_id),
  foreign key (purchase_order_id, organization_id) references public.fabric_purchase_orders(id, organization_id),
  foreign key (fabric_id, organization_id) references public.fabric_catalog(id, organization_id)
);

create table public.fabric_purchase_order_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  purchase_order_item_id uuid not null,
  lot_id uuid not null,
  quantity_received_m numeric(14,3) not null check (quantity_received_m > 0),
  invoice_number text,
  received_at date not null default current_date,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id),
  unique (organization_id, idempotency_key),
  foreign key (purchase_order_item_id, organization_id) references public.fabric_purchase_order_items(id, organization_id),
  foreign key (lot_id, organization_id) references public.fabric_lots(id, organization_id)
);

create index fabric_purchase_orders_org_status_idx
  on public.fabric_purchase_orders(organization_id, status, ordered_date desc);
create index fabric_purchase_items_order_idx
  on public.fabric_purchase_order_items(organization_id, purchase_order_id);
create index fabric_purchase_receipts_item_idx
  on public.fabric_purchase_order_receipts(organization_id, purchase_order_item_id, received_at desc);

alter table public.fabric_purchase_orders enable row level security;
alter table public.fabric_purchase_order_items enable row level security;
alter table public.fabric_purchase_order_receipts enable row level security;

create policy fabric_purchase_orders_read on public.fabric_purchase_orders for select to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.view')));
create policy fabric_purchase_orders_manage on public.fabric_purchase_orders for all to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')))
with check ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')));

create policy fabric_purchase_items_read on public.fabric_purchase_order_items for select to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.view')));
create policy fabric_purchase_items_manage on public.fabric_purchase_order_items for all to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')))
with check ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')));

create policy fabric_purchase_receipts_read on public.fabric_purchase_order_receipts for select to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.view')));
create policy fabric_purchase_receipts_manage on public.fabric_purchase_order_receipts for all to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')))
with check ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')));

create or replace function public.fabric_create_purchase_order(
  p_organization_id uuid,
  p_supplier_id uuid,
  p_order_number text,
  p_ordered_date date,
  p_expected_date date,
  p_lines jsonb,
  p_notes text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order_id uuid;
  v_existing public.fabric_purchase_orders%rowtype;
  v_line jsonb;
  v_item_count integer := 0;
begin
  if not public.fabric_user_has_permission(p_organization_id, 'textiles.inventory.manage') then
    raise exception 'Sem permissão para registrar pedido de tecido.';
  end if;
  if p_supplier_id is null or nullif(trim(p_order_number), '') is null
     or p_idempotency_key is null or length(trim(p_idempotency_key)) < 8
     or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Fornecedor, número do pedido e pelo menos um item são obrigatórios.';
  end if;
  select * into v_existing from public.fabric_purchase_orders
   where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if found then
    return jsonb_build_object('purchase_order_id',v_existing.id,'created',false);
  end if;
  if not exists(select 1 from public.fabric_suppliers s where s.id=p_supplier_id and s.organization_id=p_organization_id and s.active) then
    raise exception 'Fornecedor não encontrado ou inativo.';
  end if;
  insert into public.fabric_purchase_orders(
    organization_id,supplier_id,order_number,ordered_date,expected_date,status,notes,idempotency_key,created_by
  ) values (
    p_organization_id,p_supplier_id,trim(p_order_number),coalesce(p_ordered_date,current_date),
    p_expected_date,'ABERTA',nullif(trim(p_notes),''),p_idempotency_key,(select auth.uid())
  ) returning id into v_order_id;
  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if coalesce((v_line->>'ordered_m')::numeric,0)<=0
       or coalesce((v_line->>'purchase_price_per_m')::numeric,-1)<0
       or not exists(select 1 from public.fabric_catalog f where f.id=(v_line->>'fabric_id')::uuid and f.organization_id=p_organization_id and f.active) then
      raise exception 'Item do pedido inválido: selecione tecido cadastrado, quantidade e preço válidos.';
    end if;
    insert into public.fabric_purchase_order_items(
      organization_id,purchase_order_id,fabric_id,ordered_m,purchase_price_per_m,expected_date,notes,created_by
    ) values (
      p_organization_id,v_order_id,(v_line->>'fabric_id')::uuid,(v_line->>'ordered_m')::numeric,
      (v_line->>'purchase_price_per_m')::numeric,coalesce((v_line->>'expected_date')::date,p_expected_date),
      nullif(trim(v_line->>'notes'),''),(select auth.uid())
    );
    v_item_count:=v_item_count+1;
  end loop;
  return jsonb_build_object('purchase_order_id',v_order_id,'created',true,'item_count',v_item_count);
end;
$$;

create or replace function public.fabric_receive_purchase_order_item(
  p_organization_id uuid,
  p_purchase_order_item_id uuid,
  p_quantity_m numeric,
  p_lot_code text,
  p_invoice_number text,
  p_received_date date,
  p_freight_cost numeric,
  p_other_cost numeric,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing public.fabric_purchase_order_receipts%rowtype;
  v_item public.fabric_purchase_order_items%rowtype;
  v_order public.fabric_purchase_orders%rowtype;
  v_lot_id uuid;
  v_receipt jsonb;
  v_new_received numeric(14,3);
begin
  if not public.fabric_user_has_permission(p_organization_id, 'textiles.inventory.manage') then
    raise exception 'Sem permissão para registrar recebimento de tecido.';
  end if;
  if p_quantity_m is null or p_quantity_m<=0 or nullif(trim(p_lot_code),'') is null
     or p_idempotency_key is null or length(trim(p_idempotency_key))<8 then
    raise exception 'Lote, quantidade e chave de recebimento são obrigatórios.';
  end if;
  select * into v_existing from public.fabric_purchase_order_receipts
   where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('receipt_id',v_existing.id,'lot_id',v_existing.lot_id,'created',false); end if;
  select * into v_item from public.fabric_purchase_order_items
   where id=p_purchase_order_item_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Item do pedido não encontrado.'; end if;
  select * into v_order from public.fabric_purchase_orders
   where id=v_item.purchase_order_id and organization_id=p_organization_id for update;
  if v_order.status in ('CANCELADA','RECEBIDA') then raise exception 'Este pedido não aceita novo recebimento.'; end if;
  if p_quantity_m>v_item.ordered_m-v_item.received_m then
    raise exception 'Quantidade recebida excede o saldo pendente do pedido.';
  end if;
  v_receipt:=public.fabric_record_receipt(
    p_organization_id,v_item.fabric_id,v_order.supplier_id,
    trim(p_lot_code),nullif(trim(p_invoice_number),''),p_quantity_m,
    v_item.purchase_price_per_m,coalesce(p_freight_cost,0),coalesce(p_other_cost,0),
    coalesce(p_received_date,current_date),p_idempotency_key||':stock'
  );
  v_lot_id:=(v_receipt->>'lot_id')::uuid;
  if v_lot_id is null then raise exception 'Não foi possível criar o lote de recebimento.'; end if;
  insert into public.fabric_purchase_order_receipts(
    organization_id,purchase_order_item_id,lot_id,quantity_received_m,invoice_number,received_at,idempotency_key,created_by
  ) values (
    p_organization_id,v_item.id,v_lot_id,p_quantity_m,nullif(trim(p_invoice_number),''),coalesce(p_received_date,current_date),p_idempotency_key,(select auth.uid())
  ) returning * into v_existing;
  update public.fabric_purchase_order_items
     set received_m=received_m+p_quantity_m
   where id=v_item.id and organization_id=p_organization_id
   returning received_m into v_new_received;
  update public.fabric_purchase_orders o
     set status=case
       when (select bool_and(i.received_m>=i.ordered_m) from public.fabric_purchase_order_items i where i.purchase_order_id=o.id and i.organization_id=o.organization_id) then 'RECEBIDA'
       when exists(select 1 from public.fabric_purchase_order_items i where i.purchase_order_id=o.id and i.organization_id=o.organization_id and i.received_m>0) then 'PARCIAL'
       else 'ABERTA' end,
         updated_at=now()
   where o.id=v_order.id and o.organization_id=p_organization_id;
  return jsonb_build_object('receipt_id',v_existing.id,'lot_id',v_lot_id,'received_m',v_new_received,'created',true);
end;
$$;

revoke all on function public.fabric_create_purchase_order(uuid,uuid,text,date,date,jsonb,text,text) from public,anon;
revoke all on function public.fabric_receive_purchase_order_item(uuid,uuid,numeric,text,text,date,numeric,numeric,text) from public,anon;
grant execute on function public.fabric_create_purchase_order(uuid,uuid,text,date,date,jsonb,text,text) to authenticated;
grant execute on function public.fabric_receive_purchase_order_item(uuid,uuid,numeric,text,text,date,numeric,numeric,text) to authenticated;
