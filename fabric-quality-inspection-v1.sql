-- Secure quality inspections and private report uploads for fabric lots.
CREATE TABLE IF NOT EXISTS public.fabric_lot_inspections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 lot_id uuid NOT NULL,
 inspection_status text NOT NULL CHECK (inspection_status IN ('APROVADO','REPROVADO')),
 checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
 report_path text NOT NULL,
 report_filename text NOT NULL,
 report_mime_type text,
 report_size_bytes bigint,
 notes text,
 inspected_at timestamptz NOT NULL DEFAULT now(),
 inspected_by uuid NOT NULL DEFAULT auth.uid(),
 CONSTRAINT fabric_lot_inspections_lot_org_fkey FOREIGN KEY (lot_id, organization_id) REFERENCES public.fabric_lots(id, organization_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS fabric_lots_id_org_uidx ON public.fabric_lots(id,organization_id);
CREATE INDEX IF NOT EXISTS fabric_lot_inspections_recent_idx ON public.fabric_lot_inspections(organization_id,lot_id,inspected_at DESC);
ALTER TABLE public.fabric_lot_inspections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fabric_lot_inspections_read ON public.fabric_lot_inspections;
CREATE POLICY fabric_lot_inspections_read ON public.fabric_lot_inspections FOR SELECT TO authenticated USING (
 public.fabric_user_has_permission(organization_id,'textiles.inventory.view') OR public.fabric_user_has_permission(organization_id,'quality.management.view') OR public.fabric_user_has_permission(organization_id,'quality.inspections.create') OR public.fabric_user_has_permission(organization_id,'textiles.inventory.manage'));
DROP POLICY IF EXISTS fabric_lot_inspections_write ON public.fabric_lot_inspections;
CREATE POLICY fabric_lot_inspections_write ON public.fabric_lot_inspections FOR ALL TO authenticated USING (
 public.fabric_user_has_permission(organization_id,'quality.inspections.create') OR public.fabric_user_has_permission(organization_id,'textiles.inventory.manage')) WITH CHECK (
 public.fabric_user_has_permission(organization_id,'quality.inspections.create') OR public.fabric_user_has_permission(organization_id,'textiles.inventory.manage'));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.fabric_lot_inspections TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('fabric-quality-reports','fabric-quality-reports',false,20971520,ARRAY['application/pdf','image/jpeg','image/png','image/webp']) ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS fabric_quality_reports_select ON storage.objects;
CREATE POLICY fabric_quality_reports_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id='fabric-quality-reports' AND (public.fabric_user_has_permission((storage.foldername(name))[1]::uuid,'textiles.inventory.view') OR public.fabric_user_has_permission((storage.foldername(name))[1]::uuid,'quality.management.view') OR public.fabric_user_has_permission((storage.foldername(name))[1]::uuid,'quality.inspections.create') OR public.fabric_user_has_permission((storage.foldername(name))[1]::uuid,'textiles.inventory.manage')));
DROP POLICY IF EXISTS fabric_quality_reports_insert ON storage.objects;
CREATE POLICY fabric_quality_reports_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='fabric-quality-reports' AND (public.fabric_user_has_permission((storage.foldername(name))[1]::uuid,'quality.inspections.create') OR public.fabric_user_has_permission((storage.foldername(name))[1]::uuid,'textiles.inventory.manage')));
DROP POLICY IF EXISTS fabric_quality_reports_update ON storage.objects;
CREATE POLICY fabric_quality_reports_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='fabric-quality-reports' AND (public.fabric_user_has_permission((storage.foldername(name))[1]::uuid,'quality.inspections.create') OR public.fabric_user_has_permission((storage.foldername(name))[1]::uuid,'textiles.inventory.manage'))) WITH CHECK (bucket_id='fabric-quality-reports');
DROP POLICY IF EXISTS fabric_quality_reports_delete ON storage.objects;
CREATE POLICY fabric_quality_reports_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='fabric-quality-reports' AND (public.fabric_user_has_permission((storage.foldername(name))[1]::uuid,'quality.inspections.create') OR public.fabric_user_has_permission((storage.foldername(name))[1]::uuid,'textiles.inventory.manage')));
ALTER TABLE public.fabric_lots ADD COLUMN IF NOT EXISTS inspected_at timestamptz, ADD COLUMN IF NOT EXISTS inspected_by uuid REFERENCES public.profiles(id), ADD COLUMN IF NOT EXISTS quality_report_path text;
CREATE OR REPLACE FUNCTION public.record_fabric_lot_inspection(p_organization_id uuid,p_lot_id uuid,p_status text,p_checklist jsonb,p_report_path text,p_report_filename text,p_report_mime_type text,p_report_size_bytes bigint,p_notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_inspection_id uuid;
BEGIN
 IF NOT (public.fabric_user_has_permission(p_organization_id,'quality.inspections.create') OR public.fabric_user_has_permission(p_organization_id,'textiles.inventory.manage')) THEN RAISE EXCEPTION 'Sem permissão para inspecionar lote de tecido.'; END IF;
 IF p_status NOT IN ('APROVADO','REPROVADO') OR nullif(trim(p_report_path),'') IS NULL OR nullif(trim(p_report_filename),'') IS NULL THEN RAISE EXCEPTION 'Decisão e relatório anexado são obrigatórios.'; END IF;
 IF p_status='APROVADO' AND EXISTS(SELECT 1 FROM jsonb_each(p_checklist) x WHERE x.value::text <> 'true') THEN RAISE EXCEPTION 'Para aprovar, todos os itens da inspeção devem estar conformes.'; END IF;
 UPDATE public.fabric_lots SET quality_status=p_status,inspected_at=now(),inspected_by=auth.uid(),quality_report_path=p_report_path WHERE id=p_lot_id AND organization_id=p_organization_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado nesta organização.'; END IF;
 INSERT INTO public.fabric_lot_inspections(organization_id,lot_id,inspection_status,checklist,report_path,report_filename,report_mime_type,report_size_bytes,notes,inspected_by) VALUES(p_organization_id,p_lot_id,p_status,coalesce(p_checklist,'{}'::jsonb),p_report_path,p_report_filename,p_report_mime_type,p_report_size_bytes,nullif(trim(p_notes),''),auth.uid()) RETURNING id INTO v_inspection_id;
 RETURN v_inspection_id;
END $$;
GRANT EXECUTE ON FUNCTION public.record_fabric_lot_inspection(uuid,uuid,text,jsonb,text,text,text,bigint,text) TO authenticated;
