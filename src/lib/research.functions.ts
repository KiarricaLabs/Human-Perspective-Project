import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader, setResponseHeader } from '@tanstack/react-start/server';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { participantSchema, purposeSchema, reviewSchema } from './research-rules';

async function authorize(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (error || !data) throw new Error('This account does not have research team access.');
}
function checked<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) {
    console.error('Research action refused:', result.error.message);
    throw new Error('This action could not be completed. Check the current permissions, human review, and selected research purpose.');
  }
  return result.data;
}
export const researchWorkspace = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await authorize(context);
  setResponseHeader('Cache-Control', 'private, no-store');
  const db = context.supabase;
  const results = await Promise.all([
    db.from('submissions').select('id,type,payload,status,is_test,created_at,audio_mime').order('created_at', { ascending: false }),
    db.from('consent_records').select('*').order('seq', { ascending: false }),
    db.from('research_annotations').select('*').order('created_at', { ascending: false }),
    db.from('purpose_approvals').select('*'),
    db.from('withdrawal_requests').select('*').order('requested_at', { ascending: false }),
    db.from('research_exports').select('*').order('created_at', { ascending: false }),
    db.from('audit_log').select('id,action,entity,entity_id,created_at').order('id', { ascending: false }).limit(100),
    db.from('consent_versions').select('*'),
    db.from('app_settings').select('key,value').eq('key','submissions_open').maybeSingle(),
  ]);
  const setting = results[8]?.data; const open = setting ? (typeof setting.value === 'boolean' ? setting.value : setting.value === true || setting.value === 'true') : false; return { submissions: checked(results[0]) ?? [], consents: checked(results[1]) ?? [], annotations: checked(results[2]) ?? [], approvals: checked(results[3]) ?? [], withdrawals: checked(results[4]) ?? [], exports: checked(results[5]) ?? [], audit: checked(results[6]) ?? [], versions: checked(results[7]) ?? [], submissionsOpen: open };
});
export const saveReview = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(reviewSchema).handler(async ({ data, context }) => {
  await authorize(context);
  return checked(await context.supabase.rpc('save_human_review', { p_submission: data.submissionId, p_note: data.note, p_text: data.text, p_deidentified: data.deidentified }));
});
export const approvePurpose = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ submissionId: z.string().uuid(), purpose: purposeSchema, reason: z.string().trim().min(10).max(2000) })).handler(async ({ data, context }) => {
  await authorize(context);
  checked(await context.supabase.from('purpose_approvals').insert({ submission_id: data.submissionId, purpose: data.purpose, justification: data.reason, approved_by: context.userId }));
  return { ok: true };
});
export const revokeApproval = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
  await authorize(context);
  checked(await context.supabase.from('purpose_approvals').update({ revoked_at: new Date().toISOString() }).eq('id', data.id).is('revoked_at', null));
  return { ok: true };
});
export const processWithdrawal = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
  await authorize(context);
  checked(await context.supabase.from('withdrawal_requests').update({ status: 'processed', processed_at: new Date().toISOString(), processed_by: context.userId }).eq('id', data.id).eq('status', 'received'));
  return { ok: true };
});
export const toggleSubmissions = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ open: z.boolean() })).handler(async ({ data, context }) => {
  await authorize(context);
  checked(await context.supabase.from('app_settings').update({ value: data.open }).eq('key', 'submissions_open'));
  return { ok: true };
});
export const createExport = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ purpose: purposeSchema, notes: z.string().trim().max(2000), ids: z.array(z.string().uuid()).min(1).max(100) })).handler(async ({ data, context }) => {
  await authorize(context);
  return checked(await context.supabase.rpc('create_research_export', { p_purpose: data.purpose, p_notes: data.notes, p_submission_ids: [...new Set(data.ids)] }));
});
export const downloadExport = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ id: z.string().uuid() })).handler(async ({ data, context }) => {
  await authorize(context);
  setResponseHeader('Cache-Control', 'private, no-store');
  return checked(await context.supabase.rpc('download_research_export', { p_export: data.id }));
});
export const manageParticipation = createServerFn({ method: 'POST' }).inputValidator(participantSchema).handler(async ({ data }) => {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data.reference));
  const p_hash = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  setResponseHeader('Cache-Control', 'private, no-store');
  const networkHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`participation:${getRequestHeader('cf-connecting-ip') ?? 'local-preview'}`));
  const keyHash = [...new Uint8Array(networkHash)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const { data: permitted, error: limitError } = await supabaseAdmin.rpc('take_participant_request', { p_key_hash: keyHash });
  if (limitError || !permitted) throw new Error('Too many requests. Please wait ten minutes before trying again.');
  const { data: result, error } = await supabaseAdmin.rpc('manage_participation', { p_hash, p_action: data.action, p_version: data.version ?? (null as never), p_consent: data.consent ?? (null as never) });
  if (error) throw new Error('This reference or permission change could not be accepted. Check your reference; withdrawn contributions cannot be reopened.');
  return result;
});
