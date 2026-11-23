import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AGE_RANGES, AI_PROMPTS, EMPTY_CONSENT, MAX_AUDIO_BYTES, REGIONS, TONES, TOPIC_TAGS,
  consentProblems, payloadSchemas, type Consent, type ContributionType,
} from "@/lib/contribution-rules";
import { requestAudioUpload, requestTestAudioUpload, submitContribution, submitTestContribution } from "@/lib/contribute.functions";
import { VoiceDictation } from "./voice-dictation";

type Wording = {
  id: string; version_label: string; eligibility_text: string; research_analysis_text: string; audio_text: string;
  transcription_text: string; ai_evaluation_text: string; ai_training_text: string; public_excerpts_text: string;
};

type FormState = { tags: string[]; title?: string; body?: string; description?: string; language_notes?: string; expression?: string; meaning?: string; context?: string; tone?: string; tone_other?: string; example?: string; [k: string]: unknown };
const field = "mt-1.5";
function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id} className="text-foreground">{label}</Label>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <div className={field}>{children}</div>
    </div>
  );
}
function Check({ id, checked, onChange, children, disabled }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(v) => onChange(v === true)} className="mt-1" />
      <Label htmlFor={id} className={`font-normal leading-relaxed ${disabled ? "text-muted-foreground" : "text-foreground/90"}`}>{children}</Label>
    </div>
  );
}
const selectCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function ContributionForm({ type, wording, mode, open, onSaved }: { type: ContributionType; wording: Wording; mode: "public" | "test"; open: boolean; onSaved?: () => void }) {
  const [p, setP] = useState<FormState>({ tags: [] });
  const [file, setFile] = useState<File | null>(null);
  const [ageRange, setAgeRange] = useState("");
  const [region, setRegion] = useState("");
  const [isAdult, setIsAdult] = useState(false);
  const [isBlack, setIsBlack] = useState(false);
  const [ownThoughts, setOwnThoughts] = useState(false);
  const [consent, setConsent] = useState<Consent>(EMPTY_CONSENT);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ code: string; isTest: boolean } | null>(null);

  const submitPublic = useServerFn(submitContribution);
  const submitTest = useServerFn(submitTestContribution);
  const uploadPublic = useServerFn(requestAudioUpload);
  const uploadTest = useServerFn(requestTestAudioUpload);

  const set = (k: string, v: unknown) => setP((o) => ({ ...o, [k]: v }));
  const setC = (k: keyof Consent, v: boolean) =>
    setConsent((c) => {
      const n = { ...c, [k]: v };
      if (k === "audio" && !v) n.transcription = false;
      return n;
    });
  const hasAudio = type === "voice" && !!file;
  const canSubmit = mode === "test" || open;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: string[] = [];
    const parsed = payloadSchemas[type].safeParse(p);
    if (!parsed.success) errs.push(...parsed.error.issues.map((i) => `${i.path.join(".") || "Form"}: ${i.message}`));
    if (type === "voice" && !file) errs.push("Please choose an audio file.");
    if (file && file.size > MAX_AUDIO_BYTES) errs.push("Audio must be 10 MB or smaller.");
    if (!isAdult || !isBlack || !ownThoughts) errs.push("Please confirm all eligibility statements.");
    errs.push(...consentProblems(consent, hasAudio));
    setErrors(errs);
    if (errs.length || !canSubmit) return;
    setBusy(true);
    try {
      let audioPath: string | undefined;
      if (type === "voice" && file) {
        const { path, token } = mode === "test" ? await uploadTest() : await uploadPublic();
        const { error } = await supabase.storage.from("audio").uploadToSignedUrl(path, token, file, { contentType: "application/octet-stream" });
        if (error) throw new Error("Audio upload failed.");
        audioPath = path;
      }
      const data = {
        type, payload: p, audioPath,
        ageRange: ageRange || undefined, region: region || undefined,
        isAdult, identifiesAsBlack: isBlack, consentVersionId: wording.id, consent,
      };
      const res = mode === "test" ? await submitTest({ data }) : await submitPublic({ data });
      setDone({ code: res.withdrawalCode, isTest: res.isTest });
      onSaved?.();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Something went wrong."]);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-lg border border-primary/30 bg-secondary/50 p-6">
        <p className="font-semibold text-primary">{done.isTest ? "Test submission saved (marked as test)" : "Thank you — your contribution was received"}</p>
        <p className="mt-2 text-sm">Your private withdrawal reference. It is shown only once, so save it now:</p>
        <p className="mt-2 select-all break-all rounded bg-background p-3 font-mono text-lg">{done.code}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <section className="space-y-5">
        {type === "words" && (<>
          <Field id="title" label="Title (optional)"><Input id="title" maxLength={200} value={p.title ?? ""} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field id="body" label="Your writing" hint="20 to 10,000 characters."><Textarea id="body" rows={10} maxLength={10000} value={p.body ?? ""} onChange={(e) => set("body", e.target.value)} /></Field>
          <fieldset>
            <legend className="text-sm font-medium">Topics (optional)</legend>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TOPIC_TAGS.map((t) => (
                <Check key={t} id={`tag-${t}`} checked={p.tags.includes(t)} onChange={(v) => set("tags", v ? [...p.tags, t] : p.tags.filter((x: string) => x !== t))}>{t}</Check>
              ))}
            </div>
          </fieldset>
        </>)}
        {type === "voice" && (<>
          <Field id="audio" label="Audio file" hint="mp3, m4a, wav or webm. 10 MB max. Stored privately.">
            <Input id="audio" type="file" accept=".mp3,.m4a,.wav,.webm,audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          <Field id="description" label="Short description (optional)"><Textarea id="description" maxLength={1000} value={p.description ?? ""} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field id="language_notes" label="Spoken language or dialect notes (optional)"><Input id="language_notes" maxLength={500} value={p.language_notes ?? ""} onChange={(e) => set("language_notes", e.target.value)} /></Field>
        </>)}
        {type === "language" && (<>
          <Field id="expression" label="Expression"><Input id="expression" maxLength={300} value={p.expression ?? ""} onChange={(e) => set("expression", e.target.value)} /></Field>
          <Field id="meaning" label="What it means"><Textarea id="meaning" maxLength={2000} value={p.meaning ?? ""} onChange={(e) => set("meaning", e.target.value)} /></Field>
          <Field id="context" label="Where, when and by whom it's used"><Textarea id="context" maxLength={2000} value={p.context ?? ""} onChange={(e) => set("context", e.target.value)} /></Field>
          <Field id="tone" label="Tone or situation">
            <select id="tone" className={selectCls} value={p.tone ?? ""} onChange={(e) => set("tone", e.target.value || undefined)}>
              <option value="">Choose…</option>{TONES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          {p.tone === "other" && <Field id="tone_other" label="Describe the tone"><Input id="tone_other" maxLength={200} value={p.tone_other ?? ""} onChange={(e) => set("tone_other", e.target.value)} /></Field>}
          <Field id="example" label="Example sentence (optional)"><Input id="example" maxLength={1000} value={p.example ?? ""} onChange={(e) => set("example", e.target.value)} /></Field>
        </>)}
        {type === "ai_society" && (<>
          <p className="text-sm text-muted-foreground">Answer any you like — at least one.</p>
          {AI_PROMPTS.map(([k, q]) => (
            <Field key={k} id={k} label={q}><Textarea id={k} maxLength={5000} value={(p[k] as string | undefined) ?? ""} onChange={(e) => set(k, e.target.value)} /></Field>
          ))}
        </>)}
      </section>

      <section className="grid gap-5 sm:grid-cols-2">
        <Field id="age" label="Age range (optional)">
          <select id="age" className={selectCls} value={ageRange} onChange={(e) => setAgeRange(e.target.value)}>
            <option value="">Prefer not to say</option>{AGE_RANGES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
        <Field id="region" label="Broad region (optional)">
          <select id="region" className={selectCls} value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Prefer not to say</option>{REGIONS.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
          </select>
        </Field>
      </section>

      <fieldset className="space-y-3 rounded-lg border border-border p-5">
        <legend className="px-1 font-semibold text-primary">Eligibility (required)</legend>
        <p className="text-sm text-muted-foreground">{wording.eligibility_text}</p>
        <Check id="adult" checked={isAdult} onChange={setIsAdult}>I am 18 or older.</Check>
        <Check id="black" checked={isBlack} onChange={setIsBlack}>I identify as Black (including African, African American, Afro-Caribbean, Afro-Latino, and all people of the African diaspora).</Check>
        <Check id="own-thoughts" checked={ownThoughts} onChange={setOwnThoughts}>These are my own thoughts and words. AI may only help me articulate them; communication or literacy barriers are part of being human and are welcome here.</Check>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-border p-5">
        <legend className="px-1 font-semibold text-primary">How your contribution may be used</legend>
        <p className="text-sm text-muted-foreground">Each choice is separate and starts unchecked. Consent wording {wording.version_label}.</p>
        <Check id="c-research" checked={consent.research_analysis} onChange={(v) => setC("research_analysis", v)}><strong>Research analysis (required).</strong> {wording.research_analysis_text}</Check>
        {type === "voice" && (<>
          <Check id="c-audio" checked={consent.audio} onChange={(v) => setC("audio", v)}><strong>Audio (required with audio).</strong> {wording.audio_text}</Check>
          <Check id="c-transcription" checked={consent.transcription} disabled={!consent.audio} onChange={(v) => setC("transcription", v)}><strong>Transcription (optional).</strong> {wording.transcription_text}</Check>
        </>)}
        <Check id="c-eval" checked={consent.ai_evaluation} onChange={(v) => setC("ai_evaluation", v)}><strong>AI evaluation (optional).</strong> {wording.ai_evaluation_text}</Check>
        <Check id="c-train" checked={consent.ai_training} onChange={(v) => setC("ai_training", v)}><strong>AI training (optional).</strong> {wording.ai_training_text}</Check>
        <Check id="c-public" checked={consent.public_excerpts} onChange={(v) => setC("public_excerpts", v)}><strong>Public excerpts (optional).</strong> {wording.public_excerpts_text}</Check>
      </fieldset>

      {errors.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-4 pl-8 text-sm text-destructive">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      <Button type="submit" disabled={busy || !canSubmit} size="lg">
        {busy ? "Saving…" : mode === "test" ? "Save test submission" : canSubmit ? "Submit contribution" : "Submissions not open yet"}
      </Button>
      <VoiceDictation onTranscript={(t) => {
        const append = (key: string) => set(key, (typeof p[key] === 'string' && p[key] ? p[key] + ' ' : '') + t);
        if (type === 'words') append('body');
        else if (type === 'voice') append('description');
        else if (type === 'language') append('meaning');
        else if (type === 'ai_society') append('experiences');
      }} />
    </form>
  );
}
