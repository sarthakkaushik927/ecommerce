/**
 * Turns a raw speech transcript into something the catalog search can actually match.
 *
 * Mirrors `backend/src/modules/products/search-term.ts`, but client-side and forgiving: the shopper
 * sees the result in the search box and can edit it, so this only tidies, it never rejects. It
 * matters because the backend matches `q` against product/brand/category names — an unstripped
 * "show me red sarees" would find nothing.
 *
 * Pure and dependency-free, so it is testable without the native speech module.
 */

/** `q` is capped at 100 in productListQuery and suggestionsQuery; longer comes back 422. */
export const MAX_QUERY_LENGTH = 100;

export const VOICE_LOCALES = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी" },
] as const;

export type VoiceLocale = (typeof VOICE_LOCALES)[number]["code"];

export const DEFAULT_VOICE_LOCALE: VoiceLocale = "en-IN";

export function isVoiceLocale(value: string | null | undefined): value is VoiceLocale {
  return VOICE_LOCALES.some((locale) => locale.code === value);
}

/** Leading phrases a shopper speaks before the query. Longest first, so "show me" beats "show". */
const FILLER_PREFIXES = [
  "can you show me",
  "i am looking for",
  "i'm looking for",
  "please show me",
  "i want to buy",
  "looking for",
  "search for",
  "i need",
  "i want",
  "show me",
  "find me",
  "dikha do",
  "search",
  "dikhao",
  "find",
  "show",
] as const;

const FILLER_SUFFIXES = ["please", "thanks", "thank you"] as const;

/** Sentence punctuation only — Devanagari and every other script must survive untouched. */
const EDGE_PUNCTUATION = /^[\s.,!?;:'"“”‘’()[\]{}-]+|[\s.,!?;:'"“”‘’()[\]{}-]+$/g;

function trimEdges(value: string): string {
  return value.replace(EDGE_PUNCTUATION, "");
}

/** Original casing is preserved for display; only filler matching is case-insensitive. */
export function normalizeTranscript(raw: string): string {
  let value = trimEdges(raw.replace(/\s+/g, " "));

  const lower = value.toLowerCase();
  for (const prefix of FILLER_PREFIXES) {
    // Filler with no query attached is not worth searching for.
    if (lower === prefix) return "";
    if (lower.startsWith(`${prefix} `)) {
      value = value.slice(prefix.length + 1);
      break;
    }
  }

  const lowerValue = value.toLowerCase();
  for (const suffix of FILLER_SUFFIXES) {
    if (lowerValue.endsWith(` ${suffix}`)) {
      value = value.slice(0, -(suffix.length + 1));
      break;
    }
  }

  value = trimEdges(value);
  if (value.length <= MAX_QUERY_LENGTH) return value;

  // Cut on a word boundary so the query never ends mid-word.
  const cut = value.slice(0, MAX_QUERY_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return trimEdges(lastSpace > 0 ? cut.slice(0, lastSpace) : cut);
}
