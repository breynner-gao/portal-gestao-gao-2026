create or replace function public.fabric_check_supplier_reference() returns trigger language plpgsql set search_path=public as $$
declare ref public.fabric_catalog; supplier uuid;
begin
 if tg_table_name='fabric_catalog' then
  if tg_op='UPDATE' and ((new.code,new.name,new.color,new.color_reference,new.quality_code,new.composition,new.width_m,new.gsm,new.homologated) is distinct from (old.code,old.name,old.color,old.color_reference,old.quality_code,old.composition,old.width_m,old.gsm,old.homologated)) then new.standard_link_approved:=false;end if;
  if new.standard_link_approved and (new.standard_id is null or new.supplier_id is null or not new.homologated) then raise exception 'Para aprovar o vínculo, informe padrão GAO, fornecedor e referência homologada.';end if;
  if tg_op='UPDATE' and new.supplier_id is distinct from old.supplier_id and exists(select 1 from public.fabric_lots l where l.fabric_id=new.id and l.organization_id=new.organization_id and l.supplier_id is not null and l.supplier_id is distinct from new.supplier_id) then raise exception 'Fornecedor diverge dos lotes recebidos. Preserve a referência comercial de origem.';end if;
  return new;
 end if;
 select * into ref from public.fabric_catalog where id=new.fabric_id and organization_id=new.organization_id;
 if not found then raise exception 'Referência comercial não encontrada nesta organização.';end if;
 if tg_table_name='fabric_purchase_order_items' then
  select supplier_id into supplier from public.fabric_purchase_orders where id=new.purchase_order_id and organization_id=new.organization_id;
  if ref.supplier_id is distinct from supplier or not ref.active or not ref.homologated or not ref.standard_link_approved or ref.standard_id is null or not exists(select 1 from public.fabric_standards s where s.id=ref.standard_id and s.organization_id=new.organization_id and s.active) then raise exception 'Escolha a referência homologada do padrão GAO para o fornecedor deste pedido.';end if;
 elsif tg_table_name='fabric_lots' then
  if ref.supplier_id is not null then
   if new.supplier_id is null then new.supplier_id:=ref.supplier_id;end if;
   if new.supplier_id is distinct from ref.supplier_id then raise exception 'Fornecedor da NF diverge da referência comercial selecionada.';end if;
  end if;
 end if;return new;
end $$;
