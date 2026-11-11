create policy waste_audit_history_import on storage.objects for insert to authenticated
with check (
  bucket_id = 'waste-audit'
  and name = 'historico/auditoria-2026-06-a-2026-11.html'
  and private.access_any_permission(array['chemicals.entries.manage'])
);
