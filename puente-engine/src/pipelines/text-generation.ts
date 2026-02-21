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

    // Detect capabilities and select backend
    const capabilities = await detectCapabilities();
    const backend = selectBackend(
      capabilities,
      options.device as InferenceBackend | undefined
    );
    configureBackend(backend);

    // Load model config
    const modelConfig = await loadModelConfig(basePath + "config.json");
    // Load generation config (may not exist for all models)
    await loadGenerationConfig(
      basePath + "generation_config.json"
    ).catch(() => undefined);

    // Load tokenizer
    const tokenizer = new BPETokenizer();
    await tokenizer.load(basePath + "tokenizer.json");

    // Load model weights
    const modelBuffer = await fetchModel(basePath + "model.onnx", {
      onProgress: (progress) => {
        options.progress_callback?.({
          loaded: progress.loaded_bytes,
          total: progress.total_bytes,
        });
      },
    });

    // Create ONNX session
    const executionProvider = getExecutionProvider(backend);
    const session = await createSession(modelBuffer, {
      executionProvider,
    });

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
