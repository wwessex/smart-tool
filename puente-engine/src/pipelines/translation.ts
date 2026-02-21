/**
 * High-level translation pipeline.
 *
 * Orchestrates encoder/decoder model loading, tokenizer initialization,
 * and seq2seq generation into a single easy-to-use API.
 * Provides a high-level API for encoder-decoder translation
 * in the browser.
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
  /**
   * Separate base path for config.json and tokenizer.json.
   * Useful when config files live in a different directory than ONNX models
   * (e.g. repos with config at root and ONNX in onnx/).
   * Defaults to modelPath if not set.
   */
  configPath?: string;
  /** Override encoder ONNX filename (defaults to "encoder_model.onnx"). */
  encoderFileName?: string;
  /** Override decoder ONNX filename (defaults to "decoder_model_merged.onnx"). */
  decoderFileName?: string;
  /** Override combined model filename for fallback (defaults to "model.onnx"). */
  combinedFileName?: string;
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

    // Config/tokenizer path may differ from ONNX model path
    // (e.g. repos store config at root, ONNX in onnx/)
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

    // Load tokenizer
    const tokenizer = new BPETokenizer();
    await tokenizer.load(configBase + "tokenizer.json");

    // Resolve filenames (allow overrides for quantized variants)
    const encoderFile = options.encoderFileName ?? "encoder_model.onnx";
    const decoderFile = options.decoderFileName ?? "decoder_model_merged.onnx";
    const combinedFile = options.combinedFileName ?? "model.onnx";

    // Helper: create sessions for split or combined models with the current backend.
    //
    // When explicit encoder/decoder filenames are provided the caller
    // already knows the model is split, so a fallback to a combined
    // `model.onnx` (which won't exist) would only mask the real error
    // (e.g. WASM init failure).  We only try the combined fallback when
    // the default filenames are in use and the split files were not found.
    const hasSplitOverrides =
      options.encoderFileName !== undefined ||
      options.decoderFileName !== undefined;

    const createSessions = async (): Promise<
      [ort.InferenceSession, ort.InferenceSession]
    > => {
      const ep = getExecutionProvider(backend);

      // --- Try split model first (encoder + decoder) ---
      try {
        const [encoderBuffer, decoderBuffer] = await Promise.all([
          fetchModel(basePath + encoderFile, {
            onProgress: (progress) => {
              options.progress_callback?.({
                loaded: progress.loaded_bytes,
                total: progress.total_bytes,
              });
            },
          }),
          fetchModel(basePath + decoderFile, {
            onProgress: (progress) => {
              options.progress_callback?.({
                loaded: progress.loaded_bytes,
                total: progress.total_bytes,
              });
            },
          }),
        ]);

        const [enc, dec] = await Promise.all([
          createSession(encoderBuffer, { executionProvider: ep }),
          createSession(decoderBuffer, { executionProvider: ep }),
        ]);
        return [enc, dec];
      } catch (splitError) {
        // If the caller specified explicit encoder/decoder filenames,
        // don't mask the error with a combined-model fallback.
        if (hasSplitOverrides) {
          throw splitError;
        }

        // Fall back to combined model (only for default filenames)
        const modelBuffer = await fetchModel(basePath + combinedFile, {
          onProgress: (progress) => {
            options.progress_callback?.({
              loaded: progress.loaded_bytes,
              total: progress.total_bytes,
            });
          },
        });
        const session = await createSession(modelBuffer, {
          executionProvider: ep,
        });
        return [session, session];
      }
    };

    // Create sessions — fall back to WASM if WebGPU provider fails
    let encoderSession: ort.InferenceSession;
    let decoderSession: ort.InferenceSession;

    try {
      [encoderSession, decoderSession] = await createSessions();
    } catch (err) {
      if (backend === "webgpu") {
        console.warn(
          "[puente-engine] WebGPU session creation failed, falling back to WASM:",
          err instanceof Error ? err.message : err,
        );
        backend = capabilities.wasmSimd ? "wasm-simd" : "wasm-basic";
        configureBackend(backend);
        [encoderSession, decoderSession] = await createSessions();
      } else {
        throw err;
      }
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
