/**
 * Normalises a free-text search query before it is recorded as a trending term.
 *
 * Voice search hands us whole spoken sentences ("show me red cotton sarees please"), which make
 * terrible trending chips. `null` means "serve the search, but do not record it": the caller skips
 * the SearchTerm upsert. Pure and dependency-free so it can be unit tested without a database.
 */

/** Matches the column budget the SearchTerm upsert has always truncated to. */
export const MAX_TERM_LENGTH = 60;
export const MIN_TERM_LENGTH = 2;
/** Anything wordier than this is prose, not a search term. */
export const MAX_TERM_WORDS = 6;

/** Leading phrases a shopper speaks before the query itself. Longest first, so "show me" beats "show". */
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

export function normalizeSearchTerm(raw: string): string | null {
  let term = trimEdges(raw.toLowerCase().replace(/\s+/g, " "));

  // One layer each way: shoppers rarely stack filler, and stripping greedily would eat real words.
  for (const prefix of FILLER_PREFIXES) {
    // Pure filler with no query attached ("show me") is not a search term at all.
    if (term === prefix) return null;
    if (term.startsWith(`${prefix} `)) {
      term = term.slice(prefix.length + 1);
      break;
    }
  }
  for (const suffix of FILLER_SUFFIXES) {
    if (term.endsWith(` ${suffix}`)) {
      term = term.slice(0, -(suffix.length + 1));
      break;
    }
  }

  term = trimEdges(term);
  if (term.length < MIN_TERM_LENGTH || term.length > MAX_TERM_LENGTH) return null;
  if (term.split(" ").length > MAX_TERM_WORDS) return null;
  return term;
}
