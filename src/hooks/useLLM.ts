import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatCompletionMessageParam, WebWorkerMLCEngine } from "@mlc-ai/web-llm";

export interface ModelInfo {
  id: string;
  name: string;
  size: string;
  description: string;
}

// Curated list of recommended models - balanced for size and capability
export const RECOMMENDED_MODELS: ModelInfo[] = [
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    name: "Phi-3.5 Mini",
    size: "~2.3GB",
    description: "Fast, efficient, great for general tasks",
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 1B",
    size: "~0.7GB",
    description: "Smallest, fastest downloads",
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 3B",
    size: "~1.8GB",
    description: "Good balance of speed and capability",
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 1.5B",
    size: "~1GB",
    description: "Compact and capable",
  },
  {
    id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
    name: "SmolLM2 1.7B",
    size: "~1GB",
    description: "Optimized for efficiency",
  },
];

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface UseLLMState {
  isLoading: boolean;
  loadingProgress: number;
  loadingStatus: string;
  isGenerating: boolean;
  isReady: boolean;
  error: string | null;
  selectedModel: string | null;
}

export function useLLM() {
  const [state, setState] = useState<UseLLMState>({
    isLoading: false,
    loadingProgress: 0,
    loadingStatus: "",
    isGenerating: false,
    isReady: false,
    error: null,
    selectedModel: null,
  });

  const engineRef = useRef<WebWorkerMLCEngine | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // IMPORTANT (bundle size): avoid importing `@mlc-ai/web-llm` until Local AI is actually used.
  // We only "validate" against our curated list here; deeper validation happens during `loadModel`.
  const isModelAvailable = useCallback((modelId: string): boolean => {
    return RECOMMENDED_MODELS.some((m) => m.id === modelId);
  }, []);

  // Check WebGPU availability
  const checkWebGPU = useCallback(async (): Promise<{ available: boolean; error?: string }> => {
    const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown | null> } };
    
    // Detect Safari
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (!nav.gpu) {
      if (isSafari) {
        return { 
          available: false, 
          error: "WebGPU is not enabled in Safari. Go to Safari → Settings → Feature Flags → enable 'WebGPU'. Then reload this page. Or use Chrome/Edge, or switch to Cloud AI." 
        };
      }
      return { available: false, error: "WebGPU is not available in this browser. Please use Chrome, Edge, or switch to Cloud AI." };
    }
    
    try {
      const adapter = await nav.gpu.requestAdapter();
      if (!adapter) {
        if (isSafari) {
          return { 
            available: false, 
            error: "WebGPU adapter not found. In Safari, go to Settings → Feature Flags and enable 'WebGPU'. Then reload." 
          };
        }
        return { available: false, error: "No WebGPU adapter found. Your GPU may not be supported." };
      }
      return { available: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "";
      if (isSafari) {
        return { 
          available: false, 
          error: `WebGPU failed in Safari: ${errorMsg}. Try enabling it in Safari → Settings → Feature Flags → WebGPU.` 
        };
      }
      return { available: false, error: "Failed to initialize WebGPU. Please use Cloud AI instead." };
    }
  }, []);

  // Load a model
  const loadModel = useCallback(async (modelId: string): Promise<void> => {
    if (!isModelAvailable(modelId)) {
      setState((prev) => ({
        ...prev,
        error: `Model ${modelId} is not available`,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isLoading: true,
      loadingProgress: 0,
      loadingStatus: "Checking WebGPU support...",
      error: null,
    }));

    // Check WebGPU BEFORE attempting to download
    const webgpuCheck = await checkWebGPU();
    if (!webgpuCheck.available) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: webgpuCheck.error,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      loadingStatus: "Starting worker...",
    }));

    // Create a worker reference that we can terminate on timeout
    let worker: Worker | null = null;
    
    try {
      // Dynamically import WebLLM only when Local AI is actually used.
      const { CreateWebWorkerMLCEngine } = await import("@mlc-ai/web-llm");

      // Clean up existing engine
      if (engineRef.current) {
        await engineRef.current.unload();
      }

      // Update status to show we're loading the worker module
      setState((prev) => ({
        ...prev,
        loadingStatus: "Loading AI engine (this may take a moment)...",
      }));

      // Create worker
      worker = new Worker(new URL("/llm-worker.js", import.meta.url), {
        type: "module",
      });

      // Listen for worker errors
      worker.addEventListener("error", (event) => {
        console.error("Worker error:", event);
      });

      worker.addEventListener("message", (event) => {
        if (event.data?.type === "worker-error") {
          console.error("Worker initialization error:", event.data.error);
        }
      });

      // Create engine with timeout using Promise.race
      // Note: Model download can take several minutes on slow connections
      // The timeout only applies to initial engine setup, not the full download
      const TIMEOUT_MS = 120000; // 2 minutes for engine init
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("TIMEOUT: Engine initialization took too long. This may be due to a slow connection or browser limitations. Try Cloud AI for a faster experience."));
        }, TIMEOUT_MS);
      });

      const enginePromise = CreateWebWorkerMLCEngine(
        worker,
        modelId,
        {
          initProgressCallback: (progress) => {
            setState((prev) => ({
              ...prev,
              loadingProgress: Math.round(progress.progress * 100),
              loadingStatus: progress.text || "Downloading model...",
            }));
          },
        }
      );

      // Race between engine creation and timeout
      const engine = await Promise.race([enginePromise, timeoutPromise]);

      engineRef.current = engine;
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isReady: true,
        selectedModel: modelId,
        loadingProgress: 100,
        loadingStatus: "Ready!",
      }));
    } catch (err) {
      // Terminate worker on any error
      if (worker) {
        worker.terminate();
      }
      
      console.error("Failed to load model:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load model";
      
      // Provide more specific error messages
      let friendlyError = errorMessage;
      if (errorMessage.startsWith("TIMEOUT:")) {
        friendlyError = errorMessage.replace("TIMEOUT: ", "");
      } else if (errorMessage.toLowerCase().includes("webgpu")) {
        friendlyError = "WebGPU initialization failed. Please use Cloud AI instead.";
      } else if (errorMessage.toLowerCase().includes("worker")) {
        friendlyError = "Failed to start AI worker. Try refreshing the page.";
      } else if (errorMessage.toLowerCase().includes("network") || errorMessage.toLowerCase().includes("fetch")) {
        friendlyError = "Network error while downloading model. Check your connection and try again.";
      }
      
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: friendlyError,
      }));
    }
  }, [isModelAvailable, checkWebGPU]);

  // Generate chat response with streaming
  const chat = useCallback(
    async function* (
      messages: ChatMessage[],
      systemPrompt?: string
    ): AsyncGenerator<string, void, unknown> {
      if (!engineRef.current || !state.isReady) {
        throw new Error("Model not loaded");
      }

      setState((prev) => ({ ...prev, isGenerating: true, error: null }));
      abortControllerRef.current = new AbortController();

      try {
        const formattedMessages: ChatCompletionMessageParam[] = [];

        if (systemPrompt) {
          formattedMessages.push({ role: "system", content: systemPrompt });
        }

        formattedMessages.push(
          ...messages.map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
          }))
        );

        const stream = await engineRef.current.chat.completions.create({
          messages: formattedMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 1024,
        });

        for await (const chunk of stream) {
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Chat error:", err);
          setState((prev) => ({
            ...prev,
            error: err.message,
          }));
        }
      } finally {
        setState((prev) => ({ ...prev, isGenerating: false }));
        abortControllerRef.current = null;
      }
    },
    [state.isReady]
  );

  // Abort current generation
  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    setState((prev) => ({ ...prev, isGenerating: false }));
  }, []);

  // Reset error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.unload();
      }
    };
  }, []);

  return {
    ...state,
    loadModel,
    chat,
    abort,
    clearError,
    checkWebGPU,
    supportedModels: RECOMMENDED_MODELS,
    isModelAvailable,
  };
}
