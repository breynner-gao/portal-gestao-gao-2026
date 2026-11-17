-- Resolve labels without broadening access to the profiles table.
create function private.quality_sewing_operator_names()
returns table (id uuid, label text)
language sql stable security definer set search_path = '' as $$
  with access as (
    select auth.uid() as user_id,
      private.access_any_permission(array['production.sewing.view']) as can_view,
      private.access_any_permission(array['production.sewing.execute']) as can_launch
  )
  select p.id, coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(p.username), ''), 'Nome não cadastrado')
  from public.profiles p
  cross join access a
  where a.user_id is not null
    and (
      (p.id = a.user_id and (a.can_view or a.can_launch))
      or (a.can_view and exists (
        select 1 from public.quality_sewing_entries e where e.operator_id = p.id
      ))
    );
$$;

revoke all on function private.quality_sewing_operator_names() from public, anon, authenticated;
grant execute on function private.quality_sewing_operator_names() to authenticated;

create or replace function public.quality_sewing_operators()
returns table (id uuid, label text)
language sql stable security invoker set search_path = '' as $$
  select id, label from private.quality_sewing_operator_names();
$$;

revoke all on function public.quality_sewing_operators() from public, anon, authenticated;
grant execute on function public.quality_sewing_operators() to authenticated;
