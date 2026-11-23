alter table public.linen_management_invoices
  alter column xml_document drop not null,
  add column danfe_pdf bytea,
  add constraint linen_invoice_document check (num_nonnulls(xml_document,danfe_pdf)=1);

create function private.linen_receive_danfe(p_org uuid,p_event uuid,p_action text,p_data jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  actor_name text;
  prior public.linen_management_audit;
  invoice_key text := p_data->>'key';
  supplier_name text := btrim(p_data->>'supplier');
  request_digest text := md5(p_data::text);
  document_pdf bytea;
  line jsonb;
  product uuid;
  quantity integer;
  item_number integer := 0;
  key_sum integer;
begin
  if actor is null
    or not coalesce(public.fabric_user_has_permission(p_org,'textiles.inventory.view'),false)
    or not coalesce(public.fabric_user_has_permission(p_org,'textiles.inventory.manage'),false)
  then raise exception 'Seu perfil não pode registrar esta operação.' using errcode='42501'; end if;
  if p_action is distinct from 'invoice' or p_event is null then raise exception 'Operação inválida.'; end if;
  if invoice_key is null or invoice_key !~ '^[0-9]{44}$' or substring(invoice_key,21,2)<>'55'
    or coalesce(length(supplier_name),0) not between 1 and 200
    or coalesce(length(p_data->>'pdf'),0) not between 8 and 6666668
    or jsonb_typeof(p_data->'lines') is distinct from 'array'
  then raise exception 'Confira a chave, o fornecedor, os itens e o PDF.'; end if;
  select sum(substring(invoice_key,position,1)::integer*(2+(43-position)%8))
    into key_sum from generate_series(1,43) as positions(position);
  if right(invoice_key,1)::integer<>(11-key_sum%11)%11%10
    or substring(invoice_key,26,9)::integer::text is distinct from p_data->>'number'
    or jsonb_array_length(p_data->'lines') not between 1 and 500
  then raise exception 'Chave ou itens da NF-e inválidos.'; end if;

  select coalesce(nullif(full_name,''),username) into strict actor_name
    from public.profiles where id=actor and active;
  perform pg_advisory_xact_lock(hashtextextended(p_org::text,154500));
  select * into prior from public.linen_management_audit where id=p_event;
  if found then
    if prior.organization_id=p_org and prior.created_by=actor and prior.action='invoice'
      and prior.details->>'request_digest'=request_digest
    then return prior.record_id; end if;
    raise exception 'A referência já pertence a outra operação.';
  end if;
  if exists(select 1 from public.linen_management_invoices where organization_id=p_org and access_key=invoice_key)
  then raise exception 'Esta NF-e já foi recebida no SGQ.'; end if;

  document_pdf := decode(p_data->>'pdf','base64');
  if octet_length(document_pdf)>5000000 or substring(document_pdf,1,5)<>decode('255044462d','hex')
  then raise exception 'Selecione um PDF válido de até 5 MB.'; end if;
  insert into public.linen_management_invoices(id,organization_id,access_key,invoice_number,supplier,danfe_pdf,created_by)
    values(p_event,p_org,invoice_key,p_data->>'number',supplier_name,document_pdf,actor);
  for line in select value from jsonb_array_elements(p_data->'lines') loop
    item_number := item_number+1;
    product := (line->>'product')::uuid;
    quantity := (line->>'quantity')::integer;
    if coalesce(quantity,0)<=0 or coalesce(length(btrim(line->>'description')),0) not between 1 and 250
      or coalesce(line->>'amount','') !~ '^[0-9]{1,12}(\.[0-9]{1,4})?$'
      or (line->>'amount')::numeric<=0
      or not exists(select 1 from public.laundry_products where id=product and active)
    then raise exception 'Confira a descrição, o produto ativo e as quantidades de cada item.'; end if;
    insert into public.linen_management_items(organization_id,product_id,invoice_id,invoice_line,quantity,status,created_by)
      values(p_org,product,p_event,item_number,quantity,'quarantine',actor);
  end loop;
  insert into public.linen_management_audit(id,organization_id,action,record_id,details,created_by,responsible)
    values(p_event,p_org,'invoice',p_event,(p_data-'pdf')||jsonb_build_object('source','pdf','request_digest',request_digest),actor,actor_name);
  return p_event;
end;
$$;

create function public.linen_receive_danfe(p_org uuid,p_event uuid,p_action text,p_data jsonb)
returns uuid language sql security invoker set search_path='' as $$
  select private.linen_receive_danfe(p_org,p_event,p_action,p_data);
$$;

revoke all on function private.linen_receive_danfe(uuid,uuid,text,jsonb),public.linen_receive_danfe(uuid,uuid,text,jsonb) from public,anon;
grant execute on function private.linen_receive_danfe(uuid,uuid,text,jsonb),public.linen_receive_danfe(uuid,uuid,text,jsonb) to authenticated;
