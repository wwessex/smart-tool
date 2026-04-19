/**
 * Core type definitions for the Lengua Materna Translation Engine.
 *
 * This module provides lightweight, per-language-pair OPUS-MT (Marian) models
 * running locally in the browser via the Puente Engine (ONNX Runtime Web).
 */

// ---------------------------------------------------------------------------
// Language and model types
// ---------------------------------------------------------------------------

/**
 * ISO 639-1 codes for all languages supported by the engine.
 * Add new language codes here when expanding language support.
 */
export const SUPPORTED_LANGUAGE_CODES = [
  "en", "pl", "ur", "cy", "bn", "pa", "ps", "so", "ti",
  "ar", "de", "fr", "es", "it", "pt", "hi",
] as const;

/**
 * Strongly-typed language code — one of the supported ISO 639-1 codes.
 * Use this in internal code and registry definitions for compile-time
 * validation. For public API boundaries that accept user input, use
 * {@link LanguageCode} (which accepts any string).
 */
export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGE_CODES[number];

/**
 * ISO 639-1 language code (e.g., "en", "ar", "cy").
 *
 * This is typed as `string` to keep the public API flexible — callers
 * may pass user-supplied strings that are validated at runtime. For
 * internal registry use, prefer {@link SupportedLanguageCode}.
 */
export type LanguageCode = string;

/** Directional language pair identifier (e.g., "en-de", "en-ar"). */
export type LanguagePairId = `${LanguageCode}-${LanguageCode}`;

/** Script direction for rendering. */
export type ScriptDirection = "ltr" | "rtl";

/** Metadata for a supported language. */
export interface LanguageInfo {
  /** ISO 639-1 code. */
  code: LanguageCode;
  /** English display name. */
  name: string;
  /** Native display name. */
  nativeName: string;
  /** Country/region badge code for UI (e.g., "GB", "PL"). */
  flag: string;
  /** Script direction. */
  direction: ScriptDirection;
  /** Optional hint about the writing script (e.g., "Use Arabic script."). */
  scriptHint?: string;
  /** ISO 639-2/T code (e.g., "deu" for German). */
  iso639_2?: string;
  /** ISO 639-3 code (usually same as 639-2/T for these languages). */
  iso639_3?: string;
  /** Writing system name (e.g., "Latin", "Arabic", "Devanagari"). */
  script?: string;
  /** Language family path (e.g., ["Indo-European", "Romance"] for French). */
  family?: string[];
  /** Countries/regions where this is an official or widely-spoken language. */
  regions?: string[];
  /** A short greeting in the language (e.g., "Shwmae" for Welsh). */
  greeting?: string;
  /** Brief translation notes relevant to advisors (formality, grammar caveats). */
  translationNotes?: string;
  /** Approximate number of native speakers (L1) in millions. */
  speakersMillions?: number;
}

/** Quantization level for model weights. */
export type ModelDtype = "fp32" | "fp16" | "int8" | "q4";

/** Information about an OPUS-MT model for a specific language pair. */
export interface ModelInfo {
  /** Model ID (e.g., "opus-mt-en-de"). */
  modelId: string;
  /** Source language code. */
  sourceLang: LanguageCode;
  /** Target language code. */
  targetLang: LanguageCode;
  /** Available quantization variants (smallest listed first). */
  availableDtypes: ModelDtype[];
  /** Recommended dtype for browser use. */
  recommendedDtype: ModelDtype;
  /** Approximate installed size in bytes for the recommended dtype. */
  approximateSizeBytes: number;
  /** SPDX licence identifier. */
  licence: string;
  /** Attribution text required by the licence. */
  attribution: string;
}

/** Reachability state for an upstream or browser-ready model source. */
export type TranslationSourceStatus = "reachable" | "auth_required" | "unknown";

/** Per-model provenance and packaging metadata. */
export interface TranslationSourceModelEntry {
  /** Runtime artifact identifier and local bundle directory name. */
  modelId: string;
  /** Relative path to the bundled local model directory. */
  localPath: string;
  /** All directional language pairs served by this artifact. */
  supportedPairs: LanguagePairId[];
  /** Canonical upstream OPUS/Marian source repository. */
  upstreamRepoId: string;
  /** Browser-facing URL for the upstream source. */
  upstreamUrl: string;
  /** Browser-ready ONNX repository used for bundling or dev fallback. */
  browserRepoId: string;
  /** Browser-facing URL for the browser-ready source. */
  browserUrl: string;
  /** How this model artifact is produced. */
  conversionStatus: "hosted_direct" | "hosted_grouped" | "self_host_required";
  /** Generated after provisioning local bundles. */
  checksums: Record<string, string | null>;
  /** Last verified source reachability snapshot. */
  lastVerifiedAccess: {
    date: string;
    upstreamStatus: TranslationSourceStatus;
    browserStatus: TranslationSourceStatus;
    notes?: string;
  };
}

/** Directional pair metadata within the source manifest. */
export interface TranslationSourcePairEntry {
  /** Runtime artifact identifier used for this pair. */
  modelId: string;
}

/** Checked-in manifest that maps pairs to bundled translation sources. */
export interface TranslationSourceManifest {
  /** Manifest schema/content version. */
  version: string;
  /** Relative root directory for bundled local models. */
  localRoot: string;
  /** Files required for each bundled model artifact. */
  requiredFiles: string[];
  /** Directional pair -> runtime artifact mapping. */
  pairs: Record<LanguagePairId, TranslationSourcePairEntry>;
  /** Runtime artifact -> source provenance metadata. */
  models: Record<string, TranslationSourceModelEntry>;
}

// ---------------------------------------------------------------------------
// Translation request / result
// ---------------------------------------------------------------------------

/** A request to translate text. */
export interface TranslationRequest {
  /** The text to translate. */
  text: string;
  /** Source language code. */
  sourceLang: LanguageCode;
  /** Target language code. */
  targetLang: LanguageCode;
  /** Maximum new tokens per chunk (default: 512). */
  maxNewTokens?: number;
  /** Preferred quantization level (uses model default if unset). */
  dtype?: ModelDtype;
}

/** Result of a translation operation. */
export interface TranslationResult {
  /** Original source text. */
  original: string;
  /** Translated text. */
  translated: string;
  /** Source language code used. */
  sourceLang: LanguageCode;
  /** Target language code used. */
  targetLang: LanguageCode;
  /** Whether pivot translation was used (e.g., cy->en->ar). */
  usedPivot: boolean;
  /** Pivot language code if pivot was used. */
  pivotLang?: LanguageCode;
  /** Time taken in milliseconds. */
  durationMs: number;
  /** Number of chunks the text was split into. */
  chunksTranslated: number;
  /** Model ID(s) used for translation. */
  modelsUsed: string[];
  /** Optional warning if the translation may need review (e.g. identical to original). */
  warning?: string;
  /** Optional runtime diagnostics for packaging and fallback analysis. */
  diagnostics?: TranslationDiagnostics;
}

/** Runtime diagnostics attached to translation results. */
export interface TranslationDiagnostics {
  /** Route that was attempted or used, in execution order. */
  route: LanguagePairId[];
  /** Whether dictionary fallback was used. */
  usedRuleFallback: boolean;
  /** Why a fallback or degraded path was used. */
  fallbackReason?: string;
  /** Checked-in source manifest version. */
  sourceManifestVersion: string;
  /** Glossary metadata version used by the rule-based dictionary layer. */
  glossaryVersion?: string;
}

// ---------------------------------------------------------------------------
// Engine configuration
// ---------------------------------------------------------------------------

/** Configuration for the TranslationEngine. */
export interface TranslationEngineConfig {
  /** Base URL or path where model files are stored locally. */
  modelBasePath: string;
  /** Whether to allow fetching models from a remote CDN when local files are not found (default: false). */
  allowRemoteModels: boolean;
  /**
   * Base URL for remote model hosting.
   * Used as a fallback when `allowRemoteModels` is true and local model files return 404.
   * Models are resolved as `{remoteModelBasePath}{modelId}/resolve/main/`.
   * Defaults to the Xenova HuggingFace Hub namespace (ONNX-converted OPUS-MT models).
   */
  remoteModelBasePath?: string;
  /**
   * Optional HTTP headers to include in fetch requests when downloading
   * models from the remote CDN.
   *
   * Use this to authenticate with gated or private model repositories.
   * For HuggingFace, set `{ Authorization: "Bearer hf_..." }`.
   *
   * These headers are only sent for remote model requests, not local file fetches.
   */
  remoteModelRequestHeaders?: Record<string, string>;
  /** Whether to use the browser Cache API for model files (default: true). */
  useBrowserCache: boolean;
  /** Preferred inference backend (auto-detected if not set). */
  preferredBackend?: InferenceBackend;
  /** Preferred quantization dtype (uses model recommendation if not set). */
  preferredDtype?: ModelDtype;
  /** Maximum number of pipelines to keep loaded simultaneously (default: 3). */
  maxLoadedPipelines: number;
  /** URL for the translation Web Worker script. */
  workerUrl?: string;
  /** Maximum characters per translation chunk (default: 900). */
  maxChunkChars: number;
  /**
   * Rule-based translation mode:
   * - "fallback" (default): Try ONNX pipeline first, fall back to rules on failure.
   * - "prefer-rules": Always use rule-based dictionary (skip model loading).
   * - "disabled": Never use rule-based translation.
   */
  ruleTranslationMode?: "fallback" | "prefer-rules" | "disabled";
}

// ---------------------------------------------------------------------------
// Runtime / backend types
// ---------------------------------------------------------------------------

/** Inference backend for ONNX Runtime Web. */
export type InferenceBackend = "webgpu" | "wasm-simd" | "wasm-basic";

/** Browser capabilities relevant to translation inference. */
export interface BrowserCapabilities {
  webgpu: boolean;
  wasmSimd: boolean;
  wasmThreads: boolean;
  crossOriginIsolated: boolean;
  estimatedMemoryMB?: number;
}

// ---------------------------------------------------------------------------
// Caching types
// ---------------------------------------------------------------------------

/** Entry in the translation segment cache. */
export interface TranslationCacheEntry {
  /** Source text (used as part of cache key). */
  sourceText: string;
  /** Language pair (e.g., "en-de"). */
  pair: LanguagePairId;
  /** Cached translated text. */
  translatedText: string;
  /** Timestamp when cached. */
  cachedAt: number;
}

/** Entry tracking a cached model in the browser. */
export interface ModelCacheEntry {
  /** Model identifier. */
  modelId: string;
  /** Dtype of the cached variant. */
  dtype: ModelDtype;
  /** Total size in bytes. */
  sizeBytes: number;
  /** When the model was cached. */
  cachedAt: number;
  /** ETag from the source for cache invalidation. */
  etag?: string;
}

// ---------------------------------------------------------------------------
// Progress and event types
// ---------------------------------------------------------------------------

/** Progress callback for model loading. */
export interface ModelLoadProgress {
  /** Model being loaded. */
  modelId: string;
  /** Current phase. */
  phase: "downloading" | "caching" | "initializing" | "ready" | "error";
  /** Bytes loaded so far. */
  loadedBytes: number;
  /** Total bytes expected (0 if unknown). */
  totalBytes: number;
  /** Error message if phase is "error". */
  error?: string;
}

/** Callbacks for engine events. */
export interface TranslationEngineCallbacks {
  /** Called during model download/initialization. */
  onModelLoadProgress?: (progress: ModelLoadProgress) => void;
  /** Called when a backend is selected. */
  onBackendSelected?: (backend: InferenceBackend) => void;
  /** Called when a pipeline is loaded and ready. */
  onPipelineReady?: (pair: LanguagePairId) => void;
  /** Called when a pipeline is evicted from the LRU cache. */
  onPipelineEvicted?: (pair: LanguagePairId) => void;
}

// ---------------------------------------------------------------------------
// Worker message types
// ---------------------------------------------------------------------------

/** Messages sent between the main thread and the translation worker. */
export type WorkerMessage =
  | { type: "init"; config: TranslationEngineConfig }
  | { type: "init_complete"; backend: InferenceBackend }
  | { type: "init_error"; error: string }
  | { type: "translate"; id: string; request: TranslationRequest }
  | { type: "translate_complete"; id: string; result: TranslationResult }
  | { type: "translate_error"; id: string; error: string }
  | { type: "progress"; progress: ModelLoadProgress }
  | { type: "preload"; pair: LanguagePairId; dtype?: ModelDtype }
  | { type: "preload_complete"; pair: LanguagePairId }
  | { type: "evict"; pair: LanguagePairId }
  | { type: "evict_complete"; pair: LanguagePairId }
  | { type: "abort"; id: string };

// ---------------------------------------------------------------------------
// Pivot routing types
// ---------------------------------------------------------------------------

/** Describes a translation route, possibly through a pivot language. */
export interface TranslationRoute {
  /** Ordered list of language pairs to translate through. */
  steps: LanguagePairId[];
  /** Whether this route uses pivot translation. */
  isPivot: boolean;
  /** Total number of model invocations required. */
  hops: number;
}
