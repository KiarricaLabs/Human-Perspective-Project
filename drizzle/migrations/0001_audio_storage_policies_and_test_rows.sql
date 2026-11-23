
CREATE POLICY "admins read audio" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'audio' AND public.has_role(auth.uid(), 'admin'));

DO $$
DECLARE v uuid; s1 uuid; s2 uuid; s3 uuid;
BEGIN
  SELECT consent_version_id INTO v FROM public.active_consent_version;
  INSERT INTO public.submissions(type, payload, is_test, origin, withdrawal_ref_hash, age_range, region)
  VALUES ('words', '{"title":"[TEST] Sunday dinners","body":"[TEST DATA] This is a dummy written piece used only to test the system.","tags":["family"]}', true, 'admin_test', 'test-hash-1', '25-34', 'south')
  RETURNING id INTO s1;
  INSERT INTO public.submissions(type, payload, is_test, origin, withdrawal_ref_hash)
  VALUES ('language', '{"expression":"[TEST] It''s giving","meaning":"[TEST] It resembles or evokes something","context":"[TEST] casual conversation","tone":"playful"}', true, 'admin_test', 'test-hash-2')
  RETURNING id INTO s2;
  INSERT INTO public.submissions(type, payload, is_test, origin, withdrawal_ref_hash)
  VALUES ('ai_society', '{"concerns":"[TEST] Dummy answer about AI concerns."}', true, 'admin_test', 'test-hash-3')
  RETURNING id INTO s3;
  INSERT INTO public.eligibility_attestations(submission_id, is_adult, identifies_as_black, consent_version_id)
  VALUES (s1, true, true, v), (s2, true, true, v), (s3, true, true, v);
  INSERT INTO public.consent_records(submission_id, consent_version_id, source, research_analysis, audio, transcription, ai_evaluation, ai_training, public_excerpts)
  VALUES (s1, v, 'submission', true, false, false, true, false, false),
         (s2, v, 'submission', true, false, false, false, true, true),
         (s3, v, 'submission', true, false, false, false, false, false);
END $$;
