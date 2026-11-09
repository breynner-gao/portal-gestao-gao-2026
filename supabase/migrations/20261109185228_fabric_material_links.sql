create table public.fabric_material_links (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 product_reference text not null,
 product_name text not null,
 consumption_reference_id uuid not null references public.fabric_consumption_references(id),
 fabric_id uuid,
 cost_reference_id uuid references public.fabric_product_cost_references(id),
 resolution_note text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid not null references public.profiles(id),
 unique(organization_id,product_reference),
 foreign key(fabric_id,organization_id) references public.fabric_catalog(id,organization_id)
);
alter table public.fabric_material_links enable row level security;
revoke all on public.fabric_material_links from anon;
grant select,insert,update on public.fabric_material_links to authenticated;
create policy material_links_read on public.fabric_material_links for select to authenticated
using(public.fabric_user_has_permission(organization_id,'textiles.inventory.view'));
create policy material_links_manage on public.fabric_material_links for all to authenticated
using(public.fabric_user_has_permission(organization_id,'textiles.inventory.manage'))
with check(public.fabric_user_has_permission(organization_id,'textiles.inventory.manage')
 and exists(select 1 from public.fabric_consumption_references r where r.id=consumption_reference_id and r.organization_id=fabric_material_links.organization_id)
 and (cost_reference_id is null or exists(select 1 from public.fabric_product_cost_references r where r.id=cost_reference_id and r.organization_id=fabric_material_links.organization_id)));
create trigger fabric_material_links_audit after insert or update on public.fabric_material_links for each row execute function public.fabric_audit_production();

