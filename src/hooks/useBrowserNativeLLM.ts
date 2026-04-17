/**
 * React hook wrapping the SMART planner runtime selector.
 *
 * Routes plan generation to either:
 * - the existing browser-local worker-backed planner, or
 * - the optional desktop helper running on 127.0.0.1.
 *
 * Retrieval, prompt assembly, validation, repair, and template fallback remain
 * in-browser through SmartPlanner. The desktop helper is inference-only.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { classifyAIError, type ClassifiedError } from "@/lib/error-handling";
import {
  generateWithDesktopHelper,
  getDesktopHelperHealth,
  loadDesktopHelper,
  unloadDesktopHelper,
  type DesktopHelperStatus,
} from "@/lib/desktop-helper-client";
import type { AIDraftRuntime } from "@/types/smart-tool";
import type {
  SMARTAction,
  SMARTPlan,
  RawUserInput,
  BrowserCapabilities,
  DownloadProgress,
  PlannerCallbacks,
  PlannerGenerateOptions,
  PipelineDebugLog,
  GenerationProfile,
  InferenceTransport,
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
    id: "amor-inteligente-built-in",
    name: "Amor inteligente (Built-in)",
    size: "Included",
    description: "Built-in offline AI planner (no external model download required)",
  },
];

const MOBILE_RECOMMENDED_MODELS: ModelInfo[] = [
  {
    id: "amor-inteligente-built-in",
    name: "Amor inteligente (Built-in Mobile)",
    size: "Included",
    description: "Built-in offline AI planner for mobile Safari",
  },
];

const LEGACY_MODEL_ID = "smart-planner-150m-q4";
const BUILTIN_MODEL_ID = "amor-inteligente-built-in";
const DESKTOP_HELPER_MODEL_ID = "smart-tool-planner-gguf-v1";

/** HuggingFace CDN fallback when local model files are not deployed. */
const REMOTE_MODEL_BASE_URL =
  "https://huggingface.co/HuggingFaceTB/SmolLM2-360M-Instruct/resolve/main/";

export type ActiveDraftRuntime = "browser" | "desktop-helper" | "template";

export interface UseBrowserNativeLLMOptions {
  /** Allow local LLM on iPhone/iPad (experimental). Android remains blocked. */
  allowMobileLLM?: boolean;
  /** Enable Safari WebGPU (experimental). */
  safariWebGPUEnabled?: boolean;
  /** Preferred draft runtime. */
  runtimePreference?: AIDraftRuntime;
}

// Re-export types for consumers
export type {
  SMARTAction,
  SMARTPlan,
  RawUserInput,
  PlannerCallbacks,
  PlannerGenerateOptions,
  PipelineDebugLog,
  GenerationProfile,
};

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
  activeBackend: string | null;
  activeRuntime: ActiveDraftRuntime | null;
  /** Whether the browser model is cached locally. */
  isCached: boolean | null;
  /** Last pipeline debug log (only populated when debug mode is enabled). */
  lastDebugLog: PipelineDebugLog | null;
  helperStatus: DesktopHelperStatus;
  helperMessage: string | null;
  helperBackend: string | null;
  helperModelId: string | null;
}

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
  activeRuntime: null,
  isCached: null,
  lastDebugLog: null,
  helperStatus: "checking",
  helperMessage: null,
  helperBackend: null,
  helperModelId: null,
};

/** Check if debug mode is enabled via localStorage. */
function isDebugEnabled(): boolean {
  try {
    return localStorage.getItem("smartTool.debug") === "true";
  } catch {
    return false;
  }
}

/** Map progress phase to user-facing status text. */
function progressPhaseToStatus(phase: string): string {
  switch (phase) {
    case "downloading":
      return "Downloading AI model…";
    case "caching":
      return "Caching model for offline use…";
    case "initializing":
      return "Loading model configuration…";
    case "session_creating":
      return "Creating inference session…";
    case "complete":
      return "Ready";
    default:
      return "Loading…";
  }
}

function isPlannerCallbacks(
  value: PlannerGenerateOptions | PlannerCallbacks | undefined,
): value is PlannerCallbacks {
  if (!value || typeof value !== "object") return false;

  return (
    "onProgress" in value ||
    "onBackendSelected" in value ||
    "onTokenGenerated" in value ||
    "onValidationResult" in value ||
    "onRepairAttempt" in value ||
    "onPlanRejected" in value ||
    "onDebugLog" in value ||
    "debug" in value
  );
}

function mapHelperStatus(ready: boolean, status?: string | null): DesktopHelperStatus {
  if (ready) return "ready";
  switch (status) {
    case "downloading-model":
      return "downloading-model";
    case "warming-up":
      return "warming-up";
    case "ready":
      return "ready";
    case "error":
      return "error";
    case "not-installed":
    default:
      return "not-installed";
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBrowserNativeLLM(options: UseBrowserNativeLLMOptions = {}) {
  const {
    allowMobileLLM = false,
    safariWebGPUEnabled = false,
    runtimePreference = "auto",
  } = options;

  const [state, setState] = useState<HookState>(INITIAL_STATE);

  // SmartPlanner lives across renders
  const plannerRef = useRef<InstanceType<typeof import("@smart-tool/browser-native-llm").SmartPlanner> | null>(null);
  const abortRef = useRef(false);

  // Memoise device/browser info (stable across renders)
  const browserInfo = useMemo(() => detectBrowser(), []);
  const deviceInfo = useMemo(() => detectDevice(), []);

  const isMobile = deviceInfo.isMobile;
  const supportsDesktopHelper = !isMobile;
  // Android is always blocked; iOS is blocked unless explicitly enabled
  const isMobileBlocked = deviceInfo.isAndroid || (deviceInfo.isIOS && !allowMobileLLM);
  const canUseLocalAI = !isMobileBlocked;

  // Resolve static assets from Vite BASE_URL so subfolder deployments work.
  const base = (import.meta as unknown as { env?: Record<string, string> }).env?.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const modelBaseRoot = `${normalizedBase}models/`;
  const retrievalPackUrl = `${normalizedBase}retrieval-packs/job-search-actions.json`;

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

  const disposePlanner = useCallback((resetReady: boolean = true) => {
    if (plannerRef.current) {
      plannerRef.current.dispose();
      plannerRef.current = null;
    }
    if (resetReady) {
      setState((prev) => ({
        ...prev,
        isReady: false,
        isGenerating: false,
        isLoading: false,
        selectedModel: null,
        loadingProgress: 0,
        loadingStatus: "",
        lastDebugLog: null,
        activeBackend: null,
        activeRuntime: null,
      }));
    }
  }, []);

  const checkHelperHealth = useCallback(async () => {
    if (!supportsDesktopHelper) {
      setState((prev) => ({
        ...prev,
        helperStatus: "not-installed",
        helperMessage: "Desktop accelerator is only available on desktop browsers.",
        helperBackend: null,
        helperModelId: null,
      }));
      return null;
    }

    try {
      const health = await getDesktopHelperHealth();
      setState((prev) => ({
        ...prev,
        helperStatus: mapHelperStatus(health.ready, health.status),
        helperMessage: health.message ?? null,
        helperBackend: health.backend ?? null,
        helperModelId: health.model_id ?? null,
      }));
      return health;
    } catch {
      setState((prev) => ({
        ...prev,
        helperStatus: "not-installed",
        helperMessage: "Desktop accelerator not installed or not running.",
        helperBackend: null,
        helperModelId: null,
      }));
      return null;
    }
  }, [supportsDesktopHelper]);

  const createDesktopHelperTransport = useCallback((): InferenceTransport => ({
    initialize: async () => {
      setState((prev) => ({
        ...prev,
        helperStatus: "warming-up",
        helperMessage: "Connecting to desktop accelerator…",
      }));
      const loadResult = await loadDesktopHelper(DESKTOP_HELPER_MODEL_ID);
      setState((prev) => ({
        ...prev,
        helperStatus: mapHelperStatus(loadResult.ready, loadResult.status),
        helperMessage: loadResult.message ?? null,
        helperBackend: loadResult.backend ?? prev.helperBackend,
        helperModelId: loadResult.model_id ?? DESKTOP_HELPER_MODEL_ID,
      }));
      return {
        backend: loadResult.backend ?? "desktop-helper",
      };
    },
    generate: async (prompt, config) => {
      const result = await generateWithDesktopHelper(prompt, config);
      setState((prev) => ({
        ...prev,
        helperStatus: "ready",
        helperBackend: result.backend,
        helperModelId: prev.helperModelId ?? DESKTOP_HELPER_MODEL_ID,
      }));
      return result;
    },
    dispose: () => {
      void unloadDesktopHelper().catch(() => undefined);
    },
  }), []);

  const initializeBrowser = useCallback(
    async (modelId?: string, overrideModelBaseUrl?: string): Promise<boolean> => {
      if (!canUseLocalAI) {
        setError("Local AI is not available on this device.");
        return false;
      }

      const requestedModelId = modelId || supportedModels[0]?.id;
      const effectiveModelId =
        requestedModelId === LEGACY_MODEL_ID ? BUILTIN_MODEL_ID : requestedModelId;
      if (!effectiveModelId) {
        setError("No model available for this device.");
        return false;
      }

      disposePlanner(false);

      const effectiveModelBaseUrl =
        overrideModelBaseUrl || `${modelBaseRoot}${LEGACY_MODEL_ID}/`;
      const isRemote = !!overrideModelBaseUrl;

      setState((prev) => ({
        ...prev,
        isLoading: true,
        loadingProgress: 0,
        loadingStatus: "Detecting browser capabilities…",
        error: null,
        classifiedError: null,
      }));

      try {
        const { detectCapabilities, selectBackend, SmartPlanner } = await import(
          "@smart-tool/browser-native-llm"
        );
        const capabilities = await detectCapabilities();

        let preferredBackend: string | undefined;
        if (safariWebGPUEnabled && browserInfo.isSafari && capabilities.webgpu) {
          preferredBackend = "webgpu";
        }
        const backend = selectBackend(capabilities, preferredBackend as never);

        setState((prev) => ({
          ...prev,
          loadingProgress: 5,
          loadingStatus: "Initializing AI engine…",
          capabilities,
          activeBackend: backend,
          activeRuntime: "browser",
        }));

        const workerModule = await import(
          "../../browser-native-llm/src/runtime/worker.ts?worker"
        );
        const worker: Worker = new workerModule.default();

        const planner = new SmartPlanner({
          inference: {
            model_id: BUILTIN_MODEL_ID,
            model_base_url: effectiveModelBaseUrl,
            preferred_backend: backend as never,
          },
          retrieval_pack_url: retrievalPackUrl,
          worker_url: "",
          worker,
          template_only: false,
          debug: isDebugEnabled(),
          runtime_label: "browser",
        });

        setState((prev) => ({
          ...prev,
          loadingProgress: 10,
          loadingStatus: isRemote
            ? "Downloading browser AI model…"
            : effectiveModelId === BUILTIN_MODEL_ID
              ? "Loading browser AI planner…"
              : "Downloading browser AI model…",
        }));

        await planner.initialize({
          onProgress: (progress: DownloadProgress) => {
            if (progress.total_bytes === 0 && progress.loaded_bytes === 0 && progress.phase) {
              const phaseProgress =
                progress.phase === "initializing" ? 8
                  : progress.phase === "session_creating" ? 92
                    : undefined;
              if (phaseProgress !== undefined) {
                setState((prev) => ({
                  ...prev,
                  loadingProgress: phaseProgress,
                  loadingStatus: progressPhaseToStatus(progress.phase),
                }));
              }
              return;
            }
            if (progress.total_bytes > 0) {
              const pct = Math.round((progress.loaded_bytes / progress.total_bytes) * 80) + 10;
              setState((prev) => ({
                ...prev,
                loadingProgress: Math.min(pct, 90),
                loadingStatus: progressPhaseToStatus(progress.phase),
              }));
            }
          },
          onBackendSelected: (selectedBackend: string) => {
            setState((prev) => ({ ...prev, activeBackend: selectedBackend }));
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
          activeRuntime: "browser",
        }));

        return true;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isModelNotFound = /404|not found|model.*config/i.test(errMsg);

        if (isModelNotFound && !isRemote) {
          console.warn(
            `[useBrowserNativeLLM] Local model files not found, falling back to remote HuggingFace CDN.`,
          );
          plannerRef.current = null;
          return initializeBrowser(effectiveModelId, REMOTE_MODEL_BASE_URL);
        }

        const isMemoryError = /memory|OOM|allocation|crash|Worker error|Worker crashed/i.test(errMsg);
        if (isMemoryError && deviceInfo.isIOS) {
          plannerRef.current = null;
          setError(
            new Error(
              "Not enough memory to run the AI model on this device. " +
              "Try closing other browser tabs and apps, then try again. " +
              "If the issue persists, use Smart Templates instead.",
            ),
          );
          return false;
        }

        plannerRef.current = null;
        setError(err);
        return false;
      }
    },
    [
      browserInfo.isSafari,
      canUseLocalAI,
      deviceInfo.isIOS,
      disposePlanner,
      modelBaseRoot,
      retrievalPackUrl,
      safariWebGPUEnabled,
      setError,
      supportedModels,
    ],
  );

  const initializeDesktopHelper = useCallback(async (): Promise<boolean> => {
    disposePlanner(false);

    setState((prev) => ({
      ...prev,
      isLoading: true,
      loadingProgress: 15,
      loadingStatus: "Connecting to desktop accelerator…",
      error: null,
      classifiedError: null,
      helperStatus: "warming-up",
      activeRuntime: "desktop-helper",
    }));

    try {
      const { SmartPlanner, DEFAULT_INFERENCE_CONFIG } = await import("@smart-tool/browser-native-llm");

      const planner = new SmartPlanner({
        inference: {
          ...DEFAULT_INFERENCE_CONFIG,
          model_id: DESKTOP_HELPER_MODEL_ID,
          model_base_url: "desktop-helper://local/",
        },
        retrieval_pack_url: retrievalPackUrl,
        worker_url: "",
        template_only: false,
        debug: isDebugEnabled(),
        runtime_label: "desktop-helper",
        inference_transport: createDesktopHelperTransport(),
      });

      setState((prev) => ({
        ...prev,
        loadingProgress: 45,
        loadingStatus: "Warming up desktop accelerator…",
      }));

      await planner.initialize({
        onBackendSelected: (selectedBackend: string) => {
          setState((prev) => ({
            ...prev,
            activeBackend: selectedBackend,
            helperBackend: selectedBackend,
          }));
        },
      });

      plannerRef.current = planner;

      setState((prev) => ({
        ...prev,
        isLoading: false,
        loadingProgress: 100,
        loadingStatus: "Ready",
        isReady: true,
        selectedModel: DESKTOP_HELPER_MODEL_ID,
        activeRuntime: "desktop-helper",
        helperStatus: "ready",
      }));

      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (canUseLocalAI) {
        setState((prev) => ({
          ...prev,
          helperStatus: "using-browser-fallback",
          helperMessage: errMsg,
        }));
        return initializeBrowser();
      }
      setError(err);
      return false;
    }
  }, [canUseLocalAI, createDesktopHelperTransport, disposePlanner, initializeBrowser, retrievalPackUrl, setError]);

  const resolveDesiredRuntime = useCallback(async (): Promise<ActiveDraftRuntime> => {
    if (runtimePreference === "browser") {
      return canUseLocalAI ? "browser" : "template";
    }

    if (supportsDesktopHelper) {
      const health = await checkHelperHealth();
      if (health?.ok || health?.ready || health?.status === "ready") {
        return "desktop-helper";
      }
    }

    if (runtimePreference === "desktop-helper") {
      return canUseLocalAI ? "browser" : "template";
    }

    return canUseLocalAI ? "browser" : "template";
  }, [canUseLocalAI, checkHelperHealth, runtimePreference, supportsDesktopHelper]);

  // ---------------------------------------------------------------------------
  // initialize — load preferred runtime via SmartPlanner
  // ---------------------------------------------------------------------------

  const initialize = useCallback(
    async (modelId?: string): Promise<boolean> => {
      const desiredRuntime = await resolveDesiredRuntime();

      if (desiredRuntime === "desktop-helper") {
        return initializeDesktopHelper();
      }
      if (desiredRuntime === "browser") {
        return initializeBrowser(modelId);
      }

      setError("Local AI is not available on this device.");
      return false;
    },
    [initializeBrowser, initializeDesktopHelper, resolveDesiredRuntime, setError],
  );

  // ---------------------------------------------------------------------------
  // generatePlan — full SmartPlanner pipeline
  // ---------------------------------------------------------------------------

  const generatePlan = useCallback(
    async (
      input: RawUserInput,
      optionsOrCallbacks?: PlannerGenerateOptions | PlannerCallbacks,
      maybeCallbacks?: PlannerCallbacks,
    ): Promise<SMARTPlan> => {
      const planner = plannerRef.current;
      if (!planner || !state.isReady) {
        throw new Error("Planner not initialized. Call initialize() first.");
      }

      const options = maybeCallbacks
        ? (optionsOrCallbacks as PlannerGenerateOptions | undefined) ?? {}
        : isPlannerCallbacks(optionsOrCallbacks)
          ? {}
          : (optionsOrCallbacks as PlannerGenerateOptions | undefined) ?? {};
      const callbacks = maybeCallbacks
        ? maybeCallbacks
        : isPlannerCallbacks(optionsOrCallbacks)
          ? optionsOrCallbacks
          : undefined;

      const debugNow = isDebugEnabled();
      const mergedCallbacks: PlannerCallbacks = {
        ...callbacks,
        debug: debugNow || callbacks?.debug,
        onDebugLog: (log) => {
          setState((prev) => ({ ...prev, lastDebugLog: log }));
          callbacks?.onDebugLog?.(log);
        },
      };

      setState((prev) => ({ ...prev, isGenerating: true, error: null, classifiedError: null }));
      abortRef.current = false;

      try {
        return await planner.generatePlan(input, options, mergedCallbacks);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const isWorkerCrash = /Worker error|Worker crashed|memory|OOM/i.test(errMsg);
        if (isWorkerCrash && deviceInfo.isIOS) {
          const iosErr = new Error(
            "The AI model ran out of memory on this device. " +
            "Close other tabs and apps, then reload and try again.",
          );
          setError(iosErr);
          throw iosErr;
        }
        setError(err);
        throw err;
      } finally {
        setState((prev) => ({ ...prev, isGenerating: false }));
      }
    },
    [deviceInfo.isIOS, setError, state.isReady],
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
    disposePlanner();
    setState((prev) => ({
      ...prev,
      helperStatus: prev.activeRuntime === "desktop-helper" ? "warming-up" : prev.helperStatus,
    }));
  }, [disposePlanner]);

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
        "@smart-tool/browser-native-llm",
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
  // checkCached — lightweight mount-time check if model is in Cache API
  // ---------------------------------------------------------------------------

  const checkCached = useCallback(async (): Promise<boolean> => {
    if (!canUseLocalAI) return false;
    try {
      const { ModelCache } = await import("@smart-tool/puente-engine");
      const cache = new ModelCache();
      if (!cache.isAvailable()) return false;
      const localUrl = `${modelBaseRoot}${LEGACY_MODEL_ID}/onnx/model_q4.onnx`;
      const remoteUrl = `${REMOTE_MODEL_BASE_URL}onnx/model_q4.onnx`;
      return (await cache.has(localUrl)) || (await cache.has(remoteUrl));
    } catch {
      return false;
    }
  }, [canUseLocalAI, modelBaseRoot]);

  // ---------------------------------------------------------------------------
  // preloadIfCached — silently load browser model if already cached
  // ---------------------------------------------------------------------------

  const preloadingRef = useRef(false);
  const preloadIfCached = useCallback(async (): Promise<boolean> => {
    if (state.isLoading || state.isReady || preloadingRef.current) return false;
    if (runtimePreference === "desktop-helper") return false;
    const cached = state.isCached === true ? true : await checkCached();
    if (!cached) return false;

    preloadingRef.current = true;
    try {
      const result = await initializeBrowser();
      return result;
    } finally {
      preloadingRef.current = false;
    }
  }, [checkCached, initializeBrowser, runtimePreference, state.isCached, state.isLoading, state.isReady]);

  // ---------------------------------------------------------------------------
  // Mount-time checks
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (canUseLocalAI) {
      void checkCached().then((cached) => {
        setState((prev) => ({ ...prev, isCached: cached }));
      });
    }
  }, [canUseLocalAI, checkCached]);

  useEffect(() => {
    if (runtimePreference !== "browser") {
      void checkHelperHealth();
    }
  }, [checkHelperHealth, runtimePreference]);

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
    ...state,

    runtimePreference,
    supportsDesktopHelper,

    // Device / browser info
    isMobile,
    isMobileBlocked,
    allowMobileLLM,
    canUseLocalAI,
    browserInfo,
    deviceInfo,
    supportedModels,

    // Actions — runtime selector API
    loadModel: initialize,
    generatePlan,
    generateTemplatePlan,
    unload: dispose,
    abort,
    clearError,
    checkDevice,
    isModelAvailable,
    checkCached,
    preloadIfCached,
    refreshHelperHealth: checkHelperHealth,

    // Debug
    lastDebugLog: state.lastDebugLog,
  };
}
