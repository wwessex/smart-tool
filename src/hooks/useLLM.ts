import { useState, useCallback, useRef, useEffect } from "react";
import {
  CreateWebWorkerMLCEngine,
  WebWorkerMLCEngine,
  ChatCompletionMessageParam,
  prebuiltAppConfig,
} from "@mlc-ai/web-llm";

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

  // Check if a model is available in the prebuilt config
  const isModelAvailable = useCallback((modelId: string): boolean => {
    return prebuiltAppConfig.model_list.some((m) => m.model_id === modelId);
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

    try {
      // Clean up existing engine
      if (engineRef.current) {
        await engineRef.current.unload();
      }

      // Update status to show we're loading the worker module
      setState((prev) => ({
        ...prev,
        loadingStatus: "Loading AI engine (this may take a moment)...",
      }));

      // Create worker with timeout detection
      const worker = new Worker(new URL("/llm-worker.js", import.meta.url), {
        type: "module",
      });

      // Set up a timeout to detect stuck worker (45 seconds for slow connections)
      let workerReady = false;
      const timeoutId = setTimeout(() => {
        if (!workerReady) {
          worker.terminate();
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: "Worker initialization timed out. The AI engine may not be compatible with your browser. Try Cloud AI instead.",
          }));
        }
      }, 45000);

      // Listen for worker ready/error messages
      worker.addEventListener("message", (event) => {
        if (event.data?.type === "worker-ready") {
          workerReady = true;
          clearTimeout(timeoutId);
        } else if (event.data?.type === "worker-error") {
          clearTimeout(timeoutId);
          worker.terminate();
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: `Worker error: ${event.data.error}. Try Cloud AI instead.`,
          }));
        }
      });

      // Create new engine with worker
      const engine = await CreateWebWorkerMLCEngine(
        worker,
        modelId,
        {
          initProgressCallback: (progress) => {
            workerReady = true; // If we get progress, worker is working
            clearTimeout(timeoutId);
            setState((prev) => ({
              ...prev,
              loadingProgress: Math.round(progress.progress * 100),
              loadingStatus: progress.text || "Downloading model...",
            }));
          },
        }
      );

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
      console.error("Failed to load model:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load model";
      
      // Provide more specific error messages
      let friendlyError = errorMessage;
      if (errorMessage.toLowerCase().includes("webgpu")) {
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
