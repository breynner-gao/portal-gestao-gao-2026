create table public.waste_audit_details (
  source text primary key check (source in ('triagem','forms','semand')),
  records jsonb not null check (jsonb_typeof(records)='array')
);

alter table public.waste_audit_details enable row level security;
revoke all on public.waste_audit_details from anon, authenticated;
grant select on public.waste_audit_details to authenticated;
grant select, insert, update on public.waste_audit_details to service_role;
create policy waste_audit_details_read on public.waste_audit_details for select to authenticated
using (private.access_any_permission(array['chemicals.entries.view','chemicals.dashboard.view','chemicals.entries.manage']));
