create table public.fabric_production_audit(id bigint generated always as identity primary key,organization_id uuid not null references public.organizations(id),entity text not null,record_id uuid not null,before_data jsonb,after_data jsonb,changed_by uuid,changed_at timestamptz not null default now());
alter table public.fabric_production_audit enable row level security;
grant select on public.fabric_production_audit to authenticated;
create policy production_audit_read on public.fabric_production_audit for select to authenticated using(public.fabric_user_has_permission(organization_id,'textiles.inventory.view'));
create function public.fabric_audit_production() returns trigger language plpgsql security definer set search_path=public as $$ begin
 insert into public.fabric_production_audit(organization_id,entity,record_id,before_data,after_data,changed_by) values(new.organization_id,tg_table_name,new.id,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new),auth.uid());return new;end $$;
create trigger faction_tracking_audit after insert or update on public.fabric_faction_tracking for each row execute function public.fabric_audit_production();
create trigger cut_batch_audit after insert or update on public.fabric_cut_batches for each row execute function public.fabric_audit_production();
create function public.fabric_validate_cut_dispatch() returns trigger language plpgsql set search_path=public as $$ begin
 if tg_op='UPDATE' and (new.lot_id,new.order_item_id,new.organization_id,new.consumed_m,new.produced_pieces) is distinct from (old.lot_id,old.order_item_id,old.organization_id,old.consumed_m,old.produced_pieces) then raise exception 'Lote de corte já lançado não pode alterar o consumo ou origem';end if;
 if new.sent_date is not null then
  if new.supplier_id is null or not exists(select 1 from public.fabric_suppliers where id=new.supplier_id and organization_id=new.organization_id) then raise exception 'Selecione uma facção cadastrada na GAO';end if;
  new.expected_date:=coalesce(new.expected_date,new.sent_date+21);
  if new.expected_date<>new.sent_date+21 and nullif(trim(new.notes),'') is null then raise exception 'Justifique a alteração do prazo de 21 dias';end if;
  if new.expected_date<new.sent_date then raise exception 'Previsão anterior ao envio';end if;
 end if;return new;end $$;
create trigger validate_cut_dispatch before insert or update on public.fabric_cut_batches for each row execute function public.fabric_validate_cut_dispatch();
create function public.fabric_validate_cut_return() returns trigger language plpgsql set search_path=public as $$ declare sent integer; received integer; begin
 perform 1 from public.fabric_production_order_items where id=new.order_item_id and organization_id=new.organization_id for update;
 if exists(select 1 from public.fabric_cut_batches where order_item_id=new.order_item_id and organization_id=new.organization_id) then
  select coalesce(sum(produced_pieces),0) into sent from public.fabric_cut_batches where order_item_id=new.order_item_id and organization_id=new.organization_id and sent_date is not null;
  select coalesce(sum(accepted_pieces+rejected_pieces),0) into received from public.fabric_faction_returns where order_item_id=new.order_item_id and organization_id=new.organization_id;
  if received+new.accepted_pieces+new.rejected_pieces>sent then raise exception 'Recebimento excede as peças enviadas à facção';end if;
 end if;return new;end $$;
create trigger validate_cut_return before insert on public.fabric_faction_returns for each row execute function public.fabric_validate_cut_return();
create or replace function public.fabric_record_cut(p_organization_id uuid,p_order_item_id uuid,p_lot_id uuid,p_consumed_m numeric,p_produced_pieces integer,p_key text) returns uuid language plpgsql security invoker set search_path=public as $$
declare result uuid; begin
 if not public.fabric_user_has_permission(p_organization_id,'textiles.production.manage') then raise exception 'Sem permissão'; end if;
 perform 1 from public.fabric_production_order_items where id=p_order_item_id and organization_id=p_organization_id for update;
 if not found then raise exception 'OS inválida'; end if;
 if not exists(select 1 from public.fabric_lots where id=p_lot_id and organization_id=p_organization_id and quality_status='APROVADO') then raise exception 'Lote precisa estar aprovado pela Qualidade';end if;
 result:=p_key::uuid;
 if exists(select 1 from public.fabric_cut_batches where id=result and organization_id=p_organization_id) then return result; end if;
 perform public.fabric_post_stock_movement(p_organization_id,p_lot_id,'ENVIO_FACCAO',p_consumed_m,p_order_item_id,'cut:'||p_key,'Consumo no corte do lote de peças');
 insert into public.fabric_cut_batches(id,organization_id,order_item_id,lot_id,consumed_m,produced_pieces) values(result,p_organization_id,p_order_item_id,p_lot_id,p_consumed_m,p_produced_pieces);
 return result;
end $$;
