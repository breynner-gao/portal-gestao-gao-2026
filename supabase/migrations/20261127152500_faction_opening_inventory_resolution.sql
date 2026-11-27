alter table public.fabric_faction_opening_lots
 alter constraint fabric_faction_opening_lots_lot_id_organization_id_fkey deferrable initially immediate;

CREATE OR REPLACE FUNCTION public.fabric_check_supplier_reference()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare ref public.fabric_catalog; supplier uuid;
begin
 if tg_table_name='fabric_catalog' then
  if tg_op='UPDATE' and new.internal_only is distinct from old.internal_only then raise exception 'Não é permitido converter vínculo interno em referência comercial ou vice-versa';end if;
  if new.internal_only then
   if new.standard_id is null or new.supplier_id is not null or not exists(select 1 from public.fabric_standards s where s.id=new.standard_id and s.organization_id=new.organization_id and s.active and s.material_kind='TECIDO') then raise exception 'Vínculo interno precisa de padrão de tecido GAO ativo, sem fornecedor';end if;
   new.homologated:=true;new.standard_link_approved:=true;return new;
  end if;
  if tg_op='UPDATE' and ((new.code,new.name,new.color,new.color_reference,new.quality_code,new.composition,new.width_m,new.gsm,new.homologated) is distinct from (old.code,old.name,old.color,old.color_reference,old.quality_code,old.composition,old.width_m,old.gsm,old.homologated)) then new.standard_link_approved:=false;end if;
  if new.standard_link_approved and (new.standard_id is null or new.supplier_id is null or not new.homologated or not exists(select 1 from public.fabric_standards s where s.id=new.standard_id and s.organization_id=new.organization_id and s.material_kind='TECIDO')) then raise exception 'Para aprovar o vínculo, informe padrão GAO, fornecedor e referência homologada.';end if;
  if tg_op='UPDATE' and new.supplier_id is distinct from old.supplier_id and exists(select 1 from public.fabric_lots l where l.fabric_id=new.id and l.organization_id=new.organization_id and l.supplier_id is not null and l.supplier_id is distinct from new.supplier_id) then raise exception 'Fornecedor diverge dos lotes recebidos. Preserve a referência comercial de origem.';end if;
  return new;
 end if;
 select * into ref from public.fabric_catalog where id=new.fabric_id and organization_id=new.organization_id;
 if not found then raise exception 'Referência comercial não encontrada nesta organização.';end if;
 if ref.internal_only then
  if tg_table_name='fabric_lots' then
   if new.invoice_number is null and new.supplier_id is null
    and new.purchase_price_per_m=0 and new.effective_price_per_m=0
    and exists(select 1 from public.fabric_faction_opening_lots b
     where b.organization_id=new.organization_id and b.lot_id=new.id and b.fabric_id=new.fabric_id
      and b.counted_on=new.received_date and b.quantity_m=new.quantity_received_m) then
    return new;
   end if;
  end if;
  raise exception 'Compra e NF exigem a referência comercial do fornecedor, vinculada ao padrão GAO';
 end if;
 if tg_table_name='fabric_purchase_order_items' then
  select supplier_id into supplier from public.fabric_purchase_orders where id=new.purchase_order_id and organization_id=new.organization_id;
  if ref.supplier_id is distinct from supplier or not ref.active or not ref.homologated or not ref.standard_link_approved or ref.standard_id is null or not exists(select 1 from public.fabric_standards s where s.id=ref.standard_id and s.organization_id=new.organization_id and s.active and s.material_kind='TECIDO') then raise exception 'Escolha a referência homologada do padrão GAO para o fornecedor deste pedido.';end if;
 elsif tg_table_name='fabric_lots' then
  if ref.supplier_id is not null then
   if new.supplier_id is null then new.supplier_id:=ref.supplier_id;end if;
   if new.supplier_id is distinct from ref.supplier_id then raise exception 'Fornecedor da NF diverge da referência comercial selecionada.';end if;
  end if;
 end if;return new;
end $function$;

create or replace trigger check_lot_supplier_reference before insert or update of fabric_id,supplier_id,invoice_number
 on public.fabric_lots for each row execute function public.fabric_check_supplier_reference();

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
 new_lot:=gen_random_uuid();
 set constraints public.fabric_faction_opening_lots_lot_id_organization_id_fkey deferred;
 insert into public.fabric_faction_opening_lots(organization_id,inventory_id,line_index,counted_on,fabric_id,lot_id,quantity_m,activated_by)
 values(p_org,p_inventory,p_line,inventory.counted_on,fabric.id,new_lot,counted,auth.uid());
 insert into public.fabric_lots(id,organization_id,fabric_id,supplier_id,lot_code,quantity_received_m,
  purchase_price_per_m,effective_price_per_m,received_date,quality_status,notes,idempotency_key,created_by)
 values(new_lot,p_org,fabric.id,fabric.supplier_id,code,counted,0,0,inventory.counted_on,'APROVADO',
  'Saldo de abertura por inventário físico. Sem entrada de NF ou custo informado.',code,auth.uid());
 set constraints public.fabric_faction_opening_lots_lot_id_organization_id_fkey immediate;
 insert into public.fabric_stock_movements(organization_id,lot_id,movement_type,quantity_m,stock_delta_m,notes,idempotency_key,created_by)
 values(p_org,new_lot,'AJUSTE_ENTRADA',counted,counted,'Saldo de abertura por inventário físico','opening:'||code,auth.uid());
 return new_lot;
end
$function$;

create function private.fabric_faction_open_inventory_new_standard(p_org uuid,p_inventory uuid,p_line integer,p_name text)
 returns uuid language plpgsql security definer set search_path to ''
as $function$
declare
 fabric_name text:=btrim(p_name);
 new_standard uuid;
 next_number text;
 counted_width numeric;
 existing public.fabric_faction_opening_lots;
begin
 if auth.uid() is null or not public.fabric_user_has_permission(p_org,'textiles.production.manage')
    or not public.fabric_user_has_permission(p_org,'textiles.inventory.manage') then
  raise exception 'O cadastro de tecido exige permissão de gestão de estoque.' using errcode='42501';
 end if;
 if fabric_name is null or length(fabric_name) not between 2 and 120 then
  raise exception 'Informe o nome do tecido com 2 a 120 caracteres.';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('faction-inventory:'||p_org::text,0));
 select * into existing from public.fabric_faction_opening_lots
  where organization_id=p_org and inventory_id=p_inventory and line_index=p_line;
 if found then
  if exists(select 1 from public.fabric_catalog f join public.fabric_standards s
    on s.organization_id=f.organization_id and s.id=f.standard_id
    where f.organization_id=p_org and f.id=existing.fabric_id and f.internal_only
      and upper(s.name)=upper(fabric_name)) then return existing.lot_id; end if;
  raise exception 'Esta linha já foi vinculada. Atualize o inventário.';
 end if;
 if exists(select 1 from public.fabric_standards s where s.organization_id=p_org
    and s.material_kind='TECIDO' and upper(btrim(s.name))=upper(fabric_name)) then
  raise exception 'Já existe um padrão GAO com esse nome. Selecione o tecido existente ou informe um nome distinto.';
 end if;
 select nullif((lines->p_line->>'width_m')::numeric,0) into counted_width
  from public.fabric_faction_inventories where organization_id=p_org and id=p_inventory;
 select (coalesce(max(substring(code from 9)::bigint),0)+1)::text into next_number
  from public.fabric_standards where organization_id=p_org and code ~ '^GAO-TEC-[0-9]{1,9}$';
 insert into public.fabric_standards(organization_id,code,name,width_m,created_by)
 values(p_org,'GAO-TEC-'||lpad(next_number,greatest(3,length(next_number)),'0'),fabric_name,counted_width,auth.uid())
 returning id into new_standard;
 return private.fabric_faction_open_inventory(p_org,p_inventory,p_line,new_standard);
end
$function$;

create function public.fabric_faction_open_inventory_new_standard(p_org uuid,p_inventory uuid,p_line integer,p_name text)
 returns uuid language sql set search_path to ''
as $function$
 select private.fabric_faction_open_inventory_new_standard(p_org,p_inventory,p_line,p_name);
$function$;

revoke all on function private.fabric_faction_open_inventory_new_standard(uuid,uuid,integer,text) from public,anon;
revoke all on function public.fabric_faction_open_inventory_new_standard(uuid,uuid,integer,text) from public,anon;
grant execute on function private.fabric_faction_open_inventory_new_standard(uuid,uuid,integer,text) to authenticated;
grant execute on function public.fabric_faction_open_inventory_new_standard(uuid,uuid,integer,text) to authenticated;
