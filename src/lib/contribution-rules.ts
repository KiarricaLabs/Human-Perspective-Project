import { z } from "zod";

export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const CONTRIBUTION_TYPES = ["words", "voice", "language", "ai_society"] as const;
export type ContributionType = (typeof CONTRIBUTION_TYPES)[number];

export const TYPE_INFO: Record<ContributionType, { slug: string; title: string; blurb: string }> = {
  words: { slug: "words", title: "Share Your Words", blurb: "Write a story, reflection, or example of how you speak and express yourself." },
  voice: { slug: "voice", title: "Share Your Voice", blurb: "Upload a short audio clip. Audio is stored privately and only with your separate consent." },
  language: { slug: "language", title: "Language & Culture", blurb: "Explain an expression, what it means, and where and how it's used." },
  ai_society: { slug: "ai-society", title: "AI & Society", blurb: "Tell us about your experiences with AI and the future you want." },
};
export function typeFromSlug(slug: string): ContributionType | null {
  return (Object.keys(TYPE_INFO) as ContributionType[]).find((t) => TYPE_INFO[t].slug === slug) ?? null;
}

export const TOPIC_TAGS = ["family", "faith", "work", "school", "music", "food", "humor", "place", "history", "identity", "other"] as const;
export const TONES = ["casual", "playful", "serious", "affectionate", "sarcastic", "formal", "other"] as const;
export const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"] as const;
export const REGIONS = ["south", "northeast", "midwest", "west", "outside_us"] as const;
export const AI_PROMPTS = [
  ["experiences", "What experiences have you had with AI tools?"],
  ["concerns", "What concerns you about AI?"],
  ["opportunities", "What opportunities do you see?"],
  ["questions", "What questions do you have about AI?"],
  ["hopes", "What do you hope the future of AI looks like?"],
] as const;

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const payloadSchemas = {
  words: z.object({
    title: opt(200),
    body: z.string().trim().min(20, "Please write at least 20 characters").max(10000),
    tags: z.array(z.enum(TOPIC_TAGS)).max(TOPIC_TAGS.length).optional(),
  }),
  voice: z.object({ description: opt(1000), language_notes: opt(500) }),
  language: z
    .object({
      expression: z.string().trim().min(1, "Required").max(300),
      meaning: z.string().trim().min(1, "Required").max(2000),
      context: z.string().trim().min(1, "Required").max(2000),
      tone: z.enum(TONES),
      tone_other: opt(200),
      example: opt(1000),
    })
    .refine((v) => v.tone !== "other" || !!v.tone_other, { message: "Describe the tone", path: ["tone_other"] }),
  ai_society: z
    .object(Object.fromEntries(AI_PROMPTS.map(([k]) => [k, opt(5000)])) as Record<(typeof AI_PROMPTS)[number][0], ReturnType<typeof opt>>)
    .refine((v) => Object.values(v).some(Boolean), { message: "Answer at least one question" }),
} as const;

export const consentSchema = z.object({
  research_analysis: z.boolean(),
  audio: z.boolean(),
  transcription: z.boolean(),
  ai_evaluation: z.boolean(),
  ai_training: z.boolean(),
  public_excerpts: z.boolean(),
});
export type Consent = z.infer<typeof consentSchema>;
export const EMPTY_CONSENT: Consent = { research_analysis: false, audio: false, transcription: false, ai_evaluation: false, ai_training: false, public_excerpts: false };

/** Returns a list of problems; empty means the combination is allowed. */
export function consentProblems(c: Consent, hasAudio: boolean): string[] {
  const p: string[] = [];
  if (!c.research_analysis) p.push("Research analysis consent is required to take part.");
  if (hasAudio && !c.audio) p.push("Audio consent is required when you attach audio.");
  if (!hasAudio && (c.audio || c.transcription)) p.push("Audio and transcription consent only apply when audio is attached.");
  if (c.transcription && !c.audio) p.push("Transcription requires audio consent.");
  return p;
}

export const submissionSchema = z.object({
  type: z.enum(CONTRIBUTION_TYPES),
  payload: z.record(z.unknown()),
  audioPath: z.string().regex(/^incoming\/[0-9a-f-]{36}$/).optional(),
  ageRange: z.enum(AGE_RANGES).optional(),
  region: z.enum(REGIONS).optional(),
  isAdult: z.literal(true, { errorMap: () => ({ message: "You must confirm you are 18 or older" }) }),
  identifiesAsBlack: z.literal(true, { errorMap: () => ({ message: "You must confirm you identify as Black" }) }),
  consentVersionId: z.string().uuid(),
  consent: consentSchema,
});
export type SubmissionInput = z.infer<typeof submissionSchema>;

/** Full server-side validation of a submission (besides audio content). */
export function validateSubmission(raw: unknown) {
  const base = submissionSchema.parse(raw);
  const payload = payloadSchemas[base.type].parse(base.payload);
  if ((base.type === "voice") !== !!base.audioPath) throw new Error("Audio is required for voice, and only allowed there.");
  const problems = consentProblems(base.consent, !!base.audioPath);
  if (problems.length) throw new Error(problems.join(" "));
  return { ...base, payload };
}

/** Detects audio format from the file's first bytes, ignoring its name. */
export function sniffAudio(b: Uint8Array): "audio/mpeg" | "audio/mp4" | "audio/wav" | "audio/webm" | null {
  const s = (o: number, str: string) => [...str].every((ch, i) => b[o + i] === ch.charCodeAt(0));
  if (b.length < 12) return null;
  if (s(0, "ID3") || (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0)) return "audio/mpeg";
  if (s(4, "ftyp")) return "audio/mp4";
  if (s(0, "RIFF") && s(8, "WAVE")) return "audio/wav";
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "audio/webm";
  return null;
}

export function checkAudio(bytes: Uint8Array): { mime: string; size: number } {
  if (bytes.byteLength === 0) throw new Error("The audio file is empty.");
  if (bytes.byteLength > MAX_AUDIO_BYTES) throw new Error("Audio must be 10 MB or smaller.");
  const mime = sniffAudio(bytes);
  if (!mime) throw new Error("This file is not a supported audio format (mp3, m4a, wav, webm).");
  return { mime, size: bytes.byteLength };
}
