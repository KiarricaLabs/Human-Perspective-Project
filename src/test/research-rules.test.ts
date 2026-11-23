import { describe, expect, it } from 'vitest';
import { EMPTY_CONSENT } from '@/lib/contribution-rules';
import { participantSchema, purposeAllowed, reviewSchema, updateProblems } from '@/lib/research-rules';
describe('research safeguards', () => {
  it('evaluation permission never permits training', () => { const c = { ...EMPTY_CONSENT, research_analysis: true, ai_evaluation: true }; expect(purposeAllowed(c, 'evaluation')).toBe(true); expect(purposeAllowed(c, 'training')).toBe(false); });
  it('training permission never permits public excerpts', () => { const c = { ...EMPTY_CONSENT, research_analysis: true, ai_training: true }; expect(purposeAllowed(c, 'training')).toBe(true); expect(purposeAllowed(c, 'public')).toBe(false); });
  it('research refusal blocks every purpose', () => { const c = { ...EMPTY_CONSENT, ai_training: true, ai_evaluation: true, public_excerpts: true }; for (const p of ['evaluation', 'training', 'public'] as const) expect(purposeAllowed(c, p)).toBe(false); });
  it('permits withdrawing audio consent on an update', () => expect(updateProblems({ ...EMPTY_CONSENT, research_analysis: true }, true)).toEqual([]));
  it('requires audio permission for transcription', () => expect(updateProblems({ ...EMPTY_CONSENT, transcription: true }, true)).toHaveLength(1));
  it('blocks audio permissions without audio', () => expect(updateProblems({ ...EMPTY_CONSENT, audio: true }, false)).toHaveLength(1));
  it('requires a complete private reference', () => expect(participantSchema.safeParse({ reference: 'HPP-1234', action: 'read' }).success).toBe(false));
  it('requires version and independent permissions for an update', () => expect(participantSchema.safeParse({ reference: 'HPP-ABCD-EFGH-JKMN-PQRS', action: 'update' }).success).toBe(false));
  it('requires text before confirming de-identification', () => expect(reviewSchema.safeParse({ submissionId: '00000000-0000-4000-8000-000000000001', note: '', text: '', deidentified: true }).success).toBe(false));
});
