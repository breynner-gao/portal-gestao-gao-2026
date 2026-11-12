-- Immutable, organization-scoped reference imports. Operational tables are
-- updated only by their own approval and movement workflows.
create table public.fabric_workbook_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  filename text not null,
  fingerprint text not null,
  source_rows jsonb not null check (jsonb_typeof(source_rows) = 'array'),
  row_count integer generated always as (jsonb_array_length(source_rows)) stored,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  unique (organization_id, fingerprint)
);

alter table public.fabric_workbook_import_batches enable row level security;
revoke all on public.fabric_workbook_import_batches from public, anon, authenticated;

create function public.fabric_workbook_import(
  p_organization_id uuid, p_filename text, p_rows jsonb, p_commit boolean default false
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  normalized jsonb;
  previous_rows jsonb;
  checksum text;
  batch_id uuid;
  new_count integer;
  existing_count integer;
  conflict_count integer;
begin
  if not coalesce(public.fabric_user_has_permission(p_organization_id, 'textiles.inventory.manage'), false) then
    raise exception 'Sem permissão para importar referências desta organização.' using errcode = '42501';
  end if;
  if p_filename is null or length(trim(p_filename)) not between 1 and 255
    or p_rows is null or jsonb_typeof(p_rows) <> 'array' or octet_length(p_rows::text) > 2000000 then
    raise exception 'Arquivo ou conteúdo de importação inválido.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) not between 1 and 5000 or exists (
    select from jsonb_array_elements(p_rows) r
    where jsonb_typeof(r) <> 'object'
      or coalesce(r->>'sheet', '') not in ('Tecidos','Peças','Histórico pedidos','Referências custos')
      or length(trim(coalesce(r->>'id',''))) not between 1 and 150
      or coalesce(r->>'line','') !~ '^[0-9]{1,4}$'
      or coalesce(jsonb_typeof(r->'data'),'') <> 'object'
      or coalesce(jsonb_typeof(r->'issues'),'') <> 'array'
  ) then
    raise exception 'A importação contém linhas inválidas.' using errcode = '22023';
  end if;
  if exists (select from jsonb_array_elements(p_rows) r group by r->>'sheet', r->>'id' having count(*) > 1) then
    raise exception 'Há identificadores repetidos na mesma aba.' using errcode = '22023';
  end if;

  select jsonb_agg(r order by r->>'sheet', r->>'id') into normalized from jsonb_array_elements(p_rows) r;
  checksum := md5(normalized::text);
  if p_commit then
    perform pg_advisory_xact_lock(hashtextextended('fabric-workbook:' || p_organization_id::text, 0));
  end if;
  select id into batch_id from public.fabric_workbook_import_batches
  where organization_id = p_organization_id and fingerprint = checksum;

  select source_rows into previous_rows from public.fabric_workbook_import_batches
  where organization_id = p_organization_id
  order by created_at desc, id desc limit 1;

  if batch_id is not null then
    new_count := 0;
    existing_count := jsonb_array_length(normalized);
    conflict_count := 0;
  else
    select count(*) filter (where prior is null),
           count(*) filter (where prior->'data' = current_row->'data'),
           count(*) filter (where prior->'data' <> current_row->'data')
    into new_count, existing_count, conflict_count
    from jsonb_array_elements(normalized) current_row
    left join jsonb_array_elements(coalesce(previous_rows, '[]'::jsonb)) prior
      on prior->>'sheet' = current_row->>'sheet' and prior->>'id' = current_row->>'id';
    if p_commit then
      insert into public.fabric_workbook_import_batches
        (organization_id, filename, fingerprint, source_rows, created_by)
      values (p_organization_id, trim(p_filename), checksum, normalized, auth.uid())
      returning id into batch_id;
    end if;
  end if;
  return jsonb_build_object('batch_id', batch_id, 'new_rows', new_count,
    'existing_rows', existing_count, 'conflicting_rows', conflict_count);
end;
$$;

create function public.fabric_workbook_import_history(p_organization_id uuid)
returns table(id uuid, filename text, row_count integer, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not coalesce(public.fabric_user_has_permission(p_organization_id, 'textiles.inventory.manage'), false) then
    raise exception 'Sem permissão para consultar importações desta organização.' using errcode = '42501';
  end if;
  return query
  select batch.id, batch.filename, batch.row_count, batch.created_at
  from public.fabric_workbook_import_batches batch
  where batch.organization_id = p_organization_id
  order by batch.created_at desc, batch.id desc limit 50;
end;
$$;

revoke all on function public.fabric_workbook_import(uuid,text,jsonb,boolean) from public, anon;
revoke all on function public.fabric_workbook_import_history(uuid) from public, anon;
grant execute on function public.fabric_workbook_import(uuid,text,jsonb,boolean) to authenticated;
grant execute on function public.fabric_workbook_import_history(uuid) to authenticated;

create function public.fabric_workbook_import_detail(p_organization_id uuid, p_batch_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
  if not coalesce(public.fabric_user_has_permission(p_organization_id, 'textiles.inventory.manage'), false) then
    raise exception 'Sem permissão para consultar importações desta organização.' using errcode = '42501';
  end if;
  select jsonb_build_object('filename', batch.filename, 'rows', batch.source_rows)
  into result from public.fabric_workbook_import_batches batch
  where batch.organization_id = p_organization_id and batch.id = p_batch_id;
  if result is null then
    raise exception 'Importação indisponível.' using errcode = '22023';
  end if;
  return result;
end;
$$;
revoke all on function public.fabric_workbook_import_detail(uuid,uuid) from public, anon;
grant execute on function public.fabric_workbook_import_detail(uuid,uuid) to authenticated;
