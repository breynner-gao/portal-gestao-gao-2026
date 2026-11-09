alter table public.fabric_faction_tracking add column if not exists product_reference text;
comment on column public.fabric_faction_tracking.product_reference is 'Optional explicit RFID product identifier for matching production coverage without changing the original description.';
notify pgrst,'reload schema';
