create function private.relave_can_edit()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.profile_id
    join public.organizations o on o.id = m.organization_id
    join public.member_permissions permission on permission.membership_id = m.id
    where m.profile_id = auth.uid() and m.active and p.active and o.active and o.kind = 'gao'
      and m.role_name in ('Gestor', 'Administrador Geral')
      and permission.permission_code = 'chemicals.entries.manage' and permission.allowed
  );
$$;
revoke all on function private.relave_can_edit() from public, anon;
grant execute on function private.relave_can_edit() to authenticated;

create function public.relave_can_edit()
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.relave_can_edit();
$$;
revoke all on function public.relave_can_edit() from public, anon;
grant execute on function public.relave_can_edit() to authenticated;

create function private.relave_guard_edits()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('authenticated','anon') or private.relave_can_edit() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  -- An operator can add entries and record the first weighing on an existing entry.
  if tg_op = 'UPDATE' and old.state_key = 'gao.chemicals.relave.v122' and new.state_key = old.state_key
    and coalesce(new.payload->'deleted', '[]') = coalesce(old.payload->'deleted', '[]')
    and not exists (
      select 1 from jsonb_array_elements(coalesce(old.payload->'entries', '[]')) previous
      where not exists (
        select 1 from jsonb_array_elements(coalesce(new.payload->'entries', '[]')) incoming
        where incoming = previous
      )
    )
    and not exists (
      select 1 from jsonb_array_elements(coalesce(new.payload->'entries', '[]')) incoming
      group by incoming->>'id' having count(*) > 1 or incoming->>'id' is null
    )
    and not exists (
      select 1
      from jsonb_each(coalesce(old.payload->'overrides', '{}')) previous
      full join jsonb_each(coalesce(new.payload->'overrides', '{}')) incoming using (key)
      where previous.value is distinct from incoming.value
        and not coalesce(
          (incoming.value - 'weighing') = coalesce(previous.value, '{}')
          and jsonb_typeof(incoming.value->'weighing') = 'object'
          and (previous.value is null or not previous.value ? 'weighing')
          and exists (
            select 1 from jsonb_array_elements(coalesce(old.payload->'entries', '[]')) entry
            where incoming.key = 'l:' || (entry->>'id')
              and coalesce(entry->>'kind', 'internal') = 'internal'
              and not entry ? 'weighing'
          ), false)
    )
  then return new; end if;

  raise exception 'Somente um gestor pode editar ou excluir lançamentos do Relave.' using errcode = '42501';
end;
$$;

create trigger relave_guard_update before update on public.chemical_portal_state
for each row when (
  old.state_key in ('gao.chemicals.relave.v122','gao.chemicals.relave.v118')
  or new.state_key in ('gao.chemicals.relave.v122','gao.chemicals.relave.v118')
  or old.state_key like 'gao.chemicals.relave.archive.%'
  or new.state_key like 'gao.chemicals.relave.archive.%'
) execute function private.relave_guard_edits();

create trigger relave_guard_delete before delete on public.chemical_portal_state
for each row when (
  old.state_key in ('gao.chemicals.relave.v122','gao.chemicals.relave.v118')
  or old.state_key like 'gao.chemicals.relave.archive.%'
) execute function private.relave_guard_edits();

create trigger relave_guard_archive_insert before insert on public.chemical_portal_state
for each row when (new.state_key like 'gao.chemicals.relave.archive.%')
execute function private.relave_guard_edits();
