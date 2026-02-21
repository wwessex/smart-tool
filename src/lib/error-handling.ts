/**
 * Centralized error handling utilities for AI/LLM operations.
 *
 * Provides error classification, user-friendly messages, and
 * recovery suggestions so callers can display consistent feedback.
 */

// ---------------------------------------------------------------------------
// Error categories
// ---------------------------------------------------------------------------

export type AIErrorCategory =
  | "network"       // fetch failures, timeouts, offline
  | "model_load"    // model download or initialization failures
  | "generation"    // inference / text-generation failures
  | "memory"        // OOM, tab crash, memory pressure
  | "device"        // WebGPU / WASM / SharedArrayBuffer issues
  | "parse"         // response parsing (JSON / format) issues
  | "consent"       // AI consent not granted
  | "unknown";

export interface ClassifiedError {
  category: AIErrorCategory;
  /** Short heading suitable for a toast title. */
  title: string;
  /** Longer description with recovery guidance. */
  message: string;
  /** Whether the user should retry the same operation. */
  retryable: boolean;
  /** Original error for logging. */
  original: unknown;
}

// ---------------------------------------------------------------------------
// Pattern matchers  (order matters – first match wins)
// ---------------------------------------------------------------------------

interface ErrorPattern {
  test: (msg: string) => boolean;
  category: AIErrorCategory;
  title: string;
  message: string;
  retryable: boolean;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // Memory / OOM
  {
    test: (m) => /out of memory|OOM|memory pressure|allocation failed/i.test(m),
    category: "memory",
    title: "Out of memory",
    message: "Not enough memory to run the AI model. Close other tabs or try a smaller model.",
    retryable: false,
  },
  // Timeout (before general network — "timed out" is not a network issue here)
  {
    test: (m) => /timed?\s*out/i.test(m),
    category: "generation",
    title: "AI took too long",
    message: "AI generation took too long. Try again or use Smart Templates instead.",
    retryable: true,
  },
  // Unauthorized / forbidden (model access issues on HuggingFace)
  {
    test: (m) => /unauthori[sz]ed|forbidden|401|403|not authorized/i.test(m),
    category: "model_load",
    title: "Model access denied",
    message: "The AI model is temporarily unavailable. Try reloading the page or switching models.",
    retryable: true,
  },
  // Network
  {
    test: (m) => /network|fetch|Failed to fetch|net::ERR|ECONNREFUSED|ETIMEDOUT|offline/i.test(m),
    category: "network",
    title: "Network error",
    message: "Could not reach the model server. Check your internet connection and try again.",
    retryable: true,
  },
  // WebGPU / device
  {
    test: (m) => /WebGPU|webgpu|GPU adapter|requestAdapter/i.test(m),
    category: "device",
    title: "WebGPU error",
    message: "WebGPU initialization failed. Try reloading the page or switching to a different browser.",
    retryable: true,
  },
  {
    test: (m) => /SharedArrayBuffer|cross-origin isolation/i.test(m),
    category: "device",
    title: "Browser compatibility issue",
    message: "Your browser is missing required features. Chrome or Edge provide the best compatibility.",
    retryable: false,
  },
  // Not implemented / not supported (e.g. ONNX engine fallback)
  {
    test: (m) => /not yet implemented|not supported|not available/i.test(m),
    category: "device",
    title: "Feature not available",
    message: "This AI feature is not available in your browser. Try Chrome or Edge for best compatibility.",
    retryable: false,
  },
  // Model loading
  {
    test: (m) => /warmup failed|Model loaded but|Failed to load model|load model/i.test(m),
    category: "model_load",
    title: "Model failed to load",
    message: "The AI model could not initialize. Try reloading the page or clearing browser storage in Settings.",
    retryable: true,
  },
  // Parse / response format
  {
    test: (m) => /Invalid response format|JSON|parse|empty response|returned empty/i.test(m),
    category: "parse",
    title: "Unexpected AI response",
    message: "The AI returned an unreadable response. Try generating again — results may vary.",
    retryable: true,
  },
  // Generation / inference / worker errors
  {
    test: (m) => /Generation failed|generate|Generate|inference|Worker error/i.test(m),
    category: "generation",
    title: "AI generation failed",
    message: "Something went wrong during text generation. Please try again.",
    retryable: true,
  },
  // Consent
  {
    test: (m) => /consent/i.test(m),
    category: "consent",
    title: "AI consent required",
    message: "Enable AI features in Settings > Privacy & Data before using this feature.",
    retryable: false,
  },
];

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classify an error into a user-friendly category with recovery guidance.
 */
export function classifyAIError(error: unknown): ClassifiedError {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.test(msg)) {
      return {
        category: pattern.category,
        title: pattern.title,
        message: pattern.message,
        retryable: pattern.retryable,
        original: error,
      };
    }
  }

  return {
    category: "unknown",
    title: "Something went wrong",
    message: msg || "An unexpected error occurred. Please try again.",
    retryable: true,
    original: error,
  };
}

// ---------------------------------------------------------------------------
// Global unhandled-rejection tracking
// ---------------------------------------------------------------------------

let _installed = false;

/**
 * Install a global `unhandledrejection` listener that logs unhandled promise
 * rejections with context. Safe to call multiple times — only installs once.
 *
 * @param onError  Optional callback invoked with each classified error.
 */
export function installGlobalErrorHandlers(
  onError?: (err: ClassifiedError) => void,
): void {
  if (_installed) return;
  _installed = true;

  window.addEventListener("unhandledrejection", (event) => {
    const classified = classifyAIError(event.reason);
    console.error(
      `[Unhandled rejection] ${classified.category}: ${classified.title}`,
      event.reason,
    );
    onError?.(classified);
  });
}
