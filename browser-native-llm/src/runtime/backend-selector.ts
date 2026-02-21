/**
 * Browser capability detection and backend selection.
 *
 * Detects WebGPU, WASM SIMD, threading support, and memory availability
 * to choose the optimal inference backend for the current environment.
 */

import type { BrowserCapabilities, InferenceBackend } from "../types.js";

/**
 * Detect browser capabilities for LLM inference.
 * Tests are ordered from highest-performance to fallback.
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
 * Select the best inference backend based on detected capabilities
 * and the model's requirements.
 */
export function selectBackend(
  capabilities: BrowserCapabilities,
  preferredBackend?: InferenceBackend,
  modelSizeMB?: number
): InferenceBackend {
  // Honour explicit preference if the capability exists
  if (preferredBackend) {
    if (preferredBackend === "webgpu" && capabilities.webgpu) return "webgpu";
    if (preferredBackend === "wasm-simd" && capabilities.wasmSimd) return "wasm-simd";
    if (preferredBackend === "wasm-basic") return "wasm-basic";
  }

  // Check memory constraints - if model is too large for estimated memory, prefer WASM
  // (WASM can use disk-backed virtual memory more gracefully on some platforms)
  if (modelSizeMB && capabilities.estimatedMemoryMB) {
    const memoryHeadroom = capabilities.estimatedMemoryMB - modelSizeMB;
    if (memoryHeadroom < 200) {
      // Not enough headroom for WebGPU (needs GPU memory too)
      return capabilities.wasmSimd ? "wasm-simd" : "wasm-basic";
    }
  }

  // Auto-select: WebGPU > WASM SIMD > WASM basic
  if (capabilities.webgpu) return "webgpu";
  if (capabilities.wasmSimd) return "wasm-simd";
  return "wasm-basic";
}

/**
 * Check if the selected backend supports multi-threading.
 * WASM threads require cross-origin isolation (COOP/COEP headers).
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
      const threading = canUseThreads(capabilities) ? "multi-threaded" : "single-threaded";
      return `WebAssembly SIMD (${threading} CPU inference)`;
    }
    case "wasm-basic":
      return "WebAssembly (basic CPU inference, reduced performance)";
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

    // Verify we can actually create a device
    const device = await adapter.requestDevice();
    device.destroy();
    return true;
  } catch {
    return false;
  }
}

async function detectWasmSimd(): Promise<boolean> {
  try {
    // Test for WASM SIMD support by compiling a minimal module
    // that uses a v128 type instruction (i32x4.splat).
    const simdTest = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, // magic
      0x01, 0x00, 0x00, 0x00, // version
      0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7b, // type section: () -> v128
      0x03, 0x02, 0x01, 0x00, // function section
      0x0a, 0x0a, 0x01, 0x08, 0x00, 0x41, 0x00, 0xfd, 0x0f, 0x0b, // code: i32x4.splat(0)
    ]);
    const module = await WebAssembly.compile(simdTest);
    return module instanceof WebAssembly.Module;
  } catch {
    return false;
  }
}

async function detectWasmThreads(): Promise<boolean> {
  try {
    // SharedArrayBuffer is required for WASM threads
    if (typeof SharedArrayBuffer === "undefined") return false;

    // Test that we can create a shared memory WASM module
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
  // Use the Device Memory API if available (Chrome/Edge)
  if (typeof navigator !== "undefined" && "deviceMemory" in navigator) {
    // deviceMemory returns approximate RAM in GiB (rounded to power of 2)
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (deviceMemory) {
      // Estimate available as ~50% of device memory (conservative)
      return Math.floor(deviceMemory * 1024 * 0.5);
    }
  }

  // Use performance.measureUserAgentSpecificMemory if available
  // (only works in cross-origin isolated contexts)
  // For now, return undefined to indicate unknown
  return undefined;
}
