import { useState, useCallback, useMemo } from 'react';
import { todayISO } from '@/lib/smart-utils';
import type { Mode, NowForm, TaskBasedForm } from '@/types/smart-tool';

// Re-export shared types for backward compatibility
export type { Mode, NowForm, TaskBasedForm } from '@/types/smart-tool';

const INITIAL_NOW_FORM = (today: string): NowForm => ({
  date: today,
  time: '',
  forename: '',
  barrier: '',
  action: '',
  responsible: 'Participant',
  help: '',
  timescale: '',
});

const INITIAL_TASK_BASED_FORM = (today: string): TaskBasedForm => ({
  date: today,
  time: '',
  forename: '',
  task: '',
  responsible: 'Participant',
  outcome: '',
  timescale: '',
});

export function useSmartForm() {
  const today = todayISO();
  const [mode, setMode] = useState<Mode>('now');
  const [nowForm, setNowForm] = useState<NowForm>(INITIAL_NOW_FORM(today));
  const [taskBasedForm, setTaskBasedForm] = useState<TaskBasedForm>(INITIAL_TASK_BASED_FORM(today));
  const [showValidation, setShowValidation] = useState(false);
  const [suggestQuery, setSuggestQuery] = useState('');
  const [wizardMode, setWizardMode] = useState(false);

  // BUG FIX #1: Validate task-based date - must be today or later
  const taskBasedDateError = useMemo(() => {
    if (!taskBasedForm.date) return '';
    if (taskBasedForm.date < today) {
      return 'Date must be today or in the future for task-based actions.';
    }
    return '';
  }, [taskBasedForm.date, today]);

  const nowDateWarning = useMemo(() => {
    if (!nowForm.date) return '';
    if (nowForm.date !== today) {
      return `This date differs from today. Actions recorded for past or future dates may need additional context.`;
    }
    return '';
  }, [nowForm.date, today]);

  const validateNow = useCallback((): boolean => {
    return !!(
      nowForm.date &&
      nowForm.forename.trim() &&
      nowForm.barrier.trim() &&
      nowForm.action.trim() &&
      nowForm.responsible &&
      nowForm.help.trim() &&
      nowForm.timescale
    );
  }, [nowForm]);

  // BUG FIX #1: Add date validation to validateTaskBased
  const validateTaskBased = useCallback((): boolean => {
    return !!(
      taskBasedForm.date &&
      taskBasedForm.date >= today && // Must be today or future
      taskBasedForm.forename.trim() &&
      taskBasedForm.task.trim() &&
      taskBasedForm.outcome.trim() &&
      taskBasedForm.timescale
    );
  }, [taskBasedForm, today]);

  const isValid = mode === 'now' ? validateNow() : validateTaskBased();

  const resetForm = useCallback(() => {
    if (mode === 'now') {
      setNowForm(INITIAL_NOW_FORM(today));
    } else {
      setTaskBasedForm(INITIAL_TASK_BASED_FORM(today));
    }
    setShowValidation(false);
    setSuggestQuery('');
  }, [mode, today]);

  const getFieldClass = useCallback((fieldIsValid: boolean) => {
    if (!showValidation) return '';
    return fieldIsValid ? 'border-green-500/50' : 'border-destructive/60 shadow-[0_0_0_2px_rgba(239,68,68,0.15)]';
  }, [showValidation]);

  return {
    today,
    mode,
    setMode,
    nowForm,
    setNowForm,
    taskBasedForm,
    setTaskBasedForm,
    showValidation,
    setShowValidation,
    suggestQuery,
    setSuggestQuery,
    wizardMode,
    setWizardMode,
    taskBasedDateError,
    nowDateWarning,
    validateNow,
    validateTaskBased,
    isValid,
    resetForm,
    getFieldClass,
  };
}
