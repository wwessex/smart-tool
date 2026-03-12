/**
 * Types for the rule-based phrase/word dictionary system.
 *
 * Each supported language pair has a PhraseDictionary containing
 * multi-word phrases, single words, and regex time-expression patterns.
 * Entries are matched longest-first to avoid partial substitution.
 */

/** A single dictionary entry mapping a source phrase to its translation. */
export interface DictionaryEntry {
  /** Source phrase in English (lowercase for matching). */
  src: string;
  /** Target phrase in the destination language. */
  tgt: string;
  /** Optional part-of-speech hint for future grammar handling. */
  pos?: "verb" | "noun" | "phrase" | "connector" | "time";
}

/** Regex-based time expression pattern with a replacement template. */
export interface TimePattern {
  /** Regex pattern string (applied with "gi" flags). Uses $1, $2 capture groups. */
  pattern: string;
  /** Replacement template using $1, $2 for captured groups. */
  replace: string;
}

/** Complete dictionary for one directional language pair. */
export interface PhraseDictionary {
  /** Language pair ID (e.g., "en-de"). */
  pair: string;
  /** Multi-word phrases — matched FIRST (longest first). */
  phrases: DictionaryEntry[];
  /** Single words — matched AFTER phrases. */
  words: DictionaryEntry[];
  /** Regex-based time expression patterns (applied before phrase/word matching). */
  timePatterns?: TimePattern[];
}
