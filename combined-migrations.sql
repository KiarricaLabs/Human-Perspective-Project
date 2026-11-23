
-- ========== Roles ==========
CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- ========== Generic helpers ==========
CREATE OR REPLACE FUNCTION public.block_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION '% on % is not allowed (append-only)', TG_OP, TG_TABLE_NAME USING ERRCODE = '42501';
END $$;

-- ========== Audit log ==========
CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT SELECT, INSERT ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit" ON public.audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.block_mutation();

CREATE OR REPLACE FUNCTION public.write_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  r := to_jsonb(NEW) - 'payload' - 'note' - 'deidentified_text' - 'withdrawal_ref_hash';
  INSERT INTO public.audit_log(actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), lower(TG_OP), TG_TABLE_NAME, COALESCE(r->>'id', r->>'key'), r);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.write_audit() FROM PUBLIC, anon, authenticated;

-- ========== Settings (submissions switch) ==========
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read settings" ON public.app_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER app_settings_no_delete BEFORE DELETE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.block_mutation();
CREATE TRIGGER app_settings_audit AFTER INSERT OR UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.write_audit();
INSERT INTO public.app_settings(key, value) VALUES ('submissions_open', 'false'::jsonb);

-- ========== Consent versions (immutable wording) ==========
CREATE TABLE public.consent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_label text NOT NULL UNIQUE,
  eligibility_text text NOT NULL,
  research_analysis_text text NOT NULL,
  audio_text text NOT NULL,
  transcription_text text NOT NULL,
  ai_evaluation_text text NOT NULL,
  ai_training_text text NOT NULL,
  public_excerpts_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.consent_versions TO anon, authenticated;
GRANT SELECT, INSERT ON public.consent_versions TO service_role;
ALTER TABLE public.consent_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consent wording is public" ON public.consent_versions FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER consent_versions_immutable BEFORE UPDATE OR DELETE ON public.consent_versions FOR EACH ROW EXECUTE FUNCTION public.block_mutation();

CREATE TABLE public.active_consent_version (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  consent_version_id uuid NOT NULL REFERENCES public.consent_versions(id),
  activated_at timestamptz NOT NULL DEFAULT now(),
  activated_by uuid
);
GRANT SELECT ON public.active_consent_version TO anon, authenticated;
GRANT UPDATE ON public.active_consent_version TO authenticated;
GRANT ALL ON public.active_consent_version TO service_role;
ALTER TABLE public.active_consent_version ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active version is public" ON public.active_consent_version FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins activate versions" ON public.active_consent_version FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE OR REPLACE FUNCTION public.stamp_activation() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.activated_at := now(); NEW.activated_by := auth.uid(); RETURN NEW; END $$;
CREATE TRIGGER active_version_stamp BEFORE UPDATE ON public.active_consent_version FOR EACH ROW EXECUTE FUNCTION public.stamp_activation();
CREATE TRIGGER active_version_no_delete BEFORE DELETE ON public.active_consent_version FOR EACH ROW EXECUTE FUNCTION public.block_mutation();
CREATE TRIGGER active_version_audit AFTER INSERT OR UPDATE ON public.active_consent_version FOR EACH ROW EXECUTE FUNCTION public.write_audit();

WITH v AS (
  INSERT INTO public.consent_versions(version_label, eligibility_text, research_analysis_text, audio_text, transcription_text, ai_evaluation_text, ai_training_text, public_excerpts_text)
  VALUES ('v1',
    'I confirm that I am at least 18 years old and that I identify as Black.',
    'I allow The Human Perspective Project to read and study my contribution for independent research. This is required to take part.',
    'I allow my audio recording to be stored privately and listened to by the research team.',
    'I allow my audio recording to be transcribed (turned into written text) for research.',
    'I allow reviewed, de-identified parts of my contribution to be used to test and evaluate how AI systems understand people like me. This does not include training.',
    'I allow reviewed, de-identified parts of my contribution to be used to train or fine-tune AI systems. This is separate from evaluation.',
    'I allow short, de-identified excerpts of my contribution to be shared publicly, for example in reports or on this website.')
  RETURNING id)
INSERT INTO public.active_consent_version(id, consent_version_id) SELECT true, id FROM v;

-- ========== Submissions ==========
CREATE TYPE public.submission_type AS ENUM ('words','voice','language','ai_society');
CREATE TYPE public.submission_status AS ENUM ('pending','reviewed','withdrawn');
CREATE TYPE public.submission_origin AS ENUM ('public','admin_test');

CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type public.submission_type NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) < 60000),
  audio_path text,
  audio_mime text,
  audio_bytes integer CHECK (audio_bytes IS NULL OR (audio_bytes > 0 AND audio_bytes <= 10485760)),
  age_range text,
  region text,
  status public.submission_status NOT NULL DEFAULT 'pending',
  is_test boolean NOT NULL DEFAULT false,
  origin public.submission_origin NOT NULL DEFAULT 'public',
  withdrawal_ref_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_test_is_test CHECK (origin <> 'admin_test' OR is_test),
  CONSTRAINT voice_has_audio CHECK ((type = 'voice') = (audio_path IS NOT NULL)),
  CONSTRAINT audio_fields CHECK ((audio_path IS NULL) = (audio_mime IS NULL) AND (audio_path IS NULL) = (audio_bytes IS NULL))
);
GRANT SELECT, UPDATE ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read submissions" ON public.submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update status" ON public.submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.guard_submission_update() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.type IS DISTINCT FROM OLD.type OR NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.audio_path IS DISTINCT FROM OLD.audio_path OR NEW.audio_mime IS DISTINCT FROM OLD.audio_mime
     OR NEW.audio_bytes IS DISTINCT FROM OLD.audio_bytes OR NEW.origin IS DISTINCT FROM OLD.origin
     OR NEW.withdrawal_ref_hash IS DISTINCT FROM OLD.withdrawal_ref_hash OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.age_range IS DISTINCT FROM OLD.age_range OR NEW.region IS DISTINCT FROM OLD.region THEN
    RAISE EXCEPTION 'submission content cannot be changed' USING ERRCODE = '42501';
  END IF;
  IF OLD.is_test AND NOT NEW.is_test THEN
    RAISE EXCEPTION 'a test submission can never become a real submission' USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'withdrawn' AND NEW.status <> 'withdrawn' THEN
    RAISE EXCEPTION 'a withdrawn submission cannot be reinstated' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER submissions_guard BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.guard_submission_update();
CREATE TRIGGER submissions_no_delete BEFORE DELETE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.block_mutation();

CREATE TABLE public.eligibility_attestations (
  submission_id uuid PRIMARY KEY REFERENCES public.submissions(id),
  is_adult boolean NOT NULL CHECK (is_adult),
  identifies_as_black boolean NOT NULL CHECK (identifies_as_black),
  consent_version_id uuid NOT NULL REFERENCES public.consent_versions(id),
  attested_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.eligibility_attestations TO authenticated;
GRANT SELECT, INSERT ON public.eligibility_attestations TO service_role;
ALTER TABLE public.eligibility_attestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read eligibility" ON public.eligibility_attestations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER eligibility_immutable BEFORE UPDATE OR DELETE ON public.eligibility_attestations FOR EACH ROW EXECUTE FUNCTION public.block_mutation();

-- ========== Consent records (append-only) ==========
CREATE TABLE public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  submission_id uuid NOT NULL REFERENCES public.submissions(id),
  consent_version_id uuid NOT NULL REFERENCES public.consent_versions(id),
  supersedes_id uuid REFERENCES public.consent_records(id),
  source text NOT NULL DEFAULT 'submission' CHECK (source IN ('submission','participant_update')),
  research_analysis boolean NOT NULL,
  audio boolean NOT NULL,
  transcription boolean NOT NULL,
  ai_evaluation boolean NOT NULL,
  ai_training boolean NOT NULL,
  public_excerpts boolean NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transcription_needs_audio_consent CHECK (NOT transcription OR audio),
  CONSTRAINT initial_requires_research CHECK (source <> 'submission' OR research_analysis),
  CONSTRAINT initial_has_no_parent CHECK ((source = 'submission') = (supersedes_id IS NULL))
);
CREATE INDEX consent_records_submission_idx ON public.consent_records(submission_id, seq DESC);
GRANT SELECT ON public.consent_records TO authenticated;
GRANT SELECT, INSERT ON public.consent_records TO service_role;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read consent" ON public.consent_records FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER consent_records_immutable BEFORE UPDATE OR DELETE ON public.consent_records FOR EACH ROW EXECUTE FUNCTION public.block_mutation();

CREATE OR REPLACE FUNCTION public.validate_consent_record() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s public.submissions; latest uuid;
BEGIN
  SELECT * INTO s FROM public.submissions WHERE id = NEW.submission_id;
  IF s.audio_path IS NULL AND (NEW.audio OR NEW.transcription) THEN
    RAISE EXCEPTION 'audio or transcription consent requires an attached audio file' USING ERRCODE = '23514';
  END IF;
  IF s.audio_path IS NOT NULL AND NEW.source = 'submission' AND NOT NEW.audio THEN
    RAISE EXCEPTION 'audio consent is required when audio is attached' USING ERRCODE = '23514';
  END IF;
  IF NEW.source = 'submission' AND EXISTS (SELECT 1 FROM public.consent_records WHERE submission_id = NEW.submission_id) THEN
    RAISE EXCEPTION 'initial consent already recorded; add an update instead' USING ERRCODE = '23514';
  END IF;
  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT id INTO latest FROM public.consent_records WHERE submission_id = NEW.submission_id ORDER BY seq DESC LIMIT 1;
    IF latest IS DISTINCT FROM NEW.supersedes_id THEN
      RAISE EXCEPTION 'a consent update must supersede the current consent record' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER consent_records_validate BEFORE INSERT ON public.consent_records FOR EACH ROW EXECUTE FUNCTION public.validate_consent_record();
CREATE TRIGGER consent_records_audit AFTER INSERT ON public.consent_records FOR EACH ROW EXECUTE FUNCTION public.write_audit();

-- Governing consent = newest record per submission
CREATE VIEW public.current_consent WITH (security_invoker = true) AS
  SELECT DISTINCT ON (submission_id) * FROM public.consent_records ORDER BY submission_id, seq DESC;
GRANT SELECT ON public.current_consent TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.consent_allows(_c public.consent_records, _purpose text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _c.research_analysis AND CASE _purpose
    WHEN 'evaluation' THEN _c.ai_evaluation
    WHEN 'training' THEN _c.ai_training
    WHEN 'public' THEN _c.public_excerpts
    ELSE false END
$$;

CREATE OR REPLACE FUNCTION public.governing_consent(_submission_id uuid) RETURNS public.consent_records LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.consent_records WHERE submission_id = _submission_id ORDER BY seq DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.governing_consent(uuid) FROM PUBLIC, anon, authenticated;

-- ========== Withdrawals ==========
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE REFERENCES public.submissions(id),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid
);
GRANT SELECT, UPDATE ON public.withdrawal_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read withdrawals" ON public.withdrawal_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins process withdrawals" ON public.withdrawal_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER withdrawals_no_delete BEFORE DELETE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.block_mutation();
CREATE OR REPLACE FUNCTION public.apply_withdrawal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.submissions SET status = 'withdrawn' WHERE id = NEW.submission_id;
  UPDATE public.purpose_approvals SET revoked_at = now() WHERE submission_id = NEW.submission_id AND revoked_at IS NULL;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.apply_withdrawal() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER withdrawals_audit AFTER INSERT OR UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.write_audit();

-- ========== Review / de-identification ==========
CREATE TABLE public.research_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id),
  admin_id uuid NOT NULL DEFAULT auth.uid(),
  note text,
  contains_pii boolean NOT NULL DEFAULT true,
  deidentified_text text,
  reviewed_at timestamptz,
  deidentified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deid_needs_text CHECK (deidentified_at IS NULL OR (deidentified_text IS NOT NULL AND reviewed_at IS NOT NULL))
);
GRANT SELECT, INSERT, UPDATE ON public.research_annotations TO authenticated;
GRANT ALL ON public.research_annotations TO service_role;
ALTER TABLE public.research_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read annotations" ON public.research_annotations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins add annotations" ON public.research_annotations FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());
CREATE POLICY "admins edit annotations" ON public.research_annotations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER annotations_no_delete BEFORE DELETE ON public.research_annotations FOR EACH ROW EXECUTE FUNCTION public.block_mutation();
CREATE TRIGGER annotations_audit AFTER INSERT OR UPDATE ON public.research_annotations FOR EACH ROW EXECUTE FUNCTION public.write_audit();

-- ========== Purpose-specific approvals ==========
CREATE TYPE public.research_purpose AS ENUM ('evaluation','training','public');
CREATE TABLE public.purpose_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id),
  purpose public.research_purpose NOT NULL,
  approved_by uuid NOT NULL DEFAULT auth.uid(),
  approved_at timestamptz NOT NULL DEFAULT now(),
  justification text NOT NULL CHECK (length(trim(justification)) >= 10),
  revoked_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.purpose_approvals TO authenticated;
GRANT ALL ON public.purpose_approvals TO service_role;
ALTER TABLE public.purpose_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read approvals" ON public.purpose_approvals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins approve" ON public.purpose_approvals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND approved_by = auth.uid());
CREATE POLICY "admins revoke" ON public.purpose_approvals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.validate_purpose_approval() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.submissions; c public.consent_records;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL
       OR (to_jsonb(NEW) - 'revoked_at') <> (to_jsonb(OLD) - 'revoked_at') THEN
      RAISE EXCEPTION 'approvals can only be revoked, never edited' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO s FROM public.submissions WHERE id = NEW.submission_id;
  IF s.is_test THEN RAISE EXCEPTION 'test submissions cannot be approved for research use' USING ERRCODE = '23514'; END IF;
  IF s.status = 'withdrawn' THEN RAISE EXCEPTION 'submission is withdrawn' USING ERRCODE = '23514'; END IF;
  c := public.governing_consent(NEW.submission_id);
  IF c.id IS NULL OR NOT public.consent_allows(c, NEW.purpose::text) THEN
    RAISE EXCEPTION 'participant consent does not allow %', NEW.purpose USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.research_annotations a WHERE a.submission_id = NEW.submission_id
                 AND a.reviewed_at IS NOT NULL AND a.deidentified_at IS NOT NULL AND NOT a.contains_pii) THEN
    RAISE EXCEPTION 'submission must be human-reviewed and de-identified first' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purpose_approvals_validate BEFORE INSERT OR UPDATE ON public.purpose_approvals FOR EACH ROW EXECUTE FUNCTION public.validate_purpose_approval();
CREATE TRIGGER purpose_approvals_no_delete BEFORE DELETE ON public.purpose_approvals FOR EACH ROW EXECUTE FUNCTION public.block_mutation();
CREATE TRIGGER purpose_approvals_audit AFTER INSERT OR UPDATE ON public.purpose_approvals FOR EACH ROW EXECUTE FUNCTION public.write_audit();

CREATE TRIGGER withdrawals_apply AFTER INSERT ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.apply_withdrawal();

-- ========== Raw-content training authorization ==========
CREATE TABLE public.raw_training_authorizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id),
  includes_audio boolean NOT NULL DEFAULT false,
  documented_basis text NOT NULL CHECK (length(trim(documented_basis)) >= 20),
  reviewed_by uuid NOT NULL DEFAULT auth.uid(),
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.raw_training_authorizations TO authenticated;
GRANT ALL ON public.raw_training_authorizations TO service_role;
ALTER TABLE public.raw_training_authorizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read raw auth" ON public.raw_training_authorizations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins add raw auth" ON public.raw_training_authorizations FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND reviewed_by = auth.uid());
CREATE OR REPLACE FUNCTION public.validate_raw_auth() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.submissions; c public.consent_records;
BEGIN
  SELECT * INTO s FROM public.submissions WHERE id = NEW.submission_id;
  IF s.is_test OR s.status = 'withdrawn' THEN RAISE EXCEPTION 'not eligible for raw authorization' USING ERRCODE = '23514'; END IF;
  c := public.governing_consent(NEW.submission_id);
  IF c.id IS NULL OR NOT public.consent_allows(c, 'training') THEN RAISE EXCEPTION 'participant has not consented to training' USING ERRCODE = '23514'; END IF;
  IF NEW.includes_audio AND (s.audio_path IS NULL OR NOT c.audio) THEN RAISE EXCEPTION 'raw audio needs an audio file and audio consent' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER raw_auth_validate BEFORE INSERT ON public.raw_training_authorizations FOR EACH ROW EXECUTE FUNCTION public.validate_raw_auth();
CREATE TRIGGER raw_auth_immutable BEFORE UPDATE OR DELETE ON public.raw_training_authorizations FOR EACH ROW EXECUTE FUNCTION public.block_mutation();
CREATE TRIGGER raw_auth_audit AFTER INSERT ON public.raw_training_authorizations FOR EACH ROW EXECUTE FUNCTION public.write_audit();

-- ========== Exports ==========
CREATE TABLE public.research_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose public.research_purpose NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.research_exports TO authenticated;
GRANT ALL ON public.research_exports TO service_role;
ALTER TABLE public.research_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read exports" ON public.research_exports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins create exports" ON public.research_exports FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());
CREATE TRIGGER exports_immutable BEFORE UPDATE OR DELETE ON public.research_exports FOR EACH ROW EXECUTE FUNCTION public.block_mutation();
CREATE TRIGGER exports_audit AFTER INSERT ON public.research_exports FOR EACH ROW EXECUTE FUNCTION public.write_audit();

CREATE TYPE public.export_content_kind AS ENUM ('deidentified','raw_text','raw_audio');
CREATE TABLE public.research_export_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id uuid NOT NULL REFERENCES public.research_exports(id),
  submission_id uuid NOT NULL REFERENCES public.submissions(id),
  consent_record_id uuid NOT NULL REFERENCES public.consent_records(id),
  annotation_id uuid NOT NULL REFERENCES public.research_annotations(id),
  purpose public.research_purpose NOT NULL,
  content_kind public.export_content_kind NOT NULL DEFAULT 'deidentified',
  raw_authorization_id uuid REFERENCES public.raw_training_authorizations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (export_id, submission_id, content_kind)
);
GRANT SELECT, INSERT ON public.research_export_items TO authenticated;
GRANT ALL ON public.research_export_items TO service_role;
ALTER TABLE public.research_export_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read export items" ON public.research_export_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins add export items" ON public.research_export_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.validate_export_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.research_exports; s public.submissions; c public.consent_records; a public.research_annotations; r public.raw_training_authorizations;
BEGIN
  SELECT * INTO e FROM public.research_exports WHERE id = NEW.export_id;
  IF e.purpose IS DISTINCT FROM NEW.purpose THEN RAISE EXCEPTION 'item purpose must match the export purpose' USING ERRCODE = '23514'; END IF;
  SELECT * INTO s FROM public.submissions WHERE id = NEW.submission_id;
  IF s.is_test THEN RAISE EXCEPTION 'test submissions can never be exported' USING ERRCODE = '23514'; END IF;
  IF s.status = 'withdrawn' OR EXISTS (SELECT 1 FROM public.withdrawal_requests w WHERE w.submission_id = s.id) THEN
    RAISE EXCEPTION 'submission is withdrawn' USING ERRCODE = '23514'; END IF;
  c := public.governing_consent(NEW.submission_id);
  IF c.id IS DISTINCT FROM NEW.consent_record_id THEN RAISE EXCEPTION 'export must reference the current governing consent record' USING ERRCODE = '23514'; END IF;
  IF NOT public.consent_allows(c, NEW.purpose::text) THEN RAISE EXCEPTION 'participant consent does not allow %', NEW.purpose USING ERRCODE = '23514'; END IF;
  SELECT * INTO a FROM public.research_annotations WHERE id = NEW.annotation_id;
  IF a.submission_id IS DISTINCT FROM NEW.submission_id OR a.reviewed_at IS NULL OR a.deidentified_at IS NULL OR a.contains_pii THEN
    RAISE EXCEPTION 'item needs a human-reviewed, de-identified annotation for this submission' USING ERRCODE = '23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.purpose_approvals p WHERE p.submission_id = NEW.submission_id AND p.purpose = NEW.purpose AND p.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'no active % approval for this submission', NEW.purpose USING ERRCODE = '23514'; END IF;
  IF NEW.content_kind <> 'deidentified' THEN
    IF NEW.purpose <> 'training' THEN RAISE EXCEPTION 'raw content is only possible for training exports' USING ERRCODE = '23514'; END IF;
    SELECT * INTO r FROM public.raw_training_authorizations WHERE id = NEW.raw_authorization_id;
    IF r.id IS NULL OR r.submission_id <> NEW.submission_id THEN RAISE EXCEPTION 'raw content needs a documented raw authorization' USING ERRCODE = '23514'; END IF;
    IF NEW.content_kind = 'raw_audio' AND (NOT r.includes_audio OR NOT c.audio) THEN RAISE EXCEPTION 'raw audio is not authorized' USING ERRCODE = '23514'; END IF;
  ELSIF NEW.raw_authorization_id IS NOT NULL THEN
    RAISE EXCEPTION 'de-identified items must not carry a raw authorization' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER export_items_validate BEFORE INSERT ON public.research_export_items FOR EACH ROW EXECUTE FUNCTION public.validate_export_item();
CREATE TRIGGER export_items_immutable BEFORE UPDATE OR DELETE ON public.research_export_items FOR EACH ROW EXECUTE FUNCTION public.block_mutation();
CREATE TRIGGER export_items_audit AFTER INSERT ON public.research_export_items FOR EACH ROW EXECUTE FUNCTION public.write_audit();

-- ========== Atomic submission (closed-switch safe) ==========
CREATE OR REPLACE FUNCTION public.submit_contribution(
  p_type public.submission_type, p_payload jsonb, p_audio_path text, p_audio_mime text, p_audio_bytes integer,
  p_age_range text, p_region text, p_is_adult boolean, p_identifies_as_black boolean,
  p_consent_version_id uuid, p_research_analysis boolean, p_audio boolean, p_transcription boolean,
  p_ai_evaluation boolean, p_ai_training boolean, p_public_excerpts boolean,
  p_withdrawal_ref_hash text, p_admin_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_open boolean; active uuid; new_id uuid; test boolean := false;
BEGIN
  -- Shares a lock with any switch change: closing waits for in-flight submissions, and
  -- a submission that starts after a close sees the committed closed value.
  SELECT (value)::text::boolean INTO is_open FROM public.app_settings WHERE key = 'submissions_open' FOR SHARE;
  IF p_admin_id IS NOT NULL THEN
    IF NOT public.has_role(p_admin_id, 'admin') THEN RAISE EXCEPTION 'not an admin' USING ERRCODE = '42501'; END IF;
    test := true;
  ELSIF NOT COALESCE(is_open, false) THEN
    RAISE EXCEPTION 'submissions are closed' USING ERRCODE = 'P0001', HINT = 'SUBMISSIONS_CLOSED';
  END IF;
  IF NOT (COALESCE(p_is_adult,false) AND COALESCE(p_identifies_as_black,false)) THEN
    RAISE EXCEPTION 'eligibility not confirmed' USING ERRCODE = '23514';
  END IF;
  SELECT consent_version_id INTO active FROM public.active_consent_version;
  IF active IS DISTINCT FROM p_consent_version_id THEN
    RAISE EXCEPTION 'consent wording has changed; please reload' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.submissions(type, payload, audio_path, audio_mime, audio_bytes, age_range, region, is_test, origin, withdrawal_ref_hash)
  VALUES (p_type, p_payload, p_audio_path, p_audio_mime, p_audio_bytes, p_age_range, p_region, test,
          CASE WHEN test THEN 'admin_test'::public.submission_origin ELSE 'public' END, p_withdrawal_ref_hash)
  RETURNING id INTO new_id;
  INSERT INTO public.eligibility_attestations(submission_id, is_adult, identifies_as_black, consent_version_id)
  VALUES (new_id, p_is_adult, p_identifies_as_black, active);
  INSERT INTO public.consent_records(submission_id, consent_version_id, source, research_analysis, audio, transcription, ai_evaluation, ai_training, public_excerpts)
  VALUES (new_id, active, 'submission', p_research_analysis, p_audio, p_transcription, p_ai_evaluation, p_ai_training, p_public_excerpts);
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.submit_contribution(public.submission_type, jsonb, text, text, integer, text, text, boolean, boolean, uuid, boolean, boolean, boolean, boolean, boolean, boolean, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_contribution(public.submission_type, jsonb, text, text, integer, text, text, boolean, boolean, uuid, boolean, boolean, boolean, boolean, boolean, boolean, text, uuid) TO service_role;

-- Truncate is never allowed on research tables
REVOKE TRUNCATE ON public.submissions, public.consent_records, public.consent_versions, public.audit_log,
  public.eligibility_attestations, public.research_export_items, public.research_exports, public.purpose_approvals,
  public.raw_training_authorizations, public.withdrawal_requests, public.research_annotations FROM anon, authenticated, service_role;

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
REVOKE ALL ON public.submissions, public.consent_records, public.audit_log, public.eligibility_attestations, public.research_export_items, public.research_exports, public.purpose_approvals, public.raw_training_authorizations, public.withdrawal_requests, public.research_annotations, public.app_settings, public.user_roles, public.current_consent FROM anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.consent_versions, public.active_consent_version FROM anon, PUBLIC;REVOKE ALL ON FUNCTION public.validate_export_item(), public.validate_purpose_approval(), public.validate_raw_auth(), public.validate_consent_record(), public.guard_submission_update(), public.block_mutation(), public.stamp_activation() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.consent_allows(public.consent_records, text) SET search_path = public;CREATE OR REPLACE FUNCTION public.create_research_export(p_purpose research_purpose, p_notes text, p_submission_ids uuid[])
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
CREATE TRIGGER consent_records_revoke_approvals AFTER INSERT ON public.consent_records FOR EACH ROW EXECUTE FUNCTION public.revoke_disallowed_approvals();CREATE OR REPLACE FUNCTION public.manage_participation(p_hash text, p_action text, p_version uuid, p_consent jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
REVOKE ALL ON FUNCTION public.download_research_export(uuid) FROM public,anon; GRANT EXECUTE ON FUNCTION public.download_research_export(uuid) TO authenticated;CREATE OR REPLACE FUNCTION public.research_current_consent(p_submission uuid) RETURNS public.consent_records LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF; RETURN public.governing_consent(p_submission); END $$;
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
 RETURN jsonb_build_object('export_id',e.id,'purpose',e.purpose,'created_at',e.created_at,'items',result); END $$;CREATE TABLE public.participant_request_limits (key_hash text PRIMARY KEY, window_start timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 1);
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