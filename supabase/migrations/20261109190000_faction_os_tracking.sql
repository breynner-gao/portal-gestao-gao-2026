create table public.fabric_faction_tracking (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 source_key text not null, source_row integer, source_item text, category text, product_name text not null, color text, piece_type text, size text,
 quantity integer not null check(quantity>0), delivered integer not null default 0 check(delivered>=0 and delivered<=quantity),
 cut_status text not null default 'PENDENTE', delivery_status text not null default 'PENDENTE', fabric_stock_note text,
 expected_date date, received_date date, raw_source jsonb not null default '{}', updated_at timestamptz not null default now(),
 unique(organization_id,source_key)
);
create table public.fabric_cut_batches (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 order_item_id uuid not null, lot_id uuid not null, consumed_m numeric(14,3) not null check(consumed_m>0),
 produced_pieces integer not null check(produced_pieces>0), supplier_id uuid references public.fabric_suppliers(id),
 sent_date date, expected_date date, notes text, created_at timestamptz not null default now(),
 foreign key(order_item_id,organization_id) references public.fabric_production_order_items(id,organization_id),
 foreign key(lot_id,organization_id) references public.fabric_lots(id,organization_id)
);
alter table public.fabric_purchase_orders add column if not exists logistics_stage text not null default 'CONFIRMADO' check(logistics_stage in ('COTACAO','CONFIRMADO','EM_TRANSPORTE')), add column if not exists carrier text, add column if not exists tracking_code text;
alter table public.fabric_suppliers add column if not exists supply_lines text;
alter table public.fabric_faction_tracking enable row level security;
alter table public.fabric_cut_batches enable row level security;
grant select,insert,update on public.fabric_faction_tracking,public.fabric_cut_batches to authenticated;
create policy tracking_read on public.fabric_faction_tracking for select to authenticated using(public.fabric_user_has_permission(organization_id,'textiles.inventory.view'));
create policy tracking_write on public.fabric_faction_tracking for all to authenticated using(public.fabric_user_has_permission(organization_id,'textiles.production.manage')) with check(public.fabric_user_has_permission(organization_id,'textiles.production.manage'));
create policy cuts_read on public.fabric_cut_batches for select to authenticated using(public.fabric_user_has_permission(organization_id,'textiles.inventory.view'));
create policy cuts_write on public.fabric_cut_batches for all to authenticated using(public.fabric_user_has_permission(organization_id,'textiles.production.manage')) with check(public.fabric_user_has_permission(organization_id,'textiles.production.manage'));
create index on public.fabric_cut_batches(organization_id,order_item_id);
create index on public.fabric_faction_tracking(organization_id,delivery_status);
create or replace function public.fabric_record_cut(p_organization_id uuid,p_order_item_id uuid,p_lot_id uuid,p_consumed_m numeric,p_produced_pieces integer,p_key text) returns uuid language plpgsql security invoker set search_path=public as $$
declare result uuid; begin
 if not public.fabric_user_has_permission(p_organization_id,'textiles.production.manage') then raise exception 'Sem permissão'; end if;
 perform 1 from public.fabric_production_order_items where id=p_order_item_id and organization_id=p_organization_id for update;
 if not found then raise exception 'OS inválida'; end if;
 result:=p_key::uuid;
 if exists(select 1 from public.fabric_cut_batches where id=result and organization_id=p_organization_id) then return result; end if;
 perform public.fabric_post_stock_movement(p_organization_id,p_lot_id,'ENVIO_FACCAO',p_consumed_m,p_order_item_id,'cut:'||p_key,'Consumo no corte do lote de peças');
 insert into public.fabric_cut_batches(id,organization_id,order_item_id,lot_id,consumed_m,produced_pieces) values(result,p_organization_id,p_order_item_id,p_lot_id,p_consumed_m,p_produced_pieces);
 return result;
end $$;
revoke all on function public.fabric_record_cut(uuid,uuid,uuid,numeric,integer,text) from public,anon;
grant execute on function public.fabric_record_cut(uuid,uuid,uuid,numeric,integer,text) to authenticated;
