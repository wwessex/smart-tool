/**
 * Lengua Materna Translation Engine
 *
 * Offline-first, privacy-preserving in-browser translation engine.
 *
 * Uses lightweight, per-language-pair OPUS-MT (Marian) models running locally
 * via the Puente Engine (ONNX Runtime Web). Supports WebGPU acceleration
 * with WASM fallback.
 *
 * Key improvements over the previous NLLB-200 approach:
 * - Much smaller per-pair models (~50-150 MB quantized vs multi-GB)
 * - CC-BY-4.0 licensing (vs CC-BY-NC-4.0 for NLLB)
 * - LRU pipeline management (max 3 models loaded at once)
 * - Pivot translation through English for unsupported direct pairs
 * - Web Worker support for off-main-thread inference
 * - Translation segment caching
 * - Placeholder preservation for format strings
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
 *   onModelLoadProgress: (p) => console.log(`${p.modelId}: ${p.phase}`),
 *   onBackendSelected: (b) => console.log(`Backend: ${b}`),
 * });
 *
 * const result = await engine.translate({
 *   text: "Update your CV with recent work experience.",
 *   sourceLang: "en",
 *   targetLang: "pl",
 * });
 *
 * console.log(result.translated);
 * console.log(`Took ${result.durationMs}ms, pivot: ${result.usedPivot}`);
 * ```
 *
 * @packageDocumentation
 */

// ---- Core engine (primary public API) ----
export { TranslationEngine } from "./engine/translator.js";

// ---- Pipeline management ----
export { PipelineManager } from "./engine/pipeline-manager.js";

// ---- Text chunking ----
export { chunkText, reassembleChunks, protectPlaceholders } from "./engine/text-chunker.js";
export type { TextChunk, ChunkOptions } from "./engine/text-chunker.js";

// ---- Model registry ----
export {
  SUPPORTED_LANGUAGES,
  MODEL_REGISTRY,
  getModelForPair,
  hasDirectModel,
  getRegisteredPairs,
  getLanguageInfo,
  getSupportedLanguageCodes,
  isRTL,
  getDirection,
  estimateDownloadSize,
  getAttributions,
} from "./models/registry.js";

// ---- Pivot routing ----
export {
  resolveRoute,
  canTranslate,
  getTranslatableTargets,
  buildPairId,
  getPivotLanguage,
  getMaxPivotHops,
} from "./models/pivot.js";

// ---- Runtime / backend ----
export {
  detectCapabilities,
  selectBackend,
  canUseThreads,
  describeBackend,
} from "./runtime/backend-selector.js";

// ---- Worker client ----
export { TranslationWorkerClient } from "./runtime/worker-client.js";
export type { WorkerClientCallbacks } from "./runtime/worker-client.js";

// ---- Caching ----
export { TranslationCache } from "./cache/translation-cache.js";
export { ModelCacheManager } from "./cache/model-cache.js";

// ---- RTL utilities ----
export {
  isRTL as isRTLScript,
  getDirection as getScriptDirection,
  getDirAttribute,
} from "./utils/rtl.js";

// ---- Types (re-export all) ----
export type {
  LanguageCode,
  LanguagePairId,
  ScriptDirection,
  LanguageInfo,
  ModelDtype,
  ModelInfo,
  TranslationRequest,
  TranslationResult,
  TranslationEngineConfig,
  InferenceBackend,
  BrowserCapabilities,
  TranslationCacheEntry,
  ModelCacheEntry,
  ModelLoadProgress,
  TranslationEngineCallbacks,
  WorkerMessage,
  TranslationRoute,
} from "./types.js";
