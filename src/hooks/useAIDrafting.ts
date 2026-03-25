import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useBrowserNativeLLM } from '@/hooks/useBrowserNativeLLM';
import type { SMARTAction, SMARTPlan, RawUserInput } from '@/hooks/useBrowserNativeLLM';
import { usePromptPack } from '@/hooks/usePromptPack';
import { classifyBarrier } from '@/lib/smart-data';
import { retrieveExemplars, formatExemplarsForPrompt, formatTaskExemplarsForPrompt } from '@/lib/smart-retrieval';
import { rankActionsByRelevance } from '@/lib/relevance-checker';
import { logDraftAnalytics } from '@/lib/draft-analytics';
import {
  aiDraftNow,
  aiDraftFuture,
  getTaskSuggestions,
  parseTimescaleToTargetISO,
  formatDDMMMYY,
} from '@/lib/smart-utils';
import type { FeedbackRating } from '@/components/smart/ActionFeedback';
import type { Mode, NowForm, TaskBasedForm } from '@/hooks/useSmartForm';
import type { ActionFeedback as ActionFeedbackRecord } from '@/hooks/useSmartStorage';

export interface UseAIDraftingOptions {
  mode: Mode;
  nowForm: NowForm;
  taskBasedForm: TaskBasedForm;
  setNowForm: React.Dispatch<React.SetStateAction<NowForm>>;
  setTaskBasedForm: React.Dispatch<React.SetStateAction<TaskBasedForm>>;
  suggestQuery: string;
  storage: {
    aiDraftMode: string;
    keepSafariModelLoaded: boolean;
    allowMobileLLM: boolean;
    safariWebGPUEnabled: boolean;
    preferredLLMModel?: string;
    actionFeedback: ActionFeedbackRecord[];
    addFeedback: (feedback: Omit<ActionFeedbackRecord, 'id' | 'createdAt'>) => ActionFeedbackRecord;
    updateFeedback: (id: string, updates: Partial<ActionFeedbackRecord>) => void;
  };
}

export function useAIDrafting({
  mode,
  nowForm,
  taskBasedForm,
  setNowForm,
  setTaskBasedForm,
  suggestQuery,
  storage,
}: UseAIDraftingOptions) {
  const { toast } = useToast();
  const llm = useBrowserNativeLLM({
    allowMobileLLM: storage.allowMobileLLM,
    safariWebGPUEnabled: storage.safariWebGPUEnabled,
  });

  const { pack: promptPack, source: promptPackSource } = usePromptPack();

  // AI Draft state
  const [aiDrafting, setAIDrafting] = useState(false);
  const [showLLMPicker, setShowLLMPicker] = useState(false);
  const pendingAIDraftRef = useRef(false);

  // SmartPlanner plan picker state
  const [planResult, setPlanResult] = useState<SMARTPlan | null>(null);
  const [showPlanPicker, setShowPlanPicker] = useState(false);

  // Feedback state for AI-generated actions
  const [feedbackRating, setFeedbackRating] = useState<FeedbackRating>(null);
  const [currentFeedbackId, setCurrentFeedbackId] = useState<string | null>(null);
  const aiGeneratedActionRef = useRef<string>('');
  const [showFeedbackUI, setShowFeedbackUI] = useState(false);

  const resetFeedbackState = useCallback(() => {
    setShowFeedbackUI(false);
    setFeedbackRating(null);
    setCurrentFeedbackId(null);
    aiGeneratedActionRef.current = '';
  }, []);

  // Safari memory management — unload model after generation
  const safariAutoUnloadTimer = useRef<number | null>(null);
  const scheduleSafariModelUnload = useCallback((delayMs?: number) => {
    if (!llm.browserInfo.isSafari) return;
    if (storage.aiDraftMode !== 'ai') return;
    if (storage.keepSafariModelLoaded) return;
    if (!llm.isReady) return;
    if (safariAutoUnloadTimer.current) {
      window.clearTimeout(safariAutoUnloadTimer.current);
      safariAutoUnloadTimer.current = null;
    }
    const isIOS = llm.deviceInfo?.isIOS;
    const timeoutMs = delayMs ?? (isIOS ? 200 : 800);
    safariAutoUnloadTimer.current = window.setTimeout(() => {
      try {
        llm.unload();
      } catch {
        // ignore
      }
    }, timeoutMs);
  }, [llm, storage.aiDraftMode, storage.keepSafariModelLoaded]);

  useEffect(() => {
    return () => {
      if (safariAutoUnloadTimer.current) {
        window.clearTimeout(safariAutoUnloadTimer.current);
        safariAutoUnloadTimer.current = null;
      }
    };
  }, []);

  // Show toast when LLM encounters an error
  useEffect(() => {
    if (llm.classifiedError) {
      toast({
        title: llm.classifiedError.title,
        description: llm.classifiedError.message,
        variant: 'destructive',
      });
    }
  }, [llm.classifiedError, toast]);

  // Template-based fallback for AI Draft
  const templateDraftNow = useCallback(() => {
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
      suggestQuery,
    );
    setNowForm(prev => ({ ...prev, action, help }));
    toast({ title: 'Draft inserted', description: 'Template draft added. Edit as needed.' });
  }, [nowForm, suggestQuery, setNowForm, toast]);

  const templateDraftTaskBased = useCallback(() => {
    const outcome = aiDraftFuture(taskBasedForm.task, taskBasedForm.forename);
    setTaskBasedForm(prev => ({ ...prev, outcome }));
    toast({ title: 'Draft inserted', description: 'Template draft added. Edit as needed.' });
  }, [taskBasedForm, setTaskBasedForm, toast]);

  // Handle feedback rating from the ActionFeedback component
  const handleFeedbackRate = useCallback((rating: FeedbackRating) => {
    setFeedbackRating(rating);
    if (currentFeedbackId && rating) {
      storage.updateFeedback(currentFeedbackId, { rating });
    }
  }, [currentFeedbackId, storage]);

  // Map a selected SMARTAction from the plan picker to form fields
  const handleSelectPlanAction = useCallback((action: SMARTAction, selectedIndex?: number) => {
    if (mode === 'now') {
      setNowForm(prev => ({
        ...prev,
        action: action.action,
        help: action.rationale || action.first_step,
        timescale: prev.timescale || '2 weeks',
      }));
    } else {
      setTaskBasedForm(prev => ({
        ...prev,
        outcome: action.action,
      }));
    }

    // Track AI-generated text for feedback
    aiGeneratedActionRef.current = action.action;
    setFeedbackRating(null);
    setCurrentFeedbackId(null);
    setShowFeedbackUI(true);

    // Create a pending feedback record
    const barrier = mode === 'now' ? nowForm.barrier : (taskBasedForm.task || '');
    const feedbackRecord = storage.addFeedback({
      barrier,
      category: classifyBarrier(barrier),
      generatedAction: action.action,
      rating: null,
      acceptedAsIs: false,
      source: 'ai',
      forename: mode === 'now' ? nowForm.forename : taskBasedForm.forename,
      timescale: mode === 'now' ? (nowForm.timescale || '2 weeks') : (taskBasedForm.timescale || '4 weeks'),
    });
    setCurrentFeedbackId(feedbackRecord.id);

    // Log analytics: action selected from plan
    logDraftAnalytics({
      timestamp: new Date().toISOString(),
      signal: "selected",
      barrier: mode === 'now' ? nowForm.barrier : undefined,
      selected_index: selectedIndex,
      generated_text: action.action,
      source: "ai",
    });

    setShowPlanPicker(false);
    setPlanResult(null);
    toast({ title: 'Action applied', description: 'SMART action added to form. Edit as needed.' });
  }, [mode, nowForm.barrier, nowForm.forename, nowForm.timescale, taskBasedForm.task, taskBasedForm.forename, taskBasedForm.timescale, setNowForm, setTaskBasedForm, storage, toast]);

  const handleAIDraft = useCallback(async () => {
    if (mode === 'now') {
      if (!nowForm.forename.trim() || !nowForm.barrier.trim()) {
        toast({ title: 'Missing info', description: 'Add a forename and barrier first.', variant: 'destructive' });
        return;
      }
    } else {
      if (!taskBasedForm.forename.trim() || !taskBasedForm.task.trim()) {
        toast({ title: 'Missing info', description: 'Add a forename and task first.', variant: 'destructive' });
        return;
      }
    }

    // User preference: templates - use templates directly
    if (storage.aiDraftMode === 'template') {
      if (mode === 'now') templateDraftNow();
      else templateDraftTaskBased();
      return;
    }

    // On mobile/iPad, use templates unless Experimental Local AI is enabled
    if (llm.isMobile && !llm.canUseLocalAI) {
      if (mode === 'now') templateDraftNow();
      else templateDraftTaskBased();
      toast({
        title: 'Smart templates applied',
        description: 'Local AI is disabled on mobile/iPad by default. Enable it in Settings (Experimental) to use Local AI.',
      });
      return;
    }

    // If AI not ready, show model picker and mark draft as pending
    if (!llm.isReady) {
      pendingAIDraftRef.current = true;
      setShowLLMPicker(true);
      return;
    }

    // Use SmartPlanner for plan generation
    setAIDrafting(true);
    try {
      // Retrieve similar exemplars for context (RAG-style)
      const barrier = mode === 'now' ? nowForm.barrier : (taskBasedForm.task || '');
      const barrierCategory = classifyBarrier(barrier);
      const timescale = mode === 'now' ? (nowForm.timescale || '2 weeks') : (taskBasedForm.timescale || '4 weeks');
      const targetDate = formatDDMMMYY(parseTimescaleToTargetISO(
        mode === 'now' ? nowForm.date : taskBasedForm.date,
        timescale,
      ));

      // For task-based mode, use task-specific outcome exemplars instead of barrier exemplars
      let exemplarContext: string;
      if (mode === 'now') {
        const exemplars = retrieveExemplars(barrier, storage.actionFeedback, 3);
        exemplarContext = formatExemplarsForPrompt(exemplars, nowForm.forename, targetDate);
      } else {
        const taskSuggestions = getTaskSuggestions(taskBasedForm.task);
        exemplarContext = formatTaskExemplarsForPrompt(taskSuggestions, taskBasedForm.forename);
      }

      // Build RawUserInput with enriched context
      const input: RawUserInput = mode === 'now'
        ? {
            goal: 'Find suitable employment',
            barriers: nowForm.barrier,
            timeframe: timescale,
            situation: `Employment advisor helping ${nowForm.forename} with ${nowForm.barrier}.${exemplarContext ? '\n\n' + exemplarContext : ''}`,
            participant_name: nowForm.forename,
            supporter: nowForm.responsible,
            selected_barrier_id: nowForm.barrier,
            selected_barrier_label: nowForm.barrier,
          }
        : {
            goal: taskBasedForm.task,
            timeframe: timescale,
            situation: `Employment advisor helping ${taskBasedForm.forename} attend a future activity. Describe what ${taskBasedForm.forename} will realistically gain DURING or AFTER this activity — not preparation done beforehand.${exemplarContext ? '\n\n' + exemplarContext : ''}`,
            participant_name: taskBasedForm.forename,
            supporter: taskBasedForm.responsible,
            generation_mode: 'outcome',
          };

      const plan = await llm.generatePlan(input);
      const isTemplateFallback = plan.metadata.source === 'template_fallback';

      // Log analytics: plan generated
      logDraftAnalytics({
        timestamp: new Date().toISOString(),
        signal: "generated",
        barrier: mode === 'now' ? nowForm.barrier : undefined,
        barrier_id: input.selected_barrier_id,
        actions_count: plan.actions.length,
        source: isTemplateFallback ? "template" : "ai",
      });

      // Phase 2: Rank actions by relevance before presenting to user
      const rankedActions = rankActionsByRelevance(
        plan.actions,
        barrier,
        mode === 'now' ? nowForm.forename : taskBasedForm.forename,
        timescale,
      );
      const rankedPlan = { ...plan, actions: rankedActions };

      if (rankedPlan.actions.length === 1) {
        // Single action — apply directly
        handleSelectPlanAction(rankedPlan.actions[0]);
        if (isTemplateFallback) {
          // Override the default "Action applied" toast with a template-specific one
          toast({ title: 'Smart template applied', description: 'AI generation used smart templates. Edit as needed.' });
        }
      } else if (rankedPlan.actions.length > 1) {
        // Multiple actions — show picker (best action is first)
        setPlanResult(rankedPlan);
        setShowPlanPicker(true);
      } else {
        throw new Error('Plan generation returned no actions.');
      }

      scheduleSafariModelUnload();
    } catch (err) {
      // The planner now catches inference errors internally and falls back
      // to retrieval-based templates. Errors reaching here are rare
      // (initialization errors, iOS memory crashes).
      console.warn('SmartPlanner draft failed, falling back to templates:', err);
      if (mode === 'now') {
        let timescale = nowForm.timescale;
        if (!timescale) timescale = '2 weeks';
        const { action, help } = aiDraftNow(
          nowForm.barrier, nowForm.forename, nowForm.responsible,
          timescale, nowForm.date, suggestQuery,
        );
        setNowForm(prev => ({ ...prev, action, help, timescale }));
      } else {
        const outcome = aiDraftFuture(taskBasedForm.task, taskBasedForm.forename);
        setTaskBasedForm(prev => ({ ...prev, outcome }));
      }
      // Clear persisted error state so the UI doesn't keep showing the AI
      // error after templates have been successfully applied.
      llm.clearError();
      toast({
        title: 'Using smart templates',
        description: 'AI plan generation failed. Applied templates instead.',
        variant: 'destructive',
      });
      scheduleSafariModelUnload(0);
    } finally {
      setAIDrafting(false);
    }
  }, [mode, nowForm, taskBasedForm, llm, templateDraftNow, templateDraftTaskBased, toast, storage.aiDraftMode, storage.actionFeedback, scheduleSafariModelUnload, suggestQuery, handleSelectPlanAction, setNowForm, setTaskBasedForm]);

  // Auto-trigger AI draft after model finishes loading
  useEffect(() => {
    if (llm.isReady && pendingAIDraftRef.current) {
      pendingAIDraftRef.current = false;
      handleAIDraft();
    }
  }, [llm.isReady, handleAIDraft]);

  // Build context for LLM chat based on current form inputs
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
      if (taskBasedForm.forename) parts.push(`Participant: ${taskBasedForm.forename}`);
      if (taskBasedForm.task) parts.push(`Activity/event: ${taskBasedForm.task}`);
      if (taskBasedForm.responsible) parts.push(`Who is responsible: ${taskBasedForm.responsible}`);
      if (taskBasedForm.outcome) parts.push(`Expected outcome: ${taskBasedForm.outcome}`);
      if (taskBasedForm.timescale) parts.push(`Review in: ${taskBasedForm.timescale}`);
      return parts.length > 0
        ? `Help me improve this task-based SMART action:\n\n${parts.join('\n')}\n\nHow can I make this more specific and measurable?`
        : 'Help me create a task-based SMART action for a future activity or event.';
    }
  }, [mode, nowForm, taskBasedForm]);

  // Handle wizard AI draft — uses SmartPlanner plan generation with template fallback
  const handleWizardAIDraft = useCallback(async (field: string, context: Record<string, string>): Promise<string> => {
    if (storage.aiDraftMode === 'ai' && !llm.isReady) {
      if (llm.canUseLocalAI) {
        setShowLLMPicker(true);
        toast({ title: 'Load Local AI', description: 'Pick a model to enable AI drafting.' });
        return '';
      }
      // AI not available on this device — fall through to template fallback below
      toast({
        title: 'Using smart templates',
        description: 'Local AI is not available on this device. Using templates instead.',
      });
    }

    // If AI is ready, use SmartPlanner
    if (llm.isReady) {
      try {
        const input: RawUserInput = {
          goal: context.barrier
            ? 'Find suitable employment'
            : (context.task || 'Employment support'),
          barriers: context.barrier,
          timeframe: context.timescale || '2 weeks',
          situation: `Helping ${context.forename || 'participant'}`,
          participant_name: context.forename,
          supporter: context.responsible,
          selected_barrier_id: context.barrier,
          selected_barrier_label: context.barrier,
          ...(field === 'outcome' ? { generation_mode: 'outcome' as const } : {}),
        };
        const plan = await llm.generatePlan(input);
        const isTemplateFallback = plan.metadata.source === 'template_fallback';

        if (plan.actions.length > 0) {
          const action = plan.actions[0];
          scheduleSafariModelUnload();

          if (isTemplateFallback) {
            toast({ title: 'Smart template applied', description: 'AI used smart templates for this field.' });
          }

          if (field === 'action') return action.action;
          if (field === 'help') return action.first_step || action.rationale;
          if (field === 'outcome') return action.action;
        }

        // Empty plan — fall through to template with notification
        scheduleSafariModelUnload();
        toast({ title: 'Using smart templates', description: 'AI returned no actions. Using templates instead.' });
      } catch (err) {
        console.warn('SmartPlanner wizard draft failed, falling back to templates:', err);
        toast({ title: 'Using smart templates', description: 'AI generation failed. Applied templates instead.', variant: 'destructive' });
        scheduleSafariModelUnload(0);
      }
    }

    // Template fallback
    if (mode === 'now') {
      const timescale = context.timescale || '2 weeks';
      if (field === 'action' || field === 'help') {
        const { action, help } = aiDraftNow(context.barrier || '', context.forename || '', context.responsible || 'Advisor', timescale, nowForm.date);
        return field === 'action' ? action : help;
      }
    } else {
      if (field === 'outcome') return aiDraftFuture(context.task || '', context.forename || '');
    }
    return '';
  }, [mode, nowForm.date, llm, storage.aiDraftMode, toast, scheduleSafariModelUnload]);

  return {
    llm,
    aiDrafting,
    showLLMPicker,
    setShowLLMPicker,
    pendingAIDraftRef,
    planResult,
    setPlanResult,
    showPlanPicker,
    setShowPlanPicker,
    feedbackRating,
    currentFeedbackId,
    aiGeneratedActionRef,
    showFeedbackUI,
    resetFeedbackState,
    templateDraftNow,
    templateDraftTaskBased,
    handleFeedbackRate,
    handleSelectPlanAction,
    handleAIDraft,
    buildLLMContext,
    handleWizardAIDraft,
    promptPack,
    promptPackSource,
  };
}
