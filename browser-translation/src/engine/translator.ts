/**
 * Core TranslationEngine — the primary public API.
 *
 * Orchestrates text chunking, pipeline management, pivot routing,
 * and translation caching into a single high-level interface.
 *
 * @example
 * ```ts
 * import { TranslationEngine } from "@smart-tool/lengua-materna";
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
import { RuleBasedTranslator } from "./rule-translator.js";

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
   *
   * In "prefer-rules" mode, backend detection is skipped since ONNX models
   * are not used.
   */
  async initialize(callbacks: TranslationEngineCallbacks = {}): Promise<void> {
    this.callbacks = callbacks;

    // Wire up pipeline progress reporting
    this.pipelineManager.setProgressCallback((progress) => {
      this.callbacks.onModelLoadProgress?.(progress);
    });

    // Skip heavy backend detection in prefer-rules mode
    if (this.config.ruleTranslationMode !== "prefer-rules") {
      // Detect capabilities and select backend
      const capabilities = await detectCapabilities();
      this.backend = selectBackend(capabilities, this.config.preferredBackend);
      this.callbacks.onBackendSelected?.(this.backend);

      // Update config with detected backend
      this.config.preferredBackend = this.backend;
    }

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

    // In "prefer-rules" mode, skip pipeline entirely and use dictionaries
    if (this.config.ruleTranslationMode === "prefer-rules") {
      return this.translateWithRules(text, request);
    }

    // Resolve translation route (direct or pivot)
    const route = resolveRoute(sourceLang, targetLang);
    if (!route) {
      // If no model route exists, try rule-based as fallback
      if (this.config.ruleTranslationMode !== "disabled") {
        return this.translateWithRules(text, request);
      }
      throw new Error(
        `No translation route available for ${sourceLang} → ${targetLang}. ` +
        `Neither a direct model nor a pivot path through English exists.`
      );
    }

    const startTime = performance.now();
    let currentText = text;
    const modelsUsed: string[] = [];
    let totalChunks = 0;

    try {
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
    } catch (pipelineError) {
      // Fall back to rule-based translation when ONNX pipeline fails
      if (this.config.ruleTranslationMode !== "disabled") {
        return this.translateWithRules(text, request);
      }
      throw pipelineError;
    }

    const durationMs = performance.now() - startTime;

    // Check if output is identical to input (may be expected for proper nouns,
    // numbers, URLs, or technical terms — warn instead of throwing)
    const normalise = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
    const warning = (currentText && normalise(currentText) === normalise(text))
      ? "Translation returned text identical to the original. This may be expected for proper nouns, numbers, or technical terms."
      : undefined;

    return this.buildResult(
      text,
      currentText,
      request,
      route.isPivot,
      durationMs,
      modelsUsed,
      totalChunks,
      route.isPivot ? "en" : undefined,
      warning
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
   * Translate text using rule-based phrase/word dictionaries.
   * Used as a fallback when ONNX models are unavailable, or in "prefer-rules" mode.
   * Only supports English as source language.
   */
  private async translateWithRules(
    text: string,
    request: TranslationRequest
  ): Promise<TranslationResult> {
    const { sourceLang, targetLang } = request;

    if (sourceLang !== "en") {
      throw new Error(
        `Rule-based translation only supports English as source language (got "${sourceLang}").`
      );
    }

    const pairId = buildPairId(sourceLang, targetLang) as LanguagePairId;
    const ruleTranslator = await RuleBasedTranslator.create(pairId);

    if (!ruleTranslator) {
      throw new Error(
        `No rule-based dictionary available for ${sourceLang} → ${targetLang}.`
      );
    }

    const startTime = performance.now();
    const chunks = chunkText(text, { maxChars: this.config.maxChunkChars });
    const translatedChunks = [];

    for (const chunk of chunks) {
      if (chunk.isSeparator) {
        translatedChunks.push(chunk);
        continue;
      }

      // Check translation cache
      const cached = this.translationCache.get(chunk.text, pairId);
      if (cached) {
        translatedChunks.push({ ...chunk, text: cached });
        continue;
      }

      const translated = ruleTranslator.translate(chunk.text);
      this.translationCache.set(chunk.text, pairId, translated);
      translatedChunks.push({ ...chunk, text: translated });
    }

    const translated = reassembleChunks(translatedChunks);
    const durationMs = performance.now() - startTime;
    const contentChunks = chunks.filter((c) => !c.isSeparator).length;

    return this.buildResult(
      text,
      translated,
      request,
      false,
      durationMs,
      ["rule-based"],
      contentChunks,
      undefined,
      "Translated using rule-based dictionary. Quality may be lower than neural translation."
    );
  }

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

      // Translate via Puente Engine — pass source/target lang for
      // multilingual models that need a target language prefix token
      const result = await pipeline.translate(cleaned, {
        max_new_tokens: maxNewTokens,
        src_lang: modelInfo.sourceLang,
        tgt_lang: modelInfo.targetLang,
      });

      const translatedText = result.translation_text;
      const restored = restore(String(translatedText ?? "").trim());

      // When the model produces no output for a chunk, fall back to the
      // original text so the caller always receives a non-empty result.
      // Do not cache the fallback — a future attempt may succeed.
      if (restored) {
        this.translationCache.set(chunk.text, pair, restored);
      }

      translatedChunks.push({ ...chunk, text: restored || chunk.text });
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
    pivotLang?: LanguageCode,
    warning?: string
  ): TranslationResult {
    const result: TranslationResult = {
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
    if (warning) {
      result.warning = warning;
    }
    return result;
  }
}
