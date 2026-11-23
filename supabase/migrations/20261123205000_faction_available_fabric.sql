create function private.fabric_faction_available_fabric(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.fabric_user_has_permission(p_org,'textiles.production.manage'),false)
 then raise exception 'Sem permissão para consultar o estoque da facção.' using errcode='42501'; end if;

 return (
  with latest as (
   select c.source_key,coalesce(c.counted_on,c.reported_on) as cutoff
   from public.fabric_faction_stock_counts c where c.organization_id=p_org
   order by c.reported_on desc,c.source_key desc,c.line_no limit 1
  ), counts as (
   select c.source_key,c.material,c.supplier_or_brand,c.width_m,c.reported_on,c.physical_m,c.reported_m,c.line_no
   from public.fabric_faction_stock_counts c join latest s on s.source_key=c.source_key
   where c.organization_id=p_org
  ), balances as (
   select l.id,l.lot_code,coalesce(s.code||' • '||s.name,f.code||' • '||f.name) as fabric_label,
    sum(m.stock_delta_m) as onhand,sum(m.reserved_delta_m) as reserved
   from public.fabric_lots l
   join public.fabric_catalog f on f.id=l.fabric_id and f.organization_id=l.organization_id
   left join public.fabric_standards s on s.id=f.standard_id and s.organization_id=f.organization_id
   join public.fabric_stock_movements m on m.lot_id=l.id and m.organization_id=l.organization_id
   where l.organization_id=p_org and l.quality_status='APROVADO'
    and l.received_date>coalesce((select cutoff from latest),'-infinity'::date)
   group by l.id,s.code,s.name,f.code,f.name
   having sum(m.stock_delta_m)>0
  )
  select jsonb_build_object(
   'counts',coalesce((select jsonb_agg(to_jsonb(c) order by c.line_no) from counts c),'[]'::jsonb),
   'lots',coalesce((select jsonb_agg(to_jsonb(b) order by b.fabric_label,b.lot_code,b.id) from balances b),'[]'::jsonb)
  )
 );
end;
$$;

create function public.fabric_faction_available_fabric(p_org uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select private.fabric_faction_available_fabric(p_org)
$$;

revoke all on function private.fabric_faction_available_fabric(uuid),
 public.fabric_faction_available_fabric(uuid) from public,anon;
grant execute on function private.fabric_faction_available_fabric(uuid),
 public.fabric_faction_available_fabric(uuid) to authenticated;
