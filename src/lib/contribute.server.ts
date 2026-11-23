import { validateSubmission, checkAudio } from "./contribution-rules";

async function sha256Hex(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function newWithdrawalCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return `HPP-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}-${chars.slice(12, 16)}`;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function submissionsOpen(): Promise<boolean> {
  const db = await admin();
  const { data } = await db.from("app_settings").select("value").eq("key", "submissions_open").maybeSingle();
  return data?.value === true || data?.value === 'true';
}

export async function issueUploadUrl() {
  const db = await admin();
  const path = `incoming/${crypto.randomUUID()}`;
  const { data, error } = await db.storage.from("audio").createSignedUploadUrl(path);
  if (error || !data) throw new Error("Could not prepare a private upload.");
  return { path, token: data.token };
}

/** Validates, checks audio content, then saves atomically. adminId set => forced test submission. */
export async function saveSubmission(raw: unknown, adminId: string | null) {
  const input = validateSubmission(raw);
  const db = await admin();
  let audio: { mime: string; size: number } | null = null;
  const cleanup = async () => { if (input.audioPath) await db.storage.from("audio").remove([input.audioPath]); };

  if (input.audioPath) {
    const { data, error } = await db.storage.from("audio").download(input.audioPath);
    if (error || !data) throw new Error("The audio upload could not be found.");
    try { audio = checkAudio(new Uint8Array(await data.arrayBuffer())); }
    catch (e) { await cleanup(); throw e; }
  }

  const code = newWithdrawalCode();
  const { error } = await db.rpc("submit_contribution", {
    p_type: input.type,
    p_payload: input.payload as never,
    p_audio_path: input.audioPath ?? (null as never),
    p_audio_mime: audio?.mime ?? (null as never),
    p_audio_bytes: audio?.size ?? (null as never),
    p_age_range: input.ageRange ?? (null as never),
    p_region: input.region ?? (null as never),
    p_is_adult: input.isAdult,
    p_identifies_as_black: input.identifiesAsBlack,
    p_consent_version_id: input.consentVersionId,
    p_research_analysis: input.consent.research_analysis,
    p_audio: input.consent.audio,
    p_transcription: input.consent.transcription,
    p_ai_evaluation: input.consent.ai_evaluation,
    p_ai_training: input.consent.ai_training,
    p_public_excerpts: input.consent.public_excerpts,
    p_withdrawal_ref_hash: await sha256Hex(code),
    p_admin_id: adminId ?? (null as never),
  });
  if (error) {
    await cleanup();
    if (error.message.includes("closed")) throw new Error("Submissions are not open yet.");
    console.error("submit_contribution failed", error.message);
    throw new Error(error.message.includes("consent wording") ? "The consent wording changed. Please reload the page." : "Your contribution could not be saved.");
  }
  return { withdrawalCode: code, isTest: !!adminId };
}
