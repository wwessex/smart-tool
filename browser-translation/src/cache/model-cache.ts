/**
 * Browser Cache API manager for translation model files.
 *
 * Handles caching ONNX model files in the browser for offline access.
 * Uses the Cache API (via caches.open) for persistent storage that
 * survives page reloads and can be used by Service Workers.
 *
 * Transformers.js handles most caching internally via env.useBrowserCache,
 * but this module provides additional control for:
 * - Querying which models are cached
 * - Estimating cached storage usage
 * - Explicit cache cleanup
 * - Pre-caching model files during idle time
 */

import type { ModelCacheEntry, ModelDtype } from "../types.js";

/** Cache name used for translation model files. */
const CACHE_NAME = "lengua-materna-models";

/** IndexedDB database name for cache metadata. */
const DB_NAME = "lengua-materna-cache";
const DB_VERSION = 1;
const STORE_NAME = "models";

export class ModelCacheManager {
  private db: IDBDatabase | null = null;

  /**
   * Open the metadata database.
   */
  async open(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "modelId" });
          store.createIndex("cachedAt", "cachedAt");
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to open cache database: ${request.error?.message}`));
      };
    });
  }

  /**
   * Check if a model is cached in the browser.
   */
  async isCached(modelId: string): Promise<boolean> {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(modelId);
      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Record that a model has been cached.
   */
  async recordCached(entry: ModelCacheEntry): Promise<void> {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get metadata for a cached model.
   */
  async getCacheEntry(modelId: string): Promise<ModelCacheEntry | undefined> {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(modelId);
      request.onsuccess = () => resolve(request.result ?? undefined);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all cached model entries.
   */
  async getAllCached(): Promise<ModelCacheEntry[]> {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Estimate total cached storage in bytes.
   */
  async estimateCachedSize(): Promise<number> {
    const entries = await this.getAllCached();
    return entries.reduce((sum, e) => sum + e.sizeBytes, 0);
  }

  /**
   * Remove a model from the cache (metadata only).
   * Note: the actual Cache API entries are managed by Transformers.js.
   */
  async removeCacheEntry(modelId: string): Promise<void> {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(modelId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all cache metadata.
   */
  async clearAll(): Promise<void> {
    await this.open();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete the underlying Cache API cache for translation models.
   * This removes the actual model files from browser storage.
   */
  async deleteBrowserCache(): Promise<boolean> {
    if (typeof caches === "undefined") return false;
    const deleted = await caches.delete(CACHE_NAME);
    await this.clearAll();
    return deleted;
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db?.close();
    this.db = null;
  }
}
