alter table public.fabric_cut_enfestos
  alter column consumed_m drop not null,
  add column planned_m numeric(14,3) check (planned_m > 0),
  add column waste_m numeric(14,3) check (waste_m >= 0 and waste_m <= consumed_m),
  add column returned_m numeric(14,3) check (returned_m >= 0),
  add constraint fabric_enfesto_has_measurement check (planned_m is not null or consumed_m is not null),
  add constraint fabric_enfesto_stock_requires_result check (stock_posted_at is null or consumed_m is not null);

create function private.fabric_enfesto_planning(p_org uuid, p_action text, p_data jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  cut_id uuid;
  cut public.fabric_cut_enfestos;
  fabric uuid;
  planned numeric;
  consumed numeric;
  waste numeric;
  returned numeric;
  line jsonb;
  line_source uuid;
  actual jsonb;
  piece_lines jsonb;
  allocations jsonb;
begin
  if auth.uid() is null or not public.fabric_user_has_permission(p_org, 'textiles.production.manage') then
    raise exception 'Sem permissão para registrar corte.' using errcode = '42501';
  end if;
  cut_id := (p_data->>'id')::uuid;
  if cut_id is null then raise exception 'Identificação do lote inválida.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cut_id::text, 0));
  select * into cut from public.fabric_cut_enfestos e
    where e.id = cut_id and e.organization_id = p_org for update;

  if p_action = 'post_stock' and cut.id is not null and cut.consumed_m is null then
    raise exception 'Registre o resultado do corte antes da baixa.';
  end if;

  if p_action = 'plan' then
    if coalesce(p_data->>'planned_m', '') !~ '^[0-9]{1,11}(\.[0-9]{1,3})?$' then
      raise exception 'Informe os metros previstos com até três casas decimais.';
    end if;
    planned := (p_data->>'planned_m')::numeric;
    fabric := (p_data->>'fabric_id')::uuid;
    if planned <= 0 or not exists (
      select 1 from public.fabric_catalog c where c.id = fabric and c.organization_id = p_org
    ) then raise exception 'Selecione o tecido e informe os metros previstos.'; end if;

    piece_lines := p_data->'outputs';
    if jsonb_typeof(piece_lines) is distinct from 'array' then raise exception 'Informe as peças previstas.'; end if;
    if jsonb_array_length(piece_lines) not between 1 and 100 then
      raise exception 'Informe entre 1 e 100 linhas de peças previstas.';
    end if;
    for line in select value from jsonb_array_elements(piece_lines) loop
      if coalesce(length(trim(line->>'product_name')), 0) not between 1 and 300
        or coalesce(length(trim(line->>'size')), 0) not between 1 and 80
        or coalesce(line->>'planned_pieces', '') !~ '^[1-9][0-9]{0,7}$'
        or line ? 'pieces' then
        raise exception 'Informe peça, tamanho e quantidade prevista inteira positiva em cada linha.';
      end if;
      line_source := nullif(line->>'source_id', '')::uuid;
      case coalesce(line->>'source_type', '')
        when 'os' then
          if not exists (
            select 1 from public.fabric_production_order_items i
            join public.fabric_production_orders o on o.id = i.order_id and o.organization_id = p_org
            where i.id = line_source and i.organization_id = p_org and o.status <> 'CANCELADA'
              and public.fabric_same_standard(p_org, i.fabric_id, fabric)
              and i.product_name = line->>'product_name'
          ) then raise exception 'Item da OS não corresponde ao tecido ou à peça informada.'; end if;
        when 'programacao' then
          if not exists (
            select 1 from public.fabric_faction_tracking t where t.id = line_source
              and t.organization_id = p_org and t.product_name = line->>'product_name'
          ) then raise exception 'Programação inválida.'; end if;
        when '' then
          if line_source is not null then raise exception 'Origem da peça inválida.'; end if;
        else raise exception 'Origem da peça inválida.';
      end case;
    end loop;
    if cut.id is not null then
      if cut.planned_m is distinct from planned or cut.fabric_id <> fabric
        or cut.cut_on is distinct from (p_data->>'cut_on')::date
        or (select jsonb_agg(value - 'pieces' order by ord)
            from jsonb_array_elements(cut.outputs) with ordinality as e(value, ord)) <> piece_lines
        or (cut.consumed_m is null and cut.notes is distinct from nullif(trim(p_data->>'notes'), '')) then
        raise exception 'Este lote já foi salvo com outros dados. Atualize a tela.';
      end if;
      return cut.id;
    end if;
    insert into public.fabric_cut_enfestos(id, organization_id, fabric_id, cut_on, planned_m, outputs, notes)
    values(cut_id, p_org, fabric, (p_data->>'cut_on')::date, planned, piece_lines, nullif(trim(p_data->>'notes'), ''));
    return cut_id;
  end if;

  if p_action <> 'finish' or p_action is null then
    return private.fabric_save_enfesto(p_org, p_action, p_data);
  end if;
  if cut.id is null or cut.planned_m is null then raise exception 'Planejamento de corte não encontrado.'; end if;
  if coalesce(p_data->>'consumed_m', '') !~ '^[0-9]{1,11}(\.[0-9]{1,3})?$'
    or coalesce(p_data->>'waste_m', '') !~ '^[0-9]{1,11}(\.[0-9]{1,3})?$'
    or coalesce(p_data->>'returned_m', '') !~ '^[0-9]{1,11}(\.[0-9]{1,3})?$' then
    raise exception 'Informe metros utilizados, desperdício e sobra com até três casas decimais.';
  end if;
  consumed := (p_data->>'consumed_m')::numeric;
  waste := (p_data->>'waste_m')::numeric;
  returned := (p_data->>'returned_m')::numeric;
  if consumed <= 0 then raise exception 'Informe os metros utilizados no corte.'; end if;
  if waste > consumed then raise exception 'O desperdício deve estar incluído nos metros utilizados.'; end if;

  actual := p_data->'actual_pieces';
  if jsonb_typeof(actual) is distinct from 'array' then raise exception 'Informe as quantidades cortadas.'; end if;
  if jsonb_array_length(actual) <> jsonb_array_length(cut.outputs) or exists (
    select 1 from jsonb_array_elements_text(actual) a(value) where coalesce(a.value, '') !~ '^(0|[1-9][0-9]{0,7})$'
  ) then raise exception 'Informe uma quantidade inteira de peças cortadas para cada linha do planejamento.'; end if;
  select jsonb_agg(value || jsonb_build_object('pieces', actual -> (ord::int - 1)) order by ord)
    into piece_lines from jsonb_array_elements(cut.outputs) with ordinality as e(value, ord);

  allocations := coalesce(p_data->'allocations', '[]'::jsonb);
  if jsonb_typeof(allocations) is distinct from 'array' then raise exception 'Rolos inválidos.'; end if;
  if cut.consumed_m is not null then
    if cut.consumed_m <> consumed or cut.waste_m is distinct from waste
      or cut.returned_m is distinct from returned or cut.outputs <> piece_lines
      or (jsonb_array_length(allocations) > 0 and cut.allocations <> allocations) then
      raise exception 'O resultado deste corte já foi salvo com outros dados.';
    end if;
    return cut_id;
  end if;

  update public.fabric_cut_enfestos set consumed_m = consumed, waste_m = waste, returned_m = returned, outputs = piece_lines
    where id = cut_id;
  if jsonb_array_length(allocations) > 0 then
    perform private.fabric_save_enfesto(p_org, 'post_stock', p_data);
  end if;
  return cut_id;
end;
$$;
revoke all on function private.fabric_enfesto_planning(uuid,text,jsonb) from public, anon;
grant execute on function private.fabric_enfesto_planning(uuid,text,jsonb) to authenticated;

create or replace function public.fabric_save_enfesto(p_org uuid, p_action text, p_data jsonb)
returns uuid language sql security invoker set search_path = '' as $$
  select private.fabric_enfesto_planning(p_org,p_action,p_data)
$$;
