CREATE OR REPLACE FUNCTION public.create_research_export(p_purpose research_purpose, p_notes text, p_submission_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE eid uuid; sid uuid; c public.consent_records; a uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
  IF coalesce(array_length(p_submission_ids,1),0) = 0 THEN RAISE EXCEPTION 'choose at least one submission' USING ERRCODE='23514'; END IF;
  INSERT INTO public.research_exports(purpose, created_by, notes) VALUES (p_purpose, auth.uid(), p_notes) RETURNING id INTO eid;
  FOREACH sid IN ARRAY p_submission_ids LOOP
    c := public.governing_consent(sid);
    SELECT id INTO a FROM public.research_annotations WHERE submission_id = sid AND reviewed_at IS NOT NULL AND deidentified_at IS NOT NULL AND NOT contains_pii ORDER BY deidentified_at DESC LIMIT 1;
    INSERT INTO public.research_export_items(export_id, submission_id, consent_record_id, annotation_id, purpose, content_kind)
    VALUES (eid, sid, c.id, a, p_purpose, 'deidentified');
  END LOOP;
  RETURN eid;
END $$;
REVOKE ALL ON FUNCTION public.create_research_export(research_purpose, text, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_research_export(research_purpose, text, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.revoke_disallowed_approvals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.purpose_approvals SET revoked_at = now()
  WHERE submission_id = NEW.submission_id AND revoked_at IS NULL AND NOT public.consent_allows(NEW, purpose::text);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.revoke_disallowed_approvals() FROM public, anon, authenticated;
CREATE TRIGGER consent_records_revoke_approvals AFTER INSERT ON public.consent_records FOR EACH ROW EXECUTE FUNCTION public.revoke_disallowed_approvals();