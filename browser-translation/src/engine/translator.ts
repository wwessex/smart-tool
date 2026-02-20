/**
 * Core TranslationEngine — the primary public API.
 *
 * Orchestrates text chunking, pipeline management, pivot routing,
 * and translation caching into a single high-level interface.
 *
 * @example
 * ```ts
 * import { TranslationEngine } from "@smart-tool/browser-translation";
 *
 * const engine = new TranslationEngine({
 *   modelBasePath: "/models/",
 *   allowRemoteModels: false,
 *   useBrowserCache: true,
 *   maxLoadedPipelines: 3,
 *   maxChunkChars: 900,
 * });
 *
 * await engine.initialize({
 *   onModelLoadProgress: (p) => console.log(p),
 *   onBackendSelected: (b) => console.log(`Backend: ${b}`),
 * });
 *
 * const result = await engine.translate({
 *   text: "Hello, how are you?",
 *   sourceLang: "en",
 *   targetLang: "de",
 * });
 *
 * console.log(result.translated); // "Hallo, wie geht es Ihnen?"
 * ```
 */

import type {
  TranslationRequest,
  TranslationResult,
  TranslationEngineConfig,
  TranslationEngineCallbacks,
  InferenceBackend,
  LanguageCode,
  LanguagePairId,
  ModelDtype,
} from "../types.js";
import { PipelineManager } from "./pipeline-manager.js";
import { chunkText, reassembleChunks, protectPlaceholders } from "./text-chunker.js";
import { resolveRoute, buildPairId, canTranslate } from "../models/pivot.js";
import { getModelForPair, isRTL, getDirection, SUPPORTED_LANGUAGES } from "../models/registry.js";
import { TranslationCache } from "../cache/translation-cache.js";
import { detectCapabilities, selectBackend } from "../runtime/backend-selector.js";

/** Default engine configuration. */
const DEFAULT_CONFIG: TranslationEngineConfig = {
  modelBasePath: "/models/",
  allowRemoteModels: false,
  useBrowserCache: true,
  maxLoadedPipelines: 3,
  maxChunkChars: 900,
};

export class TranslationEngine {
  private readonly config: TranslationEngineConfig;
  private readonly pipelineManager: PipelineManager;
  private readonly translationCache: TranslationCache;
  private backend: InferenceBackend | null = null;
  private initialized = false;
  private callbacks: TranslationEngineCallbacks = {};

  constructor(config: Partial<TranslationEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.pipelineManager = new PipelineManager(this.config);
    this.translationCache = new TranslationCache();
  }

  /**
   * Initialize the engine: detect browser capabilities and select backend.
   * Must be called before translate().
   */
  async initialize(callbacks: TranslationEngineCallbacks = {}): Promise<void> {
    this.callbacks = callbacks;

    // Wire up pipeline progress reporting
    this.pipelineManager.setProgressCallback((progress) => {
      this.callbacks.onModelLoadProgress?.(progress);
    });

    // Detect capabilities and select backend
    const capabilities = await detectCapabilities();
    this.backend = selectBackend(capabilities, this.config.preferredBackend);
    this.callbacks.onBackendSelected?.(this.backend);

    // Update config with detected backend
    this.config.preferredBackend = this.backend;

    this.initialized = true;
  }

  /**
   * Translate text from source to target language.
   *
   * Handles:
   * - Text chunking to stay within model limits
   * - Placeholder preservation for format strings
   * - Pivot translation when no direct model exists
   * - Translation caching for repeated segments
   * - Validation that output differs from input
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    if (!this.initialized) {
      throw new Error("TranslationEngine not initialized. Call initialize() first.");
    }

    const { text, sourceLang, targetLang, maxNewTokens = 512 } = request;

    // Validate input
    if (!text?.trim()) {
      throw new Error("Empty text provided for translation.");
    }

    if (sourceLang === targetLang) {
      return this.buildResult(text, text, request, false, 0, []);
    }

    // Resolve translation route (direct or pivot)
    const route = resolveRoute(sourceLang, targetLang);
    if (!route) {
      throw new Error(
        `No translation route available for ${sourceLang} → ${targetLang}. ` +
        `Neither a direct model nor a pivot path through English exists.`
      );
    }

    const startTime = performance.now();
    let currentText = text;
    const modelsUsed: string[] = [];
    let totalChunks = 0;

    // Execute each step in the route
    for (const pairId of route.steps) {
      const { translated, chunks, modelId } = await this.translateWithPipeline(
        currentText,
        pairId,
        maxNewTokens
      );
      currentText = translated;
      modelsUsed.push(modelId);
      totalChunks += chunks;
    }

    const durationMs = performance.now() - startTime;

    // Validate output differs from input
    const normalise = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
    if (currentText && normalise(currentText) === normalise(text)) {
      throw new Error("Translation failed: model returned unchanged text.");
    }

    return this.buildResult(
      text,
      currentText,
      request,
      route.isPivot,
      durationMs,
      modelsUsed,
      totalChunks,
      route.isPivot ? "en" : undefined
    );
  }

  /**
   * Check if a language pair can be translated (directly or via pivot).
   */
  canTranslate(sourceLang: LanguageCode, targetLang: LanguageCode): boolean {
    return canTranslate(sourceLang, targetLang);
  }

  /**
   * Check if a language code uses right-to-left script.
   */
  isRTL(code: LanguageCode): boolean {
    return isRTL(code);
  }

  /**
   * Get the script direction for a language code.
   */
  getDirection(code: LanguageCode): "ltr" | "rtl" {
    return getDirection(code);
  }

  /**
   * Preload a model for a language pair (warm up during idle time).
   */
  async preload(
    sourceLang: LanguageCode,
    targetLang: LanguageCode,
    dtype?: ModelDtype
  ): Promise<void> {
    const route = resolveRoute(sourceLang, targetLang);
    if (!route) return;
    for (const pairId of route.steps) {
      await this.pipelineManager.preload(pairId, dtype);
      this.callbacks.onPipelineReady?.(pairId);
    }
  }

  /**
   * Evict a loaded model to free memory.
   */
  evict(sourceLang: LanguageCode, targetLang: LanguageCode): void {
    const pair = buildPairId(sourceLang, targetLang);
    if (this.pipelineManager.evict(pair)) {
      this.callbacks.onPipelineEvicted?.(pair);
    }
  }

  /**
   * Evict all loaded models.
   */
  evictAll(): void {
    this.pipelineManager.evictAll();
  }

  /**
   * Clear the translation segment cache.
   */
  clearCache(): void {
    this.translationCache.clear();
  }

  /**
   * Get the currently selected inference backend.
   */
  getBackend(): InferenceBackend | null {
    return this.backend;
  }

  /**
   * Get info about currently loaded pipelines.
   */
  getLoadedModels() {
    return this.pipelineManager.getLoadedPairs();
  }

  /**
   * Get all supported languages.
   */
  getSupportedLanguages() {
    return { ...SUPPORTED_LANGUAGES };
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  /**
   * Translate text through a single pipeline (one language pair).
   */
  private async translateWithPipeline(
    text: string,
    pair: LanguagePairId,
    maxNewTokens: number
  ): Promise<{ translated: string; chunks: number; modelId: string }> {
    const modelInfo = getModelForPair(pair);
    if (!modelInfo) {
      throw new Error(`No model for pair: ${pair}`);
    }

    const pipeline = await this.pipelineManager.getPipeline(pair);
    const chunks = chunkText(text, { maxChars: this.config.maxChunkChars });

    const translatedChunks = [];
    for (const chunk of chunks) {
      if (chunk.isSeparator) {
        translatedChunks.push(chunk);
        continue;
      }

      // Check translation cache first
      const cached = this.translationCache.get(chunk.text, pair);
      if (cached) {
        translatedChunks.push({ ...chunk, text: cached });
        continue;
      }

      // Protect placeholders from translation
      const { cleaned, restore } = protectPlaceholders(chunk.text);

      // Build pipeline options — for multilingual models that need a
      // target language prefix token (e.g., ">>cy<<"), pass tgt_lang
      const pipelineOptions: Record<string, unknown> = {
        max_new_tokens: maxNewTokens,
      };

      // Some OPUS-MT multilingual models require src_lang/tgt_lang
      if (modelInfo.modelId.includes("-mul") || modelInfo.modelId.includes("-cel")) {
        pipelineOptions.tgt_lang = modelInfo.targetLang;
        pipelineOptions.src_lang = modelInfo.sourceLang;
      }

      const result = await pipeline(cleaned, pipelineOptions as any);

      const translatedText = Array.isArray(result)
        ? (result[0] as any)?.translation_text
        : (result as any)?.translation_text;

      const restored = restore(String(translatedText ?? "").trim());

      // Cache the translation
      this.translationCache.set(chunk.text, pair, restored);

      translatedChunks.push({ ...chunk, text: restored });
    }

    const translated = reassembleChunks(translatedChunks);
    const contentChunks = chunks.filter((c) => !c.isSeparator).length;

    return { translated, chunks: contentChunks, modelId: modelInfo.modelId };
  }

  private buildResult(
    original: string,
    translated: string,
    request: TranslationRequest,
    usedPivot: boolean,
    durationMs: number,
    modelsUsed: string[],
    chunksTranslated = 0,
    pivotLang?: LanguageCode
  ): TranslationResult {
    return {
      original,
      translated,
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      usedPivot,
      pivotLang,
      durationMs,
      chunksTranslated,
      modelsUsed,
    };
  }
}
