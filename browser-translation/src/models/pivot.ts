/**
 * Pivot translation routing.
 *
 * When a direct model doesn't exist for a language pair (e.g., pl→ar),
 * the engine routes through English as a pivot language: pl→en→ar.
 *
 * Design follows Firefox's approach: pivot at most once, and only
 * through English. This limits quality degradation from chained models
 * while maximizing language coverage.
 */

import type { LanguageCode, LanguagePairId, TranslationRoute } from "../types.js";
import { hasDirectModel } from "./registry.js";

/** The pivot language used when no direct model exists. */
const PIVOT_LANG: LanguageCode = "en";

/** Maximum number of pivot hops allowed (Firefox allows 1). */
const MAX_PIVOT_HOPS = 1;

/**
 * Build a language pair ID from source and target codes.
 */
export function buildPairId(source: LanguageCode, target: LanguageCode): LanguagePairId {
  return `${source}-${target}` as LanguagePairId;
}

/**
 * Resolve a translation route for a given source→target pair.
 *
 * Returns the optimal route:
 * 1. Direct model if available (1 hop).
 * 2. Pivot through English if both legs exist (2 hops).
 * 3. null if no route is possible.
 *
 * @example
 * resolveRoute("en", "de") → { steps: ["en-de"], isPivot: false, hops: 1 }
 * resolveRoute("pl", "ar") → { steps: ["pl-en", "en-ar"], isPivot: true, hops: 2 }
 * resolveRoute("xx", "yy") → null
 */
export function resolveRoute(
  source: LanguageCode,
  target: LanguageCode
): TranslationRoute | null {
  // Same language — no translation needed
  if (source === target) {
    return { steps: [], isPivot: false, hops: 0 };
  }

  const directPair = buildPairId(source, target);

  // 1. Try direct model
  if (hasDirectModel(directPair)) {
    return {
      steps: [directPair],
      isPivot: false,
      hops: 1,
    };
  }

  // 2. Try pivot through English (only if neither source nor target is already English)
  if (source !== PIVOT_LANG && target !== PIVOT_LANG) {
    const leg1 = buildPairId(source, PIVOT_LANG);
    const leg2 = buildPairId(PIVOT_LANG, target);

    if (hasDirectModel(leg1) && hasDirectModel(leg2)) {
      return {
        steps: [leg1, leg2],
        isPivot: true,
        hops: 2,
      };
    }
  }

  // 3. No route available
  return null;
}

/**
 * Check if translation is possible between two languages
 * (either directly or via pivot).
 */
export function canTranslate(source: LanguageCode, target: LanguageCode): boolean {
  return resolveRoute(source, target) !== null;
}

/**
 * Get all translatable target languages from a given source language.
 * Includes both direct and pivot-reachable targets.
 */
export function getTranslatableTargets(
  source: LanguageCode,
  allLanguages: LanguageCode[]
): LanguageCode[] {
  return allLanguages.filter(
    (target) => target !== source && canTranslate(source, target)
  );
}

/**
 * Get the pivot language code.
 */
export function getPivotLanguage(): LanguageCode {
  return PIVOT_LANG;
}

/**
 * Get the maximum allowed pivot hops.
 */
export function getMaxPivotHops(): number {
  return MAX_PIVOT_HOPS;
}
