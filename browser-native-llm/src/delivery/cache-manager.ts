/**
 * Cache manager for model files using the Cache API.
 *
 * Provides persistent, versioned caching of model weights, tokenizer,
 * and retrieval packs using the browser's CacheStorage API. Handles
 * version upgrades, stale cache eviction, and storage quota management.
 */

import type { CacheEntry, ModelManifest, DownloadProgress } from "../types.js";
import { validateUrl } from "../utils/sanitize.js";

const CACHE_NAME_PREFIX = "smart-llm-";
const METADATA_KEY = "__cache_metadata__";

/** Options for cache operations. */
export interface CacheManagerOptions {
  /** Maximum cache size in bytes (default: 500MB). */
  maxCacheBytes?: number;
  /** Number of model versions to keep (default: 1). */
  maxVersions?: number;
}

const DEFAULT_OPTIONS: Required<CacheManagerOptions> = {
  maxCacheBytes: 500 * 1024 * 1024,
  maxVersions: 1,
};

/**
 * Manages persistent caching of model files in the browser.
 */
export class CacheManager {
  private options: Required<CacheManagerOptions>;

  constructor(options: CacheManagerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Check if a model version is fully cached.
   */
  async isCached(manifest: ModelManifest): Promise<boolean> {
    const cacheName = this.getCacheName(manifest.model_id, manifest.version);

    try {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      const cachedUrls = new Set(keys.map((r) => r.url));

      // Check all files in manifest are cached
      for (const file of manifest.files) {
        if (!cachedUrls.has(this.fileUrl(file.filename))) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get a cached file as an ArrayBuffer.
   */
  async get(
    modelId: string,
    version: string,
    filename: string
  ): Promise<ArrayBuffer | null> {
    const cacheName = this.getCacheName(modelId, version);

    try {
      const cache = await caches.open(cacheName);
      const response = await cache.match(this.fileUrl(filename));

      if (!response) return null;
      return response.arrayBuffer();
    } catch {
      return null;
    }
  }

  /**
   * Cache a downloaded file.
   */
  async put(
    modelId: string,
    version: string,
    filename: string,
    data: ArrayBuffer
  ): Promise<void> {
    const cacheName = this.getCacheName(modelId, version);

    try {
      const cache = await caches.open(cacheName);
      const response = new Response(data, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": data.byteLength.toString(),
          "X-Cached-At": Date.now().toString(),
        },
      });
      await cache.put(this.fileUrl(filename), response);

      // Update metadata
      await this.updateMetadata(cacheName, filename, data.byteLength);
    } catch (error) {
      // Cache storage might be full
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        // Try evicting old versions first
        await this.evictOldVersions(modelId);
        // Retry once
        const cache = await caches.open(cacheName);
        const response = new Response(data);
        await cache.put(this.fileUrl(filename), response);
      } else {
        throw error;
      }
    }
  }

  /**
   * Get cache status and size information.
   */
  async getStatus(): Promise<{
    cachedModels: Array<{ modelId: string; version: string; sizeMB: number }>;
    totalSizeMB: number;
    quotaUsagePercent?: number;
  }> {
    const cachedModels: Array<{
      modelId: string;
      version: string;
      sizeMB: number;
    }> = [];
    let totalSize = 0;

    try {
      const cacheNames = await caches.keys();

      for (const name of cacheNames) {
        if (!name.startsWith(CACHE_NAME_PREFIX)) continue;

        const parts = name.slice(CACHE_NAME_PREFIX.length).split("@");
        if (parts.length !== 2) continue;

        const cache = await caches.open(name);
        const keys = await cache.keys();
        let cacheSize = 0;

        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const size = Number(response.headers.get("Content-Length") ?? 0);
            cacheSize += size;
          }
        }

        cachedModels.push({
          modelId: parts[0],
          version: parts[1],
          sizeMB: Math.round(cacheSize / (1024 * 1024)),
        });

        totalSize += cacheSize;
      }

      // Check storage quota if available
      let quotaUsagePercent: number | undefined;
      if ("storage" in navigator && "estimate" in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota && estimate.usage) {
          quotaUsagePercent = Math.round(
            (estimate.usage / estimate.quota) * 100
          );
        }
      }

      return {
        cachedModels,
        totalSizeMB: Math.round(totalSize / (1024 * 1024)),
        quotaUsagePercent,
      };
    } catch {
      return { cachedModels: [], totalSizeMB: 0 };
    }
  }

  /**
   * Delete cache for a specific model version.
   */
  async deleteVersion(modelId: string, version: string): Promise<void> {
    const cacheName = this.getCacheName(modelId, version);
    await caches.delete(cacheName);
  }

  /**
   * Delete all cached data.
   */
  async clearAll(): Promise<void> {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      if (name.startsWith(CACHE_NAME_PREFIX)) {
        await caches.delete(name);
      }
    }
  }

  /**
   * Evict old model versions, keeping only maxVersions most recent.
   */
  private async evictOldVersions(modelId: string): Promise<void> {
    const cacheNames = await caches.keys();
    const modelCaches = cacheNames
      .filter((name) => name.startsWith(`${CACHE_NAME_PREFIX}${modelId}@`))
      .sort()
      .reverse();

    // Keep maxVersions, delete the rest
    const toDelete = modelCaches.slice(this.options.maxVersions);
    for (const name of toDelete) {
      await caches.delete(name);
    }
  }

  private async updateMetadata(
    cacheName: string,
    filename: string,
    sizeBytes: number
  ): Promise<void> {
    try {
      const cache = await caches.open(cacheName);
      const metaResponse = await cache.match(this.fileUrl(METADATA_KEY));
      let metadata: Record<string, CacheEntry> = {};

      if (metaResponse) {
        metadata = await metaResponse.json();
      }

      metadata[filename] = {
        url: filename,
        cached_at: Date.now(),
        size_bytes: sizeBytes,
        version: cacheName.split("@")[1] ?? "",
      };

      await cache.put(
        this.fileUrl(METADATA_KEY),
        new Response(JSON.stringify(metadata), {
          headers: { "Content-Type": "application/json" },
        })
      );
    } catch {
      // Metadata update failure is non-critical
    }
  }

  private getCacheName(modelId: string, version: string): string {
    return `${CACHE_NAME_PREFIX}${modelId}@${version}`;
  }

  private fileUrl(filename: string): string {
    // Create a synthetic URL for cache matching
    return `https://smart-llm-cache/${filename}`;
  }
}

/**
 * Download model files with cache-first strategy.
 * Checks cache before downloading, caches new downloads.
 */
export async function downloadWithCache(
  manifest: ModelManifest,
  baseUrl: string,
  cacheManager: CacheManager,
  onProgress?: (progress: DownloadProgress) => void
): Promise<Map<string, ArrayBuffer>> {
  const files = new Map<string, ArrayBuffer>();

  for (const file of manifest.files) {
    // Check cache first
    const cached = await cacheManager.get(
      manifest.model_id,
      manifest.version,
      file.filename
    );

    if (cached) {
      files.set(file.filename, cached);
      onProgress?.({
        file: file.filename,
        loaded_bytes: file.size_bytes,
        total_bytes: file.size_bytes,
        phase: "complete",
      });
      continue;
    }

    // Download and cache
    onProgress?.({
      file: file.filename,
      loaded_bytes: 0,
      total_bytes: file.size_bytes,
      phase: "downloading",
    });

    const fileUrl = validateUrl(`${baseUrl}${file.filename}`);
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download ${file.filename}: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    files.set(file.filename, buffer);

    // Cache the downloaded file
    onProgress?.({
      file: file.filename,
      loaded_bytes: file.size_bytes,
      total_bytes: file.size_bytes,
      phase: "caching",
    });

    await cacheManager.put(
      manifest.model_id,
      manifest.version,
      file.filename,
      buffer
    );

    onProgress?.({
      file: file.filename,
      loaded_bytes: file.size_bytes,
      total_bytes: file.size_bytes,
      phase: "complete",
    });
  }

  return files;
}
