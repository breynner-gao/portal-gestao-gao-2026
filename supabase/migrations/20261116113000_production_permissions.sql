insert into public.permission_catalog (code, module, resource, action, label)
values
  ('production.sewing.execute', 'production', 'sewing', 'execute', 'Lançar serviços'),
  ('production.sewing.view', 'production', 'sewing', 'view', 'Ver painel da equipe e modo TV'),
  ('production.quality.view', 'production', 'quality', 'view', 'Acessar Qualidade em Produção')
on conflict (code) do nothing;

-- Transfer the former access once. Later changes use only the Production switches.
with production_permissions as (
  select code from public.permission_catalog where module = 'production'
)
insert into public.access_role_permissions (role_id, permission_code)
select r.id, p.code
from public.access_roles r
cross join production_permissions p
where r.protected or exists (
  select 1 from public.access_role_permissions old
  where old.role_id = r.id and (
    (p.code = 'production.sewing.execute' and old.permission_code in ('quality.routine.execute', 'quality.supervision.manage'))
    or (p.code = 'production.sewing.view' and old.permission_code in ('quality.management.view', 'quality.supervision.manage'))
    or (p.code = 'production.quality.view' and old.permission_code like 'quality.%')
  )
)
on conflict do nothing;

insert into public.member_permissions (membership_id, permission_code, allowed)
select m.id, p.permission_code, true
from public.memberships m
join public.access_role_permissions p on p.role_id = m.access_role_id
where p.permission_code in ('production.sewing.execute', 'production.sewing.view', 'production.quality.view')
on conflict (membership_id, permission_code) do nothing;

create or replace function public.quality_sewing_access()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'write', private.access_any_permission(array['production.sewing.execute']),
    'manage', private.access_any_permission(array['production.sewing.view'])
  );
$$;

create or replace function public.quality_sewing_operators()
returns table (id uuid, label text)
language sql stable security invoker set search_path = '' as $$
  select p.id, coalesce(nullif(p.full_name, ''), nullif(p.username, ''), p.id::text)
  from public.profiles p
  where p.id = auth.uid() or (
    (select private.access_any_permission(array['production.sewing.view']))
    and exists (select 1 from public.quality_sewing_entries e where e.operator_id = p.id)
  );
$$;

alter policy sewing_insert on public.quality_sewing_entries
  with check (operator_id = (select auth.uid())
    and (select private.access_any_permission(array['production.sewing.execute'])));

alter policy sewing_read on public.quality_sewing_entries
  using ((select private.access_any_permission(array['production.sewing.view']))
    or (operator_id = (select auth.uid())
      and (select private.access_any_permission(array['production.sewing.execute']))));

alter policy sewing_history_read on public.quality_sewing_history
  using ((select private.access_any_permission(array['production.sewing.view'])));
