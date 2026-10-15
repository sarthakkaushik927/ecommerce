import { describe, expect, it } from "vitest";
import { MAX_TERM_LENGTH, normalizeSearchTerm } from "../../src/modules/products/search-term.js";

describe("normalizeSearchTerm", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeSearchTerm("  Red   SAREES ")).toBe("red sarees");
  });

  it("strips the sentence punctuation speech recognition leaves behind", () => {
    expect(normalizeSearchTerm("basmati rice!")).toBe("basmati rice");
    expect(normalizeSearchTerm("toor dal.")).toBe("toor dal");
    expect(normalizeSearchTerm("“amul butter”")).toBe("amul butter");
  });

  it("strips spoken filler prefixes", () => {
    expect(normalizeSearchTerm("Show me red cotton sarees")).toBe("red cotton sarees");
    expect(normalizeSearchTerm("search for toor dal")).toBe("toor dal");
    expect(normalizeSearchTerm("I'm looking for a gas stove")).toBe("a gas stove");
    expect(normalizeSearchTerm("dikhao atta")).toBe("atta");
  });

  it("strips trailing politeness", () => {
    expect(normalizeSearchTerm("basmati rice please")).toBe("basmati rice");
    expect(normalizeSearchTerm("Amul butter, thanks")).toBe("amul butter");
  });

  it("only strips filler that is a whole word", () => {
    expect(normalizeSearchTerm("shower gel")).toBe("shower gel");
    expect(normalizeSearchTerm("finder scope")).toBe("finder scope");
  });

  it("preserves non-Latin scripts", () => {
    expect(normalizeSearchTerm("दूध")).toBe("दूध");
    expect(normalizeSearchTerm("बासमती चावल")).toBe("बासमती चावल");
  });

  it("rejects prose so it never reaches the trending chips", () => {
    expect(normalizeSearchTerm("show me some nice red cotton sarees for diwali")).toBeNull();
    expect(normalizeSearchTerm("what is the cheapest washing machine you have")).toBeNull();
  });

  it("rejects filler with no query attached", () => {
    expect(normalizeSearchTerm("show me")).toBeNull();
    expect(normalizeSearchTerm("search")).toBeNull();
  });

  it("rejects input that is empty or too short to be useful", () => {
    expect(normalizeSearchTerm("")).toBeNull();
    expect(normalizeSearchTerm("   ")).toBeNull();
    expect(normalizeSearchTerm("a")).toBeNull();
    expect(normalizeSearchTerm("?")).toBeNull();
  });

  it("rejects a term longer than the storage budget", () => {
    expect(normalizeSearchTerm("x".repeat(MAX_TERM_LENGTH))).toBe("x".repeat(MAX_TERM_LENGTH));
    expect(normalizeSearchTerm("x".repeat(MAX_TERM_LENGTH + 1))).toBeNull();
  });
});
