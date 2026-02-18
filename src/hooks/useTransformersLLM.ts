import { useState, useCallback, useRef, useEffect, useMemo } from "react";

export interface ModelInfo {
  id: string;
  name: string;
  size: string;
  description: string;
}

// Smaller models that work with Transformers.js + WASM fallback for Safari/Firefox
export const RECOMMENDED_MODELS: ModelInfo[] = [
  {
    id: "HuggingFaceTB/SmolLM2-360M-Instruct",
    // Keep this simple for end users.
    name: "AI Module",
    size: "~500MB",
    description: "Offline AI drafting module",
  },
];

// Extra-small model for iPhone/iPad stability.
const MOBILE_RECOMMENDED_MODELS: ModelInfo[] = [
  {
    id: "HuggingFaceTB/SmolLM2-135M-Instruct",
    name: "AI Module (Mobile)",
    size: "~220MB",
    description: "Smaller offline AI module for mobile Safari",
  },
];

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GenerationConfig {
  max_new_tokens?: number;
  temperature?: number;
  do_sample?: boolean;
}

// Optimized generation configs for different prompt types
export const GENERATION_CONFIGS: Record<string, GenerationConfig> = {
  action: { max_new_tokens: 80, temperature: 0.6, do_sample: true },
  help: { max_new_tokens: 40, temperature: 0.5, do_sample: true },
  outcome: { max_new_tokens: 60, temperature: 0.6, do_sample: true },
  improve: { max_new_tokens: 200, temperature: 0.7, do_sample: true },
  chat: { max_new_tokens: 150, temperature: 0.7, do_sample: true },
  translate: { max_new_tokens: 260, temperature: 0.2, do_sample: false },
  default: { max_new_tokens: 100, temperature: 0.7, do_sample: true },
};

interface UseTransformersLLMState {
  isLoading: boolean;
  loadingProgress: number;
  loadingStatus: string;
  isGenerating: boolean;
  isReady: boolean;
  error: string | null;
  selectedModel: string | null;
  isWarmedUp: boolean;
}

// Transformers.js can return either chat format (array of messages) or raw text format (string)
type GeneratedOutput = Array<{ role: string; content: string }> | string;

type TextGenerationPipeline = (
  messages: Array<{ role: string; content: string }>,
  options?: { max_new_tokens?: number; do_sample?: boolean; temperature?: number }
) => Promise<Array<{ generated_text: GeneratedOutput }>>;

// Browser and platform detection for optimization
interface BrowserInfo {
  isChrome: boolean;
  isEdge: boolean;
  isSafari: boolean;
  isFirefox: boolean;
  isMac: boolean;
  isWindows: boolean;
  isLinux: boolean;
}

// Check if SharedArrayBuffer is available (requires cross-origin isolation)
function isSharedArrayBufferAvailable(): boolean {
  try {
    // SharedArrayBuffer requires cross-origin isolation (COOP/COEP headers)
    // If not available, multi-threaded WASM will fail
    return typeof SharedArrayBuffer !== "undefined";
  } catch {
    return false;
  }
}


// Device classification (used to decide whether local LLM is allowed)
interface DeviceInfo {
  isIOS: boolean;
  isIPhone: boolean;
  isIPad: boolean;
  isAndroid: boolean;
  isMobile: boolean;
}

function detectDevice(): DeviceInfo {
  if (typeof navigator === "undefined") {
    return { isIOS: false, isIPhone: false, isIPad: false, isAndroid: false, isMobile: false };
  }

  const ua = navigator.userAgent || "";
  // Explicitly detect Windows to ensure it's never misclassified as mobile
  const isWindows = /Windows/i.test(ua);
  const isIPhone = /iPhone|iPod/i.test(ua);
  // iPadOS 13+ reports as MacIntel + touch points, but ensure we don't misdetect Windows touchscreens
  const platform = (navigator as unknown as { platform?: string }).platform || "";
  const maxTouchPoints = (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints || 0;
  const isIPad = !isWindows && (/iPad/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1));
  const isIOS = isIPhone || isIPad;
  const isAndroid = /android/i.test(ua);
  const isMobile = isIOS || isAndroid;

  return { isIOS, isIPhone, isIPad, isAndroid, isMobile };
}

export interface UseTransformersLLMOptions {
  // Allow local LLM on iPhone/iPad (experimental). Android remains blocked.
  allowMobileLLM?: boolean;
  // Enable Safari WebGPU (experimental).
  safariWebGPUEnabled?: boolean;
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

// Get browser-specific optimizations
function getBrowserOptimizations(
  browser: BrowserInfo,
  options: { safariWebGPUEnabled?: boolean } = {}
): {
  preferWebGPU: boolean;
  wasmThreads: number;
  dtype: "q4" | "fp16" | "fp32";
  notes: string;
} {
  // WebGPU is most stable on Windows Chrome/Edge
  // Safari has experimental WebGPU but WASM is more reliable
  // Firefox uses WASM with reduced threads due to SharedArrayBuffer limitations

  // Check if SharedArrayBuffer is available for multi-threaded WASM
  // Without cross-origin isolation headers (COOP/COEP), SharedArrayBuffer is unavailable
  // and multi-threaded WASM will fail with cryptic errors
  const hasSharedArrayBuffer = isSharedArrayBufferAvailable();

  if (browser.isChrome || browser.isEdge) {
    // Chrome/Edge on Windows have excellent WebGPU support
    // Chrome on Mac has decent WebGPU but can be unstable
    // If SharedArrayBuffer is unavailable, fall back to single-threaded WASM
    const desiredThreads = 4;
    const safeThreads = hasSharedArrayBuffer ? desiredThreads : 1;
    const threadNote = !hasSharedArrayBuffer ? " (single-threaded: no cross-origin isolation)" : "";
    return {
      preferWebGPU: browser.isWindows || browser.isLinux,
      wasmThreads: safeThreads,
      dtype: "q4",
      notes: (browser.isWindows ? "Optimized for Chrome/Edge on Windows" : "Using compatible settings") + threadNote,
    };
  }
  
  if (browser.isSafari) {
    // Safari can expose WebGPU, but iOS/iPadOS is prone to tab reloads during heavy
    // WebGPU model init (memory/GPU resets). For stability, force WASM on iPhone/iPad.
    const device = detectDevice();
    const isIOSFamily = device.isIPhone || device.isIPad;
    const safariWebGPUEnabled = !!options.safariWebGPUEnabled;
    const hasWebGPU =
      !isIOSFamily &&
      typeof navigator !== 'undefined' &&
      !!(navigator as Navigator & { gpu?: unknown }).gpu;
    return {
      preferWebGPU: safariWebGPUEnabled && hasWebGPU,
      // Keep threads at 1 to avoid SharedArrayBuffer/COOP+COEP requirements that can break
      // local inference on Safari/iPadOS deployments.
      wasmThreads: 1,
      dtype: 'q4',
      notes: safariWebGPUEnabled && hasWebGPU
        ? 'Using WebGPU on Safari (experimental)'
        : 'Using WASM for Safari compatibility',
    };
  }
  
  if (browser.isFirefox) {
    // Firefox has threading limitations
    return {
      preferWebGPU: false,
      wasmThreads: 1,
      dtype: "q4",
      notes: "Optimized for Firefox (WASM with reduced threads)",
    };
  }
  
  // Default fallback
  // Use multi-threaded only if SharedArrayBuffer is available
  return {
    preferWebGPU: false,
    wasmThreads: hasSharedArrayBuffer ? 2 : 1,
    dtype: "q4",
    notes: hasSharedArrayBuffer ? "Using compatible WASM settings" : "Using compatible WASM settings (single-threaded: no cross-origin isolation)",
  };
}

// Detect mobile device (phones). iPad can be enabled via settings.
const isMobileDevice = (): boolean => {
  const d = detectDevice();
  // Treat phones as mobile; iPad is handled separately.
  return d.isIPhone || d.isAndroid;
};

// Export mobile check for use in other components
export const checkIsMobile = isMobileDevice;

// Log platform info for debugging
function logPlatformInfo(safariWebGPUEnabled: boolean): void {
  if (typeof navigator === "undefined") return;

  const browser = detectBrowser();
  const optimizations = getBrowserOptimizations(browser, { safariWebGPUEnabled });
  const hasWebGPU = !!(navigator as Navigator & { gpu?: unknown }).gpu;
  const hasSharedArrayBuffer = isSharedArrayBufferAvailable();
  const memory = (performance as { memory?: { jsHeapSizeLimit?: number } }).memory?.jsHeapSizeLimit;
  const cores = navigator.hardwareConcurrency;

  console.log("[LLM Platform]", {
    browser: browser.isChrome ? "Chrome" : browser.isEdge ? "Edge" : browser.isSafari ? "Safari" : browser.isFirefox ? "Firefox" : "Other",
    os: browser.isMac ? "macOS" : browser.isWindows ? "Windows" : browser.isLinux ? "Linux" : "Other",
    webgpuAvailable: hasWebGPU,
    preferWebGPU: optimizations.preferWebGPU,
    sharedArrayBuffer: hasSharedArrayBuffer,
    wasmThreads: optimizations.wasmThreads,
    memoryLimit: memory ? `${Math.round(memory / 1024 / 1024)}MB` : "unknown",
    cores,
    notes: optimizations.notes,
  });
}

// Best-effort attempt to reduce Safari/iOS cache eviction and increase quota.
async function ensurePersistentStorage(): Promise<{ persisted: boolean; granted: boolean; usage?: number; quota?: number }> {
  try {
    const storage = (navigator as Navigator & { storage?: any }).storage;
    if (!storage) return { persisted: false, granted: false };

    const persisted = typeof storage.persisted === 'function' ? await storage.persisted() : false;
    let granted = persisted;
    if (!persisted && typeof storage.persist === 'function') {
      granted = await storage.persist();
    }

    let usage: number | undefined;
    let quota: number | undefined;
    if (typeof storage.estimate === 'function') {
      const est = await storage.estimate();
      usage = est?.usage;
      quota = est?.quota;
    }

    return { persisted: persisted || granted, granted, usage, quota };
  } catch {
    return { persisted: false, granted: false };
  }
}


export function useTransformersLLM(options: UseTransformersLLMOptions = {}) {
  const [state, setState] = useState<UseTransformersLLMState>({
    isLoading: false,
    loadingProgress: 0,
    loadingStatus: "",
    isGenerating: false,
    isReady: false,
    error: null,
    selectedModel: null,
    isWarmedUp: false,
  });

  const pipelineRef = useRef<TextGenerationPipeline | null>(null);
  const abortRef = useRef<boolean>(false);
  const browserRef = useRef<BrowserInfo>(detectBrowser());
  const deviceRef = useRef<DeviceInfo>(detectDevice());
  const retryCountRef = useRef<number>(0);
  const fetchCacheInstalledRef = useRef<boolean>(false);


  // Device policy: Android remains blocked; iPhone/iPad can be enabled via settings (experimental).
  const device = deviceRef.current;
  const allowMobileLLM = !!options.allowMobileLLM && device.isIOS;
  const safariWebGPUEnabled = !!options.safariWebGPUEnabled;
  const isMobileBlocked = (device.isAndroid || (device.isIOS && device.isMobile && !allowMobileLLM));
  const isMobile = device.isMobile;

  // Filter supported models for this device (keeps iOS stable)
  const supportedModels = useMemo<ModelInfo[]>(() => {
    // Android remains blocked.
    if (device.isAndroid) return [];

    // iPhone/iPad: allow only when the experimental toggle is enabled.
    if (device.isMobile && !allowMobileLLM) return [];

    if (device.isIOS) {
      return device.isIPhone ? MOBILE_RECOMMENDED_MODELS : RECOMMENDED_MODELS;
    }

    // Otherwise (desktop + enabled iOS), allow the single recommended module.
    return RECOMMENDED_MODELS;
  }, [allowMobileLLM, device.isAndroid, device.isMobile, device.isIOS, device.isIPhone]);

  // iOS memory guardrails
  const isIOSMobile = device.isIOS && device.isMobile && allowMobileLLM;
  const iosTokenCap = isIOSMobile ? (device.isIPhone ? 64 : 120) : null;


  // Check if model is in our recommended list (for this device)
  const isModelAvailable = useCallback((modelId: string): boolean => {
    return supportedModels.some((m) => m.id === modelId);
  }, [supportedModels]);

  // Check device capabilities - Transformers.js works with both WebGPU and WASM - Transformers.js works with both WebGPU and WASM
  const checkDevice = useCallback(async (): Promise<{ 
    available: boolean; 
    device: "webgpu" | "wasm"; 
    error?: string 
  }> => {
    // Mobile policy
    if (isMobileBlocked) {
      return { 
        available: false, 
        device: "wasm",
        error: device.isAndroid ? "Local AI is not available on Android yet. Use template-based drafting instead." : "Local AI is disabled on iPhone/iPad by default. Enable it in Settings (Experimental Local AI) and use the smallest model." 
      };
    }

    const browser = browserRef.current;
    const optimizations = getBrowserOptimizations(browser, { safariWebGPUEnabled });
    
    // Try WebGPU first if preferred for this browser
    if (optimizations.preferWebGPU) {
      const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown | null> } };
      
      if (nav.gpu) {
        try {
          const adapter = await nav.gpu.requestAdapter();
          if (adapter) {
            return { available: true, device: "webgpu" };
          }
        } catch {
          console.log("[LLM] WebGPU adapter request failed, falling back to WASM");
        }
      }
    }
    
    // WASM is available as fallback on desktop
    return { available: true, device: "wasm" };
  }, [isMobileBlocked, device, safariWebGPUEnabled]);

  // Warmup the model with a realistic generation that matches actual usage
  // If warmup fails, the model is likely broken and shouldn't be marked as ready
  const warmupModel = useCallback(async (generator: TextGenerationPipeline): Promise<void> => {
    const maxAttempts = 3;
    let lastError: unknown;

    // Use a realistic warmup that mimics actual draft generation:
    // - System prompt (like we use in real generation)
    // - User prompt with context
    // - 30 tokens (less than action's 80 but enough to validate generation works)
    const warmupMessages = [
      { role: "system", content: "You are a helpful assistant that writes concise action plans." },
      { role: "user", content: "Write a short action for someone looking for work." }
    ];

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[LLM] Warming up model (attempt ${attempt}/${maxAttempts})...`);
        const result = await generator(warmupMessages, {
          max_new_tokens: 30,
          do_sample: true,
          temperature: 0.6
        });

        // Validate that we actually got a response
        const generated = result[0]?.generated_text;
        const hasContent = Array.isArray(generated)
          ? generated.some((m: { role: string; content: string }) => m.role === "assistant" && m.content?.trim())
          : typeof generated === "string" && generated.trim().length > 0;

        if (!hasContent) {
          throw new Error("Warmup returned empty response");
        }

        console.log("[LLM] Warmup complete - model validated");
        return; // Success
      } catch (err) {
        lastError = err;
        console.warn(`[LLM] Warmup attempt ${attempt} failed:`, err);
        if (attempt < maxAttempts) {
          // Brief delay before retry
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }
    }

    // All attempts failed - throw to prevent marking model as ready
    const errorMsg = lastError instanceof Error ? lastError.message : "Unknown warmup error";
    throw new Error(`Model warmup failed after ${maxAttempts} attempts: ${errorMsg}`);
  }, []);

  // Load a model with retry logic
  const loadModelWithRetry = useCallback(async (
    modelId: string, 
    deviceCheck: { available: boolean; device: "webgpu" | "wasm" },
    maxRetries: number = 3
  ): Promise<TextGenerationPipeline> => {
    const browser = browserRef.current;
    const optimizations = getBrowserOptimizations(browser, { safariWebGPUEnabled });
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        retryCountRef.current = attempt;
        
        if (attempt > 1) {
          setState((prev) => ({
            ...prev,
            loadingStatus: `Retry ${attempt}/${maxRetries}...`,
          }));
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }

        setState((prev) => ({
          ...prev,
          loadingStatus: "Loading AI framework...",
        }));

        // Best-effort: request persistent storage (helps Safari keep large model caches)
        const storageInfo = await ensurePersistentStorage();
        if (storageInfo.quota && storageInfo.usage) {
          const freeMB = Math.max(0, (storageInfo.quota - storageInfo.usage) / 1024 / 1024);
          console.log('[LLM] Storage estimate', { persisted: storageInfo.persisted, freeMB: Math.round(freeMB) });
        }

        const { pipeline, env } = await import("@huggingface/transformers");

        // Configure cache and model sources.
        // Models are lazily fetched from Hugging Face Hub on first use and cached
        // in the browser. Local models are also allowed as a fast path if present.
        env.allowLocalModels = true;
        env.allowRemoteModels = true;
        // If models happen to be served locally, look under the `/models` directory.
        try {
          const base = (import.meta as any).env?.BASE_URL ?? "./";
          env.localModelPath = `${base}models/`;
        } catch {
          // Fallback to relative models directory if import.meta isn't available
          env.localModelPath = "./models/";
        }
        env.useBrowserCache = true;

        // IMPORTANT:
        // Many browsers will re-download large model files unless we aggressively cache
        // cross-origin GET requests. Transformers.js browser caching is best-effort and
        // can be evicted. This adds an extra layer using CacheStorage + persistent
        // storage request (done above). This also fixes "model disappears after refresh"
        // on Chrome/Edge by ensuring bytes are actually cached locally.
        if (!fetchCacheInstalledRef.current) {
          try {
            const cacheName = "smart-tool-llm-cache-v1";
            const inflight = new Map<string, Promise<Response>>();
            const originalFetch: typeof fetch = (env as any).fetch || fetch;

            (env as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
              // Only cache GET requests.
              const method = (init?.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase();
              if (method !== "GET") return originalFetch(input as any, init);

              const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;

              // Respect Range requests (some model files stream in chunks). Cache keys must
              // include the range, otherwise a cached partial response can poison later reads.
              const getHeader = (name: string): string | undefined => {
                const h = init?.headers || (input instanceof Request ? input.headers : undefined);
                if (!h) return undefined;
                if (h instanceof Headers) return h.get(name) || undefined;
                if (Array.isArray(h)) {
                  const found = h.find(([k]) => String(k).toLowerCase() === name.toLowerCase());
                  return found ? String(found[1]) : undefined;
                }
                const rec = h as Record<string, string>;
                const key = Object.keys(rec).find(k => k.toLowerCase() === name.toLowerCase());
                return key ? String(rec[key]) : undefined;
              };
              const range = getHeader('Range');
              const cacheKey = range
                ? `${url}${url.includes('?') ? '&' : '?'}__st_range=${encodeURIComponent(range)}`
                : url;

              // Avoid caching very short lived / non-file requests.
              // (Models come from huggingface.co / hf.co / cdn-lfs; but we don't hardcode.
              // We simply cache any http(s) file-like request.)
              if (!/^https?:\/\//i.test(url)) return originalFetch(input as any, init);

              // De-dupe concurrent fetches (include Range in key).
              if (inflight.has(cacheKey)) return (await inflight.get(cacheKey)!)!.clone();

              const p = (async () => {
                try {
                  const cache = await caches.open(cacheName);
                  const cached = await cache.match(cacheKey);
                  if (cached) return cached;

                  // Force a network request; we do our own cache.
                  const res = await originalFetch(url as any, { ...(init || {}), cache: "no-store" });
                  if (res && res.ok) {
                    try {
                      // Some responses are not cacheable (opaque). Ignore failures.
                      await cache.put(cacheKey, res.clone());
                    } catch {
                      // ignore
                    }
                  }
                  return res;
                } finally {
                  inflight.delete(cacheKey);
                }
              })();

              inflight.set(cacheKey, p);
              const out = await p;
              return out.clone();
            };

            fetchCacheInstalledRef.current = true;
          } catch (e) {
            console.warn("[LLM] CacheStorage fetch wrapper not available:", e);
          }
        }

        // Backend tuning (safe no-ops if not supported)
        try {
          const onnx = (env as any).backends?.onnx;
          if (onnx?.wasm) {
            if (typeof onnx.wasm.numThreads === 'number' || onnx.wasm.numThreads === undefined) {
              onnx.wasm.numThreads = optimizations.wasmThreads;
            }
            if ("simd" in onnx.wasm) (onnx.wasm as any).simd = true;
          }
        } catch {
          // ignore
        }

        // If we already have the model files in CacheStorage, show a friendlier status.
        let hasCachedBytes = false;
        try {
          const cache = await caches.open("smart-tool-llm-cache-v1");
          const sentinel = `https://huggingface.co/${modelId}/resolve/main/config.json`;
          hasCachedBytes = !!(await cache.match(sentinel));
        } catch {
          // ignore
        }

        setState((prev) => ({
          ...prev,
          loadingStatus: hasCachedBytes
            ? `Loading AI Module from browser storage (${optimizations.notes})...`
            : `Downloading AI Module (${optimizations.notes})...`,
          loadingProgress: 5,
        }));

        // Create text-generation pipeline with progress callback
        const generator = await pipeline("text-generation", modelId, {
          dtype: optimizations.dtype,
          device: deviceCheck.device === "webgpu" ? "webgpu" : "wasm",
          progress_callback: (progress: { status: string; file?: string; progress?: number; loaded?: number; total?: number }) => {
            if (progress.status === "progress" && progress.progress !== undefined) {
              // Scale progress to 5-90 range (5% for init, 90-100% for warmup)
              const scaledProgress = 5 + Math.round(progress.progress * 0.85);
              setState((prev) => ({
                ...prev,
                loadingProgress: scaledProgress,
                loadingStatus: progress.file 
                  ? `Downloading: ${progress.file.split('/').pop()}`
                  : `Downloading model... ${Math.round(progress.progress)}%`,
              }));
            } else if (progress.status === "done") {
              setState((prev) => ({
                ...prev,
                loadingProgress: 90,
                loadingStatus: "Initializing model...",
              }));
            }
          },
        });

        return generator as unknown as TextGenerationPipeline;
        
      } catch (err) {
        console.error(`[LLM] Load attempt ${attempt} failed:`, err);
        
        if (attempt === maxRetries) {
          throw err;
        }
        
        const errorMessage = err instanceof Error ? err.message : String(err);
        
        // Don't retry for certain error types
        if (errorMessage.includes("out of memory") || errorMessage.includes("OOM")) {
          throw new Error("Not enough memory to load this model. Try a smaller model or close other tabs.");
        }
      }
    }
    
    throw new Error("Failed to load model after all retries");
  }, [safariWebGPUEnabled]);

  // Load a model
  const loadModel = useCallback(async (modelId: string): Promise<boolean> => {
    // Mobile policy
    if (isMobileBlocked) {
      setState((prev) => ({
        ...prev,
        error: device.isAndroid ? "Local AI is not available on Android yet. Please use template-based drafting instead." : "Local AI is disabled on iPhone/iPad by default. Enable it in Settings (Experimental Local AI) and use the smallest model.",
      }));
      return false;
    }

    if (!isModelAvailable(modelId)) {
      setState((prev) => ({
        ...prev,
        error: `Model ${modelId} is not in our recommended list`,
      }));
      return false;
    }

    // Log platform info for debugging
    logPlatformInfo(safariWebGPUEnabled);

    setState((prev) => ({
      ...prev,
      isLoading: true,
      loadingProgress: 0,
      loadingStatus: "Checking device capabilities...",
      error: null,
      isWarmedUp: false,
    }));

    try {
      // Check device
      const deviceCheck = await checkDevice();
      if (!deviceCheck.available) {
        throw new Error(deviceCheck.error || "No compatible device found");
      }

      setState((prev) => ({
        ...prev,
        loadingStatus: `Using ${deviceCheck.device === "webgpu" ? "WebGPU (fast)" : "WASM (compatible)"}...`,
      }));

      // Load with retry logic
      const generator = await loadModelWithRetry(modelId, deviceCheck);

      pipelineRef.current = generator;

      // Warmup the model
      setState((prev) => ({
        ...prev,
        loadingProgress: 95,
        loadingStatus: "Warming up model...",
      }));

      await warmupModel(generator);

      setState((prev) => ({
        ...prev,
        isLoading: false,
        isReady: true,
        isWarmedUp: true,
        selectedModel: modelId,
        loadingProgress: 100,
        loadingStatus: "Ready!",
      }));
      return true;
    } catch (err) {
      console.error("Failed to load model:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load model";

      // Clean up any partially loaded pipeline
      pipelineRef.current = null;

      // Provide friendly error messages
      let friendlyError = errorMessage;
      if (errorMessage.includes("out of memory") || errorMessage.includes("OOM")) {
        friendlyError = "Not enough memory to load this model. Try a smaller model or close other tabs.";
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch") || errorMessage.includes("Failed to fetch")) {
        friendlyError = "Network error while downloading model. Check your connection and try again.";
      } else if (errorMessage.includes("WebGPU") || errorMessage.includes("webgpu")) {
        friendlyError = "WebGPU initialization failed. Try reloading the page or use a different browser.";
      } else if (errorMessage.includes("SharedArrayBuffer")) {
        friendlyError = "Your browser doesn't support required features. Try Chrome or Edge for best compatibility.";
      } else if (errorMessage.includes("warmup failed")) {
        friendlyError = "Model loaded but failed to initialize. Try reloading or use a different browser.";
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: friendlyError,
      }));
      return false;
    }
  }, [isModelAvailable, checkDevice, loadModelWithRetry, warmupModel, isMobileBlocked, device, safariWebGPUEnabled]);


  const getConfigForDevice = useCallback((name: string): GenerationConfig => {
    const base = GENERATION_CONFIGS[name] || GENERATION_CONFIGS.default;
    if (device.isIOS && allowMobileLLM) {
      // Keep iOS stable: shorter outputs and smaller KV cache usage
      const cap = {
        action: 50,
        help: 30,
        outcome: 45,
        improve: 120,
        chat: 80,
        default: 80,
      } as Record<string, number>;
      const max = cap[name] ?? cap.default;
      return {
        ...base,
        max_new_tokens: Math.min(base.max_new_tokens ?? max, max),
        temperature: Math.min(base.temperature ?? 0.7, 0.6),
      };
    }
    return base;
  }, [device.isIOS, allowMobileLLM]);

  // Generate chat response (streaming simulation via chunking)
  const chat = useCallback(
    async function* (
      messages: ChatMessage[],
      systemPrompt?: string,
      config?: GenerationConfig
    ): AsyncGenerator<string, void, unknown> {
      const generator = pipelineRef.current;
      if (!generator) {
        // Sync state if pipeline is null but state thinks model is ready
        // This can happen due to race conditions with unload() or memory pressure
        setState((prev) => {
          if (prev.isReady) {
            console.warn("[LLM] Pipeline null but isReady was true - syncing state");
            return { ...prev, isReady: false, isWarmedUp: false, selectedModel: null };
          }
          return prev;
        });
        throw new Error("Model not loaded. Please reload the AI module in Settings.");
      }

      setState((prev) => ({ ...prev, isGenerating: true, error: null }));
      abortRef.current = false;

      // Use provided config or default (with device caps)
      const genConfig = config || getConfigForDevice("default");

      try {
        const formattedMessages: Array<{ role: string; content: string }> = [];

        if (systemPrompt) {
          formattedMessages.push({ role: "system", content: systemPrompt });
        }

        formattedMessages.push(
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          }))
        );

        const result = await generator(formattedMessages, {
          max_new_tokens: genConfig.max_new_tokens ?? 150,
          do_sample: genConfig.do_sample ?? true,
          temperature: genConfig.temperature || 0.7,
        });

        // Transformers.js text-generation returns different formats depending on model
        let content = "";
        const generated = result[0]?.generated_text;
        
        if (Array.isArray(generated)) {
          // Chat format: find the last assistant message
          const lastAssistant = [...generated].reverse().find(
            (m: { role: string; content: string }) => m.role === "assistant"
          );
          content = lastAssistant?.content || "";
        } else if (typeof generated === "string") {
          // Raw text format: extract the response after the prompt
          const lastUserMessage = messages[messages.length - 1]?.content || "";
          const promptEnd = generated.lastIndexOf(lastUserMessage);
          if (promptEnd >= 0) {
            content = generated.slice(promptEnd + lastUserMessage.length).trim();
          } else {
            content = generated;
          }
          // Clean up common artifacts
          content = content
            .replace(/^[\s\n]*<\|assistant\|>[\s\n]*/i, "")
            .replace(/^[\s\n]*assistant:[\s\n]*/i, "")
            .replace(/<\|end\|>/gi, "")
            .replace(/<\|eot_id\|>/gi, "")
            .replace(/<\|im_end\|>/gi, "")
            .replace(/<\|endoftext\|>/gi, "")
            .trim();
        }
        
        console.log("[LLM] Generated content:", content.slice(0, 100) + (content.length > 100 ? "..." : ""));

        if (!content) {
          console.warn("[LLM] Empty response from model");
          throw new Error("Model returned empty response");
        }

        // Simulate streaming by yielding chunks
        const words = content.split(" ");
        for (let i = 0; i < words.length; i++) {
          if (abortRef.current) break;
          
          const chunk = i === 0 ? words[i] : " " + words[i];
          yield chunk;
          
          // Small delay for streaming effect - shorter for faster perceived response
          await new Promise((resolve) => setTimeout(resolve, 15));
        }
      } catch (err) {
        if (!abortRef.current) {
          console.error("[LLM] Chat error:", err);
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : "Generation failed",
          }));
          throw err;
        }
      } finally {
        setState((prev) => ({ ...prev, isGenerating: false }));
      }
    },
    [getConfigForDevice]
  );

  // Simple single-shot generation with optional config
  const generate = useCallback(
    async (userMessage: string, systemPrompt?: string, configType?: keyof typeof GENERATION_CONFIGS): Promise<string> => {
      const config = getConfigForDevice((configType as string) || "default");
      let fullResponse = "";
      try {
        for await (const chunk of chat([{ role: "user", content: userMessage }], systemPrompt, config)) {
          fullResponse += chunk;
        }
      } catch (err) {
        console.error("[LLM] Generate failed:", err);
        throw err;
      }
      const trimmed = fullResponse.trim();
      if (!trimmed) {
        throw new Error("Generated response is empty");
      }
      return trimmed;
    },
    [chat, getConfigForDevice]
  );

  // Abort current generation
  const abort = useCallback(() => {
    abortRef.current = true;
    setState((prev) => ({ ...prev, isGenerating: false }));
  }, []);

  // Reset error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Unload model and cleanup
  const unload = useCallback(() => {
    pipelineRef.current = null;
    setState({
      isLoading: false,
      loadingProgress: 0,
      loadingStatus: "",
      isGenerating: false,
      isReady: false,
      error: null,
      selectedModel: null,
      isWarmedUp: false,
    });
  }, []);

  // Handle visibility change - can help with memory on tab switch
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && state.isReady) {
        console.log("[LLM] Tab hidden - model remains loaded but generation paused if active");
        if (state.isGenerating) {
          abortRef.current = true;
        }
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [state.isReady, state.isGenerating]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pipelineRef.current = null;
    };
  }, []);

  return {
    ...state,
    isMobile,
    isMobileBlocked,
    allowMobileLLM,
    canUseLocalAI: !isMobileBlocked,
    loadModel,
    chat,
    generate,
    abort,
    clearError,
    unload,
    checkDevice,
    supportedModels,
    isModelAvailable,
    browserInfo: browserRef.current,
    deviceInfo: device,
  };
}
