alter table public.fabric_standards
 add column material_kind text not null default 'TECIDO' check(material_kind in('TECIDO','PRODUTO_ACABADO')),
 add column unit text not null default 'M',
 add constraint fabric_standard_unit_kind check((material_kind='TECIDO' and unit='M') or(material_kind='PRODUTO_ACABADO' and unit='PC'));
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.fabric_check_supplier_reference()'::regprocedure) into definition;
 if position('and s.active)' in definition)=0 then raise exception 'Inspecione a validação de fornecedor antes de adicionar o tipo de produto.';end if;
 definition:=replace(definition,'and s.active)','and s.active and s.material_kind=''TECIDO'')');
 definition:=replace(definition,'new.supplier_id is null or not new.homologated)','new.supplier_id is null or not new.homologated or not exists(select 1 from public.fabric_standards s where s.id=new.standard_id and s.organization_id=new.organization_id and s.material_kind=''TECIDO''))');
 execute definition;
end $migration$;
