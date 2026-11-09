create table public.fabric_standards (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 code text not null,name text not null,fabric_type text,composition text,color text,width_m numeric(12,3) check(width_m is null or width_m>0),
 gsm numeric(12,3) check(gsm is null or gsm>0),quality_requirement text,notes text,active boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),created_by uuid not null default auth.uid() references public.profiles(id),
 unique(organization_id,code),unique(id,organization_id)
);
alter table public.fabric_standards enable row level security;
revoke all on public.fabric_standards from anon;
grant select,insert,update on public.fabric_standards to authenticated;
create policy standards_read on public.fabric_standards for select to authenticated using(public.fabric_user_has_permission(organization_id,'textiles.inventory.view'));
create policy standards_manage on public.fabric_standards for all to authenticated using(public.fabric_user_has_permission(organization_id,'textiles.inventory.manage')) with check(public.fabric_user_has_permission(organization_id,'textiles.inventory.manage'));
alter table public.fabric_catalog add column standard_id uuid,add column supplier_id uuid,add column standard_link_approved boolean not null default false,
 add foreign key(standard_id,organization_id) references public.fabric_standards(id,organization_id),
 add foreign key(supplier_id,organization_id) references public.fabric_suppliers(id,organization_id);
create index fabric_catalog_standard_idx on public.fabric_catalog(organization_id,standard_id);
create index fabric_catalog_supplier_idx on public.fabric_catalog(organization_id,supplier_id);
create trigger fabric_standard_audit after insert or update on public.fabric_standards for each row execute function public.fabric_audit_production();
create trigger fabric_catalog_standard_audit after update of standard_id,supplier_id,standard_link_approved on public.fabric_catalog for each row execute function public.fabric_audit_production();
create function public.fabric_same_standard(p_org uuid,p_a uuid,p_b uuid) returns boolean language sql stable security invoker set search_path=public as $$
 select exists(select 1 from public.fabric_catalog a join public.fabric_catalog b on b.organization_id=a.organization_id
 where a.organization_id=p_org and a.id=p_a and b.id=p_b and
 (a.id=b.id or(a.standard_id is not null and a.standard_id=b.standard_id and a.active and b.active and a.homologated and b.homologated and a.standard_link_approved and b.standard_link_approved)))
$$;
revoke all on function public.fabric_same_standard(uuid,uuid,uuid) from public,anon;
grant execute on function public.fabric_same_standard(uuid,uuid,uuid) to authenticated;
create function public.fabric_check_supplier_reference() returns trigger language plpgsql set search_path=public as $$
declare ref public.fabric_catalog; supplier uuid;
begin
 if tg_table_name='fabric_catalog' then
  if new.standard_link_approved and (new.standard_id is null or new.supplier_id is null or not new.homologated) then raise exception 'Para aprovar o vínculo, informe padrão GAO, fornecedor e referência homologada.';end if;
  if tg_op='UPDATE' and new.supplier_id is distinct from old.supplier_id and exists(select 1 from public.fabric_lots l where l.fabric_id=new.id and l.organization_id=new.organization_id and l.supplier_id is not null and l.supplier_id is distinct from new.supplier_id) then raise exception 'Fornecedor diverge dos lotes recebidos. Preserve a referência comercial de origem.';end if;
  return new;
 end if;
 select * into ref from public.fabric_catalog where id=new.fabric_id and organization_id=new.organization_id;
 if not found then raise exception 'Referência comercial não encontrada nesta organização.';end if;
 if tg_table_name='fabric_purchase_order_items' then
  select supplier_id into supplier from public.fabric_purchase_orders where id=new.purchase_order_id and organization_id=new.organization_id;
  if ref.supplier_id is distinct from supplier or not ref.active or not ref.homologated or not ref.standard_link_approved or ref.standard_id is null then raise exception 'Escolha a referência homologada do padrão GAO para o fornecedor deste pedido.';end if;
 elsif tg_table_name='fabric_lots' then
  if ref.supplier_id is not null then
   if new.supplier_id is null then new.supplier_id:=ref.supplier_id;end if;
   if new.supplier_id is distinct from ref.supplier_id then raise exception 'Fornecedor da NF diverge da referência comercial selecionada.';end if;
  end if;
 end if;return new;
end $$;
create trigger check_catalog_standard before insert or update on public.fabric_catalog for each row execute function public.fabric_check_supplier_reference();
create trigger check_po_supplier_reference before insert or update of fabric_id,purchase_order_id on public.fabric_purchase_order_items for each row execute function public.fabric_check_supplier_reference();
create trigger check_lot_supplier_reference before insert or update of fabric_id,supplier_id on public.fabric_lots for each row execute function public.fabric_check_supplier_reference();
create function public.fabric_check_order_supplier_change() returns trigger language plpgsql set search_path=public as $$ begin
 if new.supplier_id is distinct from old.supplier_id and exists(select 1 from public.fabric_purchase_order_items i join public.fabric_catalog f on f.id=i.fabric_id and f.organization_id=i.organization_id where i.purchase_order_id=new.id and i.organization_id=new.organization_id and f.supplier_id is distinct from new.supplier_id) then raise exception 'O novo fornecedor não corresponde às referências dos itens deste pedido.';end if;return new;end $$;
create trigger check_order_supplier_change before update of supplier_id on public.fabric_purchase_orders for each row execute function public.fabric_check_order_supplier_change();
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.fabric_post_stock_movement(uuid,uuid,text,numeric,uuid,text,text)'::regprocedure) into definition;
 if position('i.fabric_id = v_fabric_id' in definition)=0 then raise exception 'Inspecione a compatibilidade da movimentação antes de migrar.';end if;
 definition:=replace(definition,'i.fabric_id = v_fabric_id','public.fabric_same_standard(p_organization_id,i.fabric_id,v_fabric_id)');execute definition;
 select pg_get_functiondef('public.fabric_record_faction_return(uuid,uuid,uuid,integer,integer,numeric,numeric,numeric,text,text)'::regprocedure) into definition;
 if position('v_lot_fabric is distinct from v_fabric_id' in definition)=0 then raise exception 'Inspecione a compatibilidade do retorno antes de migrar.';end if;
 definition:=replace(definition,'v_lot_fabric is distinct from v_fabric_id','not public.fabric_same_standard(p_organization_id,v_lot_fabric,v_fabric_id)');execute definition;
end $migration$;

