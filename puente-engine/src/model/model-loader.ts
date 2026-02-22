/**
 * Model file downloader with progress tracking.
 *
 * Fetches ONNX model files from a URL with streaming progress callbacks,
 * optional SHA-256 integrity verification, and abort support.
 */

import type { DownloadProgress } from "../core/types.js";

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

/**
 * Compute SHA-256 hash of data using Web Crypto API.
 */
async function computeSha256(data: Uint8Array): Promise<string> {
  const hashInput = new Uint8Array(data.byteLength);
  hashInput.set(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", hashInput);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
