-- Facção uses projections and submissions, without direct access to GAO tables.
create table public.fabric_faction_assignments (
  order_item_id uuid primary key,
  organization_id uuid not null,
  profile_id uuid not null references public.profiles(id),
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  foreign key (order_item_id, organization_id)
    references public.fabric_production_order_items(id, organization_id)
);
create index fabric_faction_assignment_profile_idx on public.fabric_faction_assignments(profile_id);

create table public.fabric_faction_submissions (
  id uuid primary key,
  order_item_id uuid not null references public.fabric_faction_assignments(order_item_id),
  author_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('RECEBIMENTO','PRODUCAO','INVENTARIO','AJUSTE')),
  details jsonb not null,
  status text not null default 'PENDENTE' check(status in ('PENDENTE','CONFERIDO','REJEITADO')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text
);
create index fabric_faction_submissions_order_idx on public.fabric_faction_submissions(order_item_id, created_at);
alter table public.fabric_faction_assignments enable row level security;
alter table public.fabric_faction_submissions enable row level security;
revoke all on public.fabric_faction_assignments, public.fabric_faction_submissions from public, anon, authenticated;

create function public.fabric_faction_assign(p_org uuid,p_item uuid,p_email text)
returns void language plpgsql security definer set search_path=''
as $$
declare target uuid;
begin
 if not coalesce(public.fabric_user_has_permission(p_org,'textiles.inventory.manage'),false) then
   raise exception 'Sem permissão para vincular a facção.' using errcode='42501';
 end if;
 if not exists(select 1 from public.fabric_production_order_items i where i.id=p_item and i.organization_id=p_org) then
   raise exception 'Item de ordem indisponível.';
 end if;
 select p.id into target from auth.users u join public.profiles p on p.id=u.id
 where lower(u.email)=lower(trim(p_email)) and p.active;
 if target is null then raise exception 'Use o e-mail de uma conta ativa do Portal.'; end if;
 insert into public.fabric_faction_assignments(order_item_id,organization_id,profile_id,assigned_by)
 values(p_item,p_org,target,auth.uid())
 on conflict(order_item_id) do update set profile_id=excluded.profile_id,assigned_by=excluded.assigned_by,assigned_at=now();
end;
$$;

create function public.fabric_faction_portal_orders()
returns jsonb language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',i.id,'ordem',o.order_number,'situacao',o.status,'produto',i.product_name,
   'codigo',i.product_reference,'tecido',f.name,'largura',f.width_m,'pecas',i.ordered_pieces,
   'remetido_m',(select coalesce(sum(m.quantity_m),0) from public.fabric_stock_movements m
     where m.organization_id=i.organization_id and m.order_item_id=i.id and m.movement_type='ENVIO_FACCAO'),
   'registros',(select coalesce(jsonb_agg(jsonb_build_object('tipo',s.kind,'situacao',s.status,
      'data',s.created_at,'dados',s.details,'parecer',s.review_note) order by s.created_at desc),'[]'::jsonb)
      from public.fabric_faction_submissions s where s.order_item_id=i.id and s.author_id=auth.uid())
 ) order by o.order_number desc),'[]'::jsonb)
 from public.fabric_faction_assignments a
 join public.profiles p on p.id=a.profile_id and p.active
 join public.fabric_production_order_items i on i.id=a.order_item_id and i.organization_id=a.organization_id
 join public.fabric_production_orders o on o.id=i.order_id and o.organization_id=i.organization_id
 join public.organizations org on org.id=i.organization_id and org.active
 join public.fabric_catalog f on f.id=i.fabric_id and f.organization_id=i.organization_id
 where a.profile_id=auth.uid();
$$;

create function public.fabric_faction_submit(
 p_item uuid,p_key uuid,p_kind text,p_good integer,p_scrap integer,
 p_received numeric,p_incorporated numeric,p_returned numeric,p_loss numeric,p_in_process numeric,p_note text
) returns uuid language plpgsql security definer set search_path=''
as $$
declare entry jsonb; existing public.fabric_faction_submissions%rowtype; requested integer; sent numeric; confirmed numeric;
begin
 select i.ordered_pieces into requested
 from public.fabric_faction_assignments a join public.profiles p on p.id=a.profile_id and p.active
 join public.fabric_production_order_items i on i.id=a.order_item_id and i.organization_id=a.organization_id
 join public.fabric_production_orders o on o.id=i.order_id and o.organization_id=i.organization_id
 join public.organizations org on org.id=i.organization_id and org.active
 where a.order_item_id=p_item and a.profile_id=auth.uid() and o.status not in ('CANCELADA','CONCLUIDA')
 for update of a,o;
 if not found then raise exception 'Ordem indisponível para esta conta.' using errcode='42501'; end if;

 if p_key is null or p_kind is null or p_kind not in ('RECEBIMENTO','PRODUCAO','INVENTARIO','AJUSTE')
   or length(coalesce(p_note,''))>2000 or least(p_good,p_scrap,p_received,p_incorporated,p_returned,p_loss,p_in_process)<0
   or greatest(p_received,p_incorporated,p_returned,p_loss,p_in_process)>100000000 then
   raise exception 'Dados do registro inválidos.';
 end if;
 if p_kind='PRODUCAO' and (
   p_good is null or p_scrap is null or p_good::bigint+p_scrap<1
   or p_received is null or p_received<=0 or p_incorporated is null or p_returned is null or p_loss is null or p_in_process is null
   or round(p_received,3)<>round(p_incorporated+p_returned+p_loss+p_in_process,3)
   or (p_loss>0 and nullif(trim(p_note),'') is null)
 ) then raise exception 'Concilie os metros do lote e justifique a perda medida.'; end if;
 if p_kind='RECEBIMENTO' and coalesce(p_received,0)<=0 then raise exception 'Informe os metros recebidos.'; end if;
 if p_kind='INVENTARIO' and p_received is null then raise exception 'Informe o saldo físico em metros.'; end if;
 if p_kind='AJUSTE' and nullif(trim(p_note),'') is null then raise exception 'Informe o motivo do ajuste.'; end if;

 entry:=case p_kind
   when 'PRODUCAO' then jsonb_build_object('boas',p_good,'refugo',p_scrap,'destinado_m',p_received,
     'incorporado_m',p_incorporated,'sobra_m',p_returned,'perda_m',p_loss,'em_processo_m',p_in_process,'nota',p_note)
   when 'RECEBIMENTO' then jsonb_build_object('metros',p_received,'nota',p_note)
   when 'INVENTARIO' then jsonb_build_object('metros',p_received,'nota',p_note)
   else jsonb_build_object('nota',p_note) end;
 select * into existing from public.fabric_faction_submissions where id=p_key;
 if found then
   if existing.order_item_id=p_item and existing.author_id=auth.uid() and existing.kind=p_kind and existing.details=entry then return p_key; end if;
   raise exception 'Identificador de registro já utilizado.';
 end if;
 if p_kind in ('RECEBIMENTO','PRODUCAO') then
   select coalesce(sum(m.quantity_m),0) into sent from public.fabric_stock_movements m
   where m.order_item_id=p_item and m.movement_type='ENVIO_FACCAO';
   select coalesce(sum((details->>'metros')::numeric),0) into confirmed from public.fabric_faction_submissions
   where order_item_id=p_item and kind='RECEBIMENTO' and status<>'REJEITADO';
   if p_kind='RECEBIMENTO' and confirmed+p_received>sent and nullif(trim(p_note),'') is null then
     raise exception 'Justifique o recebimento acima dos metros remetidos.';
   elsif p_kind='PRODUCAO' and (
     p_received+(select coalesce(sum((details->>'destinado_m')::numeric),0) from public.fabric_faction_submissions
       where order_item_id=p_item and kind='PRODUCAO' and status<>'REJEITADO')>confirmed
     or p_good+(select coalesce(sum((details->>'boas')::numeric),0) from public.fabric_faction_submissions
       where order_item_id=p_item and kind='PRODUCAO' and status<>'REJEITADO')>requested
   ) then raise exception 'O lote excede os metros recebidos ou a quantidade de peças da ordem.'; end if;
 end if;
 insert into public.fabric_faction_submissions(id,order_item_id,author_id,kind,details)
 values(p_key,p_item,auth.uid(),p_kind,entry);
 return p_key;
end;
$$;

create function public.fabric_faction_gao_review(p_org uuid,p_id uuid,p_accept boolean,p_note text)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if not coalesce(public.fabric_user_has_permission(p_org,'textiles.production.manage'),false) then
   raise exception 'Sem permissão para conferir registros.' using errcode='42501';
 end if;
 if p_accept is null or nullif(trim(p_note),'') is null or length(p_note)>2000 then raise exception 'Informe o parecer.'; end if;
 update public.fabric_faction_submissions s
 set status=case when p_accept then 'CONFERIDO' else 'REJEITADO' end,
 reviewed_by=auth.uid(), reviewed_at=now(), review_note=trim(p_note)
 from public.fabric_faction_assignments a
 where s.id=p_id and s.order_item_id=a.order_item_id and a.organization_id=p_org and s.status='PENDENTE';
 if not found then raise exception 'Registro já conferido ou indisponível.'; end if;
end;
$$;

create function public.fabric_faction_gao_queue(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if not (coalesce(public.fabric_user_has_permission(p_org,'textiles.production.manage'),false)
      or coalesce(public.fabric_user_has_permission(p_org,'textiles.inventory.manage'),false)) then
   raise exception 'Sem permissão para consultar registros da facção.' using errcode='42501';
 end if;
 return (select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) from (
  select s.id,s.kind,s.status,s.details,s.created_at,s.review_note,o.order_number,i.product_name
  from public.fabric_faction_submissions s join public.fabric_faction_assignments a on a.order_item_id=s.order_item_id
  join public.fabric_production_order_items i on i.id=a.order_item_id and i.organization_id=a.organization_id
  join public.fabric_production_orders o on o.id=i.order_id and o.organization_id=i.organization_id
  where a.organization_id=p_org order by s.created_at desc limit 200
 ) q);
end;
$$;

revoke all on function public.fabric_faction_assign(uuid,uuid,text),public.fabric_faction_portal_orders(),
 public.fabric_faction_submit(uuid,uuid,text,integer,integer,numeric,numeric,numeric,numeric,numeric,text),
 public.fabric_faction_gao_review(uuid,uuid,boolean,text),public.fabric_faction_gao_queue(uuid) from public,anon;
grant execute on function public.fabric_faction_assign(uuid,uuid,text),public.fabric_faction_portal_orders(),
 public.fabric_faction_submit(uuid,uuid,text,integer,integer,numeric,numeric,numeric,numeric,numeric,text),
 public.fabric_faction_gao_review(uuid,uuid,boolean,text),public.fabric_faction_gao_queue(uuid) to authenticated;
