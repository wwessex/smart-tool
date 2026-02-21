/**
 * Browser capability detection for inference backend selection.
 *
 * Detects WebGPU, WASM SIMD, WASM threads, cross-origin isolation,
 * and estimated memory to choose the optimal execution provider.
 */

import type { BrowserCapabilities, InferenceBackend } from "../core/types.js";

/**
 * Detect browser capabilities for neural network inference.
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
 */
export function selectBackend(
  capabilities: BrowserCapabilities,
  preferredBackend?: InferenceBackend,
  modelSizeMB?: number
): InferenceBackend {
  // Honour explicit preference if capable
  if (preferredBackend) {
    if (preferredBackend === "webgpu" && capabilities.webgpu) return "webgpu";
    if (preferredBackend === "wasm-simd" && capabilities.wasmSimd)
      return "wasm-simd";
    if (preferredBackend === "wasm-basic") return "wasm-basic";
  }

  // Memory check: avoid WebGPU if insufficient headroom
  if (modelSizeMB && capabilities.estimatedMemoryMB) {
    const headroom = capabilities.estimatedMemoryMB - modelSizeMB;
    if (headroom < 200) {
      return capabilities.wasmSimd ? "wasm-simd" : "wasm-basic";
    }
  }

  // Auto-select: WebGPU > WASM SIMD > WASM basic
  if (capabilities.webgpu) return "webgpu";
  if (capabilities.wasmSimd) return "wasm-simd";
  return "wasm-basic";
}

/**
 * Check if threading is available.
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
      return "WebGPU (GPU-accelerated inference)";
    case "wasm-simd": {
      const threading = canUseThreads(capabilities)
        ? "multi-threaded"
        : "single-threaded";
      return `WebAssembly SIMD (${threading} CPU inference)`;
    }
    case "wasm-basic":
      return "WebAssembly (basic CPU inference)";
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
    const simdTest = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, // magic
      0x01, 0x00, 0x00, 0x00, // version
      0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, // type section
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
    const deviceMemory = (
      navigator as Navigator & { deviceMemory?: number }
    ).deviceMemory;
    if (deviceMemory) {
      return Math.floor(deviceMemory * 1024 * 0.5);
    }
  }
  return undefined;
}
