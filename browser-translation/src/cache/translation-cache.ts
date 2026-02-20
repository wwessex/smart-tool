/**
 * In-memory LRU cache for translated text segments.
 *
 * Avoids re-translating identical chunks when the same text is
 * translated multiple times (e.g., during editing or re-rendering).
 * Cache entries are keyed by (sourceText, languagePair).
 */

import type { LanguagePairId, TranslationCacheEntry } from "../types.js";

/** Default maximum cache entries. */
const DEFAULT_MAX_ENTRIES = 500;

export class TranslationCache {
  private readonly cache = new Map<string, TranslationCacheEntry>();
  private readonly maxEntries: number;

  constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  /**
   * Build a cache key from source text and language pair.
   */
  private buildKey(sourceText: string, pair: LanguagePairId): string {
    return `${pair}:${sourceText}`;
  }

  /**
   * Get a cached translation, or undefined if not cached.
   * Moves the entry to the "most recently used" position.
   */
  get(sourceText: string, pair: LanguagePairId): string | undefined {
    const key = this.buildKey(sourceText, pair);
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // LRU: delete and re-insert to move to end
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.translatedText;
  }

  /**
   * Store a translation in the cache.
   * Evicts the oldest entry if at capacity.
   */
  set(sourceText: string, pair: LanguagePairId, translatedText: string): void {
    const key = this.buildKey(sourceText, pair);

    // Remove existing entry to update position
    this.cache.delete(key);

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      sourceText,
      pair,
      translatedText,
      cachedAt: Date.now(),
    });
  }

  /**
   * Check if a translation is cached.
   */
  has(sourceText: string, pair: LanguagePairId): boolean {
    return this.cache.has(this.buildKey(sourceText, pair));
  }

  /**
   * Remove a specific cached translation.
   */
  delete(sourceText: string, pair: LanguagePairId): boolean {
    return this.cache.delete(this.buildKey(sourceText, pair));
  }

  /**
   * Clear all cached translations.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached entries.
   */
  get size(): number {
    return this.cache.size;
  }
}
