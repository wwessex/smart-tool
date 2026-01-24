import { useState, useCallback, useMemo } from 'react';

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
  generate: (userMessage: string, systemPrompt?: string, configType?: string) => Promise<string>;
}

export interface UseTranslationOptions {
  llm?: LocalLLMHandle | null;
  /** Safe option: when false/undefined, translation will be disabled until llm is ready. */
  enabled?: boolean;
}

export const SUPPORTED_LANGUAGES: Record<
  string,
  { name: string; nativeName: string; flag: string; flagCode?: string; scriptHint?: string }
> = {
  none: { name: 'English only', nativeName: 'English', flag: '🇬🇧', flagCode: 'gb' },
  cy: { name: 'Welsh', nativeName: 'Cymraeg', flag: '🏴', flagCode: 'gb' },
  pl: { name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', flagCode: 'pl' },
  ur: { name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰', flagCode: 'pk', scriptHint: 'Use Arabic script.' },
  bn: { name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩', flagCode: 'bd', scriptHint: 'Use Bengali script.' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', flagCode: 'sa', scriptHint: 'Use Arabic script.' },
  pa: { name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳', flagCode: 'in', scriptHint: 'Use Gurmukhi script where appropriate.' },
  ps: { name: 'Pashto', nativeName: 'پښتو', flag: '🇦🇫', flagCode: 'af', scriptHint: 'Use Pashto in Arabic script.' },
  so: { name: 'Somali', nativeName: 'Soomaali', flag: '🇸🇴', flagCode: 'so' },
  ti: { name: 'Tigrinya', nativeName: 'ትግርኛ', flag: '🇪🇷', flagCode: 'er', scriptHint: 'Use Ge\'ez script.' },
};

function chunkText(input: string, maxChars = 900): string[] {
  const text = input.trim();
  if (!text) return [];

  // Preserve paragraph breaks first
  const paras = text.split(/\n\s*\n/g).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];

  for (const para of paras) {
    if (para.length <= maxChars) {
      chunks.push(para);
      continue;
    }
    // Sentence-ish split fallback
    const parts = para.split(/(?<=[\.!\?])\s+/);
    let buf = '';
    for (const part of parts) {
      const candidate = buf ? `${buf} ${part}` : part;
      if (candidate.length > maxChars) {
        if (buf) chunks.push(buf);
        buf = part;
      } else {
        buf = candidate;
      }
    }
    if (buf) chunks.push(buf);
  }

  return chunks;
}

function mostlyAscii(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return true;
  const ascii = trimmed.split('').filter(ch => ch.charCodeAt(0) <= 0x007f).length;
  return ascii / trimmed.length > 0.85;
}

function looksRepetitive(s: string): boolean {
  const t = s.trim();
  if (t.length < 60) return false;
  // crude repetition detector: lots of repeated 4-gram
  const grams = new Map<string, number>();
  for (let i = 0; i < t.length - 4; i += 2) {
    const g = t.slice(i, i + 4);
    grams.set(g, (grams.get(g) || 0) + 1);
  }
  let repeats = 0;
  grams.forEach(v => { if (v >= 12) repeats += v; });
  return repeats > 40;
}

function buildSystemPrompt(targetName: string, targetNative: string, scriptHint?: string) {
  return [
    'You are a professional translator for UK employment services.',
    'Translate the user text into the requested target language.',
    'Output ONLY the translated text. Do not add quotes, bullets, explanations, or headings.',
    'Preserve names, dates, times, numbers, and URLs exactly as written.',
    'Keep the same meaning and tone. Keep line breaks where sensible.',
    `Target language: ${targetName} (${targetNative}).`,
    scriptHint ? scriptHint : '',
  ].filter(Boolean).join('\n');
}

export function useTranslation(options: UseTranslationOptions = {}) {
  const [state, setState] = useState<TranslationState>({
    isTranslating: false,
    error: null,
    result: null,
  });

  const llm = options.llm || null;
  const enabled = options.enabled ?? false;

  const canTranslate = useMemo(() => {
    return Boolean(enabled && llm && llm.isReady && (llm.canUseLocalAI ?? true));
  }, [enabled, llm]);

  const translate = useCallback(
    async (text: string, language: string): Promise<TranslationResult | null> => {
      const lang = SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES.none;

      if (!text.trim() || language === 'none') {
        setState(prev => ({ ...prev, error: null, result: null }));
        return {
          original: text,
          translated: text,
          language: 'none',
          languageName: SUPPORTED_LANGUAGES.none.name,
        };
      }

      if (!canTranslate || !llm) {
        setState(prev => ({
          ...prev,
          error: 'Local AI module is not ready yet. Download the AI Module in Settings to enable translation.',
          result: null,
        }));
        return null;
      }

      setState(prev => ({ ...prev, isTranslating: true, error: null, result: null }));

      try {
        const chunks = chunkText(text, 900);
        const sys = buildSystemPrompt(lang.name, lang.nativeName, lang.scriptHint);

        const outChunks: string[] = [];
        for (const chunk of chunks) {
          const userPrompt = chunk;

          // First pass
          let translated = await llm.generate(userPrompt, sys, 'translate');

          // Heuristics: if clearly not translated for non-latin scripts, retry with stronger instruction.
          const needsNonLatin = ['ar', 'ur', 'ps', 'ti', 'bn', 'pa'].includes(language);
          if (needsNonLatin && mostlyAscii(translated)) {
            const sys2 = sys + '\nIMPORTANT: Write ONLY in the target language script (no English).';
            translated = await llm.generate(userPrompt, sys2, 'translate');
          }

          // If model degenerates (repeats), retry with explicit anti-repetition instruction.
          if (looksRepetitive(translated)) {
            const sys3 = sys + '\nAvoid repetition. Translate once only. Do not repeat phrases.';
            translated = await llm.generate(userPrompt, sys3, 'translate');
          }

          outChunks.push(translated.trim());
        }

        const translatedText = outChunks.join('\n\n').trim();

        const result: TranslationResult = {
          original: text,
          translated: translatedText,
          language,
          languageName: lang.name,
        };

        setState({ isTranslating: false, error: null, result });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Translation failed';
        setState({ isTranslating: false, error: message, result: null });
        return null;
      }
    },
    [canTranslate, llm]
  );

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    canTranslate,
    translate,
    clearError,
  };
}
