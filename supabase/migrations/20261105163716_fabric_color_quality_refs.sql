-- Distinguish the supplier color reference and Q grade for the same fabric code.
alter table public.fabric_catalog
  add column if not exists color_reference text not null default '',
  add column if not exists quality_code text not null default '';

alter table public.fabric_catalog
  drop constraint if exists fabric_catalog_organization_id_code_key;

create unique index if not exists fabric_catalog_variant_unique
  on public.fabric_catalog (organization_id, code, color_reference, quality_code);
