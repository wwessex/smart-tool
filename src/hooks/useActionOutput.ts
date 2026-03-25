import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useToast } from '@/hooks/use-toast';
import { useTranslation, SUPPORTED_LANGUAGES } from '@/hooks/useTranslation';
import { checkSmart, SmartCheck } from '@/lib/smart-checker';
import { buildNowOutput, buildFutureOutput } from '@/lib/smart-utils';
import type { Mode, NowForm, TaskBasedForm, OutputSource } from '@/types/smart-tool';

// Re-export for backward compatibility
export type { OutputSource } from '@/types/smart-tool';

export interface UseActionOutputOptions {
  mode: Mode;
  nowForm: NowForm;
  taskBasedForm: TaskBasedForm;
  validateNow: () => boolean;
  validateTaskBased: () => boolean;
  participantLanguage: string;
  updateParticipantLanguage: (lang: string) => void;
}

export function useActionOutput({
  mode,
  nowForm,
  taskBasedForm,
  validateNow,
  validateTaskBased,
  participantLanguage,
  updateParticipantLanguage,
}: UseActionOutputOptions) {
  const { toast } = useToast();
  const translation = useTranslation();

  const [output, setOutput] = useState('');
  const [outputSource, setOutputSource] = useState<OutputSource>('form');
  const [translatedOutput, setTranslatedOutput] = useState<string | null>(null);
  const translatedForOutputRef = useRef<string>('');
  const [copied, setCopied] = useState(false);

  const hasTranslation = translatedOutput !== null;
  const hasOutput = output.trim().length > 0;

  const generateOutput = useCallback((force = false) => {
    const isValid = mode === 'now' ? validateNow() : validateTaskBased();

    if (!isValid) {
      if (force) {
        setOutput('Please complete all fields to generate an action.');
        toast({ title: 'Missing fields', description: 'Please complete all required fields.', variant: 'destructive' });
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
        nowForm.timescale,
      );
      setOutput(text);
      setOutputSource('form');
    } else {
      const text = buildFutureOutput(
        taskBasedForm.date,
        taskBasedForm.forename.trim(),
        taskBasedForm.task.trim(),
        taskBasedForm.responsible,
        taskBasedForm.outcome.trim(),
        taskBasedForm.timescale,
      );
      setOutput(text);
      setOutputSource('form');
    }
  }, [mode, nowForm, taskBasedForm, validateNow, validateTaskBased, toast]);

  // Auto-generate on form changes (skip when output was set by AI fix)
  useEffect(() => {
    if (outputSource === 'ai') {
      const timer = setTimeout(() => {
        setOutputSource('form');
      }, 200);
      return () => clearTimeout(timer);
    }
    if (outputSource === 'manual') {
      return;
    }
    generateOutput(false);
  }, [nowForm, taskBasedForm, mode, outputSource, generateOutput]);

  // Clear stale translation when the English output changes
  useEffect(() => {
    if (hasTranslation && output !== translatedForOutputRef.current) {
      setTranslatedOutput(null);
    }
  }, [output, hasTranslation]);

  // Debounce output for SMART checking
  const debouncedOutput = useDebounce(output, 150);
  const checkableOutput = outputSource === 'ai' ? output : debouncedOutput;

  // SMART Check
  const smartCheck = useMemo((): SmartCheck => {
    if (!checkableOutput.trim()) {
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
      : { forename: taskBasedForm.forename, barrier: taskBasedForm.task, timescale: taskBasedForm.timescale, date: taskBasedForm.date };

    return checkSmart(checkableOutput, meta);
  }, [checkableOutput, mode, nowForm.forename, nowForm.barrier, nowForm.timescale, nowForm.date, taskBasedForm.forename, taskBasedForm.task, taskBasedForm.timescale, taskBasedForm.date]);

  const handleCopy = useCallback(async () => {
    if (!output.trim()) {
      toast({ title: 'Nothing to copy', description: 'Generate an action first.', variant: 'destructive' });
      return;
    }
    try {
      let textToCopy = output;
      if (hasTranslation && participantLanguage !== 'none') {
        const langInfo = SUPPORTED_LANGUAGES[participantLanguage];
        textToCopy = `=== ENGLISH ===\n${output}\n\n=== ${langInfo?.nativeName?.toUpperCase() || participantLanguage.toUpperCase()} ===\n${translatedOutput}`;
      }
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 400);
      toast({ title: 'Copied!', description: hasTranslation ? 'Both versions copied to clipboard.' : 'Action copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy manually.', variant: 'destructive' });
    }
  }, [output, translatedOutput, hasTranslation, participantLanguage, toast]);

  const handleDownload = useCallback(() => {
    if (!output.trim()) {
      toast({ title: 'Nothing to download', description: 'Generate an action first.', variant: 'destructive' });
      return;
    }
    let textToDownload = output;
    if (hasTranslation && participantLanguage !== 'none') {
      const langInfo = SUPPORTED_LANGUAGES[participantLanguage];
      textToDownload = `=== ENGLISH ===\n${output}\n\n=== ${langInfo?.nativeName?.toUpperCase() || participantLanguage.toUpperCase()} ===\n${translatedOutput}`;
    }
    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-action-${mode}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [output, translatedOutput, hasTranslation, participantLanguage, mode, toast]);

  // Handle translation
  const handleTranslate = useCallback(async () => {
    if (!output.trim()) return;
    if (participantLanguage === 'none') {
      setTranslatedOutput(null);
      return;
    }

    if (!translation.canTranslate) {
      toast({
        title: 'Translation unavailable',
        description: 'Translation is currently disabled.',
        variant: 'destructive',
      });
      return;
    }

    const result = await translation.translate(output, participantLanguage);
    if (result) {
      translatedForOutputRef.current = output;
      setTranslatedOutput(result.translated);
      toast({
        title: 'Translated!',
        description: `Action translated to ${result.languageName}.`,
      });
    }
  }, [output, participantLanguage, translation, toast]);

  // Handle language change
  const handleLanguageChange = useCallback((language: string) => {
    updateParticipantLanguage(language);
    setTranslatedOutput(null);
    translation.clearTranslation();
  }, [updateParticipantLanguage, translation]);

  const clearOutput = useCallback(() => {
    setOutput('');
    setOutputSource('form');
    setTranslatedOutput(null);
    translation.clearTranslation();
    updateParticipantLanguage('none');
  }, [translation, updateParticipantLanguage]);

  return {
    translation,
    output,
    setOutput,
    outputSource,
    setOutputSource,
    translatedOutput,
    setTranslatedOutput,
    translatedForOutputRef,
    hasTranslation,
    hasOutput,
    copied,
    generateOutput,
    smartCheck,
    handleCopy,
    handleDownload,
    handleTranslate,
    handleLanguageChange,
    clearOutput,
  };
}
