-- Ensure inspection reports belong to the same organization and lot being evaluated.
CREATE OR REPLACE FUNCTION public.record_fabric_lot_inspection(p_organization_id uuid,p_lot_id uuid,p_status text,p_checklist jsonb,p_report_path text,p_report_filename text,p_report_mime_type text,p_report_size_bytes bigint,p_notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_inspection_id uuid;
BEGIN
 IF NOT (public.fabric_user_has_permission(p_organization_id,'quality.inspections.create') OR public.fabric_user_has_permission(p_organization_id,'textiles.inventory.manage')) THEN RAISE EXCEPTION 'Sem permissão para inspecionar lote de tecido.'; END IF;
 IF p_status NOT IN ('APROVADO','REPROVADO') OR nullif(trim(p_report_path),'') IS NULL OR nullif(trim(p_report_filename),'') IS NULL THEN RAISE EXCEPTION 'Decisão e relatório anexado são obrigatórios.'; END IF;
 IF p_report_path NOT LIKE p_organization_id::text||'/'||p_lot_id::text||'/%' THEN RAISE EXCEPTION 'O relatório precisa estar associado à organização e ao lote avaliados.'; END IF;
 IF p_status='APROVADO' AND EXISTS(SELECT 1 FROM jsonb_each(p_checklist) x WHERE x.value::text <> 'true') THEN RAISE EXCEPTION 'Para aprovar, todos os itens da inspeção devem estar conformes.'; END IF;
 IF p_status='REPROVADO' AND nullif(trim(p_notes),'') IS NULL THEN RAISE EXCEPTION 'Descreva o motivo da reprovação.'; END IF;
 UPDATE public.fabric_lots SET quality_status=p_status,inspected_at=now(),inspected_by=auth.uid(),quality_report_path=p_report_path WHERE id=p_lot_id AND organization_id=p_organization_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lote não encontrado nesta organização.'; END IF;
 INSERT INTO public.fabric_lot_inspections(organization_id,lot_id,inspection_status,checklist,report_path,report_filename,report_mime_type,report_size_bytes,notes,inspected_by) VALUES(p_organization_id,p_lot_id,p_status,coalesce(p_checklist,'{}'::jsonb),p_report_path,p_report_filename,p_report_mime_type,p_report_size_bytes,nullif(trim(p_notes),''),auth.uid()) RETURNING id INTO v_inspection_id;
 RETURN v_inspection_id;
END $$;
