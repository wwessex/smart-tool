import { useState, useCallback, useRef, useEffect } from "react";

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
    name: "SmolLM2 360M",
    size: "~500MB",
    description: "Best balance of size and capability",
  },
  {
    id: "HuggingFaceTB/SmolLM2-135M-Instruct",
    name: "SmolLM2 135M",
    size: "~300MB",
    description: "Smallest and fastest",
  },
  {
    id: "Qwen/Qwen2.5-0.5B-Instruct",
    name: "Qwen 2.5 0.5B",
    size: "~600MB",
    description: "Best quality for size",
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
function getBrowserOptimizations(browser: BrowserInfo): {
  preferWebGPU: boolean;
  wasmThreads: number;
  dtype: "q4" | "fp16" | "fp32";
  notes: string;
} {
  // WebGPU is most stable on Windows Chrome/Edge
  // Safari has experimental WebGPU but WASM is more reliable
  // Firefox uses WASM with reduced threads due to SharedArrayBuffer limitations
  
  if (browser.isChrome || browser.isEdge) {
    // Chrome/Edge on Windows have excellent WebGPU support
    // Chrome on Mac has decent WebGPU but can be unstable
    return {
      preferWebGPU: browser.isWindows || browser.isLinux,
      wasmThreads: 4,
      dtype: "q4",
      notes: browser.isWindows ? "Optimized for Chrome/Edge on Windows" : "Using compatible settings",
    };
  }
  
  if (browser.isSafari) {
    // Safari WebGPU is experimental, use WASM for stability
    return {
      preferWebGPU: false,
      wasmThreads: 4,
      dtype: "q4",
      notes: "Using WASM for Safari compatibility",
    };
  }
  
  if (browser.isFirefox) {
    // Firefox has threading limitations
    return {
      preferWebGPU: false,
      wasmThreads: 2,
      dtype: "q4",
      notes: "Optimized for Firefox (WASM with reduced threads)",
    };
  }
  
  // Default fallback
  return {
    preferWebGPU: false,
    wasmThreads: 2,
    dtype: "q4",
    notes: "Using compatible WASM settings",
  };
}

// Detect mobile device - these have memory constraints that prevent local LLM
const isMobileDevice = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || "";
  // iOS detection
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  // Android detection
  if (/android/i.test(userAgent)) return true;
  // Small screen (as fallback for other mobile browsers)
  if (typeof window !== "undefined" && window.innerWidth < 768) return true;
  return false;
};

// Export mobile check for use in other components
export const checkIsMobile = isMobileDevice;

// Log platform info for debugging
function logPlatformInfo(): void {
  if (typeof navigator === "undefined") return;
  
  const browser = detectBrowser();
  const optimizations = getBrowserOptimizations(browser);
  const hasWebGPU = !!(navigator as Navigator & { gpu?: unknown }).gpu;
  const memory = (performance as { memory?: { jsHeapSizeLimit?: number } }).memory?.jsHeapSizeLimit;
  const cores = navigator.hardwareConcurrency;
  
  console.log("[LLM Platform]", {
    browser: browser.isChrome ? "Chrome" : browser.isEdge ? "Edge" : browser.isSafari ? "Safari" : browser.isFirefox ? "Firefox" : "Other",
    os: browser.isMac ? "macOS" : browser.isWindows ? "Windows" : browser.isLinux ? "Linux" : "Other",
    webgpuAvailable: hasWebGPU,
    preferWebGPU: optimizations.preferWebGPU,
    memoryLimit: memory ? `${Math.round(memory / 1024 / 1024)}MB` : "unknown",
    cores,
    notes: optimizations.notes,
  });
}

export function useTransformersLLM() {
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
  const retryCountRef = useRef<number>(0);

  // Is this a mobile device?
  const isMobile = isMobileDevice();

  // Check if model is in our recommended list
  const isModelAvailable = useCallback((modelId: string): boolean => {
    return RECOMMENDED_MODELS.some((m) => m.id === modelId);
  }, []);

  // Check device capabilities - Transformers.js works with both WebGPU and WASM
  const checkDevice = useCallback(async (): Promise<{ 
    available: boolean; 
    device: "webgpu" | "wasm"; 
    error?: string 
  }> => {
    // Block mobile devices - they don't have enough memory for local LLMs
    if (isMobile) {
      return { 
        available: false, 
        device: "wasm",
        error: "Local AI is not available on mobile devices due to memory limitations. Use template-based drafting instead." 
      };
    }

    const browser = browserRef.current;
    const optimizations = getBrowserOptimizations(browser);
    
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
  }, [isMobile]);

  // Warmup the model with a quick generation
  const warmupModel = useCallback(async (generator: TextGenerationPipeline): Promise<void> => {
    try {
      console.log("[LLM] Warming up model...");
      await generator([{ role: "user", content: "Hello" }], { max_new_tokens: 5 });
      console.log("[LLM] Warmup complete");
    } catch (err) {
      console.warn("[LLM] Warmup failed (non-critical):", err);
    }
  }, []);

  // Load a model with retry logic
  const loadModelWithRetry = useCallback(async (
    modelId: string, 
    deviceCheck: { available: boolean; device: "webgpu" | "wasm" },
    maxRetries: number = 3
  ): Promise<TextGenerationPipeline> => {
    const browser = browserRef.current;
    const optimizations = getBrowserOptimizations(browser);
    
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

        const { pipeline, env } = await import("@huggingface/transformers");

        // Configure cache and logging
        env.allowLocalModels = false;
        env.useBrowserCache = true;

        setState((prev) => ({
          ...prev,
          loadingStatus: `Downloading model (${optimizations.notes})...`,
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
  }, []);

  // Load a model
  const loadModel = useCallback(async (modelId: string): Promise<void> => {
    // Block mobile devices immediately
    if (isMobile) {
      setState((prev) => ({
        ...prev,
        error: "Local AI is not available on mobile devices due to memory limitations. Please use template-based drafting instead.",
      }));
      return;
    }

    if (!isModelAvailable(modelId)) {
      setState((prev) => ({
        ...prev,
        error: `Model ${modelId} is not in our recommended list`,
      }));
      return;
    }

    // Log platform info for debugging
    logPlatformInfo();

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
    } catch (err) {
      console.error("Failed to load model:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load model";
      
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
      }
      
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: friendlyError,
      }));
    }
  }, [isModelAvailable, checkDevice, loadModelWithRetry, warmupModel]);

  // Generate chat response (streaming simulation via chunking)
  const chat = useCallback(
    async function* (
      messages: ChatMessage[],
      systemPrompt?: string,
      config?: GenerationConfig
    ): AsyncGenerator<string, void, unknown> {
      const generator = pipelineRef.current;
      if (!generator) {
        throw new Error("Model not loaded");
      }

      setState((prev) => ({ ...prev, isGenerating: true, error: null }));
      abortRef.current = false;

      // Use provided config or default
      const genConfig = config || GENERATION_CONFIGS.default;

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
          max_new_tokens: genConfig.max_new_tokens || 150,
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
    []
  );

  // Simple single-shot generation with optional config
  const generate = useCallback(
    async (userMessage: string, systemPrompt?: string, configType?: keyof typeof GENERATION_CONFIGS): Promise<string> => {
      const config = configType ? GENERATION_CONFIGS[configType] : GENERATION_CONFIGS.default;
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
    [chat]
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
    loadModel,
    chat,
    generate,
    abort,
    clearError,
    unload,
    checkDevice,
    supportedModels: RECOMMENDED_MODELS,
    isModelAvailable,
    browserInfo: browserRef.current,
  };
}
