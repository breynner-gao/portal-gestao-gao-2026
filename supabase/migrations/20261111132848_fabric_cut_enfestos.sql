create table public.fabric_cut_enfestos (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  fabric_id uuid not null,
  cut_on date not null,
  consumed_m numeric(14,3) not null check (consumed_m > 0),
  outputs jsonb not null check (jsonb_typeof(outputs) = 'array'),
  allocations jsonb not null default '[]' check (jsonb_typeof(allocations) = 'array'),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  stock_posted_at timestamptz,
  stock_posted_by uuid,
  foreign key (fabric_id, organization_id) references public.fabric_catalog(id, organization_id)
);
create index fabric_cut_enfestos_org_idx on public.fabric_cut_enfestos(organization_id, created_at desc);
alter table public.fabric_cut_enfestos enable row level security;
revoke all on public.fabric_cut_enfestos from public, anon, authenticated;
grant select on public.fabric_cut_enfestos to authenticated;
grant all on public.fabric_cut_enfestos to service_role;
create policy fabric_cut_enfestos_read on public.fabric_cut_enfestos for select to authenticated
using (public.fabric_user_has_permission(organization_id, 'textiles.inventory.view')
    or public.fabric_user_has_permission(organization_id, 'textiles.production.manage'));

create function private.fabric_save_enfesto(p_org uuid, p_action text, p_data jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  cut_id uuid;
  cut public.fabric_cut_enfestos;
  roll public.fabric_lots;
  row_data jsonb;
  roll_entries jsonb;
  fabric_id_input uuid;
  consumed numeric;
  source_id uuid;
begin
  if auth.uid() is null or not public.fabric_user_has_permission(p_org, 'textiles.production.manage') then
    raise exception 'Sem permissão para registrar corte.' using errcode = '42501';
  end if;
  cut_id := (p_data->>'id')::uuid;
  if cut_id is null or p_action is null or p_action not in ('create', 'post_stock') then
    raise exception 'Dados do lote de corte inválidos.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(cut_id::text, 0));
  select * into cut from public.fabric_cut_enfestos e where e.id = cut_id and e.organization_id = p_org for update;
  roll_entries := coalesce(p_data->'allocations', '[]'::jsonb);
  if p_action = 'create' then
    if coalesce(p_data->>'consumed_m', '') !~ '^[0-9]{1,11}(\.[0-9]{1,3})?$' then
      raise exception 'Informe os metros totais com até três casas decimais.';
    end if;
    consumed := (p_data->>'consumed_m')::numeric;
    fabric_id_input := (p_data->>'fabric_id')::uuid;
    if consumed <= 0 or not exists (
      select 1 from public.fabric_catalog c where c.id = fabric_id_input and c.organization_id = p_org
    ) then raise exception 'Selecione o tecido e informe o total de metros usados.'; end if;
    if jsonb_typeof(p_data->'outputs') is distinct from 'array' then raise exception 'Informe as peças cortadas.'; end if;
    if jsonb_array_length(p_data->'outputs') not between 1 and 100 then
      raise exception 'Informe entre 1 e 100 linhas de peças cortadas.';
    end if;
    for row_data in select value from jsonb_array_elements(p_data->'outputs') loop
      if coalesce(length(trim(row_data->>'product_name')), 0) not between 1 and 300
        or coalesce(length(trim(row_data->>'size')), 0) not between 1 and 80
        or coalesce(row_data->>'pieces', '') !~ '^[1-9][0-9]{0,7}$' then
        raise exception 'Informe peça, tamanho e quantidade inteira positiva em cada linha.';
      end if;
      source_id := nullif(row_data->>'source_id', '')::uuid;
      if coalesce(row_data->>'source_type', '') = 'os' then
        if not exists (select 1 from public.fabric_production_order_items i
          join public.fabric_production_orders o on o.id = i.order_id and o.organization_id = p_org
          where i.id = source_id and i.organization_id = p_org and o.status <> 'CANCELADA'
          and public.fabric_same_standard(p_org, i.fabric_id, fabric_id_input)
          and i.product_name = row_data->>'product_name') then
          raise exception 'Item da OS não corresponde ao tecido ou à peça informada.';
        end if;
      elsif coalesce(row_data->>'source_type', '') = 'programacao' then
        if not exists (select 1 from public.fabric_faction_tracking t where t.id = source_id
          and t.organization_id = p_org and t.product_name = row_data->>'product_name') then
          raise exception 'Programação inválida.';
        end if;
      elsif source_id is not null or coalesce(row_data->>'source_type', '') <> '' then
        raise exception 'Origem da peça inválida.';
      end if;
    end loop;
    if cut.id is not null then
      if cut.fabric_id <> fabric_id_input or cut.consumed_m <> consumed
        or cut.cut_on is distinct from (p_data->>'cut_on')::date
        or cut.outputs <> p_data->'outputs'
        or cut.notes is distinct from nullif(trim(p_data->>'notes'), '') then
        raise exception 'Este lote já foi salvo com outros dados. Atualize a tela.';
      end if;
      return cut.id;
    end if;
    insert into public.fabric_cut_enfestos(id, organization_id, fabric_id, cut_on, consumed_m, outputs, notes)
    values(cut_id, p_org, fabric_id_input, (p_data->>'cut_on')::date, consumed, p_data->'outputs', nullif(trim(p_data->>'notes'), ''))
    returning * into cut;
  elsif cut.id is null then
    raise exception 'Lote de corte não encontrado.';
  end if;
  if jsonb_typeof(roll_entries) is distinct from 'array' then raise exception 'Rolos inválidos.'; end if;
  if jsonb_array_length(roll_entries) = 0 then
    if p_action = 'post_stock' then raise exception 'Informe os rolos e os metros para a baixa.'; end if;
    return cut_id;
  end if;
  if cut.stock_posted_at is not null then
    if cut.allocations <> roll_entries then raise exception 'A baixa deste corte já foi registrada.'; end if;
    return cut_id;
  end if;
  if jsonb_array_length(roll_entries) > 100 or exists (
    select 1 from jsonb_array_elements(roll_entries) a
    where a->>'lot_id' is null or coalesce(a->>'meters', '') !~ '^[0-9]{1,11}(\.[0-9]{1,3})?$'
  ) then raise exception 'Informe rolos e metros válidos.'; end if;
  if exists (select 1 from jsonb_array_elements(roll_entries) a where (a->>'meters')::numeric <= 0)
    or (select sum((a->>'meters')::numeric) from jsonb_array_elements(roll_entries) a) <> cut.consumed_m then
    raise exception 'A soma dos metros dos rolos deve ser igual ao total do corte.';
  end if;
  if exists (select 1 from jsonb_array_elements(roll_entries) a group by (a->>'lot_id')::uuid having count(*) > 1) then
    raise exception 'Use uma linha por rolo na baixa.';
  end if;
  for row_data in select value from jsonb_array_elements(roll_entries) order by (value->>'lot_id')::uuid loop
    select * into roll from public.fabric_lots l
      where l.id = (row_data->>'lot_id')::uuid and l.organization_id = p_org for update;
    if not found or roll.quality_status <> 'APROVADO'
      or not public.fabric_same_standard(p_org, cut.fabric_id, roll.fabric_id) then
      raise exception 'Selecione rolos aprovados do tecido do enfesto.';
    end if;
    perform public.fabric_post_stock_movement(p_org, roll.id, 'AJUSTE_SAIDA',
      (row_data->>'meters')::numeric, null, 'enfesto:' || cut_id || ':' || roll.id, 'Consumo real no enfesto ' || cut_id);
  end loop;
  update public.fabric_cut_enfestos
    set allocations = roll_entries, stock_posted_at = now(), stock_posted_by = auth.uid()
    where id = cut_id;
  return cut_id;
end;
$$;
revoke all on function private.fabric_save_enfesto(uuid,text,jsonb) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.fabric_save_enfesto(uuid,text,jsonb) to authenticated;
create function public.fabric_save_enfesto(p_org uuid, p_action text, p_data jsonb)
returns uuid language sql security invoker set search_path = '' as $$
  select private.fabric_save_enfesto(p_org,p_action,p_data)
$$;
revoke all on function public.fabric_save_enfesto(uuid,text,jsonb) from public, anon;
grant execute on function public.fabric_save_enfesto(uuid,text,jsonb) to authenticated;
