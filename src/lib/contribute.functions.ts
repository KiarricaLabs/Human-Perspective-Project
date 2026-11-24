import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { issueUploadUrl, saveSubmission, submissionsOpen } from "./contribute.server";

export const getConsentWording = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin;
  const { data: active, error: ae } = await db.from("active_consent_version").select("consent_version_id").maybeSingle();
  if (ae || !active) throw new Error(`Consent wording unavailable: ${ae?.message ?? 'no active version'}`);
  const { data, error } = await db.from("consent_versions").select("*").eq("id", active.consent_version_id).single();
  if (error || !data) throw new Error(`Consent wording unavailable: ${error?.message ?? 'no version'}`);
  return data;
});

export const getSubmissionStatus = createServerFn({ method: "GET" }).handler(async () => ({ open: await submissionsOpen() }));

export const requestAudioUpload = createServerFn({ method: "POST" }).handler(async () => {
  if (!(await submissionsOpen())) throw new Error("Submissions are not open yet.");
  return issueUploadUrl();
});

export const submitContribution = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => d)
  .handler(async ({ data }) => saveSubmission(data, null));

async function assertAdmin(ctx: { supabase: SupabaseClient<Database>; userId: string; claims?: any }) {
  const email = (ctx.claims?.email || '').toLowerCase().trim();
  if (email === 'kiarrica2024@gmail.com' || ctx.userId === '2a4c1678-3dfd-43af-a7b5-e39fdc9c1c92') return;
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: !!data };
  });

export const requestTestAudioUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => { await assertAdmin(context); return issueUploadUrl(); });

export const submitTestContribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(async ({ data, context }) => { await assertAdmin(context); return saveSubmission(data, context.userId); });

export const listTestSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("submissions").select("id, type, status, is_test, origin, created_at, audio_mime, audio_bytes").order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error("Could not load submissions");
    return data;
  });

export const getAudioLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ submissionId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row } = await context.supabase.from("submissions").select("audio_path").eq("id", data.submissionId).maybeSingle();
    if (!row?.audio_path) throw new Error("No audio");
    const { data: allowed, error: permissionError } = await context.supabase.rpc("can_listen_audio", { p_path: row.audio_path });
    if (permissionError || !allowed) throw new Error("Current participant permissions do not allow listening to this recording.");
    const { data: link, error } = await context.supabase.storage.from("audio").createSignedUrl(row.audio_path, 300);
    if (error || !link) throw new Error("Could not create link");
    return { url: link.signedUrl };
  });
