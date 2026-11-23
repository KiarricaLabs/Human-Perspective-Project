CREATE OR REPLACE FUNCTION public.manage_participation(p_hash text, p_action text, p_version uuid, p_consent jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.submissions; c public.consent_records; active uuid;
BEGIN
 SELECT * INTO s FROM public.submissions WHERE withdrawal_ref_hash=p_hash FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'reference unavailable'; END IF;
 IF p_action='withdraw' THEN
  INSERT INTO public.withdrawal_requests(submission_id) VALUES(s.id) ON CONFLICT(submission_id) DO NOTHING;
  RETURN jsonb_build_object('status','withdrawn');
 END IF;
 IF s.status='withdrawn' THEN RAISE EXCEPTION 'reference unavailable'; END IF;
 c:=public.governing_consent(s.id);
 IF p_action='read' THEN RETURN jsonb_build_object('hasAudio',s.audio_path IS NOT NULL,'consent',jsonb_build_object('research_analysis',c.research_analysis,'audio',c.audio,'transcription',c.transcription,'ai_evaluation',c.ai_evaluation,'ai_training',c.ai_training,'public_excerpts',c.public_excerpts)); END IF;
 IF p_action<>'update' THEN RAISE EXCEPTION 'invalid action'; END IF;
 SELECT consent_version_id INTO active FROM public.active_consent_version WHERE id=true FOR SHARE;
 IF active IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'consent wording changed'; END IF;
 IF p_consent IS NULL OR (SELECT count(*) FROM jsonb_each(p_consent))<>6 OR EXISTS(SELECT 1 FROM jsonb_each(p_consent) WHERE key NOT IN ('research_analysis','audio','transcription','ai_evaluation','ai_training','public_excerpts') OR jsonb_typeof(value)<>'boolean') THEN RAISE EXCEPTION 'invalid permissions'; END IF;
 INSERT INTO public.consent_records(submission_id,consent_version_id,supersedes_id,source,research_analysis,audio,transcription,ai_evaluation,ai_training,public_excerpts)
 VALUES(s.id,active,c.id,'participant_update',(p_consent->>'research_analysis')::boolean,(p_consent->>'audio')::boolean,(p_consent->>'transcription')::boolean,(p_consent->>'ai_evaluation')::boolean,(p_consent->>'ai_training')::boolean,(p_consent->>'public_excerpts')::boolean);
 IF NOT (p_consent->>'research_analysis')::boolean THEN INSERT INTO public.withdrawal_requests(submission_id) VALUES(s.id) ON CONFLICT(submission_id) DO NOTHING; END IF;
 RETURN jsonb_build_object('status',CASE WHEN (p_consent->>'research_analysis')::boolean THEN 'updated' ELSE 'withdrawn' END);
END $$;
REVOKE ALL ON FUNCTION public.manage_participation(text,text,uuid,jsonb) FROM public,anon,authenticated; GRANT EXECUTE ON FUNCTION public.manage_participation(text,text,uuid,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.save_human_review(p_submission uuid,p_note text,p_text text,p_deidentified boolean) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE s public.submissions; c public.consent_records; aid uuid;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO s FROM public.submissions WHERE id=p_submission FOR UPDATE;
 c:=public.governing_consent(s.id);
 IF s.id IS NULL OR s.status='withdrawn' OR NOT c.research_analysis THEN RAISE EXCEPTION 'research consent unavailable'; END IF;
 IF s.audio_path IS NOT NULL AND length(trim(coalesce(p_text,'')))>0 AND NOT(c.audio AND c.transcription) THEN RAISE EXCEPTION 'transcription consent required'; END IF;
 IF p_deidentified AND length(trim(coalesce(p_text,'')))=0 THEN RAISE EXCEPTION 'reviewed text required'; END IF;
 INSERT INTO public.research_annotations(submission_id,note,deidentified_text,contains_pii,reviewed_at,deidentified_at) VALUES(s.id,p_note,nullif(trim(p_text),''),NOT p_deidentified,now(),CASE WHEN p_deidentified THEN now() ELSE NULL END) RETURNING id INTO aid;
 UPDATE public.submissions SET status='reviewed' WHERE id=s.id;
 RETURN aid;
END $$;
REVOKE ALL ON FUNCTION public.save_human_review(uuid,text,text,boolean) FROM public,anon; GRANT EXECUTE ON FUNCTION public.save_human_review(uuid,text,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.download_research_export(p_export uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE e public.research_exports; i public.research_export_items; s public.submissions; c public.consent_records; a public.research_annotations; result jsonb:='[]'::jsonb;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO e FROM public.research_exports WHERE id=p_export;
 IF e.id IS NULL THEN RAISE EXCEPTION 'export unavailable'; END IF;
 FOR i IN SELECT * FROM public.research_export_items WHERE export_id=e.id ORDER BY submission_id LOOP
 SELECT * INTO s FROM public.submissions WHERE id=i.submission_id FOR SHARE;
 c:=public.governing_consent(s.id);
 SELECT * INTO a FROM public.research_annotations WHERE id=i.annotation_id FOR SHARE;
 IF s.is_test OR s.status='withdrawn' OR c.id IS DISTINCT FROM i.consent_record_id OR NOT public.consent_allows(c,e.purpose::text) OR i.purpose<>e.purpose OR i.content_kind<>'deidentified' OR a.contains_pii OR a.reviewed_at IS NULL OR a.deidentified_at IS NULL OR a.deidentified_text IS NULL OR (s.audio_path IS NOT NULL AND NOT(c.audio AND c.transcription)) OR NOT EXISTS(SELECT 1 FROM public.purpose_approvals WHERE submission_id=s.id AND purpose=e.purpose AND revoked_at IS NULL) THEN RAISE EXCEPTION 'export eligibility changed; create a new export after review'; END IF;
 result:=result||jsonb_build_array(jsonb_build_object('submission_id',s.id,'consent_record_id',c.id,'consent_version_id',c.consent_version_id,'annotation_id',a.id,'purpose',e.purpose,'text',a.deidentified_text));
 END LOOP;
 IF jsonb_array_length(result)=0 THEN RAISE EXCEPTION 'empty export'; END IF;
 RETURN jsonb_build_object('export_id',e.id,'purpose',e.purpose,'created_at',e.created_at,'items',result);
END $$;
REVOKE ALL ON FUNCTION public.download_research_export(uuid) FROM public,anon; GRANT EXECUTE ON FUNCTION public.download_research_export(uuid) TO authenticated;