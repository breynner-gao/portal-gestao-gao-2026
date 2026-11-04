-- Preserve coverage for all pieces in an active faction order, including accepted partial returns.
create or replace function public.fabric_create_orders_for_demand(
  p_organization_id uuid,
  p_demand_as_of date,
  p_lines jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_line jsonb;
  v_order_id uuid;
  v_order_item_id uuid;
  v_recipe public.fabric_product_recipes%rowtype;
  v_requested integer;
  v_covered integer;
  v_missing integer;
  v_source_key text;
  v_item_count integer := 0;
  v_piece_count integer := 0;
  v_existing public.fabric_production_orders%rowtype;
begin
  if not public.fabric_user_has_permission(p_organization_id, 'textiles.production.manage') then
    raise exception 'Sem permissão para criar ordens de facção.';
  end if;
  if p_demand_as_of is null or p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 then
    raise exception 'Data da necessidade e chave de idempotência válida são obrigatórias.';
  end if;
  if jsonb_typeof(p_lines) <> 'array' then
    raise exception 'A lista de necessidades deve ser uma matriz JSON.';
  end if;

  select * into v_existing
  from public.fabric_production_orders
  where organization_id = p_organization_id and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number,
      'created', false, 'covered', true, 'item_count', 0, 'piece_count', 0);
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    v_source_key := nullif(trim(v_line->>'source_item_key'), '');
    v_requested := greatest(0, coalesce((v_line->>'requested_pieces')::integer, 0));
    if v_source_key is null or v_requested <= 0 then
      continue;
    end if;
    perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || v_source_key, 0));

    if not exists (
      select 1 from public.fabric_product_recipes r
      where r.id = (v_line->>'recipe_id')::uuid
        and r.organization_id = p_organization_id and r.active
    ) then
      raise exception 'A peça % não possui ficha técnica ativa para a organização.', v_source_key;
    end if;
    select * into v_recipe from public.fabric_product_recipes r
      where r.id = (v_line->>'recipe_id')::uuid
        and r.organization_id = p_organization_id and r.active;

    select coalesce(sum(i.ordered_pieces), 0)::integer
      into v_covered
    from public.fabric_production_order_items i
    join public.fabric_production_orders o
      on o.id = i.order_id and o.organization_id = i.organization_id
    left join lateral (
      select sum(fr.accepted_pieces)::integer as accepted
      from public.fabric_faction_returns fr
      where fr.organization_id = i.organization_id and fr.order_item_id = i.id
    ) ret on true
    where i.organization_id = p_organization_id
      and i.source_item_key = v_source_key
      and i.recipe_id = v_recipe.id
      and o.status in ('ABERTA', 'PARCIAL', 'ENVIADA');

    v_missing := greatest(0, v_requested - v_covered);
    if v_missing = 0 then
      continue;
    end if;

    if v_order_id is null then
      insert into public.fabric_production_orders(
        organization_id, demand_as_of, status, idempotency_key, created_by
      ) values (
        p_organization_id, p_demand_as_of, 'ABERTA', p_idempotency_key, (select auth.uid())
      ) returning id into v_order_id;
    end if;

    insert into public.fabric_production_order_items(
      organization_id, order_id, source_item_key, product_reference, product_name,
      recipe_id, fabric_id, ordered_pieces, consumption_m_per_piece,
      planned_price_per_m, faction_cost_per_piece, extras_cost_per_piece, created_by
    ) values (
      p_organization_id, v_order_id, v_source_key,
      coalesce(nullif(trim(v_line->>'product_reference'), ''), v_source_key),
      coalesce(nullif(trim(v_line->>'product_name'), ''), v_recipe.product_name),
      v_recipe.id, v_recipe.fabric_id, v_missing, v_recipe.consumption_m_per_piece,
      coalesce((v_line->>'planned_price_per_m')::numeric, 0),
      v_recipe.faction_cost_per_piece, v_recipe.extras_cost_per_piece, (select auth.uid())
    ) returning id into v_order_item_id;
    v_item_count := v_item_count + 1;
    v_piece_count := v_piece_count + v_missing;
  end loop;

  if v_order_id is null then
    return jsonb_build_object('order_id', null, 'created', false, 'covered', true, 'item_count', 0, 'piece_count', 0);
  end if;
  return jsonb_build_object('order_id', v_order_id, 'created', true, 'covered', false,
    'item_count', v_item_count, 'piece_count', v_piece_count);
end;
$$;
