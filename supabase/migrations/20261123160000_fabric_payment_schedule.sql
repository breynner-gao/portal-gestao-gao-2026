create table public.fabric_payment_schedule (
 organization_id uuid not null references public.organizations(id),
 source_key text not null check (length(source_key) between 1 and 240),
 invoice_date date,
 payment_days integer[] check (
   array_ndims(payment_days) = 1 and cardinality(payment_days) between 1 and 24
   and array_position(payment_days, null) is null and 0 <= all(payment_days) and 3650 >= all(payment_days)
 ),
 updated_at timestamptz not null default now(),
 primary key (organization_id,source_key)
);
alter table public.fabric_payment_schedule enable row level security;
revoke all on public.fabric_payment_schedule from public,anon,authenticated;
grant select,insert,update on public.fabric_payment_schedule to authenticated;
create policy fabric_payment_schedule_read on public.fabric_payment_schedule for select to authenticated
 using (public.fabric_user_has_permission(organization_id,'textiles.inventory.view') or public.fabric_user_has_permission(organization_id,'textiles.inventory.manage'));
create policy fabric_payment_schedule_insert on public.fabric_payment_schedule for insert to authenticated
 with check (public.fabric_user_has_permission(organization_id,'textiles.inventory.manage'));
create policy fabric_payment_schedule_update on public.fabric_payment_schedule for update to authenticated
 using (public.fabric_user_has_permission(organization_id,'textiles.inventory.manage'))
 with check (public.fabric_user_has_permission(organization_id,'textiles.inventory.manage'));
