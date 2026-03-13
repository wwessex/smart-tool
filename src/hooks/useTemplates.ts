import { useState, useCallback, useEffect, useRef } from 'react';
import { loadList, saveList, STORAGE_KEYS } from './storage-utils';
import type { ActionTemplate } from './useSmartStorage';

export function useTemplates() {
  const [templates, setTemplates] = useState<ActionTemplate[]>(() => loadList(STORAGE_KEYS.templates, []));

  // Sync to localStorage (skip initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) return;
    saveList(STORAGE_KEYS.templates, templates);
  }, [templates]);
  useEffect(() => {
    isInitialMount.current = false;
  }, []);

  const addTemplate = useCallback((template: Omit<ActionTemplate, 'id' | 'createdAt'>) => {
    const newTemplate: ActionTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setTemplates(prev => [newTemplate, ...prev].slice(0, 50));
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateTemplate = useCallback((id: string, updates: Partial<ActionTemplate>) => {
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  return {
    templates,
    setTemplates,
    addTemplate,
    deleteTemplate,
    updateTemplate,
  };
}
