import { useState, useCallback } from 'react';
import { hasAIConsent } from '@/components/smart/CookieConsent';

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

const TRANSLATE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-translate`;

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

export function useTranslation() {
  const [state, setState] = useState<TranslationState>({
    isTranslating: false,
    error: null,
    result: null,
  });

  const translate = useCallback(async (action: string, targetLanguage: string): Promise<TranslationResult | null> => {
    // Check AI consent first
    if (!hasAIConsent()) {
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
      const response = await fetch(TRANSLATE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          action: action.trim(),
          targetLanguage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Translation failed" }));
        throw new Error(errorData.error || `Translation failed (${response.status})`);
      }

      const result: TranslationResult = await response.json();
      
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
  }, []);

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
    hasConsent: hasAIConsent(),
  };
}
