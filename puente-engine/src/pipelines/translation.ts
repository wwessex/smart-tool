/**
 * High-level translation pipeline.
 *
 * Orchestrates encoder/decoder model loading, tokenizer initialization,
 * and seq2seq generation into a single easy-to-use API.
 * Designed to be a drop-in replacement for the Transformers.js
 * pipeline("translation", ...) call.
 *
 * Supports both:
 * - Split models (encoder_model.onnx + decoder_model_merged.onnx)
 * - Combined models (model.onnx with encoder and decoder in one)
 */

import type {
  TranslationOptions,
  TranslationResult,
  ModelConfig,
  InferenceBackend,
} from "../core/types.js";
import { createSession, getExecutionProvider } from "../core/session.js";
import { BPETokenizer } from "../tokenizer/bpe-tokenizer.js";
import { Seq2SeqGenerator } from "../generation/seq2seq-generator.js";
import { fetchModel } from "../model/model-loader.js";
import { loadModelConfig } from "../model/model-config.js";
import { selectBackend, detectCapabilities } from "../runtime/device.js";
import { configureBackend } from "../runtime/backend.js";
import type * as ort from "onnxruntime-web";

/** Options for creating a translation pipeline. */
export interface TranslationPipelineOptions {
  /** Preferred inference backend. Auto-detected if not set. */
  device?: string;
  /** Model quantization dtype. */
  dtype?: string;
  /** Progress callback for model download. */
  progress_callback?: (progress: {
    loaded?: number;
    total?: number;
  }) => void;
}

export class TranslationPipeline {
  private generator: Seq2SeqGenerator;
  private tokenizer: BPETokenizer;
  private modelConfig: ModelConfig;
  private backend: InferenceBackend;
  private encoderSession: ort.InferenceSession;
  private decoderSession: ort.InferenceSession;

  private constructor(
    encoderSession: ort.InferenceSession,
    decoderSession: ort.InferenceSession,
    generator: Seq2SeqGenerator,
    tokenizer: BPETokenizer,
    modelConfig: ModelConfig,
    backend: InferenceBackend
  ) {
    this.encoderSession = encoderSession;
    this.decoderSession = decoderSession;
    this.generator = generator;
    this.tokenizer = tokenizer;
    this.modelConfig = modelConfig;
    this.backend = backend;
  }

  /**
   * Create a translation pipeline by loading model and tokenizer.
   *
   * @param modelPath - Base URL/path to the model directory
   *   (should contain encoder_model.onnx, decoder_model_merged.onnx,
   *    tokenizer.json, config.json — or model.onnx for combined models)
   * @param options - Pipeline creation options
   */
  static async create(
    modelPath: string,
    options: TranslationPipelineOptions = {}
  ): Promise<TranslationPipeline> {
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

    // Load tokenizer
    const tokenizer = new BPETokenizer();
    await tokenizer.load(basePath + "tokenizer.json");

    const executionProvider = getExecutionProvider(backend);

    // Try split model first (encoder + decoder), fall back to combined
    let encoderSession: ort.InferenceSession;
    let decoderSession: ort.InferenceSession;

    try {
      // Load split models
      const [encoderBuffer, decoderBuffer] = await Promise.all([
        fetchModel(basePath + "encoder_model.onnx", {
          onProgress: (progress) => {
            options.progress_callback?.({
              loaded: progress.loaded_bytes,
              total: progress.total_bytes,
            });
          },
        }),
        fetchModel(basePath + "decoder_model_merged.onnx", {
          onProgress: (progress) => {
            options.progress_callback?.({
              loaded: progress.loaded_bytes,
              total: progress.total_bytes,
            });
          },
        }),
      ]);

      [encoderSession, decoderSession] = await Promise.all([
        createSession(encoderBuffer, { executionProvider }),
        createSession(decoderBuffer, { executionProvider }),
      ]);
    } catch {
      // Fall back to combined model
      const modelBuffer = await fetchModel(basePath + "model.onnx", {
        onProgress: (progress) => {
          options.progress_callback?.({
            loaded: progress.loaded_bytes,
            total: progress.total_bytes,
          });
        },
      });

      const session = await createSession(modelBuffer, {
        executionProvider,
      });
      encoderSession = session;
      decoderSession = session;
    }

    // Create generator
    const generator = new Seq2SeqGenerator(
      encoderSession,
      decoderSession,
      tokenizer,
      modelConfig
    );

    return new TranslationPipeline(
      encoderSession,
      decoderSession,
      generator,
      tokenizer,
      modelConfig,
      backend
    );
  }

  /**
   * Translate text.
   *
   * Callable interface — can be used as: `pipeline(text, options)`
   */
  async translate(
    text: string,
    options: Partial<TranslationOptions> = {}
  ): Promise<TranslationResult> {
    return this.generator.generate({
      text,
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
    await this.encoderSession.release();
    if (this.decoderSession !== this.encoderSession) {
      await this.decoderSession.release();
    }
  }
}
