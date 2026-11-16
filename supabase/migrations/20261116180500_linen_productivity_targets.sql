create table public.linen_productivity_targets (
  organization_id uuid not null references public.organizations(id),
  activity text not null check (activity in (
    'return','supply','invoice','quality','tag','inspect_used','sewing_receive',
    'sewing_return','discard','client_separate','client_close'
  )),
  effective_on date not null,
  target integer not null check (target between 1 and 1000000),
  primary key (organization_id, activity, effective_on)
);

alter table public.linen_productivity_targets enable row level security;
revoke all on public.linen_productivity_targets from public, anon, authenticated;
grant select, insert, update on public.linen_productivity_targets to authenticated;

create policy linen_productivity_targets_read on public.linen_productivity_targets
for select to authenticated
using (public.fabric_user_has_permission(organization_id,'textiles.inventory.view'));

create policy linen_productivity_targets_insert on public.linen_productivity_targets
for insert to authenticated
with check (
  public.fabric_user_has_permission(organization_id,'textiles.inventory.view') and
  public.fabric_user_has_permission(organization_id,'textiles.inventory.manage')
);

create policy linen_productivity_targets_update on public.linen_productivity_targets
for update to authenticated
using (
  public.fabric_user_has_permission(organization_id,'textiles.inventory.view') and
  public.fabric_user_has_permission(organization_id,'textiles.inventory.manage')
)
with check (
  public.fabric_user_has_permission(organization_id,'textiles.inventory.view') and
  public.fabric_user_has_permission(organization_id,'textiles.inventory.manage')
);
