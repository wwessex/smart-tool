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
      loadingStatus: "Starting worker...",
      error: null,
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

      let lastProgressTime = Date.now();
      let hasReceivedProgress = false;

      // Create new engine with worker
      const engine = await CreateWebWorkerMLCEngine(
        new Worker(new URL("/llm-worker.js", import.meta.url), {
          type: "module",
        }),
        modelId,
        {
          initProgressCallback: (progress) => {
            hasReceivedProgress = true;
            lastProgressTime = Date.now();
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
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage.includes("WebGPU") 
          ? "WebGPU is not available in this browser. Please use Cloud AI instead."
          : errorMessage,
      }));
    }
  }, [isModelAvailable]);

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
    supportedModels: RECOMMENDED_MODELS,
    isModelAvailable,
  };
}
