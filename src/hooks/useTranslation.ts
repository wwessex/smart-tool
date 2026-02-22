import { useState, useCallback, useMemo } from 'react';
import {
  TranslationEngine,
  SUPPORTED_LANGUAGES as ENGINE_LANGUAGES,
  isRTL as engineIsRTL,
} from '@smart-tool/lengua-materna';

export interface TranslationResult {
  original: string;
  translated: string;
  language: string;
  languageName: string;
}

export interface TranslationState {
  isTranslating: boolean;
  error: string | null;
  result: TranslationResult | null;
}

export interface UseTranslationOptions {
  /** When false, translation is disabled. */
  enabled?: boolean;
}

/**
 * Use small country/region badges instead of emoji flags.
 * Emoji flags are inconsistent on Windows; badges render everywhere.
 *
 * Derived from the Lengua Materna engine's registry, with a `none`
 * sentinel for "English only" (no translation).
 */
export const SUPPORTED_LANGUAGES: Record<
  string,
  { name: string; nativeName: string; flag: string; scriptHint?: string }
> = {
  none: { name: 'English only', nativeName: 'English', flag: 'GB' },
  ...Object.fromEntries(
    Object.entries(ENGINE_LANGUAGES)
      .filter(([code]) => code !== 'en')
      .map(([code, info]) => [
        code,
        {
          name: info.name,
          nativeName: info.nativeName,
          flag: info.flag,
          scriptHint: info.scriptHint,
        },
      ]),
  ),
};

// ---------------------------------------------------------------------------
// Singleton TranslationEngine (shared across hook instances)
// ---------------------------------------------------------------------------

let engineInstance: TranslationEngine | null = null;
let initPromise: Promise<void> | null = null;

function getEngine(): TranslationEngine {
  if (!engineInstance) {
    engineInstance = new TranslationEngine({
      allowRemoteModels: false,
      modelBasePath: "/models/",
      useBrowserCache: true,
      maxLoadedPipelines: 3,
      maxChunkChars: 900,
    });
  }
  return engineInstance;
}

async function ensureInitialized(): Promise<void> {
  const engine = getEngine();
  if (!initPromise) {
    initPromise = engine.initialize({}).catch((err) => {
      initPromise = null; // Allow retry on failure
      throw err;
    });
  }
  return initPromise;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook used by Agent Mode to translate drafted content.
 * Translation runs locally in the browser via the Lengua Materna engine
 * (per-language-pair OPUS-MT models), and never calls any cloud endpoint.
 */
export function useTranslation(options: UseTranslationOptions = {}) {
  const { enabled = true } = options;

  const [state, setState] = useState<TranslationState>({
    isTranslating: false,
    error: null,
    result: null,
  });

  const languages = useMemo(() => {
    return Object.entries(SUPPORTED_LANGUAGES).map(([value, meta]) => ({
      value,
      label: meta.name,
      nativeLabel: meta.nativeName,
      flag: meta.flag,
      scriptHint: meta.scriptHint,
    }));
  }, []);

  const clear = useCallback(() => {
    setState({ isTranslating: false, error: null, result: null });
  }, []);

  const translate = useCallback(
    async (text: string, language: string): Promise<TranslationResult | null> => {
      if (!enabled) {
        setState({ isTranslating: false, error: 'Translation is disabled.', result: null });
        return null;
      }

      if (!text?.trim() || language === 'none') {
        setState({ isTranslating: false, error: null, result: null });
        return null;
      }

      const langMeta = SUPPORTED_LANGUAGES[language];
      if (!langMeta) {
        setState({ isTranslating: false, error: `Unsupported language: ${language}`, result: null });
        return null;
      }

      setState({ isTranslating: true, error: null, result: null });

      try {
        await ensureInitialized();

        const engineResult = await getEngine().translate({
          text,
          sourceLang: 'en',
          targetLang: language,
        });

        const result: TranslationResult = {
          original: text,
          translated: engineResult.translated,
          language,
          languageName: langMeta.name,
        };

        setState({
          isTranslating: false,
          error: null,
          result,
        });

        return result;
      } catch (e: unknown) {
        setState({
          isTranslating: false,
          error: e instanceof Error ? e.message : 'Translation failed',
          result: null,
        });

        return null;
      }
    },
    [enabled]
  );

  const isRTL = useCallback((language: string) => engineIsRTL(language), []);

  return {
    // Original nested state for backwards compatibility
    state,
    languages,
    translate,
    clear,
    isRTL,
    // Flattened properties for easier access in SmartActionTool
    isTranslating: state.isTranslating,
    error: state.error,
    result: state.result,
    canTranslate: enabled,
    clearTranslation: clear,
  };
}
