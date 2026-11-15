-- Relave needs client names and IDs, independently of access to Rouparia.
create function private.relave_launch_clients()
returns table(id uuid,name text) language sql stable security definer set search_path='' as $$
  select c.id,c.name
  from public.laundry_clients c
  where c.active and nullif(trim(c.name),'') is not null and auth.uid() is not null
    and exists (
      select 1
      from public.memberships m
      join public.profiles p on p.id=m.profile_id
      join public.organizations o on o.id=m.organization_id
      join public.member_permissions permission on permission.membership_id=m.id
      left join public.gao_membership_scope scope on scope.membership_id=m.id
      where m.profile_id=auth.uid() and m.active and p.active and o.active and o.kind='gao'
        and permission.allowed and permission.permission_code='chemicals.entries.manage'
        and (
          m.role_name='Administrador Geral'
          or coalesce(scope.all_clients,false)
          or c.id=any(coalesce(scope.client_ids,'{}'::uuid[]))
          or (m.role_name='Qualidade' and coalesce(cardinality(scope.client_ids),0)=0)
        )
    )
  order by c.name,c.id
$$;
revoke all on function private.relave_launch_clients() from public,anon;
grant execute on function private.relave_launch_clients() to authenticated;

create function public.relave_launch_clients()
returns table(id uuid,name text) language sql stable security invoker set search_path='' as $$
  select c.id,c.name from private.relave_launch_clients() c
$$;
revoke all on function public.relave_launch_clients() from public,anon;
grant execute on function public.relave_launch_clients() to authenticated;
