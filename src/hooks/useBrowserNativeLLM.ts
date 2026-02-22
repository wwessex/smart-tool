/**
 * React hook wrapping the Amor inteligente AI Engine (browser-native-llm).
 *
 * Provides the full SmartPlanner pipeline:
 * profile normalisation → retrieval → prompt assembly → inference →
 * JSON schema validation → repair loop → template fallback.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { classifyAIError, type ClassifiedError } from "@/lib/error-handling";
import type {
  SMARTAction,
  SMARTPlan,
  RawUserInput,
  InferenceBackend,
  BrowserCapabilities,
  DownloadProgress,
  PlannerCallbacks,
} from "@smart-tool/browser-native-llm";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ModelInfo {
  id: string;
  name: string;
  size: string;
  description: string;
}

export const RECOMMENDED_MODELS: ModelInfo[] = [
  {
    id: "smart-planner-150m-q4",
    name: "AI Module",
    size: "~80MB",
    description: "Offline AI drafting module",
  },
];

const MOBILE_RECOMMENDED_MODELS: ModelInfo[] = [
  {
    id: "smart-planner-150m-q4",
    name: "AI Module (Mobile)",
    size: "~80MB",
    description: "Offline AI drafting module for mobile Safari",
  },
];

export interface UseBrowserNativeLLMOptions {
  /** Allow local LLM on iPhone/iPad (experimental). Android remains blocked. */
  allowMobileLLM?: boolean;
  /** Enable Safari WebGPU (experimental). */
  safariWebGPUEnabled?: boolean;
}

// Re-export types for consumers
export type { SMARTAction, SMARTPlan, RawUserInput, PlannerCallbacks };

// ---------------------------------------------------------------------------
// Browser / device detection
// ---------------------------------------------------------------------------

interface BrowserInfo {
  isChrome: boolean;
  isEdge: boolean;
  isSafari: boolean;
  isFirefox: boolean;
  isMac: boolean;
  isWindows: boolean;
  isLinux: boolean;
}

interface DeviceInfo {
  isIOS: boolean;
  isIPhone: boolean;
  isIPad: boolean;
  isAndroid: boolean;
  isMobile: boolean;
}

function detectBrowser(): BrowserInfo {
  if (typeof navigator === "undefined") {
    return { isChrome: false, isEdge: false, isSafari: false, isFirefox: false, isMac: false, isWindows: false, isLinux: false };
  }
  const ua = navigator.userAgent;
  return {
    isChrome: /Chrome/.test(ua) && !/Edg/.test(ua) && !/OPR/.test(ua),
    isEdge: /Edg/.test(ua),
    isSafari: /Safari/.test(ua) && !/Chrome/.test(ua),
    isFirefox: /Firefox/.test(ua),
    isMac: /Macintosh/.test(ua),
    isWindows: /Windows/.test(ua),
    isLinux: /Linux/.test(ua) && !/Android/.test(ua),
  };
}

function detectDevice(): DeviceInfo {
  if (typeof navigator === "undefined") {
    return { isIOS: false, isIPhone: false, isIPad: false, isAndroid: false, isMobile: false };
  }
  const ua = navigator.userAgent || "";
  const isWindows = /Windows/i.test(ua);
  const isIPhone = /iPhone|iPod/i.test(ua);
  const platform = (navigator as unknown as { platform?: string }).platform || "";
  const maxTouchPoints = (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints || 0;
  const isIPad = !isWindows && (/iPad/i.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1));
  const isIOS = isIPhone || isIPad;
  const isAndroid = /android/i.test(ua);
  const isMobile = isIOS || isAndroid;
  return { isIOS, isIPhone, isIPad, isAndroid, isMobile };
}

// ---------------------------------------------------------------------------
// Hook state
// ---------------------------------------------------------------------------

interface HookState {
  isLoading: boolean;
  loadingProgress: number;
  loadingStatus: string;
  isGenerating: boolean;
  isReady: boolean;
  error: string | null;
  classifiedError: ClassifiedError | null;
  selectedModel: string | null;
  capabilities: BrowserCapabilities | null;
  activeBackend: InferenceBackend | null;
}

/** Maximum time (ms) to wait for plan generation before timing out. */
const PLAN_GENERATION_TIMEOUT_MS = 60_000;

const INITIAL_STATE: HookState = {
  isLoading: false,
  loadingProgress: 0,
  loadingStatus: "",
  isGenerating: false,
  isReady: false,
  error: null,
  classifiedError: null,
  selectedModel: null,
  capabilities: null,
  activeBackend: null,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBrowserNativeLLM(options: UseBrowserNativeLLMOptions = {}) {
  const { allowMobileLLM = false, safariWebGPUEnabled = false } = options;

  const [state, setState] = useState<HookState>(INITIAL_STATE);

  // SmartPlanner lives across renders
  const plannerRef = useRef<InstanceType<typeof import("@smart-tool/browser-native-llm").SmartPlanner> | null>(null);
  const abortRef = useRef(false);

  // Memoise device/browser info (stable across renders)
  const browserInfo = useMemo(() => detectBrowser(), []);
  const deviceInfo = useMemo(() => detectDevice(), []);

  const isMobile = deviceInfo.isMobile;
  // Android is always blocked; iOS is blocked unless explicitly enabled
  const isMobileBlocked = deviceInfo.isAndroid || (deviceInfo.isIOS && !allowMobileLLM);
  const canUseLocalAI = !isMobileBlocked;

  // Resolve model/retrieval assets from Vite's configured app base.
  const appBaseUrl = import.meta.env.BASE_URL;
  const modelBaseRoot = `${appBaseUrl}models/`;
  const retrievalPackUrl = `${appBaseUrl}retrieval-packs/job-search-actions.json`;

  const supportedModels = useMemo(() => {
    if (deviceInfo.isIOS || deviceInfo.isAndroid) return MOBILE_RECOMMENDED_MODELS;
    return RECOMMENDED_MODELS;
  }, [deviceInfo.isIOS, deviceInfo.isAndroid]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const setError = useCallback((error: unknown) => {
    const classified = classifyAIError(error);
    const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
    setState((prev) => ({
      ...prev,
      isLoading: false,
      isGenerating: false,
      error: msg,
      classifiedError: classified,
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // initialize — load model & retrieval pack via SmartPlanner
  // ---------------------------------------------------------------------------

  const initialize = useCallback(
    async (modelId?: string): Promise<boolean> => {
      if (!canUseLocalAI) {
        setError("Local AI is not available on this device.");
        return false;
      }

      const effectiveModelId = modelId || supportedModels[0]?.id;
      if (!effectiveModelId) {
        setError("No model available for this device.");
        return false;
      }

      // Dispose previous planner (and its worker) before re-initializing
      if (plannerRef.current) {
        plannerRef.current.dispose();
        plannerRef.current = null;
      }

      setState((prev) => ({
        ...prev,
        isLoading: true,
        loadingProgress: 0,
        loadingStatus: "Detecting browser capabilities…",
        error: null,
        classifiedError: null,
      }));

      try {
        // Step 1: detect capabilities
        const { detectCapabilities, selectBackend } = await import(
          "@smart-tool/browser-native-llm"
        );
        const capabilities = await detectCapabilities();

        // Choose backend (respect Safari WebGPU preference)
        let preferredBackend: InferenceBackend | undefined;
        if (safariWebGPUEnabled && browserInfo.isSafari && capabilities.webgpu) {
          preferredBackend = "webgpu";
        }
        const backend = selectBackend(capabilities, preferredBackend);

        setState((prev) => ({
          ...prev,
          loadingProgress: 5,
          loadingStatus: "Initializing AI engine…",
          capabilities,
          activeBackend: backend,
        }));

        // Step 2: create SmartPlanner
        const { SmartPlanner } = await import("@smart-tool/browser-native-llm");

        // Create worker via inline Blob URL so Vite bundles all dependencies
        const workerModule = await import(
          "../../browser-native-llm/src/runtime/worker.ts?worker"
        );
        const worker: Worker = new workerModule.default();

        const planner = new SmartPlanner({
          inference: {
            model_id: effectiveModelId,
            model_base_url: `${modelBaseRoot}${effectiveModelId}/`,
            preferred_backend: backend,
            max_seq_length: 1024,
            max_new_tokens: 512,
            temperature: 0,
            top_p: 1.0,
            repetition_penalty: 1.1,
          },
          retrieval_pack_url: retrievalPackUrl,
          worker_url: "",
          worker,
          max_repair_attempts: 2,
          min_validation_score: 60,
        });

        // Step 3: initialize planner (loads retrieval pack + model via worker)
        setState((prev) => ({
          ...prev,
          loadingProgress: 10,
          loadingStatus: "Downloading AI model…",
        }));

        await planner.initialize({
          onProgress: (progress: DownloadProgress) => {
            if (progress.total_bytes > 0) {
              const pct = Math.round((progress.loaded_bytes / progress.total_bytes) * 80) + 10;
              setState((prev) => ({
                ...prev,
                loadingProgress: Math.min(pct, 90),
                loadingStatus:
                  progress.phase === "downloading"
                    ? "Downloading AI model…"
                    : progress.phase === "caching"
                      ? "Caching model for offline use…"
                      : "Finalizing…",
              }));
            }
          },
          onBackendSelected: (b: InferenceBackend) => {
            setState((prev) => ({ ...prev, activeBackend: b }));
          },
        });

        plannerRef.current = planner;

        setState((prev) => ({
          ...prev,
          isLoading: false,
          loadingProgress: 100,
          loadingStatus: "Ready",
          isReady: true,
          selectedModel: effectiveModelId,
        }));

        return true;
      } catch (err) {
        // If the model wasn't found (404), fall back to the default model once.
        const fallbackId = "smart-planner-150m-q4";
        const errMsg = err instanceof Error ? err.message : String(err);
        const isModelNotFound = /404|not found|model.*config/i.test(errMsg);

        if (isModelNotFound && effectiveModelId !== fallbackId) {
          console.warn(
            `[useBrowserNativeLLM] Model "${effectiveModelId}" not found, falling back to "${fallbackId}".`
          );
          plannerRef.current = null;
          return initialize(fallbackId);
        }

        plannerRef.current = null;
        setError(err);
        return false;
      }
    },
    [canUseLocalAI, supportedModels, safariWebGPUEnabled, browserInfo.isSafari, setError],
  );

  // ---------------------------------------------------------------------------
  // generatePlan — full SmartPlanner pipeline
  // ---------------------------------------------------------------------------

  const generatePlan = useCallback(
    async (input: RawUserInput, callbacks?: PlannerCallbacks): Promise<SMARTPlan> => {
      const planner = plannerRef.current;
      if (!planner || !state.isReady) {
        throw new Error("Planner not initialized. Call initialize() first.");
      }

      setState((prev) => ({ ...prev, isGenerating: true, error: null, classifiedError: null }));
      abortRef.current = false;

      try {
        const plan = await Promise.race([
          planner.generatePlan(input, callbacks),
          new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error("Plan generation timed out")),
              PLAN_GENERATION_TIMEOUT_MS,
            );
          }),
        ]);
        setState((prev) => ({ ...prev, isGenerating: false }));
        return plan;
      } catch (err) {
        setError(err);
        throw err;
      }
    },
    [state.isReady, setError],
  );

  // ---------------------------------------------------------------------------
  // generateTemplatePlan — template-only fallback (no LLM inference)
  // ---------------------------------------------------------------------------

  const generateTemplatePlan = useCallback(
    (input: RawUserInput): SMARTPlan => {
      const planner = plannerRef.current;
      if (!planner) {
        throw new Error("Planner not initialized. Call initialize() first.");
      }
      return planner.generateTemplatePlan(input);
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // dispose / unload
  // ---------------------------------------------------------------------------

  const dispose = useCallback(() => {
    if (plannerRef.current) {
      plannerRef.current.dispose();
      plannerRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      isReady: false,
      isGenerating: false,
      isLoading: false,
      selectedModel: null,
      loadingProgress: 0,
      loadingStatus: "",
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // abort
  // ---------------------------------------------------------------------------

  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  // ---------------------------------------------------------------------------
  // clearError
  // ---------------------------------------------------------------------------

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, classifiedError: null }));
  }, []);

  // ---------------------------------------------------------------------------
  // checkDevice — check browser capabilities
  // ---------------------------------------------------------------------------

  const checkDevice = useCallback(async (): Promise<{
    available: boolean;
    device: string;
    error?: string;
  }> => {
    try {
      const { detectCapabilities, describeBackend, selectBackend } = await import(
        "@smart-tool/browser-native-llm"
      );
      const caps = await detectCapabilities();
      const backend = selectBackend(caps);
      return {
        available: true,
        device: describeBackend(backend, caps),
      };
    } catch (err) {
      return {
        available: false,
        device: "unknown",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, []);

  // ---------------------------------------------------------------------------
  // isModelAvailable
  // ---------------------------------------------------------------------------

  const isModelAvailable = useCallback(
    (modelId: string): boolean => {
      return supportedModels.some((m) => m.id === modelId);
    },
    [supportedModels],
  );

  // ---------------------------------------------------------------------------
  // Cleanup on unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (plannerRef.current) {
        plannerRef.current.dispose();
        plannerRef.current = null;
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // State
    ...state,

    // Device / browser info
    isMobile,
    isMobileBlocked,
    allowMobileLLM,
    canUseLocalAI,
    browserInfo,
    deviceInfo,
    supportedModels,

    // Actions — plan-based API
    loadModel: initialize,
    generatePlan,
    generateTemplatePlan,
    unload: dispose,
    abort,
    clearError,
    checkDevice,
    isModelAvailable,
  };
}
