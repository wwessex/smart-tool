/**
 * High-level text generation pipeline.
 *
 * Orchestrates model loading, tokenizer initialization, and
 * autoregressive generation into a single easy-to-use API.
 * Designed to be a drop-in replacement for the Transformers.js
 * pipeline("text-generation", ...) call.
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
import { fetchModel } from "../model/model-loader.js";
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
  /** Progress callback for model download. */
  progress_callback?: (progress: {
    loaded?: number;
    total?: number;
  }) => void;
  /**
   * Separate base path for config.json and tokenizer.json.
   * Useful when config files live in a different directory than ONNX models
   * (e.g. HuggingFace repos with config at root and ONNX in onnx/).
   * Defaults to modelPath if not set.
   */
  configPath?: string;
  /** Override ONNX model filename (defaults to "model.onnx"). */
  modelFileName?: string;
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
    // (e.g. HuggingFace repos store config at root, ONNX in onnx/)
    const configBase = options.configPath
      ? (options.configPath.endsWith("/")
          ? options.configPath
          : options.configPath + "/")
      : basePath;

    // Detect capabilities and select backend
    const capabilities = await detectCapabilities();
    let backend = selectBackend(
      capabilities,
      options.device as InferenceBackend | undefined
    );
    configureBackend(backend);

    // Load model config
    const modelConfig = await loadModelConfig(configBase + "config.json");
    // Load generation config (may not exist for all models)
    await loadGenerationConfig(
      configBase + "generation_config.json"
    ).catch(() => undefined);

    // Load tokenizer
    const tokenizer = new BPETokenizer();
    await tokenizer.load(configBase + "tokenizer.json");

    // Load model weights
    const modelFileName = options.modelFileName ?? "model.onnx";
    const modelBuffer = await fetchModel(basePath + modelFileName, {
      onProgress: (progress) => {
        options.progress_callback?.({
          loaded: progress.loaded_bytes,
          total: progress.total_bytes,
        });
      },
    });

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
        backend = capabilities.wasmSimd ? "wasm-simd" : "wasm-basic";
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
