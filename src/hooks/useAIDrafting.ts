import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useBrowserNativeLLM } from '@/hooks/useBrowserNativeLLM';
import type { SMARTAction, SMARTPlan, RawUserInput } from '@/hooks/useBrowserNativeLLM';
import { usePromptPack } from '@/hooks/usePromptPack';
import { classifyBarrier } from '@/lib/smart-data';
import {
  retrieveExemplars,
  formatExemplarsForPrompt,
  retrieveRejectedExemplars,
  formatRejectedExemplarsForPrompt,
  formatTaskExemplarsForPrompt,
} from '@/lib/smart-retrieval';
import { rankActionsByRelevance } from '@/lib/relevance-checker';
import { logDraftAnalytics } from '@/lib/draft-analytics';
import {
  PRIMARY_RELEVANCE_THRESHOLD,
  createBarrierDraftContext,
  selectAlternateActions,
  selectPrimaryBarrierDraft,
  type BarrierDraftSelection,
} from '@/lib/barrier-draft';
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
    aiDraftRuntime: 'auto' | 'browser' | 'desktop-helper';
    keepSafariModelLoaded: boolean;
    allowMobileLLM: boolean;
    safariWebGPUEnabled: boolean;
    preferredLLMModel?: string;
    actionFeedback: ActionFeedbackRecord[];
    addFeedback: (feedback: Omit<ActionFeedbackRecord, 'id' | 'createdAt'>) => ActionFeedbackRecord;
    updateFeedback: (id: string, updates: Partial<ActionFeedbackRecord>) => void;
  };
}

interface DraftRequestContext {
  input: RawUserInput;
  barrier: string;
  barrierId?: string;
  forename: string;
  timescale: string;
}

interface ApplyDraftActionOptions {
  draftMode: 'primary' | 'alternates';
  selectedIndex?: number;
  draftMeta?: BarrierDraftSelection | null;
  toastDescription: string;
  source?: 'ai' | 'template';
}

interface DraftFeedbackContext {
  currentActionText?: string;
  currentRating?: FeedbackRating;
  isRegenerate?: boolean;
}

function normaliseActionKey(text?: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
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
    runtimePreference: storage.aiDraftRuntime,
  });

  const { pack: promptPack, source: promptPackSource } = usePromptPack();
  const {
    isCached: isModelCached,
    isLoading: isLLMLoading,
    isReady: isLLMReady,
    preloadIfCached,
  } = llm;

  const [aiDrafting, setAIDrafting] = useState(false);
  const [showLLMPicker, setShowLLMPicker] = useState(false);
  const pendingAIDraftRef = useRef(false);

  const [planResult, setPlanResult] = useState<SMARTPlan | null>(null);
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [barrierDraftResult, setBarrierDraftResult] = useState<BarrierDraftSelection | null>(null);
  const [moreLikeThisLoading, setMoreLikeThisLoading] = useState(false);
  const lastPlanMetadataRef = useRef<SMARTPlan['metadata'] | null>(null);

  const [feedbackRating, setFeedbackRating] = useState<FeedbackRating>(null);
  const [currentFeedbackId, setCurrentFeedbackId] = useState<string | null>(null);
  const aiGeneratedActionRef = useRef<string>('');
  const [showFeedbackUI, setShowFeedbackUI] = useState(false);
  const autoLoadInFlightRef = useRef(false);

  const resetFeedbackState = useCallback(() => {
    setShowFeedbackUI(false);
    setFeedbackRating(null);
    setCurrentFeedbackId(null);
    aiGeneratedActionRef.current = '';
  }, []);

  const clearBarrierDraftState = useCallback(() => {
    setBarrierDraftResult(null);
    setPlanResult(null);
    setShowPlanPicker(false);
    setMoreLikeThisLoading(false);
    lastPlanMetadataRef.current = null;
  }, []);

  const getPlanRuntimeMeta = useCallback((plan?: SMARTPlan | null) => {
    const runtime = plan?.metadata.runtime || (storage.aiDraftMode === 'template' ? 'template' : llm.activeRuntime || 'browser');
    const runtimeBackend = plan?.metadata.runtime_backend || plan?.metadata.backend || llm.activeBackend || runtime;
    return { runtime, runtimeBackend };
  }, [llm.activeBackend, llm.activeRuntime, storage.aiDraftMode]);

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

  useEffect(() => {
    if (llm.classifiedError) {
      toast({
        title: llm.classifiedError.title,
        description: llm.classifiedError.message,
        variant: 'destructive',
      });
    }
  }, [llm.classifiedError, toast]);

  const autoLoadPreferredRuntime = useCallback(async () => {
    if (
      autoLoadInFlightRef.current ||
      storage.aiDraftMode !== 'ai' ||
      llm.isLoading ||
      llm.isReady ||
      llm.isGenerating ||
      llm.isMobile
    ) {
      return;
    }

    autoLoadInFlightRef.current = true;
    try {
      await llm.loadModel(storage.preferredLLMModel);
    } catch {
      // Best-effort warmup only.
    } finally {
      autoLoadInFlightRef.current = false;
    }
  }, [llm, storage.aiDraftMode, storage.preferredLLMModel]);

  useEffect(() => {
    if (
      storage.aiDraftMode !== 'ai' ||
      llm.isMobile ||
      isLLMReady ||
      isLLMLoading
    ) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      if (storage.aiDraftRuntime === 'browser' && isModelCached === true) {
        void preloadIfCached().catch(() => undefined);
        return;
      }
      void autoLoadPreferredRuntime();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    autoLoadPreferredRuntime,
    isLLMLoading,
    isLLMReady,
    isModelCached,
    llm.isMobile,
    preloadIfCached,
    storage.aiDraftMode,
    storage.aiDraftRuntime,
  ]);

  useEffect(() => {
    const draftable = mode === 'now'
      ? Boolean(nowForm.forename.trim() && nowForm.barrier.trim())
      : Boolean(taskBasedForm.forename.trim() && taskBasedForm.task.trim());

    if (!draftable) return;
    void autoLoadPreferredRuntime();
  }, [
    autoLoadPreferredRuntime,
    mode,
    nowForm.barrier,
    nowForm.forename,
    taskBasedForm.forename,
    taskBasedForm.task,
  ]);

  useEffect(() => {
    clearBarrierDraftState();
    resetFeedbackState();
  }, [clearBarrierDraftState, resetFeedbackState, mode, nowForm.barrier, nowForm.forename, taskBasedForm.task, taskBasedForm.forename]);

  const templateDraftNow = useCallback(() => {
    clearBarrierDraftState();
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
  }, [clearBarrierDraftState, nowForm, suggestQuery, setNowForm, toast]);

  const templateDraftTaskBased = useCallback(() => {
    clearBarrierDraftState();
    const outcome = aiDraftFuture(taskBasedForm.task, taskBasedForm.forename);
    setTaskBasedForm(prev => ({ ...prev, outcome }));
    toast({ title: 'Draft inserted', description: 'Template draft added. Edit as needed.' });
  }, [clearBarrierDraftState, taskBasedForm, setTaskBasedForm, toast]);

  const handleFeedbackRate = useCallback((rating: FeedbackRating) => {
    setFeedbackRating(rating);
    if (!currentFeedbackId) return;

    storage.updateFeedback(currentFeedbackId, { rating });

    const signal = rating === 'relevant'
      ? 'feedback_relevant'
      : rating === 'not-relevant'
        ? 'feedback_not_relevant'
        : 'feedback_cleared';

    logDraftAnalytics({
      timestamp: new Date().toISOString(),
      signal,
      barrier: mode === 'now' ? nowForm.barrier : taskBasedForm.task || undefined,
      barrier_type: barrierDraftResult?.barrierType,
      generated_text: aiGeneratedActionRef.current || (mode === 'now' ? nowForm.action : taskBasedForm.outcome) || undefined,
      feedback_rating: rating,
      source: 'ai',
      runtime: lastPlanMetadataRef.current?.runtime,
      runtime_backend: lastPlanMetadataRef.current?.runtime_backend,
    });
  }, [
    barrierDraftResult?.barrierType,
    currentFeedbackId,
    lastPlanMetadataRef,
    mode,
    nowForm.action,
    nowForm.barrier,
    storage,
    taskBasedForm.outcome,
    taskBasedForm.task,
  ]);

  const buildFeedbackPromptContext = useCallback((
    barrier: string,
    forename: string,
    targetDate: string,
    feedback?: DraftFeedbackContext,
  ) => {
    const currentActionKey = normaliseActionKey(feedback?.currentActionText);

    const exemplars = retrieveExemplars(barrier, storage.actionFeedback, 3)
      .filter(example => !currentActionKey || normaliseActionKey(example.action) !== currentActionKey);
    const rejectedExemplars = retrieveRejectedExemplars(barrier, storage.actionFeedback, 3)
      .filter(example => !currentActionKey || normaliseActionKey(example.action) !== currentActionKey);

    let currentFeedbackInstruction = '';
    const currentActionText = feedback?.currentActionText?.trim();

    if (feedback?.isRegenerate && currentActionText && feedback.currentRating === 'relevant') {
      currentFeedbackInstruction = [
        'CURRENT FEEDBACK:',
        'The current action was marked relevant.',
        `Keep the same level of barrier fit and specificity, but produce a genuinely different alternative from this action: "${currentActionText}".`,
        'Do not lightly rephrase it or repeat the same task, metric, or support step.',
      ].join('\n');
    } else if (feedback?.isRegenerate && currentActionText && feedback.currentRating === 'not-relevant') {
      currentFeedbackInstruction = [
        'CURRENT FEEDBACK:',
        'The current action was marked not relevant.',
        `Do not repeat this action or a close variation: "${currentActionText}".`,
        'Choose a materially different next step that addresses the barrier more directly.',
      ].join('\n');
    }

    return {
      currentFeedbackInstruction,
      exemplarContext: formatExemplarsForPrompt(exemplars, forename, targetDate),
      rejectedContext: formatRejectedExemplarsForPrompt(rejectedExemplars, forename, targetDate),
    };
  }, [storage.actionFeedback]);

  const filterRegeneratedActions = useCallback((
    actions: SMARTAction[],
    request: DraftRequestContext,
    feedback?: DraftFeedbackContext,
  ): SMARTAction[] => {
    if (!feedback?.isRegenerate || !feedback.currentActionText || !feedback.currentRating) {
      return actions;
    }

    const distinctActions = selectAlternateActions(
      actions,
      request.barrier,
      feedback.currentActionText,
      request.forename,
      request.timescale,
    );

    return distinctActions.length > 0 ? distinctActions : actions;
  }, []);

  const buildNowDraftRequest = useCallback((options?: {
    draftMode?: 'primary' | 'alternates';
    retryReason?: string;
    primaryActionText?: string;
    currentActionText?: string;
    currentRating?: FeedbackRating;
    isRegenerate?: boolean;
  }): DraftRequestContext => {
    const barrier = nowForm.barrier;
    const forename = nowForm.forename;
    const timescale = nowForm.timescale || '2 weeks';
    const targetDate = formatDDMMMYY(parseTimescaleToTargetISO(nowForm.date, timescale));
    const barrierContext = createBarrierDraftContext(barrier);
    const {
      currentFeedbackInstruction,
      exemplarContext,
      rejectedContext,
    } = buildFeedbackPromptContext(barrier, forename, targetDate, options);

    const focusInstruction = options?.draftMode === 'alternates'
      ? `Generate alternate actions that still address the same barrier but avoid repeating this action: ${options.primaryActionText || 'the current action'}.`
      : 'Generate options where the first action is the single best next step for this barrier.';

    const retryInstruction = options?.retryReason
      ? `Previous draft problem: ${options.retryReason}`
      : '';

    const input: RawUserInput = {
      goal: `Barrier-first support for ${forename}: reduce ${barrierContext.barrierSummary}`,
      barriers: barrier,
      timeframe: timescale,
      situation: [
        `Employment advisor helping ${forename} with "${barrierContext.barrierSummary}".`,
        `Barrier type: ${barrierContext.barrierType}.`,
        focusInstruction,
        'Keep the first action barrier-specific, small enough to start now, and stronger than generic job-search advice.',
        retryInstruction,
        currentFeedbackInstruction,
        exemplarContext,
        rejectedContext,
      ].filter(Boolean).join('\n\n'),
      participant_name: forename,
      supporter: nowForm.responsible,
      selected_barrier_id: barrier,
      selected_barrier_label: barrier,
    };

    return {
      input,
      barrier,
      barrierId: input.selected_barrier_id,
      forename,
      timescale,
    };
  }, [buildFeedbackPromptContext, nowForm]);

  const buildFutureDraftRequest = useCallback((options?: DraftFeedbackContext): DraftRequestContext => {
    const barrier = taskBasedForm.task || '';
    const forename = taskBasedForm.forename;
    const timescale = taskBasedForm.timescale || '4 weeks';
    const targetDate = formatDDMMMYY(parseTimescaleToTargetISO(taskBasedForm.date, timescale));
    const taskSuggestions = getTaskSuggestions(taskBasedForm.task);
    const taskExemplarContext = formatTaskExemplarsForPrompt(taskSuggestions, forename);
    const {
      currentFeedbackInstruction,
      exemplarContext,
      rejectedContext,
    } = buildFeedbackPromptContext(barrier, forename, targetDate, options);

    const input: RawUserInput = {
      goal: taskBasedForm.task,
      timeframe: timescale,
      situation: [
        `Employment advisor helping ${forename} attend a future activity. Describe what ${forename} will realistically gain DURING or AFTER this activity — not preparation done beforehand.`,
        currentFeedbackInstruction,
        taskExemplarContext,
        exemplarContext,
        rejectedContext,
      ].filter(Boolean).join('\n\n'),
      participant_name: forename,
      supporter: taskBasedForm.responsible,
      generation_mode: 'outcome',
    };

    return {
      input,
      barrier,
      barrierId: input.selected_barrier_id,
      forename,
      timescale,
    };
  }, [buildFeedbackPromptContext, taskBasedForm]);

  const applyDraftAction = useCallback((action: SMARTAction, options: ApplyDraftActionOptions) => {
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

    aiGeneratedActionRef.current = action.action;
    setFeedbackRating(null);
    setCurrentFeedbackId(null);
    setShowFeedbackUI(true);

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

    const signal = options.draftMode === 'primary' && options.selectedIndex === undefined
      ? 'accepted'
      : 'selected';

    logDraftAnalytics({
      timestamp: new Date().toISOString(),
      signal,
      barrier: mode === 'now' ? nowForm.barrier : undefined,
      barrier_type: options.draftMeta?.barrierType,
      selected_index: options.selectedIndex,
      generated_text: action.action,
      relevance_score: options.draftMeta?.relevanceScore,
      draft_mode: options.draftMode,
      source: options.source || 'ai',
      runtime: lastPlanMetadataRef.current?.runtime,
      runtime_backend: lastPlanMetadataRef.current?.runtime_backend,
    });

    setShowPlanPicker(false);
    setPlanResult(null);
    toast({ title: 'Action applied', description: options.toastDescription });
  }, [
    mode,
    nowForm.barrier,
    nowForm.forename,
    nowForm.timescale,
    taskBasedForm.task,
    taskBasedForm.forename,
    taskBasedForm.timescale,
    setNowForm,
    setTaskBasedForm,
    storage,
    toast,
  ]);

  const handleSelectPlanAction = useCallback((action: SMARTAction, selectedIndex?: number) => {
    const selectionMode = mode === 'now' ? 'alternates' : 'primary';
    const selectedSource =
      (planResult?.metadata as { source?: string } | undefined)?.source === 'template_fallback'
        ? 'template'
        : 'ai';
    applyDraftAction(action, {
      draftMode: selectionMode,
      selectedIndex,
      draftMeta: barrierDraftResult,
      source: selectedSource,
      toastDescription: mode === 'now'
        ? 'Alternative SMART action added. Edit as needed.'
        : 'SMART action added to form. Edit as needed.',
    });

    if (mode === 'now') {
      setBarrierDraftResult(prev => prev
        ? {
            ...prev,
            primaryAction: action,
            alternates: prev.alternates.filter(candidate => candidate.action !== action.action),
          }
        : prev);
    }
  }, [applyDraftAction, barrierDraftResult, mode, planResult]);

  const resolvePrimaryBarrierDraft = useCallback(async (feedback?: DraftFeedbackContext): Promise<{
    request: DraftRequestContext;
    plan: SMARTPlan;
    selection: BarrierDraftSelection;
  }> => {
    const request = buildNowDraftRequest({ draftMode: 'primary', ...feedback });
    const plan = await llm.generatePlan(request.input, { profile: 'primary_draft' });
    const candidateActions = filterRegeneratedActions(plan.actions, request, feedback);
    const selection = selectPrimaryBarrierDraft(candidateActions, request.barrier, request.forename, request.timescale);

    if (!selection) {
      throw new Error('Plan generation returned no actions.');
    }

    if (!selection.relevance.isRelevant || selection.relevanceScore < PRIMARY_RELEVANCE_THRESHOLD) {
      throw new Error(selection.relevance.reason || 'Generated action was not relevant enough.');
    }

    return { request, plan, selection };
  }, [buildNowDraftRequest, filterRegeneratedActions, llm]);

  const handleMoreLikeThis = useCallback(async () => {
    if (mode !== 'now' || !barrierDraftResult) return;

    logDraftAnalytics({
      timestamp: new Date().toISOString(),
      signal: 'more_like_this',
      barrier: nowForm.barrier,
      barrier_type: barrierDraftResult.barrierType,
      draft_mode: 'alternates',
      source: 'ai',
      runtime: lastPlanMetadataRef.current?.runtime,
      runtime_backend: lastPlanMetadataRef.current?.runtime_backend,
    });

    const cachedAlternates = barrierDraftResult.alternates;
    if (cachedAlternates.length >= 2 && lastPlanMetadataRef.current) {
      setPlanResult({
        actions: cachedAlternates,
        metadata: lastPlanMetadataRef.current,
      });
      setShowPlanPicker(true);
      return;
    }

    if (!llm.isReady) {
      void autoLoadPreferredRuntime();
      return;
    }

    setMoreLikeThisLoading(true);
    try {
      const request = buildNowDraftRequest({
        draftMode: 'alternates',
        primaryActionText: barrierDraftResult.primaryAction.action,
      });
      const plan = await llm.generatePlan(request.input, { profile: 'alternate_drafts' });
      const isTemplateFallback =
        (plan.metadata as { source?: string } | undefined)?.source === 'template_fallback';
      const alternates = selectAlternateActions(
        plan.actions,
        request.barrier,
        barrierDraftResult.primaryAction.action,
        request.forename,
        request.timescale,
      );

      if (alternates.length === 0) {
        toast({
          title: 'No strong alternates found',
          description: 'The AI could not find more relevant alternatives for this barrier yet.',
          variant: 'destructive',
        });
        scheduleSafariModelUnload();
        return;
      }

      lastPlanMetadataRef.current = plan.metadata;
      setBarrierDraftResult(prev => prev ? { ...prev, alternates } : prev);
      setPlanResult({ ...plan, actions: alternates });
      setShowPlanPicker(true);

      logDraftAnalytics({
        timestamp: new Date().toISOString(),
        signal: 'generated',
        barrier: nowForm.barrier,
        barrier_id: request.barrierId,
        barrier_type: barrierDraftResult.barrierType,
        actions_count: alternates.length,
        draft_mode: 'alternates',
        source: isTemplateFallback ? 'template' : 'ai',
        runtime: plan.metadata.runtime,
        runtime_backend: plan.metadata.runtime_backend,
      });

      scheduleSafariModelUnload();
    } catch (err) {
      console.warn('Alternate AI draft generation failed:', err);
      toast({
        title: 'More like this failed',
        description: 'Try AI Draft again to refresh the main suggestion.',
        variant: 'destructive',
      });
      scheduleSafariModelUnload(0);
    } finally {
      setMoreLikeThisLoading(false);
    }
  }, [
    barrierDraftResult,
    buildNowDraftRequest,
    llm,
    mode,
    nowForm.barrier,
    scheduleSafariModelUnload,
    toast,
  ]);

  const handleAIDraft = useCallback(async () => {
    if (mode === 'now') {
      if (!nowForm.forename.trim() || !nowForm.barrier.trim()) {
        toast({ title: 'Missing info', description: 'Add a forename and barrier first.', variant: 'destructive' });
        return;
      }
    } else if (!taskBasedForm.forename.trim() || !taskBasedForm.task.trim()) {
      toast({ title: 'Missing info', description: 'Add a forename and task first.', variant: 'destructive' });
      return;
    }

    if (storage.aiDraftMode === 'template') {
      if (mode === 'now') templateDraftNow();
      else templateDraftTaskBased();
      return;
    }

    if (llm.isMobile && !llm.canUseLocalAI) {
      if (mode === 'now') templateDraftNow();
      else templateDraftTaskBased();
      toast({
        title: 'Smart templates applied',
        description: 'Local AI is disabled on mobile/iPad by default. Enable it in Settings (Experimental) to use Local AI.',
      });
      return;
    }

    if (!llm.isReady) {
      pendingAIDraftRef.current = true;
      void autoLoadPreferredRuntime();
      return;
    }

    const feedbackContext: DraftFeedbackContext | undefined = aiGeneratedActionRef.current
      ? {
          currentActionText: (mode === 'now' ? nowForm.action : taskBasedForm.outcome) || aiGeneratedActionRef.current,
          currentRating: feedbackRating,
          isRegenerate: true,
        }
      : undefined;

    if (feedbackContext?.isRegenerate) {
      logDraftAnalytics({
        timestamp: new Date().toISOString(),
        signal: 'regenerated',
        barrier: mode === 'now' ? nowForm.barrier : undefined,
        barrier_type: barrierDraftResult?.barrierType,
        feedback_rating: feedbackContext.currentRating ?? null,
        draft_mode: 'primary',
        source: 'ai',
        runtime: lastPlanMetadataRef.current?.runtime,
        runtime_backend: lastPlanMetadataRef.current?.runtime_backend,
      });
    }

    setAIDrafting(true);
    try {
      if (mode === 'now') {
        const { request, plan, selection } = await resolvePrimaryBarrierDraft(feedbackContext);
        const isTemplateFallback =
          (plan.metadata as { source?: string } | undefined)?.source === 'template_fallback';
        const runtimeMeta = getPlanRuntimeMeta(plan);
        lastPlanMetadataRef.current = plan.metadata;
        setBarrierDraftResult(selection);

        logDraftAnalytics({
          timestamp: new Date().toISOString(),
          signal: 'generated',
          barrier: nowForm.barrier,
          barrier_id: request.barrierId,
          barrier_type: selection.barrierType,
          actions_count: selection.candidateCount,
          generated_text: selection.primaryAction.action,
          relevance_score: selection.relevanceScore,
          draft_mode: 'primary',
          source: isTemplateFallback ? 'template' : 'ai',
          runtime: runtimeMeta.runtime,
          runtime_backend: runtimeMeta.runtimeBackend,
        });

        applyDraftAction(selection.primaryAction, {
          draftMode: 'primary',
          draftMeta: selection,
          source: isTemplateFallback ? 'template' : 'ai',
          toastDescription: isTemplateFallback
            ? 'Best-fit smart template added. Use More like this for alternatives.'
            : 'Best-fit SMART action added. Use More like this for alternatives.',
        });

        scheduleSafariModelUnload();
        return;
      }

      const request = buildFutureDraftRequest(feedbackContext);
      const plan = await llm.generatePlan(request.input, { profile: 'primary_draft' });
      const isTemplateFallback =
        (plan.metadata as { source?: string } | undefined)?.source === 'template_fallback';
      const runtimeMeta = getPlanRuntimeMeta(plan);
      lastPlanMetadataRef.current = plan.metadata;

      logDraftAnalytics({
        timestamp: new Date().toISOString(),
        signal: 'generated',
        actions_count: plan.actions.length,
        draft_mode: 'primary',
        source: isTemplateFallback ? 'template' : 'ai',
        runtime: runtimeMeta.runtime,
        runtime_backend: runtimeMeta.runtimeBackend,
      });

      const candidateActions = filterRegeneratedActions(plan.actions, request, feedbackContext);
      const rankedActions = rankActionsByRelevance(
        candidateActions,
        request.barrier,
        request.forename,
        request.timescale,
      );
      const rankedPlan = { ...plan, actions: rankedActions };

      if (rankedPlan.actions.length === 1) {
        applyDraftAction(rankedPlan.actions[0], {
          draftMode: 'primary',
          source: isTemplateFallback ? 'template' : 'ai',
          toastDescription: isTemplateFallback
            ? 'Smart template added. Edit as needed.'
            : 'SMART action added to form. Edit as needed.',
        });
      } else if (rankedPlan.actions.length > 1) {
        setPlanResult(rankedPlan);
        setShowPlanPicker(true);
      } else {
        throw new Error('Plan generation returned no actions.');
      }

      scheduleSafariModelUnload();
    } catch (err) {
      const isTimeoutError = err instanceof Error && /timed out/i.test(err.message);
      if (isTimeoutError) {
        console.warn('SmartPlanner draft timed out; keeping AI mode enabled for retry:', err);
        toast({
          title: 'AI draft timed out',
          description: 'The built-in model is still warming up. Try drafting again to use Local AI.',
          variant: 'destructive',
        });
        scheduleSafariModelUnload(0);
        return;
      }

      console.warn('SmartPlanner draft failed, falling back to templates:', err);
      clearBarrierDraftState();
      if (mode === 'now') {
        let timescale = nowForm.timescale;
        if (!timescale) timescale = '2 weeks';
        const { action, help } = aiDraftNow(
          nowForm.barrier,
          nowForm.forename,
          nowForm.responsible,
          timescale,
          nowForm.date,
          suggestQuery,
        );
        setNowForm(prev => ({ ...prev, action, help, timescale }));
      } else {
        const outcome = aiDraftFuture(taskBasedForm.task, taskBasedForm.forename);
        setTaskBasedForm(prev => ({ ...prev, outcome }));
      }
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
  }, [
    aiGeneratedActionRef,
    applyDraftAction,
    autoLoadPreferredRuntime,
    barrierDraftResult,
    buildFutureDraftRequest,
    clearBarrierDraftState,
    feedbackRating,
    filterRegeneratedActions,
    getPlanRuntimeMeta,
    llm,
    mode,
    nowForm,
    resolvePrimaryBarrierDraft,
    scheduleSafariModelUnload,
    setNowForm,
    setTaskBasedForm,
    storage.aiDraftMode,
    suggestQuery,
    taskBasedForm,
    templateDraftNow,
    templateDraftTaskBased,
    toast,
  ]);

  useEffect(() => {
    if (llm.isReady && pendingAIDraftRef.current) {
      pendingAIDraftRef.current = false;
      handleAIDraft();
    }
  }, [llm.isReady, handleAIDraft]);

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
    }

    const parts: string[] = [];
    if (taskBasedForm.forename) parts.push(`Participant: ${taskBasedForm.forename}`);
    if (taskBasedForm.task) parts.push(`Activity/event: ${taskBasedForm.task}`);
    if (taskBasedForm.responsible) parts.push(`Who is responsible: ${taskBasedForm.responsible}`);
    if (taskBasedForm.outcome) parts.push(`Expected outcome: ${taskBasedForm.outcome}`);
    if (taskBasedForm.timescale) parts.push(`Review in: ${taskBasedForm.timescale}`);
    return parts.length > 0
      ? `Help me improve this task-based SMART action:\n\n${parts.join('\n')}\n\nHow can I make this more specific and measurable?`
      : 'Help me create a task-based SMART action for a future activity or event.';
  }, [mode, nowForm, taskBasedForm]);

  const handleWizardAIDraft = useCallback(async (field: string, context: Record<string, string>): Promise<string> => {
    if (storage.aiDraftMode === 'ai' && !llm.isReady) {
      if (llm.canUseLocalAI) {
        pendingAIDraftRef.current = true;
        void autoLoadPreferredRuntime();
        toast({ title: 'Preparing AI draft', description: 'Local AI is warming up in the background.' });
        return '';
      }
      toast({
        title: 'Using smart templates',
        description: 'Local AI is not available on this device. Using templates instead.',
      });
    }

    if (llm.isReady) {
      try {
        const input: RawUserInput = {
          goal: context.barrier ? 'Find suitable employment' : (context.task || 'Employment support'),
          barriers: context.barrier,
          timeframe: context.timescale || '2 weeks',
          situation: `Helping ${context.forename || 'participant'}`,
          participant_name: context.forename,
          supporter: context.responsible,
          selected_barrier_id: context.barrier,
          selected_barrier_label: context.barrier,
          ...(field === 'outcome' ? { generation_mode: 'outcome' as const } : {}),
        };
        const plan = await llm.generatePlan(input, { profile: 'primary_draft' });
        const isTemplateFallback =
          (plan.metadata as { source?: string } | undefined)?.source === 'template_fallback';
        lastPlanMetadataRef.current = plan.metadata;
        const selected = context.barrier
          ? selectPrimaryBarrierDraft(plan.actions, context.barrier, context.forename, context.timescale || '2 weeks')?.primaryAction
          : plan.actions[0];

        if (selected) {
          scheduleSafariModelUnload();

          if (isTemplateFallback) {
            toast({ title: 'Smart template applied', description: 'AI used smart templates for this field.' });
          }

          if (field === 'action') return selected.action;
          if (field === 'help') return selected.first_step || selected.rationale;
          if (field === 'outcome') return selected.action;
        }

        scheduleSafariModelUnload();
        toast({ title: 'Using smart templates', description: 'AI returned no actions. Using templates instead.' });
      } catch (err) {
        console.warn('SmartPlanner wizard draft failed, falling back to templates:', err);
        toast({ title: 'Using smart templates', description: 'AI generation failed. Applied templates instead.', variant: 'destructive' });
        scheduleSafariModelUnload(0);
      }
    }

    if (mode === 'now') {
      const timescale = context.timescale || '2 weeks';
      if (field === 'action' || field === 'help') {
        const { action, help } = aiDraftNow(
          context.barrier || '',
          context.forename || '',
          context.responsible || 'Advisor',
          timescale,
          nowForm.date,
        );
        return field === 'action' ? action : help;
      }
    } else if (field === 'outcome') {
      return aiDraftFuture(context.task || '', context.forename || '');
    }
    return '';
  }, [autoLoadPreferredRuntime, mode, nowForm.date, llm, scheduleSafariModelUnload, storage.aiDraftMode, toast]);

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
    barrierDraftResult,
    moreLikeThisLoading,
    canShowMoreLikeThis: mode === 'now' && !!barrierDraftResult,
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
    handleMoreLikeThis,
    buildLLMContext,
    handleWizardAIDraft,
    promptPack,
    promptPackSource,
  };
}
