import { describe, expect, it } from "vitest";
import { checkAudio, consentProblems, EMPTY_CONSENT, MAX_AUDIO_BYTES, validateSubmission } from "@/lib/contribution-rules";

const base = {
  type: "words", payload: { body: "This is a long enough written piece." },
  isAdult: true, identifiesAsBlack: true,
  consentVersionId: "00000000-0000-4000-8000-000000000000",
  consent: { ...EMPTY_CONSENT, research_analysis: true },
};
const voice = { ...base, type: "voice", payload: {}, audioPath: "incoming/11111111-1111-4111-8111-111111111111" };

describe("consent rules", () => {
  it("requires research analysis", () => expect(consentProblems(EMPTY_CONSENT, false)).not.toHaveLength(0));
  it("requires audio consent when audio is attached", () => expect(consentProblems({ ...EMPTY_CONSENT, research_analysis: true }, true)).not.toHaveLength(0));
  it("audio consent alone does not imply transcription, and transcription needs audio consent", () => {
    expect(consentProblems({ ...EMPTY_CONSENT, research_analysis: true, audio: true }, true)).toEqual([]);
    expect(consentProblems({ ...EMPTY_CONSENT, research_analysis: true, transcription: true }, true).length).toBeGreaterThan(0);
  });
  it("rejects transcription without an audio file", () => expect(consentProblems({ ...EMPTY_CONSENT, research_analysis: true, audio: true, transcription: true }, false).length).toBeGreaterThan(0));
  it("allows evaluation without training, training without evaluation, and neither", () => {
    const r = { ...EMPTY_CONSENT, research_analysis: true };
    expect(consentProblems({ ...r, ai_evaluation: true }, false)).toEqual([]);
    expect(consentProblems({ ...r, ai_training: true }, false)).toEqual([]);
    expect(consentProblems(r, false)).toEqual([]);
  });
});

describe("server validation", () => {
  it("rejects missing eligibility", () => {
    expect(() => validateSubmission({ ...base, isAdult: false })).toThrow();
    expect(() => validateSubmission({ ...base, identifiesAsBlack: false })).toThrow();
  });
  it("rejects voice without audio and audio on other types", () => {
    expect(() => validateSubmission({ ...base, type: "voice", payload: {} })).toThrow();
    expect(() => validateSubmission({ ...base, audioPath: voice.audioPath })).toThrow();
  });
  it("requires all language fields", () => expect(() => validateSubmission({ ...base, type: "language", payload: { expression: "x" } })).toThrow());
  it("requires at least one AI & Society answer", () => expect(() => validateSubmission({ ...base, type: "ai_society", payload: {} })).toThrow());
  it("rejects an audio path the server did not issue", () => expect(() => validateSubmission({ ...voice, audioPath: "../other/file" })).toThrow());
});

describe("audio checks", () => {
  const wav = new Uint8Array([..."RIFF"].map((c) => c.charCodeAt(0)).concat([0, 0, 0, 0], [..."WAVE"].map((c) => c.charCodeAt(0))));
  it("accepts a real wav by content", () => expect(checkAudio(wav).mime).toBe("audio/wav"));
  it("rejects files over 10 MB", () => {
    const big = new Uint8Array(MAX_AUDIO_BYTES + 1); big.set(wav);
    expect(() => checkAudio(big)).toThrow(/10 MB/);
  });
  it("rejects a renamed non-audio file", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(() => checkAudio(png)).toThrow(/not a supported/);
  });
});
