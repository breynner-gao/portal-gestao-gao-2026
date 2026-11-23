create table public.fabric_faction_forecast_preferences (
 organization_id uuid not null references public.organizations(id),
 product_reference text not null check (length(product_reference) between 1 and 240),
 include_in_forecast boolean not null,
 updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(),
 primary key (organization_id,product_reference)
);

alter table public.fabric_faction_forecast_preferences enable row level security;
revoke all on public.fabric_faction_forecast_preferences from public,anon,authenticated;
grant select on public.fabric_faction_forecast_preferences to authenticated;
create policy fabric_forecast_preferences_read on public.fabric_faction_forecast_preferences
 for select to authenticated using (
 public.fabric_user_has_permission(organization_id,'textiles.inventory.view')
 or public.fabric_user_has_permission(organization_id,'textiles.production.manage'));

create function private.fabric_faction_set_forecast(p_org uuid,p_reference text,p_include boolean)
returns void language plpgsql security definer set search_path='' as $$
declare ref text := btrim(p_reference);
begin
 if auth.uid() is null or not coalesce(public.fabric_user_has_permission(p_org,'textiles.production.manage'),false)
 then raise exception 'Sem permissão para alterar a previsão da facção.' using errcode='42501'; end if;
 if coalesce(length(ref),0) not between 1 and 240 or p_include is null
 then raise exception 'Selecione um produto e a participação na previsão.'; end if;

 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':'||ref,0));
 insert into public.fabric_faction_forecast_preferences(organization_id,product_reference,include_in_forecast,updated_by)
 values(p_org,ref,p_include,auth.uid())
 on conflict(organization_id,product_reference) do update
 set include_in_forecast=excluded.include_in_forecast,updated_by=excluded.updated_by,updated_at=now();
end;
$$;

create function public.fabric_faction_set_forecast(p_org uuid,p_reference text,p_include boolean)
returns void language sql security invoker set search_path='' as $$
 select private.fabric_faction_set_forecast(p_org,p_reference,p_include)
$$;
revoke all on function private.fabric_faction_set_forecast(uuid,text,boolean),
 public.fabric_faction_set_forecast(uuid,text,boolean) from public,anon;
grant execute on function private.fabric_faction_set_forecast(uuid,text,boolean),
 public.fabric_faction_set_forecast(uuid,text,boolean) to authenticated;

create function private.fabric_faction_check_forecast_item()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.fabric_production_orders o
   where o.id=new.order_id and o.organization_id=new.organization_id
   and (o.idempotency_key like 'fabric-demand-%' or o.idempotency_key like 'buy-os-%'))
 and exists(select 1 from public.fabric_faction_forecast_preferences p
   where p.organization_id=new.organization_id and p.product_reference=btrim(new.source_item_key)
   and not p.include_in_forecast)
 then raise exception 'O produto % está fora da previsão automática. Atualize o planejamento ou lance uma OS manual.',new.product_name; end if;
 return new;
end;
$$;
revoke all on function private.fabric_faction_check_forecast_item() from public,anon,authenticated;
create trigger fabric_faction_check_forecast_item before insert on public.fabric_production_order_items
 for each row execute function private.fabric_faction_check_forecast_item();
