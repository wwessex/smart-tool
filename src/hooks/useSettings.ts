import { useState, useCallback } from 'react';
import { safeSetItem, safeRemoveItem, loadBoolean, loadNumber, loadString, STORAGE_KEYS } from './storage-utils';
import type { AIDraftMode } from './useSmartStorage';

export function useSettings() {
  const [minScoreEnabled, setMinScoreEnabled] = useState<boolean>(() => loadBoolean(STORAGE_KEYS.minScoreEnabled, false));
  const [minScoreThreshold, setMinScoreThreshold] = useState<number>(() => loadNumber(STORAGE_KEYS.minScoreThreshold, 5));
  const [participantLanguage, setParticipantLanguage] = useState<string>(() => loadString(STORAGE_KEYS.participantLanguage, 'none'));
  const [aiDraftMode, setAIDraftMode] = useState<AIDraftMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.aiDraftMode);
      return stored === 'template' ? 'template' : 'ai';
    } catch {
      return 'ai';
    }
  });
  const [preferredLLMModel, setPreferredLLMModel] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.preferredLLMModel) || null;
    } catch {
      return null;
    }
  });
  const [allowMobileLLM, setAllowMobileLLM] = useState<boolean>(() => loadBoolean(STORAGE_KEYS.allowMobileLLM, false));
  const [safariWebGPUEnabled, setSafariWebGPUEnabled] = useState<boolean>(() => loadBoolean(STORAGE_KEYS.safariWebGPUEnabled, false));
  const [keepSafariModelLoaded, setKeepSafariModelLoaded] = useState<boolean>(() => loadBoolean(STORAGE_KEYS.keepSafariModelLoaded, false));

  const updateMinScoreEnabled = useCallback((enabled: boolean) => {
    setMinScoreEnabled(enabled);
    safeSetItem(STORAGE_KEYS.minScoreEnabled, String(enabled));
  }, []);

  const updateMinScoreThreshold = useCallback((threshold: number) => {
    const normalized = Number.isFinite(threshold) ? Math.round(threshold) : 5;
    const clamped = Math.max(1, Math.min(5, normalized));
    setMinScoreThreshold(clamped);
    safeSetItem(STORAGE_KEYS.minScoreThreshold, String(clamped));
  }, []);

  const updateParticipantLanguage = useCallback((language: string) => {
    setParticipantLanguage(language);
    safeSetItem(STORAGE_KEYS.participantLanguage, language);
  }, []);

  const updateAIDraftMode = useCallback((mode: AIDraftMode) => {
    setAIDraftMode(mode);
    safeSetItem(STORAGE_KEYS.aiDraftMode, mode);
  }, []);

  const updatePreferredLLMModel = useCallback((modelId: string | null) => {
    setPreferredLLMModel(modelId);
    if (modelId) {
      safeSetItem(STORAGE_KEYS.preferredLLMModel, modelId);
    } else {
      safeRemoveItem(STORAGE_KEYS.preferredLLMModel);
    }
  }, []);

  const updateAllowMobileLLM = useCallback((enabled: boolean) => {
    setAllowMobileLLM(enabled);
    safeSetItem(STORAGE_KEYS.allowMobileLLM, enabled ? "true" : "false");
  }, []);

  const updateSafariWebGPUEnabled = useCallback((enabled: boolean) => {
    setSafariWebGPUEnabled(enabled);
    safeSetItem(STORAGE_KEYS.safariWebGPUEnabled, enabled ? "true" : "false");
  }, []);

  const updateKeepSafariModelLoaded = useCallback((enabled: boolean) => {
    setKeepSafariModelLoaded(enabled);
    safeSetItem(STORAGE_KEYS.keepSafariModelLoaded, enabled ? "true" : "false");
  }, []);

  return {
    minScoreEnabled,
    minScoreThreshold,
    participantLanguage,
    aiDraftMode,
    preferredLLMModel,
    allowMobileLLM,
    safariWebGPUEnabled,
    keepSafariModelLoaded,
    setMinScoreEnabled,
    setMinScoreThreshold,
    setParticipantLanguage,
    setAIDraftMode,
    setPreferredLLMModel,
    setAllowMobileLLM,
    setSafariWebGPUEnabled,
    setKeepSafariModelLoaded,
    updateMinScoreEnabled,
    updateMinScoreThreshold,
    updateParticipantLanguage,
    updateAIDraftMode,
    updatePreferredLLMModel,
    updateAllowMobileLLM,
    updateSafariWebGPUEnabled,
    updateKeepSafariModelLoaded,
  };
}
