-- Keep historical reporting periods unchanged. New entries use ISO weeks.
alter table public.chemical_weeks add column calendar_basis text not null default 'LEGACY';
alter table public.chemical_weeks alter column calendar_basis set default 'ISO';
alter table public.chemical_weeks add constraint chemical_weeks_calendar_basis_check check(calendar_basis in ('ISO','LEGACY'));
alter table public.chemical_weeks drop constraint chemical_weeks_sunday_check;
alter table public.chemical_weeks drop constraint chemical_weeks_saturday_check;
alter table public.chemical_weeks add constraint chemical_weeks_calendar_period_check check(
 (calendar_basis='LEGACY' and extract(isodow from sunday)=7 and extract(isodow from saturday)=6)
 or (calendar_basis='ISO' and extract(isodow from sunday)=1 and extract(isodow from saturday)=7 and extract(week from sunday)=week_number and extract(isoyear from sunday)=week_year)
);
alter table public.chemical_weeks drop constraint chemical_weeks_organization_id_week_year_week_number_key;
alter table public.chemical_weeks add constraint chemical_weeks_calendar_key unique(organization_id,week_year,week_number,calendar_basis);
comment on column public.chemical_weeks.sunday is 'Period start. Legacy field name retained for API compatibility; ISO periods start on Monday.';
comment on column public.chemical_weeks.saturday is 'Period end. Legacy field name retained for API compatibility; ISO periods end on Sunday.';
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('public.save_chemical_week(jsonb,text)'::regprocedure);
 if position('w.calendar_basis' in definition)>0 then return;end if;
 if position('w.week_number=(payload->>''weekNumber'')::integer;' in definition)=0 then raise exception 'Unexpected chemical save function: inspect before upgrading';end if;
 definition:=replace(definition,'w.week_number=(payload->>''weekNumber'')::integer;','w.week_number=(payload->>''weekNumber'')::integer and w.calendar_basis=coalesce(payload->>''calendarBasis'',''ISO'');');
 if position('saturday,responsible_profile_id,justification,source)' in definition)=0 then raise exception 'Unexpected insert columns';end if;
 definition:=replace(definition,'saturday,responsible_profile_id,justification,source)','saturday,responsible_profile_id,justification,source,calendar_basis)');
 if position('coalesce(nullif(payload->>''source'',''''),''portal'')) returning' in definition)=0 then raise exception 'Unexpected insert values';end if;
 definition:=replace(definition,'coalesce(nullif(payload->>''source'',''''),''portal'')) returning','coalesce(nullif(payload->>''source'',''''),''portal''),coalesce(payload->>''calendarBasis'',''ISO'')) returning');
 execute definition;
end $migration$;
notify pgrst,'reload schema';
