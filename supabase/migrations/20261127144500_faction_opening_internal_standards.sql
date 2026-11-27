CREATE OR REPLACE FUNCTION private.fabric_faction_open_inventory(p_org uuid, p_inventory uuid, p_line integer, p_fabric uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 inventory public.fabric_faction_inventories;
 fabric public.fabric_catalog;
 standard public.fabric_standards;
 opening public.fabric_faction_opening_lots;
 counted numeric;
 new_lot uuid;
 code text;
begin
 if auth.uid() is null or not public.fabric_user_has_permission(p_org,'textiles.production.manage')
    or not (public.fabric_user_has_permission(p_org,'textiles.inventory.manage') or public.fabric_user_has_permission(p_org,'textiles.production.reserve')) then
  raise exception 'Sem permissão para vincular o saldo de abertura.' using errcode='42501';
 end if;
 if p_line is null or p_line<0 or p_line>=500 then raise exception 'Linha do inventário inválida.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('faction-inventory:'||p_org::text,0));
 select * into opening from public.fabric_faction_opening_lots b where b.organization_id=p_org
 order by b.activated_at,b.line_index limit 1;
 if opening.inventory_id is null then
  select * into inventory from public.fabric_faction_inventories i where i.organization_id=p_org order by i.recorded_at desc,i.id desc limit 1;
 else
  select * into inventory from public.fabric_faction_inventories i where i.organization_id=p_org and i.id=opening.inventory_id;
 end if;
 if inventory.id is null or p_inventory is distinct from inventory.id then
  raise exception 'A posição de abertura mudou. Atualize os dados.';
 end if;
 select * into opening from public.fabric_faction_opening_lots b where b.organization_id=p_org and b.inventory_id=p_inventory and b.line_index=p_line;
 if found then
  if opening.fabric_id=p_fabric or exists (
   select 1 from public.fabric_catalog f where f.organization_id=p_org and f.id=opening.fabric_id
     and f.internal_only and f.standard_id=p_fabric
  ) then return opening.lot_id; end if;
  raise exception 'Esta linha já está vinculada a outro tecido.';
 end if;
 counted := (inventory.lines->p_line->>'physical_m')::numeric;
 if counted is null or counted<=0 then raise exception 'Esta linha não tem metragem para abertura.'; end if;
 select * into fabric from public.fabric_catalog f where f.organization_id=p_org and f.id=p_fabric
  and f.active and f.homologated and f.standard_link_approved and not f.internal_only;
 if not found then
  select s.* into standard from public.fabric_standards s
   where s.organization_id=p_org and s.id=p_fabric and s.active and s.material_kind='TECIDO'
     and not exists(select 1 from public.fabric_catalog f where f.organization_id=p_org
       and f.standard_id=s.id and f.active and f.homologated and f.standard_link_approved and not f.internal_only);
  if not found then raise exception 'Escolha um padrão GAO ativo ou uma referência comercial homologada.'; end if;
  if standard.width_m>0 and (inventory.lines->p_line->>'width_m')::numeric>0
     and standard.width_m<>(inventory.lines->p_line->>'width_m')::numeric then
   raise exception 'A largura do padrão GAO difere da largura do tecido contado.';
  end if;
  insert into public.fabric_catalog(organization_id,code,name,fabric_type,color,composition,width_m,gsm,
   standard_id,active,homologated,standard_link_approved,internal_only,created_by)
  values(p_org,'GAO-PADRAO:'||standard.code,standard.name,standard.fabric_type,standard.color,
   standard.composition,standard.width_m,standard.gsm,standard.id,true,true,true,true,auth.uid())
  on conflict (organization_id,standard_id) where internal_only do nothing;
  select f.* into fabric from public.fabric_catalog f where f.organization_id=p_org and f.standard_id=standard.id
    and f.internal_only and f.active and f.homologated and f.standard_link_approved;
  if not found then raise exception 'O vínculo interno com este padrão precisa ser revisado em Cadastros.'; end if;
 end if;
 if exists(select 1 from public.fabric_lots l join public.fabric_stock_movements m on m.lot_id=l.id and m.organization_id=l.organization_id
   where l.organization_id=p_org and l.received_date<=inventory.counted_on
   and not exists(select 1 from public.fabric_faction_opening_lots b where b.lot_id=l.id)
   group by l.id having sum(m.reserved_delta_m)>0) then
  raise exception 'Há reserva ativa anterior à contagem. Confira essa reserva antes de abrir a posição.';
 end if;
 code:='INVENTARIO-'||inventory.counted_on||'-'||(p_line+1);
 insert into public.fabric_lots(organization_id,fabric_id,supplier_id,lot_code,quantity_received_m,
  purchase_price_per_m,effective_price_per_m,received_date,quality_status,notes,idempotency_key,created_by)
 values(p_org,fabric.id,fabric.supplier_id,code,counted,0,0,inventory.counted_on,'APROVADO',
  'Saldo de abertura por inventário físico. Sem entrada de NF ou custo informado.',code,auth.uid())
 returning id into new_lot;
 insert into public.fabric_faction_opening_lots(organization_id,inventory_id,line_index,counted_on,fabric_id,lot_id,quantity_m,activated_by)
 values(p_org,p_inventory,p_line,inventory.counted_on,fabric.id,new_lot,counted,auth.uid());
 insert into public.fabric_stock_movements(organization_id,lot_id,movement_type,quantity_m,stock_delta_m,notes,idempotency_key,created_by)
 values(p_org,new_lot,'AJUSTE_ENTRADA',counted,counted,'Saldo de abertura por inventário físico','opening:'||code,auth.uid());
 return new_lot;
end
$function$;

CREATE OR REPLACE FUNCTION private.fabric_faction_operational_catalog(p_org uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 can_open_inventory boolean;
begin
 if auth.uid() is null or not coalesce(public.fabric_user_has_permission(p_org,'textiles.production.manage'),false)
 then raise exception 'Sem permissão para consultar as fichas da facção.' using errcode='42501'; end if;

 can_open_inventory := coalesce(public.fabric_user_has_permission(p_org,'textiles.production.reserve'),false)
   or coalesce(public.fabric_user_has_permission(p_org,'textiles.inventory.manage'),false);

 return (
  with active_recipes as (
   select r.id,r.product_reference,r.product_name,r.fabric_id,r.consumption_m_per_piece,r.active
   from public.fabric_product_recipes r
   join public.fabric_catalog f on f.id=r.fabric_id and f.organization_id=r.organization_id
   where r.organization_id=p_org and r.active and f.active
  ), operational_fabrics as (
   select f.id,f.code,f.name,f.color,f.color_reference,f.active,f.standard_id,f.supplier_id,
    f.homologated,f.standard_link_approved,f.internal_only,f.quality_code,f.width_m,
    case when can_open_inventory then coalesce(nullif(s.trade_name,''),s.legal_name) end as supplier_name
   from public.fabric_catalog f
   left join public.fabric_suppliers s on s.organization_id=f.organization_id and s.id=f.supplier_id
   where f.organization_id=p_org and (
    exists(select 1 from active_recipes r where r.fabric_id=f.id)
    or exists(select 1 from public.fabric_production_order_items i
      where i.organization_id=p_org and i.fabric_id=f.id)
    or (can_open_inventory and (
      (f.active and f.homologated and f.standard_link_approved and not f.internal_only)
      or exists(select 1 from public.fabric_faction_opening_lots b where b.organization_id=p_org and b.fabric_id=f.id)
    ))
   )
  ), operational_standards as (
   select s.id,s.code,s.name,s.active,s.material_kind,s.width_m from public.fabric_standards s
   where s.organization_id=p_org and (
     exists(select 1 from operational_fabrics f where f.standard_id=s.id)
     or (can_open_inventory and s.active and s.material_kind='TECIDO')
   )
  )
  select jsonb_build_object(
   'recipes',coalesce((select jsonb_agg(to_jsonb(r) order by r.product_name,r.id) from active_recipes r),'[]'::jsonb),
   'fabric',coalesce((select jsonb_agg(to_jsonb(f)) from operational_fabrics f),'[]'::jsonb),
   'standards',coalesce((select jsonb_agg(to_jsonb(s)) from operational_standards s),'[]'::jsonb)
  )
 );
end;
$function$;
