/**
 * High-level text generation pipeline.
 *
 * Orchestrates model loading, tokenizer initialization, and
 * autoregressive generation into a single easy-to-use API.
 * Provides a high-level API for decoder-only LLM inference
 * in the browser.
 */

import type {
  GenerateOptions,
  GenerateResult,
  ModelConfig,
  InferenceBackend,
} from "../core/types.js";
import { createSession, getExecutionProvider } from "../core/session.js";
import { BPETokenizer } from "../tokenizer/bpe-tokenizer.js";
import { CausalGenerator } from "../generation/causal-generator.js";
import { fetchModelWithShards } from "../model/model-loader.js";
import { ModelCache } from "../model/model-cache.js";
import { loadModelConfig, loadGenerationConfig } from "../model/model-config.js";
import { selectBackend, detectCapabilities } from "../runtime/device.js";
import { configureBackend } from "../runtime/backend.js";
import type * as ort from "onnxruntime-web";

/** Options for creating a text generation pipeline. */
export interface TextGenerationPipelineOptions {
  /** Preferred inference backend. Auto-detected if not set. */
  device?: string;
  /** Model quantization dtype (e.g., "q4", "int8"). */
  dtype?: string;
  /** Progress callback for model download and pipeline phases. */
  progress_callback?: (progress: {
    loaded?: number;
    total?: number;
    phase?: string;
    file?: string;
  }) => void;
  /**
   * Separate base path for config.json and tokenizer.json.
   * Useful when config files live in a different directory than ONNX models
   * (e.g. repos with config at root and ONNX in onnx/).
   * Defaults to modelPath if not set.
   */
  configPath?: string;
  /** Override ONNX model filename (defaults to "model.onnx"). */
  modelFileName?: string;
  /**
   * Optional ModelCache instance for persistent cache-first loading.
   * When provided, model files are served from browser Cache API on
   * subsequent loads, avoiding re-download.
   */
  cache?: ModelCache;
  /**
   * Skip capability detection and use this backend directly.
   * When true, the `device` option is treated as an explicit backend
   * selection rather than a preference hint. Falls back to WASM if
   * session creation fails with the specified backend.
   */
  skipDetection?: boolean;
}

export class TextGenerationPipeline {
  private generator: CausalGenerator;
  private tokenizer: BPETokenizer;
  private modelConfig: ModelConfig;
  private backend: InferenceBackend;
  private session: ort.InferenceSession;

  private constructor(
    session: ort.InferenceSession,
    generator: CausalGenerator,
    tokenizer: BPETokenizer,
    modelConfig: ModelConfig,
    backend: InferenceBackend
  ) {
    this.session = session;
    this.generator = generator;
    this.tokenizer = tokenizer;
    this.modelConfig = modelConfig;
    this.backend = backend;
  }

  /**
   * Create a text generation pipeline by loading model and tokenizer.
   *
   * @param modelPath - Base URL/path to the model directory
   *   (should contain model.onnx, tokenizer.json, config.json)
   * @param options - Pipeline creation options
   */
  static async create(
    modelPath: string,
    options: TextGenerationPipelineOptions = {}
  ): Promise<TextGenerationPipeline> {
    const basePath = modelPath.endsWith("/")
      ? modelPath
      : modelPath + "/";

    // Config/tokenizer path may differ from ONNX model path
    // (e.g. repos store config at root, ONNX in onnx/)
    const configBase = options.configPath
      ? (options.configPath.endsWith("/")
          ? options.configPath
          : options.configPath + "/")
      : basePath;

    // Detect capabilities and select backend.
    // When skipDetection is true and device is set, use it directly to avoid
    // redundant capability detection (e.g. when the caller already detected).
    let backend: InferenceBackend;
    let capabilities: Awaited<ReturnType<typeof detectCapabilities>> | null = null;
    if (options.skipDetection && options.device) {
      backend = options.device as InferenceBackend;
    } else {
      capabilities = await detectCapabilities();
      backend = selectBackend(
        capabilities,
        options.device as InferenceBackend | undefined
      );
    }
    configureBackend(backend);

    // Phase: loading config
    options.progress_callback?.({ phase: "initializing", file: "config.json" });

    // Load model config
    const modelConfig = await loadModelConfig(configBase + "config.json");
    // Load generation config (may not exist for all models)
    await loadGenerationConfig(
      configBase + "generation_config.json"
    ).catch(() => undefined);

    // Phase: loading tokenizer
    options.progress_callback?.({ phase: "initializing", file: "tokenizer.json" });

    // Load tokenizer
    const tokenizer = new BPETokenizer();
    await tokenizer.load(configBase + "tokenizer.json");

    // Phase: downloading model (with shard support and resume)
    const modelFileName = options.modelFileName ?? "model.onnx";
    const modelBuffer = await fetchModelWithShards(basePath + modelFileName, {
      cache: options.cache,
      onProgress: (progress) => {
        options.progress_callback?.({
          loaded: progress.loaded_bytes,
          total: progress.total_bytes,
          phase: progress.phase,
          file: progress.file,
        });
      },
    });

    // Phase: creating inference session
    options.progress_callback?.({ phase: "session_creating", file: "model" });

    // Create ONNX session — fall back to WASM if WebGPU provider fails
    let session: ort.InferenceSession;
    try {
      const executionProvider = getExecutionProvider(backend);
      session = await createSession(modelBuffer, { executionProvider });
    } catch (err) {
      if (backend === "webgpu") {
        console.warn(
          "[puente-engine] WebGPU session creation failed, falling back to WASM:",
          err instanceof Error ? err.message : err,
        );
        // Determine WASM fallback — use capabilities if available, else default to basic
        const wasmSimd = capabilities ? capabilities.wasmSimd : false;
        backend = wasmSimd ? "wasm-simd" : "wasm-basic";
        configureBackend(backend);
        session = await createSession(modelBuffer, {
          executionProvider: getExecutionProvider(backend),
        });
      } else {
        throw err;
      }
    }

    // Create generator
    const generator = new CausalGenerator(
      session,
      tokenizer,
      modelConfig
    );

    return new TextGenerationPipeline(
      session,
      generator,
      tokenizer,
      modelConfig,
      backend
    );
  }

  /**
   * Generate text from a prompt.
   */
  async generate(
    prompt: string,
    options: Partial<GenerateOptions> = {}
  ): Promise<GenerateResult> {
    return this.generator.generate({
      prompt,
      ...options,
    });
  }

  /**
   * Get the tokenizer.
   */
  getTokenizer(): BPETokenizer {
    return this.tokenizer;
  }

  /**
   * Get the model config.
   */
  getModelConfig(): ModelConfig {
    return this.modelConfig;
  }

  /**
   * Get the active backend.
   */
  getBackend(): InferenceBackend {
    return this.backend;
  }

  /**
   * Release all resources.
   */
  async dispose(): Promise<void> {
    await this.session.release();
  }
}
