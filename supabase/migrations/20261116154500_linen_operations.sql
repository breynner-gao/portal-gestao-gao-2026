-- A planning snapshot supplies suggested transfers. Only the operational stock
-- integration can supply eligible balances and authorize posting a physical transfer.
create table public.linen_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  snapshot_version timestamptz not null,
  product_key text not null,
  product_code text,
  product_name text not null,
  direction text not null check (direction in ('supply','return')),
  planned integer not null check (planned > 0),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  unique(organization_id,snapshot_version,product_key,direction)
);
create table public.linen_transfer_events (
  id uuid primary key,
  request_id uuid not null references public.linen_transfer_requests(id),
  quantity integer not null check (quantity > 0),
  remaining integer not null check (remaining >= 0),
  responsible_id uuid not null references public.profiles(id),
  responsible text not null,
  occurred_at timestamptz not null default now()
);
alter table public.linen_transfer_requests enable row level security;
alter table public.linen_transfer_events enable row level security;
revoke all on public.linen_transfer_requests, public.linen_transfer_events from public, anon, authenticated;
grant select on public.linen_transfer_requests, public.linen_transfer_events to authenticated;
create policy linen_transfer_requests_read on public.linen_transfer_requests
for select to authenticated
using (public.fabric_user_has_permission(organization_id,'textiles.inventory.view'));
create policy linen_transfer_events_read on public.linen_transfer_events
for select to authenticated
using (exists (select 1 from public.linen_transfer_requests r where r.id = request_id));
create index linen_transfer_events_request_idx on public.linen_transfer_events(request_id,occurred_at,id);

create function private.linen_mark_transfer_pending(p_org uuid, p_version timestamptz, p_keys jsonb)
returns setof public.linen_transfer_requests language plpgsql security definer set search_path = '' as $$
declare
  source_rows jsonb;
  choice jsonb;
  item jsonb;
  movement_direction text;
  sku text;
  goal numeric;
  target numeric;
  circulation numeric;
  amount integer;
  saved public.linen_transfer_requests;
begin
  if auth.uid() is null or not (
    public.fabric_user_has_permission(p_org,'textiles.inventory.view')
    and (public.fabric_user_has_permission(p_org,'textiles.inventory.manage')
      or public.fabric_user_has_permission(p_org,'textiles.production.manage'))
  ) then raise exception 'Seu perfil não pode registrar pendências de enxoval.' using errcode='42501'; end if;
  if jsonb_typeof(p_keys) is distinct from 'array' or jsonb_array_length(p_keys) not between 1 and 500
  then raise exception 'Selecione de 1 a 500 itens.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text,154500));
  select s.rows into source_rows from public.linen_rfid_snapshots s
    where s.organization_id=p_org and s.updated_at=p_version for share;
  if not found then raise exception 'A posição RFID mudou. Atualize a lista antes de salvar.'; end if;

  for choice in select value from jsonb_array_elements(p_keys) loop
    sku := choice->>'productKey';
    movement_direction := choice->>'direction';
    if sku is null or movement_direction is null or movement_direction not in ('supply','return')
      then raise exception 'Produto ou sentido inválido.'; end if;
    select value into strict item from jsonb_array_elements(source_rows)
      where nullif(nullif(trim(value->>'produtoId'),''),'0') is not null and 'ID:'||trim(value->>'produtoId')=sku;
    select r.* into saved from public.linen_transfer_requests r
    where r.organization_id=p_org and r.product_key=sku and r.direction=movement_direction
      and r.planned > coalesce((select sum(e.quantity) from public.linen_transfer_events e where e.request_id=r.id),0)
    order by r.created_at,r.id limit 1;
    if found then return next saved; continue; end if;
    select i.ideal into goal from public.linen_ideal_references i
      where i.organization_id=p_org and i.product_key=sku for share;
    goal := coalesce(goal,(item->>'trocaReferencia')::numeric,0);
    target := ceil(goal * coalesce((item->>'mediaDiaria')::numeric,0));
    circulation := coalesce((item->>'estoqueCirculacao')::numeric,0);
    if target <= 0 then raise exception 'Não há meta calculável para %.', item->>'produtoNome'; end if;
    amount := case movement_direction
      when 'supply' then least(floor(coalesce((item->>'estoqueGao')::numeric,(item->>'deposito')::numeric,0)),ceil(target-circulation))
      else least(floor(coalesce((item->>'mercado')::numeric,0)),floor(circulation-target-30))
    end;
    if amount <= 0 then raise exception 'A recomendação mudou para %. Atualize a lista.', item->>'produtoNome'; end if;
    insert into public.linen_transfer_requests(organization_id,snapshot_version,product_key,product_code,product_name,direction,planned,created_by)
    values(p_org,p_version,sku,item->>'produtoId',item->>'produtoNome',movement_direction,amount,auth.uid())
    on conflict(organization_id,snapshot_version,product_key,direction) do nothing
    returning * into saved;
    if not found then
      select r.* into strict saved from public.linen_transfer_requests r
      where r.organization_id=p_org and r.snapshot_version=p_version and r.product_key=sku and r.direction=choice->>'direction';
    end if;
    return next saved;
  end loop;
end;
$$;
revoke all on function private.linen_mark_transfer_pending(uuid,timestamptz,jsonb) from public, anon;
grant execute on function private.linen_mark_transfer_pending(uuid,timestamptz,jsonb) to authenticated;

create function public.linen_mark_transfer_pending(p_org uuid,p_version timestamptz,p_keys jsonb)
returns setof public.linen_transfer_requests language sql security invoker set search_path='' as $$
select * from private.linen_mark_transfer_pending(p_org,p_version,p_keys);
$$;
revoke all on function public.linen_mark_transfer_pending(uuid,timestamptz,jsonb) from public, anon;
grant execute on function public.linen_mark_transfer_pending(uuid,timestamptz,jsonb) to authenticated;
