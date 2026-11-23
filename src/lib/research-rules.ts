import { z } from "zod";
import { consentSchema, type Consent } from "./contribution-rules";

export const purposeSchema = z.enum(["evaluation", "training", "public"]);
export type Purpose = z.infer<typeof purposeSchema>;
export const referenceSchema = z.string().trim().transform((v) => v.toUpperCase()).pipe(z.string().regex(/^HPP-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/, "Enter your complete private reference."));
export const participantSchema = z.object({ reference: referenceSchema, action: z.enum(["read", "withdraw", "update"]), version: z.string().uuid().optional(), consent: consentSchema.optional() }).superRefine((v, ctx) => {
  if (v.action === "update" && (!v.version || !v.consent)) ctx.addIssue({ code: "custom", message: "Permissions and wording version are required." });
});
export const reviewSchema = z.object({ submissionId: z.string().uuid(), note: z.string().trim().max(10000), text: z.string().trim().max(20000), deidentified: z.boolean() }).refine((v) => !v.deidentified || v.text.length > 0, "De-identified text is required.");
export function purposeAllowed(c: Consent, purpose: Purpose) {
  return c.research_analysis && (purpose === "evaluation" ? c.ai_evaluation : purpose === "training" ? c.ai_training : c.public_excerpts);
}
export function updateProblems(c: Consent, hasAudio: boolean) {
  if (!hasAudio && (c.audio || c.transcription)) return ["Audio permissions require an attached recording."];
  if (c.transcription && !c.audio) return ["Transcription requires audio permission."];
  return [];
}