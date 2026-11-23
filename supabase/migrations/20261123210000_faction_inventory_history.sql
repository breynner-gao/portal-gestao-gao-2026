create table public.fabric_faction_inventories (
 id uuid not null,
 organization_id uuid not null references public.organizations(id),
 counted_on date not null,
 recorded_at timestamptz not null default clock_timestamp(),
 recorded_by uuid not null references public.profiles(id),
 recorded_by_name text not null,
 notes text not null check (length(notes)<=1000),
 lines jsonb not null check (jsonb_typeof(lines)='array'),
 previous_lines jsonb not null check (jsonb_typeof(previous_lines)='array'),
 primary key (organization_id,id)
);
create index fabric_faction_inventories_history on public.fabric_faction_inventories(organization_id,recorded_at desc,id desc);
alter table public.fabric_faction_inventories enable row level security;
revoke all on public.fabric_faction_inventories from public,anon,authenticated;
grant select on public.fabric_faction_inventories to authenticated;
create policy fabric_faction_inventory_read on public.fabric_faction_inventories for select to authenticated
 using (public.fabric_user_has_permission(organization_id,'textiles.production.manage')
 or public.fabric_user_has_permission(organization_id,'textiles.inventory.view'));

create function private.fabric_record_faction_inventory(p_org uuid,p_id uuid,p_previous uuid,p_on date,p_notes text,p_lines jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid();
 actor_name text;
 latest public.fabric_faction_inventories;
 baseline jsonb;
 normalized jsonb;
begin
 if actor is null or not coalesce(public.fabric_user_has_permission(p_org,'textiles.production.manage'),false)
 then raise exception 'Sem permissão para lançar inventário da facção.' using errcode='42501'; end if;
 if p_id is null or p_on is null or p_on>(now() at time zone 'America/Sao_Paulo')::date
   or length(coalesce(p_notes,''))>1000 or jsonb_typeof(p_lines) is distinct from 'array'
 then raise exception 'Confira a data da contagem, a observação e os tecidos.'; end if;
 if jsonb_array_length(p_lines) not between 1 and 500
 then raise exception 'Informe entre 1 e 500 linhas de inventário.'; end if;

 perform pg_advisory_xact_lock(hashtextextended('faction-inventory:'||p_org::text,0));
 if exists(select 1 from public.fabric_faction_inventories where organization_id=p_org and id=p_id) then return p_id; end if;
 select * into latest from public.fabric_faction_inventories where organization_id=p_org order by recorded_at desc,id desc limit 1;
 if p_previous is distinct from latest.id then raise exception 'Outro inventário foi lançado. Atualize os dados e confira a nova posição.'; end if;
 if latest.counted_on>p_on then raise exception 'Use uma data igual ou posterior à da última contagem.'; end if;

 baseline:=latest.lines;
 if baseline is null then
  select coalesce(jsonb_agg(jsonb_build_object('material',btrim(material),'supplier_or_brand',nullif(btrim(supplier_or_brand),''),
    'width_m',width_m,'physical_m',physical_m,'reported_m',reported_m) order by line_no),'[]'::jsonb)
   into baseline from public.fabric_faction_stock_counts where organization_id=p_org and source_key=(
    select source_key from public.fabric_faction_stock_counts where organization_id=p_org
    order by reported_on desc,source_key desc,line_no limit 1
   );
 end if;

 if exists(select 1 from jsonb_to_recordset(p_lines) as r(material text,supplier_or_brand text,width_m numeric,physical_m numeric)
  where coalesce(length(btrim(material)),0) not between 1 and 120 or length(coalesce(supplier_or_brand,''))>120
  or (width_m is not null and (width_m<=0 or width_m>99999.999 or scale(width_m)>3))
  or (physical_m is not null and (physical_m<0 or physical_m>99999999999.999 or scale(physical_m)>3)))
 then raise exception 'Confira o tecido, a largura e a metragem de cada linha.'; end if;

 select jsonb_agg(jsonb_build_object(
   'material',btrim(e.line->>'material'),'supplier_or_brand',nullif(btrim(e.line->>'supplier_or_brand'),''),
   'width_m',(e.line->>'width_m')::numeric,'physical_m',(e.line->>'physical_m')::numeric,
   'reported_m',coalesce((e.line->>'physical_m')::numeric,
     (baseline->(e.position::integer-1)->>'reported_m')::numeric)) order by e.position)
 into normalized from jsonb_array_elements(p_lines) with ordinality e(line,position);

 if jsonb_array_length(normalized)<jsonb_array_length(baseline) or exists (
  select 1 from jsonb_array_elements(baseline) with ordinality b(line,position)
  where (b.line-'physical_m'-'reported_m') is distinct from
    (normalized->(b.position::integer-1)-'physical_m'-'reported_m')
 ) then raise exception 'Preserve as linhas existentes e informe zero quando o tecido acabar.'; end if;

 if exists(select 1 from jsonb_array_elements(normalized) with ordinality e(line,position)
  where e.line->>'physical_m' is null and (e.position>jsonb_array_length(baseline)
   or baseline->(e.position::integer-1)->>'physical_m' is not null))
 then raise exception 'Informe a metragem das novas linhas e dos tecidos já contados.'; end if;

 select coalesce(nullif(btrim(p.full_name),''),p.username) into strict actor_name
 from public.profiles p where p.id=actor and p.active;
 insert into public.fabric_faction_inventories(id,organization_id,counted_on,recorded_by,recorded_by_name,notes,lines,previous_lines)
 values(p_id,p_org,p_on,actor,actor_name,btrim(coalesce(p_notes,'')),normalized,baseline);
 return p_id;
end;
$$;

create function public.fabric_record_faction_inventory(p_org uuid,p_id uuid,p_previous uuid,p_on date,p_notes text,p_lines jsonb)
returns uuid language sql security invoker set search_path='' as $$
 select private.fabric_record_faction_inventory(p_org,p_id,p_previous,p_on,p_notes,p_lines)
$$;
revoke all on function private.fabric_record_faction_inventory(uuid,uuid,uuid,date,text,jsonb),
 public.fabric_record_faction_inventory(uuid,uuid,uuid,date,text,jsonb) from public,anon;
grant execute on function private.fabric_record_faction_inventory(uuid,uuid,uuid,date,text,jsonb),
 public.fabric_record_faction_inventory(uuid,uuid,uuid,date,text,jsonb) to authenticated;
