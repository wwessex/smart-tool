/**
 * Shared localStorage utilities used by all storage hooks.
 */

/**
 * Safely write to localStorage, catching quota errors and blocked storage.
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`localStorage write failed for key "${key}":`, error);
    return false;
  }
}

/**
 * Safely remove from localStorage, catching any errors.
 */
export function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`localStorage remove failed for key "${key}":`, error);
    return false;
  }
}

export function loadList<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function saveList<T>(key: string, list: T[]): void {
  safeSetItem(key, JSON.stringify(list));
}

export function loadBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch {
    return fallback;
  }
}

export function loadNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const num = parseInt(raw, 10);
    return isNaN(num) ? fallback : num;
  } catch {
    return fallback;
  }
}

export function loadString(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

/** All localStorage keys used by the SMART tool. */
export const STORAGE_KEYS = {
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
  aiDraftRuntime: "smartTool.aiDraftRuntime",
  preferredLLMModel: "smartTool.preferredLLMModel",
  allowMobileLLM: "smartTool.allowMobileLLM",
  safariWebGPUEnabled: "smartTool.safariWebGPUEnabled",
  keepSafariModelLoaded: "smartTool.keepSafariModelLoaded",
  actionFeedback: "smartTool.actionFeedback",
} as const;
