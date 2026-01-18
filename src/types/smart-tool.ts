/**
 * Shared types for the SMART Action Tool
 */

export type Mode = 'now' | 'future';

/**
 * Form state for "Barrier to Action Now" mode
 */
export interface NowForm {
  date: string;
  forename: string;
  barrier: string;
  action: string;
  responsible: string;
  help: string;
  timescale: string;
}

/**
 * Form state for "Task-Based" (future) mode
 */
export interface FutureForm {
  date: string;
  forename: string;
  task: string;
  outcome: string;
  timescale: string;
}

/**
 * Default initial state for NowForm
 */
export function createDefaultNowForm(date: string): NowForm {
  return {
    date,
    forename: '',
    barrier: '',
    action: '',
    responsible: '',
    help: '',
    timescale: ''
  };
}

/**
 * Default initial state for FutureForm
 */
export function createDefaultFutureForm(date: string): FutureForm {
  return {
    date,
    forename: '',
    task: '',
    outcome: '',
    timescale: ''
  };
}
