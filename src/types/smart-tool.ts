/**
 * Shared domain types for the SMART Action Tool.
 *
 * Canonical definitions live here; hooks re-export them for
 * backward-compatible imports.
 */

// ── Form types ──────────────────────────────────────────────

export type Mode = 'now' | 'future';

export interface NowForm {
  date: string;
  time: string;
  forename: string;
  barrier: string;
  action: string;
  responsible: string;
  help: string;
  timescale: string;
}

export interface TaskBasedForm {
  date: string;
  time: string;
  forename: string;
  task: string;
  responsible: string;
  outcome: string;
  timescale: string;
}

// ── Storage / history types ─────────────────────────────────

export interface HistoryItem {
  id: string;
  mode: 'now' | 'future';
  createdAt: string;
  text: string;
  meta: {
    date: string;
    time?: string;
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

export interface ActionFeedback {
  id: string;
  createdAt: string;
  barrier: string;
  category: string;
  generatedAction: string;
  editedAction?: string;
  rating: 'relevant' | 'not-relevant' | null;
  acceptedAsIs: boolean;
  source: 'ai' | 'template';
  forename: string;
  timescale: string;
}

export type AIDraftMode = 'ai' | 'template';

export interface SmartToolSettings {
  minScoreEnabled?: boolean;
  minScoreThreshold?: number;
  retentionEnabled?: boolean;
  retentionDays?: number;
  participantLanguage?: string;
  aiDraftMode?: AIDraftMode;
  keepSafariModelLoaded?: boolean;
  allowMobileLLM?: boolean;
  safariWebGPUEnabled?: boolean;
  preferredLLMModel?: string;
}

// ── Output types ────────────────────────────────────────────

export type OutputSource = 'form' | 'ai' | 'manual';
