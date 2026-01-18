import { useState, useCallback, useMemo, useEffect } from 'react';
import { useDebounce } from './useDebounce';
import { 
  todayISO, 
  buildNowOutput, 
  buildFutureOutput,
  aiDraftNow,
  aiDraftFuture,
  getSuggestionList,
  getTaskSuggestions,
  resolvePlaceholders,
  parseTimescaleToTargetISO,
  formatDDMMMYY
} from '@/lib/smart-utils';
import { checkSmart, SmartCheck } from '@/lib/smart-checker';
import type { Mode, NowForm, FutureForm } from '@/types/smart-tool';
import { createDefaultNowForm, createDefaultFutureForm } from '@/types/smart-tool';

interface UseSmartFormOptions {
  onToast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
}

export function useSmartForm({ onToast }: UseSmartFormOptions) {
  const today = todayISO();
  
  const [mode, setMode] = useState<Mode>('now');
  const [nowForm, setNowForm] = useState<NowForm>(() => createDefaultNowForm(today));
  const [futureForm, setFutureForm] = useState<FutureForm>(() => createDefaultFutureForm(today));
  const [output, setOutput] = useState('');
  const [outputSource, setOutputSource] = useState<'form' | 'ai' | 'manual'>('form');
  const [showValidation, setShowValidation] = useState(false);
  const [suggestQuery, setSuggestQuery] = useState('');

  // Date validation
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

  // Validation
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

  const validateFuture = useCallback((): boolean => {
    return !!(
      futureForm.date &&
      futureForm.date >= today &&
      futureForm.forename.trim() &&
      futureForm.task.trim() &&
      futureForm.outcome.trim() &&
      futureForm.timescale
    );
  }, [futureForm, today]);

  // Generate output
  const generateOutput = useCallback((force = false) => {
    if (force) setShowValidation(true);
    
    const isValid = mode === 'now' ? validateNow() : validateFuture();
    
    if (!isValid) {
      if (force) {
        setOutput('Please complete all fields to generate an action.');
        onToast({ title: 'Missing fields', description: 'Please complete all required fields.', variant: 'destructive' });
      } else {
        setOutput('');
      }
      return;
    }

    if (mode === 'now') {
      const text = buildNowOutput(
        nowForm.date,
        nowForm.forename.trim(),
        nowForm.barrier.trim(),
        nowForm.action.trim(),
        nowForm.responsible,
        nowForm.help.trim(),
        nowForm.timescale
      );
      setOutput(text);
    } else {
      const text = buildFutureOutput(
        futureForm.date,
        futureForm.forename.trim(),
        futureForm.task.trim(),
        futureForm.outcome.trim(),
        futureForm.timescale
      );
      setOutput(text);
    }
  }, [mode, nowForm, futureForm, validateNow, validateFuture, onToast]);

  // Auto-generate on form changes
  useEffect(() => {
    if (outputSource === 'ai') {
      setOutputSource('form');
      return;
    }
    if (outputSource === 'manual') {
      return;
    }
    generateOutput(false);
  }, [nowForm, futureForm, mode, outputSource, generateOutput]);

  // Clear form
  const handleClear = useCallback(() => {
    if (mode === 'now') {
      setNowForm(createDefaultNowForm(today));
    } else {
      setFutureForm(createDefaultFutureForm(today));
    }
    setOutput('');
    setOutputSource('form');
    setShowValidation(false);
    setSuggestQuery('');
  }, [mode, today]);

  // AI Draft
  const handleAIDraft = useCallback(() => {
    if (mode === 'now') {
      if (!nowForm.forename.trim() || !nowForm.barrier.trim()) {
        onToast({ title: 'Missing info', description: 'Add a forename and barrier first.', variant: 'destructive' });
        return;
      }
      let timescale = nowForm.timescale;
      if (!timescale) {
        timescale = '2 weeks';
        setNowForm(prev => ({ ...prev, timescale }));
      }
      const { action, help } = aiDraftNow(
        nowForm.barrier, 
        nowForm.forename, 
        nowForm.responsible, 
        timescale, 
        nowForm.date,
        suggestQuery
      );
      setNowForm(prev => ({ ...prev, action, help }));
      onToast({ title: 'Draft inserted', description: 'AI draft added. Edit as needed.' });
    } else {
      if (!futureForm.forename.trim() || !futureForm.task.trim()) {
        onToast({ title: 'Missing info', description: 'Add a forename and task first.', variant: 'destructive' });
        return;
      }
      const outcome = aiDraftFuture(futureForm.task, futureForm.forename);
      setFutureForm(prev => ({ ...prev, outcome }));
      onToast({ title: 'Draft inserted', description: 'AI draft added. Edit as needed.' });
    }
  }, [mode, nowForm, futureForm, suggestQuery, onToast]);

  // Suggestions
  const suggestions = useMemo(() => {
    if (mode === 'now') {
      const list = getSuggestionList(nowForm.barrier);
      const q = suggestQuery.toLowerCase();
      if (!q) return list.slice(0, 14);
      return list.filter(s => 
        s.title.toLowerCase().includes(q) ||
        s.action.toLowerCase().includes(q) ||
        s.help.toLowerCase().includes(q)
      ).slice(0, 14);
    } else {
      return getTaskSuggestions(futureForm.task);
    }
  }, [mode, nowForm.barrier, futureForm.task, suggestQuery]);

  // Target context for placeholders
  const targetCtx = useMemo(() => {
    const baseISO = mode === 'now' ? nowForm.date : futureForm.date;
    const timescale = mode === 'now' ? nowForm.timescale : futureForm.timescale;
    const forename = mode === 'now' ? nowForm.forename : futureForm.forename;
    const targetISO = parseTimescaleToTargetISO(baseISO || today, timescale || '2 weeks');
    return { targetPretty: formatDDMMMYY(targetISO), n: 2, forename: forename.trim() };
  }, [mode, nowForm.date, nowForm.timescale, nowForm.forename, futureForm.date, futureForm.timescale, futureForm.forename, today]);

  // Insert suggestion
  const handleInsertSuggestion = useCallback((suggestion: { title: string; action?: string; help?: string; outcome?: string }) => {
    if (mode === 'now' && suggestion.action) {
      const action = resolvePlaceholders(suggestion.action, targetCtx);
      const help = resolvePlaceholders(suggestion.help || '', targetCtx);
      setNowForm(prev => ({
        ...prev,
        action: prev.action.trim() ? prev.action.trimEnd() + '\n' + action : action,
        help: help && !prev.help.trim() ? help : prev.help
      }));
      onToast({ title: 'Inserted', description: 'Suggestion added.' });
    } else if (mode === 'future' && suggestion.outcome) {
      if (!futureForm.forename.trim()) {
        onToast({ title: 'Enter forename first', description: 'Add the participant\'s forename.', variant: 'destructive' });
        return;
      }
      const outcome = suggestion.outcome.replace(/\[Name\]/g, futureForm.forename);
      setFutureForm(prev => ({ ...prev, outcome }));
      onToast({ title: 'Inserted', description: 'Suggestion added.' });
    }
  }, [mode, targetCtx, futureForm.forename, onToast]);

  // SMART Check with debounce
  const debouncedOutput = useDebounce(output, 150);
  
  const smartCheck = useMemo((): SmartCheck => {
    if (!debouncedOutput.trim()) {
      return {
        specific: { met: false, confidence: 'low', reason: 'Generate an action first' },
        measurable: { met: false, confidence: 'low', reason: 'Add dates or quantities' },
        achievable: { met: false, confidence: 'low', reason: 'Show agreement' },
        relevant: { met: false, confidence: 'low', reason: 'Link to barrier' },
        timeBound: { met: false, confidence: 'low', reason: 'Add review date' },
        overallScore: 0,
        warnings: [],
      };
    }
    
    const meta = mode === 'now' 
      ? { forename: nowForm.forename, barrier: nowForm.barrier, timescale: nowForm.timescale, date: nowForm.date }
      : { forename: futureForm.forename, barrier: futureForm.task, timescale: futureForm.timescale, date: futureForm.date };
    
    return checkSmart(debouncedOutput, meta);
  }, [debouncedOutput, mode, nowForm.forename, nowForm.barrier, nowForm.timescale, nowForm.date, futureForm.forename, futureForm.task, futureForm.timescale, futureForm.date]);

  // Build LLM context
  const buildLLMContext = useCallback(() => {
    if (mode === 'now') {
      const parts: string[] = [];
      if (nowForm.forename) parts.push(`Participant: ${nowForm.forename}`);
      if (nowForm.barrier) parts.push(`Barrier to work: ${nowForm.barrier}`);
      if (nowForm.action) parts.push(`Current action: ${nowForm.action}`);
      if (nowForm.responsible) parts.push(`Responsible person: ${nowForm.responsible}`);
      if (nowForm.help) parts.push(`Help/support: ${nowForm.help}`);
      if (nowForm.timescale) parts.push(`Review in: ${nowForm.timescale}`);
      return parts.length > 0 
        ? `Help me improve this SMART action for employment support:\n\n${parts.join('\n')}\n\nHow can I make this more specific, measurable, and actionable?`
        : 'Help me create a SMART action for employment support. The action should address a barrier to work.';
    } else {
      const parts: string[] = [];
      if (futureForm.forename) parts.push(`Participant: ${futureForm.forename}`);
      if (futureForm.task) parts.push(`Activity/event: ${futureForm.task}`);
      if (futureForm.outcome) parts.push(`Expected outcome: ${futureForm.outcome}`);
      if (futureForm.timescale) parts.push(`Review in: ${futureForm.timescale}`);
      return parts.length > 0 
        ? `Help me improve this task-based SMART action:\n\n${parts.join('\n')}\n\nHow can I make this more specific and measurable?`
        : 'Help me create a task-based SMART action for a future activity or event.';
    }
  }, [mode, nowForm, futureForm]);

  return {
    // State
    today,
    mode,
    setMode,
    nowForm,
    setNowForm,
    futureForm,
    setFutureForm,
    output,
    setOutput,
    outputSource,
    setOutputSource,
    showValidation,
    setShowValidation,
    suggestQuery,
    setSuggestQuery,
    
    // Derived
    futureDateError,
    nowDateWarning,
    suggestions,
    smartCheck,
    
    // Actions
    validateNow,
    validateFuture,
    generateOutput,
    handleClear,
    handleAIDraft,
    handleInsertSuggestion,
    buildLLMContext,
  };
}
