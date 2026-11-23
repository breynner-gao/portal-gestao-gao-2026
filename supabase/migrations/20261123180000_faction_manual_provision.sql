create function private.fabric_faction_manual_item(p_org uuid,p_recipe uuid,p_pieces integer,p_request uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 recipe public.fabric_product_recipes;
 order_id uuid;
 item public.fabric_production_order_items;
 request_key text := 'manual:'||p_request::text;
 planned_price numeric;
begin
 if auth.uid() is null or not coalesce(public.fabric_user_has_permission(p_org,'textiles.production.manage'),false)
 then raise exception 'Sem permissão para lançar produtos na facção.' using errcode='42501'; end if;
 if p_pieces is null or p_pieces<1 or p_request is null
 then raise exception 'Informe uma quantidade inteira positiva.'; end if;

 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':'||request_key,0));
 select o.id into order_id from public.fabric_production_orders o
   where o.organization_id=p_org and o.idempotency_key=request_key;
 if found then return order_id; end if;

 select r.* into recipe from public.fabric_product_recipes r
 join public.fabric_catalog f on f.id=r.fabric_id and f.organization_id=r.organization_id
 where r.id=p_recipe and r.organization_id=p_org and r.active and f.active
 for share of r,f;
 if not found then raise exception 'Selecione uma ficha técnica ativa com tecido ativo.'; end if;

 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':'||recipe.product_reference,0));
 select coalesce(sum(l.quantity_received_m*l.effective_price_per_m)/nullif(sum(l.quantity_received_m),0),0)
   into planned_price from public.fabric_lots l where l.organization_id=p_org
   and public.fabric_same_standard(p_org,l.fabric_id,recipe.fabric_id);

 insert into public.fabric_production_orders(organization_id,demand_as_of,status,idempotency_key,created_by)
 values(p_org,(current_timestamp at time zone 'America/Sao_Paulo')::date,'ABERTA',request_key,auth.uid())
 returning id into order_id;

 insert into public.fabric_production_order_items(organization_id,order_id,source_item_key,product_reference,
   product_name,recipe_id,fabric_id,ordered_pieces,consumption_m_per_piece,planned_price_per_m,
   faction_cost_per_piece,extras_cost_per_piece,created_by)
 values(p_org,order_id,recipe.product_reference,recipe.product_reference,recipe.product_name,
   recipe.id,recipe.fabric_id,p_pieces,recipe.consumption_m_per_piece,planned_price,
   recipe.faction_cost_per_piece,recipe.extras_cost_per_piece,auth.uid()) returning * into item;

 insert into public.fabric_production_audit(organization_id,entity,record_id,after_data,changed_by)
 values(p_org,'fabric_production_order_items',item.id,to_jsonb(item),auth.uid());
 return order_id;
end;
$$;

create function private.fabric_faction_remove_item(p_org uuid,p_item uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
 item public.fabric_production_order_items;
 parent_id uuid;
begin
 if auth.uid() is null or not coalesce(public.fabric_user_has_permission(p_org,'textiles.production.manage'),false)
 then raise exception 'Sem permissão para excluir itens da facção.' using errcode='42501'; end if;

 select i.order_id into parent_id from public.fabric_production_order_items i where i.id=p_item and i.organization_id=p_org;
 if not found then raise exception 'Item indisponível para exclusão.'; end if;
 perform 1 from public.fabric_production_orders o where o.id=parent_id and o.organization_id=p_org
 and o.status in ('ABERTA','PARCIAL','ENVIADA') for update;
 if not found then raise exception 'A ordem já está encerrada.'; end if;
 select * into item from public.fabric_production_order_items where id=p_item and organization_id=p_org for update;
 if not found then raise exception 'Item indisponível para exclusão.'; end if;

 if exists(select 1 from public.fabric_cut_enfestos where organization_id=p_org and
   outputs @> jsonb_build_array(jsonb_build_object('source_type','os','source_id',p_item::text)))
 then raise exception 'Este item está vinculado a um enfesto e precisa permanecer no histórico.'; end if;

 begin
  delete from public.fabric_production_order_items where id=p_item and organization_id=p_org;
 exception when foreign_key_violation then
  raise exception 'Este item tem movimentação, lote, atribuição ou entrega e precisa permanecer no histórico.';
 end;
 insert into public.fabric_production_audit(organization_id,entity,record_id,before_data,changed_by)
 values(p_org,'fabric_production_order_items',item.id,to_jsonb(item),auth.uid());

 if not exists(select 1 from public.fabric_production_order_items i where i.order_id=parent_id and i.organization_id=p_org)
 then update public.fabric_production_orders set status='CANCELADA',updated_at=now() where id=parent_id and organization_id=p_org; end if;
end;
$$;

-- The enfesto stores its links in JSON. Lock new references like a foreign key would.
create function private.fabric_enfesto_lock_order_items()
returns trigger language plpgsql security definer set search_path='' as $$
declare source uuid;
begin
 for source in select distinct (entry->>'source_id')::uuid
  from jsonb_array_elements(new.outputs) entry where entry->>'source_type'='os' order by 1
 loop
  perform 1 from public.fabric_production_order_items i where i.id=source and i.organization_id=new.organization_id for key share;
  if not found then raise exception 'O item da OS foi removido. Atualize a lista de produtos.'; end if;
 end loop;
 return new;
end;
$$;
revoke all on function private.fabric_enfesto_lock_order_items() from public,anon,authenticated;
create trigger fabric_enfesto_lock_order_items
before insert or update of outputs on public.fabric_cut_enfestos
for each row execute function private.fabric_enfesto_lock_order_items();

create function public.fabric_faction_manual_item(p_org uuid,p_recipe uuid,p_pieces integer,p_request uuid)
returns uuid language sql security invoker set search_path='' as $$
 select private.fabric_faction_manual_item(p_org,p_recipe,p_pieces,p_request)
$$;

create function public.fabric_faction_remove_item(p_org uuid,p_item uuid)
returns void language sql security invoker set search_path='' as $$
 select private.fabric_faction_remove_item(p_org,p_item)
$$;

revoke all on function private.fabric_faction_manual_item(uuid,uuid,integer,uuid),
 private.fabric_faction_remove_item(uuid,uuid),public.fabric_faction_manual_item(uuid,uuid,integer,uuid),
 public.fabric_faction_remove_item(uuid,uuid) from public,anon;
grant execute on function private.fabric_faction_manual_item(uuid,uuid,integer,uuid),
 private.fabric_faction_remove_item(uuid,uuid),public.fabric_faction_manual_item(uuid,uuid,integer,uuid),
 public.fabric_faction_remove_item(uuid,uuid) to authenticated;
