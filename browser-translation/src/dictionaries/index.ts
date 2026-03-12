/**
 * Lazy-loading registry for per-language-pair phrase dictionaries.
 *
 * Dictionaries are loaded on demand via dynamic import() so only the
 * needed language is included in the runtime bundle.
 */

import type { PhraseDictionary } from "./types.js";

type DictionaryLoader = () => Promise<{ dictionary: PhraseDictionary }>;

/** Map of language pair IDs to their lazy-loading import functions. */
const loaders: Record<string, DictionaryLoader> = {
  "en-fr": () => import("./en-fr.js"),
  "en-de": () => import("./en-de.js"),
  "en-ar": () => import("./en-ar.js"),
  "en-es": () => import("./en-es.js"),
  "en-it": () => import("./en-it.js"),
  "en-pt": () => import("./en-pt.js"),
  "en-pl": () => import("./en-pl.js"),
  "en-cy": () => import("./en-cy.js"),
  "en-ur": () => import("./en-ur.js"),
  "en-bn": () => import("./en-bn.js"),
  "en-pa": () => import("./en-pa.js"),
  "en-ps": () => import("./en-ps.js"),
  "en-so": () => import("./en-so.js"),
  "en-ti": () => import("./en-ti.js"),
  "en-hi": () => import("./en-hi.js"),
};

/** Cache of loaded dictionaries. */
const cache = new Map<string, PhraseDictionary>();

/**
 * Load and return the phrase dictionary for a language pair.
 * Returns null if no dictionary exists for the pair.
 */
export async function getDictionary(pair: string): Promise<PhraseDictionary | null> {
  if (cache.has(pair)) return cache.get(pair)!;

  const loader = loaders[pair];
  if (!loader) return null;

  const mod = await loader();
  cache.set(pair, mod.dictionary);
  return mod.dictionary;
}

/**
 * Check if a rule-based dictionary exists for a language pair.
 */
export function hasDictionary(pair: string): boolean {
  return pair in loaders;
}

/**
 * Get all language pair IDs that have dictionaries.
 */
export function getDictionaryPairs(): string[] {
  return Object.keys(loaders);
}
