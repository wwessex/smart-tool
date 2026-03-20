import { useState, useCallback, useEffect, useRef } from 'react';
import { safeSetItem, loadList, loadBoolean, loadNumber, STORAGE_KEYS } from './storage-utils';
import type { HistoryItem } from './useSmartStorage';

const DEFAULT_RETENTION_DAYS = 90;

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>(() => loadList(STORAGE_KEYS.history, []));
  const [recentNames, setRecentNames] = useState<string[]>(() => loadList(STORAGE_KEYS.recentNames, []));
  const [retentionEnabled, setRetentionEnabled] = useState<boolean>(() => loadBoolean(STORAGE_KEYS.retentionEnabled, true));
  const [retentionDays, setRetentionDays] = useState<number>(() => loadNumber(STORAGE_KEYS.retentionDays, DEFAULT_RETENTION_DAYS));

  // Sync to localStorage (skip initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) return;
    safeSetItem(STORAGE_KEYS.history, JSON.stringify(history));
  }, [history]);
  useEffect(() => {
    if (isInitialMount.current) return;
    safeSetItem(STORAGE_KEYS.recentNames, JSON.stringify(recentNames));
  }, [recentNames]);
  useEffect(() => {
    isInitialMount.current = false;
  }, []);

  const addToHistory = useCallback((item: HistoryItem) => {
    setHistory(prev => [item, ...prev].slice(0, 100));
  }, []);

  const deleteFromHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(x => x.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    safeSetItem(STORAGE_KEYS.history, JSON.stringify([]));
  }, []);

  const addRecentName = useCallback((name: string) => {
    if (!name?.trim()) return;
    const trimmed = name.trim();
    setRecentNames(prev => {
      const names = prev.filter(n => n.toLowerCase() !== trimmed.toLowerCase());
      return [trimmed, ...names].slice(0, 10);
    });
  }, []);

  const updateRetentionEnabled = useCallback((enabled: boolean) => {
    setRetentionEnabled(enabled);
    safeSetItem(STORAGE_KEYS.retentionEnabled, String(enabled));
  }, []);

  const updateRetentionDays = useCallback((days: number) => {
    const clamped = Math.max(7, Math.min(365, days));
    setRetentionDays(clamped);
    safeSetItem(STORAGE_KEYS.retentionDays, String(clamped));
  }, []);

  const cleanupOldHistory = useCallback((): { deletedCount: number; deletedItems: HistoryItem[] } => {
    if (!retentionEnabled) {
      return { deletedCount: 0, deletedItems: [] };
    }

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

    const deletedItems: HistoryItem[] = [];

    history.forEach(item => {
      const itemDate = new Date(item.createdAt);
      if (itemDate < cutoffDate) {
        deletedItems.push(item);
      }
    });

    if (deletedItems.length > 0) {
      // Use functional update to avoid overwriting pending state changes (e.g. from addToHistory)
      setHistory(prev => {
        const remaining = prev.filter(item => new Date(item.createdAt) >= cutoffDate);
        safeSetItem(STORAGE_KEYS.history, JSON.stringify(remaining));
        return remaining;
      });
    }

    safeSetItem(STORAGE_KEYS.lastRetentionCheck, now.toISOString());

    return { deletedCount: deletedItems.length, deletedItems };
  }, [history, retentionEnabled, retentionDays]);

  const shouldRunCleanup = useCallback((): boolean => {
    try {
      const lastCheck = localStorage.getItem(STORAGE_KEYS.lastRetentionCheck);
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
    history,
    setHistory,
    recentNames,
    setRecentNames,
    retentionEnabled,
    retentionDays,
    addToHistory,
    deleteFromHistory,
    clearHistory,
    addRecentName,
    updateRetentionEnabled,
    updateRetentionDays,
    cleanupOldHistory,
    shouldRunCleanup,
  };
}
