/**
 * Rule-based translator for domain-specific SMART action text.
 *
 * Uses phrase/word dictionaries to perform substitution-based translation
 * when ONNX models are not available. Designed for the employment services
 * SMART action domain — not general-purpose translation.
 *
 * Translation flow:
 * 1. Apply time-expression regex patterns (before entity protection,
 *    so numbers in "in 2 weeks" are matched before being captured)
 * 2. Protect entities (names, dates, numbers, URLs, acronyms)
 * 3. Apply multi-word phrase substitutions (longest-first)
 * 4. Apply single-word substitutions (longest-first)
 * 5. Restore protected entities
 * 6. Apply RTL marks for right-to-left languages
 */

import type { PhraseDictionary } from "../dictionaries/types.js";
import { getDictionary, hasDictionary } from "../dictionaries/index.js";
import { isRTL } from "../models/registry.js";
import type { LanguagePairId } from "../types.js";

// Sentinel token for protected entities (distinct from \uFFF0 used in text-chunker)
const ENTITY_START = "\uFFF1";
const ENTITY_END = "\uFFF1";
const PHRASE_START = "\uFFF2";
const PHRASE_END = "\uFFF2";

// Unicode bidi marks
const RLM = "\u200F"; // Right-to-Left Mark
const LRI = "\u2066"; // Left-to-Right Isolate
const PDI = "\u2069"; // Pop Directional Isolate

// Common acronyms that should pass through untranslated
const ACRONYMS = new Set([
  "CV", "ESOL", "STAR", "ID", "ADHD", "DBS", "NI", "UK", "NHS",
  "GP", "GCSE", "NVQ", "IT", "PC", "USB", "PDF", "PIN",
]);

// Date patterns: 25-Jan-26, 20/02/2026, 2026-01-20, 15 January 2026
const DATE_PATTERN = /\b\d{1,2}[-/]\w{3,9}[-/]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{2,4}\b/gi;

// URL/email pattern — uses [^\s]+ (possessive-style via atomic groups not available,
// so we use bounded character classes to avoid polynomial backtracking)
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s]{1,200}|\b[^\s@]{1,100}@[^\s.]{1,100}\.[^\s]{1,100}|\b[a-zA-Z0-9][-a-zA-Z0-9]{0,62}\.(?:co\.uk|org\.uk|gov\.uk|com|org|net)\b/gi;

// Number with optional unit: "3 warehouse roles", "£50", "5 miles"
const NUMBER_PATTERN = /\b\d+(?:\.\d+)?(?:\s*(?:%|£|€|\$|miles?|km|hours?|days?|minutes?))?/gi;

/** Escape special regex characters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Protect entities that should not be translated.
 * Returns the text with entities replaced by sentinel tokens,
 * and a restore function to put them back.
 */
function protectEntities(text: string): {
  cleaned: string;
  restore: (translated: string) => string;
} {
  const entities: string[] = [];

  function capture(match: string): string {
    const idx = entities.length;
    entities.push(match);
    return `${ENTITY_START}${idx}${ENTITY_END}`;
  }

  let result = text;

  // Protect URLs/emails first (before other patterns consume parts of them)
  result = result.replace(URL_PATTERN, capture);

  // Protect dates
  result = result.replace(DATE_PATTERN, capture);

  // Protect standalone numbers with units (skip digits inside sentinel tokens)
  result = result.replace(NUMBER_PATTERN, (match, offset) => {
    // Don't capture numbers that are part of entity sentinel tokens
    if (
      (offset > 0 && result[offset - 1] === ENTITY_START) ||
      (offset + match.length < result.length && result[offset + match.length] === ENTITY_END)
    ) {
      return match;
    }
    return capture(match);
  });

  // Protect acronyms (uppercase 2+ letter words)
  result = result.replace(/\b[A-Z]{2,}\b/g, (match) => {
    if (ACRONYMS.has(match)) return capture(match);
    return match;
  });

  // Protect the participant name (first word before "will" or "has agreed" or "has discussed")
  result = result.replace(
    /^([A-Z][a-zA-Z'-]+)(?=\s+(?:will|has\s+agreed|has\s+discussed|commits?))/,
    capture
  );

  const restore = (translated: string): string => {
    return translated.replace(
      new RegExp(`${escapeRegex(ENTITY_START)}(\\d+)${escapeRegex(ENTITY_END)}`, "g"),
      (_, idxStr) => {
        const idx = parseInt(idxStr, 10);
        return entities[idx] ?? "";
      }
    );
  };

  return { cleaned: result, restore };
}

/**
 * Apply time-expression regex patterns to text.
 * Must be called BEFORE protectEntities() so that numbers in time
 * expressions (e.g., "in 2 weeks") are matched before being captured
 * as standalone number entities.
 */
function applyTimePatterns(text: string, dictionary: PhraseDictionary): string {
  if (!dictionary.timePatterns) return text;
  let result = text;
  for (const tp of dictionary.timePatterns) {
    try {
      result = result.replace(new RegExp(tp.pattern, "gi"), tp.replace);
    } catch {
      // Skip invalid regex patterns
    }
  }
  return result;
}

/**
 * Apply dictionary substitutions to text.
 * Phrases are matched before words, both in longest-first order.
 * Time patterns are applied separately via applyTimePatterns().
 */
function applyDictionary(text: string, dictionary: PhraseDictionary): string {
  let result = text;
  const protectedPhrases: string[] = [];

  // Apply phrase substitutions (longest first)
  const sortedPhrases = [...dictionary.phrases].sort(
    (a, b) => b.src.length - a.src.length
  );
  for (const entry of sortedPhrases) {
    const pattern = new RegExp(`\\b${escapeRegex(entry.src)}\\b`, "gi");
    result = result.replace(pattern, () => {
      const idx = protectedPhrases.length;
      protectedPhrases.push(entry.tgt);
      return `${PHRASE_START}${idx}${PHRASE_END}`;
    });
  }

  // Apply word substitutions (longest first)
  const sortedWords = [...dictionary.words].sort(
    (a, b) => b.src.length - a.src.length
  );
  for (const entry of sortedWords) {
    const pattern = new RegExp(`\\b${escapeRegex(entry.src)}\\b`, "gi");
    result = result.replace(pattern, entry.tgt);
  }

  result = result.replace(
    new RegExp(`${escapeRegex(PHRASE_START)}(\\d+)${escapeRegex(PHRASE_END)}`, "g"),
    (_, idxStr: string) => protectedPhrases[Number.parseInt(idxStr, 10)] ?? ""
  );

  return result;
}

/**
 * Apply RTL bidi marks for right-to-left target languages.
 * Wraps preserved LTR entities (names, dates, numbers) in LTR isolates.
 */
function applyRTLMarks(text: string): string {
  // Add RLM at the start
  let result = RLM + text;

  // Wrap any remaining Latin-script sequences (protected entities that were restored)
  // in LTR isolate marks to prevent visual reordering
  result = result.replace(/([A-Za-z0-9][\w\s./@:-]*[A-Za-z0-9])/g, `${LRI}$1${PDI}`);

  return result;
}

/**
 * Rule-based translator using domain-specific phrase/word dictionaries.
 *
 * Create via the static `create()` method which loads the appropriate dictionary.
 */
export class RuleBasedTranslator {
  private readonly dictionary: PhraseDictionary;
  private readonly targetLang: string;

  private constructor(dictionary: PhraseDictionary, targetLang: string) {
    this.dictionary = dictionary;
    this.targetLang = targetLang;
  }

  /**
   * Create a rule-based translator for a language pair.
   * Returns null if no dictionary exists for the pair.
   */
  static async create(pair: LanguagePairId): Promise<RuleBasedTranslator | null> {
    const dictionary = await getDictionary(pair);
    if (!dictionary) return null;
    const targetLang = pair.split("-")[1];
    return new RuleBasedTranslator(dictionary, targetLang);
  }

  /**
   * Check if a rule-based dictionary exists for a language pair.
   */
  static hasDictionary(pair: string): boolean {
    return hasDictionary(pair);
  }

  /**
   * Translate text using phrase/word substitution.
   */
  translate(text: string): string {
    if (!text?.trim()) return text;

    // Step 1: Apply time patterns BEFORE entity protection so numbers
    // in expressions like "in 2 weeks" are matched, not captured as entities
    const withTime = applyTimePatterns(text, this.dictionary);

    // Step 2: Protect entities (names, dates, remaining numbers, URLs, acronyms)
    const { cleaned, restore } = protectEntities(withTime);

    // Step 3-4: Apply phrase and word substitutions
    const translated = applyDictionary(cleaned, this.dictionary);

    // Step 5: Restore protected entities
    let result = restore(translated);

    // Step 6: RTL marks for right-to-left languages
    if (isRTL(this.targetLang)) {
      result = applyRTLMarks(result);
    }

    return result;
  }
}
