import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { useSmartStorage, HistoryItem, ActionTemplate } from '@/hooks/useSmartStorage';
import { parseSmartToolImportFile } from '@/lib/smart-portability';
import {
  getSuggestionList,
  getTaskSuggestions,
  resolvePlaceholders,
  parseTimescaleToTargetISO,
  formatDDMMMYY,
} from '@/lib/smart-utils';
import { useSmartForm } from '@/hooks/useSmartForm';
import { useAIDrafting } from '@/hooks/useAIDrafting';
import { useActionOutput } from '@/hooks/useActionOutput';
import { TemplateLibrary } from './TemplateLibrary';
import { ActionWizard } from './ActionWizard';
import { ShortcutsHelp } from './ShortcutsHelp';
import { OnboardingTutorial } from './OnboardingTutorial';
import { useLocalSync } from '@/hooks/useLocalSync';
import { FloatingToolbar } from './FloatingToolbar';
import { Footer } from './Footer';
import { ManageConsentDialog } from './CookieConsent';
import { WarningText, InputGlow } from './WarningBox';
import { useKeyboardShortcuts, groupShortcuts, createShortcutMap, ShortcutConfig } from '@/hooks/useKeyboardShortcuts';
import { SMART_TOOL_SHORTCUTS } from '@/lib/smart-tool-shortcuts';
import logoIcon from '@/assets/logo-icon.png';
import { SettingsPanel } from './SettingsPanel';
import { HistoryPanel } from './HistoryPanel';
import { OutputPanel } from './OutputPanel';
import { LLMPickerDialog } from './LLMPickerDialog';
import { PlanPickerDialog } from './PlanPickerDialog';
import { GUIDANCE } from '@/lib/smart-data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Settings, HelpCircle, Sparkles, Sun, Moon, Monitor,
  ChevronDown, ChevronUp, Keyboard, Loader2, AlertTriangle, History,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ComboboxInput } from './ComboboxInput';

// Animation variants
const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05
    }
  }
};

const slideInLeft = {
  initial: { opacity: 0, x: -24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 24 }
};

const slideInRight = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 }
};

// Spring config for soft physics feel
const springTransition = { type: "spring" as const, damping: 22, stiffness: 260 };
const softSpring = { type: "spring" as const, damping: 28, stiffness: 200 };

export function SmartActionTool() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const storage = useSmartStorage();
  const localSync = useLocalSync();

  // --- Extracted hooks ---
  const form = useSmartForm();
  const {
    today, mode, setMode,
    nowForm, setNowForm, taskBasedForm, setTaskBasedForm,
    showValidation, setShowValidation,
    suggestQuery, setSuggestQuery,
    wizardMode, setWizardMode,
    taskBasedDateError, nowDateWarning,
    validateNow, validateTaskBased, getFieldClass,
  } = form;

  const actionOutput = useActionOutput({
    mode,
    nowForm,
    taskBasedForm,
    validateNow,
    validateTaskBased,
    participantLanguage: storage.participantLanguage,
    updateParticipantLanguage: storage.updateParticipantLanguage,
  });
  const {
    translation, output, setOutput,
    outputSource, setOutputSource,
    translatedOutput, setTranslatedOutput, translatedForOutputRef,
    hasTranslation, hasOutput, copied,
    generateOutput, smartCheck,
    handleCopy, handleDownload, handleTranslate, handleLanguageChange,
    clearOutput,
  } = actionOutput;

  const aiDraft = useAIDrafting({
    mode,
    nowForm,
    taskBasedForm,
    setNowForm,
    setTaskBasedForm,
    suggestQuery,
    storage: {
      aiDraftMode: storage.aiDraftMode,
      keepSafariModelLoaded: storage.keepSafariModelLoaded,
      allowMobileLLM: storage.allowMobileLLM,
      safariWebGPUEnabled: storage.safariWebGPUEnabled,
      preferredLLMModel: storage.preferredLLMModel,
      actionFeedback: storage.actionFeedback,
      addFeedback: storage.addFeedback,
      updateFeedback: storage.updateFeedback,
    },
  });
  const {
    llm, aiDrafting,
    showLLMPicker, setShowLLMPicker, pendingAIDraftRef,
    planResult, setPlanResult, showPlanPicker, setShowPlanPicker,
    feedbackRating, currentFeedbackId, aiGeneratedActionRef,
    showFeedbackUI, resetFeedbackState,
    templateDraftNow, templateDraftTaskBased,
    handleFeedbackRate, handleSelectPlanAction, handleAIDraft,
    buildLLMContext, handleWizardAIDraft, promptPack, promptPackSource,
  } = aiDraft;

  // --- UI state (remains in component) ---
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [privacySettingsOpen, setPrivacySettingsOpen] = useState(false);

  // Detect landscape orientation
  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerHeight < 600 && window.innerWidth > window.innerHeight);
    };
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // GDPR: Auto-cleanup old history items on load
  useEffect(() => {
    let isMounted = true;

    const timeoutId = setTimeout(() => {
      if (isMounted && storage.shouldRunCleanup()) {
        const { deletedCount } = storage.cleanupOldHistory();
        if (isMounted && deletedCount > 0) {
          toast({
            title: 'Data retention cleanup',
            description: `${deletedCount} action${deletedCount === 1 ? '' : 's'} older than ${storage.retentionDays} days ${deletedCount === 1 ? 'was' : 'were'} automatically removed.`,
          });
        }
      }
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClear = useCallback(() => {
    form.resetForm();
    clearOutput();
    resetFeedbackState();
  }, [form, clearOutput, resetFeedbackState]);

  const handleSave = useCallback(async () => {
    if (!output.trim()) {
      toast({ title: 'Nothing to save', description: 'Generate an action first.', variant: 'destructive' });
      return;
    }

    // Check minimum score enforcement
    if (storage.minScoreEnabled && smartCheck.overallScore < storage.minScoreThreshold) {
      toast({
        title: 'SMART score too low',
        description: `This action scores ${smartCheck.overallScore}/5 but the minimum is ${storage.minScoreThreshold}/5. Improve the action or disable score enforcement in Settings.`,
        variant: 'destructive'
      });
      return;
    }

    const forename = mode === 'now' ? nowForm.forename : taskBasedForm.forename;
    storage.addRecentName(forename);

    const baseMeta = mode === 'now'
      ? { date: nowForm.date, time: nowForm.time, forename: nowForm.forename, barrier: nowForm.barrier, timescale: nowForm.timescale, action: nowForm.action, responsible: nowForm.responsible, help: nowForm.help }
      : { date: taskBasedForm.date, forename: taskBasedForm.forename, barrier: taskBasedForm.task, timescale: taskBasedForm.timescale, responsible: taskBasedForm.responsible, reason: taskBasedForm.outcome };

    const item: HistoryItem = {
      id: crypto.randomUUID(),
      mode,
      createdAt: new Date().toISOString(),
      text: output,
      meta: {
        ...baseMeta,
        ...(hasTranslation && storage.participantLanguage !== 'none' ? {
          translatedText: translatedOutput,
          translationLanguage: storage.participantLanguage
        } : {})
      }
    };

    storage.addToHistory(item);

    // Update feedback record if this was an AI-generated action
    if (currentFeedbackId && showFeedbackUI) {
      const currentAction = mode === 'now' ? nowForm.action : taskBasedForm.outcome;
      const wasEdited = aiGeneratedActionRef.current && currentAction !== aiGeneratedActionRef.current;
      storage.updateFeedback(currentFeedbackId, {
        acceptedAsIs: !wasEdited,
        ...(wasEdited ? { editedAction: currentAction } : {}),
      });
      resetFeedbackState();
    }

    // Local folder sync if enabled
    if (localSync.isConnected && localSync.syncEnabled) {
      try {
        const success = await localSync.writeAction(item);
        if (success) {
          toast({
            title: 'Saved & Synced!',
            description: hasTranslation
              ? 'Action with translation saved and synced to folder.'
              : 'Action saved and synced to folder.'
          });
        } else {
          toast({
            title: 'Saved locally',
            description: 'Action saved but folder sync failed. Check connection in Settings.',
            variant: 'default'
          });
        }
      } catch (err) {
        console.error('Folder sync error:', err);
        toast({
          title: 'Saved locally',
          description: 'Action saved but folder sync failed.',
          variant: 'default'
        });
      }
    } else {
      toast({ title: 'Saved!', description: hasTranslation ? 'Action with translation saved to history.' : 'Action saved to history.' });
    }
  }, [output, storage, smartCheck.overallScore, mode, nowForm, taskBasedForm, translatedOutput, hasTranslation, toast, localSync, currentFeedbackId, showFeedbackUI, aiGeneratedActionRef, resetFeedbackState]);

  const handleEditHistory = (item: HistoryItem) => {
    setMode(item.mode);
    if (item.mode === 'now') {
      setNowForm({
        date: item.meta.date || today,
        time: (item.meta as Record<string, unknown>).time as string || '',
        forename: item.meta.forename || '',
        barrier: item.meta.barrier || '',
        action: item.meta.action || '',
        responsible: item.meta.responsible || '',
        help: item.meta.help || '',
        timescale: item.meta.timescale || ''
      });
    } else {
      setTaskBasedForm({
        date: item.meta.date || today,
        forename: item.meta.forename || '',
        task: item.meta.barrier || '',
        responsible: item.meta.responsible || '',
        outcome: item.meta.reason || '',
        timescale: item.meta.timescale || ''
      });
    }
    setOutput(item.text || '');
    setOutputSource('manual');
    if (item.meta.translatedText && item.meta.translationLanguage) {
      translatedForOutputRef.current = item.text || '';
      setTranslatedOutput(item.meta.translatedText);
      storage.updateParticipantLanguage(item.meta.translationLanguage);
    } else {
      translatedForOutputRef.current = '';
      setTranslatedOutput(null);
    }
    setShowValidation(false);
    toast({ title: 'Loaded', description: 'Edit and regenerate as needed.' });
  };

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
      return getTaskSuggestions(taskBasedForm.task);
    }
  }, [mode, nowForm.barrier, taskBasedForm.task, suggestQuery]);

  const targetCtx = useMemo(() => {
    const baseISO = mode === 'now' ? nowForm.date : taskBasedForm.date;
    const timescale = mode === 'now' ? nowForm.timescale : taskBasedForm.timescale;
    const forename = mode === 'now' ? nowForm.forename : taskBasedForm.forename;
    const targetISO = parseTimescaleToTargetISO(baseISO || today, timescale || '2 weeks');
    return { targetPretty: formatDDMMMYY(targetISO), n: 2, forename: forename.trim() };
  }, [mode, nowForm.date, nowForm.timescale, nowForm.forename, taskBasedForm.date, taskBasedForm.timescale, taskBasedForm.forename, today]);

  const handleInsertSuggestion = (suggestion: { title: string; action?: string; help?: string; outcome?: string }) => {
    if (mode === 'now' && suggestion.action) {
      const action = resolvePlaceholders(suggestion.action, targetCtx);
      const help = resolvePlaceholders(suggestion.help || '', targetCtx);
      setNowForm(prev => ({
        ...prev,
        action: prev.action.trim() ? prev.action.trimEnd() + '\n' + action : action,
        help: help && !prev.help.trim() ? help : prev.help
      }));
      toast({ title: 'Inserted', description: 'Suggestion added.' });
    } else if (mode === 'future' && suggestion.outcome) {
      if (!taskBasedForm.forename.trim()) {
        toast({ title: 'Enter forename first', description: 'Add the participant\'s forename.', variant: 'destructive' });
        return;
      }
      const outcome = suggestion.outcome.replace(/\[Name\]/g, taskBasedForm.forename);
      setTaskBasedForm(prev => ({ ...prev, outcome }));
      toast({ title: 'Inserted', description: 'Suggestion added.' });
    }
  };

  // Handle template insertion
  const handleInsertTemplate = useCallback((template: ActionTemplate) => {
    if (template.mode === 'now') {
      setNowForm(prev => ({
        ...prev,
        barrier: template.barrier || prev.barrier,
        action: template.action || prev.action,
        responsible: template.responsible || prev.responsible,
        help: template.help || prev.help,
      }));
    } else {
      setTaskBasedForm(prev => ({
        ...prev,
        task: template.task || prev.task,
        outcome: template.outcome || prev.outcome,
      }));
    }
  }, [setNowForm, setTaskBasedForm]);

  const handleExport = () => {
    // Use the same format as exportAllData for consistency and full round-trip support
    const payload = storage.exportAllData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-action-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Data exported successfully.' });
  };

  // Handle wizard completion
  const handleWizardComplete = useCallback((data: Record<string, string>) => {
    if (mode === 'now') {
      setNowForm(prev => ({
        ...prev,
        forename: data.forename || prev.forename,
        barrier: data.barrier || prev.barrier,
        action: data.action || prev.action,
        responsible: data.responsible || prev.responsible,
        help: data.help || prev.help,
        timescale: data.timescale || prev.timescale,
      }));
    } else {
      setTaskBasedForm(prev => ({
        ...prev,
        forename: data.forename || prev.forename,
        task: data.task || prev.task,
        responsible: data.responsible || prev.responsible,
        outcome: data.outcome || prev.outcome,
        timescale: data.timescale || prev.timescale,
      }));
    }
    setWizardMode(false);
    toast({ title: 'Wizard complete', description: 'Form populated. Review and generate your action.' });
  }, [mode, setNowForm, setTaskBasedForm, setWizardMode, toast]);

  // Keyboard shortcuts configuration
  const shortcuts: ShortcutConfig[] = useMemo(() => [
    { ...SMART_TOOL_SHORTCUTS.saveToHistory, action: handleSave },
    { ...SMART_TOOL_SHORTCUTS.aiDraft, action: handleAIDraft },
    { ...SMART_TOOL_SHORTCUTS.copyOutput, action: handleCopy },
    { ...SMART_TOOL_SHORTCUTS.clearForm, action: handleClear },
    { ...SMART_TOOL_SHORTCUTS.switchToNow, action: () => { setMode('now'); setShowValidation(false); } },
    { ...SMART_TOOL_SHORTCUTS.switchToFuture, action: () => { setMode('future'); setShowValidation(false); } },
    { ...SMART_TOOL_SHORTCUTS.showShortcutsHelp, action: () => setShortcutsHelpOpen(true) },
  ], [handleSave, handleAIDraft, handleCopy, handleClear, setMode, setShowValidation]);

  const shortcutMap = useMemo(() => createShortcutMap(shortcuts), [shortcuts]);

  useKeyboardShortcuts(shortcuts, true);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // File size check (max 2MB)
    const MAX_FILE_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: 'File too large', description: 'Maximum file size is 2MB.', variant: 'destructive' });
      e.target.value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onerror = () => {
      toast({ title: 'Import failed', description: 'Could not read the file. Please try again.', variant: 'destructive' });
    };
    reader.onload = () => {
      try {
        const rawData = JSON.parse(String(reader.result || '{}'));
        const validated = parseSmartToolImportFile(rawData);
        storage.importData({
          history: validated.history as HistoryItem[] | undefined,
          barriers: validated.barriers,
          timescales: validated.timescales,
          recentNames: validated.recentNames,
          templates: validated.templates as ActionTemplate[] | undefined,
          settings: validated.settings,
        });
        toast({ title: 'Imported', description: 'Data imported successfully.' });
      } catch (error) {
        if (error instanceof z.ZodError) {
          toast({ title: 'Invalid data', description: 'Import file contains invalid or malformed data.', variant: 'destructive' });
        } else {
          toast({ title: 'Import failed', description: 'Invalid file format.', variant: 'destructive' });
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <>
      {/* Onboarding Tutorial for first-time users */}
      <OnboardingTutorial />

      {/* Subtle gradient overlay */}
      <motion.div 
        className="fixed inset-0 gradient-subtle opacity-50 pointer-events-none z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 1 }}
      />
      
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-50 glass-header"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className={cn(
          "max-w-7xl mx-auto px-2 sm:px-4 flex items-center justify-between transition-all duration-200 overflow-hidden",
          isLandscape && headerCollapsed ? "py-1" : isLandscape ? "py-2" : "py-3 sm:py-4"
        )}>
          <motion.div 
            className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <motion.div
              className={cn(
                "rounded-xl bg-white/10 border border-white/15 backdrop-blur-md shadow-glow transition-all duration-200 flex-shrink-0 overflow-hidden",
                isLandscape && headerCollapsed ? "w-7 h-7" : isLandscape ? "w-8 h-8" : "w-9 h-9 sm:w-11 sm:h-11"
              )}
              whileHover={{ scale: 1.08, rotate: 3 }}
              whileTap={{ scale: 0.95 }}
            >
              <img
                src={logoIcon}
                alt=""
                className="w-full h-full object-contain p-1"
                loading="eager"
                decoding="async"
              />
            </motion.div>
            <AnimatePresence mode="wait">
              {!(isLandscape && headerCollapsed) && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden min-w-0"
                >
                  <div className="flex items-center gap-2">

              <div className="flex flex-col leading-tight min-w-0">
                <span className="font-semibold tracking-tight text-foreground truncate">SMART Action Support Tool</span>
              </div>
                    <span className="sr-only">SMART Action Support Tool</span>
                  </div>
                  {!isLandscape && <p className="text-xs text-muted-foreground hidden sm:block">by William Wessex</p>}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          
          <div className="flex gap-0.5 sm:gap-1 items-center flex-shrink-0">
            {/* Collapse toggle - only show in landscape */}
            {isLandscape && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setHeaderCollapsed(!headerCollapsed)}
                aria-label={headerCollapsed ? "Expand header" : "Collapse header"}
                className="px-1.5 sm:px-2 h-8"
              >
                {headerCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </Button>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" aria-label="Toggle theme" className="px-1.5 sm:px-2 h-8">
                  {theme === 'dark' ? <Moon className="w-4 h-4" /> : theme === 'light' ? <Sun className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="w-4 h-4 mr-2" /> Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="w-4 h-4 mr-2" /> Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="w-4 h-4 mr-2" /> System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Dialog open={guidanceOpen} onOpenChange={setGuidanceOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="px-1.5 sm:px-2 h-8">
                  <HelpCircle className="w-4 h-4" />
                  <span className="ml-1 hidden sm:inline">Guidance</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden">
                <DialogHeader className="shrink-0">
                  <DialogTitle>Guidance</DialogTitle>
                </DialogHeader>
                <div className="flex-1 space-y-4 overflow-y-auto pr-2">
                  {GUIDANCE.map((g, i) => (
                    <motion.div
                      key={i}
                      className="p-4 rounded-lg border bg-card hover:border-primary/30 hover:shadow-sm transition-all duration-200 ease-spring"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <h3 className="font-bold mb-2">{g.title}</h3>
                      {Array.isArray(g.body) ? (
                        <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">
                          {g.body.map((item, j) => <li key={j}>{item}</li>)}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">{g.body}</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            <Button 
              data-tutorial="shortcuts"
              variant="ghost" 
              size="sm" 
              className="px-1.5 sm:px-2 h-8" 
              onClick={() => setShortcutsHelpOpen(true)}
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </Button>

            <Button variant="ghost" size="sm" className="px-1.5 sm:px-2 h-8" onClick={() => setSettingsOpen(true)}>
              <Settings className="w-4 h-4" />
              <span className="ml-1 hidden sm:inline">Settings</span>
            </Button>

          </div>
        </div>
      </motion.header>

      {/* Shortcuts Help Dialog */}
      <ShortcutsHelp 
        open={shortcutsHelpOpen} 
        onOpenChange={setShortcutsHelpOpen} 
        groups={groupShortcuts(shortcuts)} 
      />

      {/* AI Improve replaced by SmartPlanner validation/repair loop */}

      <main className="relative max-w-7xl mx-auto px-4 py-8">
        <motion.div 
          className="grid lg:grid-cols-2 gap-8"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {/* Left Panel - Form or Wizard */}
          <motion.div
            className="glass-panel rounded-2xl p-6 space-y-6 shadow-soft hover:shadow-md transition-shadow duration-300"
            variants={slideInLeft}
            transition={softSpring}
          >
            {wizardMode ? (
              <ActionWizard
                mode={mode}
                barriers={storage.barriers}
                timescales={storage.timescales}
                recentNames={storage.recentNames}
                onComplete={handleWizardComplete}
                onCancel={() => setWizardMode(false)}
                onAIDraft={handleWizardAIDraft}
                isAIDrafting={aiDrafting || llm.isGenerating}
                isLLMReady={llm.isReady}
              />
            ) : (
            <>
            {/* Header with Guided Mode button */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Create Action</h2>
              <Button
                data-tutorial="guided-mode"
                variant="outline"
                size="sm"
                onClick={() => setWizardMode(true)}
                className="gap-2 border-primary/40 hover:bg-primary/10 hover:border-primary"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                Guided Mode
              </Button>
            </div>

            {/* Tabs */}
            <div 
              className="flex gap-2 p-1 bg-muted rounded-full relative"
              role="tablist"
              aria-label="Action type selection"
            >
              <motion.div
                className="absolute inset-y-1 rounded-full bg-primary shadow-md pointer-events-none"
                style={{ width: 'calc(50% - 4px)' }}
                animate={{ x: mode === 'now' ? 4 : 'calc(100% + 4px)' }}
                transition={{ type: "spring", stiffness: 350, damping: 25, mass: 0.8 }}
                aria-hidden="true"
              />
              <Button
                type="button"
                variant="ghost"
                role="tab"
                aria-selected={mode === 'now'}
                aria-controls="now-form-panel"
                id="now-tab"
                className={cn(
                  "flex-1 rounded-full transition-colors duration-200 relative z-10",
                  mode === 'now' && "text-primary-foreground hover:bg-transparent"
                )}
                onClick={() => { setMode('now'); setShowValidation(false); }}
              >
                Barrier to action
              </Button>
              <Button
                type="button"
                variant="ghost"
                role="tab"
                aria-selected={mode === 'future'}
                aria-controls="future-form-panel"
                id="future-tab"
                className={cn(
                  "flex-1 rounded-full transition-colors duration-200 relative z-10",
                  mode === 'future' && "text-primary-foreground hover:bg-transparent"
                )}
                onClick={() => { setMode('future'); setShowValidation(false); }}
              >
                Task-based
              </Button>
            </div>

            <AnimatePresence mode="wait">
            {mode === 'now' ? (
              <motion.div
                key="now-form"
                id="now-form-panel"
                role="tabpanel"
                aria-labelledby="now-tab"
                className="space-y-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={springTransition}
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="space-y-2 shrink-0 mb-4 sm:mb-0 sm:mr-6" style={{ width: 'clamp(140px, 40%, 220px)' }}>
                    <label htmlFor="meeting-date" className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      During our meeting on…
                      <AnimatePresence>
                        {nowDateWarning && (
                          <motion.span
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: [1, 1.2, 1], rotate: 0 }}
                            exit={{ scale: 0, rotate: 180 }}
                            transition={{ duration: 0.4, ease: "easeOut" }}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </label>
                    <div className="relative">
                      <InputGlow show={!!nowDateWarning} variant="warning" />
                      <Input
                        id="meeting-date"
                        type="date"
                        value={nowForm.date}
                        onChange={e => setNowForm(prev => ({ ...prev, date: e.target.value }))}
                        max={today}
                        className={`${getFieldClass(!!nowForm.date)} ${nowDateWarning ? 'border-amber-500 focus-visible:ring-amber-500' : ''}`}
                        aria-describedby={nowDateWarning ? "date-warning" : undefined}
                        aria-invalid={!!nowDateWarning}
                      />
                    </div>
                    <WarningText show={!!nowDateWarning} variant="warning" id="date-warning">
                      {nowDateWarning}
                    </WarningText>

                    <div className="space-y-2">
                      <label htmlFor="meeting-time" className="text-sm font-medium text-muted-foreground">
                        Time (optional)
                      </label>
                      <Input
                        id="meeting-time"
                        value={nowForm.time}
                        onChange={e => setNowForm(prev => ({ ...prev, time: e.target.value }))}
                        placeholder="e.g. 11am"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    <label htmlFor="participant-name" className="text-sm font-medium text-muted-foreground">Participant forename</label>
                    <Input
                      id="participant-name"
                      value={nowForm.forename}
                      onChange={e => setNowForm(prev => ({ ...prev, forename: e.target.value }))}
                      placeholder="e.g. John"
                      list="recent-names"
                      autoComplete="off"
                      className={getFieldClass(!!nowForm.forename.trim())}
                    />
                    <datalist id="recent-names">
                      {storage.recentNames.map(n => <option key={n} value={n} />)}
                    </datalist>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">What identified barrier needs to be addressed?</label>
                  <ComboboxInput
                    value={nowForm.barrier}
                    onChange={(value) => setNowForm(prev => ({ ...prev, barrier: value }))}
                    options={storage.barriers}
                    placeholder="Select or type your own…"
                    emptyMessage="No barriers found."
                    className={getFieldClass(!!nowForm.barrier.trim())}
                  />
                  <p className="text-xs text-muted-foreground">Tip: you can type your own barrier if it isn't listed.</p>
                </div>

                <div data-tutorial="ai-assist" className="border border-primary/20 rounded-xl p-4 gradient-subtle space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Advisor assist
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={handleAIDraft} 
                        disabled={aiDrafting || llm.isGenerating}
                        className="bg-primary hover:bg-primary/90 shadow-md"
                      >
                        {aiDrafting || llm.isGenerating ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Drafting...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 mr-1" /> {llm.isReady ? 'AI Draft' : 'AI draft'}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={suggestQuery}
                    onChange={e => setSuggestQuery(e.target.value)}
                    placeholder="Filter suggestions (optional)…"
                    className="text-sm bg-background/80"
                    aria-label="Filter action suggestions"
                  />
                  {/* BUG FIX #3: Added proper styling for suggestion chips */}
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, i) => (
                      <motion.button
                        key={`${s.title}-${i}`}
                        type="button"
                        onClick={() => handleInsertSuggestion(s)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-full border border-primary/30 bg-background hover:bg-primary/10 hover:border-primary/50 transition-colors"
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <span>{s.title}</span>
                        <span className="text-xs text-primary px-2 py-0.5 rounded-full bg-primary/10">insert</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">To address this, we have discussed that…</label>
                  <Textarea
                    value={nowForm.action}
                    onChange={e => setNowForm(prev => ({ ...prev, action: e.target.value }))}
                    placeholder="Start with the participant's name. Include what they will do, by when, and where if relevant."
                    rows={4}
                    spellCheck
                    data-field="action"
                    className={getFieldClass(!!nowForm.action.trim())}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Who is responsible?</label>
                    <Select
                      value={nowForm.responsible}
                      onValueChange={(value) => setNowForm(prev => ({ ...prev, responsible: value }))}
                    >
                      <SelectTrigger className={getFieldClass(!!nowForm.responsible)}>
                        <SelectValue placeholder="Select responsible person…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Participant">Participant</SelectItem>
                        <SelectItem value="Advisor">Advisor</SelectItem>
                        <SelectItem value="I">I</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">This action will help…</label>
                    <Input
                      value={nowForm.help}
                      onChange={e => setNowForm(prev => ({ ...prev, help: e.target.value }))}
                      placeholder="How will it help?"
                      className={getFieldClass(!!nowForm.help.trim())}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">This will be reviewed in…</label>
                  <ComboboxInput
                    value={nowForm.timescale}
                    onChange={(value) => setNowForm(prev => ({ ...prev, timescale: value }))}
                    options={storage.timescales}
                    placeholder="Select timescale…"
                    emptyMessage="No timescales found."
                    className={getFieldClass(!!nowForm.timescale)}
                    data-field="timescale"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="future-form"
                id="future-form-panel"
                role="tabpanel"
                aria-labelledby="future-tab"
                className="space-y-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={springTransition}
              >
                <p className="text-sm text-muted-foreground">Schedule a future task, event, or activity for the participant.</p>
                
                <div className="flex flex-col sm:flex-row">
                  <div className="space-y-2 shrink-0 mb-4 sm:mb-0 sm:mr-6" style={{ width: 'clamp(140px, 40%, 220px)' }}>
                    <label htmlFor="scheduled-date" className="text-sm font-medium text-muted-foreground">Scheduled date</label>
                    <div className="relative">
                      <InputGlow show={!!taskBasedDateError} variant="error" />
                      <Input
                        id="scheduled-date"
                        type="date"
                        value={taskBasedForm.date}
                        onChange={e => setTaskBasedForm(prev => ({ ...prev, date: e.target.value }))}
                        min={today}
                        className={`${getFieldClass(!!taskBasedForm.date && !taskBasedDateError)} ${taskBasedDateError ? 'border-destructive' : ''}`}
                        aria-describedby={taskBasedDateError ? "future-date-error" : undefined}
                        aria-invalid={!!taskBasedDateError}
                      />
                    </div>
                    {/* BUG FIX #1: Show error for past dates */}
                    <WarningText show={!!taskBasedDateError} variant="error" id="future-date-error">
                      {taskBasedDateError}
                    </WarningText>
                  </div>
                  <div className="space-y-2 flex-1 min-w-0">
                    <label htmlFor="future-participant-name" className="text-sm font-medium text-muted-foreground">Participant forename</label>
                    <Input
                      id="future-participant-name"
                      value={taskBasedForm.forename}
                      onChange={e => setTaskBasedForm(prev => ({ ...prev, forename: e.target.value }))}
                      placeholder="e.g. John"
                      list="recent-names"
                      autoComplete="off"
                      className={getFieldClass(!!taskBasedForm.forename.trim())}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Activity or event</label>
                  <Textarea
                    value={taskBasedForm.task}
                    onChange={e => setTaskBasedForm(prev => ({ ...prev, task: e.target.value }))}
                    placeholder="e.g. Christmas Job Fair at Twickenham Stadium"
                    rows={2}
                    spellCheck
                    className={getFieldClass(!!taskBasedForm.task.trim())}
                  />
                  <p className="text-xs text-muted-foreground">Describe the task, event, or activity they will attend.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Who is responsible?</label>
                  <Select
                    value={taskBasedForm.responsible}
                    onValueChange={(value) => setTaskBasedForm(prev => ({ ...prev, responsible: value }))}
                  >
                    <SelectTrigger className={getFieldClass(!!taskBasedForm.responsible)}>
                      <SelectValue placeholder="Select responsible person…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Participant">Participant</SelectItem>
                      <SelectItem value="Advisor">Advisor</SelectItem>
                      <SelectItem value="I">I</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Advisor Assist - Task-based */}
                <div className="border border-primary/20 rounded-xl p-4 gradient-subtle space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-semibold text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      Advisor assist
                    </span>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={handleAIDraft} 
                        disabled={aiDrafting || llm.isGenerating}
                        className="bg-primary hover:bg-primary/90 shadow-md"
                      >
                        {aiDrafting || llm.isGenerating ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Drafting...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 mr-1" /> {llm.isReady ? 'AI Draft' : 'AI draft'}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  {/* BUG FIX #3: Added proper styling for task-based suggestion buttons */}
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s, i) => (
                      <motion.button
                        key={`${s.title}-${i}`}
                        type="button"
                        onClick={() => handleInsertSuggestion(s)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-full border border-primary/30 bg-background hover:bg-primary/10 hover:border-primary/50 transition-colors"
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                      >
                        <span>{s.title}</span>
                        <span className="text-xs text-primary px-2 py-0.5 rounded-full bg-primary/10">insert</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">What will happen / expected outcome?</label>
                  <Textarea
                    value={taskBasedForm.outcome}
                    onChange={e => setTaskBasedForm(prev => ({ ...prev, outcome: e.target.value }))}
                    placeholder="e.g. will speak with employers about warehouse roles and collect contact details"
                    rows={4}
                    spellCheck
                    data-field="outcome"
                    className={getFieldClass(!!taskBasedForm.outcome.trim())}
                  />
                  <p className="text-xs text-muted-foreground">Describe what the participant will do or achieve. Use AI draft for suggestions.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">This will be reviewed in…</label>
                  <ComboboxInput
                    value={taskBasedForm.timescale}
                    onChange={(value) => setTaskBasedForm(prev => ({ ...prev, timescale: value }))}
                    options={storage.timescales}
                    placeholder="Select timescale…"
                    emptyMessage="No timescales found."
                    className={getFieldClass(!!taskBasedForm.timescale)}
                    data-field="timescale"
                  />
                </div>
              </motion.div>
            )}
            </AnimatePresence>

            {/* Actions */}
              {/* Actions */}
              <motion.div 
                className="flex flex-wrap gap-3 pt-4 border-t border-border/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button onClick={() => generateOutput(true)} className="bg-primary hover:bg-primary/90 shadow-md">
                    Generate action
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button variant="outline" onClick={handleClear}>Clear</Button>
                </motion.div>
                {/* Improve button removed — SmartPlanner handles quality via validation/repair */}
                <div className="flex-1" />
                <TemplateLibrary
                templates={storage.templates}
                onSaveTemplate={storage.addTemplate}
                onDeleteTemplate={storage.deleteTemplate}
                onUpdateTemplate={storage.updateTemplate}
                onInsertTemplate={handleInsertTemplate}
                currentMode={mode}
                currentForm={mode === 'now' 
                  ? { barrier: nowForm.barrier, action: nowForm.action, responsible: nowForm.responsible, help: nowForm.help }
                  : { task: taskBasedForm.task, responsible: taskBasedForm.responsible, outcome: taskBasedForm.outcome }
                }
              />
            </motion.div>
            
              {/* Save to history - separate row */}
              <motion.div 
                className="flex items-center justify-end gap-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
              >
                {/* Score warning indicator */}
                {storage.minScoreEnabled && output.trim() && smartCheck.overallScore < storage.minScoreThreshold && (
                  <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 px-3 py-1.5 rounded-full">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Score {smartCheck.overallScore}/{storage.minScoreThreshold} required</span>
                  </div>
                )}
                <Button 
                  variant="ghost" 
                  onClick={handleSave}
                  disabled={storage.minScoreEnabled && output.trim() !== '' && smartCheck.overallScore < storage.minScoreThreshold}
                  className={cn(
                    storage.minScoreEnabled && output.trim() && smartCheck.overallScore < storage.minScoreThreshold && "opacity-50"
                  )}
                >
                  <History className="w-4 h-4 mr-1" /> Save to history
                </Button>
              </motion.div>
            </>
            )}
          </motion.div>

          {/* Right Panel - Output & History */}
          <motion.div
            className="glass-panel rounded-2xl p-6 space-y-6 shadow-soft hover:shadow-md transition-shadow duration-300"
            variants={slideInRight}
            transition={{ ...softSpring, delay: 0.1 }}
          >
            <OutputPanel
              output={output}
              setOutput={setOutput}
              setOutputSource={setOutputSource}
              setTranslatedOutput={setTranslatedOutput}
              translatedOutput={translatedOutput}
              hasTranslation={hasTranslation}
              hasOutput={hasOutput}
              copied={copied}
              smartCheck={smartCheck}
              participantLanguage={storage.participantLanguage}
              handleCopy={handleCopy}
              handleDownload={handleDownload}
              handleTranslate={handleTranslate}
              handleLanguageChange={handleLanguageChange}
              translation={translation}
              llm={llm}
              showFeedbackUI={showFeedbackUI}
              feedbackRating={feedbackRating}
              handleFeedbackRate={handleFeedbackRate}
              handleAIDraft={handleAIDraft}
              aiDrafting={aiDrafting}
            />

            <HistoryPanel
              history={storage.history}
              hasOutput={hasOutput}
              output={output}
              smartCheck={smartCheck}
              minScoreEnabled={storage.minScoreEnabled}
              minScoreThreshold={storage.minScoreThreshold}
              onSave={handleSave}
              onExport={handleExport}
              onImport={handleImport}
              onClearHistory={() => {
                storage.clearHistory();
                toast({ title: 'Cleared', description: 'History cleared.' });
              }}
              onEditHistory={handleEditHistory}
              onDeleteFromHistory={storage.deleteFromHistory}
            />
          </motion.div>
        </motion.div>
      </main>

      {/* Floating Action Toolbar */}
      <FloatingToolbar
        onCopy={handleCopy}
        onSave={handleSave}
        onClear={handleClear}
        onAIDraft={handleAIDraft}
        onDownload={handleDownload}
        hasOutput={hasOutput}
        copied={copied}
        shortcutMap={shortcutMap}
      />

      {/* Footer */}
      <Footer onOpenPrivacySettings={() => setPrivacySettingsOpen(true)} />

      {/* Privacy Settings Dialog */}
      <ManageConsentDialog 
        open={privacySettingsOpen} 
        onOpenChange={setPrivacySettingsOpen} 
      />

      {/* Settings Panel */}
      <SettingsPanel
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        storage={storage}
        localSync={localSync}
        llm={llm}
        promptPack={promptPack}
        promptPackSource={promptPackSource}
        wizardMode={wizardMode}
        setWizardMode={setWizardMode}
        privacySettingsOpen={privacySettingsOpen}
        setPrivacySettingsOpen={setPrivacySettingsOpen}
      />

      {/* Plan Picker Dialog */}
      <PlanPickerDialog
        open={showPlanPicker}
        onOpenChange={setShowPlanPicker}
        planResult={planResult}
        setPlanResult={setPlanResult}
        mode={mode}
        barrier={mode === 'now' ? nowForm.barrier : taskBasedForm.task}
        onSelectAction={handleSelectPlanAction}
      />

      {/* LLM Model Picker Dialog */}
      <LLMPickerDialog
        open={showLLMPicker}
        onOpenChange={setShowLLMPicker}
        mode={mode}
        pendingAIDraftRef={pendingAIDraftRef}
        templateDraftNow={templateDraftNow}
        templateDraftTaskBased={templateDraftTaskBased}
        llm={llm}
        storage={{
          preferredLLMModel: storage.preferredLLMModel,
          updatePreferredLLMModel: storage.updatePreferredLLMModel,
          updateAIDraftMode: storage.updateAIDraftMode,
        }}
      />
    </>
  );
}
