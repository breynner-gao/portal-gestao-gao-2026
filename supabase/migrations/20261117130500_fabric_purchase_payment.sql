alter table public.fabric_purchase_orders
  add column payment_terms text,
  add column payment_days integer[],
  add constraint fabric_purchase_order_payment_days_check check (
    payment_days is null or (
      array_ndims(payment_days) = 1 and cardinality(payment_days) > 0
      and array_position(payment_days, null) is null
      and 0 <= all(payment_days)
    )
  );

create function public.fabric_create_purchase_order_with_payment(
  p_organization_id uuid, p_supplier_id uuid, p_order_number text,
  p_ordered_date date, p_expected_date date, p_lines jsonb, p_notes text,
  p_idempotency_key text, p_payment_terms text, p_payment_days integer[]
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  result jsonb;
begin
  result := public.fabric_create_purchase_order(
    p_organization_id, p_supplier_id, p_order_number, p_ordered_date,
    p_expected_date, p_lines, p_notes, p_idempotency_key
  );
  if (result->>'created')::boolean then
    update public.fabric_purchase_orders
    set payment_terms=nullif(btrim(p_payment_terms),''), payment_days=p_payment_days
    where id=(result->>'purchase_order_id')::uuid and organization_id=p_organization_id;
  end if;
  return result;
end;
$$;

create function public.fabric_edit_purchase_order_with_payment(
  p_organization_id uuid, p_order_id uuid, p_version timestamptz, p_order_number text,
  p_ordered_date date, p_expected_date date, p_notes text, p_logistics_stage text,
  p_carrier text, p_tracking_code text, p_lines jsonb,
  p_payment_terms text, p_payment_days integer[]
)
returns uuid language plpgsql security invoker set search_path = '' as $$
begin
  perform public.fabric_edit_purchase_order(
    p_organization_id, p_order_id, p_version, p_order_number, p_ordered_date,
    p_expected_date, p_notes, p_logistics_stage, p_carrier, p_tracking_code, p_lines
  );
  update public.fabric_purchase_orders
  set payment_terms=nullif(btrim(p_payment_terms),''), payment_days=p_payment_days
  where id=p_order_id and organization_id=p_organization_id;
  return p_order_id;
end;
$$;

revoke all on function public.fabric_create_purchase_order_with_payment(uuid,uuid,text,date,date,jsonb,text,text,text,integer[]) from public,anon;
grant execute on function public.fabric_create_purchase_order_with_payment(uuid,uuid,text,date,date,jsonb,text,text,text,integer[]) to authenticated;
revoke all on function public.fabric_edit_purchase_order_with_payment(uuid,uuid,timestamptz,text,date,date,text,text,text,text,jsonb,text,integer[]) from public,anon;
grant execute on function public.fabric_edit_purchase_order_with_payment(uuid,uuid,timestamptz,text,date,date,text,text,text,text,jsonb,text,integer[]) to authenticated;
