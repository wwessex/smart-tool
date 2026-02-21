/**
 * Browser Cache API wrapper for model files.
 *
 * Stores ONNX model files in the browser's Cache Storage API
 * for offline access and faster subsequent loads.
 * Includes ETag-based cache invalidation and size tracking.
 */

/** Cache entry metadata stored alongside cached responses. */
export interface CacheMetadata {
  /** Model identifier. */
  modelId: string;
  /** File name. */
  filename: string;
  /** Size in bytes. */
  sizeBytes: number;
  /** When the file was cached. */
  cachedAt: number;
  /** ETag from the response headers. */
  etag?: string;
}

const CACHE_NAME = "puente-engine-models";
const METADATA_KEY_PREFIX = "meta:";

export class ModelCache {
  private cacheName: string;

  constructor(cacheName: string = CACHE_NAME) {
    this.cacheName = cacheName;
  }

  /**
   * Check if the Cache API is available in this environment.
   */
  isAvailable(): boolean {
    return typeof caches !== "undefined";
  }

  /**
   * Get a cached model file.
   * Returns the ArrayBuffer if cached, undefined otherwise.
   */
  async get(url: string): Promise<ArrayBuffer | undefined> {
    if (!this.isAvailable()) return undefined;

    try {
      const cache = await caches.open(this.cacheName);
      const response = await cache.match(url);
      if (!response) return undefined;
      return response.arrayBuffer();
    } catch {
      return undefined;
    }
  }

  /**
   * Store a model file in the cache.
   */
  async put(
    url: string,
    data: ArrayBuffer,
    metadata?: Partial<CacheMetadata>
  ): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const cache = await caches.open(this.cacheName);

      const headers: HeadersInit = {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(data.byteLength),
      };

      if (metadata?.etag) {
        headers["ETag"] = metadata.etag;
      }

      const response = new Response(data, { headers });
      await cache.put(url, response);

      // Store metadata separately
      if (metadata) {
        const metaKey = METADATA_KEY_PREFIX + url;
        const metaResponse = new Response(
          JSON.stringify({
            ...metadata,
            sizeBytes: data.byteLength,
            cachedAt: Date.now(),
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
        await cache.put(metaKey, metaResponse);
      }
    } catch {
      // Cache write failures are non-fatal
    }
  }

  /**
   * Check if a URL is cached and optionally validate the ETag.
   */
  async has(url: string, expectedEtag?: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const cache = await caches.open(this.cacheName);
      const response = await cache.match(url);
      if (!response) return false;

      if (expectedEtag) {
        const cachedEtag = response.headers.get("ETag");
        return cachedEtag === expectedEtag;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a cached model file.
   */
  async delete(url: string): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const cache = await caches.open(this.cacheName);
      const deleted = await cache.delete(url);
      // Also delete metadata
      await cache.delete(METADATA_KEY_PREFIX + url);
      return deleted;
    } catch {
      return false;
    }
  }

  /**
   * Delete all cached model files.
   */
  async clear(): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      return caches.delete(this.cacheName);
    } catch {
      return false;
    }
  }

  /**
   * Get metadata for a cached URL.
   */
  async getMetadata(url: string): Promise<CacheMetadata | undefined> {
    if (!this.isAvailable()) return undefined;

    try {
      const cache = await caches.open(this.cacheName);
      const response = await cache.match(METADATA_KEY_PREFIX + url);
      if (!response) return undefined;
      return (await response.json()) as CacheMetadata;
    } catch {
      return undefined;
    }
  }
}
