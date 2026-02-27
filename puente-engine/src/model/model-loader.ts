/**
 * Model file downloader with progress tracking.
 *
 * Fetches ONNX model files from a URL with streaming progress callbacks,
 * optional SHA-256 integrity verification, and abort support.
 */

import type { DownloadProgress } from "../core/types.js";
import type { ModelCache } from "./model-cache.js";

/** Options for downloading a model file. */
export interface FetchModelOptions {
  /** Callback for download progress updates. */
  onProgress?: (progress: DownloadProgress) => void;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
  /** Whether to verify SHA-256 hash after download. */
  verifyHash?: string;
  /** Optional HTTP headers to include in the fetch request. */
  headers?: Record<string, string>;
  /** Optional model cache for persistent cache-first loading. */
  cache?: ModelCache;
}

/** Description of a model file to download. */
export interface ModelFileInfo {
  /** Filename (e.g., "model.onnx", "encoder_model.onnx"). */
  filename: string;
  /** Expected size in bytes (for progress, 0 if unknown). */
  sizeBytes?: number;
  /** SHA-256 hash for integrity verification. */
  sha256?: string;
}

/**
 * Fetch a single model file with streaming progress.
 * Returns the file data as an ArrayBuffer.
 */
export async function fetchModel(
  url: string,
  options: FetchModelOptions = {}
): Promise<ArrayBuffer> {
  const filename = url.split("/").pop() ?? "model";
  const { cache } = options;

  // Cache-first: return cached data if available
  if (cache) {
    const cached = await cache.get(url);
    if (cached) {
      options.onProgress?.({
        file: filename,
        loaded_bytes: cached.byteLength,
        total_bytes: cached.byteLength,
        phase: "complete",
      });
      return cached;
    }
  }

  options.onProgress?.({
    file: filename,
    loaded_bytes: 0,
    total_bytes: 0,
    phase: "downloading",
  });

  const fetchInit: RequestInit = {};
  if (options.signal) fetchInit.signal = options.signal;
  if (options.headers) fetchInit.headers = options.headers;
  const response = await fetch(url, fetchInit);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch model from ${url}: ${response.status} ${response.statusText}`
    );
  }

  const contentLength = Number(
    response.headers.get("content-length") ?? 0
  );
  const etag = response.headers.get("etag") ?? undefined;
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(`Failed to get response reader for ${url}`);
  }

  const chunks: Uint8Array[] = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    loaded += value.byteLength;

    options.onProgress?.({
      file: filename,
      loaded_bytes: loaded,
      total_bytes: contentLength,
      phase: "downloading",
    });
  }

  // Concatenate chunks into a single buffer
  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  // Verify integrity if hash provided
  const hashToVerify = options.verifyHash;
  if (hashToVerify) {
    const hash = await computeSha256(buffer);
    if (hash !== hashToVerify) {
      throw new Error(
        `Integrity check failed for ${filename}: expected ${hashToVerify}, got ${hash}`
      );
    }
  }

  // Cache the downloaded file for future loads
  if (cache) {
    options.onProgress?.({
      file: filename,
      loaded_bytes: loaded,
      total_bytes: contentLength,
      phase: "caching",
    });
    await cache.put(url, buffer.buffer, { filename, etag });
  }

  options.onProgress?.({
    file: filename,
    loaded_bytes: loaded,
    total_bytes: contentLength,
    phase: "complete",
  });

  return buffer.buffer;
}

/**
 * Fetch multiple model files from a base URL.
 * Downloads files sequentially and returns a map of filename → ArrayBuffer.
 */
export async function fetchModelFiles(
  baseUrl: string,
  files: ModelFileInfo[],
  options: FetchModelOptions = {}
): Promise<Map<string, ArrayBuffer>> {
  const result = new Map<string, ArrayBuffer>();
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";

  for (const file of files) {
    if (options.signal?.aborted) {
      throw new DOMException("Download aborted", "AbortError");
    }

    const url = normalizedBase + file.filename;
    const buffer = await fetchModel(url, {
      ...options,
      verifyHash: file.sha256,
    });
    result.set(file.filename, buffer);
  }

  return result;
}

/** Shard entry in a shard manifest. */
export interface ShardEntry {
  filename: string;
  offset: number;
  size_bytes: number;
  sha256: string;
}

/** Manifest for a sharded model file. */
export interface ShardManifest {
  model_file: string;
  total_bytes: number;
  shard_size_bytes: number;
  shard_count: number;
  shards: ShardEntry[];
  original_sha256: string;
}

/**
 * Fetch a model that may be sharded. Tries to load a shard manifest first
 * (`{modelName}.shards.json`); if found, downloads individual shards
 * (with per-shard caching) and concatenates them. If no manifest exists,
 * falls back to single-file download.
 */
export async function fetchModelWithShards(
  url: string,
  options: FetchModelOptions = {}
): Promise<ArrayBuffer> {
  // Check cache for the complete model first (covers both sharded and non-sharded)
  const { cache } = options;
  const filename = url.split("/").pop() ?? "model";

  if (cache) {
    const cached = await cache.get(url);
    if (cached) {
      options.onProgress?.({
        file: filename,
        loaded_bytes: cached.byteLength,
        total_bytes: cached.byteLength,
        phase: "complete",
      });
      return cached;
    }
  }

  // Try to fetch the shard manifest
  const manifestUrl = url.replace(/\.[^.]+$/, ".shards.json");
  let manifest: ShardManifest | null = null;

  try {
    const res = await fetch(manifestUrl, { signal: options.signal });
    if (res.ok) {
      manifest = (await res.json()) as ShardManifest;
    }
  } catch {
    // No manifest — fall back to single-file download
  }

  if (!manifest || !manifest.shards?.length) {
    return fetchModel(url, options);
  }

  // Sharded download
  const baseUrl = url.substring(0, url.lastIndexOf("/") + 1);
  const totalBytes = manifest.total_bytes;
  let loadedBytes = 0;

  options.onProgress?.({
    file: filename,
    loaded_bytes: 0,
    total_bytes: totalBytes,
    phase: "downloading",
  });

  const shardBuffers: ArrayBuffer[] = [];

  for (const shard of manifest.shards) {
    if (options.signal?.aborted) {
      throw new DOMException("Download aborted", "AbortError");
    }

    const shardUrl = baseUrl + shard.filename;

    // Per-shard cache check
    if (cache) {
      const cachedShard = await cache.get(shardUrl);
      if (cachedShard) {
        shardBuffers.push(cachedShard);
        loadedBytes += cachedShard.byteLength;
        options.onProgress?.({
          file: filename,
          loaded_bytes: loadedBytes,
          total_bytes: totalBytes,
          phase: "downloading",
        });
        continue;
      }
    }

    // Download the shard with resume support
    const shardBuffer = await fetchShardWithResume(
      shardUrl,
      shard,
      options,
      (shardLoaded) => {
        options.onProgress?.({
          file: filename,
          loaded_bytes: loadedBytes + shardLoaded,
          total_bytes: totalBytes,
          phase: "downloading",
        });
      }
    );

    shardBuffers.push(shardBuffer);
    loadedBytes += shardBuffer.byteLength;

    // Cache individual shard
    if (cache) {
      await cache.put(shardUrl, shardBuffer, {
        filename: shard.filename,
      });
    }
  }

  // Concatenate all shards into a single contiguous buffer
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const buf of shardBuffers) {
    combined.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  // Cache the complete reassembled model
  if (cache) {
    options.onProgress?.({
      file: filename,
      loaded_bytes: totalBytes,
      total_bytes: totalBytes,
      phase: "caching",
    });
    await cache.put(url, combined.buffer, { filename });
  }

  options.onProgress?.({
    file: filename,
    loaded_bytes: totalBytes,
    total_bytes: totalBytes,
    phase: "complete",
  });

  return combined.buffer;
}

/**
 * Download a single shard with optional HTTP Range resume support.
 * If a partial download exists in cache, resumes from where it left off.
 */
async function fetchShardWithResume(
  url: string,
  shard: ShardEntry,
  options: FetchModelOptions,
  onShardProgress: (loaded: number) => void,
): Promise<ArrayBuffer> {
  const { cache } = options;

  // Check for partial download in cache (stored with ".partial" suffix)
  const partialKey = url + ".partial";
  let existingData: ArrayBuffer | undefined;
  let startByte = 0;

  if (cache) {
    existingData = await cache.get(partialKey);
    if (existingData) {
      startByte = existingData.byteLength;
      // If we already have the full shard, verify and return
      if (startByte >= shard.size_bytes) {
        onShardProgress(startByte);
        // Clean up partial key
        await cache.delete(partialKey);
        return existingData;
      }
    }
  }

  const headers: Record<string, string> = { ...options.headers };
  if (startByte > 0) {
    headers["Range"] = `bytes=${startByte}-`;
  }

  const response = await fetch(url, {
    headers,
    signal: options.signal,
  });

  // If the server doesn't support Range requests, re-download fully
  const isPartial = response.status === 206;
  if (!response.ok && !isPartial) {
    throw new Error(`Failed to download shard ${shard.filename}: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(`Failed to get reader for shard ${shard.filename}`);
  }

  const chunks: Uint8Array[] = [];
  if (isPartial && existingData) {
    chunks.push(new Uint8Array(existingData));
  }
  let loaded = isPartial ? startByte : 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onShardProgress(loaded);
  }

  // Concatenate
  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  // Verify integrity
  const hash = await computeSha256(buffer);
  if (hash !== shard.sha256) {
    // If integrity fails, clear partial cache and throw
    if (cache) await cache.delete(partialKey);
    throw new Error(
      `Shard integrity check failed for ${shard.filename}: expected ${shard.sha256}, got ${hash}`
    );
  }

  // Clean up partial cache on success
  if (cache) await cache.delete(partialKey);

  return buffer.buffer;
}

/**
 * Compute SHA-256 hash of data using Web Crypto API.
 */
export async function computeSha256(data: Uint8Array): Promise<string> {
  const hashInput = new Uint8Array(data.byteLength);
  hashInput.set(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", hashInput);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
