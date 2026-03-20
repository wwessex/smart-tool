/**
 * useSmartStorage — facade hook that composes focused domain hooks.
 *
 * Split into:
 *   - useHistory.ts    — history CRUD, retention, cleanup, recent names
 *   - useTemplates.ts  — action template CRUD
 *   - useSettings.ts   — all user preferences
 *   - useFeedback.ts   — AI action feedback storage
 *   - storage-utils.ts — shared localStorage helpers
 *
 * This facade preserves backward compatibility so existing consumers
 * (SmartActionTool, SettingsPanel, tests) don't need changes.
 */

import { useState, useCallback } from 'react';
import { DEFAULT_BARRIERS, DEFAULT_TIMESCALES } from '@/lib/smart-data';
import { exportDraftAnalytics, clearDraftAnalytics } from '@/lib/draft-analytics';
import { safeSetItem, safeRemoveItem, loadList, saveList, STORAGE_KEYS } from './storage-utils';
import { useHistory } from './useHistory';
import { useTemplates } from './useTemplates';
import { useSettings } from './useSettings';
import { useFeedback } from './useFeedback';

// Re-export shared types for backward compatibility
export type { ActionTemplate, HistoryItem, ActionFeedback, AIDraftMode, SmartToolSettings } from '@/types/smart-tool';

export function useSmartStorage() {
  // Compose focused hooks
  const historyHook = useHistory();
  const templatesHook = useTemplates();
  const settingsHook = useSettings();
  const feedbackHook = useFeedback();

  // Barriers and timescales (simple list state)
  const [barriers, setBarriers] = useState<string[]>(() => loadList(STORAGE_KEYS.barriers, DEFAULT_BARRIERS));
  const [timescales, setTimescales] = useState<string[]>(() => loadList(STORAGE_KEYS.timescales, DEFAULT_TIMESCALES));

  const updateBarriers = useCallback((newBarriers: string[]) => {
    setBarriers(newBarriers);
    saveList(STORAGE_KEYS.barriers, newBarriers);
  }, []);

  const resetBarriers = useCallback(() => {
    setBarriers([...DEFAULT_BARRIERS]);
    saveList(STORAGE_KEYS.barriers, DEFAULT_BARRIERS);
  }, []);

  const updateTimescales = useCallback((newTimescales: string[]) => {
    setTimescales(newTimescales);
    saveList(STORAGE_KEYS.timescales, newTimescales);
  }, []);

  const resetTimescales = useCallback(() => {
    setTimescales([...DEFAULT_TIMESCALES]);
    saveList(STORAGE_KEYS.timescales, DEFAULT_TIMESCALES);
  }, []);

  // Import data (GDPR data portability)
  const importData = useCallback((data: {
    history?: HistoryItem[];
    barriers?: string[];
    timescales?: string[];
    recentNames?: string[];
    templates?: ActionTemplate[];
    settings?: SmartToolSettings;
  }) => {
    if (Array.isArray(data.history)) {
      historyHook.setHistory(data.history);
      safeSetItem(STORAGE_KEYS.history, JSON.stringify(data.history));
    }
    if (Array.isArray(data.barriers)) {
      setBarriers(data.barriers);
      saveList(STORAGE_KEYS.barriers, data.barriers);
    }
    if (Array.isArray(data.timescales)) {
      setTimescales(data.timescales);
      saveList(STORAGE_KEYS.timescales, data.timescales);
    }
    if (Array.isArray(data.recentNames)) {
      const map = new Map<string, string>();
      for (const raw of data.recentNames) {
        const n = typeof raw === 'string' ? raw.trim() : '';
        if (!n) continue;
        const key = n.toLowerCase();
        if (!map.has(key)) map.set(key, n);
      }
      const cleaned = Array.from(map.values()).slice(0, 10);
      historyHook.setRecentNames(cleaned);
      saveList(STORAGE_KEYS.recentNames, cleaned);
    }
    if (Array.isArray(data.templates)) {
      templatesHook.setTemplates(data.templates);
      saveList(STORAGE_KEYS.templates, data.templates);
    }
    if (data.settings && typeof data.settings === 'object') {
      if (typeof data.settings.minScoreEnabled === 'boolean') {
        settingsHook.setMinScoreEnabled(data.settings.minScoreEnabled);
        safeSetItem(STORAGE_KEYS.minScoreEnabled, String(data.settings.minScoreEnabled));
      }
      if (typeof data.settings.minScoreThreshold === 'number') {
        const clamped = Math.max(1, Math.min(5, Math.round(data.settings.minScoreThreshold)));
        settingsHook.setMinScoreThreshold(clamped);
        safeSetItem(STORAGE_KEYS.minScoreThreshold, String(clamped));
      }
      if (typeof data.settings.retentionEnabled === 'boolean') {
        historyHook.updateRetentionEnabled(data.settings.retentionEnabled);
      }
      if (typeof data.settings.retentionDays === 'number') {
        const clamped = Math.max(7, Math.min(365, Math.round(data.settings.retentionDays)));
        historyHook.updateRetentionDays(clamped);
      }
      if (typeof data.settings.participantLanguage === 'string') {
        settingsHook.setParticipantLanguage(data.settings.participantLanguage);
        safeSetItem(STORAGE_KEYS.participantLanguage, data.settings.participantLanguage);
      }
      if (data.settings.aiDraftMode === 'ai' || data.settings.aiDraftMode === 'template') {
        settingsHook.setAIDraftMode(data.settings.aiDraftMode);
        safeSetItem(STORAGE_KEYS.aiDraftMode, data.settings.aiDraftMode);
      }
      if (typeof data.settings.preferredLLMModel === 'string') {
        settingsHook.setPreferredLLMModel(data.settings.preferredLLMModel);
        safeSetItem(STORAGE_KEYS.preferredLLMModel, data.settings.preferredLLMModel);
      }
      if (typeof data.settings.allowMobileLLM === 'boolean') {
        settingsHook.setAllowMobileLLM(data.settings.allowMobileLLM);
        safeSetItem(STORAGE_KEYS.allowMobileLLM, data.settings.allowMobileLLM ? "true" : "false");
      }
      if (typeof data.settings.safariWebGPUEnabled === 'boolean') {
        settingsHook.setSafariWebGPUEnabled(data.settings.safariWebGPUEnabled);
        safeSetItem(STORAGE_KEYS.safariWebGPUEnabled, data.settings.safariWebGPUEnabled ? "true" : "false");
      }
      if (typeof data.settings.keepSafariModelLoaded === 'boolean') {
        settingsHook.setKeepSafariModelLoaded(data.settings.keepSafariModelLoaded);
        safeSetItem(STORAGE_KEYS.keepSafariModelLoaded, data.settings.keepSafariModelLoaded ? "true" : "false");
      }
    }
  }, [historyHook, templatesHook, settingsHook]);

  // Export all data for GDPR data portability
  const exportAllData = useCallback(() => {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      barriers,
      timescales,
      history: historyHook.history,
      recentNames: historyHook.recentNames,
      templates: templatesHook.templates,
      settings: {
        minScoreEnabled: settingsHook.minScoreEnabled,
        minScoreThreshold: settingsHook.minScoreThreshold,
        retentionEnabled: historyHook.retentionEnabled,
        retentionDays: historyHook.retentionDays,
        participantLanguage: settingsHook.participantLanguage,
        aiDraftMode: settingsHook.aiDraftMode,
        preferredLLMModel: settingsHook.preferredLLMModel,
        allowMobileLLM: settingsHook.allowMobileLLM,
        safariWebGPUEnabled: settingsHook.safariWebGPUEnabled,
        keepSafariModelLoaded: settingsHook.keepSafariModelLoaded,
      },
      draftAnalytics: exportDraftAnalytics(),
      actionFeedback: feedbackHook.actionFeedback,
    };
  }, [
    barriers,
    timescales,
    historyHook.history,
    historyHook.recentNames,
    historyHook.retentionEnabled,
    historyHook.retentionDays,
    templatesHook.templates,
    settingsHook.minScoreEnabled,
    settingsHook.minScoreThreshold,
    settingsHook.participantLanguage,
    settingsHook.aiDraftMode,
    settingsHook.preferredLLMModel,
    settingsHook.allowMobileLLM,
    settingsHook.safariWebGPUEnabled,
    settingsHook.keepSafariModelLoaded,
    feedbackHook.actionFeedback,
  ]);

  // Delete all user data for GDPR right to erasure
  const deleteAllData = useCallback(() => {
    Object.values(STORAGE_KEYS).forEach(key => {
      safeRemoveItem(key);
    });

    safeRemoveItem('smartTool.localSync.folderName');
    safeRemoveItem('smartTool.localSync.syncEnabled');
    safeRemoveItem('smartTool.localSync.lastSync');
    safeRemoveItem('theme');

    try {
      document.cookie = 'sidebar:state=; path=/; max-age=0';
    } catch { /* ignore */ }

    try {
      sessionStorage.removeItem('smarttool:last_error');
    } catch { /* ignore */ }

    clearDraftAnalytics();

    try {
      indexedDB.deleteDatabase('smart-tool-sync');
    } catch { /* ignore */ }

    try {
      if ('caches' in window) {
        caches.delete('smart-tool-llm-cache-v1');
      }
    } catch { /* ignore */ }

    // Reset state to defaults
    setBarriers([...DEFAULT_BARRIERS]);
    setTimescales([...DEFAULT_TIMESCALES]);
    historyHook.setHistory([]);
    historyHook.setRecentNames([]);
    templatesHook.setTemplates([]);
    settingsHook.setMinScoreEnabled(false);
    settingsHook.setMinScoreThreshold(5);
    settingsHook.setParticipantLanguage('none');
    settingsHook.setAIDraftMode('ai');
    settingsHook.setPreferredLLMModel(null);
    settingsHook.setAllowMobileLLM(false);
    settingsHook.setSafariWebGPUEnabled(false);
    settingsHook.setKeepSafariModelLoaded(false);
    feedbackHook.setActionFeedback([]);
  }, [historyHook, templatesHook, settingsHook, feedbackHook]);

  return {
    // Barriers & timescales
    barriers,
    timescales,
    updateBarriers,
    resetBarriers,
    updateTimescales,
    resetTimescales,

    // History (delegated to useHistory)
    history: historyHook.history,
    recentNames: historyHook.recentNames,
    retentionEnabled: historyHook.retentionEnabled,
    retentionDays: historyHook.retentionDays,
    addToHistory: historyHook.addToHistory,
    deleteFromHistory: historyHook.deleteFromHistory,
    clearHistory: historyHook.clearHistory,
    addRecentName: historyHook.addRecentName,
    updateRetentionEnabled: historyHook.updateRetentionEnabled,
    updateRetentionDays: historyHook.updateRetentionDays,
    cleanupOldHistory: historyHook.cleanupOldHistory,
    shouldRunCleanup: historyHook.shouldRunCleanup,

    // Templates (delegated to useTemplates)
    templates: templatesHook.templates,
    addTemplate: templatesHook.addTemplate,
    deleteTemplate: templatesHook.deleteTemplate,
    updateTemplate: templatesHook.updateTemplate,

    // Settings (delegated to useSettings)
    minScoreEnabled: settingsHook.minScoreEnabled,
    minScoreThreshold: settingsHook.minScoreThreshold,
    participantLanguage: settingsHook.participantLanguage,
    aiDraftMode: settingsHook.aiDraftMode,
    preferredLLMModel: settingsHook.preferredLLMModel,
    allowMobileLLM: settingsHook.allowMobileLLM,
    safariWebGPUEnabled: settingsHook.safariWebGPUEnabled,
    keepSafariModelLoaded: settingsHook.keepSafariModelLoaded,
    updateMinScoreEnabled: settingsHook.updateMinScoreEnabled,
    updateMinScoreThreshold: settingsHook.updateMinScoreThreshold,
    updateParticipantLanguage: settingsHook.updateParticipantLanguage,
    updateAIDraftMode: settingsHook.updateAIDraftMode,
    updatePreferredLLMModel: settingsHook.updatePreferredLLMModel,
    updateAllowMobileLLM: settingsHook.updateAllowMobileLLM,
    updateSafariWebGPUEnabled: settingsHook.updateSafariWebGPUEnabled,
    updateKeepSafariModelLoaded: settingsHook.updateKeepSafariModelLoaded,

    // Feedback (delegated to useFeedback)
    actionFeedback: feedbackHook.actionFeedback,
    addFeedback: feedbackHook.addFeedback,
    updateFeedback: feedbackHook.updateFeedback,
    getAcceptedExemplars: feedbackHook.getAcceptedExemplars,

    // GDPR
    importData,
    exportAllData,
    deleteAllData,
  };
}
