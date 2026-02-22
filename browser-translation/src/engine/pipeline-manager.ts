/**
 * Translation pipeline manager.
 *
 * Manages the lifecycle of translation pipelines (powered by Puente Engine),
 * one per language-pair model. Implements an LRU eviction strategy
 * to limit memory usage (default: max 3 pipelines loaded at once).
 *
 * Pipelines are loaded lazily on first use and cached for reuse.
 * The manager handles:
 * - Lazy model loading via dynamic import
 * - Self-hosted model paths
 * - dtype selection for quantized variants
 * - LRU eviction when max loaded pipelines is exceeded
 * - Proper resource cleanup via dispose()
 */

import type { TranslationPipeline } from "@smart-tool/puente-engine";
import type {
  LanguagePairId,
  ModelDtype,
  ModelLoadProgress,
  TranslationEngineConfig,
} from "../types.js";
import { getModelForPair } from "../models/registry.js";

/**
 * Default HuggingFace CDN base for ONNX models.
 * Xenova maintains pre-exported ONNX versions of OPUS-MT models
 * with quantized variants that match the file naming convention
 * used by the Puente Engine (encoder_model_quantized.onnx, etc.).
 */
const HF_ONNX_CDN_BASE = "https://huggingface.co/Xenova/";

/** A loaded pipeline with metadata for LRU tracking. */
interface LoadedPipeline {
  pipeline: TranslationPipeline;
  pair: LanguagePairId;
  modelId: string;
  dtype: ModelDtype;
  lastUsedAt: number;
  loadedAt: number;
}

/**
 * Manages translation pipelines with LRU eviction.
 *
 * @example
 * const manager = new PipelineManager(config);
 * const pipeline = await manager.getPipeline("en-de");
 * const result = await pipeline.translate("Hello world!");
 */
export class PipelineManager {
  private readonly pipelines = new Map<string, LoadedPipeline>();
  private readonly loading = new Map<string, Promise<TranslationPipeline>>();
  private readonly config: TranslationEngineConfig;
  private onProgress?: (progress: ModelLoadProgress) => void;

  constructor(config: TranslationEngineConfig) {
    this.config = config;
  }

  /** Set the progress callback for model loading events. */
  setProgressCallback(cb: (progress: ModelLoadProgress) => void): void {
    this.onProgress = cb;
  }

  /**
   * Get or load a translation pipeline for a language pair.
   * Handles deduplication of concurrent loads for the same pair.
   */
  async getPipeline(
    pair: LanguagePairId,
    dtypeOverride?: ModelDtype
  ): Promise<TranslationPipeline> {
    const modelInfo = getModelForPair(pair);
    if (!modelInfo) {
      throw new Error(`No model registered for language pair: ${pair}`);
    }

    const dtype = dtypeOverride ?? this.config.preferredDtype ?? modelInfo.recommendedDtype;
    const cacheKey = `${modelInfo.modelId}:${dtype}`;

    // Return cached pipeline if available
    const cached = this.pipelines.get(cacheKey);
    if (cached) {
      cached.lastUsedAt = Date.now();
      return cached.pipeline;
    }

    // Deduplicate concurrent loads
    const existing = this.loading.get(cacheKey);
    if (existing) {
      return existing;
    }

    const loadPromise = this.loadPipeline(pair, modelInfo.modelId, dtype, cacheKey);
    this.loading.set(cacheKey, loadPromise);

    try {
      return await loadPromise;
    } finally {
      this.loading.delete(cacheKey);
    }
  }

  /**
   * Preload a pipeline without waiting for a translation request.
   * Useful for warming up models during idle time.
   */
  async preload(pair: LanguagePairId, dtype?: ModelDtype): Promise<void> {
    await this.getPipeline(pair, dtype);
  }

  /** Evict a specific pipeline from the cache, releasing ONNX session resources. */
  evict(pair: LanguagePairId): boolean {
    const modelInfo = getModelForPair(pair);
    if (!modelInfo) return false;

    // Find and remove any cached pipeline for this pair's model
    for (const [key, entry] of this.pipelines) {
      if (entry.pair === pair) {
        entry.pipeline.dispose();
        this.pipelines.delete(key);
        return true;
      }
    }
    return false;
  }

  /** Evict all loaded pipelines, releasing all ONNX session resources. */
  evictAll(): void {
    for (const entry of this.pipelines.values()) {
      entry.pipeline.dispose();
    }
    this.pipelines.clear();
  }

  /** Get the number of currently loaded pipelines. */
  get loadedCount(): number {
    return this.pipelines.size;
  }

  /** Get info about currently loaded pipelines. */
  getLoadedPairs(): Array<{ pair: LanguagePairId; modelId: string; dtype: ModelDtype; lastUsedAt: number }> {
    return Array.from(this.pipelines.values()).map((entry) => ({
      pair: entry.pair,
      modelId: entry.modelId,
      dtype: entry.dtype,
      lastUsedAt: entry.lastUsedAt,
    }));
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private async loadPipeline(
    pair: LanguagePairId,
    modelId: string,
    dtype: ModelDtype,
    cacheKey: string
  ): Promise<TranslationPipeline> {
    this.emitProgress(modelId, "downloading", 0, 0);

    // Evict LRU pipeline if at capacity
    await this.ensureCapacity();

    try {
      // Dynamic import to avoid loading ONNX Runtime until needed
      const { TranslationPipeline: PuenteTranslationPipeline } = await import(
        "@smart-tool/puente-engine"
      );

      this.emitProgress(modelId, "initializing", 0, 0);

      // Resolve quantized encoder/decoder filenames
      const fileSuffix = getOnnxFileSuffix(dtype);
      const encoderFileName = `encoder_model${fileSuffix}.onnx`;
      const decoderFileName = `decoder_model_merged${fileSuffix}.onnx`;

      const device = this.config.preferredBackend === "webgpu" ? "webgpu" : undefined;

      // Helper to create a pipeline from a given config + model path pair.
      const createFromPaths = (configPath: string, modelPath: string) =>
        PuenteTranslationPipeline.create(modelPath, {
          configPath,
          device,
          dtype: dtype !== "fp32" ? dtype : undefined,
          encoderFileName,
          decoderFileName,
          progress_callback: (progress: { loaded?: number; total?: number }) => {
            if (progress.loaded !== undefined && progress.total !== undefined && progress.total > 0) {
              this.emitProgress(modelId, "downloading", progress.loaded, progress.total);
            }
          },
        });

      // Build local model paths.
      // Models store config.json/tokenizer.json at root and ONNX files
      // in an onnx/ subdirectory. Puente Engine's configPath option lets
      // us resolve each from the correct location.
      const basePath = this.config.modelBasePath ?? "./models/";
      const localConfigPath = `${basePath}${modelId}/`;
      const localModelPath = `${basePath}${modelId}/onnx/`;

      let translationPipeline: TranslationPipeline;

      try {
        translationPipeline = await createFromPaths(localConfigPath, localModelPath);
      } catch (localError) {
        // If remote models are disabled, propagate the error immediately.
        if (!this.config.allowRemoteModels) {
          throw localError;
        }

        // Only fall back to remote for 404 / "not found" errors (network or
        // server-side issues should still propagate).
        const localMsg = localError instanceof Error ? localError.message : String(localError);
        const isNotFound = /404|not found/i.test(localMsg);
        if (!isNotFound) {
          throw localError;
        }

        // Fall back to HuggingFace CDN for ONNX models.
        const remoteBase = this.config.remoteModelBasePath ?? HF_ONNX_CDN_BASE;
        const remoteConfigPath = `${remoteBase}${modelId}/resolve/main/`;
        const remoteModelPath = `${remoteBase}${modelId}/resolve/main/onnx/`;

        console.info(
          `[lengua-materna] Local model "${modelId}" not found, loading from remote CDN…`
        );

        translationPipeline = await createFromPaths(remoteConfigPath, remoteModelPath);
      }

      const now = Date.now();
      this.pipelines.set(cacheKey, {
        pipeline: translationPipeline,
        pair,
        modelId,
        dtype,
        lastUsedAt: now,
        loadedAt: now,
      });

      this.emitProgress(modelId, "ready", 0, 0);
      return translationPipeline;
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error);

      // Provide a clearer message for HTTP 401/403 errors (model files
      // may be missing or inaccessible).
      const isAccessError = /unauthori[sz]ed|forbidden|401|403/i.test(rawMessage);
      const message = isAccessError
        ? `Translation model "${modelId}" is unavailable — the model files may be missing or inaccessible.`
        : rawMessage;

      this.emitProgress(modelId, "error", 0, 0, message);
      throw new Error(message);
    }
  }

  /** Evict the least recently used pipeline if at capacity. */
  private async ensureCapacity(): Promise<void> {
    while (this.pipelines.size >= this.config.maxLoadedPipelines) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [key, entry] of this.pipelines) {
        if (entry.lastUsedAt < oldestTime) {
          oldestTime = entry.lastUsedAt;
          oldestKey = key;
        }
      }

      if (oldestKey) {
        const entry = this.pipelines.get(oldestKey);
        if (entry) {
          entry.pipeline.dispose();
        }
        this.pipelines.delete(oldestKey);
      } else {
        break;
      }
    }
  }

  private emitProgress(
    modelId: string,
    phase: ModelLoadProgress["phase"],
    loadedBytes: number,
    totalBytes: number,
    error?: string
  ): void {
    this.onProgress?.({ modelId, phase, loadedBytes, totalBytes, error });
  }
}

/**
 * Map a ModelDtype to the ONNX filename suffix used by OPUS-MT models.
 * - "fp32" → "" (no suffix, full precision)
 * - "fp16" → "" (same as fp32 for ONNX models that use fp16 in the base file)
 * - "int8" / "uint8" → "_quantized"
 * - "q4" → "_quantized" (4-bit quantized variants use the same suffix)
 */
function getOnnxFileSuffix(dtype: ModelDtype): string {
  switch (dtype) {
    case "int8":
    case "uint8":
    case "q4":
      return "_quantized";
    default:
      return "";
  }
}
