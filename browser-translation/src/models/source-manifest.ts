import manifestJson from "./translation-sources.json";
import type {
  LanguagePairId,
  TranslationSourceManifest,
  TranslationSourceModelEntry,
  TranslationSourcePairEntry,
} from "../types.js";

export const TRANSLATION_SOURCE_MANIFEST =
  manifestJson as TranslationSourceManifest;

export const SOURCE_MANIFEST_VERSION = TRANSLATION_SOURCE_MANIFEST.version;

export function getTranslationSourcePair(
  pair: LanguagePairId
): TranslationSourcePairEntry | undefined {
  return TRANSLATION_SOURCE_MANIFEST.pairs[pair];
}

export function getTranslationSourceModel(
  modelId: string
): TranslationSourceModelEntry | undefined {
  return TRANSLATION_SOURCE_MANIFEST.models[modelId];
}

export function getRequiredModelFiles(): string[] {
  return [...TRANSLATION_SOURCE_MANIFEST.requiredFiles];
}

export function getUniqueTranslationModelIds(): string[] {
  return Object.keys(TRANSLATION_SOURCE_MANIFEST.models);
}
