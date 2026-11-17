create or replace function private.linen_confirm_transfers(p_org uuid,p_version timestamptz,p_choices jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare
  choice jsonb;
  request_row public.linen_transfer_requests;
  existing public.linen_transfer_events;
  stock public.linen_eligible_stock;
  actor uuid := auth.uid();
  actor_name text;
  amount integer;
  available bigint;
  source_rows jsonb;
  item jsonb;
  net_supply bigint;
  remaining_before integer;
  event_key uuid;
  sku text;
  side text;
  request_key uuid;
begin
  if actor is null or not (public.fabric_user_has_permission(p_org,'textiles.inventory.view')
    and (public.fabric_user_has_permission(p_org,'textiles.inventory.manage')
      or public.fabric_user_has_permission(p_org,'textiles.production.manage')))
  then raise exception 'Seu perfil não pode confirmar movimentações.' using errcode='42501'; end if;
  if jsonb_typeof(p_choices) is distinct from 'array' or jsonb_array_length(p_choices) not between 1 and 500
  then raise exception 'Selecione de 1 a 500 itens.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text,154500));
  select coalesce(nullif(full_name,''),username) into strict actor_name from public.profiles where id=actor and active;

  for choice in select value from jsonb_array_elements(p_choices) loop
    event_key := (choice->>'eventId')::uuid;
    sku := choice->>'productKey';
    side := choice->>'direction';
    request_key := (choice->>'requestId')::uuid;
    amount := (choice->>'quantity')::integer;
    if event_key is null or sku is null or side is null or side not in ('supply','return') or amount is null or amount < 0
    then raise exception 'Movimentação inválida.'; end if;

    select e.* into existing from public.linen_transfer_events e where e.id=event_key;
    if found then
      if existing.responsible_id=actor and existing.quantity=amount
        and exists(select 1 from public.linen_transfer_requests r where r.id=existing.request_id
          and r.organization_id=p_org and r.product_key=sku and r.direction=side
          and (request_key is null or r.id=request_key)) then continue; end if;
      raise exception 'A referência já pertence a outra movimentação.';
    end if;

    select rows into source_rows from public.linen_rfid_snapshots where organization_id=p_org and updated_at=p_version for share;
    if not found then raise exception 'A posição semanal mudou. Atualize a lista.'; end if;
    if request_key is null then
      if exists(select 1 from public.linen_transfer_requests r
        join public.linen_transfer_events e on e.request_id=r.id
        where r.organization_id=p_org and r.product_key=sku and r.direction=side
          and e.stock_version=p_version and e.remaining=0)
      then raise exception 'Este produto já foi atendido neste sentido. Atualize a lista.'; end if;
      select * into strict request_row from private.linen_mark_transfer_pending(p_org,p_version,
        jsonb_build_array(jsonb_build_object('productKey',sku,'direction',side)));
    else
      select * into request_row from public.linen_transfer_requests
      where id=request_key and organization_id=p_org and direction=side and product_key=sku;
      if not found then raise exception 'Solicitação inválida.'; end if;
    end if;
    if amount=0 then continue; end if;
    select request_row.planned-coalesce(sum(e.quantity),0) into remaining_before
      from public.linen_transfer_events e where e.request_id=request_row.id;
    if (choice->>'expectedRemaining')::integer is distinct from remaining_before
    then raise exception 'O saldo mudou. Atualize e confira a movimentação antes de salvar.'; end if;
    if amount>remaining_before then raise exception 'Quantidade superior ao saldo da solicitação.'; end if;
    select * into stock from public.linen_eligible_stock
      where organization_id=p_org and snapshot_version=p_version and product_key=sku;
    if found then
      available := case side when 'supply' then stock.depot else stock.market end;
    else
      select r.value into item from jsonb_array_elements(source_rows) r
      where nullif(nullif(trim(r.value->>'produtoId'),''),'0') is not null
        and 'ID:'||trim(r.value->>'produtoId')=sku;
      if item is null then raise exception 'Produto ausente da posição semanal. Atualize a lista.'; end if;

      select coalesce(sum(case r.direction when 'supply' then e.quantity else -e.quantity end),0)
      into net_supply
      from public.linen_transfer_events e
      join public.linen_transfer_requests r on r.id=e.request_id
      where r.organization_id=p_org and r.product_key=sku and e.stock_version=p_version;

      available := case side when 'supply' then
        greatest(0,floor(coalesce((item->>'estoqueGao')::numeric,(item->>'deposito')::numeric,0)))-net_supply
        else greatest(0,floor(coalesce((item->>'mercado')::numeric,0)))+net_supply
      end;
    end if;
    if amount>available then raise exception 'Quantidade superior ao saldo registrado na origem.'; end if;

    update public.linen_eligible_stock set
      depot=depot+case side when 'supply' then -amount else amount end,
      market=market+case side when 'supply' then amount else -amount end
      where organization_id=p_org and snapshot_version=p_version and product_key=sku;
    insert into public.linen_transfer_events(id,request_id,quantity,remaining,responsible_id,responsible,stock_version)
    values(event_key,request_row.id,amount,remaining_before-amount,actor,actor_name,p_version);
  end loop;
end;
$$;
