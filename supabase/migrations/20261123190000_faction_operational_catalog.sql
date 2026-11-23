create function private.fabric_faction_operational_catalog(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.fabric_user_has_permission(p_org,'textiles.production.manage'),false)
 then raise exception 'Sem permissão para consultar as fichas da facção.' using errcode='42501'; end if;

 return (
  with active_recipes as (
   select r.id,r.product_reference,r.product_name,r.fabric_id,r.consumption_m_per_piece,r.active
   from public.fabric_product_recipes r
   join public.fabric_catalog f on f.id=r.fabric_id and f.organization_id=r.organization_id
   where r.organization_id=p_org and r.active and f.active
  ), operational_fabrics as (
   select f.id,f.code,f.name,f.color,f.color_reference,f.active,f.standard_id,f.supplier_id,
    f.homologated,f.standard_link_approved
   from public.fabric_catalog f
   where f.organization_id=p_org and (
    exists(select 1 from active_recipes r where r.fabric_id=f.id)
    or exists(select 1 from public.fabric_production_order_items i
      where i.organization_id=p_org and i.fabric_id=f.id)
   )
  ), operational_standards as (
   select s.id,s.code,s.name from public.fabric_standards s
   where s.organization_id=p_org and exists(select 1 from operational_fabrics f where f.standard_id=s.id)
  )
  select jsonb_build_object(
   'recipes',coalesce((select jsonb_agg(to_jsonb(r) order by r.product_name,r.id) from active_recipes r),'[]'::jsonb),
   'fabric',coalesce((select jsonb_agg(to_jsonb(f)) from operational_fabrics f),'[]'::jsonb),
   'standards',coalesce((select jsonb_agg(to_jsonb(s)) from operational_standards s),'[]'::jsonb)
  )
 );
end;
$$;

create function public.fabric_faction_operational_catalog(p_org uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.fabric_faction_operational_catalog(p_org)
$$;

revoke all on function private.fabric_faction_operational_catalog(uuid),
 public.fabric_faction_operational_catalog(uuid) from public,anon;
grant execute on function private.fabric_faction_operational_catalog(uuid),
 public.fabric_faction_operational_catalog(uuid) to authenticated;
