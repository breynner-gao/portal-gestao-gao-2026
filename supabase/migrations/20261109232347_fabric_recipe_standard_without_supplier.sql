alter table public.fabric_catalog add column internal_only boolean not null default false;
create unique index fabric_internal_reference_unique on public.fabric_catalog(organization_id,standard_id) where internal_only;

create or replace function public.fabric_check_supplier_reference() returns trigger language plpgsql set search_path=public as $$
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
 if ref.internal_only then raise exception 'Compra e NF exigem a referência comercial do fornecedor, vinculada ao padrão GAO';end if;
 if tg_table_name='fabric_purchase_order_items' then
  select supplier_id into supplier from public.fabric_purchase_orders where id=new.purchase_order_id and organization_id=new.organization_id;
  if ref.supplier_id is distinct from supplier or not ref.active or not ref.homologated or not ref.standard_link_approved or ref.standard_id is null or not exists(select 1 from public.fabric_standards s where s.id=ref.standard_id and s.organization_id=new.organization_id and s.active and s.material_kind='TECIDO') then raise exception 'Escolha a referência homologada do padrão GAO para o fornecedor deste pedido.';end if;
 elsif tg_table_name='fabric_lots' then
  if ref.supplier_id is not null then
   if new.supplier_id is null then new.supplier_id:=ref.supplier_id;end if;
   if new.supplier_id is distinct from ref.supplier_id then raise exception 'Fornecedor da NF diverge da referência comercial selecionada.';end if;
  end if;
 end if;return new;
end $$;

create function public.fabric_internal_recipe_reference(p_organization_id uuid,p_standard_id uuid) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.fabric_standards; result uuid;
begin
 if auth.uid() is null or not public.fabric_user_has_permission(p_organization_id,'textiles.inventory.manage') then raise exception 'Sem permissão para cadastrar ficha técnica';end if;
 select * into s from public.fabric_standards where id=p_standard_id and organization_id=p_organization_id and active and material_kind='TECIDO';
 if not found then raise exception 'Padrão GAO não encontrado';end if;
 insert into public.fabric_catalog(organization_id,code,name,fabric_type,color,composition,width_m,gsm,color_reference,quality_code,active,homologated,standard_id,standard_link_approved,internal_only)
 values(p_organization_id,'GAO-PADRAO:'||s.code,s.name,s.fabric_type,s.color,s.composition,s.width_m,s.gsm,s.code,'',true,true,s.id,true,true)
 on conflict(organization_id,standard_id) where internal_only do nothing;
 select id into result from public.fabric_catalog where organization_id=p_organization_id and standard_id=s.id and internal_only;
 return result;
end $$;
revoke all on function public.fabric_internal_recipe_reference(uuid,uuid) from public,anon;
grant execute on function public.fabric_internal_recipe_reference(uuid,uuid) to authenticated;
