import { useState, useCallback, useMemo } from 'react';
import { translateOffline, isRTL as _isRTL } from '@/lib/localTranslator';

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

export interface LocalLLMHandle {
  isReady: boolean;
  canUseLocalAI?: boolean;
  generate: (userPrompt: string, systemPrompt: string, purpose?: string) => Promise<string>;
}

export interface UseTranslationOptions {
  llm?: LocalLLMHandle | null;
  /** When false, translation is disabled. */
  enabled?: boolean;
}

/**
 * Use small country/region badges instead of emoji flags.
 * Emoji flags are inconsistent on Windows; badges render everywhere.
 */
export const SUPPORTED_LANGUAGES: Record<
  string,
  { name: string; nativeName: string; flag: string; scriptHint?: string }
> = {
  none: { name: 'English only', nativeName: 'English', flag: 'GB' },
  cy: { name: 'Welsh', nativeName: 'Cymraeg', flag: 'CY' },
  pl: { name: 'Polish', nativeName: 'Polski', flag: 'PL' },
  ur: { name: 'Urdu', nativeName: 'اردو', flag: 'PK', scriptHint: 'Use Arabic script.' },
  bn: { name: 'Bengali', nativeName: 'বাংলা', flag: 'BD', scriptHint: 'Use Bengali script.' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: 'SA', scriptHint: 'Use Arabic script.' },
  pa: { name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: 'IN', scriptHint: 'Use Gurmukhi script where appropriate.' },
  ps: { name: 'Pashto', nativeName: 'پښتو', flag: 'AF', scriptHint: 'Use Pashto in Arabic script.' },
  so: { name: 'Somali', nativeName: 'Soomaali', flag: 'SO' },
  ti: { name: 'Tigrinya', nativeName: 'ትግርኛ', flag: 'ER', scriptHint: "Use Ge'ez script." },
};

/**
 * Hook used by Agent Mode to translate drafted content.
 * Translation runs locally in the browser using a dedicated translation model
 * (NOT the drafting LLM), and never calls any cloud endpoint.
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
    async (text: string, language: string) => {
      if (!enabled) {
        setState({ isTranslating: false, error: 'Translation is disabled.', result: null });
        return;
      }

      if (!text?.trim() || language === 'none') {
        setState({ isTranslating: false, error: null, result: null });
        return;
      }

      const langMeta = SUPPORTED_LANGUAGES[language];
      if (!langMeta) {
        setState({ isTranslating: false, error: `Unsupported language: ${language}`, result: null });
        return;
      }

      setState({ isTranslating: true, error: null, result: null });

      try {
        const translated = await translateOffline(text, language);

        setState({
          isTranslating: false,
          error: null,
          result: {
            original: text,
            translated,
            language,
            languageName: langMeta.name,
          },
        });
      } catch (e: any) {
        setState({
          isTranslating: false,
          error: e?.message ?? 'Translation failed',
          result: null,
        });
      }
    },
    [enabled]
  );

  const isRTL = useCallback((language: string) => _isRTL(language), []);

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
