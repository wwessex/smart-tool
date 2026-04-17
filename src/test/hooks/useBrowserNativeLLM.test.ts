import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const {
  mockGetDesktopHelperHealth,
  mockLoadDesktopHelper,
  mockGenerateWithDesktopHelper,
  mockUnloadDesktopHelper,
} = vi.hoisted(() => ({
  mockGetDesktopHelperHealth: vi.fn(),
  mockLoadDesktopHelper: vi.fn(),
  mockGenerateWithDesktopHelper: vi.fn(),
  mockUnloadDesktopHelper: vi.fn(),
}));

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
    generation_profile: "default_plan" as const,
    repair_attempts: 0,
  },
});
const mockGenerateTemplatePlan = vi.fn().mockReturnValue({
  actions: [{ action: "Template action", metric: "1", baseline: "0", target: "1", deadline: "2026-03-07", rationale: "Template", effort_estimate: "1h", first_step: "Start" }],
  metadata: { model_id: "template-only", model_version: "0.1.0", backend: "wasm-basic", retrieval_pack_version: "1.0.0", generated_at: new Date().toISOString(), generation_time_ms: 5, tokens_generated: 0, generation_profile: "default_plan", repair_attempts: 0 },
});
const mockDispose = vi.fn();
const mockCacheHas = vi.fn().mockResolvedValue(false);
const mockCacheMatch = vi.fn().mockResolvedValue(undefined);
const mockCachesOpen = vi.fn().mockResolvedValue({
  match: mockCacheMatch,
  put: vi.fn(),
  delete: vi.fn(),
});
const mockPuenteEngineModule = {
  ModelCache: vi.fn().mockImplementation(() => ({
    isAvailable: () => true,
    has: mockCacheHas,
  })),
};
const mockBrowserNativeLLMModule = {
  DEFAULT_INFERENCE_CONFIG: {
    model_id: "test-model",
    model_base_url: "./models/test/",
    max_seq_length: 1024,
    max_new_tokens: 512,
    temperature: 0.5,
    top_p: 0.85,
    repetition_penalty: 1.3,
  },
  SmartPlanner: vi.fn().mockImplementation((config) => ({
    initialize: vi.fn(async (callbacks = {}) => {
      mockInitialize(config, callbacks);
      if (config?.inference_transport?.initialize) {
        const result = await config.inference_transport.initialize(callbacks);
        if (result?.backend && callbacks?.onBackendSelected) {
          callbacks.onBackendSelected(result.backend);
        }
      }
    }),
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
};

vi.mock("@smart-tool/browser-native-llm", () => mockBrowserNativeLLMModule);
vi.mock("../../../browser-native-llm/src/index.ts", () => mockBrowserNativeLLMModule);

vi.mock("@smart-tool/puente-engine", () => mockPuenteEngineModule);
vi.mock("../../../puente-engine/src/index.ts", () => mockPuenteEngineModule);
vi.mock("@/lib/desktop-helper-client", () => ({
  getDesktopHelperHealth: mockGetDesktopHelperHealth,
  loadDesktopHelper: mockLoadDesktopHelper,
  generateWithDesktopHelper: mockGenerateWithDesktopHelper,
  unloadDesktopHelper: mockUnloadDesktopHelper,
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
    mockCacheHas.mockResolvedValue(false);
    mockCacheMatch.mockResolvedValue(undefined);
    mockGetDesktopHelperHealth.mockResolvedValue({
      ok: false,
      ready: false,
      status: "not-installed",
      backend: null,
      model_id: null,
      message: "Desktop helper not installed",
    });
    mockLoadDesktopHelper.mockResolvedValue({
      ok: true,
      ready: true,
      status: "ready",
      backend: "llama.cpp-cpu",
      model_id: "smart-tool-planner-gguf-v1",
      message: "Ready",
    });
    mockGenerateWithDesktopHelper.mockResolvedValue({
      text: "Generated locally",
      tokens_generated: 42,
      time_ms: 12,
      backend: "llama.cpp-cpu",
    });
    mockUnloadDesktopHelper.mockResolvedValue({ ok: true });
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: {
        open: mockCachesOpen,
        delete: vi.fn(),
      },
    });
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
      expect(typeof result.current.preloadIfCached).toBe("function");
      expect(typeof result.current.refreshHelperHealth).toBe("function");
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
      await act(async () => {});

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

  describe("cached prewarm", () => {
    it("detects when the planner model is already cached", async () => {
      mockCacheHas.mockResolvedValue(true);
      mockCacheMatch.mockResolvedValue(new Response("cached"));
      const { result } = renderHook(() => useBrowserNativeLLM());

      await waitFor(() => {
        expect(result.current.isCached).toBe(true);
      });
    });

    it("skips preload when the planner model is not cached", async () => {
      mockCacheHas.mockResolvedValue(false);
      const { result } = renderHook(() => useBrowserNativeLLM());

      let didPreload = true;
      await act(async () => {
        didPreload = await result.current.preloadIfCached();
      });

      expect(didPreload).toBe(false);
      expect(mockInitialize).not.toHaveBeenCalled();
    });
  });

  describe("runtime selection", () => {
    it("selects desktop-helper when preferred and healthy", async () => {
      mockGetDesktopHelperHealth.mockResolvedValue({
        ok: true,
        ready: true,
        status: "ready",
        backend: "llama.cpp-cpu",
        model_id: "smart-tool-planner-gguf-v1",
        message: "Ready",
      });

      const { result } = renderHook(() => useBrowserNativeLLM({ runtimePreference: "desktop-helper" }));

      await act(async () => {
        await result.current.loadModel();
      });

      expect(result.current.activeRuntime).toBe("desktop-helper");
      expect(result.current.helperStatus).toBe("ready");
      expect(mockLoadDesktopHelper).toHaveBeenCalledWith("smart-tool-planner-gguf-v1");
    });

    it("falls back to browser runtime when desktop-helper preference is unavailable", async () => {
      mockGetDesktopHelperHealth.mockResolvedValue({
        ok: false,
        ready: false,
        status: "not-installed",
        backend: null,
        model_id: null,
        message: "Desktop helper not installed",
      });

      const { result } = renderHook(() => useBrowserNativeLLM({ runtimePreference: "desktop-helper" }));

      await act(async () => {
        await result.current.loadModel(RECOMMENDED_MODELS[0].id);
      });

      expect(result.current.activeRuntime).toBe("browser");
      expect(mockLoadDesktopHelper).not.toHaveBeenCalled();
    });
  });
});
