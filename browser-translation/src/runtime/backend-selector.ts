/**
 * Browser capability detection and backend selection for translation inference.
 *
 * Detects WebGPU, WASM SIMD, threading support, and memory availability
 * to choose the optimal ONNX Runtime Web execution provider.
 *
 * This is adapted from browser-native-llm/src/runtime/backend-selector.ts
 * for the Lengua Materna Translation Engine.
 */

import type { BrowserCapabilities, InferenceBackend } from "../types.js";

/**
 * Detect browser capabilities for translation model inference.
 */
export async function detectCapabilities(): Promise<BrowserCapabilities> {
  const [webgpu, wasmSimd, wasmThreads] = await Promise.all([
    detectWebGPU(),
    detectWasmSimd(),
    detectWasmThreads(),
  ]);

  const crossOriginIsolated =
    typeof globalThis.crossOriginIsolated !== "undefined"
      ? globalThis.crossOriginIsolated
      : false;

  const estimatedMemoryMB = estimateAvailableMemory();

  return {
    webgpu,
    wasmSimd,
    wasmThreads,
    crossOriginIsolated,
    estimatedMemoryMB,
  };
}

/**
 * Select the best inference backend based on detected capabilities.
 *
 * For translation models (~50-150MB quantized), WebGPU is preferred
 * when available, with WASM SIMD as a strong fallback.
 */
export function selectBackend(
  capabilities: BrowserCapabilities,
  preferredBackend?: InferenceBackend
): InferenceBackend {
  // Honour explicit preference if the capability exists
  if (preferredBackend) {
    if (preferredBackend === "webgpu" && capabilities.webgpu) return "webgpu";
    if (preferredBackend === "wasm-simd" && capabilities.wasmSimd) return "wasm-simd";
    if (preferredBackend === "wasm-basic") return "wasm-basic";
  }

  // Auto-select: WebGPU > WASM SIMD > WASM basic
  if (capabilities.webgpu) return "webgpu";
  if (capabilities.wasmSimd) return "wasm-simd";
  return "wasm-basic";
}

/**
 * Check if multi-threading is available.
 * Requires both WASM thread support and cross-origin isolation (COOP/COEP headers).
 */
export function canUseThreads(capabilities: BrowserCapabilities): boolean {
  return capabilities.wasmThreads && capabilities.crossOriginIsolated;
}

/**
 * Get human-readable description of the selected backend.
 */
export function describeBackend(
  backend: InferenceBackend,
  capabilities: BrowserCapabilities
): string {
  switch (backend) {
    case "webgpu":
      return "WebGPU (GPU-accelerated translation)";
    case "wasm-simd": {
      const threading = canUseThreads(capabilities) ? "multi-threaded" : "single-threaded";
      return `WebAssembly SIMD (${threading} CPU translation)`;
    }
    case "wasm-basic":
      return "WebAssembly (basic CPU translation, reduced performance)";
  }
}

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

async function detectWebGPU(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  if (!("gpu" in navigator)) return false;

  try {
    const gpu = (navigator as Navigator & { gpu: { requestAdapter(): Promise<{ requestDevice(): Promise<{ destroy(): void }> } | null> } }).gpu;
    const adapter = await gpu.requestAdapter();
    if (!adapter) return false;

    const device = await adapter.requestDevice();
    device.destroy();
    return true;
  } catch {
    return false;
  }
}

async function detectWasmSimd(): Promise<boolean> {
  try {
    // Minimal WASM module using v128 (i32x4.splat) to test SIMD support
    const simdTest = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, // magic
      0x01, 0x00, 0x00, 0x00, // version
      0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, // type section: () -> v128
      0x03, 0x02, 0x01, 0x00, // function section
      0x0a, 0x0a, 0x01, 0x08, 0x00, 0x41, 0x00, 0xfd, 0x0f, 0x0b, // code
    ]);
    const module = await WebAssembly.compile(simdTest);
    return module instanceof WebAssembly.Module;
  } catch {
    return false;
  }
}

async function detectWasmThreads(): Promise<boolean> {
  try {
    if (typeof SharedArrayBuffer === "undefined") return false;

    const memory = new WebAssembly.Memory({
      initial: 1,
      maximum: 1,
      shared: true,
    });
    return memory.buffer instanceof SharedArrayBuffer;
  } catch {
    return false;
  }
}

function estimateAvailableMemory(): number | undefined {
  if (typeof navigator !== "undefined" && "deviceMemory" in navigator) {
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (deviceMemory) {
      return Math.floor(deviceMemory * 1024 * 0.5);
    }
  }
  return undefined;
}
