CREATE TABLE public.participant_request_limits (key_hash text PRIMARY KEY, window_start timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 1);
GRANT ALL ON public.participant_request_limits TO service_role;
REVOKE ALL ON public.participant_request_limits FROM anon,authenticated;
ALTER TABLE public.participant_request_limits ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.take_participant_request(p_key_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE count integer; BEGIN
 IF p_key_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid request key'; END IF;
 DELETE FROM public.participant_request_limits WHERE window_start < now()-interval '1 day';
 INSERT INTO public.participant_request_limits(key_hash) VALUES(p_key_hash) ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN participant_request_limits.window_start<now()-interval '10 minutes' THEN 1 ELSE participant_request_limits.attempts+1 END,window_start=CASE WHEN participant_request_limits.window_start<now()-interval '10 minutes' THEN now() ELSE participant_request_limits.window_start END RETURNING attempts INTO count;
 RETURN count<=20; END $$;
REVOKE ALL ON FUNCTION public.take_participant_request(text) FROM public,anon,authenticated; GRANT EXECUTE ON FUNCTION public.take_participant_request(text) TO service_role;
CREATE OR REPLACE FUNCTION public.guard_export_audio_and_lock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE s public.submissions; c public.consent_records; BEGIN
 SELECT * INTO s FROM public.submissions WHERE id=NEW.submission_id FOR UPDATE;
 c:=public.governing_consent(s.id);
 PERFORM id FROM public.research_annotations WHERE id=NEW.annotation_id FOR SHARE;
 IF NEW.content_kind='deidentified' AND s.audio_path IS NOT NULL AND NOT(c.audio AND c.transcription) THEN RAISE EXCEPTION 'audio and transcription consent required' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.guard_export_audio_and_lock() FROM public,anon,authenticated;
CREATE TRIGGER export_items_audio_guard BEFORE INSERT ON public.research_export_items FOR EACH ROW EXECUTE FUNCTION public.guard_export_audio_and_lock();