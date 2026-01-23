import { useState, useCallback } from 'react';
import { useAIConsent } from '@/hooks/useAIConsent';

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

// Local-only translation: we intentionally do NOT call any cloud endpoints.

export interface LocalLLMForTranslation {
  canUseLocalAI: boolean;
  isReady: boolean;
  isGenerating: boolean;
  generate: (userMessage: string, systemPrompt?: string, configType?: string) => Promise<string>;
}

// Supported languages for UK employment services
export const SUPPORTED_LANGUAGES: Record<string, { name: string; nativeName: string; flag: string }> = {
  "none": { name: "English only", nativeName: "English", flag: "🇬🇧" },
  "cy": { name: "Welsh", nativeName: "Cymraeg", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
  "pl": { name: "Polish", nativeName: "Polski", flag: "🇵🇱" },
  "ur": { name: "Urdu", nativeName: "اردو", flag: "🇵🇰" },
  "bn": { name: "Bengali", nativeName: "বাংলা", flag: "🇧🇩" },
  "ar": { name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  "pa": { name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  "ps": { name: "Pashto", nativeName: "پښتو", flag: "🇦🇫" },
  "so": { name: "Somali", nativeName: "Soomaali", flag: "🇸🇴" },
  "ti": { name: "Tigrinya", nativeName: "ትግርኛ", flag: "🇪🇷" },
  "pt": { name: "Portuguese", nativeName: "Português", flag: "🇵🇹" },
  "ro": { name: "Romanian", nativeName: "Română", flag: "🇷🇴" },
  "es": { name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  "fr": { name: "French", nativeName: "Français", flag: "🇫🇷" },
  "zh": { name: "Chinese", nativeName: "简体中文", flag: "🇨🇳" },
  "hi": { name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
};



function splitIntoChunks(text: string, maxChars: number): string[] {
  const parts = text.split(/\n\n+/);
  const chunks: string[] = [];
  let buf = "";

  const flush = () => {
    if (buf.trim()) chunks.push(buf.trimEnd());
    buf = "";
  };

  for (const p of parts) {
    const piece = p.trimEnd();
    if (!piece) continue;

    // If a single paragraph is huge, hard-split it.
    if (piece.length > maxChars) {
      flush();
      for (let i = 0; i < piece.length; i += maxChars) {
        chunks.push(piece.slice(i, i + maxChars));
      }
      continue;
    }

    if ((buf + (buf ? "\n\n" : "") + piece).length > maxChars) {
      flush();
      buf = piece;
    } else {
      buf = buf ? (buf + "\n\n" + piece) : piece;
    }
  }
  flush();
  return chunks.length ? chunks : [text];
}

function looksTruncated(input: string, output: string) {
  // Heuristic: if output is much shorter than input, likely cut off.
  const inLen = input.replace(/\s+/g, " ").trim().length;
  const outLen = output.replace(/\s+/g, " ").trim().length;
  if (inLen < 60) return false;
  return outLen < Math.max(40, Math.floor(inLen * 0.6));
}

export function useTranslation(getLLM?: () => LocalLLMForTranslation | undefined) {
  const hasConsent = useAIConsent();
  const [state, setState] = useState<TranslationState>({
    isTranslating: false,
    error: null,
    result: null,
  });

  const translate = useCallback(async (action: string, targetLanguage: string): Promise<TranslationResult | null> => {
    // Check AI consent first
    if (!hasConsent) {
      setState(prev => ({
        ...prev,
        error: "AI processing consent required. Please enable AI features in privacy settings.",
      }));
      return null;
    }

    // Don't translate if language is "none" or empty
    if (!targetLanguage || targetLanguage === "none") {
      setState(prev => ({
        ...prev,
        error: null,
        result: null,
      }));
      return null;
    }

    // Don't translate empty actions
    if (!action.trim()) {
      setState(prev => ({
        ...prev,
        error: "No action text to translate",
        result: null,
      }));
      return null;
    }

    setState(prev => ({
      ...prev,
      isTranslating: true,
      error: null,
    }));

    try {
      const llm = getLLM?.();
      if (!llm) {
        throw new Error('Local AI module not available. Enable Local AI to translate.');
      }
      if (!llm.canUseLocalAI) {
        throw new Error('Local AI is not available on this device/browser.');
      }
      if (!llm.isReady) {
        throw new Error('Local AI module is not loaded. Load the AI Module first, then try translate again.');
      }
      if (llm.isGenerating) {
        throw new Error('Local AI is busy. Please wait for the current generation to finish.');
      }

      const lang = SUPPORTED_LANGUAGES[targetLanguage];
      const languageName = lang?.name || targetLanguage;
      const nativeName = lang?.nativeName || '';

      const systemPrompt =
        'You are a professional translator for UK employment services.\n' +
        'Rules:\n' +
        '- Output ONLY the translated text (no quotes, no explanations).\n' +
        '- Preserve names, dates, times, numbers, and formatting.\n' +
        '- Keep the meaning and tone clear and professional.\n' +
        '- Do NOT add extra sentences.';

      const userPromptBase =
        `Translate the following SMART action into ${languageName}${nativeName ? ` (${nativeName})` : ''}.\n` +
        `Rules: translate EVERYTHING. Do not omit or summarise. Preserve line breaks.\n\n`;

      const chunks = splitIntoChunks(action.trim(), 900);
      const translatedChunks: string[] = [];

      for (const chunk of chunks) {
        const userPrompt =
          userPromptBase +
          `SMART action:\n${chunk.trim()}`;

        // First attempt
        let out = (await llm.generate(userPrompt, systemPrompt, 'default')).trim();

        // If it looks truncated, do one stronger retry for this chunk
        if (looksTruncated(chunk, out)) {
          const retryPrompt =
            userPromptBase +
            `IMPORTANT: You MUST translate the FULL text below. Do not cut off early.\n\n` +
            `SMART action:\n${chunk.trim()}`;

          out = (await llm.generate(retryPrompt, systemPrompt, 'default')).trim();
        }

        translatedChunks.push(out);
      }

      const translated = translatedChunks.join("\n\n");
      if (!translated) throw new Error('Translation failed (empty result)');

      const result: TranslationResult = {
        original: action.trim(),
        translated,
        language: targetLanguage,
        languageName,
      };

      setState({
        isTranslating: false,
        error: null,
        result,
      });

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Translation failed";
      setState({
        isTranslating: false,
        error: errorMessage,
        result: null,
      });
      return null;
    }
  }, [hasConsent, getLLM]);

  const clearTranslation = useCallback(() => {
    setState({
      isTranslating: false,
      error: null,
      result: null,
    });
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  return {
    ...state,
    translate,
    clearTranslation,
    clearError,
    hasConsent,
  };
}
