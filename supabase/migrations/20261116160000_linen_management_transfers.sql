-- A checked, eligible count is separate from the weekly gross RFID position.
alter table public.linen_transfer_events add column stock_version timestamptz;

create table public.linen_eligible_stock (
  organization_id uuid not null references public.organizations(id),
  snapshot_version timestamptz not null,
  product_key text not null,
  depot integer not null check (depot >= 0),
  market integer not null check (market >= 0),
  counted_depot integer not null check (counted_depot >= 0),
  counted_market integer not null check (counted_market >= 0),
  counted_by uuid not null references public.profiles(id),
  counted_at timestamptz not null default now(),
  primary key (organization_id,snapshot_version,product_key)
);
alter table public.linen_eligible_stock enable row level security;
revoke all on public.linen_eligible_stock from public, anon, authenticated;
grant select on public.linen_eligible_stock to authenticated;
create policy linen_eligible_stock_read on public.linen_eligible_stock
for select to authenticated using (public.fabric_user_has_permission(organization_id,'textiles.inventory.view'));

create function private.linen_set_eligible_stock(p_org uuid,p_version timestamptz,p_key text,p_depot integer,p_market integer)
returns void language plpgsql security definer set search_path='' as $$
declare
  item jsonb;
begin
  if auth.uid() is null or not (public.fabric_user_has_permission(p_org,'textiles.inventory.view')
    and public.fabric_user_has_permission(p_org,'textiles.inventory.manage'))
  then raise exception 'Seu perfil não pode conferir saldos.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text,154500));
  select r.value into item from public.linen_rfid_snapshots s
  cross join lateral jsonb_array_elements(s.rows) r
  where s.organization_id=p_org and s.updated_at=p_version and 'ID:'||trim(r.value->>'produtoId')=p_key
  for share of s;
  if item is null then raise exception 'Produto ou posição semanal desatualizados.'; end if;
  if p_depot is null or p_market is null or p_depot<0 or p_market<0
    or p_depot>greatest(0,coalesce((item->>'estoqueGao')::numeric,(item->>'deposito')::numeric,0))
    or p_market>greatest(0,coalesce((item->>'mercado')::numeric,0))
  then raise exception 'A conferência deve ficar entre zero e o saldo bruto da posição semanal.'; end if;
  insert into public.linen_eligible_stock(organization_id,snapshot_version,product_key,depot,market,counted_depot,counted_market,counted_by)
  values(p_org,p_version,p_key,p_depot,p_market,p_depot,p_market,auth.uid())
  on conflict do nothing;
  if not found and not exists(select 1 from public.linen_eligible_stock
    where organization_id=p_org and snapshot_version=p_version and product_key=p_key
      and counted_by=auth.uid() and counted_depot=p_depot and counted_market=p_market)
  then raise exception 'Este produto já foi conferido nesta posição semanal.'; end if;
end;
$$;

create function private.linen_confirm_transfers(p_org uuid,p_version timestamptz,p_choices jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare
  choice jsonb;
  request_row public.linen_transfer_requests;
  existing public.linen_transfer_events;
  stock public.linen_eligible_stock;
  actor uuid := auth.uid();
  actor_name text;
  amount integer;
  available integer;
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

    perform 1 from public.linen_rfid_snapshots where organization_id=p_org and updated_at=p_version for share;
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
    available := case side when 'supply' then stock.depot else stock.market end;
    if available is null then raise exception 'Confira o saldo elegível do produto antes de confirmar.'; end if;
    if amount>available then raise exception 'Quantidade superior ao saldo elegível na origem.'; end if;

    update public.linen_eligible_stock set
      depot=depot+case side when 'supply' then -amount else amount end,
      market=market+case side when 'supply' then amount else -amount end
      where organization_id=p_org and snapshot_version=p_version and product_key=sku;
    insert into public.linen_transfer_events(id,request_id,quantity,remaining,responsible_id,responsible,stock_version)
    values(event_key,request_row.id,amount,remaining_before-amount,actor,actor_name,p_version);
  end loop;
end;
$$;

create function public.linen_set_eligible_stock(p_org uuid,p_version timestamptz,p_key text,p_depot integer,p_market integer)
returns void language sql security invoker set search_path='' as $$
  select private.linen_set_eligible_stock(p_org,p_version,p_key,p_depot,p_market);
$$;
create function public.linen_confirm_transfers(p_org uuid,p_version timestamptz,p_choices jsonb)
returns void language sql security invoker set search_path='' as $$
  select private.linen_confirm_transfers(p_org,p_version,p_choices);
$$;
revoke all on function private.linen_set_eligible_stock(uuid,timestamptz,text,integer,integer),
  public.linen_set_eligible_stock(uuid,timestamptz,text,integer,integer),
  private.linen_confirm_transfers(uuid,timestamptz,jsonb),public.linen_confirm_transfers(uuid,timestamptz,jsonb) from public,anon;
grant execute on function private.linen_set_eligible_stock(uuid,timestamptz,text,integer,integer),
  public.linen_set_eligible_stock(uuid,timestamptz,text,integer,integer),
  private.linen_confirm_transfers(uuid,timestamptz,jsonb),public.linen_confirm_transfers(uuid,timestamptz,jsonb) to authenticated;
