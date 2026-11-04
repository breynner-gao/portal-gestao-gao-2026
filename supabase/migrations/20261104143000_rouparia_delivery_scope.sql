-- Protect delivery programming and operational rows with the same authorized-client scope used by Rouparia.

drop policy if exists authenticated_manage_laundry_delivery_schedules on public.laundry_delivery_schedules;
create policy laundry_delivery_schedules_scope_select
on public.laundry_delivery_schedules for select to authenticated
using (
  exists (
    select 1 from public.laundry_sectors s
    join public.laundry_units u on u.id=s.unit_id
    where s.id=laundry_delivery_schedules.sector_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
);
create policy laundry_delivery_schedules_gao_manage
on public.laundry_delivery_schedules for all to authenticated
using (
  exists (
    select 1 from public.laundry_sectors s
    join public.laundry_units u on u.id=s.unit_id
    where s.id=laundry_delivery_schedules.sector_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
  and exists (
    select 1 from public.memberships m
    join public.organizations o on o.id=m.organization_id
    where m.profile_id=(select auth.uid()) and m.active=true and o.active=true and o.kind='gao'
  )
)
with check (
  exists (
    select 1 from public.laundry_sectors s
    join public.laundry_units u on u.id=s.unit_id
    where s.id=laundry_delivery_schedules.sector_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
  and exists (
    select 1 from public.memberships m
    join public.organizations o on o.id=m.organization_id
    where m.profile_id=(select auth.uid()) and m.active=true and o.active=true and o.kind='gao'
  )
);

drop policy if exists authenticated_manage_laundry_delivery_schedule_items on public.laundry_delivery_schedule_items;
create policy laundry_delivery_schedule_items_scope_select
on public.laundry_delivery_schedule_items for select to authenticated
using (
  exists (
    select 1 from public.laundry_delivery_schedules ds
    join public.laundry_sectors s on s.id=ds.sector_id
    join public.laundry_units u on u.id=s.unit_id
    where ds.id=laundry_delivery_schedule_items.schedule_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
);
create policy laundry_delivery_schedule_items_gao_manage
on public.laundry_delivery_schedule_items for all to authenticated
using (
  exists (
    select 1 from public.laundry_delivery_schedules ds
    join public.laundry_sectors s on s.id=ds.sector_id
    join public.laundry_units u on u.id=s.unit_id
    where ds.id=laundry_delivery_schedule_items.schedule_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
  and exists (
    select 1 from public.memberships m
    join public.organizations o on o.id=m.organization_id
    where m.profile_id=(select auth.uid()) and m.active=true and o.active=true and o.kind='gao'
  )
)
with check (
  exists (
    select 1 from public.laundry_delivery_schedules ds
    join public.laundry_sectors s on s.id=ds.sector_id
    join public.laundry_units u on u.id=s.unit_id
    where ds.id=laundry_delivery_schedule_items.schedule_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
  and exists (
    select 1 from public.memberships m
    join public.organizations o on o.id=m.organization_id
    where m.profile_id=(select auth.uid()) and m.active=true and o.active=true and o.kind='gao'
  )
);

drop policy if exists authenticated_manage_laundry_deliveries on public.laundry_deliveries;
create policy laundry_deliveries_scope_select
on public.laundry_deliveries for select to authenticated
using (
  exists (
    select 1 from public.laundry_sectors s
    join public.laundry_units u on u.id=s.unit_id
    where s.id=laundry_deliveries.sector_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
);
create policy laundry_deliveries_scope_insert
on public.laundry_deliveries for insert to authenticated
with check (
  exists (
    select 1 from public.laundry_sectors s
    join public.laundry_units u on u.id=s.unit_id
    where s.id=laundry_deliveries.sector_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
);
create policy laundry_deliveries_scope_update
on public.laundry_deliveries for update to authenticated
using (
  exists (
    select 1 from public.laundry_sectors s
    join public.laundry_units u on u.id=s.unit_id
    where s.id=laundry_deliveries.sector_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
)
with check (
  exists (
    select 1 from public.laundry_sectors s
    join public.laundry_units u on u.id=s.unit_id
    where s.id=laundry_deliveries.sector_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
);

drop policy if exists authenticated_manage_laundry_delivery_items on public.laundry_delivery_items;
create policy laundry_delivery_items_scope_select
on public.laundry_delivery_items for select to authenticated
using (
  exists (
    select 1 from public.laundry_deliveries d
    join public.laundry_sectors s on s.id=d.sector_id
    join public.laundry_units u on u.id=s.unit_id
    where d.id=laundry_delivery_items.delivery_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
);
create policy laundry_delivery_items_scope_insert
on public.laundry_delivery_items for insert to authenticated
with check (
  exists (
    select 1 from public.laundry_deliveries d
    join public.laundry_sectors s on s.id=d.sector_id
    join public.laundry_units u on u.id=s.unit_id
    where d.id=laundry_delivery_items.delivery_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
);
create policy laundry_delivery_items_scope_update
on public.laundry_delivery_items for update to authenticated
using (
  exists (
    select 1 from public.laundry_deliveries d
    join public.laundry_sectors s on s.id=d.sector_id
    join public.laundry_units u on u.id=s.unit_id
    where d.id=laundry_delivery_items.delivery_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
)
with check (
  exists (
    select 1 from public.laundry_deliveries d
    join public.laundry_sectors s on s.id=d.sector_id
    join public.laundry_units u on u.id=s.unit_id
    where d.id=laundry_delivery_items.delivery_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
);
