insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('waste-audit','waste-audit',false,40000000,
  array['text/html','application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

create policy waste_audit_documents_read on storage.objects for select to authenticated
using (
  bucket_id = 'waste-audit'
  and private.access_any_permission(array['chemicals.entries.view','chemicals.dashboard.view','chemicals.entries.manage'])
);

create policy waste_audit_collection_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'waste-audit'
  and (storage.foldername(name))[1] = 'coletas'
  and lower(storage.extension(name)) in ('pdf','png','jpg','jpeg','xlsx')
  and private.access_any_permission(array['chemicals.entries.manage'])
);
