-- Homologated fabric catalogue and supplier/NF code crosswalk.
-- Idempotent migration; applied to Supabase project fquzuxdqvhecijjuxbmg.

ALTER TABLE public.fabric_catalog
  ADD COLUMN IF NOT EXISTS homologated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS homologated_at timestamptz,
  ADD COLUMN IF NOT EXISTS homologated_by uuid REFERENCES public.profiles(id);

CREATE UNIQUE INDEX IF NOT EXISTS fabric_catalog_id_org_uidx
  ON public.fabric_catalog (id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS fabric_suppliers_id_org_uidx
  ON public.fabric_suppliers (id, organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS fabric_catalog_active_variant_uidx
  ON public.fabric_catalog (organization_id, upper(btrim(code)), upper(btrim(color_reference)), upper(btrim(quality_code)))
  WHERE active;

CREATE TABLE IF NOT EXISTS public.fabric_catalog_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  fabric_id uuid NOT NULL,
  supplier_id uuid,
  supplier_item_code text NOT NULL DEFAULT '',
  supplier_item_description text NOT NULL DEFAULT '',
  invoice_color_reference text NOT NULL DEFAULT '',
  invoice_quality_code text NOT NULL DEFAULT '',
  source_invoice_number text,
  homologated boolean NOT NULL DEFAULT false,
  homologated_at timestamptz,
  homologated_by uuid REFERENCES public.profiles(id),
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  updated_by uuid REFERENCES public.profiles(id),
  CONSTRAINT fabric_catalog_alias_has_source CHECK (
    nullif(btrim(supplier_item_code), '') IS NOT NULL
    OR nullif(btrim(supplier_item_description), '') IS NOT NULL
  ),
  CONSTRAINT fabric_catalog_alias_fabric_org_fkey
    FOREIGN KEY (fabric_id, organization_id)
    REFERENCES public.fabric_catalog(id, organization_id),
  CONSTRAINT fabric_catalog_alias_supplier_org_fkey
    FOREIGN KEY (supplier_id, organization_id)
    REFERENCES public.fabric_suppliers(id, organization_id)
);

ALTER TABLE public.fabric_catalog_aliases
  ADD COLUMN IF NOT EXISTS homologated_at timestamptz,
  ADD COLUMN IF NOT EXISTS homologated_by uuid REFERENCES public.profiles(id);

CREATE UNIQUE INDEX IF NOT EXISTS fabric_catalog_alias_signature_uidx
  ON public.fabric_catalog_aliases (
    organization_id,
    coalesce(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid),
    upper(btrim(supplier_item_code)),
    upper(btrim(supplier_item_description)),
    upper(btrim(invoice_color_reference)),
    upper(btrim(invoice_quality_code))
  );

ALTER TABLE public.fabric_catalog_aliases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fabric_catalog_aliases_read ON public.fabric_catalog_aliases;
CREATE POLICY fabric_catalog_aliases_read ON public.fabric_catalog_aliases
  FOR SELECT TO authenticated
  USING (public.fabric_user_has_permission(organization_id, 'textiles.inventory.view'));
DROP POLICY IF EXISTS fabric_catalog_aliases_manage ON public.fabric_catalog_aliases;
CREATE POLICY fabric_catalog_aliases_manage ON public.fabric_catalog_aliases
  FOR ALL TO authenticated
  USING (public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage'))
  WITH CHECK (public.fabric_user_has_permission(organization_id, 'textiles.inventory.manage'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabric_catalog_aliases TO authenticated;

COMMENT ON COLUMN public.fabric_catalog.homologated IS 'Referência e cor conferidas e homologadas pela GAO.';
COMMENT ON TABLE public.fabric_catalog_aliases IS 'Mapeia códigos e descrições de fornecedores/NFs para a variante homologada do catálogo GAO.';

-- Mark as homologated only the color references already checked with the catalogs.
UPDATE public.fabric_catalog
SET homologated = true, homologated_at = coalesce(homologated_at, now())
WHERE active AND (
  (code = 'AN048966464' AND color_reference IN ('616','P53','V02') AND quality_code IN ('1','2'))
  OR (code = 'AN048914155671R22' AND color_reference = '616' AND quality_code = '2')
  OR (code = '000000001001296024' AND color_reference = '4617' AND color ILIKE '%19-5920%')
  OR (code = '000000001000801699' AND color_reference = '3156' AND color ILIKE '%12-0727%')
  OR (code = '000000001000801705' AND color_reference = '1169' AND color ILIKE '%18-1616%')
);
