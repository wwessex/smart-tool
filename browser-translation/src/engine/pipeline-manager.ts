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

  /**
   * Default remote CDN for OPUS-MT ONNX models.
   *
   * Points to the Xenova HuggingFace Hub namespace which hosts
   * ONNX-converted OPUS-MT models compatible with Puente Engine.
   * Model files are resolved as: `{CDN}{modelId}/resolve/main/`.
   */
  private static readonly DEFAULT_REMOTE_CDN = "https://huggingface.co/Xenova/";

  private async loadPipeline(
    pair: LanguagePairId,
    modelId: string,
    dtype: ModelDtype,
    cacheKey: string
  ): Promise<TranslationPipeline> {
    this.emitProgress(modelId, "downloading", 0, 0);

    // Evict LRU pipeline if at capacity
    await this.ensureCapacity();

    // Try local model files first
    try {
      const localPaths = this.buildModelPaths(modelId, /* remote */ false);
      return await this.createPuentePipeline(pair, modelId, dtype, cacheKey, localPaths);
    } catch (localError) {
      // If local loading fails with 404 and remote models are allowed,
      // fall back to fetching from a remote CDN.
      if (this.config.allowRemoteModels && PipelineManager.is404Error(localError)) {
        try {
          const remotePaths = this.buildModelPaths(modelId, /* remote */ true);
          return await this.createPuentePipeline(pair, modelId, dtype, cacheKey, remotePaths);
        } catch (remoteError) {
          const rawMessage = remoteError instanceof Error ? remoteError.message : String(remoteError);
          this.emitProgress(modelId, "error", 0, 0, rawMessage);
          throw new Error(rawMessage);
        }
      }

      // Not a 404, or remote models not allowed — propagate original error.
      const rawMessage = localError instanceof Error ? localError.message : String(localError);
      const isMissingModel = PipelineManager.is404Error(localError);

      const isAccessError = /unauthori[sz]ed|forbidden|401|403/i.test(rawMessage);
      const message = isAccessError
        ? `Translation model "${modelId}" is unavailable — the model files may be missing or inaccessible.`
        : isMissingModel
          ? [
              `Translation model "${modelId}" was not found in local files.`,
              `Expected model path: "${this.buildModelPaths(modelId, false).configPath}".`,
              `Run \`npm run fetch-models\` to download local translation models, or set \`allowRemoteModels: true\` to enable automatic CDN fallback.`,
            ].join(" ")
          : rawMessage;

      this.emitProgress(modelId, "error", 0, 0, message);
      throw new Error(message);
    }
  }

  /**
   * Build config and model paths for a given model ID.
   *
   * Local layout:
   *   configPath = {modelBasePath}{modelId}/
   *   modelPath  = {modelBasePath}{modelId}/onnx/
   *
   * Remote (HuggingFace Hub) layout:
   *   configPath = {remoteCDN}{modelId}/resolve/main/
   *   modelPath  = {remoteCDN}{modelId}/resolve/main/onnx/
   */
  private buildModelPaths(
    modelId: string,
    remote: boolean
  ): { configPath: string; modelPath: string } {
    if (remote) {
      const cdnBase =
        this.config.remoteModelBasePath ?? PipelineManager.DEFAULT_REMOTE_CDN;
      const normalized = cdnBase.endsWith("/") ? cdnBase : `${cdnBase}/`;
      const root = `${normalized}${modelId}/resolve/main/`;
      return { configPath: root, modelPath: `${root}onnx/` };
    }

    const basePath = this.config.modelBasePath ?? "./models/";
    return {
      configPath: `${basePath}${modelId}/`,
      modelPath: `${basePath}${modelId}/onnx/`,
    };
  }

  /**
   * Create a Puente Engine TranslationPipeline from resolved paths.
   */
  private async createPuentePipeline(
    pair: LanguagePairId,
    modelId: string,
    dtype: ModelDtype,
    cacheKey: string,
    paths: { configPath: string; modelPath: string }
  ): Promise<TranslationPipeline> {
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

    const translationPipeline = await PuenteTranslationPipeline.create(paths.modelPath, {
      configPath: paths.configPath,
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
  }

  /** Check if an error indicates a 404 (model files not found). */
  private static is404Error(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /\b404\b|not found/i.test(message);
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
