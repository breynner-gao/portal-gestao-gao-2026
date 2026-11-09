create table if not exists public.fabric_product_cost_references (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  source_workbook text not null,
  source_sheet text not null,
  source_block text not null,
  source_row integer not null,
  product_name text,
  fabric_description text,
  color_description text,
  supplier_name text,
  quantity numeric(14,4),
  consumption_m_per_piece numeric(12,4) check (consumption_m_per_piece is null or consumption_m_per_piece > 0),
  fabric_price_per_m numeric(14,4) check (fabric_price_per_m is null or fabric_price_per_m >= 0),
  fabric_cost_per_piece numeric(14,4) check (fabric_cost_per_piece is null or fabric_cost_per_piece >= 0),
  faction_cost_per_piece numeric(14,4) check (faction_cost_per_piece is null or faction_cost_per_piece >= 0),
  label_cost_per_piece numeric(14,4) check (label_cost_per_piece is null or label_cost_per_piece >= 0),
  rfid_cost_per_piece numeric(14,4) check (rfid_cost_per_piece is null or rfid_cost_per_piece >= 0),
  extras_cost_per_piece numeric(14,4) check (extras_cost_per_piece is null or extras_cost_per_piece >= 0),
  total_cost_per_piece numeric(14,4) check (total_cost_per_piece is null or total_cost_per_piece >= 0),
  product_match_note text,
  created_at timestamptz not null default now(),
  unique (organization_id, source_sheet, source_block, source_row),
  unique (id, organization_id)
);

create index if not exists fabric_product_cost_references_product_idx
  on public.fabric_product_cost_references (organization_id, product_name, source_block);

alter table public.fabric_product_cost_references enable row level security;
revoke all on public.fabric_product_cost_references from anon;
grant select on public.fabric_product_cost_references to authenticated;
drop policy if exists fabric_product_cost_references_read on public.fabric_product_cost_references;
create policy fabric_product_cost_references_read
  on public.fabric_product_cost_references for select to authenticated
  using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.view')));

alter table public.fabric_product_recipes
  add column if not exists cost_reference_id uuid,
  add column if not exists label_cost_per_piece numeric(14,4) not null default 0 check (label_cost_per_piece >= 0),
  add column if not exists rfid_cost_per_piece numeric(14,4) not null default 0 check (rfid_cost_per_piece >= 0);

do $$ begin
  alter table public.fabric_product_recipes
    add constraint fabric_recipe_cost_reference_fk
    foreign key (cost_reference_id, organization_id)
    references public.fabric_product_cost_references(id, organization_id);
exception when duplicate_object then null;
end $$;

comment on table public.fabric_product_cost_references is
  'Private, read-only per-piece cost source imported from the GAO Custo de Produção worksheet.';
