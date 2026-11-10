-- Enforce the selected client scope even on legacy laundry allow-all policies.
do $$declare t text;predicate text;
begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'laundry_%' loop
  predicate:=null;
  if t='laundry_clients' then predicate:='public.gao_can_access_laundry_client(id)';
  elsif exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='client_id') then
   predicate:='public.gao_can_access_laundry_client(client_id)';
  elsif exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='unit_id') then
   predicate:='exists(select 1 from public.laundry_units u where u.id=unit_id and public.gao_can_access_laundry_client(u.client_id))';
  elsif exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='sector_id') then
   predicate:='exists(select 1 from public.laundry_sectors s join public.laundry_units u on u.id=s.unit_id where s.id=sector_id and public.gao_can_access_laundry_client(u.client_id))';
  elsif t='laundry_collection_weights' then
   predicate:='exists(select 1 from public.laundry_collections c join public.laundry_sectors s on s.id=c.sector_id join public.laundry_units u on u.id=s.unit_id where c.id=collection_id and public.gao_can_access_laundry_client(u.client_id))';
  end if;
  if predicate is not null then
   execute format('create policy access_client_scope on public.%I as restrictive for all to authenticated using(%s) with check(%s)',t,predicate,predicate);
  end if;
 end loop;
end$$;
