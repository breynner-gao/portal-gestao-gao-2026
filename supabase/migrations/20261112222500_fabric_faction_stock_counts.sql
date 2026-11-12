create table public.fabric_faction_stock_counts (
 organization_id uuid not null references public.organizations(id),
 source_key text not null,
 line_no integer not null check (line_no > 0),
 reported_on date not null,
 counted_on date,
 material text not null check (length(trim(material)) > 0),
 supplier_or_brand text,
 width_m numeric(8,3) check (width_m > 0),
 reported_m numeric(14,3) not null,
 physical_m numeric(14,3) check (physical_m >= 0),
 created_at timestamptz not null default now(),
 primary key (organization_id, source_key, line_no)
);
alter table public.fabric_faction_stock_counts enable row level security;
revoke all on public.fabric_faction_stock_counts from public, anon, authenticated;
grant select on public.fabric_faction_stock_counts to authenticated;
create policy fabric_faction_stock_counts_read on public.fabric_faction_stock_counts
 for select to authenticated
 using ((select public.fabric_user_has_permission(organization_id, 'textiles.inventory.view')));
