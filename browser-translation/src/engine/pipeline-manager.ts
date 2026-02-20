/**
 * Translation pipeline manager.
 *
 * Manages the lifecycle of Transformers.js translation pipelines,
 * one per language-pair model. Implements an LRU eviction strategy
 * to limit memory usage (default: max 3 pipelines loaded at once).
 *
 * Pipelines are loaded lazily on first use and cached for reuse.
 * The manager handles:
 * - Lazy model loading via dynamic import (avoids iOS Safari crash)
 * - Local-only model paths (env.allowRemoteModels = false)
 * - dtype selection for quantized variants
 * - LRU eviction when max loaded pipelines is exceeded
 */

import type { TranslationPipeline } from "@huggingface/transformers";
import type {
  LanguagePairId,
  ModelDtype,
  ModelLoadProgress,
  InferenceBackend,
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
 * const result = await pipeline("Hello world!");
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

  /** Evict a specific pipeline from the cache. */
  evict(pair: LanguagePairId): boolean {
    const modelInfo = getModelForPair(pair);
    if (!modelInfo) return false;

    // Find and remove any cached pipeline for this pair's model
    for (const [key, entry] of this.pipelines) {
      if (entry.pair === pair) {
        this.pipelines.delete(key);
        return true;
      }
    }
    return false;
  }

  /** Evict all loaded pipelines. */
  evictAll(): void {
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
      // Dynamic import to avoid iOS Safari crash at page load
      const { pipeline, env } = await import("@huggingface/transformers");

      // Configure local-only model loading
      env.allowRemoteModels = this.config.allowRemoteModels;
      env.allowLocalModels = true;

      if (this.config.modelBasePath) {
        env.localModelPath = this.config.modelBasePath;
      }

      if (this.config.useBrowserCache) {
        env.useBrowserCache = true;
      }

      this.emitProgress(modelId, "initializing", 0, 0);

      // Build pipeline options
      const pipelineOptions: Record<string, unknown> = {};

      // Map our dtype to Transformers.js dtype format
      if (dtype && dtype !== "fp32") {
        pipelineOptions.dtype = dtype;
      }

      // Set device based on preferred backend
      if (this.config.preferredBackend === "webgpu") {
        pipelineOptions.device = "webgpu";
      }

      const translationPipeline = await pipeline(
        "translation",
        modelId,
        pipelineOptions
      ) as TranslationPipeline;

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
      const message = error instanceof Error ? error.message : String(error);
      this.emitProgress(modelId, "error", 0, 0, message);
      throw error;
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
