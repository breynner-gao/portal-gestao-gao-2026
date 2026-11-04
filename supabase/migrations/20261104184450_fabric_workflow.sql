-- Durable fabric purchasing, stock, faction production and costing workflow.
-- Additive only: existing laundry/linen tables are not modified.
insert into public.permission_catalog(code, module, resource, action, label)
values
  ('textiles.inventory.view', 'enxoval', 'tecidos', 'visualizar', 'Visualizar tecidos, lotes e custos'),
  ('textiles.inventory.manage', 'enxoval', 'tecidos', 'administrar', 'Administrar tecidos, fornecedores e fichas técnicas'),
  ('textiles.production.manage', 'enxoval', 'facção', 'operar', 'Criar ordens e registrar remessas/retornos da facção')
on conflict (code) do update
set module = excluded.module, resource = excluded.resource, action = excluded.action, label = excluded.label;

insert into public.member_permissions(membership_id, permission_code, allowed)
select m.id, 'textiles.inventory.view', true
from public.memberships m
join public.organizations o on o.id = m.organization_id
where m.active and o.active and o.kind = 'gao'
  and not exists (
    select 1 from public.member_permissions mp
    where mp.membership_id = m.id and mp.permission_code = 'textiles.inventory.view'
  );

insert into public.member_permissions(membership_id, permission_code, allowed)
select m.id, 'textiles.inventory.manage', true
from public.memberships m
join public.organizations o on o.id = m.organization_id
where m.active and o.active and o.kind = 'gao' and m.role_name = 'Administrador Geral'
  and not exists (
    select 1 from public.member_permissions mp
    where mp.membership_id = m.id and mp.permission_code = 'textiles.inventory.manage'
  );

insert into public.member_permissions(membership_id, permission_code, allowed)
select m.id, 'textiles.production.manage', true
from public.memberships m
join public.organizations o on o.id = m.organization_id
where m.active and o.active and o.kind = 'gao'
  and m.role_name in ('Administrador Geral', 'Operacional')
  and not exists (
    select 1 from public.member_permissions mp
    where mp.membership_id = m.id and mp.permission_code = 'textiles.production.manage'
  );

create or replace function public.fabric_user_has_permission(p_organization_id uuid, p_permission_code text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    join public.member_permissions mp on mp.membership_id = m.id
    where m.profile_id = (select auth.uid())
      and m.organization_id = p_organization_id
      and m.active = true
      and o.active = true
      and o.kind = 'gao'
      and mp.permission_code = p_permission_code
      and mp.allowed = true
  );
$$;

create table public.fabric_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null,
  name text not null,
  fabric_type text,
  color text,
  composition text,
  width_m numeric(12,3) check (width_m is null or width_m >= 0),
  gsm numeric(12,3) check (gsm is null or gsm >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id),
  updated_by uuid references public.profiles(id),
  unique (organization_id, code),
  unique (id, organization_id)
);

create table public.fabric_suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  legal_name text not null,
  trade_name text,
  cnpj text,
  contact text,
  payment_terms text,
  lead_days integer check (lead_days is null or lead_days >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id),
  updated_by uuid references public.profiles(id),
  unique (id, organization_id)
);

create table public.fabric_lots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  fabric_id uuid not null,
  supplier_id uuid,
  lot_code text not null,
  invoice_number text,
  quantity_received_m numeric(14,3) not null check (quantity_received_m > 0),
  purchase_price_per_m numeric(14,4) not null check (purchase_price_per_m >= 0),
  freight_cost numeric(14,2) not null default 0 check (freight_cost >= 0),
  other_cost numeric(14,2) not null default 0 check (other_cost >= 0),
  effective_price_per_m numeric(14,4) not null check (effective_price_per_m >= 0),
  received_date date not null default current_date,
  quality_status text not null default 'PENDENTE'
    check (quality_status in ('PENDENTE', 'APROVADO', 'REPROVADO')),
  notes text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id),
  unique (organization_id, idempotency_key),
  unique (id, organization_id),
  foreign key (fabric_id, organization_id) references public.fabric_catalog(id, organization_id),
  foreign key (supplier_id, organization_id) references public.fabric_suppliers(id, organization_id)
);

create table public.fabric_product_recipes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  product_reference text not null,
  product_name text not null,
  fabric_id uuid not null,
  consumption_m_per_piece numeric(12,4) not null check (consumption_m_per_piece > 0),
  faction_cost_per_piece numeric(14,4) not null default 0 check (faction_cost_per_piece >= 0),
  extras_cost_per_piece numeric(14,4) not null default 0 check (extras_cost_per_piece >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id),
  updated_by uuid references public.profiles(id),
  unique (organization_id, product_reference, fabric_id),
  unique (id, organization_id),
  foreign key (fabric_id, organization_id) references public.fabric_catalog(id, organization_id)
);

create table public.fabric_production_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  order_number bigint generated always as identity,
  demand_as_of date not null,
  status text not null default 'ABERTA'
    check (status in ('ABERTA', 'PARCIAL', 'ENVIADA', 'CONCLUIDA', 'CANCELADA')),
  idempotency_key text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id),
  unique (organization_id, idempotency_key),
  unique (organization_id, order_number),
  unique (id, organization_id)
);

create table public.fabric_production_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  order_id uuid not null,
  source_item_key text not null,
  product_reference text not null,
  product_name text not null,
  recipe_id uuid not null,
  fabric_id uuid not null,
  ordered_pieces integer not null check (ordered_pieces > 0),
  consumption_m_per_piece numeric(12,4) not null check (consumption_m_per_piece > 0),
  planned_price_per_m numeric(14,4) not null default 0 check (planned_price_per_m >= 0),
  faction_cost_per_piece numeric(14,4) not null default 0 check (faction_cost_per_piece >= 0),
  extras_cost_per_piece numeric(14,4) not null default 0 check (extras_cost_per_piece >= 0),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id),
  unique (id, organization_id),
  foreign key (order_id, organization_id) references public.fabric_production_orders(id, organization_id),
  foreign key (recipe_id, organization_id) references public.fabric_product_recipes(id, organization_id),
  foreign key (fabric_id, organization_id) references public.fabric_catalog(id, organization_id)
);

create table public.fabric_stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  lot_id uuid not null,
  order_item_id uuid,
  movement_type text not null
    check (movement_type in ('RECEBIMENTO', 'RESERVA', 'LIBERA_RESERVA', 'ENVIO_FACCAO', 'RETORNO_ESTOQUE', 'AJUSTE_ENTRADA', 'AJUSTE_SAIDA')),
  quantity_m numeric(14,3) not null check (quantity_m > 0),
  stock_delta_m numeric(14,3) not null default 0,
  reserved_delta_m numeric(14,3) not null default 0,
  unit_cost_per_m numeric(14,4) not null default 0 check (unit_cost_per_m >= 0),
  idempotency_key text not null,
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references public.profiles(id),
  unique (organization_id, idempotency_key),
  foreign key (lot_id, organization_id) references public.fabric_lots(id, organization_id),
  foreign key (order_item_id, organization_id) references public.fabric_production_order_items(id, organization_id)
);

create table public.fabric_faction_returns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  order_item_id uuid not null,
  lot_id uuid,
  accepted_pieces integer not null default 0 check (accepted_pieces >= 0),
  rejected_pieces integer not null default 0 check (rejected_pieces >= 0),
  returned_m numeric(14,3) not null default 0 check (returned_m >= 0),
  faction_cost_amount numeric(14,2) not null default 0 check (faction_cost_amount >= 0),
  extras_cost_amount numeric(14,2) not null default 0 check (extras_cost_amount >= 0),
  notes text,
  returned_at timestamptz not null default now(),
  idempotency_key text not null,
  created_by uuid not null default auth.uid() references public.profiles(id),
  unique (organization_id, idempotency_key),
  foreign key (order_item_id, organization_id) references public.fabric_production_order_items(id, organization_id),
  foreign key (lot_id, organization_id) references public.fabric_lots(id, organization_id),
  check (accepted_pieces + rejected_pieces > 0 or returned_m > 0 or faction_cost_amount > 0 or extras_cost_amount > 0)
);

create index fabric_lots_fabric_idx on public.fabric_lots(organization_id, fabric_id, received_date desc);
create index fabric_recipes_product_idx on public.fabric_product_recipes(organization_id, product_reference) where active;
create index fabric_orders_status_idx on public.fabric_production_orders(organization_id, status, demand_as_of desc);
create index fabric_order_items_source_idx on public.fabric_production_order_items(organization_id, source_item_key);
create index fabric_movements_lot_idx on public.fabric_stock_movements(organization_id, lot_id, created_at);
create index fabric_movements_order_item_idx on public.fabric_stock_movements(organization_id, order_item_id, movement_type);
create index fabric_returns_order_item_idx on public.fabric_faction_returns(organization_id, order_item_id, returned_at);

alter table public.fabric_catalog enable row level security;
alter table public.fabric_suppliers enable row level security;
alter table public.fabric_lots enable row level security;
alter table public.fabric_product_recipes enable row level security;
alter table public.fabric_production_orders enable row level security;
alter table public.fabric_production_order_items enable row level security;
alter table public.fabric_stock_movements enable row level security;
alter table public.fabric_faction_returns enable row level security;

revoke all on public.fabric_catalog, public.fabric_suppliers, public.fabric_lots,
  public.fabric_product_recipes, public.fabric_production_orders,
  public.fabric_production_order_items, public.fabric_stock_movements,
  public.fabric_faction_returns from anon;
grant select, insert, update, delete on public.fabric_catalog, public.fabric_suppliers,
  public.fabric_lots, public.fabric_product_recipes to authenticated;
grant select, insert, update on public.fabric_production_orders,
  public.fabric_production_order_items, public.fabric_faction_returns to authenticated;
grant select, insert on public.fabric_stock_movements to authenticated;

grant execute on function public.fabric_user_has_permission(uuid, text) to authenticated;

create policy fabric_catalog_read on public.fabric_catalog for select to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.view')));
create policy fabric_catalog_manage on public.fabric_catalog for all to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')))
with check ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')));

create policy fabric_suppliers_read on public.fabric_suppliers for select to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.view')));
create policy fabric_suppliers_manage on public.fabric_suppliers for all to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')))
with check ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')));

create policy fabric_lots_read on public.fabric_lots for select to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.view')));
create policy fabric_lots_manage on public.fabric_lots for all to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')))
with check ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')));

create policy fabric_recipes_read on public.fabric_product_recipes for select to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.view')));
create policy fabric_recipes_manage on public.fabric_product_recipes for all to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')))
with check ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')));

create policy fabric_orders_read on public.fabric_production_orders for select to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.view')));
create policy fabric_orders_manage on public.fabric_production_orders for all to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.production.manage')))
with check ((select public.fabric_user_has_permission(organization_id, 'textiles.production.manage')));

create policy fabric_order_items_read on public.fabric_production_order_items for select to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.view')));
create policy fabric_order_items_manage on public.fabric_production_order_items for all to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.production.manage')))
with check ((select public.fabric_user_has_permission(organization_id, 'textiles.production.manage')));

create policy fabric_movements_read on public.fabric_stock_movements for select to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.view')));
create policy fabric_movements_insert on public.fabric_stock_movements for insert to authenticated
with check ((select public.fabric_user_has_permission(organization_id, 'textiles.production.manage')));

create policy fabric_returns_read on public.fabric_faction_returns for select to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.view')));
create policy fabric_returns_manage on public.fabric_faction_returns for all to authenticated
using ((select public.fabric_user_has_permission(organization_id, 'textiles.production.manage')))
with check ((select public.fabric_user_has_permission(organization_id, 'textiles.production.manage')));

create or replace function public.fabric_create_orders_for_demand(
  p_organization_id uuid,
  p_demand_as_of date,
  p_lines jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_line jsonb;
  v_order_id uuid;
  v_order_item_id uuid;
  v_recipe public.fabric_product_recipes%rowtype;
  v_requested integer;
  v_covered integer;
  v_missing integer;
  v_source_key text;
  v_item_count integer := 0;
  v_piece_count integer := 0;
  v_existing public.fabric_production_orders%rowtype;
begin
  if not public.fabric_user_has_permission(p_organization_id, 'textiles.production.manage') then
    raise exception 'Sem permissão para criar ordens de facção.';
  end if;
  if p_demand_as_of is null or p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'Data da necessidade e chave de idempotência válida são obrigatórias.';
  end if;
  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'A lista de necessidades deve ser uma matriz JSON.';
  end if;

  select * into v_existing
  from public.fabric_production_orders
  where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number,
      'created', false, 'covered', true, 'item_count', 0, 'piece_count', 0);
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_source_key := nullif(trim(v_line->>'source_item_key'), '');
    v_requested := greatest(0, coalesce((v_line->>'requested_pieces')::integer, 0));
    if v_source_key is null or v_requested <= 0 then
      continue;
    end if;
    perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || v_source_key, 0));

    if not exists (
      select 1 from public.fabric_product_recipes r
      where r.id = (v_line->>'recipe_id')::uuid
        and r.organization_id = p_organization_id and r.active
    ) then
      raise exception 'A peça % não possui ficha técnica ativa para a organização.', v_source_key;
    end if;
    select * into v_recipe from public.fabric_product_recipes r
      where r.id = (v_line->>'recipe_id')::uuid
        and r.organization_id = p_organization_id and r.active;

    select coalesce(sum(greatest(i.ordered_pieces - coalesce(ret.accepted, 0), 0)), 0)::integer
      into v_covered
    from public.fabric_production_order_items i
    join public.fabric_production_orders o
      on o.id = i.order_id and o.organization_id = i.organization_id
    left join lateral (
      select sum(fr.accepted_pieces)::integer as accepted
      from public.fabric_faction_returns fr
      where fr.organization_id = i.organization_id and fr.order_item_id = i.id
    ) ret on true
    where i.organization_id = p_organization_id
      and i.source_item_key = v_source_key
      and i.recipe_id = v_recipe.id
      and o.status in ('ABERTA', 'PARCIAL', 'ENVIADA');

    v_missing := greatest(0, v_requested - v_covered);
    if v_missing = 0 then
      continue;
    end if;

    if v_order_id is null then
      insert into public.fabric_production_orders(
        organization_id, demand_as_of, status, idempotency_key, created_by
      ) values (
        p_organization_id, p_demand_as_of, 'ABERTA', p_idempotency_key, (select auth.uid())
      ) returning id into v_order_id;
    end if;

    insert into public.fabric_production_order_items(
      organization_id, order_id, source_item_key, product_reference, product_name,
      recipe_id, fabric_id, ordered_pieces, consumption_m_per_piece,
      planned_price_per_m, faction_cost_per_piece, extras_cost_per_piece, created_by
    ) values (
      p_organization_id, v_order_id, v_source_key,
      coalesce(nullif(trim(v_line->>'product_reference'), ''), v_source_key),
      coalesce(nullif(trim(v_line->>'product_name'), ''), v_recipe.product_name),
      v_recipe.id, v_recipe.fabric_id, v_missing, v_recipe.consumption_m_per_piece,
      coalesce((v_line->>'planned_price_per_m')::numeric, 0),
      v_recipe.faction_cost_per_piece, v_recipe.extras_cost_per_piece, (select auth.uid())
    ) returning id into v_order_item_id;
    v_item_count := v_item_count + 1;
    v_piece_count := v_piece_count + v_missing;
  end loop;

  if v_order_id is null then
    return jsonb_build_object('order_id', null, 'created', false, 'covered', true, 'item_count', 0, 'piece_count', 0);
  end if;
  return jsonb_build_object('order_id', v_order_id, 'created', true, 'covered', false,
    'item_count', v_item_count, 'piece_count', v_piece_count);
end;
$$;

create or replace function public.fabric_record_receipt(
  p_organization_id uuid,
  p_fabric_id uuid,
  p_supplier_id uuid,
  p_lot_code text,
  p_invoice_number text,
  p_quantity_m numeric,
  p_purchase_price_per_m numeric,
  p_freight_cost numeric,
  p_other_cost numeric,
  p_received_date date,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lot_id uuid;
  v_effective_price numeric(14,4);
begin
  if not public.fabric_user_has_permission(p_organization_id, 'textiles.inventory.manage') then
    raise exception 'Sem permissão para registrar recebimento de tecido.';
  end if;
  if p_quantity_m is null or p_quantity_m <= 0 or p_purchase_price_per_m is null or p_purchase_price_per_m < 0 then
    raise exception 'Quantidade e preço do tecido inválidos.';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'Chave de idempotência inválida.';
  end if;
  select id into v_lot_id from public.fabric_lots
    where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if v_lot_id is not null then
    return jsonb_build_object('lot_id', v_lot_id, 'created', false);
  end if;
  v_effective_price := p_purchase_price_per_m
    + (greatest(0, coalesce(p_freight_cost, 0)) + greatest(0, coalesce(p_other_cost, 0))) / p_quantity_m;
  insert into public.fabric_lots(
    organization_id, fabric_id, supplier_id, lot_code, invoice_number, quantity_received_m,
    purchase_price_per_m, freight_cost, other_cost, effective_price_per_m,
    received_date, quality_status, idempotency_key, created_by
  ) values (
    p_organization_id, p_fabric_id, p_supplier_id, nullif(trim(p_lot_code), ''),
    nullif(trim(p_invoice_number), ''), p_quantity_m, p_purchase_price_per_m,
    greatest(0, coalesce(p_freight_cost, 0)), greatest(0, coalesce(p_other_cost, 0)),
    v_effective_price, coalesce(p_received_date, current_date), 'PENDENTE',
    p_idempotency_key, (select auth.uid())
  ) returning id into v_lot_id;

  insert into public.fabric_stock_movements(
    organization_id, lot_id, movement_type, quantity_m, stock_delta_m,
    reserved_delta_m, unit_cost_per_m, idempotency_key, notes, created_by
  ) values (
    p_organization_id, v_lot_id, 'RECEBIMENTO', p_quantity_m, p_quantity_m,
    0, v_effective_price, p_idempotency_key || ':entrada', 'Entrada do lote recebido.', (select auth.uid())
  );
  return jsonb_build_object('lot_id', v_lot_id, 'created', true, 'effective_price_per_m', v_effective_price);
end;
$$;

create or replace function public.fabric_post_stock_movement(
  p_organization_id uuid,
  p_lot_id uuid,
  p_movement_type text,
  p_quantity_m numeric,
  p_order_item_id uuid,
  p_idempotency_key text,
  p_notes text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing uuid;
  v_fabric_id uuid;
  v_unit_cost numeric(14,4);
  v_on_hand numeric(14,3);
  v_reserved numeric(14,3);
  v_reserved_for_item numeric(14,3);
  v_free numeric(14,3);
  v_stock_delta numeric(14,3) := 0;
  v_reserved_delta numeric(14,3) := 0;
begin
  if not public.fabric_user_has_permission(p_organization_id, 'textiles.production.manage') then
    raise exception 'Sem permissão para movimentar tecido.';
  end if;
  if p_quantity_m is null or p_quantity_m <= 0 or p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'Quantidade e chave de idempotência válidas são obrigatórias.';
  end if;
  select id into v_existing from public.fabric_stock_movements
    where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if v_existing is not null then
    return jsonb_build_object('movement_id', v_existing, 'created', false);
  end if;
  select fabric_id, effective_price_per_m into v_fabric_id, v_unit_cost
    from public.fabric_lots where id = p_lot_id and organization_id = p_organization_id for update;
  if v_fabric_id is null then raise exception 'Lote de tecido não encontrado.'; end if;

  select coalesce(sum(stock_delta_m), 0) into v_on_hand
    from public.fabric_stock_movements where organization_id = p_organization_id and lot_id = p_lot_id;
  select coalesce(sum(reserved_delta_m), 0) into v_reserved
    from public.fabric_stock_movements where organization_id = p_organization_id and lot_id = p_lot_id;
  v_free := greatest(0, v_on_hand - v_reserved);

  if p_movement_type in ('RESERVA', 'LIBERA_RESERVA', 'ENVIO_FACCAO') then
    if p_order_item_id is null or not exists (
      select 1 from public.fabric_production_order_items i
      where i.id = p_order_item_id and i.organization_id = p_organization_id and i.fabric_id = v_fabric_id
    ) then raise exception 'Informe uma ordem válida para este tecido.'; end if;
  end if;

  if p_movement_type = 'RESERVA' then
    if p_quantity_m > v_free then raise exception 'Saldo livre insuficiente para reservar.'; end if;
    v_reserved_delta := p_quantity_m;
  elsif p_movement_type = 'LIBERA_RESERVA' then
    select coalesce(sum(reserved_delta_m), 0) into v_reserved_for_item
      from public.fabric_stock_movements
      where organization_id = p_organization_id and lot_id = p_lot_id and order_item_id = p_order_item_id;
    if p_quantity_m > v_reserved_for_item then raise exception 'A liberação excede o saldo reservado desta ordem.'; end if;
    v_reserved_delta := -p_quantity_m;
  elsif p_movement_type = 'ENVIO_FACCAO' then
    select coalesce(sum(reserved_delta_m), 0) into v_reserved_for_item
      from public.fabric_stock_movements
      where organization_id = p_organization_id and lot_id = p_lot_id and order_item_id = p_order_item_id;
    if p_quantity_m > v_reserved_for_item and p_quantity_m - v_reserved_for_item > v_free then
      raise exception 'Saldo de tecido insuficiente para enviar à facção.';
    end if;
    v_stock_delta := -p_quantity_m;
    v_reserved_delta := -least(p_quantity_m, v_reserved_for_item);
  elsif p_movement_type = 'AJUSTE_ENTRADA' then
    v_stock_delta := p_quantity_m;
  elsif p_movement_type = 'AJUSTE_SAIDA' then
    if p_quantity_m > v_free then raise exception 'Ajuste de saída excede o saldo livre.'; end if;
    v_stock_delta := -p_quantity_m;
  else
    raise exception 'Tipo de movimento não permitido.';
  end if;

  insert into public.fabric_stock_movements(
    organization_id, lot_id, order_item_id, movement_type, quantity_m,
    stock_delta_m, reserved_delta_m, unit_cost_per_m, idempotency_key, notes, created_by
  ) values (
    p_organization_id, p_lot_id, p_order_item_id, p_movement_type, p_quantity_m,
    v_stock_delta, v_reserved_delta, v_unit_cost, p_idempotency_key, nullif(trim(p_notes), ''), (select auth.uid())
  ) returning id into v_existing;
  return jsonb_build_object('movement_id', v_existing, 'created', true);
end;
$$;

create or replace function public.fabric_record_faction_return(
  p_organization_id uuid,
  p_order_item_id uuid,
  p_lot_id uuid,
  p_accepted_pieces integer,
  p_rejected_pieces integer,
  p_returned_m numeric,
  p_faction_cost_amount numeric,
  p_extras_cost_amount numeric,
  p_notes text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_return_id uuid;
  v_order_id uuid;
  v_fabric_id uuid;
  v_ordered integer;
  v_produced integer;
  v_issued_m numeric(14,3);
  v_returned_m numeric(14,3);
  v_lot_fabric uuid;
  v_lot_cost numeric(14,4);
begin
  if not public.fabric_user_has_permission(p_organization_id, 'textiles.production.manage') then
    raise exception 'Sem permissão para registrar retorno da facção.';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8
    or coalesce(p_accepted_pieces, 0) < 0 or coalesce(p_rejected_pieces, 0) < 0
    or coalesce(p_returned_m, 0) < 0 or coalesce(p_faction_cost_amount, 0) < 0
    or coalesce(p_extras_cost_amount, 0) < 0 then
    raise exception 'Dados de retorno inválidos.';
  end if;
  select id into v_return_id from public.fabric_faction_returns
    where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if v_return_id is not null then return jsonb_build_object('return_id', v_return_id, 'created', false); end if;

  select i.order_id, i.fabric_id, i.ordered_pieces into v_order_id, v_fabric_id, v_ordered
    from public.fabric_production_order_items i
    where i.id = p_order_item_id and i.organization_id = p_organization_id for update;
  if v_order_id is null then raise exception 'Item da ordem não encontrado.'; end if;
  select coalesce(sum(accepted_pieces + rejected_pieces), 0) into v_produced
    from public.fabric_faction_returns where organization_id = p_organization_id and order_item_id = p_order_item_id;
  if v_produced + coalesce(p_accepted_pieces, 0) + coalesce(p_rejected_pieces, 0) > v_ordered then
    raise exception 'O retorno excede a quantidade planejada na ordem.';
  end if;

  if coalesce(p_returned_m, 0) > 0 then
    if p_lot_id is null then raise exception 'Informe o lote de origem para devolver tecido ao estoque.'; end if;
    select l.fabric_id, l.effective_price_per_m into v_lot_fabric, v_lot_cost
      from public.fabric_lots l where l.id = p_lot_id and l.organization_id = p_organization_id for update;
    if v_lot_fabric is distinct from v_fabric_id then raise exception 'O lote informado não corresponde ao tecido da ordem.'; end if;
    select coalesce(sum(quantity_m), 0) into v_issued_m from public.fabric_stock_movements
      where organization_id = p_organization_id and order_item_id = p_order_item_id
        and lot_id = p_lot_id and movement_type = 'ENVIO_FACCAO';
    select coalesce(sum(returned_m), 0) into v_returned_m from public.fabric_faction_returns
      where organization_id = p_organization_id and order_item_id = p_order_item_id and lot_id = p_lot_id;
    if p_returned_m > v_issued_m - v_returned_m then raise exception 'O retorno excede o tecido enviado à facção neste lote.'; end if;
  end if;

  insert into public.fabric_faction_returns(
    organization_id, order_item_id, lot_id, accepted_pieces, rejected_pieces,
    returned_m, faction_cost_amount, extras_cost_amount, notes, idempotency_key, created_by
  ) values (
    p_organization_id, p_order_item_id, p_lot_id, coalesce(p_accepted_pieces, 0),
    coalesce(p_rejected_pieces, 0), coalesce(p_returned_m, 0),
    coalesce(p_faction_cost_amount, 0), coalesce(p_extras_cost_amount, 0),
    nullif(trim(p_notes), ''), p_idempotency_key, (select auth.uid())
  ) returning id into v_return_id;

  if coalesce(p_returned_m, 0) > 0 then
    insert into public.fabric_stock_movements(
      organization_id, lot_id, order_item_id, movement_type, quantity_m,
      stock_delta_m, reserved_delta_m, unit_cost_per_m, idempotency_key, notes, created_by
    ) values (
      p_organization_id, p_lot_id, p_order_item_id, 'RETORNO_ESTOQUE', p_returned_m,
      p_returned_m, 0, v_lot_cost, p_idempotency_key || ':retorno', 'Sobra retornada pela facção.', (select auth.uid())
    );
  end if;
  return jsonb_build_object('return_id', v_return_id, 'created', true);
end;
$$;

revoke all on function public.fabric_user_has_permission(uuid, text) from public, anon;
revoke all on function public.fabric_create_orders_for_demand(uuid, date, jsonb, text) from public, anon;
revoke all on function public.fabric_record_receipt(uuid, uuid, uuid, text, text, numeric, numeric, numeric, numeric, date, text) from public, anon;
revoke all on function public.fabric_post_stock_movement(uuid, uuid, text, numeric, uuid, text, text) from public, anon;
revoke all on function public.fabric_record_faction_return(uuid, uuid, uuid, integer, integer, numeric, numeric, numeric, text, text) from public, anon;
grant execute on function public.fabric_user_has_permission(uuid, text) to authenticated;
grant execute on function public.fabric_create_orders_for_demand(uuid, date, jsonb, text) to authenticated;
grant execute on function public.fabric_record_receipt(uuid, uuid, uuid, text, text, numeric, numeric, numeric, numeric, date, text) to authenticated;
grant execute on function public.fabric_post_stock_movement(uuid, uuid, text, numeric, uuid, text, text) to authenticated;
grant execute on function public.fabric_record_faction_return(uuid, uuid, uuid, integer, integer, numeric, numeric, numeric, text, text) to authenticated;
