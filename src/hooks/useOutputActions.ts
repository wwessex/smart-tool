import { useState, useCallback } from 'react';
import { SUPPORTED_LANGUAGES } from './useTranslation';
import type { Mode, NowForm, FutureForm } from '@/types/smart-tool';
import type { HistoryItem } from './useSmartStorage';

interface UseOutputActionsOptions {
  output: string;
  translatedOutput: string | null;
  setTranslatedOutput: (value: string | null) => void;
  mode: Mode;
  nowForm: NowForm;
  futureForm: FutureForm;
  participantLanguage: string;
  minScoreEnabled: boolean;
  minScoreThreshold: number;
  smartScore: number;
  addToHistory: (item: HistoryItem) => void;
  addRecentName: (name: string) => void;
  translate: (text: string, targetLanguage: string) => Promise<{ translated: string; languageName: string } | null>;
  onToast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
}

export function useOutputActions({
  output,
  translatedOutput,
  setTranslatedOutput,
  mode,
  nowForm,
  futureForm,
  participantLanguage,
  minScoreEnabled,
  minScoreThreshold,
  smartScore,
  addToHistory,
  addRecentName,
  translate,
  onToast,
}: UseOutputActionsOptions) {
  const [copied, setCopied] = useState(false);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!output.trim()) {
      onToast({ title: 'Nothing to copy', description: 'Generate an action first.', variant: 'destructive' });
      return;
    }
    try {
      let textToCopy = output;
      if (translatedOutput && participantLanguage !== 'none') {
        const langInfo = SUPPORTED_LANGUAGES[participantLanguage];
        textToCopy = `=== ENGLISH ===\n${output}\n\n=== ${langInfo?.nativeName?.toUpperCase() || participantLanguage.toUpperCase()} ===\n${translatedOutput}`;
      }
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 400);
      onToast({ title: 'Copied!', description: translatedOutput ? 'Both versions copied to clipboard.' : 'Action copied to clipboard.' });
    } catch {
      onToast({ title: 'Copy failed', description: 'Please copy manually.', variant: 'destructive' });
    }
  }, [output, translatedOutput, participantLanguage, onToast]);

  // Download as file
  const handleDownload = useCallback(() => {
    if (!output.trim()) {
      onToast({ title: 'Nothing to download', description: 'Generate an action first.', variant: 'destructive' });
      return;
    }
    let textToDownload = output;
    if (translatedOutput && participantLanguage !== 'none') {
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
  }, [output, translatedOutput, participantLanguage, mode, onToast]);

  // Save to history
  const handleSave = useCallback(() => {
    if (!output.trim()) {
      onToast({ title: 'Nothing to save', description: 'Generate an action first.', variant: 'destructive' });
      return;
    }

    if (minScoreEnabled && smartScore < minScoreThreshold) {
      onToast({ 
        title: 'SMART score too low', 
        description: `This action scores ${smartScore}/5 but the minimum is ${minScoreThreshold}/5. Improve the action or disable score enforcement in Settings.`,
        variant: 'destructive'
      });
      return;
    }

    const forename = mode === 'now' ? nowForm.forename : futureForm.forename;
    addRecentName(forename);

    const baseMeta = mode === 'now' 
      ? { date: nowForm.date, forename: nowForm.forename, barrier: nowForm.barrier, timescale: nowForm.timescale, action: nowForm.action, responsible: nowForm.responsible, help: nowForm.help }
      : { date: futureForm.date, forename: futureForm.forename, barrier: futureForm.task, timescale: futureForm.timescale, reason: futureForm.outcome };

    const item: HistoryItem = {
      id: crypto.randomUUID(),
      mode,
      createdAt: new Date().toISOString(),
      text: output,
      meta: {
        ...baseMeta,
        ...(translatedOutput && participantLanguage !== 'none' ? {
          translatedText: translatedOutput,
          translationLanguage: participantLanguage
        } : {})
      }
    };

    addToHistory(item);
    onToast({ title: 'Saved!', description: translatedOutput ? 'Action with translation saved to history.' : 'Action saved to history.' });
  }, [output, minScoreEnabled, minScoreThreshold, smartScore, mode, nowForm, futureForm, translatedOutput, participantLanguage, addToHistory, addRecentName, onToast]);

  // Translate output
  const handleTranslate = useCallback(async () => {
    if (!output.trim()) return;
    if (participantLanguage === 'none') {
      setTranslatedOutput(null);
      return;
    }
    
    const result = await translate(output, participantLanguage);
    if (result) {
      setTranslatedOutput(result.translated);
      onToast({ 
        title: 'Translated!', 
        description: `Action translated to ${result.languageName}.` 
      });
    }
  }, [output, participantLanguage, translate, setTranslatedOutput, onToast]);

  return {
    copied,
    setCopied,
    handleCopy,
    handleDownload,
    handleSave,
    handleTranslate,
  };
}
