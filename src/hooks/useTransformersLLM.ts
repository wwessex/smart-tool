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

interface UseTransformersLLMState {
  isLoading: boolean;
  loadingProgress: number;
  loadingStatus: string;
  isGenerating: boolean;
  isReady: boolean;
  error: string | null;
  selectedModel: string | null;
}

// Transformers.js can return either chat format (array of messages) or raw text format (string)
type GeneratedOutput = Array<{ role: string; content: string }> | string;

type TextGenerationPipeline = (
  messages: Array<{ role: string; content: string }>,
  options?: { max_new_tokens?: number; do_sample?: boolean; temperature?: number }
) => Promise<Array<{ generated_text: GeneratedOutput }>>;

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

export function useTransformersLLM() {
  const [state, setState] = useState<UseTransformersLLMState>({
    isLoading: false,
    loadingProgress: 0,
    loadingStatus: "",
    isGenerating: false,
    isReady: false,
    error: null,
    selectedModel: null,
  });

  const pipelineRef = useRef<TextGenerationPipeline | null>(null);
  const abortRef = useRef<boolean>(false);

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

    // Try WebGPU first
    const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown | null> } };
    
    if (nav.gpu) {
      try {
        const adapter = await nav.gpu.requestAdapter();
        if (adapter) {
          return { available: true, device: "webgpu" };
        }
      } catch {
        // Fall through to WASM
      }
    }
    
    // WASM is available as fallback on desktop
    return { available: true, device: "wasm" };
  }, [isMobile]);

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

    setState((prev) => ({
      ...prev,
      isLoading: true,
      loadingProgress: 0,
      loadingStatus: "Checking device capabilities...",
      error: null,
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

      // Dynamically import Transformers.js
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
        loadingStatus: "Downloading model (this may take a few minutes)...",
        loadingProgress: 5,
      }));

      // Create text-generation pipeline with progress callback
      const generator = await pipeline("text-generation", modelId, {
        dtype: "q4", // 4-bit quantization for smaller downloads
        device: deviceCheck.device === "webgpu" ? "webgpu" : "wasm",
        progress_callback: (progress: { status: string; file?: string; progress?: number; loaded?: number; total?: number }) => {
          if (progress.status === "progress" && progress.progress !== undefined) {
            // Scale progress to 5-95 range (5% for init, 95-100% for finalization)
            const scaledProgress = 5 + Math.round(progress.progress * 0.9);
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
              loadingProgress: 95,
              loadingStatus: "Initializing model...",
            }));
          }
        },
      });

      pipelineRef.current = generator as unknown as TextGenerationPipeline;

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
      
      // Provide friendly error messages
      let friendlyError = errorMessage;
      if (errorMessage.includes("out of memory") || errorMessage.includes("OOM")) {
        friendlyError = "Not enough memory to load this model. Try a smaller model or close other tabs.";
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        friendlyError = "Network error while downloading model. Check your connection and try again.";
      } else if (errorMessage.includes("WebGPU") || errorMessage.includes("webgpu")) {
        friendlyError = "WebGPU initialization failed. The model will use WASM (slower but compatible).";
      }
      
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: friendlyError,
      }));
    }
  }, [isModelAvailable, checkDevice]);

  // Generate chat response (streaming simulation via chunking)
  const chat = useCallback(
    async function* (
      messages: ChatMessage[],
      systemPrompt?: string
    ): AsyncGenerator<string, void, unknown> {
      const generator = pipelineRef.current;
      if (!generator) {
        throw new Error("Model not loaded");
      }

      setState((prev) => ({ ...prev, isGenerating: true, error: null }));
      abortRef.current = false;

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
          max_new_tokens: 150,
          do_sample: true,
          temperature: 0.7,
        });

        // Transformers.js text-generation returns different formats depending on model
        // For chat models, it returns { generated_text: Array<{role, content}> }
        // For non-chat, it returns { generated_text: string }
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
          // The model appends to the input, so we need to find new content
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
          
          // Small delay for streaming effect
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      } catch (err) {
        if (!abortRef.current) {
          console.error("[LLM] Chat error:", err);
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : "Generation failed",
          }));
          throw err; // Re-throw so generate() can catch it
        }
      } finally {
        setState((prev) => ({ ...prev, isGenerating: false }));
      }
    },
    []
  );

  // Simple single-shot generation
  const generate = useCallback(
    async (userMessage: string, systemPrompt?: string): Promise<string> => {
      let fullResponse = "";
      try {
        for await (const chunk of chat([{ role: "user", content: userMessage }], systemPrompt)) {
          fullResponse += chunk;
        }
      } catch (err) {
        console.error("[LLM] Generate failed:", err);
        throw err; // Let caller handle fallback
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

  // Unload model
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
    });
  }, []);

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
  };
}
