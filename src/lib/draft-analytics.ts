/**
 * Draft analytics logger for AI action generation.
 *
 * Captures local preference signals from advisor interactions with AI-drafted
 * actions. All data stays in localStorage and is included in GDPR data exports.
 *
 * Signal types:
 * - generated: AI produced actions for a barrier/context
 * - selected: advisor chose a specific action from the plan picker
 * - edited: advisor modified the AI-drafted text before saving
 * - saved: advisor saved the action to history (success signal)
 * - rejected: advisor dismissed the plan picker without selecting (failure signal)
 */

const STORAGE_KEY = "smartTool.draftAnalytics";
const MAX_ENTRIES = 500;

export interface DraftAnalyticsEntry {
  /** ISO timestamp. */
  timestamp: string;
  /** Type of signal. */
  signal: "generated" | "selected" | "edited" | "saved" | "rejected";
  /** The barrier selected in the dropdown (if any). */
  barrier?: string;
  /** Canonical barrier ID from the catalog (if resolved). */
  barrier_id?: string;
  /** Number of actions generated. */
  actions_count?: number;
  /** Index of the action chosen from the plan picker (0-based). */
  selected_index?: number;
  /** The generated action text. */
  generated_text?: string;
  /** The final text after advisor editing (only for "edited" and "saved" signals). */
  final_text?: string;
  /** SMART score of the generated action (0-5). */
  smart_score?: number;
  /** Whether the AI backend was used ("ai") or template fallback ("template"). */
  source?: "ai" | "template";
}

/**
 * Log a draft analytics entry to localStorage.
 */
export function logDraftAnalytics(entry: DraftAnalyticsEntry): void {
  try {
    const existing = loadDraftAnalytics();
    existing.push(entry);

    // Trim to max entries (keep most recent)
    const trimmed = existing.length > MAX_ENTRIES
      ? existing.slice(existing.length - MAX_ENTRIES)
      : existing;

    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Silently fail — analytics should never break the app
  }
}

/**
 * Load all draft analytics entries from localStorage.
 */
export function loadDraftAnalytics(): DraftAnalyticsEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Clear all draft analytics entries.
 */
export function clearDraftAnalytics(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silently fail
  }
}

/**
 * Export draft analytics as part of GDPR data export.
 */
export function exportDraftAnalytics(): DraftAnalyticsEntry[] {
  return loadDraftAnalytics();
}
