import { useState, useCallback, useEffect, useRef } from 'react';
import { safeSetItem, loadList, STORAGE_KEYS } from './storage-utils';
import type { ActionFeedback } from './useSmartStorage';

export function useFeedback() {
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback[]>(() => loadList(STORAGE_KEYS.actionFeedback, []));

  // Sync to localStorage (skip initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) return;
    safeSetItem(STORAGE_KEYS.actionFeedback, JSON.stringify(actionFeedback));
  }, [actionFeedback]);
  useEffect(() => {
    isInitialMount.current = false;
  }, []);

  const addFeedback = useCallback((feedback: Omit<ActionFeedback, 'id' | 'createdAt'>) => {
    const record: ActionFeedback = {
      ...feedback,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setActionFeedback(prev => [record, ...prev].slice(0, 500));
    return record;
  }, []);

  const updateFeedback = useCallback((id: string, updates: Partial<ActionFeedback>) => {
    setActionFeedback(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const getAcceptedExemplars = useCallback((barrier?: string, category?: string): ActionFeedback[] => {
    return actionFeedback.filter(f => {
      if (f.rating === 'not-relevant') return false;
      if (f.rating !== 'relevant' && !f.acceptedAsIs) return false;
      if (barrier && f.barrier.toLowerCase() === barrier.toLowerCase()) return true;
      if (category && f.category === category) return true;
      return false;
    });
  }, [actionFeedback]);

  return {
    actionFeedback,
    setActionFeedback,
    addFeedback,
    updateFeedback,
    getAcceptedExemplars,
  };
}
