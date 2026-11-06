-- Share the current RFID planning snapshot across authorized GAO devices.
create table public.linen_rfid_snapshots (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  rows jsonb not null check (jsonb_typeof(rows) = 'array'),
  file_name text not null default '',
  source_sheet text not null default '',
  source_rule text not null default '',
  as_of date,
  informed_at date,
  updated_at timestamptz not null default now(),
  updated_by uuid not null default auth.uid() references public.profiles(id)
);
alter table public.linen_rfid_snapshots enable row level security;
grant select, insert, update on public.linen_rfid_snapshots to authenticated;
create policy linen_rfid_snapshots_read on public.linen_rfid_snapshots
for select to authenticated
using (public.fabric_user_has_permission(organization_id, 'textiles.inventory.view'));
create policy linen_rfid_snapshots_insert on public.linen_rfid_snapshots
for insert to authenticated
with check (
  public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')
  or public.fabric_user_has_permission(organization_id, 'textiles.production.manage')
);
create policy linen_rfid_snapshots_update on public.linen_rfid_snapshots
for update to authenticated
using (
  public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')
  or public.fabric_user_has_permission(organization_id, 'textiles.production.manage')
)
with check (
  public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage')
  or public.fabric_user_has_permission(organization_id, 'textiles.production.manage')
);
