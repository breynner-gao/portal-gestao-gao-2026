create function public.gao_admin_save_user_access(
  p_membership uuid, p_profile uuid, p_org uuid, p_role uuid,
  p_active boolean, p_all_units boolean, p_units uuid[],
  p_all_clients boolean, p_clients uuid[]
) returns uuid language plpgsql security invoker set search_path='' as $$
declare
  v_membership uuid;
  v_role text;
  v_protected boolean;
  v_profile_active boolean;
begin
  select p.active into strict v_profile_active
  from public.profiles p where p.id=p_profile for update;

  select r.name,r.protected into strict v_role,v_protected
  from public.access_roles r where r.id=p_role and r.organization_id=p_org;
  if v_protected then raise exception 'O papel de administrador está protegido.'; end if;

  if p_membership is null then
    if v_profile_active
       or exists(select 1 from public.memberships m where m.profile_id=p_profile)
       or not exists(select 1 from public.audit_events e where e.organization_id=p_org
         and e.entity='vinculo' and e.action='excluir'
         and e.before_data->'membership'->>'profile_id'=p_profile::text
         and e.after_data->>'login_blocked'='true') then
      raise exception 'Perfil sem vínculo recuperável nesta organização.';
    end if;
    insert into public.memberships(profile_id,organization_id,access_role_id,role_name,active,all_units,unit_id)
    values(p_profile,p_org,p_role,v_role,p_active,p_all_units,case when not p_all_units then p_units[1] end)
    returning id into v_membership;
  else
    update public.memberships set access_role_id=p_role,role_name=v_role,active=p_active,
      all_units=p_all_units,unit_id=case when not p_all_units then p_units[1] end
    where id=p_membership and profile_id=p_profile and organization_id=p_org and role_name<>'Administrador Geral'
    returning id into v_membership;
    if not found then raise exception 'Vínculo indisponível para edição.'; end if;
  end if;

  if p_active and not v_profile_active then
    if exists(select 1 from public.memberships m where m.profile_id=p_profile and m.active and m.organization_id<>p_org) then
      raise exception 'A reativação deste perfil precisa ser tratada na organização de origem.';
    end if;
    update public.profiles set active=true where id=p_profile;
  end if;

  delete from public.membership_units where membership_id=v_membership;
  if not p_all_units then
    insert into public.membership_units(membership_id,unit_id)
    select v_membership, unnest(p_units);
  end if;

  insert into public.gao_membership_scope(membership_id,all_clients,client_ids,unit_ids,updated_at)
  values(v_membership,p_all_clients,
    case when p_all_clients then '{}'::uuid[] else array(select c.id from public.laundry_clients c where c.id=any(p_clients)) end,
    '{}'::uuid[],now())
  on conflict(membership_id) do update set all_clients=excluded.all_clients,
    client_ids=excluded.client_ids,updated_at=excluded.updated_at;
  return v_membership;
end;
$$;

revoke all on function public.gao_admin_save_user_access(uuid,uuid,uuid,uuid,boolean,boolean,uuid[],boolean,uuid[]) from public,anon,authenticated;
grant execute on function public.gao_admin_save_user_access(uuid,uuid,uuid,uuid,boolean,boolean,uuid[],boolean,uuid[]) to service_role;
