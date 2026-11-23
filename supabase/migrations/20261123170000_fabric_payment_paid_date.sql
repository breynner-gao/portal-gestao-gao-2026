alter table public.fabric_payment_schedule
 add column paid_date date;

alter table public.fabric_payment_schedule
 add constraint fabric_payment_paid_invoice_only
 check (paid_date is null or source_key like 'invoice:%');

comment on column public.fabric_payment_schedule.paid_date is
 'Data de quitação integral da NF. A chave da NF reúne todos os lotes do mesmo fornecedor e documento.';
