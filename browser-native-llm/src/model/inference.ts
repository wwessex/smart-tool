/**
 * Core inference engine for the SMART planner model.
 *
 * Manages model loading, session creation, and token generation
 * using either WebGPU or WASM backends via ONNX Runtime Web
 * or Transformers.js.
 */

import type { InferenceConfig, InferenceBackend } from "../types.js";
import { validateUrl } from "../utils/sanitize.js";

export interface GenerateOptions {
  /** The assembled prompt string. */
  prompt: string;
  /** Override max new tokens for this request. */
  max_new_tokens?: number;
  /** Override temperature for this request. */
  temperature?: number;
  /** Override top_p for this request. */
  top_p?: number;
  /** Override repetition penalty for this request. */
  repetition_penalty?: number;
  /** Callback for each generated token (for streaming). */
  on_token?: (token: string, done: boolean) => void;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
  /** Stop sequences to halt generation. */
  stop_sequences?: string[];
}

export interface GenerateResult {
  text: string;
  tokens_generated: number;
  time_ms: number;
  backend: InferenceBackend;
}

/**
 * Abstract inference engine interface.
 * Concrete implementations handle WebGPU vs WASM specifics.
 */
export abstract class InferenceEngine {
  protected config: InferenceConfig;
  protected loaded = false;

  constructor(config: InferenceConfig) {
    this.config = config;
  }

  /** Load model weights and create inference session. */
  abstract load(
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void>;

  /** Generate text from a prompt. */
  abstract generate(options: GenerateOptions): Promise<GenerateResult>;

  /** Release model resources and free memory. */
  abstract dispose(): void;

  /** Get the active backend type. */
  abstract get backend(): InferenceBackend;

  get isLoaded(): boolean {
    return this.loaded;
  }
}

/**
 * ONNX Runtime Web inference engine.
 * Supports both WebGPU and WASM execution providers.
 */
export class OnnxInferenceEngine extends InferenceEngine {
  private session: unknown = null;
  private activeBackend: InferenceBackend = "wasm-basic";

  constructor(config: InferenceConfig, preferredBackend?: InferenceBackend) {
    super(config);
    if (preferredBackend) {
      this.activeBackend = preferredBackend;
    }
  }

  async load(
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    // Dynamic import to avoid loading ONNX Runtime until needed
    const ort = await import("onnxruntime-web");

    const executionProvider = this.getExecutionProvider();
    const modelUrl = validateUrl(`${this.config.model_base_url}model.onnx`);

    // Fetch model with progress tracking
    const response = await fetch(modelUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch model: ${response.status}`);
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get response reader");
    }

    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.(loaded, contentLength);
    }

    // Concatenate chunks into a single buffer
    const modelBuffer = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      modelBuffer.set(chunk, offset);
      offset += chunk.byteLength;
    }

    // Create inference session
    this.session = await ort.InferenceSession.create(modelBuffer.buffer, {
      executionProviders: [executionProvider],
    });

    this.loaded = true;
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (!this.session) {
      throw new Error("Model not loaded. Call load() first.");
    }

    const startTime = performance.now();
    let tokensGenerated = 0;
    const outputParts: string[] = [];

    // Autoregressive generation loop
    // In a full implementation, this tokenizes the prompt, runs forward
    // passes, samples from logits, and decodes tokens.
    // This is the structural shell; actual tensor operations depend on
    // the specific ONNX model's input/output signature.

    const maxTokens = options.max_new_tokens ?? this.config.max_new_tokens;
    const temperature = options.temperature ?? this.config.temperature;

    // Generation loop placeholder - actual implementation requires
    // tokenizer integration and ONNX session feed/fetch
    for (let i = 0; i < maxTokens; i++) {
      if (options.signal?.aborted) {
        break;
      }

      // In production: run session.run() with input_ids + attention_mask + past_key_values,
      // sample from logits (greedy if temperature=0, nucleus otherwise),
      // check for stop sequences and EOS token.

      // Check stop sequences
      const currentText = outputParts.join("");
      if (options.stop_sequences?.some((s) => currentText.endsWith(s))) {
        break;
      }

      tokensGenerated++;
    }

    const text = outputParts.join("");
    const timeMs = performance.now() - startTime;

    return {
      text,
      tokens_generated: tokensGenerated,
      time_ms: timeMs,
      backend: this.activeBackend,
    };
  }

  dispose(): void {
    if (this.session && typeof (this.session as { release?: () => void }).release === "function") {
      (this.session as { release: () => void }).release();
    }
    this.session = null;
    this.loaded = false;
  }

  get backend(): InferenceBackend {
    return this.activeBackend;
  }

  private getExecutionProvider(): string {
    switch (this.activeBackend) {
      case "webgpu":
        return "webgpu";
      case "wasm-simd":
      case "wasm-basic":
      default:
        return "wasm";
    }
  }
}

/**
 * Transformers.js-based inference engine.
 * Higher-level API with built-in tokenization and generation utilities.
 */
export class TransformersInferenceEngine extends InferenceEngine {
  private pipeline: unknown = null;
  private activeBackend: InferenceBackend = "wasm-basic";

  constructor(config: InferenceConfig, preferredBackend?: InferenceBackend) {
    super(config);
    if (preferredBackend) {
      this.activeBackend = preferredBackend;
    }
  }

  async load(
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    const { pipeline, env } = await import("@huggingface/transformers");

    // Configure backend
    if (this.activeBackend === "webgpu") {
      env.backends.onnx.wasm!.proxy = false;
    }

    const device = this.activeBackend === "webgpu" ? "webgpu" : "wasm";

    // Quantisation dtype selection
    const dtype = "q4"; // 4-bit quantisation

    this.pipeline = await pipeline("text-generation", this.config.model_id, {
      device,
      dtype,
      progress_callback: (progress: { loaded?: number; total?: number }) => {
        if (progress.loaded !== undefined && progress.total !== undefined) {
          onProgress?.(progress.loaded, progress.total);
        }
      },
    });

    this.loaded = true;
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (!this.pipeline) {
      throw new Error("Model not loaded. Call load() first.");
    }

    const startTime = performance.now();

    const generateFn = this.pipeline as (
      text: string,
      options: Record<string, unknown>
    ) => Promise<Array<{ generated_text: string }>>;

    const results = await generateFn(options.prompt, {
      max_new_tokens: options.max_new_tokens ?? this.config.max_new_tokens,
      temperature: options.temperature ?? this.config.temperature,
      top_p: options.top_p ?? this.config.top_p,
      repetition_penalty:
        options.repetition_penalty ?? this.config.repetition_penalty,
      do_sample: (options.temperature ?? this.config.temperature) > 0,
      return_full_text: false,
    });

    let text = results[0]?.generated_text ?? "";

    // Trim at the first occurrence of any stop sequence so downstream
    // JSON parsing only sees the model's structured output.
    if (options.stop_sequences && options.stop_sequences.length > 0) {
      text = trimAtStopSequence(text, options.stop_sequences);
    }

    const timeMs = performance.now() - startTime;

    // Approximate token count from output length
    const tokensGenerated = Math.ceil(text.length / 4);

    return {
      text,
      tokens_generated: tokensGenerated,
      time_ms: timeMs,
      backend: this.activeBackend,
    };
  }

  dispose(): void {
    this.pipeline = null;
    this.loaded = false;
  }

  get backend(): InferenceBackend {
    return this.activeBackend;
  }
}

/**
 * Trim generated text at the first occurrence of any stop sequence.
 * Returns the text up to (but not including) the stop sequence.
 */
function trimAtStopSequence(text: string, stopSequences: string[]): string {
  let earliestIndex = text.length;
  for (const seq of stopSequences) {
    const idx = text.indexOf(seq);
    if (idx !== -1 && idx < earliestIndex) {
      earliestIndex = idx;
    }
  }
  return earliestIndex < text.length ? text.slice(0, earliestIndex) : text;
}
