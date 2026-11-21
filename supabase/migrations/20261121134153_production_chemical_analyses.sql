-- Production laboratory: organization/unit scope, immutable criteria, saved assessments.
insert into public.permission_catalog(code,module,resource,action,label) values
 ('production.analyses.view','production','analyses','view','Consultar análises e relatórios'),
 ('production.analyses.execute','production','analyses','execute','Lançar e editar as próprias análises'),
 ('production.analyses.manage','production','analyses','manage','Editar e arquivar análises da equipe'),
 ('production.analyses.parameters','production','analyses','parameters','Publicar parâmetros de referência'),
 ('production.analyses.review','production','analyses','review','Registrar revisão técnica') on conflict do nothing;
insert into public.access_role_permissions(role_id,permission_code)
 select r.id,c.code from public.access_roles r cross join public.permission_catalog c
 where c.code like 'production.analyses.%' and (r.protected or
 (c.code in ('production.analyses.view','production.analyses.execute') and exists(select 1 from public.access_role_permissions p where p.role_id=r.id and p.permission_code='chemicals.entries.manage')) or
 (c.code='production.analyses.view' and exists(select 1 from public.access_role_permissions p where p.role_id=r.id and p.permission_code='quality.management.view')))
 on conflict do nothing;
insert into public.member_permissions(membership_id,permission_code,allowed)
 select m.id,p.permission_code,true from public.memberships m join public.access_role_permissions p on p.role_id=m.access_role_id
 where p.permission_code like 'production.analyses.%' on conflict do nothing;

create function private.chemical_analysis_allowed(p_org uuid,p_unit uuid,p_codes text[]) returns boolean
 language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
 select 1 from public.memberships m join public.profiles p on p.id=m.profile_id join public.organizations o on o.id=m.organization_id
 where m.profile_id=auth.uid() and m.organization_id=p_org and m.active and p.active and o.active and o.kind='gao'
 and (m.all_units or m.unit_id=p_unit or exists(select 1 from public.membership_units u where u.membership_id=m.id and u.unit_id=p_unit))
 and (m.role_name='Administrador Geral' or exists(select 1 from public.member_permissions mp where mp.membership_id=m.id and mp.allowed and mp.permission_code=any(p_codes))));
$$;
revoke all on function private.chemical_analysis_allowed(uuid,uuid,text[]) from public,anon;
grant execute on function private.chemical_analysis_allowed(uuid,uuid,text[]) to authenticated;

create table public.chemical_analysis_criteria(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations,
 unit_id uuid not null references public.units, analysis_type text not null check(analysis_type in ('Água','Banho de lavagem','Enxágue final')),
 source text not null default '', point text not null default '', stage text not null default '',
 valid_from date not null, reference text not null check(length(trim(reference))>0), method text not null check(length(trim(method))>0),
 approver text not null check(length(trim(approver))>0), limits jsonb not null check(jsonb_typeof(limits)='object' and limits<>'{}'),
 created_by uuid not null default auth.uid() references public.profiles, created_at timestamptz not null default now()
);
create index chemical_analysis_criteria_scope_idx on public.chemical_analysis_criteria(organization_id,unit_id,analysis_type,valid_from desc);
create table public.chemical_analysis_samples(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,
 unit_id uuid not null references public.units,payload jsonb not null check(jsonb_typeof(payload)='object'),
 assessment text not null default 'Aguardando parâmetros',criteria_id uuid references public.chemical_analysis_criteria,
 criteria_snapshot jsonb, is_reference boolean not null default false,
 revision integer not null default 1,last_request_id uuid,
 created_by uuid default auth.uid() references public.profiles,updated_by uuid default auth.uid() references public.profiles,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz,
 review jsonb,reviewed_by uuid references public.profiles,reviewed_at timestamptz
);
create index chemical_analysis_samples_scope_idx on public.chemical_analysis_samples(organization_id,unit_id,created_at desc);
create table public.chemical_analysis_evidence(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations,
 unit_id uuid not null references public.units,sample_id uuid references public.chemical_analysis_samples,
 name text not null,parameter text,storage_path text unique,inline_data text,
 created_by uuid default auth.uid() references public.profiles,created_at timestamptz not null default now(),
 check ((storage_path is not null)::integer+(inline_data is not null)::integer=1),
 check(inline_data is null or (inline_data like 'data:image/jpeg;base64,%' and length(inline_data)<1500000))
);
create index chemical_analysis_evidence_sample_idx on public.chemical_analysis_evidence(sample_id);
create table public.chemical_analysis_audit(
 id bigint generated always as identity primary key,organization_id uuid not null,unit_id uuid not null,
 sample_id uuid not null references public.chemical_analysis_samples,actor_id uuid default auth.uid(),
 changed_at timestamptz not null default now(),before_data jsonb,after_data jsonb
);
create index chemical_analysis_audit_sample_idx on public.chemical_analysis_audit(sample_id,changed_at desc);

alter table public.chemical_analysis_samples enable row level security;
alter table public.chemical_analysis_criteria enable row level security;
alter table public.chemical_analysis_evidence enable row level security;
alter table public.chemical_analysis_audit enable row level security;
revoke all on public.chemical_analysis_samples,public.chemical_analysis_criteria,public.chemical_analysis_evidence,public.chemical_analysis_audit from anon,authenticated;
grant select,insert,update on public.chemical_analysis_samples to authenticated;
grant select,insert on public.chemical_analysis_criteria,public.chemical_analysis_evidence to authenticated;
grant select on public.chemical_analysis_audit to authenticated;
grant all on public.chemical_analysis_samples,public.chemical_analysis_criteria,public.chemical_analysis_evidence,public.chemical_analysis_audit to service_role;
create policy analysis_samples_read on public.chemical_analysis_samples for select to authenticated using(private.chemical_analysis_allowed(organization_id,unit_id,array['production.analyses.view','production.analyses.execute','production.analyses.manage','production.analyses.parameters','production.analyses.review']));
create policy analysis_samples_insert on public.chemical_analysis_samples for insert to authenticated with check(created_by=auth.uid() and private.chemical_analysis_allowed(organization_id,unit_id,array['production.analyses.execute','production.analyses.manage']));
create policy analysis_samples_update on public.chemical_analysis_samples for update to authenticated
 using(private.chemical_analysis_allowed(organization_id,unit_id,array['production.analyses.manage','production.analyses.review']) or (created_by=auth.uid() and private.chemical_analysis_allowed(organization_id,unit_id,array['production.analyses.execute'])))
 with check(private.chemical_analysis_allowed(organization_id,unit_id,array['production.analyses.manage','production.analyses.review']) or (created_by=auth.uid() and private.chemical_analysis_allowed(organization_id,unit_id,array['production.analyses.execute'])));
create policy analysis_criteria_read on public.chemical_analysis_criteria for select to authenticated using(private.chemical_analysis_allowed(organization_id,unit_id,array['production.analyses.view','production.analyses.execute','production.analyses.manage','production.analyses.parameters','production.analyses.review']));
create policy analysis_criteria_insert on public.chemical_analysis_criteria for insert to authenticated with check(created_by=auth.uid() and private.chemical_analysis_allowed(organization_id,unit_id,array['production.analyses.parameters']));
create policy analysis_evidence_read on public.chemical_analysis_evidence for select to authenticated using(private.chemical_analysis_allowed(organization_id,unit_id,array['production.analyses.view','production.analyses.execute','production.analyses.manage','production.analyses.parameters','production.analyses.review']));
create policy analysis_evidence_insert on public.chemical_analysis_evidence for insert to authenticated with check(
 created_by=auth.uid() and exists(select 1 from public.chemical_analysis_samples s where s.id=sample_id and s.organization_id=chemical_analysis_evidence.organization_id and s.unit_id=chemical_analysis_evidence.unit_id
 and (private.chemical_analysis_allowed(s.organization_id,s.unit_id,array['production.analyses.manage']) or (s.created_by=auth.uid() and private.chemical_analysis_allowed(s.organization_id,s.unit_id,array['production.analyses.execute']))))
 and inline_data is null and storage_path like organization_id::text||'/'||sample_id::text||'/%');
create policy analysis_audit_read on public.chemical_analysis_audit for select to authenticated using(private.chemical_analysis_allowed(organization_id,unit_id,array['production.analyses.view','production.analyses.execute','production.analyses.manage','production.analyses.review']));

create function private.chemical_analysis_criteria_guard() returns trigger language plpgsql set search_path='' as $$
declare k text; v jsonb;
begin
 if not exists(select 1 from public.units u where u.id=new.unit_id and u.organization_id=new.organization_id) then raise exception 'Unidade de outra organização';end if;
 for k,v in select * from jsonb_each(new.limits) loop
  if k not in ('ph','temp','tds','ec','alk','hard','chlorine','peroxide','turb','salt') or jsonb_typeof(v)<>'object' then raise exception 'Parâmetro inválido';end if;
  if (v->>'min' is not null and (v->>'min') !~ '^[+-]?[0-9]+([.][0-9]+)?$') or (v->>'max' is not null and (v->>'max') !~ '^[+-]?[0-9]+([.][0-9]+)?$') then raise exception 'Limite inválido';end if;
  if v->>'min' is null and v->>'max' is null then raise exception 'Informe pelo menos um limite';end if;
  if (v->>'min')::numeric>(v->>'max')::numeric then raise exception 'Mínimo maior que máximo';end if;
  if not(v ? 'unit') or jsonb_typeof(v->'unit')<>'string' then raise exception 'Informe a unidade do parâmetro';end if;
 end loop;
 new.created_by=auth.uid(); new.created_at=clock_timestamp();return new;
end;$$;
revoke all on function private.chemical_analysis_criteria_guard() from public,anon,authenticated;
create trigger chemical_analysis_criteria_guard before insert on public.chemical_analysis_criteria for each row execute function private.chemical_analysis_criteria_guard();


-- Reference supplied by the user. Unknown collection date stays blank; excluded from charts.
insert into public.chemical_analysis_samples(id,organization_id,unit_id,payload,is_reference) select '4e139eaa-7808-456a-b271-93fa47683701',o.id,u.id,'{"type": "Água", "source": "Reúso", "date": "", "time": "", "analyst": "", "point": "", "purpose": "Avaliação de água de reúso", "instrument": "TDS/EC/pH/SALINITY · identificação a informar", "method": "", "calibration": "", "aspect": "Água com coloração clara", "odor": "Sem odor perceptível", "notes": "Resumo e fotos fornecidos por Breynner. Data e ponto de coleta a informar. Alcalinidade: método e base a confirmar.", "values": {"ph": 8.96, "temp": 36.3, "tds": 408, "ec": 735, "alk": 50}, "temperatures": {"ph": 36.3, "tds": 37.7, "ec": 37.3}, "units": {"ph": "", "temp": "°C", "tds": "ppm", "ec": "µS/cm", "alk": "ppm"}}'::jsonb,true from public.organizations o join public.units u on u.organization_id=o.id where o.kind='gao' and u.name='GAO LAVANDERIA';

create function private.chemical_analysis_sample_guard() returns trigger language plpgsql set search_path='' as $$
declare k text; v jsonb; lim jsonb; ref public.chemical_analysis_criteria; assessed int=0; missing int=0; outside boolean=false; payload_changed boolean;
begin
 if not exists(select 1 from public.units u where u.id=new.unit_id and u.organization_id=new.organization_id) then raise exception 'Unidade de outra organização';end if;
 if tg_op='UPDATE' then
  if new.organization_id<>old.organization_id or new.unit_id<>old.unit_id or new.created_by is distinct from old.created_by or new.created_at<>old.created_at then raise exception 'A origem da amostra não pode ser alterada';end if;
  if new.revision<>old.revision then raise exception 'A revisão é controlada pelo sistema';end if;
  if new.archived_at is distinct from old.archived_at and not private.chemical_analysis_allowed(old.organization_id,old.unit_id,array['production.analyses.manage']) then raise exception 'Sem permissão para arquivar';end if;
  payload_changed=new.payload is distinct from old.payload;
  if payload_changed and not (private.chemical_analysis_allowed(old.organization_id,old.unit_id,array['production.analyses.manage']) or old.created_by=auth.uid() and private.chemical_analysis_allowed(old.organization_id,old.unit_id,array['production.analyses.execute'])) then raise exception 'Sem permissão para editar a amostra';end if;
  if new.review is distinct from old.review then
   if not private.chemical_analysis_allowed(old.organization_id,old.unit_id,array['production.analyses.review']) then raise exception 'Sem permissão para revisão técnica';end if;
   if new.review is null or new.review->>'conclusion' is null or new.review->>'conclusion' not in ('Liberado','Em avaliação','Reprovado') or nullif(trim(new.review->>'notes'),'') is null then raise exception 'Informe conclusão e parecer técnico';end if;
   new.reviewed_by=auth.uid();new.reviewed_at=clock_timestamp();
  else new.reviewed_by=old.reviewed_by;new.reviewed_at=old.reviewed_at;end if;
  if payload_changed then new.review=null;new.reviewed_by=null;new.reviewed_at=null;end if;
  new.revision=old.revision+1;
 else
  payload_changed=true;new.revision=1;new.created_by=auth.uid();new.created_at=clock_timestamp();new.archived_at=null;new.is_reference=false;new.review=null;new.reviewed_by=null;new.reviewed_at=null;
 end if;
 new.updated_by=auth.uid();new.updated_at=clock_timestamp();
 if payload_changed then
  if new.payload->>'type' is null or new.payload->>'type' not in ('Água','Banho de lavagem','Enxágue final') then raise exception 'Tipo inválido';end if;
  if nullif(trim(new.payload->>'date'),'') is null or nullif(trim(new.payload->>'analyst'),'') is null or nullif(trim(new.payload->>'point'),'') is null then raise exception 'Data, responsável e ponto são obrigatórios';end if;
  perform (new.payload->>'date')::date;
  if new.payload->>'type'<>'Água' and (nullif(trim(new.payload->>'machine'),'') is null or nullif(trim(new.payload->>'stage'),'') is null) then raise exception 'Informe máquina e etapa';end if;
  if jsonb_typeof(new.payload->'values') is distinct from 'object' or new.payload->'values'='{}' then raise exception 'Informe os resultados';end if;
  for k,v in select * from jsonb_each(new.payload->'values') loop
   if k not in ('ph','temp','tds','ec','alk','hard','chlorine','peroxide','turb','salt') or jsonb_typeof(v)<>'number' then raise exception 'Resultado inválido';end if;
   if k<>'temp' and (v::text)::numeric<0 then raise exception 'Resultado negativo';end if;
  end loop;
  for k,v in select * from jsonb_each(coalesce(new.payload->'temperatures','{}')) loop
   if jsonb_typeof(v)<>'number' then raise exception 'Temperatura inválida';end if;
  end loop;
  for k in select pg_catalog.unnest(array['load','duration']) loop
   if nullif(new.payload->>k,'') is not null and (new.payload->>k)::numeric<0 then raise exception 'Carga ou duração negativa';end if;
  end loop;
  new.is_reference=false;
  select * into ref from public.chemical_analysis_criteria c where c.organization_id=new.organization_id and c.unit_id=new.unit_id and c.analysis_type=new.payload->>'type'
   and c.valid_from<=(new.payload->>'date')::date and (c.source='' or c.source=new.payload->>'source') and(c.point='' or c.point=new.payload->>'point') and(c.stage='' or c.stage=new.payload->>'stage')
   and c.method=coalesce(new.payload->>'method','')
   order by ((c.source<>'')::int+(c.point<>'')::int+(c.stage<>'')::int) desc,c.valid_from desc,c.created_at desc,c.id limit 1;
  new.criteria_id=ref.id;new.criteria_snapshot=case when ref.id is null then null else to_jsonb(ref) end;
  if ref.id is null then new.assessment='Aguardando parâmetros';else
   for k,v in select * from jsonb_each(new.payload->'values') loop
    lim=ref.limits->k;
    if lim is null or lim->>'unit' is distinct from new.payload->'units'->>k then missing=missing+1;continue;end if;
    assessed=assessed+1;
    if (lim->>'min' is not null and (v::text)::numeric<(lim->>'min')::numeric) or(lim->>'max' is not null and(v::text)::numeric>(lim->>'max')::numeric) then outside=true;end if;
   end loop;
   new.assessment=case when outside then 'Fora das faixas cadastradas' when assessed=0 then 'Aguardando parâmetros' when missing>0 then 'Avaliação parcial' else 'Dentro das faixas cadastradas' end;
  end if;
 else new.criteria_id=old.criteria_id;new.criteria_snapshot=old.criteria_snapshot;new.assessment=old.assessment;new.is_reference=old.is_reference;end if;
 return new;
end;$$;
revoke all on function private.chemical_analysis_sample_guard() from public,anon,authenticated;
create trigger chemical_analysis_sample_guard before insert or update on public.chemical_analysis_samples for each row execute function private.chemical_analysis_sample_guard();

create function private.chemical_analysis_log() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.chemical_analysis_audit(organization_id,unit_id,sample_id,actor_id,before_data,after_data) values(new.organization_id,new.unit_id,new.id,auth.uid(),case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));return new;
end;$$;
revoke all on function private.chemical_analysis_log() from public,anon,authenticated;
create trigger chemical_analysis_log after insert or update on public.chemical_analysis_samples for each row execute function private.chemical_analysis_log();

create function public.chemical_analysis_save(p_id uuid,p_org uuid,p_unit uuid,p_payload jsonb,p_expected_revision int,p_request uuid) returns public.chemical_analysis_samples
 language plpgsql security invoker set search_path='' as $$
declare row public.chemical_analysis_samples;
begin
 -- Stable UUID + request UUID make a failed network response safe to resend.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into row from public.chemical_analysis_samples where id=p_id for update;
 if found then
  if row.organization_id<>p_org or row.unit_id<>p_unit then raise exception 'Origem inválida';end if;
  if row.last_request_id=p_request then return row;end if;
  if row.revision<>p_expected_revision then raise exception 'A análise foi alterada por outra pessoa. Reabra o registro antes de salvar.';end if;
  update public.chemical_analysis_samples set payload=p_payload,last_request_id=p_request where id=p_id returning * into row;
 else
  if p_expected_revision<>0 then raise exception 'Amostra não encontrada';end if;
  insert into public.chemical_analysis_samples(id,organization_id,unit_id,payload,last_request_id) values(p_id,p_org,p_unit,p_payload,p_request) returning * into row;
 end if;return row;
end;$$;
revoke all on function public.chemical_analysis_save(uuid,uuid,uuid,jsonb,int,uuid) from public,anon;
grant execute on function public.chemical_analysis_save(uuid,uuid,uuid,jsonb,int,uuid) to authenticated;

create function public.chemical_analysis_action(p_id uuid,p_expected_revision int,p_action text,p_data jsonb default '{}') returns public.chemical_analysis_samples
 language plpgsql security invoker set search_path='' as $$
declare row public.chemical_analysis_samples;
begin
 select * into row from public.chemical_analysis_samples where id=p_id for update;
 if not found then raise exception 'Amostra não encontrada';end if;
 if row.revision<>p_expected_revision then raise exception 'Registro atualizado por outra pessoa. Reabra a análise.';end if;
 if p_action='archive' then update public.chemical_analysis_samples set archived_at=now() where id=p_id returning * into row;
 elsif p_action='restore' then update public.chemical_analysis_samples set archived_at=null where id=p_id returning * into row;
 elsif p_action='review' then update public.chemical_analysis_samples set review=p_data where id=p_id returning * into row;
 else raise exception 'Ação inválida';end if;return row;
end;$$;
revoke all on function public.chemical_analysis_action(uuid,int,text,jsonb) from public,anon;
grant execute on function public.chemical_analysis_action(uuid,int,text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('chemical-analysis-evidence','chemical-analysis-evidence',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict do nothing;
create policy chemical_analysis_storage_read on storage.objects for select to authenticated using(bucket_id='chemical-analysis-evidence' and exists(select 1 from public.chemical_analysis_samples s where s.organization_id::text=split_part(name,'/',1) and s.id::text=split_part(name,'/',2)));
create policy chemical_analysis_storage_insert on storage.objects for insert to authenticated with check(bucket_id='chemical-analysis-evidence' and exists(select 1 from public.chemical_analysis_samples s where s.organization_id::text=split_part(name,'/',1) and s.id::text=split_part(name,'/',2)
 and (private.chemical_analysis_allowed(s.organization_id,s.unit_id,array['production.analyses.manage']) or s.created_by=auth.uid() and private.chemical_analysis_allowed(s.organization_id,s.unit_id,array['production.analyses.execute']))));
notify pgrst,'reload schema';
