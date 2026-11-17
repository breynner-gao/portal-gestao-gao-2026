-- Keep the imported name for audit and store login links separately.
create table public.quality_sewing_history_operator_links (
  imported_name text primary key check (imported_name <> '' and imported_name = upper(btrim(imported_name))),
  operator_id uuid not null references public.profiles(id) on delete cascade
);

alter table public.quality_sewing_history_operator_links enable row level security;
revoke all on public.quality_sewing_history_operator_links from public, anon, authenticated;
grant select on public.quality_sewing_history_operator_links to authenticated;
create policy sewing_history_operator_links_read on public.quality_sewing_history_operator_links
  for select to authenticated
  using ((select private.access_any_permission(array['production.sewing.view'])));

create or replace function private.quality_sewing_operator_names()
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
      or (a.can_view and (
        exists (select 1 from public.quality_sewing_entries e where e.operator_id = p.id)
        or exists (select 1 from public.quality_sewing_history_operator_links h where h.operator_id = p.id)
      ))
    );
$$;
