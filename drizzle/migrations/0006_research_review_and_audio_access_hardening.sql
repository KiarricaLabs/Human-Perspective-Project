CREATE OR REPLACE FUNCTION public.research_current_consent(p_submission uuid) RETURNS public.consent_records LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF; RETURN public.governing_consent(p_submission); END $$;
REVOKE ALL ON FUNCTION public.research_current_consent(uuid) FROM public,anon; GRANT EXECUTE ON FUNCTION public.research_current_consent(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.can_listen_audio(p_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.has_role(auth.uid(),'admin') AND EXISTS(SELECT 1 FROM public.submissions s CROSS JOIN LATERAL public.governing_consent(s.id) c WHERE s.audio_path=p_path AND s.status<>'withdrawn' AND c.research_analysis AND c.audio) $$;
REVOKE ALL ON FUNCTION public.can_listen_audio(text) FROM public,anon; GRANT EXECUTE ON FUNCTION public.can_listen_audio(text) TO authenticated;
ALTER POLICY "admins read audio" ON storage.objects USING(bucket_id='audio' AND public.can_listen_audio(name));
CREATE OR REPLACE FUNCTION public.guard_research_annotation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.submissions; c public.consent_records; BEGIN
 IF TG_OP='UPDATE' AND (NEW.submission_id IS DISTINCT FROM OLD.submission_id OR NEW.admin_id IS DISTINCT FROM OLD.admin_id OR NEW.created_at IS DISTINCT FROM OLD.created_at OR EXISTS(SELECT 1 FROM public.research_export_items WHERE annotation_id=OLD.id)) THEN RAISE EXCEPTION 'create a new review instead of editing a traced review'; END IF;
 SELECT * INTO s FROM public.submissions WHERE id=NEW.submission_id FOR UPDATE; c:=public.governing_consent(s.id);
 IF s.status='withdrawn' OR c.id IS NULL OR NOT c.research_analysis THEN RAISE EXCEPTION 'research consent unavailable'; END IF;
 IF s.audio_path IS NOT NULL AND (length(trim(coalesce(NEW.deidentified_text,'')))>0 OR NEW.deidentified_at IS NOT NULL) AND NOT(c.audio AND c.transcription) THEN RAISE EXCEPTION 'audio and transcription consent required'; END IF;
 IF NOT NEW.contains_pii AND (NEW.reviewed_at IS NULL OR NEW.deidentified_at IS NULL OR length(trim(coalesce(NEW.deidentified_text,'')))=0) THEN RAISE EXCEPTION 'de-identification requires reviewed text'; END IF;
 RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.guard_research_annotation() FROM public,anon,authenticated;
CREATE TRIGGER annotations_validate BEFORE INSERT OR UPDATE ON public.research_annotations FOR EACH ROW EXECUTE FUNCTION public.guard_research_annotation();
CREATE OR REPLACE FUNCTION public.validate_consent_record() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ DECLARE s public.submissions; latest uuid; BEGIN
 SELECT * INTO s FROM public.submissions WHERE id=NEW.submission_id FOR UPDATE;
 IF s.status='withdrawn' THEN RAISE EXCEPTION 'a withdrawn contribution cannot change permissions'; END IF;
 IF s.audio_path IS NULL AND (NEW.audio OR NEW.transcription) THEN RAISE EXCEPTION 'audio or transcription consent requires an attached audio file' USING ERRCODE='23514'; END IF;
 IF s.audio_path IS NOT NULL AND NEW.source='submission' AND NOT NEW.audio THEN RAISE EXCEPTION 'audio consent is required when audio is attached' USING ERRCODE='23514'; END IF;
 IF NEW.source='submission' AND EXISTS(SELECT 1 FROM public.consent_records WHERE submission_id=NEW.submission_id) THEN RAISE EXCEPTION 'initial consent already recorded' USING ERRCODE='23514'; END IF;
 IF NEW.supersedes_id IS NOT NULL THEN SELECT id INTO latest FROM public.consent_records WHERE submission_id=NEW.submission_id ORDER BY seq DESC LIMIT 1; IF latest IS DISTINCT FROM NEW.supersedes_id THEN RAISE EXCEPTION 'a consent update must supersede the current consent record' USING ERRCODE='23514'; END IF; END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.validate_purpose_approval() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.submissions; c public.consent_records; BEGIN
 SELECT * INTO s FROM public.submissions WHERE id=NEW.submission_id FOR UPDATE;
 IF TG_OP='UPDATE' THEN IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR (to_jsonb(NEW)-'revoked_at')<>(to_jsonb(OLD)-'revoked_at') THEN RAISE EXCEPTION 'approvals can only be revoked, never edited' USING ERRCODE='42501'; END IF; RETURN NEW; END IF;
 IF s.is_test THEN RAISE EXCEPTION 'test submissions cannot be approved for research use' USING ERRCODE='23514'; END IF;
 IF s.status='withdrawn' THEN RAISE EXCEPTION 'submission is withdrawn' USING ERRCODE='23514'; END IF;
 c:=public.governing_consent(NEW.submission_id);
 IF c.id IS NULL OR NOT public.consent_allows(c,NEW.purpose::text) OR (s.audio_path IS NOT NULL AND NOT(c.audio AND c.transcription)) THEN RAISE EXCEPTION 'participant consent does not allow this purpose' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.research_annotations a WHERE a.submission_id=s.id AND a.reviewed_at IS NOT NULL AND a.deidentified_at IS NOT NULL AND NOT a.contains_pii AND length(trim(a.deidentified_text))>0) THEN RAISE EXCEPTION 'submission must be human-reviewed and de-identified first' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION public.save_human_review(p_submission uuid,p_note text,p_text text,p_deidentified boolean) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE s public.submissions; c public.consent_records; aid uuid; BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO s FROM public.submissions WHERE id=p_submission FOR UPDATE; c:=public.research_current_consent(s.id);
 IF s.id IS NULL OR s.status='withdrawn' OR c.id IS NULL OR NOT c.research_analysis THEN RAISE EXCEPTION 'research consent unavailable'; END IF;
 IF s.audio_path IS NOT NULL AND length(trim(coalesce(p_text,'')))>0 AND NOT(c.audio AND c.transcription) THEN RAISE EXCEPTION 'transcription consent required'; END IF;
 IF p_deidentified AND length(trim(coalesce(p_text,'')))=0 THEN RAISE EXCEPTION 'reviewed text required'; END IF;
 INSERT INTO public.research_annotations(submission_id,note,deidentified_text,contains_pii,reviewed_at,deidentified_at) VALUES(s.id,p_note,nullif(trim(p_text),''),NOT p_deidentified,now(),CASE WHEN p_deidentified THEN now() ELSE NULL END) RETURNING id INTO aid;
 UPDATE public.submissions SET status='reviewed' WHERE id=s.id; RETURN aid; END $$;
CREATE OR REPLACE FUNCTION public.create_research_export(p_purpose public.research_purpose,p_notes text,p_submission_ids uuid[]) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE eid uuid; sid uuid; c public.consent_records; a uuid; BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF coalesce(array_length(p_submission_ids,1),0)=0 OR array_length(p_submission_ids,1)>100 THEN RAISE EXCEPTION 'choose 1 to 100 submissions' USING ERRCODE='23514'; END IF;
 PERFORM id FROM public.submissions WHERE id=ANY(p_submission_ids) ORDER BY id FOR UPDATE;
 INSERT INTO public.research_exports(purpose,created_by,notes) VALUES(p_purpose,auth.uid(),p_notes) RETURNING id INTO eid;
 FOR sid IN SELECT DISTINCT unnest(p_submission_ids) ORDER BY 1 LOOP
 c:=public.research_current_consent(sid); a:=NULL;
 SELECT id INTO a FROM public.research_annotations WHERE submission_id=sid AND reviewed_at IS NOT NULL AND deidentified_at IS NOT NULL AND NOT contains_pii AND length(trim(deidentified_text))>0 ORDER BY deidentified_at DESC LIMIT 1 FOR SHARE;
 IF EXISTS(SELECT 1 FROM public.submissions WHERE id=sid AND audio_path IS NOT NULL) AND NOT(c.audio AND c.transcription) THEN RAISE EXCEPTION 'audio and transcription consent required'; END IF;
 INSERT INTO public.research_export_items(export_id,submission_id,consent_record_id,annotation_id,purpose,content_kind) VALUES(eid,sid,c.id,a,p_purpose,'deidentified'); END LOOP; RETURN eid; END $$;
CREATE OR REPLACE FUNCTION public.audit_export_download(p_export uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT public.has_role(auth.uid(),'admin') OR NOT EXISTS(SELECT 1 FROM public.research_exports WHERE id=p_export) THEN RAISE EXCEPTION 'forbidden'; END IF; INSERT INTO public.audit_log(actor_id,action,entity,entity_id) VALUES(auth.uid(),'download','research_exports',p_export::text); END $$;
REVOKE ALL ON FUNCTION public.audit_export_download(uuid) FROM public,anon; GRANT EXECUTE ON FUNCTION public.audit_export_download(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.download_research_export(p_export uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE e public.research_exports; i public.research_export_items; s public.submissions; c public.consent_records; a public.research_annotations; p public.purpose_approvals; result jsonb:='[]'::jsonb; BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT * INTO e FROM public.research_exports WHERE id=p_export; IF e.id IS NULL THEN RAISE EXCEPTION 'export unavailable'; END IF;
 FOR i IN SELECT * FROM public.research_export_items WHERE export_id=e.id ORDER BY submission_id LOOP
 SELECT * INTO s FROM public.submissions WHERE id=i.submission_id FOR SHARE; c:=public.research_current_consent(s.id);
 SELECT * INTO a FROM public.research_annotations WHERE id=i.annotation_id FOR SHARE;
 SELECT * INTO p FROM public.purpose_approvals WHERE submission_id=s.id AND purpose=e.purpose AND revoked_at IS NULL ORDER BY approved_at DESC LIMIT 1 FOR SHARE;
 IF s.id IS NULL OR s.is_test OR s.status='withdrawn' OR c.id IS DISTINCT FROM i.consent_record_id OR NOT public.consent_allows(c,e.purpose::text) OR i.purpose<>e.purpose OR i.content_kind<>'deidentified' OR a.submission_id IS DISTINCT FROM s.id OR a.contains_pii OR a.reviewed_at IS NULL OR a.deidentified_at IS NULL OR length(trim(coalesce(a.deidentified_text,'')))=0 OR (s.audio_path IS NOT NULL AND NOT(c.audio AND c.transcription)) OR p.id IS NULL THEN RAISE EXCEPTION 'export eligibility changed; create a new export after review'; END IF;
 result:=result||jsonb_build_array(jsonb_build_object('submission_id',s.id,'consent_record_id',c.id,'consent_version_id',c.consent_version_id,'consent_recorded_at',c.recorded_at,'annotation_id',a.id,'reviewed_by',a.admin_id,'reviewed_at',a.reviewed_at,'approval_id',p.id,'approved_by',p.approved_by,'approved_at',p.approved_at,'purpose',e.purpose,'text',a.deidentified_text)); END LOOP;
 IF jsonb_array_length(result)=0 THEN RAISE EXCEPTION 'empty export'; END IF;
 PERFORM public.audit_export_download(e.id);
 RETURN jsonb_build_object('export_id',e.id,'purpose',e.purpose,'created_at',e.created_at,'items',result); END $$;