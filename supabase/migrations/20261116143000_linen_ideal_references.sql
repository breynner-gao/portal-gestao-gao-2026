create table public.linen_ideal_references (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_key text not null check (length(product_key) between 4 and 400),
  ideal numeric not null check (ideal between 0.1 and 99),
  primary key (organization_id, product_key)
);

alter table public.linen_ideal_references enable row level security;
grant select, insert, update on public.linen_ideal_references to authenticated;

create policy linen_ideal_references_read on public.linen_ideal_references
for select to authenticated
using (public.fabric_user_has_permission(organization_id, 'textiles.inventory.view'));

create policy linen_ideal_references_insert on public.linen_ideal_references
for insert to authenticated
with check (
  public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')
  or public.fabric_user_has_permission(organization_id, 'textiles.production.manage')
);

create policy linen_ideal_references_update on public.linen_ideal_references
for update to authenticated
using (
  public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')
  or public.fabric_user_has_permission(organization_id, 'textiles.production.manage')
)
with check (
  public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')
  or public.fabric_user_has_permission(organization_id, 'textiles.production.manage')
);
