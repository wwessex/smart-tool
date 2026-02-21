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

  async generate(_options: GenerateOptions): Promise<GenerateResult> {
    if (!this.session) {
      throw new Error("Model not loaded. Call load() first.");
    }

    // The autoregressive generation loop requires tokenizer integration
    // (encode prompt → run session.run() per step → sample logits → decode).
    // This is not yet implemented; TransformersInferenceEngine handles
    // tokenization and generation via the Transformers.js pipeline API.
    throw new Error(
      "Direct ONNX Runtime inference is not yet implemented. " +
      "The Transformers.js engine is the supported inference path."
    );
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
 * @deprecated Use PuenteInferenceEngine instead. This class required
 * @huggingface/transformers which has been replaced by @smart-tool/puente-engine.
 */
export class TransformersInferenceEngine extends InferenceEngine {
  constructor(config: InferenceConfig, _preferredBackend?: InferenceBackend) {
    super(config);
  }

  async load(): Promise<void> {
    throw new Error(
      "TransformersInferenceEngine is deprecated. Use PuenteInferenceEngine instead."
    );
  }

  async generate(_options: GenerateOptions): Promise<GenerateResult> {
    throw new Error(
      "TransformersInferenceEngine is deprecated. Use PuenteInferenceEngine instead."
    );
  }

  dispose(): void {
    /* no-op */
  }

  get backend(): InferenceBackend {
    return "wasm-basic";
  }
}

/**
 * Puente Engine-based inference engine.
 * Custom ONNX Runtime inference with full tokenization, KV cache,
 * and generation loop — replaces Transformers.js as the primary backend.
 */
export class PuenteInferenceEngine extends InferenceEngine {
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
    const { TextGenerationPipeline } = await import(
      "@smart-tool/puente-engine"
    );

    const device = this.activeBackend === "webgpu" ? "webgpu" : undefined;

    // HuggingFace layout: config.json/tokenizer.json at root, ONNX in onnx/
    const baseUrl = this.config.model_base_url.endsWith("/")
      ? this.config.model_base_url
      : this.config.model_base_url + "/";
    const onnxPath = baseUrl + "onnx/";

    this.pipeline = await TextGenerationPipeline.create(onnxPath, {
      configPath: baseUrl,
      device,
      dtype: "q4",
      modelFileName: "model_q4.onnx",
      progress_callback: (progress: {
        loaded?: number;
        total?: number;
      }) => {
        if (
          progress.loaded !== undefined &&
          progress.total !== undefined
        ) {
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

    type PuenteResult = {
      text: string;
      tokens_generated: number;
      time_ms: number;
      backend: string;
    };
    const p = this.pipeline as {
      generate(
        prompt: string,
        opts: Record<string, unknown>
      ): Promise<PuenteResult>;
    };

    const result = await p.generate(options.prompt, {
      max_new_tokens:
        options.max_new_tokens ?? this.config.max_new_tokens,
      temperature: options.temperature ?? this.config.temperature,
      top_p: options.top_p ?? this.config.top_p,
      repetition_penalty:
        options.repetition_penalty ?? this.config.repetition_penalty,
      stop_sequences: options.stop_sequences,
      on_token: options.on_token,
      signal: options.signal,
    });

    let text = result.text;
    if (options.stop_sequences && options.stop_sequences.length > 0) {
      text = trimAtStopSequence(text, options.stop_sequences);
    }

    return {
      text,
      tokens_generated: result.tokens_generated,
      time_ms: result.time_ms,
      backend: this.activeBackend,
    };
  }

  dispose(): void {
    if (this.pipeline) {
      (this.pipeline as { dispose(): void }).dispose();
    }
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
