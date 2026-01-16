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
  onboardingComplete: "smartTool.onboardingComplete"
};

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
  };
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
  localStorage.setItem(key, JSON.stringify(list));
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
  const [minScoreThreshold, setMinScoreThreshold] = useState<number>(() => loadNumber(STORAGE.minScoreThreshold, 4));

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
      localStorage.setItem(STORAGE.history, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteFromHistory = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(x => x.id !== id);
      localStorage.setItem(STORAGE.history, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.setItem(STORAGE.history, JSON.stringify([]));
  }, []);

  const addRecentName = useCallback((name: string) => {
    if (!name?.trim()) return;
    const trimmed = name.trim();
    setRecentNames(prev => {
      let names = prev.filter(n => n.toLowerCase() !== trimmed.toLowerCase());
      names = [trimmed, ...names].slice(0, 10);
      localStorage.setItem(STORAGE.recentNames, JSON.stringify(names));
      return names;
    });
  }, []);

  const importData = useCallback((data: { history?: HistoryItem[]; barriers?: string[]; timescales?: string[]; templates?: ActionTemplate[] }) => {
    if (Array.isArray(data.history)) {
      setHistory(data.history);
      localStorage.setItem(STORAGE.history, JSON.stringify(data.history));
    }
    if (Array.isArray(data.barriers)) {
      setBarriers(data.barriers);
      saveList(STORAGE.barriers, data.barriers);
    }
    if (Array.isArray(data.timescales)) {
      setTimescales(data.timescales);
      saveList(STORAGE.timescales, data.timescales);
    }
    if (Array.isArray(data.templates)) {
      setTemplates(data.templates);
      saveList(STORAGE.templates, data.templates);
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
    localStorage.setItem(STORAGE.minScoreEnabled, String(enabled));
  }, []);

  const updateMinScoreThreshold = useCallback((threshold: number) => {
    const clamped = Math.max(1, Math.min(5, threshold));
    setMinScoreThreshold(clamped);
    localStorage.setItem(STORAGE.minScoreThreshold, String(clamped));
  }, []);

  // Export all data for GDPR data portability
  const exportAllData = useCallback(() => {
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        barriers,
        timescales,
        history,
        recentNames,
        templates,
        settings: {
          minScoreEnabled,
          minScoreThreshold,
        }
      }
    };
    return exportData;
  }, [barriers, timescales, history, recentNames, templates, minScoreEnabled, minScoreThreshold]);

  // Delete all user data for GDPR right to erasure
  const deleteAllData = useCallback(() => {
    // Clear all localStorage keys
    Object.values(STORAGE).forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Reset state to defaults
    setBarriers([...DEFAULT_BARRIERS]);
    setTimescales([...DEFAULT_TIMESCALES]);
    setHistory([]);
    setRecentNames([]);
    setTemplates([]);
    setMinScoreEnabled(false);
    setMinScoreThreshold(4);
  }, []);

  return {
    barriers,
    timescales,
    history,
    recentNames,
    templates,
    minScoreEnabled,
    minScoreThreshold,
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
    exportAllData,
    deleteAllData
  };
}
