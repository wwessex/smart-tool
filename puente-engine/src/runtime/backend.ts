/**
 * ONNX Runtime Web backend configuration.
 *
 * Configures the ONNX Runtime environment for the selected
 * inference backend (WebGPU or WASM).
 */

import * as ort from "onnxruntime-web";
import type { InferenceBackend } from "../core/types.js";

/**
 * Configure ONNX Runtime Web for the selected backend.
 * Should be called before creating any InferenceSessions.
 */
export function configureBackend(
  backend: InferenceBackend,
  options: BackendOptions = {}
): void {
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
    if (options.wasmPaths) {
      ort.env.wasm.wasmPaths = options.wasmPaths;
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
