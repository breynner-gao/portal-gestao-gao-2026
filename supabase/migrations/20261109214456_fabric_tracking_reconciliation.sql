create table public.fabric_tracking_reconciliations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 tracking_id uuid not null references public.fabric_faction_tracking(id),
 lot_id uuid not null,
 reserved_m numeric(14,3) not null check(reserved_m>=0),
 consumed_m numeric(14,3) not null check(consumed_m>=0),
 returned_m numeric(14,3) not null check(returned_m>=0 and returned_m<=consumed_m),
 tracking_snapshot jsonb not null,
 notes text not null,
 revision uuid not null,
 updated_at timestamptz not null default now(),
 unique(organization_id,tracking_id,lot_id),
 foreign key(lot_id,organization_id) references public.fabric_lots(id,organization_id)
);
alter table public.fabric_tracking_reconciliations enable row level security;
revoke all on public.fabric_tracking_reconciliations from anon,authenticated;
grant select on public.fabric_tracking_reconciliations to authenticated;
create policy reconciliation_read on public.fabric_tracking_reconciliations for select to authenticated using(public.fabric_user_has_permission(organization_id,'textiles.inventory.view'));
create trigger reconciliation_audit after insert or update on public.fabric_tracking_reconciliations for each row execute function public.fabric_audit_production();

create function public.fabric_reconcile_tracking(p_organization_id uuid,p_tracking_id uuid,p_allocations jsonb,p_notes text,p_revision uuid,p_expected_revision uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.fabric_faction_tracking; snap jsonb; current_revision uuid; recipe_fabric uuid; recipe_count integer; l record; a jsonb; oldrow public.fabric_tracking_reconciliations; nr numeric; nc numeric; nt numeric; ds numeric; dr numeric; stock numeric; reserved numeric; changed uuid; total numeric:=0;
begin
 if auth.uid() is null or not public.fabric_user_has_permission(p_organization_id,'textiles.production.manage') then raise exception 'Sem permissão para conciliar tecido';end if;
 select * into t from public.fabric_faction_tracking where id=p_tracking_id and organization_id=p_organization_id for update;
 if not found then raise exception 'Programação não encontrada';end if;
 select revision into current_revision from public.fabric_tracking_reconciliations where tracking_id=t.id and organization_id=p_organization_id limit 1;
 if current_revision=p_revision then return p_revision;end if;
 if current_revision is distinct from p_expected_revision then raise exception 'Conciliação alterada por outra pessoa. Feche e atualize os dados.';end if;
 if p_revision is null or nullif(trim(p_notes),'') is null then raise exception 'Informe a conferência realizada';end if;
 if jsonb_typeof(p_allocations) is distinct from 'array' or jsonb_array_length(p_allocations)<1 then raise exception 'Informe ao menos um lote';end if;
 if (select count(*)<>count(distinct x->>'lot_id') from jsonb_array_elements(p_allocations) x) then raise exception 'Não repita o lote';end if;
 select count(*),(array_agg(fabric_id))[1] into recipe_count,recipe_fabric from public.fabric_product_recipes where organization_id=p_organization_id and product_reference=t.product_reference and active;
 if recipe_count<>1 then raise exception 'Vincule uma única ficha técnica ativa à peça antes de conciliar';end if;
 snap:=jsonb_build_object('quantity',t.quantity,'delivered',t.delivered,'cut_status',t.cut_status,'product_reference',t.product_reference);
 for a in select * from jsonb_array_elements(p_allocations) loop
  nr:=(a->>'reserved_m')::numeric;nc:=(a->>'consumed_m')::numeric;nt:=(a->>'returned_m')::numeric;
  if nr is null or nc is null or nt is null or nr<0 or nc<0 or nt<0 or nt>nc or greatest(nr,nc,nt)>99999999999 or nr::text='NaN' or nc::text='NaN' or nt::text='NaN' then raise exception 'Metros inválidos';end if;
  total:=total+nr+nc;
  if not exists(select 1 from public.fabric_lots where id=(a->>'lot_id')::uuid and organization_id=p_organization_id and quality_status='APROVADO' and public.fabric_same_standard(p_organization_id,fabric_id,recipe_fabric)) then raise exception 'Lote não aprovado ou incompatível com o tecido da ficha';end if;
 end loop;
 if total<=0 then raise exception 'Informe metros reservados ou consumidos';end if;
 -- Serialize all affected lots in stable order, including lots removed during correction.
 for l in select * from public.fabric_lots where organization_id=p_organization_id and (id in(select (x->>'lot_id')::uuid from jsonb_array_elements(p_allocations) x) or id in(select lot_id from public.fabric_tracking_reconciliations where tracking_id=t.id)) order by id for update loop
  select * into oldrow from public.fabric_tracking_reconciliations where tracking_id=t.id and lot_id=l.id and organization_id=p_organization_id;
  select x into a from jsonb_array_elements(p_allocations) x where (x->>'lot_id')::uuid=l.id;
  nr:=coalesce((a->>'reserved_m')::numeric,0);nc:=coalesce((a->>'consumed_m')::numeric,0);nt:=coalesce((a->>'returned_m')::numeric,0);
  ds:=-(nc-nt)+coalesce(oldrow.consumed_m-oldrow.returned_m,0);dr:=nr-coalesce(oldrow.reserved_m,0);
  select coalesce(sum(stock_delta_m),0),coalesce(sum(reserved_delta_m),0) into stock,reserved from public.fabric_stock_movements where organization_id=p_organization_id and lot_id=l.id;
  if stock+ds<0 or reserved+dr<0 or stock+ds<reserved+dr then raise exception 'Saldo livre insuficiente no lote %',l.lot_code;end if;
  if ds<>0 or dr<>0 then
   insert into public.fabric_stock_movements(organization_id,lot_id,movement_type,quantity_m,stock_delta_m,reserved_delta_m,unit_cost_per_m,idempotency_key,notes,created_by)
   values(p_organization_id,l.id,case when ds<0 then 'AJUSTE_SAIDA' when ds>0 then 'AJUSTE_ENTRADA' when dr>0 then 'RESERVA' else 'LIBERA_RESERVA' end,greatest(abs(ds),abs(dr)),ds,dr,l.effective_price_per_m,'tracking:'||t.id||':'||p_revision||':'||l.id,'Conciliação item '||coalesce(t.source_item,t.id::text)||': '||p_notes,auth.uid());
  end if;
  insert into public.fabric_tracking_reconciliations(organization_id,tracking_id,lot_id,reserved_m,consumed_m,returned_m,tracking_snapshot,notes,revision)
  values(p_organization_id,t.id,l.id,nr,nc,nt,snap,p_notes,p_revision)
  on conflict(organization_id,tracking_id,lot_id) do update set reserved_m=excluded.reserved_m,consumed_m=excluded.consumed_m,returned_m=excluded.returned_m,tracking_snapshot=excluded.tracking_snapshot,notes=excluded.notes,revision=excluded.revision,updated_at=now();
 end loop;
 return p_revision;
end $$;
revoke all on function public.fabric_reconcile_tracking(uuid,uuid,jsonb,text,uuid,uuid) from public,anon;
grant execute on function public.fabric_reconcile_tracking(uuid,uuid,jsonb,text,uuid,uuid) to authenticated;
