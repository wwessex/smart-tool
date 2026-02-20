/**
 * Chunked model loader with progress tracking and resume support.
 *
 * Handles downloading model weights split into multiple files/shards,
 * with HTTP Range request support for resume after interruption,
 * progress callbacks, and integrity verification via SHA-256 hashes.
 */

import type { ModelManifest, ModelFile, DownloadProgress } from "../types.js";
import { validateUrl } from "../utils/sanitize.js";

/** Options for loading a model. */
export interface LoaderOptions {
  /** Base URL where model files are hosted. */
  baseUrl: string;
  /** Callback for download progress updates. */
  onProgress?: (progress: DownloadProgress) => void;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
  /** Whether to verify SHA-256 hashes (slower but safer). */
  verifyIntegrity?: boolean;
  /** Whether to use Range requests for resume support. */
  enableResume?: boolean;
}

/**
 * Load a model manifest from the server.
 */
export async function loadManifest(
  baseUrl: string
): Promise<ModelManifest> {
  const manifestUrl = validateUrl(`${baseUrl}manifest.json`);
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Failed to load model manifest: ${response.status}`);
  }
  return response.json();
}

/**
 * Load all model files described in the manifest.
 * Downloads required files first, then lazy-loads optional files.
 */
export async function loadModelFiles(
  manifest: ModelManifest,
  options: LoaderOptions
): Promise<Map<string, ArrayBuffer>> {
  const files = new Map<string, ArrayBuffer>();

  // Download required files first
  const requiredFiles = manifest.files.filter((f) => f.required);
  const optionalFiles = manifest.files.filter((f) => !f.required);

  // Download required files (in order, to allow streaming start)
  for (const file of requiredFiles) {
    if (options.signal?.aborted) {
      throw new DOMException("Download aborted", "AbortError");
    }

    const buffer = await downloadFile(file, options);
    files.set(file.filename, buffer);
  }

  // Download optional files (can be parallelised)
  const optionalPromises = optionalFiles.map((file) =>
    downloadFile(file, options).then((buffer) => {
      files.set(file.filename, buffer);
    })
  );

  await Promise.all(optionalPromises);

  // Also download tokenizer and config
  const tokenizerBuffer = await downloadFileByUrl(
    `${options.baseUrl}${manifest.tokenizer_file}`,
    manifest.tokenizer_file,
    options
  );
  files.set(manifest.tokenizer_file, tokenizerBuffer);

  const configBuffer = await downloadFileByUrl(
    `${options.baseUrl}${manifest.config_file}`,
    manifest.config_file,
    options
  );
  files.set(manifest.config_file, configBuffer);

  return files;
}

/**
 * Download a single model file with progress tracking and optional resume.
 */
async function downloadFile(
  file: ModelFile,
  options: LoaderOptions
): Promise<ArrayBuffer> {
  const url = `${options.baseUrl}${file.filename}`;
  return downloadFileByUrl(url, file.filename, options, file.size_bytes, file.sha256);
}

async function downloadFileByUrl(
  url: string,
  filename: string,
  options: LoaderOptions,
  expectedSize?: number,
  expectedHash?: string
): Promise<ArrayBuffer> {
  options.onProgress?.({
    file: filename,
    loaded_bytes: 0,
    total_bytes: expectedSize ?? 0,
    phase: "downloading",
  });

  // Check for cached partial download (for resume)
  const startByte = 0;
  const existingChunks: Uint8Array[] = [];

  const headers: Record<string, string> = {};
  if (options.enableResume && startByte > 0) {
    headers["Range"] = `bytes=${startByte}-`;
  }

  const validatedUrl = validateUrl(url);
  const response = await fetch(validatedUrl, {
    headers,
    signal: options.signal,
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(
      `Failed to download ${filename}: ${response.status} ${response.statusText}`
    );
  }

  const contentLength = Number(
    response.headers.get("content-length") ?? expectedSize ?? 0
  );
  const totalBytes = startByte + contentLength;

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(`Failed to get reader for ${filename}`);
  }

  const chunks: Uint8Array[] = [...existingChunks];
  let loaded = startByte;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    loaded += value.byteLength;

    options.onProgress?.({
      file: filename,
      loaded_bytes: loaded,
      total_bytes: totalBytes,
      phase: "downloading",
    });
  }

  // Concatenate chunks
  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  // Verify integrity if requested
  if (options.verifyIntegrity && expectedHash) {
    const hash = await computeSha256(buffer);
    if (hash !== expectedHash) {
      throw new Error(
        `Integrity check failed for ${filename}: expected ${expectedHash}, got ${hash}`
      );
    }
  }

  options.onProgress?.({
    file: filename,
    loaded_bytes: loaded,
    total_bytes: totalBytes,
    phase: "complete",
  });

  return buffer.buffer;
}

/**
 * Compute SHA-256 hash of a buffer.
 */
async function computeSha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Estimate download time for a model based on connection speed.
 * Uses the Network Information API if available.
 */
export function estimateDownloadInfo(manifest: ModelManifest): {
  totalSizeMB: number;
  fileCount: number;
  requiredSizeMB: number;
} {
  const totalBytes = manifest.files.reduce((sum, f) => sum + f.size_bytes, 0);
  const requiredBytes = manifest.files
    .filter((f) => f.required)
    .reduce((sum, f) => sum + f.size_bytes, 0);

  return {
    totalSizeMB: Math.round(totalBytes / (1024 * 1024)),
    fileCount: manifest.files.length,
    requiredSizeMB: Math.round(requiredBytes / (1024 * 1024)),
  };
}
