alter table public.linen_management_items
  add column defect text check (defect in ('seam','tear','stain','wear','rfid','other','none')),
  add column archive_reason text,
  drop constraint linen_management_items_status_check,
  add constraint linen_management_items_status_check check (
    status in ('quarantine','rejected','approved','released','sewing','repairing','sewing_return',
      'discard_pending','discarded','inspection_pending','archived')
  );

create function private.linen_piece_review(p_org uuid,p_event uuid,p_action text,p_data jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  actor_name text;
  item public.linen_management_items;
  log_row public.linen_management_audit;
  action_name text;
  record_key uuid;
  product uuid;
  identifier text;
  problem text;
  chip_status text;
  destination text;
  explanation text;
  deadline integer;
  had_tag boolean;
  previous jsonb;
begin
  if actor is null or not (
    public.fabric_user_has_permission(p_org,'textiles.inventory.view') and
    public.fabric_user_has_permission(p_org,'textiles.inventory.manage')
  ) then raise exception 'Seu perfil não pode alterar a avaliação de peças.' using errcode='42501'; end if;
  select coalesce(nullif(full_name,''),username) into strict actor_name from public.profiles where id=actor and active;
  if p_event is null or jsonb_typeof(p_data) is distinct from 'object' or
    coalesce(p_action,'') not in ('inspect_piece','edit_piece','archive_piece')
  then raise exception 'Operação de avaliação inválida.'; end if;
  action_name := case when p_action='inspect_piece' then 'inspect_used' else p_action end;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text,154500));

  select * into log_row from public.linen_management_audit where id=p_event;
  if found then
    if log_row.organization_id=p_org and log_row.created_by=actor and log_row.action=action_name and log_row.details->'input'=p_data
    then return log_row.record_id; end if;
    raise exception 'A referência já pertence a outra operação.';
  end if;

  if p_action<>'inspect_piece' then
    select * into item from public.linen_management_items
      where organization_id=p_org and id=(p_data->>'item')::uuid and invoice_id is null and legacy_identifier is not null;
    if not found then raise exception 'Cadastro de peça usada não localizado.'; end if;
    if item.version is distinct from (p_data->>'version')::integer
    then raise exception 'O cadastro mudou. Atualize a tela.'; end if;
    if item.status not in ('inspection_pending','sewing','discard_pending') or item.released<>0 or item.repair is not null
    then raise exception 'O cadastro só pode ser alterado antes do processamento da peça.'; end if;
    previous := to_jsonb(item);
    record_key := item.id;
    select exists(select 1 from public.linen_management_tags where organization_id=p_org and item_id=item.id) into had_tag;
  end if;

  explanation := btrim(p_data->>'reason');
  if coalesce(length(explanation),0) not between 1 and 1500 then raise exception 'Informe o motivo ou a condição observada.'; end if;

  if p_action='archive_piece' then
    if had_tag then raise exception 'Peça com histórico de RFID deve seguir pelo fluxo de descarte, quando aplicável.'; end if;
    update public.linen_management_items set status='archived',archive_reason=explanation,
      due_at=null,version=version+1 where id=record_key;
  else
    product := (p_data->>'product')::uuid;
    identifier := upper(btrim(p_data->>'piece'));
    chip_status := p_data->>'chipCondition';
    problem := p_data->>'defect';
    destination := p_data->>'destination';
    if coalesce(length(identifier),0) not between 1 and 150 or
      coalesce(chip_status,'') not in ('working','missing','dead','unchecked') or
      coalesce(problem,'') not in ('seam','tear','stain','wear','rfid','other','none') or
      coalesce(destination,'') not in ('inspection_pending','sewing','discard_pending')
    then raise exception 'Preencha a identificação, o defeito, a condição do chip e o encaminhamento.'; end if;
    if not exists(select 1 from public.laundry_products where id=product and active)
      and not (p_action='edit_piece' and product is not distinct from item.product_id)
    then raise exception 'Selecione um produto ativo do SGQ.'; end if;
    if p_action='edit_piece' and exists(select 1 from public.linen_management_items where organization_id=p_org
      and legacy_identifier=identifier and id<>record_key)
    then raise exception 'Esta identificação já está vinculada a outra peça.'; end if;
    if had_tag and (identifier<>item.legacy_identifier or product<>item.product_id)
    then raise exception 'A identificação e o produto da peça já estão vinculados ao histórico RFID.'; end if;

    select sewing_hours into deadline from public.linen_management_settings where organization_id=p_org;
    if p_action='inspect_piece' then
      select * into item from public.linen_management_items where organization_id=p_org and legacy_identifier=identifier;
      if found then
        if item.status<>'released' or item.product_id<>product
        then raise exception 'A identificação já está cadastrada. Abra a avaliação existente para conferir o registro.'; end if;
        record_key := item.id;
        previous := to_jsonb(item);
      end if;
    end if;

    if record_key is null then
      insert into public.linen_management_items(organization_id,product_id,quantity,status,chip_condition,legacy_identifier,defect,condition,due_at,created_by)
      values(p_org,product,1,destination,chip_status,identifier,problem,explanation,
        case when destination='sewing' then now()+make_interval(hours=>deadline) end,actor)
      returning id into record_key;
    else
      update public.linen_management_items set product_id=product,legacy_identifier=identifier,status=destination,
        chip_condition=chip_status,defect=problem,condition=explanation,released=0,repair=null,
        due_at=case when destination='sewing' then
          case when item.status='sewing' then item.due_at else now()+make_interval(hours=>deadline) end
        end,version=version+1 where id=record_key;
    end if;
  end if;
  insert into public.linen_management_audit(id,organization_id,action,record_id,details,created_by,responsible)
  values(p_event,p_org,action_name,record_key,jsonb_build_object('before',previous,'input',p_data),actor,actor_name);
  return record_key;
end;
$$;

create function public.linen_piece_review(p_org uuid,p_event uuid,p_action text,p_data jsonb)
returns uuid language sql security invoker set search_path='' as $$
  select private.linen_piece_review(p_org,p_event,p_action,p_data);
$$;
revoke all on function private.linen_piece_review(uuid,uuid,text,jsonb),public.linen_piece_review(uuid,uuid,text,jsonb) from public,anon;
grant execute on function private.linen_piece_review(uuid,uuid,text,jsonb),public.linen_piece_review(uuid,uuid,text,jsonb) to authenticated;
