/**
 * ONNX Runtime Web backend configuration.
 *
 * Configures the ONNX Runtime environment for the selected
 * inference backend (WebGPU or WASM).
 */

import * as ort from "onnxruntime-web";
import type { InferenceBackend } from "../core/types.js";

/** CDN base URL template for ONNX Runtime WASM binaries. */
const ORT_CDN_TEMPLATE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@__VER__/dist/";
/** Fallback version if runtime detection fails. */
const ORT_FALLBACK_VERSION = "1.21.0";

/**
 * Configure ONNX Runtime Web for the selected backend.
 * Should be called before creating any InferenceSessions.
 */
export function configureBackend(
  backend: InferenceBackend,
  options: BackendOptions = {}
): void {
  // Always ensure WASM paths are set — even the WebGPU execution
  // provider may fall back to WASM internally, and ort.InferenceSession
  // calls initWasm() regardless of the selected provider.
  ensureWasmPaths(options.wasmPaths);

  switch (backend) {
    case "webgpu":
      configureWebGPU();
      break;
    case "wasm-simd":
      configureWasm(options, true);
      break;
    case "wasm-basic":
      configureWasm(options, false);
      break;
  }
}

/** Options for WASM backend configuration. */
export interface BackendOptions {
  /** Number of threads for WASM execution (0 = auto). */
  numThreads?: number;
  /** URL for the WASM binary files (defaults to CDN). */
  wasmPaths?: string;
}

/**
 * Ensure ort.env.wasm.wasmPaths is set so the runtime can locate
 * its .wasm binaries. Falls back to a jsDelivr CDN URL (version-matched
 * to the loaded onnxruntime-web package) when no explicit path is provided.
 */
function ensureWasmPaths(explicitPaths?: string): void {
  if (!ort.env.wasm) return;
  if (explicitPaths) {
    ort.env.wasm.wasmPaths = explicitPaths;
  } else if (!ort.env.wasm.wasmPaths) {
    // Read version from onnxruntime-web's runtime env so the WASM binaries
    // are guaranteed to match the JS glue code that was bundled.
    const ortVersion =
      (ort.env as { versions?: Record<string, string> }).versions?.web ??
      ORT_FALLBACK_VERSION;
    ort.env.wasm.wasmPaths = ORT_CDN_TEMPLATE.replace("__VER__", ortVersion);
  }
}

function configureWebGPU(): void {
  // WebGPU requires disabling the WASM proxy worker
  if (ort.env.wasm) {
    ort.env.wasm.proxy = false;
  }
}

function configureWasm(options: BackendOptions, simd: boolean): void {
  if (ort.env.wasm) {
    if (options.numThreads !== undefined) {
      ort.env.wasm.numThreads = options.numThreads;
    }
    // SIMD is auto-detected by ort; we just set up the environment
    ort.env.wasm.simd = simd;
  }
}

/**
 * Get the ONNX Runtime execution provider string for a backend.
 */
export function getOrtExecutionProvider(backend: InferenceBackend): string {
  return backend === "webgpu" ? "webgpu" : "wasm";
}
