import { useState, useCallback, useMemo } from 'react';
import { todayISO } from '@/lib/smart-utils';

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

export interface FutureForm {
  date: string;
  forename: string;
  task: string;
  responsible: string;
  outcome: string;
  timescale: string;
}

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

const INITIAL_FUTURE_FORM = (today: string): FutureForm => ({
  date: today,
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
  const [futureForm, setFutureForm] = useState<FutureForm>(INITIAL_FUTURE_FORM(today));
  const [showValidation, setShowValidation] = useState(false);
  const [suggestQuery, setSuggestQuery] = useState('');
  const [wizardMode, setWizardMode] = useState(false);

  // BUG FIX #1: Validate future date - must be today or later
  const futureDateError = useMemo(() => {
    if (!futureForm.date) return '';
    if (futureForm.date < today) {
      return 'Date must be today or in the future for task-based actions.';
    }
    return '';
  }, [futureForm.date, today]);

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

  // BUG FIX #1: Add date validation to validateFuture
  const validateFuture = useCallback((): boolean => {
    return !!(
      futureForm.date &&
      futureForm.date >= today && // Must be today or future
      futureForm.forename.trim() &&
      futureForm.task.trim() &&
      futureForm.outcome.trim() &&
      futureForm.timescale
    );
  }, [futureForm, today]);

  const isValid = mode === 'now' ? validateNow() : validateFuture();

  const resetForm = useCallback(() => {
    if (mode === 'now') {
      setNowForm(INITIAL_NOW_FORM(today));
    } else {
      setFutureForm(INITIAL_FUTURE_FORM(today));
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
    futureForm,
    setFutureForm,
    showValidation,
    setShowValidation,
    suggestQuery,
    setSuggestQuery,
    wizardMode,
    setWizardMode,
    futureDateError,
    nowDateWarning,
    validateNow,
    validateFuture,
    isValid,
    resetForm,
    getFieldClass,
  };
}
