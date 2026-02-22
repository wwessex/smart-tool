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

type EngineTranslationResult = {
  original?: string;
  translated?: string;
  translation_text?: string;
  text?: string;
  result?: {
    translated?: string;
    translation_text?: string;
    text?: string;
  };
};

function extractTranslatedText(engineResult: EngineTranslationResult | string | null | undefined): string {
  if (typeof engineResult === 'string') {
    return engineResult.trim();
  }

  if (!engineResult || typeof engineResult !== 'object') {
    return '';
  }

  return (
    engineResult.translated ??
    engineResult.translation_text ??
    engineResult.text ??
    engineResult.result?.translated ??
    engineResult.result?.translation_text ??
    engineResult.result?.text ??
    ''
  ).trim();
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

/** Resolve modelBasePath from Vite's BASE_URL so subfolder/portable deployments work. */
function resolveModelBasePath(): string {
  const base = (import.meta as unknown as { env?: Record<string, string> }).env?.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;

  // Prefer Vite's configured base when available.
  if (normalizedBase !== "/") {
    return `${normalizedBase}models/`;
  }

  // Fallback for deployments where BASE_URL is left as "/" but the app is
  // actually served from a sub-path (e.g. some GitHub Pages setups). In those
  // cases, infer the current directory from location.pathname.
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname || '/';
    const inferredBase = pathname.endsWith('/')
      ? pathname
      : pathname.slice(0, pathname.lastIndexOf('/') + 1);

    if (inferredBase && inferredBase !== '/') {
      return `${inferredBase}models/`;
    }
  }

  // Keep relative path for root deployments and packaged shells.
  return 'models/';
}

function getEngine(): TranslationEngine {
  if (!engineInstance) {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    const allowRemoteModels = env?.VITE_ALLOW_REMOTE_TRANSLATION_MODELS !== 'false';

    engineInstance = new TranslationEngine({
      allowRemoteModels,
      modelBasePath: resolveModelBasePath(),
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
        }) as EngineTranslationResult | string;

        // Support current, legacy, and nested response shapes from translation
        // engine wrappers so translated text is not dropped in the UI.
        const translatedText = extractTranslatedText(engineResult);

        // When the engine returns no translated text (e.g. the model produced
        // only special tokens), fall back to the original text so the caller
        // always receives a usable result instead of an error.
        const result: TranslationResult = {
          original: text,
          translated: translatedText || text,
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
