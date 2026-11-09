-- Scope Rouparia requests and occurrences to the user's authorized laundry clients.
-- GAO organization members manage request state; requesters may only cancel their own pending request.

drop policy if exists authenticated_manage_laundry_extra_requests on public.laundry_extra_requests;

create policy laundry_extra_requests_scope_select
on public.laundry_extra_requests
for select to authenticated
using (
  exists (
    select 1
    from public.laundry_sectors s
    join public.laundry_units u on u.id = s.unit_id
    where s.id = laundry_extra_requests.sector_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
);

create policy laundry_extra_requests_scope_insert
on public.laundry_extra_requests
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.laundry_sectors s
    join public.laundry_units u on u.id = s.unit_id
    where s.id = laundry_extra_requests.sector_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
);

create policy laundry_extra_requests_gao_update
on public.laundry_extra_requests
for update to authenticated
using (
  exists (
    select 1
    from public.laundry_sectors s
    join public.laundry_units u on u.id = s.unit_id
    where s.id = laundry_extra_requests.sector_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
  and exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.profile_id = (select auth.uid())
      and m.active = true
      and o.active = true
      and o.kind = 'gao'
  )
)
with check (
  exists (
    select 1
    from public.laundry_sectors s
    join public.laundry_units u on u.id = s.unit_id
    where s.id = laundry_extra_requests.sector_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
  and exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.profile_id = (select auth.uid())
      and m.active = true
      and o.active = true
      and o.kind = 'gao'
  )
);

create policy laundry_extra_requests_creator_cancel
on public.laundry_extra_requests
for update to authenticated
using (
  created_by = (select auth.uid())
  and status = 'PENDENTE'
  and exists (
    select 1
    from public.laundry_sectors s
    join public.laundry_units u on u.id = s.unit_id
    where s.id = laundry_extra_requests.sector_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
)
with check (
  created_by = (select auth.uid())
  and status = 'CANCELADA'
  and exists (
    select 1
    from public.laundry_sectors s
    join public.laundry_units u on u.id = s.unit_id
    where s.id = laundry_extra_requests.sector_id
      and public.gao_can_access_laundry_client(u.client_id)
  )
);

drop policy if exists quality_occurrences_select on public.quality_occurrences;
drop policy if exists quality_occurrences_insert on public.quality_occurrences;
drop policy if exists quality_occurrences_update on public.quality_occurrences;

create policy quality_occurrences_scope_select
on public.quality_occurrences
for select to authenticated
using (public.gao_can_access_laundry_client(client_id));

create policy quality_occurrences_scope_insert
on public.quality_occurrences
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.gao_can_access_laundry_client(client_id)
);

create policy quality_occurrences_gao_update
on public.quality_occurrences
for update to authenticated
using (
  public.gao_can_access_laundry_client(client_id)
  and exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.profile_id = (select auth.uid())
      and m.active = true
      and o.active = true
      and o.kind = 'gao'
  )
)
with check (
  public.gao_can_access_laundry_client(client_id)
  and exists (
    select 1
    from public.memberships m
    join public.organizations o on o.id = m.organization_id
    where m.profile_id = (select auth.uid())
      and m.active = true
      and o.active = true
      and o.kind = 'gao'
  )
);
