create table if not exists public.fabric_consumption_references (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  source_workbook text not null,
  source_sheet text not null,
  source_row integer not null,
  source_date date,
  product_code text,
  product_name text not null,
  size text,
  fabric_description text,
  color_description text,
  consumption_m_per_piece numeric(12,4) not null check (consumption_m_per_piece > 0),
  variant_key text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, source_row)
);

create index if not exists fabric_consumption_references_variant_idx
  on public.fabric_consumption_references (organization_id, variant_key, source_date desc, source_row desc);

alter table public.fabric_consumption_references enable row level security;
revoke all on public.fabric_consumption_references from anon;
grant select on public.fabric_consumption_references to authenticated;

drop policy if exists fabric_consumption_references_read on public.fabric_consumption_references;
create policy fabric_consumption_references_read
  on public.fabric_consumption_references for select to authenticated
  using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.view')));

comment on table public.fabric_consumption_references is
  'Confidential reference history imported from the GAO Pedido Produção workbook; read-only for portal users.';
