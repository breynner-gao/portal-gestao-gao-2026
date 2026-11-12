create table public.waste_audit_history (
  id text primary key,
  records jsonb not null,
  indcom_audit jsonb not null,
  billing_titles jsonb not null,
  documents jsonb not null
);

alter table public.waste_audit_history enable row level security;
revoke all on public.waste_audit_history from anon, authenticated;
grant select on public.waste_audit_history to authenticated;
grant select, insert, update on public.waste_audit_history to service_role;
create policy waste_audit_history_read on public.waste_audit_history for select to authenticated
using (private.access_any_permission(array['chemicals.entries.view','chemicals.dashboard.view','chemicals.entries.manage']));

update storage.buckets set allowed_mime_types=array_append(allowed_mime_types,'application/octet-stream')
where id='waste-audit' and not ('application/octet-stream'=any(allowed_mime_types));
