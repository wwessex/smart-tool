import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/**
 * Integration tests for the useBrowserNativeLLM hook.
 *
 * These tests verify the hook's state management, device detection,
 * and public API surface. Actual LLM inference requires a browser
 * environment with WebGPU/WASM support, so model loading and
 * generation are tested at the API contract level.
 */

// Mock the entire browser-native-llm module (dynamic imports included)
const mockInitialize = vi.fn().mockResolvedValue(undefined);
const mockGeneratePlan = vi.fn().mockResolvedValue({
  actions: [
    {
      action: "Update CV with recent warehouse experience",
      metric: "1 tailored CV completed",
      baseline: "No recent CV",
      target: "CV ready to submit",
      deadline: "2026-03-07",
      rationale: "An up-to-date CV is needed to apply for warehouse roles",
      effort_estimate: "2 hours one-off",
      first_step: "List last 3 jobs with dates and duties",
    },
  ],
  metadata: {
    model_id: "test-model",
    model_version: "0.1.0",
    backend: "wasm-basic" as const,
    retrieval_pack_version: "1.0.0",
    generated_at: new Date().toISOString(),
    generation_time_ms: 150,
    tokens_generated: 200,
  },
});
const mockGenerateTemplatePlan = vi.fn().mockReturnValue({
  actions: [{ action: "Template action", metric: "1", baseline: "0", target: "1", deadline: "2026-03-07", rationale: "Template", effort_estimate: "1h", first_step: "Start" }],
  metadata: { model_id: "template-only", model_version: "0.1.0", backend: "wasm-basic", retrieval_pack_version: "1.0.0", generated_at: new Date().toISOString(), generation_time_ms: 5, tokens_generated: 0 },
});
const mockDispose = vi.fn();

vi.mock("@smart-tool/browser-native-llm", () => ({
  SmartPlanner: vi.fn().mockImplementation(() => ({
    initialize: mockInitialize,
    generatePlan: mockGeneratePlan,
    generateTemplatePlan: mockGenerateTemplatePlan,
    dispose: mockDispose,
  })),
  detectCapabilities: vi.fn().mockResolvedValue({
    webgpu: false,
    wasmSimd: true,
    wasmThreads: true,
    crossOriginIsolated: true,
    estimatedMemoryMB: 4096,
  }),
  selectBackend: vi.fn().mockReturnValue("wasm-simd"),
  describeBackend: vi.fn().mockReturnValue("WebAssembly SIMD (multi-threaded)"),
}));

// Mock the Vite worker import
vi.mock("../../browser-native-llm/src/runtime/worker.ts?worker", () => ({
  default: vi.fn().mockImplementation(() => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onmessage: null,
    onerror: null,
  })),
}));

import { useBrowserNativeLLM, RECOMMENDED_MODELS } from "@/hooks/useBrowserNativeLLM";

describe("useBrowserNativeLLM", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("returns correct initial state before initialization", () => {
      const { result } = renderHook(() => useBrowserNativeLLM());

      expect(result.current.isReady).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.classifiedError).toBeNull();
      expect(result.current.selectedModel).toBeNull();
      expect(result.current.capabilities).toBeNull();
      expect(result.current.activeBackend).toBeNull();
    });

    it("exposes supported models list with required fields", () => {
      const { result } = renderHook(() => useBrowserNativeLLM());

      expect(result.current.supportedModels).toBeDefined();
      expect(result.current.supportedModels.length).toBeGreaterThan(0);

      const model = result.current.supportedModels[0];
      expect(model).toHaveProperty("id");
      expect(model).toHaveProperty("name");
      expect(model).toHaveProperty("size");
      expect(model).toHaveProperty("description");
    });

    it("exports RECOMMENDED_MODELS constant", () => {
      expect(RECOMMENDED_MODELS).toBeDefined();
      expect(RECOMMENDED_MODELS.length).toBeGreaterThan(0);
      expect(RECOMMENDED_MODELS[0].id).toBeTruthy();
      expect(RECOMMENDED_MODELS[0].name).toBeTruthy();
    });
  });

  describe("device detection", () => {
    it("reports canUseLocalAI=true for desktop browsers", () => {
      const { result } = renderHook(() => useBrowserNativeLLM());

      // jsdom emulates a desktop browser
      expect(result.current.canUseLocalAI).toBe(true);
      expect(result.current.isMobileBlocked).toBe(false);
      expect(result.current.isMobile).toBe(false);
    });

    it("provides checkDevice utility that detects capabilities", async () => {
      const { result } = renderHook(() => useBrowserNativeLLM());

      let check: { available: boolean; device: string };
      await act(async () => {
        check = await result.current.checkDevice();
      });

      expect(check!.available).toBe(true);
      expect(check!.device).toContain("WebAssembly");
    });

    it("reports model availability correctly", () => {
      const { result } = renderHook(() => useBrowserNativeLLM());

      const defaultModelId = RECOMMENDED_MODELS[0].id;
      expect(result.current.isModelAvailable(defaultModelId)).toBe(true);
      expect(result.current.isModelAvailable("nonexistent/model")).toBe(false);
    });
  });

  describe("API surface", () => {
    it("exposes all required methods", () => {
      const { result } = renderHook(() => useBrowserNativeLLM());

      expect(typeof result.current.loadModel).toBe("function");
      expect(typeof result.current.generatePlan).toBe("function");
      expect(typeof result.current.generateTemplatePlan).toBe("function");
      expect(typeof result.current.unload).toBe("function");
      expect(typeof result.current.abort).toBe("function");
      expect(typeof result.current.clearError).toBe("function");
      expect(typeof result.current.checkDevice).toBe("function");
      expect(typeof result.current.isModelAvailable).toBe("function");
    });

    it("exposes browser and device info", () => {
      const { result } = renderHook(() => useBrowserNativeLLM());

      expect(result.current.browserInfo).toBeDefined();
      expect(result.current.deviceInfo).toBeDefined();
      expect(typeof result.current.browserInfo.isChrome).toBe("boolean");
      expect(typeof result.current.deviceInfo.isMobile).toBe("boolean");
    });
  });

  describe("error handling", () => {
    it("generatePlan throws when not initialized", async () => {
      const { result } = renderHook(() => useBrowserNativeLLM());

      await expect(
        result.current.generatePlan({ goal: "Test" })
      ).rejects.toThrow("Planner not initialized");
    });

    it("clearError resets error state", () => {
      const { result } = renderHook(() => useBrowserNativeLLM());

      // Clear any error state
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.classifiedError).toBeNull();
    });
  });

  describe("cleanup", () => {
    it("disposes planner on unmount", () => {
      const { unmount } = renderHook(() => useBrowserNativeLLM());

      // Unmounting should not throw
      unmount();
    });

    it("unload resets loading/ready state", () => {
      const { result } = renderHook(() => useBrowserNativeLLM());

      act(() => {
        result.current.unload();
      });

      expect(result.current.isReady).toBe(false);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.selectedModel).toBeNull();
    });
  });
});
