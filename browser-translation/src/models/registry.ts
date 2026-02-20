/**
 * Language pair → OPUS-MT model registry.
 *
 * Maps each supported directional language pair to a specific Xenova ONNX
 * model on Hugging Face. These are pre-converted, quantized OPUS-MT (Marian)
 * models ready for in-browser inference via Transformers.js.
 *
 * Design decisions:
 * - One-to-one directional models (en→de ≠ de→en) for best quality per pair.
 * - English is the pivot language for pairs without a direct model.
 * - Models are listed with their available dtypes and approximate sizes.
 * - Sizes are based on the Xenova ONNX repository file listings.
 *
 * To add a new language pair:
 * 1. Find or convert the OPUS-MT model to ONNX (see scripts/convert-model.py).
 * 2. Add the entry to MODEL_REGISTRY below.
 * 3. Add the language to SUPPORTED_LANGUAGES if not already present.
 */

import type {
  LanguageCode,
  LanguagePairId,
  LanguageInfo,
  ModelInfo,
  ModelDtype,
  ScriptDirection,
} from "../types.js";

// ---------------------------------------------------------------------------
// Supported languages
// ---------------------------------------------------------------------------

/**
 * All languages supported by this translation engine.
 * Matches the current smart-tool language set (from useTranslation.ts)
 * plus additional high-value pairs.
 */
export const SUPPORTED_LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: "GB",
    direction: "ltr",
  },
  cy: {
    code: "cy",
    name: "Welsh",
    nativeName: "Cymraeg",
    flag: "CY",
    direction: "ltr",
  },
  pl: {
    code: "pl",
    name: "Polish",
    nativeName: "Polski",
    flag: "PL",
    direction: "ltr",
  },
  ur: {
    code: "ur",
    name: "Urdu",
    nativeName: "\u0627\u0631\u062F\u0648",
    flag: "PK",
    direction: "rtl",
    scriptHint: "Use Arabic script.",
  },
  bn: {
    code: "bn",
    name: "Bengali",
    nativeName: "\u09AC\u09BE\u0982\u09B2\u09BE",
    flag: "BD",
    direction: "ltr",
    scriptHint: "Use Bengali script.",
  },
  ar: {
    code: "ar",
    name: "Arabic",
    nativeName: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629",
    flag: "SA",
    direction: "rtl",
    scriptHint: "Use Arabic script.",
  },
  pa: {
    code: "pa",
    name: "Punjabi",
    nativeName: "\u0A2A\u0A70\u0A1C\u0A3E\u0A2C\u0A40",
    flag: "IN",
    direction: "ltr",
    scriptHint: "Use Gurmukhi script where appropriate.",
  },
  ps: {
    code: "ps",
    name: "Pashto",
    nativeName: "\u067E\u069A\u062A\u0648",
    flag: "AF",
    direction: "rtl",
    scriptHint: "Use Pashto in Arabic script.",
  },
  so: {
    code: "so",
    name: "Somali",
    nativeName: "Soomaali",
    flag: "SO",
    direction: "ltr",
  },
  ti: {
    code: "ti",
    name: "Tigrinya",
    nativeName: "\u1275\u130D\u122D\u129B",
    flag: "ER",
    direction: "ltr",
    scriptHint: "Use Ge\u2019ez script.",
  },
  de: {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    flag: "DE",
    direction: "ltr",
  },
  fr: {
    code: "fr",
    name: "French",
    nativeName: "Fran\u00E7ais",
    flag: "FR",
    direction: "ltr",
  },
  es: {
    code: "es",
    name: "Spanish",
    nativeName: "Espa\u00F1ol",
    flag: "ES",
    direction: "ltr",
  },
  it: {
    code: "it",
    name: "Italian",
    nativeName: "Italiano",
    flag: "IT",
    direction: "ltr",
  },
  pt: {
    code: "pt",
    name: "Portuguese",
    nativeName: "Portugu\u00EAs",
    flag: "PT",
    direction: "ltr",
  },
  hi: {
    code: "hi",
    name: "Hindi",
    nativeName: "\u0939\u093F\u0928\u094D\u0926\u0940",
    flag: "IN",
    direction: "ltr",
    scriptHint: "Use Devanagari script.",
  },
};

// ---------------------------------------------------------------------------
// OPUS-MT model registry
// ---------------------------------------------------------------------------

/**
 * Registry of OPUS-MT models available for in-browser translation.
 *
 * Each entry maps a directional language pair to a specific Xenova ONNX model.
 * Sizes are approximate and based on quantized (uint8) variants.
 *
 * Note: Not all language pairs have direct OPUS-MT models available.
 * For unsupported direct pairs, the engine uses pivot translation through
 * English (see pivot.ts).
 */
export const MODEL_REGISTRY: Record<LanguagePairId, ModelInfo> = {
  // ---- English → Target ----
  "en-de": {
    modelId: "Xenova/opus-mt-en-de",
    sourceLang: "en",
    targetLang: "de",
    availableDtypes: ["fp32", "fp16", "int8", "q4"],
    recommendedDtype: "q4",
    approximateSizeBytes: 105 * 1024 * 1024, // ~105 MB quantized
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data.",
  },
  "en-fr": {
    modelId: "Xenova/opus-mt-en-fr",
    sourceLang: "en",
    targetLang: "fr",
    availableDtypes: ["fp32", "fp16", "int8", "q4"],
    recommendedDtype: "q4",
    approximateSizeBytes: 105 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data.",
  },
  "en-es": {
    modelId: "Xenova/opus-mt-en-es",
    sourceLang: "en",
    targetLang: "es",
    availableDtypes: ["fp32", "fp16", "int8", "q4"],
    recommendedDtype: "q4",
    approximateSizeBytes: 105 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data.",
  },
  "en-it": {
    modelId: "Xenova/opus-mt-en-it",
    sourceLang: "en",
    targetLang: "it",
    availableDtypes: ["fp32", "fp16", "int8", "q4"],
    recommendedDtype: "q4",
    approximateSizeBytes: 105 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data.",
  },
  "en-pt": {
    modelId: "Xenova/opus-mt-en-pt",
    sourceLang: "en",
    targetLang: "pt",
    availableDtypes: ["fp32", "fp16", "int8", "q4"],
    recommendedDtype: "q4",
    approximateSizeBytes: 105 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data.",
  },
  "en-pl": {
    modelId: "Xenova/opus-mt-en-pl",
    sourceLang: "en",
    targetLang: "pl",
    availableDtypes: ["fp32", "fp16", "int8", "q4"],
    recommendedDtype: "q4",
    approximateSizeBytes: 105 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data.",
  },
  "en-ar": {
    modelId: "Xenova/opus-mt-en-ar",
    sourceLang: "en",
    targetLang: "ar",
    availableDtypes: ["fp32", "fp16", "int8", "q4"],
    recommendedDtype: "q4",
    approximateSizeBytes: 110 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data.",
  },
  "en-hi": {
    modelId: "Xenova/opus-mt-en-hi",
    sourceLang: "en",
    targetLang: "hi",
    availableDtypes: ["fp32", "fp16", "int8", "q4"],
    recommendedDtype: "q4",
    approximateSizeBytes: 105 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data.",
  },
  "en-ur": {
    modelId: "Xenova/opus-mt-en-ur",
    sourceLang: "en",
    targetLang: "ur",
    availableDtypes: ["fp32", "fp16", "int8", "q4"],
    recommendedDtype: "q4",
    approximateSizeBytes: 105 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data.",
  },

  // ---- Multilingual group models (en → multiple) ----
  // Some OPUS-MT models cover multiple target languages in one model.
  // These use a target language prefix token (e.g., ">>cy<<").
  "en-cy": {
    modelId: "Xenova/opus-mt-en-cel",
    sourceLang: "en",
    targetLang: "cy",
    availableDtypes: ["fp32", "fp16", "int8", "q4"],
    recommendedDtype: "q4",
    approximateSizeBytes: 110 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data. Celtic language group model.",
  },
  "en-bn": {
    modelId: "Xenova/opus-mt-en-mul",
    sourceLang: "en",
    targetLang: "bn",
    availableDtypes: ["fp32", "fp16", "int8"],
    recommendedDtype: "int8",
    approximateSizeBytes: 130 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data. Multilingual target model.",
  },
  "en-pa": {
    modelId: "Xenova/opus-mt-en-mul",
    sourceLang: "en",
    targetLang: "pa",
    availableDtypes: ["fp32", "fp16", "int8"],
    recommendedDtype: "int8",
    approximateSizeBytes: 130 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data. Multilingual target model.",
  },
  "en-so": {
    modelId: "Xenova/opus-mt-en-mul",
    sourceLang: "en",
    targetLang: "so",
    availableDtypes: ["fp32", "fp16", "int8"],
    recommendedDtype: "int8",
    approximateSizeBytes: 130 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data. Multilingual target model.",
  },
  "en-ti": {
    modelId: "Xenova/opus-mt-en-mul",
    sourceLang: "en",
    targetLang: "ti",
    availableDtypes: ["fp32", "fp16", "int8"],
    recommendedDtype: "int8",
    approximateSizeBytes: 130 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data. Multilingual target model.",
  },
  "en-ps": {
    modelId: "Xenova/opus-mt-en-mul",
    sourceLang: "en",
    targetLang: "ps",
    availableDtypes: ["fp32", "fp16", "int8"],
    recommendedDtype: "int8",
    approximateSizeBytes: 130 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data. Multilingual target model.",
  },

  // ---- Target → English (reverse pairs for bidirectional support) ----
  "de-en": {
    modelId: "Xenova/opus-mt-de-en",
    sourceLang: "de",
    targetLang: "en",
    availableDtypes: ["fp32", "fp16", "int8", "q4"],
    recommendedDtype: "q4",
    approximateSizeBytes: 105 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data.",
  },
  "fr-en": {
    modelId: "Xenova/opus-mt-fr-en",
    sourceLang: "fr",
    targetLang: "en",
    availableDtypes: ["fp32", "fp16", "int8", "q4"],
    recommendedDtype: "q4",
    approximateSizeBytes: 105 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data.",
  },
  "es-en": {
    modelId: "Xenova/opus-mt-es-en",
    sourceLang: "es",
    targetLang: "en",
    availableDtypes: ["fp32", "fp16", "int8", "q4"],
    recommendedDtype: "q4",
    approximateSizeBytes: 105 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data.",
  },
  "ar-en": {
    modelId: "Xenova/opus-mt-ar-en",
    sourceLang: "ar",
    targetLang: "en",
    availableDtypes: ["fp32", "fp16", "int8", "q4"],
    recommendedDtype: "q4",
    approximateSizeBytes: 105 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data.",
  },
  "pl-en": {
    modelId: "Xenova/opus-mt-pl-en",
    sourceLang: "pl",
    targetLang: "en",
    availableDtypes: ["fp32", "fp16", "int8", "q4"],
    recommendedDtype: "q4",
    approximateSizeBytes: 105 * 1024 * 1024,
    licence: "CC-BY-4.0",
    attribution: "OPUS-MT, Helsinki-NLP. Trained on OPUS data.",
  },
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Get model info for a specific language pair. Returns undefined if no direct model exists. */
export function getModelForPair(pair: LanguagePairId): ModelInfo | undefined {
  return MODEL_REGISTRY[pair];
}

/** Check if a direct model exists for a language pair. */
export function hasDirectModel(pair: LanguagePairId): boolean {
  return pair in MODEL_REGISTRY;
}

/** Get all registered language pair IDs. */
export function getRegisteredPairs(): LanguagePairId[] {
  return Object.keys(MODEL_REGISTRY) as LanguagePairId[];
}

/** Get language info by code. Returns undefined if not supported. */
export function getLanguageInfo(code: LanguageCode): LanguageInfo | undefined {
  return SUPPORTED_LANGUAGES[code];
}

/** Get all supported language codes. */
export function getSupportedLanguageCodes(): LanguageCode[] {
  return Object.keys(SUPPORTED_LANGUAGES);
}

/** Check if a language uses a right-to-left script. */
export function isRTL(code: LanguageCode): boolean {
  return SUPPORTED_LANGUAGES[code]?.direction === "rtl";
}

/**
 * Get the script direction for a language.
 * Defaults to "ltr" for unknown languages.
 */
export function getDirection(code: LanguageCode): ScriptDirection {
  return SUPPORTED_LANGUAGES[code]?.direction ?? "ltr";
}

/**
 * Estimate total download size for a set of language pairs.
 * Uses the recommended dtype for each pair.
 */
export function estimateDownloadSize(pairs: LanguagePairId[]): number {
  // Deduplicate by model ID since some pairs share models (e.g., en-mul)
  const seen = new Set<string>();
  let total = 0;
  for (const pair of pairs) {
    const model = MODEL_REGISTRY[pair];
    if (model && !seen.has(model.modelId)) {
      seen.add(model.modelId);
      total += model.approximateSizeBytes;
    }
  }
  return total;
}

/**
 * Get all licence attributions for models used by the given pairs.
 * Deduplicated by model ID.
 */
export function getAttributions(pairs: LanguagePairId[]): Array<{ modelId: string; licence: string; attribution: string }> {
  const seen = new Set<string>();
  const attributions: Array<{ modelId: string; licence: string; attribution: string }> = [];
  for (const pair of pairs) {
    const model = MODEL_REGISTRY[pair];
    if (model && !seen.has(model.modelId)) {
      seen.add(model.modelId);
      attributions.push({
        modelId: model.modelId,
        licence: model.licence,
        attribution: model.attribution,
      });
    }
  }
  return attributions;
}
