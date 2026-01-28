import { useState, useCallback } from 'react';
import { DEFAULT_BARRIERS, DEFAULT_TIMESCALES } from '@/lib/smart-data';

const STORAGE = {
  barriers: "smartTool.barriers",
  timescales: "smartTool.timescales",
  history: "smartTool.history",
  recentNames: "smartTool.recentNames",
  templates: "smartTool.templates",
  minScoreEnabled: "smartTool.minScoreEnabled",
  minScoreThreshold: "smartTool.minScoreThreshold",
  gdprConsent: "smartTool.gdprConsent",
  onboardingComplete: "smartTool.onboardingComplete",
  retentionDays: "smartTool.retentionDays",
  retentionEnabled: "smartTool.retentionEnabled",
  lastRetentionCheck: "smartTool.lastRetentionCheck",
  participantLanguage: "smartTool.participantLanguage",
  aiDraftMode: "smartTool.aiDraftMode",
  preferredLLMModel: "smartTool.preferredLLMModel",
  allowMobileLLM: "smartTool.allowMobileLLM",
  safariWebGPUEnabled: "smartTool.safariWebGPUEnabled",
};

// Default retention period in days
const DEFAULT_RETENTION_DAYS = 90;

export interface ActionTemplate {
  id: string;
  name: string;
  mode: 'now' | 'future';
  createdAt: string;
  barrier?: string;
  action?: string;
  responsible?: string;
  help?: string;
  task?: string;
  outcome?: string;
}

export interface HistoryItem {
  id: string;
  mode: 'now' | 'future';
  createdAt: string;
  text: string;
  meta: {
    date: string;
    forename: string;
    barrier: string;
    timescale: string;
    action?: string;
    responsible?: string;
    help?: string;
    reason?: string;
    // Translation fields (stored locally only)
    translatedText?: string;
    translationLanguage?: string;
  };
}

export type AIDraftMode = 'ai' | 'template';

export interface SmartToolSettings {
  minScoreEnabled?: boolean;
  minScoreThreshold?: number;
  retentionEnabled?: boolean;
  retentionDays?: number;
  participantLanguage?: string;
  aiDraftMode?: AIDraftMode;
  preferredLLMModel?: string;
  allowMobileLLM?: boolean;
  safariWebGPUEnabled?: boolean;
}

/**
 * Safely write to localStorage, catching quota errors and blocked storage.
 * Returns true if the write succeeded, false otherwise.
 */
function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    // QuotaExceededError, SecurityError, or other storage errors
    console.warn(`localStorage write failed for key "${key}":`, error);
    return false;
  }
}

/**
 * Safely remove from localStorage, catching any errors.
 * Returns true if the removal succeeded, false otherwise.
 */
function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`localStorage remove failed for key "${key}":`, error);
    return false;
  }
}

function loadList<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveList<T>(key: string, list: T[]): void {
  safeSetItem(key, JSON.stringify(list));
}

function loadBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch {
    return fallback;
  }
}

function loadNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const num = parseInt(raw, 10);
    return isNaN(num) ? fallback : num;
  } catch {
    return fallback;
  }
}

export function useSmartStorage() {
  const [barriers, setBarriers] = useState<string[]>(() => loadList(STORAGE.barriers, DEFAULT_BARRIERS));
  const [timescales, setTimescales] = useState<string[]>(() => loadList(STORAGE.timescales, DEFAULT_TIMESCALES));
  const [history, setHistory] = useState<HistoryItem[]>(() => loadList(STORAGE.history, []));
  const [recentNames, setRecentNames] = useState<string[]>(() => loadList(STORAGE.recentNames, []));
  const [templates, setTemplates] = useState<ActionTemplate[]>(() => loadList(STORAGE.templates, []));
  const [minScoreEnabled, setMinScoreEnabled] = useState<boolean>(() => loadBoolean(STORAGE.minScoreEnabled, false));
  const [minScoreThreshold, setMinScoreThreshold] = useState<number>(() => loadNumber(STORAGE.minScoreThreshold, 5));
  const [retentionEnabled, setRetentionEnabled] = useState<boolean>(() => loadBoolean(STORAGE.retentionEnabled, true));
  const [retentionDays, setRetentionDays] = useState<number>(() => loadNumber(STORAGE.retentionDays, DEFAULT_RETENTION_DAYS));
  const [participantLanguage, setParticipantLanguage] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE.participantLanguage) || 'none';
    } catch {
      return 'none';
    }
  });
  const [aiDraftMode, setAIDraftMode] = useState<AIDraftMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE.aiDraftMode);
      return stored === 'template' ? 'template' : 'ai';
    } catch {
      return 'ai';
    }
  });
  const [preferredLLMModel, setPreferredLLMModel] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE.preferredLLMModel) || null;
    } catch {
      return null;
    }
  });
  const [allowMobileLLM, setAllowMobileLLM] = useState<boolean>(() => loadBoolean(STORAGE.allowMobileLLM, false));
  const [safariWebGPUEnabled, setSafariWebGPUEnabled] = useState<boolean>(() => loadBoolean(STORAGE.safariWebGPUEnabled, false));


  const updateBarriers = useCallback((newBarriers: string[]) => {
    setBarriers(newBarriers);
    saveList(STORAGE.barriers, newBarriers);
  }, []);

  const resetBarriers = useCallback(() => {
    setBarriers([...DEFAULT_BARRIERS]);
    saveList(STORAGE.barriers, DEFAULT_BARRIERS);
  }, []);

  const updateTimescales = useCallback((newTimescales: string[]) => {
    setTimescales(newTimescales);
    saveList(STORAGE.timescales, newTimescales);
  }, []);

  const resetTimescales = useCallback(() => {
    setTimescales([...DEFAULT_TIMESCALES]);
    saveList(STORAGE.timescales, DEFAULT_TIMESCALES);
  }, []);

  const addToHistory = useCallback((item: HistoryItem) => {
    setHistory(prev => {
      const updated = [item, ...prev].slice(0, 100);
      safeSetItem(STORAGE.history, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteFromHistory = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(x => x.id !== id);
      safeSetItem(STORAGE.history, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    safeSetItem(STORAGE.history, JSON.stringify([]));
  }, []);

  const addRecentName = useCallback((name: string) => {
    if (!name?.trim()) return;
    const trimmed = name.trim();
    setRecentNames(prev => {
      let names = prev.filter(n => n.toLowerCase() !== trimmed.toLowerCase());
      names = [trimmed, ...names].slice(0, 10);
      safeSetItem(STORAGE.recentNames, JSON.stringify(names));
      return names;
    });
  }, []);

const importData = useCallback((data: {
    history?: HistoryItem[];
    barriers?: string[];
    timescales?: string[];
    recentNames?: string[];
    templates?: ActionTemplate[];
    settings?: SmartToolSettings;
  }) => {
    if (Array.isArray(data.history)) {
      setHistory(data.history);
      safeSetItem(STORAGE.history, JSON.stringify(data.history));
    }
    if (Array.isArray(data.barriers)) {
      setBarriers(data.barriers);
      saveList(STORAGE.barriers, data.barriers);
    }
    if (Array.isArray(data.timescales)) {
      setTimescales(data.timescales);
      saveList(STORAGE.timescales, data.timescales);
    }
    if (Array.isArray(data.recentNames)) {
      const map = new Map<string, string>();
      for (const raw of data.recentNames) {
        const n = typeof raw === 'string' ? raw.trim() : '';
        if (!n) continue;
        const key = n.toLowerCase();
        // Preserve the first casing encountered.
        if (!map.has(key)) map.set(key, n);
      }
      const cleaned = Array.from(map.values()).slice(0, 10);
      setRecentNames(cleaned);
      saveList(STORAGE.recentNames, cleaned);
    }
    if (Array.isArray(data.templates)) {
      setTemplates(data.templates);
      saveList(STORAGE.templates, data.templates);
    }
    if (data.settings && typeof data.settings === 'object') {
      if (typeof data.settings.minScoreEnabled === 'boolean') {
        setMinScoreEnabled(data.settings.minScoreEnabled);
        safeSetItem(STORAGE.minScoreEnabled, String(data.settings.minScoreEnabled));
      }
      if (typeof data.settings.minScoreThreshold === 'number') {
        const clamped = Math.max(1, Math.min(5, Math.round(data.settings.minScoreThreshold)));
        setMinScoreThreshold(clamped);
        safeSetItem(STORAGE.minScoreThreshold, String(clamped));
      }
      if (typeof data.settings.retentionEnabled === 'boolean') {
        setRetentionEnabled(data.settings.retentionEnabled);
        safeSetItem(STORAGE.retentionEnabled, String(data.settings.retentionEnabled));
      }
      if (typeof data.settings.retentionDays === 'number') {
        const clamped = Math.max(7, Math.min(365, Math.round(data.settings.retentionDays)));
        setRetentionDays(clamped);
        safeSetItem(STORAGE.retentionDays, String(clamped));
      }
      if (typeof data.settings.participantLanguage === 'string') {
        setParticipantLanguage(data.settings.participantLanguage);
        safeSetItem(STORAGE.participantLanguage, data.settings.participantLanguage);
      }
      if (data.settings.aiDraftMode === 'ai' || data.settings.aiDraftMode === 'template') {
        setAIDraftMode(data.settings.aiDraftMode);
        safeSetItem(STORAGE.aiDraftMode, data.settings.aiDraftMode);
      }
      if (typeof data.settings.preferredLLMModel === 'string') {
        setPreferredLLMModel(data.settings.preferredLLMModel);
        safeSetItem(STORAGE.preferredLLMModel, data.settings.preferredLLMModel);
      }
      if (typeof data.settings.allowMobileLLM === 'boolean') {
        setAllowMobileLLM(data.settings.allowMobileLLM);
        safeSetItem(STORAGE.allowMobileLLM, data.settings.allowMobileLLM ? "true" : "false");
      }
      if (typeof data.settings.safariWebGPUEnabled === 'boolean') {
        setSafariWebGPUEnabled(data.settings.safariWebGPUEnabled);
        safeSetItem(STORAGE.safariWebGPUEnabled, data.settings.safariWebGPUEnabled ? "true" : "false");
      }
    }
  }, []);

  const addTemplate = useCallback((template: Omit<ActionTemplate, 'id' | 'createdAt'>) => {
    const newTemplate: ActionTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setTemplates(prev => {
      const updated = [newTemplate, ...prev].slice(0, 50); // Max 50 templates
      saveList(STORAGE.templates, updated);
      return updated;
    });
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => {
      const updated = prev.filter(t => t.id !== id);
      saveList(STORAGE.templates, updated);
      return updated;
    });
  }, []);

  const updateTemplate = useCallback((id: string, updates: Partial<ActionTemplate>) => {
    setTemplates(prev => {
      const updated = prev.map(t => t.id === id ? { ...t, ...updates } : t);
      saveList(STORAGE.templates, updated);
      return updated;
    });
  }, []);

  const updateMinScoreEnabled = useCallback((enabled: boolean) => {
    setMinScoreEnabled(enabled);
    safeSetItem(STORAGE.minScoreEnabled, String(enabled));
  }, []);

  const updateMinScoreThreshold = useCallback((threshold: number) => {
    const clamped = Math.max(1, Math.min(5, threshold));
    setMinScoreThreshold(clamped);
    safeSetItem(STORAGE.minScoreThreshold, String(clamped));
  }, []);

  // Export all data for GDPR data portability
  // Uses flat structure to ensure round-trip compatibility with import
const exportAllData = useCallback(() => {
    const exportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      barriers,
      timescales,
      history,
      recentNames,
      templates,
      settings: {
        minScoreEnabled,
        minScoreThreshold,
        retentionEnabled,
        retentionDays,
        participantLanguage,
        aiDraftMode,
        preferredLLMModel,
        allowMobileLLM,
        safariWebGPUEnabled,
      },
    };
    return exportData;
  }, [
    barriers,
    timescales,
    history,
    recentNames,
    templates,
    minScoreEnabled,
    minScoreThreshold,
    retentionEnabled,
    retentionDays,
    participantLanguage,
    aiDraftMode,
    preferredLLMModel,
    allowMobileLLM,
    safariWebGPUEnabled,
  ]);

  // Delete all user data for GDPR right to erasure
  const deleteAllData = useCallback(() => {
    // Clear all localStorage keys
    Object.values(STORAGE).forEach(key => {
      safeRemoveItem(key);
    });
    
    // Reset state to defaults
    setBarriers([...DEFAULT_BARRIERS]);
    setTimescales([...DEFAULT_TIMESCALES]);
    setHistory([]);
    setRecentNames([]);
    setTemplates([]);
    setMinScoreEnabled(false);
    setMinScoreThreshold(5);
    setRetentionEnabled(true);
    setRetentionDays(DEFAULT_RETENTION_DAYS);
    setParticipantLanguage('none');
    setAIDraftMode('ai');
    setPreferredLLMModel(null);
    setAllowMobileLLM(false);
    setSafariWebGPUEnabled(false);
  }, []);

  // Update retention settings
  const updateRetentionEnabled = useCallback((enabled: boolean) => {
    setRetentionEnabled(enabled);
    safeSetItem(STORAGE.retentionEnabled, String(enabled));
  }, []);

  const updateRetentionDays = useCallback((days: number) => {
    const clamped = Math.max(7, Math.min(365, days));
    setRetentionDays(clamped);
    safeSetItem(STORAGE.retentionDays, String(clamped));
  }, []);

  const updateParticipantLanguage = useCallback((language: string) => {
    setParticipantLanguage(language);
    safeSetItem(STORAGE.participantLanguage, language);
  }, []);

  const updateAIDraftMode = useCallback((mode: AIDraftMode) => {
    setAIDraftMode(mode);
    safeSetItem(STORAGE.aiDraftMode, mode);
  }, []);

  const updatePreferredLLMModel = useCallback((modelId: string | null) => {
    setPreferredLLMModel(modelId);
    if (modelId) {
      safeSetItem(STORAGE.preferredLLMModel, modelId);
    } else {
      safeRemoveItem(STORAGE.preferredLLMModel);
    }
  }, []);
  const updateAllowMobileLLM = useCallback((enabled: boolean) => {
    setAllowMobileLLM(enabled);
    safeSetItem(STORAGE.allowMobileLLM, enabled ? "true" : "false");
  }, []);
  const updateSafariWebGPUEnabled = useCallback((enabled: boolean) => {
    setSafariWebGPUEnabled(enabled);
    safeSetItem(STORAGE.safariWebGPUEnabled, enabled ? "true" : "false");
  }, []);


  // Check and clean up old history items
  // Returns the number of items deleted
  const cleanupOldHistory = useCallback((): { deletedCount: number; deletedItems: HistoryItem[] } => {
    if (!retentionEnabled) {
      return { deletedCount: 0, deletedItems: [] };
    }

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    
    const deletedItems: HistoryItem[] = [];
    const remainingItems: HistoryItem[] = [];
    
    history.forEach(item => {
      const itemDate = new Date(item.createdAt);
      if (itemDate < cutoffDate) {
        deletedItems.push(item);
      } else {
        remainingItems.push(item);
      }
    });

    if (deletedItems.length > 0) {
      setHistory(remainingItems);
      safeSetItem(STORAGE.history, JSON.stringify(remainingItems));
    }

    // Update last check timestamp
    safeSetItem(STORAGE.lastRetentionCheck, now.toISOString());

    return { deletedCount: deletedItems.length, deletedItems };
  }, [history, retentionEnabled, retentionDays]);

  // Check if we should run cleanup (once per day)
  const shouldRunCleanup = useCallback((): boolean => {
    try {
      const lastCheck = localStorage.getItem(STORAGE.lastRetentionCheck);
      if (!lastCheck) return true;

      const lastCheckDate = new Date(lastCheck);
      const now = new Date();
      const hoursSinceLastCheck = (now.getTime() - lastCheckDate.getTime()) / (1000 * 60 * 60);

      return hoursSinceLastCheck >= 24;
    } catch {
      return true;
    }
  }, []);

  return {
    barriers,
    timescales,
    history,
    recentNames,
    templates,
    minScoreEnabled,
    minScoreThreshold,
    retentionEnabled,
    retentionDays,
    participantLanguage,
    aiDraftMode,
    preferredLLMModel,
    allowMobileLLM,
    safariWebGPUEnabled,
    updateBarriers,
    resetBarriers,
    updateTimescales,
    resetTimescales,
    addToHistory,
    deleteFromHistory,
    clearHistory,
    addRecentName,
    importData,
    addTemplate,
    deleteTemplate,
    updateTemplate,
    updateMinScoreEnabled,
    updateMinScoreThreshold,
    updateRetentionEnabled,
    updateRetentionDays,
    updateParticipantLanguage,
    updateAIDraftMode,
    updatePreferredLLMModel,
    updateAllowMobileLLM,
    updateSafariWebGPUEnabled,
    cleanupOldHistory,
    shouldRunCleanup,
    exportAllData,
    deleteAllData
  };
}
