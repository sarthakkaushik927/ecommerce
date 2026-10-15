import { MAX_QUERY_LENGTH, isVoiceLocale, normalizeTranscript } from "@/lib/voice-query";

describe("normalizeTranscript", () => {
  it("collapses whitespace but keeps the shopper's casing", () => {
    expect(normalizeTranscript("  Amul   Butter ")).toBe("Amul Butter");
    expect(normalizeTranscript("Samsung TV")).toBe("Samsung TV");
  });

  it("strips the punctuation speech recognition adds", () => {
    expect(normalizeTranscript("basmati rice.")).toBe("basmati rice");
    expect(normalizeTranscript("toor dal?")).toBe("toor dal");
  });

  it("strips spoken filler so the query actually matches product names", () => {
    expect(normalizeTranscript("Show me red cotton sarees")).toBe("red cotton sarees");
    expect(normalizeTranscript("search for toor dal")).toBe("toor dal");
    expect(normalizeTranscript("I'm looking for a gas stove")).toBe("a gas stove");
    expect(normalizeTranscript("dikhao atta")).toBe("atta");
  });

  it("strips trailing politeness", () => {
    expect(normalizeTranscript("basmati rice please")).toBe("basmati rice");
    expect(normalizeTranscript("Amul butter, thanks")).toBe("Amul butter");
  });

  it("only strips filler that is a whole word", () => {
    expect(normalizeTranscript("shower gel")).toBe("shower gel");
    expect(normalizeTranscript("finder scope")).toBe("finder scope");
  });

  it("preserves Devanagari for hi-IN dictation", () => {
    expect(normalizeTranscript("बासमती चावल")).toBe("बासमती चावल");
  });

  it("returns empty for filler with no query attached", () => {
    expect(normalizeTranscript("show me")).toBe("");
    expect(normalizeTranscript("")).toBe("");
    expect(normalizeTranscript("   ")).toBe("");
  });

  it("caps at the backend query limit on a word boundary", () => {
    const long = "stainless steel pressure cooker ".repeat(10).trim();
    const result = normalizeTranscript(long);
    expect(result.length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);
    // Never ends mid-word, so the trimmed query still matches real product names.
    expect(result.endsWith("cooker")).toBe(true);
  });
});

describe("isVoiceLocale", () => {
  it("accepts the supported locales only", () => {
    expect(isVoiceLocale("en-IN")).toBe(true);
    expect(isVoiceLocale("hi-IN")).toBe(true);
    expect(isVoiceLocale("fr-FR")).toBe(false);
    expect(isVoiceLocale(null)).toBe(false);
    expect(isVoiceLocale(undefined)).toBe(false);
  });
});
