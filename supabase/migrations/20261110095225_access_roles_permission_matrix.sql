create schema if not exists private;
create table public.access_roles (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 name text not null check(length(trim(name)) between 2 and 80),
 protected boolean not null default false,
 revision integer not null default 1,
 unique(organization_id,name)
);
create table public.access_role_permissions (
 role_id uuid not null references public.access_roles(id) on delete cascade,
 permission_code text not null references public.permission_catalog(code),
 primary key(role_id,permission_code)
);
alter table public.memberships add column access_role_id uuid references public.access_roles(id);
create index memberships_access_role_idx on public.memberships(access_role_id);
alter table public.access_roles enable row level security;
alter table public.access_role_permissions enable row level security;
revoke all on public.access_roles,public.access_role_permissions from anon,authenticated;
grant select on public.access_roles,public.access_role_permissions to authenticated;
grant all on public.access_roles,public.access_role_permissions to service_role;

create function private.access_is_admin(p_org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m join public.profiles p on p.id=m.profile_id
 where m.profile_id=auth.uid() and m.organization_id=p_org and m.active and p.active and m.role_name='Administrador Geral');
$$;
revoke all on function private.access_is_admin(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.access_is_admin(uuid) to authenticated;
create policy access_roles_read on public.access_roles for select to authenticated using (
 private.access_is_admin(organization_id) or public.has_organization_permission(organization_id,'admin.permissions.manage')
 or public.has_organization_permission(organization_id,'admin.users.manage')
 or exists(select 1 from public.memberships m where m.profile_id=auth.uid() and m.active and m.access_role_id=access_roles.id));
create policy access_role_permissions_read on public.access_role_permissions for select to authenticated using (
 exists(select 1 from public.access_roles r where r.id=access_role_permissions.role_id));

create function private.access_sync_member(p_mid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.member_permissions p where p.membership_id=p_mid;
 insert into public.member_permissions(membership_id,permission_code,allowed)
 select m.id,p.permission_code,true from public.memberships m join public.access_role_permissions p on p.role_id=m.access_role_id where m.id=p_mid;
end;$$;
revoke all on function private.access_sync_member(uuid) from public,anon,authenticated;
create function private.access_member_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.access_roles;
begin
 if TG_OP='DELETE' then
  if old.role_name='Administrador Geral' then raise exception 'O administrador principal está protegido.';end if;
  return old;
 end if;
 if TG_OP='UPDATE' and old.role_name='Administrador Geral' and
 (new.role_name<>old.role_name or not new.active or new.organization_id<>old.organization_id or new.profile_id<>old.profile_id or new.access_role_id is distinct from old.access_role_id and old.access_role_id is not null) then
  raise exception 'O administrador principal está protegido.';
 end if;
 if new.access_role_id is not null then
  select * into r from public.access_roles where id=new.access_role_id for share;
  if not found or r.organization_id<>new.organization_id then raise exception 'Papel de outra organização.';end if;
  new.role_name=r.name;
 elsif new.role_name='Administrador Geral' and (TG_OP='INSERT' or old.role_name<>'Administrador Geral') then
  raise exception 'Selecione um papel válido para o administrador.';
 end if;
 return new;
end;$$;
revoke all on function private.access_member_guard() from public,anon,authenticated;
create trigger access_member_guard before insert or update or delete on public.memberships for each row execute function private.access_member_guard();
create function private.access_member_sync() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.access_role_id is not null then perform private.access_sync_member(new.id);end if;return new;
end;$$;
revoke all on function private.access_member_sync() from public,anon,authenticated;
create trigger access_member_sync after insert or update of access_role_id on public.memberships for each row execute function private.access_member_sync();

insert into public.access_roles(organization_id,name,protected)
select o.id,n.name,n.name='Administrador Geral' from public.organizations o
cross join (values('Administrador Geral'),('Gestor'),('Cliente'),('Coletador'),('Entregador'),('Somente leitura')) n(name)
where o.kind='gao' and o.active;
insert into public.access_role_permissions(role_id,permission_code)
select r.id,p.code from public.access_roles r cross join public.permission_catalog p where r.protected;
update public.memberships m set access_role_id=r.id from public.access_roles r
where r.organization_id=m.organization_id and r.protected and m.role_name='Administrador Geral';

create function private.access_roles_manage(p_org uuid,p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); rid uuid; r public.access_roles; mid uuid; old_data jsonb; codes text[]; saved jsonb; is_admin boolean;
begin
 if actor is null then raise exception 'Sessão obrigatória.' using errcode='42501';end if;
 is_admin:=private.access_is_admin(p_org);
 if not is_admin and not (exists(select 1 from public.profiles p where p.id=actor and p.active) and public.has_organization_permission(p_org,'admin.permissions.manage')) then
  raise exception 'Sem permissão para administrar papéis.' using errcode='42501';end if;
 -- Serialize assignment and template changes within the same organization.
 perform pg_advisory_xact_lock(hashtextextended(p_org::text,637));
 if p_action='save' then
  rid:=nullif(p_data->>'id','')::uuid;
  if length(trim(coalesce(p_data->>'name',''))) not between 2 and 80 then raise exception 'Informe um nome de 2 a 80 caracteres.';end if;
  if lower(trim(p_data->>'name'))='administrador geral' then raise exception 'Nome reservado ao administrador protegido.';end if;
  if jsonb_typeof(p_data->'permissions') is distinct from 'array' then raise exception 'Informe as permissões do papel.';end if;
  select coalesce(array_agg(distinct x),'{}') into codes from jsonb_array_elements_text(p_data->'permissions') x;
  if exists(select 1 from unnest(codes) c where not exists(select 1 from public.permission_catalog p where p.code=c)) then raise exception 'Permissão desconhecida.';end if;
  if not is_admin and exists(select 1 from unnest(codes) c where not public.has_organization_permission(p_org,c)) then raise exception 'Não é permitido liberar acesso fora da sua alçada.' using errcode='42501';end if;
  if rid is null then
   insert into public.access_roles(organization_id,name) values(p_org,trim(p_data->>'name')) returning * into r;
   rid:=r.id;
  else
   select * into r from public.access_roles where id=rid and organization_id=p_org for update;
   if not found then raise exception 'Papel não localizado.';end if;
   if r.protected then raise exception 'Papel de administrador protegido.';end if;
   if r.revision is distinct from (p_data->>'revision')::integer then raise exception 'O papel foi alterado por outra pessoa. Atualize a matriz.';end if;
   if exists(select 1 from public.memberships m where m.access_role_id=rid and m.profile_id=actor and m.active) then raise exception 'Não é permitido alterar o próprio papel administrativo.';end if;
   old_data:=to_jsonb(r)||(select jsonb_build_object('permissions',coalesce(jsonb_agg(p.permission_code),'[]')) from public.access_role_permissions p where p.role_id=rid);
   update public.access_roles set name=trim(p_data->>'name'),revision=revision+1 where id=rid returning * into r;
   delete from public.access_role_permissions where role_id=rid;
  end if;
  insert into public.access_role_permissions(role_id,permission_code) select rid,unnest(codes);
  update public.memberships set role_name=r.name where access_role_id=rid;
  for mid in select id from public.memberships where access_role_id=rid loop perform private.access_sync_member(mid);end loop;
 elsif p_action='delete' then
  rid:=(p_data->>'id')::uuid;
  select * into r from public.access_roles where id=rid and organization_id=p_org for update;
  if not found then raise exception 'Papel não localizado.';end if;
  if r.protected then raise exception 'Papel de administrador protegido.';end if;
  if r.revision is distinct from (p_data->>'revision')::integer then raise exception 'O papel foi alterado por outra pessoa. Atualize a matriz.';end if;
  if exists(select 1 from public.memberships where access_role_id=rid) then raise exception 'Troque o papel dos usuários vinculados antes de excluir.';end if;
  old_data:=to_jsonb(r);
  delete from public.access_roles where id=rid;
 elsif p_action='assign' then
  rid:=(p_data->>'roleId')::uuid;mid:=(p_data->>'membershipId')::uuid;
  select * into r from public.access_roles where id=rid and organization_id=p_org for update;
  if not found then raise exception 'Papel não localizado.';end if;
  if r.protected and not is_admin then raise exception 'Administrador protegido.' using errcode='42501';end if;
  if not is_admin and exists(select 1 from public.access_role_permissions p where p.role_id=rid and not public.has_organization_permission(p_org,p.permission_code)) then raise exception 'Papel fora da sua alçada.' using errcode='42501';end if;
  select to_jsonb(m) into old_data from public.memberships m where m.id=mid and m.organization_id=p_org for update;
  if old_data is null then raise exception 'Usuário não localizado.';end if;
  if old_data->>'profile_id'=actor::text or old_data->>'role_name'='Administrador Geral' then raise exception 'O acesso do administrador está protegido.';end if;
  update public.memberships set access_role_id=rid,role_name=r.name where id=mid;
 else raise exception 'Ação inválida.';end if;
 saved:=to_jsonb(r);
 insert into public.audit_events(actor_profile_id,organization_id,module,entity,entity_id,action,before_data,after_data,source)
 values(actor,p_org,'administracao','access_roles',rid::text,p_action,old_data,saved||coalesce(p_data-'name','{}'::jsonb),'portal-matriz');
 return saved;
end;$$;
revoke all on function private.access_roles_manage(uuid,text,jsonb) from public,anon;
grant execute on function private.access_roles_manage(uuid,text,jsonb) to authenticated;
create function public.gao_access_roles_manage(p_org uuid,p_action text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.access_roles_manage(p_org,p_action,p_data)$$;
revoke all on function public.gao_access_roles_manage(uuid,text,jsonb) from public,anon;
grant execute on function public.gao_access_roles_manage(uuid,text,jsonb) to authenticated;

-- Restrictive barriers also cover legacy permissive policies; they cannot be
-- bypassed by a second permissive policy on the same table.
create function private.access_any_permission(p_codes text[]) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
 select 1 from public.memberships m join public.profiles p on p.id=m.profile_id join public.organizations o on o.id=m.organization_id
 join public.member_permissions mp on mp.membership_id=m.id
 where m.profile_id=auth.uid() and m.active and p.active and o.active and o.kind='gao' and mp.allowed and mp.permission_code=any(p_codes));
$$;
revoke all on function private.access_any_permission(text[]) from public;
grant execute on function private.access_any_permission(text[]) to authenticated;

create function private.access_state_allowed(p_key text,p_write boolean) returns boolean language plpgsql stable security definer set search_path='' as $$
declare prefix text;codes text[];
begin
 if p_key like 'gao.chemicals.master.%' then codes:=case when p_write then array['chemicals.products.manage'] else array['chemicals.products.view','chemicals.entries.view','chemicals.entries.create','chemicals.inventory.view','chemicals.purchases.view'] end;
 elsif p_key like 'gao.chemicals.inventory.%' then codes:=case when p_write then array['chemicals.inventory.manage'] else array['chemicals.inventory.view','chemicals.purchases.view'] end;
 elsif p_key like 'gao.chemicals.waste.%' or p_key like 'gao.chemicals.relave.%' then codes:=case when p_write then array['chemicals.entries.manage'] else array['chemicals.entries.view','chemicals.dashboard.view'] end;
 elsif p_key like '%quality%' then codes:=case when p_write then array['quality.routine.execute','quality.supervision.manage','quality.parameters.manage'] else array['quality.routine.view','quality.management.view','quality.dashboard.view'] end;
 else codes:=array['admin.permissions.manage'];end if;
 return private.access_any_permission(codes);
end;$$;
revoke all on function private.access_state_allowed(text,boolean) from public;
grant execute on function private.access_state_allowed(text,boolean) to authenticated;
revoke all on public.chemical_portal_state from anon;
create policy access_state_read on public.chemical_portal_state as restrictive for select to authenticated using(private.access_state_allowed(state_key,false));
create policy access_state_insert on public.chemical_portal_state as restrictive for insert to authenticated with check(private.access_state_allowed(state_key,true));
create policy access_state_update on public.chemical_portal_state as restrictive for update to authenticated using(private.access_state_allowed(state_key,true)) with check(private.access_state_allowed(state_key,true));
create policy access_state_delete on public.chemical_portal_state as restrictive for delete to authenticated using(private.access_state_allowed(state_key,true));

do $$declare t text;read_codes text[];write_codes text[];
begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'laundry_%' loop
  read_codes:=array['laundry.operations.view','laundry.management.view','laundry.dashboard.view','laundry.registries.view','laundry.inventory.view','laundry.contracts.view'];
  write_codes:=case when t in ('laundry_clients','laundry_units','laundry_sectors','laundry_responsibles','laundry_products') then array['laundry.management.view'] when t like '%schedule%' then array['laundry.contracts.view','laundry.management.view'] else array['laundry.operations.view','laundry.management.view'] end;
  execute format('create policy access_role_read on public.%I as restrictive for select to authenticated using(private.access_any_permission(%L::text[]))',t,read_codes);
  execute format('create policy access_role_insert on public.%I as restrictive for insert to authenticated with check(private.access_any_permission(%L::text[]))',t,write_codes);
  execute format('create policy access_role_update on public.%I as restrictive for update to authenticated using(private.access_any_permission(%L::text[])) with check(private.access_any_permission(%L::text[]))',t,write_codes,write_codes);
  execute format('create policy access_role_delete on public.%I as restrictive for delete to authenticated using(private.access_any_permission(%L::text[]))',t,array['laundry.management.view']);
 end loop;
end$$;
create policy access_week_read on public.chemical_weeks as restrictive for select to authenticated using(public.has_organization_permission(organization_id,'chemicals.entries.view') or public.has_organization_permission(organization_id,'chemicals.dashboard.view') or public.has_organization_permission(organization_id,'chemicals.entries.create') or public.has_organization_permission(organization_id,'chemicals.entries.manage'));
create policy access_week_insert on public.chemical_weeks as restrictive for insert to authenticated with check(public.has_organization_permission(organization_id,'chemicals.entries.create') or public.has_organization_permission(organization_id,'chemicals.entries.manage'));
create policy access_week_update on public.chemical_weeks as restrictive for update to authenticated using(public.has_organization_permission(organization_id,'chemicals.entries.manage')) with check(public.has_organization_permission(organization_id,'chemicals.entries.manage'));
create policy access_week_delete on public.chemical_weeks as restrictive for delete to authenticated using(public.has_organization_permission(organization_id,'chemicals.entries.manage'));
do $$declare t text;
begin
 foreach t in array array['chemical_consumptions','chemical_week_metrics','chemical_equipment_metrics'] loop
  execute format('create policy access_entry_read on public.%I as restrictive for select to authenticated using(exists(select 1 from public.chemical_weeks w where w.id=week_id))',t);
  execute format('create policy access_entry_insert on public.%I as restrictive for insert to authenticated with check(exists(select 1 from public.chemical_weeks w where w.id=week_id and (public.has_organization_permission(w.organization_id,''chemicals.entries.create'') or public.has_organization_permission(w.organization_id,''chemicals.entries.manage''))))',t);
  execute format('create policy access_entry_update on public.%I as restrictive for update to authenticated using(exists(select 1 from public.chemical_weeks w where w.id=week_id and public.has_organization_permission(w.organization_id,''chemicals.entries.manage''))) with check(exists(select 1 from public.chemical_weeks w where w.id=week_id and public.has_organization_permission(w.organization_id,''chemicals.entries.manage'')))',t);
 end loop;
end$$;
