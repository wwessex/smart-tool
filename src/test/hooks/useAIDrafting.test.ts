import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAIDrafting } from "@/hooks/useAIDrafting";

const {
  mockToast,
  mockGeneratePlan,
  mockLogDraftAnalytics,
  mockPreloadIfCached,
  mockLoadModel,
  llmReadyRef,
  llmLoadingRef,
  llmCachedRef,
  activeRuntimeRef,
  activeBackendRef,
} = vi.hoisted(() => ({
  mockToast: vi.fn(),
  mockGeneratePlan: vi.fn(),
  mockLogDraftAnalytics: vi.fn(),
  mockPreloadIfCached: vi.fn(),
  mockLoadModel: vi.fn(),
  llmReadyRef: { value: true },
  llmLoadingRef: { value: false },
  llmCachedRef: { value: false },
  activeRuntimeRef: { value: "browser" as "browser" | "desktop-helper" | "template" },
  activeBackendRef: { value: "wasm-basic" },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/hooks/usePromptPack", () => ({
  usePromptPack: () => ({ pack: null, source: "default", error: null }),
}));

vi.mock("@/hooks/useBrowserNativeLLM", () => ({
  useBrowserNativeLLM: () => ({
    isReady: llmReadyRef.value,
    isGenerating: false,
    isLoading: llmLoadingRef.value,
    isCached: llmCachedRef.value,
    isMobile: false,
    canUseLocalAI: true,
    activeRuntime: activeRuntimeRef.value,
    activeBackend: activeBackendRef.value,
    helperStatus: "ready",
    helperMessage: null,
    helperBackend: null,
    browserInfo: { isSafari: false },
    deviceInfo: { isIOS: false },
    classifiedError: null,
    clearError: vi.fn(),
    unload: vi.fn(),
    loadModel: mockLoadModel,
    preloadIfCached: mockPreloadIfCached,
    generatePlan: mockGeneratePlan,
    lastDebugLog: null,
  }),
}));

vi.mock("@/lib/smart-retrieval", () => ({
  retrieveExemplars: () => [],
  formatExemplarsForPrompt: () => "",
  retrieveRejectedExemplars: () => [],
  formatRejectedExemplarsForPrompt: () => "",
  formatTaskExemplarsForPrompt: () => "",
}));

vi.mock("@/lib/draft-analytics", () => ({
  logDraftAnalytics: mockLogDraftAnalytics,
}));

vi.mock("@/lib/smart-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/smart-utils")>("@/lib/smart-utils");
  return {
    ...actual,
    parseTimescaleToTargetISO: vi.fn().mockReturnValue("2026-04-24"),
    formatDDMMMYY: vi.fn().mockReturnValue("24-Apr-26"),
  };
});

const primaryPlan = {
  actions: [
    {
      action: "Mark will update his CV with two STAR examples for warehouse roles and send it to his advisor by 24-Apr-26.",
      metric: "1 tailored CV sent",
      baseline: "CV not tailored",
      target: "Tailored CV ready to use",
      deadline: "2026-04-24",
      rationale: "A stronger CV helps Mark apply for suitable roles",
      effort_estimate: "45 minutes",
      first_step: "Open current CV and list two recent achievements",
    },
  ],
  metadata: {
    model_id: "test-model",
    model_version: "0.1.0",
    backend: "wasm-basic" as const,
    runtime: "browser" as const,
    runtime_backend: "wasm-basic",
    retrieval_pack_version: "1.0.0",
    generated_at: new Date().toISOString(),
    generation_time_ms: 120,
    tokens_generated: 180,
    generation_profile: "primary_draft" as const,
    repair_attempts: 0,
  },
};

const alternatePlan = {
  actions: [
    {
      action: "Mark will tailor his CV to two warehouse vacancies and email the draft to his advisor by 24-Apr-26.",
      metric: "2 tailored CV versions completed",
      baseline: "No tailored versions",
      target: "2 role-specific CV versions ready",
      deadline: "2026-04-24",
      rationale: "Tailored applications improve shortlist chances",
      effort_estimate: "1 hour",
      first_step: "Save two vacancy adverts for reference",
    },
    {
      action: "Mark will add three quantified achievements to his CV and review the wording with his advisor by 24-Apr-26.",
      metric: "3 quantified achievements added",
      baseline: "Achievements not quantified",
      target: "CV includes clear evidence",
      deadline: "2026-04-24",
      rationale: "Evidence-based CVs are stronger",
      effort_estimate: "30 minutes",
      first_step: "Highlight three measurable outcomes from recent work",
    },
    {
      action: "Mark will rewrite his personal profile for warehouse roles and read it aloud with his advisor by 24-Apr-26.",
      metric: "1 role-specific profile completed",
      baseline: "Profile is generic",
      target: "Profile matches warehouse roles",
      deadline: "2026-04-24",
      rationale: "A targeted profile strengthens applications",
      effort_estimate: "30 minutes",
      first_step: "List the top three qualities warehouse employers ask for",
    },
  ],
  metadata: {
    model_id: "test-model",
    model_version: "0.1.0",
    backend: "wasm-basic" as const,
    runtime: "browser" as const,
    runtime_backend: "wasm-basic",
    retrieval_pack_version: "1.0.0",
    generated_at: new Date().toISOString(),
    generation_time_ms: 160,
    tokens_generated: 220,
    generation_profile: "alternate_drafts" as const,
    repair_attempts: 0,
  },
};

const retryPlan = {
  actions: [
    {
      action: "Mark will research bus routes to the industrial estate and save the timetable by 24-Apr-26.",
      metric: "1 route saved",
      baseline: "No route saved",
      target: "Reliable route confirmed",
      deadline: "2026-04-24",
      rationale: "Transport planning reduces missed appointments",
      effort_estimate: "20 minutes",
      first_step: "Check the local bus website",
    },
  ],
  metadata: {
    model_id: "test-model",
    model_version: "0.1.0",
    backend: "wasm-basic" as const,
    runtime: "browser" as const,
    runtime_backend: "wasm-basic",
    retrieval_pack_version: "1.0.0",
    generated_at: new Date().toISOString(),
    generation_time_ms: 140,
    tokens_generated: 190,
    generation_profile: "primary_draft" as const,
    repair_attempts: 1,
  },
};

const repairedPrimaryPlan = {
  ...primaryPlan,
  metadata: {
    ...primaryPlan.metadata,
    repair_attempts: 1,
  },
};

function createHook() {
  const setNowForm = vi.fn();
  const setTaskBasedForm = vi.fn();

  const hook = renderHook(() => useAIDrafting({
    mode: "now",
    nowForm: {
      date: "2026-04-17",
      time: "",
      forename: "Mark",
      barrier: "CV",
      action: "",
      responsible: "Advisor",
      help: "",
      timescale: "2 weeks",
    },
    taskBasedForm: {
      date: "2026-04-17",
      forename: "",
      task: "",
      responsible: "",
      outcome: "",
      timescale: "",
    },
    setNowForm,
    setTaskBasedForm,
    suggestQuery: "",
    storage: {
      aiDraftMode: "ai",
      aiDraftRuntime: "auto",
      keepSafariModelLoaded: false,
      allowMobileLLM: true,
      safariWebGPUEnabled: true,
      preferredLLMModel: "amor-inteligente-built-in",
      actionFeedback: [],
      addFeedback: vi.fn().mockReturnValue({ id: "feedback-1" }),
      updateFeedback: vi.fn(),
    },
  }));

  return { ...hook, setNowForm, setTaskBasedForm };
}

function createStatefulHook(storageOverrides: Partial<Parameters<typeof useAIDrafting>[0]["storage"]> = {}) {
  const storage = {
    aiDraftMode: "ai" as const,
    aiDraftRuntime: "auto" as const,
    keepSafariModelLoaded: false,
    allowMobileLLM: true,
    safariWebGPUEnabled: true,
    preferredLLMModel: "amor-inteligente-built-in",
    actionFeedback: [],
    addFeedback: vi.fn().mockReturnValue({ id: "feedback-1" }),
    updateFeedback: vi.fn(),
    ...storageOverrides,
  };

  const hook = renderHook(() => {
    const [nowForm, setNowForm] = React.useState({
      date: "2026-04-17",
      time: "",
      forename: "Mark",
      barrier: "CV",
      action: "",
      responsible: "Advisor",
      help: "",
      timescale: "2 weeks",
    });
    const [taskBasedForm, setTaskBasedForm] = React.useState({
      date: "2026-04-17",
      forename: "",
      task: "",
      responsible: "",
      outcome: "",
      timescale: "",
    });

    return useAIDrafting({
      mode: "now",
      nowForm,
      taskBasedForm,
      setNowForm,
      setTaskBasedForm,
      suggestQuery: "",
      storage,
    });
  });

  return { ...hook, storage };
}

describe("useAIDrafting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    llmReadyRef.value = true;
    llmLoadingRef.value = false;
    llmCachedRef.value = false;
    activeRuntimeRef.value = "browser";
    activeBackendRef.value = "wasm-basic";
    mockLoadModel.mockResolvedValue(true);
  });

  it("auto-applies the best-fit primary action and exposes alternates", async () => {
    mockGeneratePlan
      .mockResolvedValueOnce(primaryPlan)
      .mockResolvedValueOnce(alternatePlan);
    const { result, setNowForm } = createHook();

    await act(async () => {
      await result.current.handleAIDraft();
    });

    expect(mockGeneratePlan).toHaveBeenCalledTimes(1);
    expect(mockGeneratePlan.mock.calls[0][1]).toEqual({ profile: "primary_draft" });
    expect(result.current.barrierDraftResult?.primaryAction.action).toContain("two STAR examples");
    expect(result.current.canShowMoreLikeThis).toBe(true);

    const update = setNowForm.mock.calls[0][0];
    expect(update({
      date: "2026-04-17",
      time: "",
      forename: "Mark",
      barrier: "CV",
      action: "",
      responsible: "Advisor",
      help: "",
      timescale: "2 weeks",
    })).toMatchObject({
      action: "Mark will update his CV with two STAR examples for warehouse roles and send it to his advisor by 24-Apr-26.",
    });

    await act(async () => {
      await result.current.handleMoreLikeThis();
    });

    expect(mockGeneratePlan).toHaveBeenCalledTimes(2);
    expect(mockGeneratePlan.mock.calls[1][1]).toEqual({ profile: "alternate_drafts" });
    expect(result.current.showPlanPicker).toBe(true);
    expect(result.current.planResult?.actions.length).toBeGreaterThanOrEqual(2);

    await act(async () => {
      await result.current.handleMoreLikeThis();
    });

    expect(mockGeneratePlan).toHaveBeenCalledTimes(2);
  });

  it("uses planner repair without a second top-level generatePlan call", async () => {
    mockGeneratePlan.mockResolvedValueOnce(repairedPrimaryPlan);

    const { result, setNowForm } = createHook();

    await act(async () => {
      await result.current.handleAIDraft();
    });

    expect(mockGeneratePlan).toHaveBeenCalledTimes(1);
    expect(mockGeneratePlan.mock.calls[0][1]).toEqual({ profile: "primary_draft" });
    expect(result.current.barrierDraftResult?.primaryAction.action).toContain("two STAR examples");

    const update = setNowForm.mock.calls[0][0];
    expect(update({
      date: "2026-04-17",
      time: "",
      forename: "Mark",
      barrier: "CV",
      action: "",
      responsible: "Advisor",
      help: "",
      timescale: "2 weeks",
    }).action).toContain("two STAR examples");
  });

  it("falls back to templates only after the capped primary retry path", async () => {
    mockGeneratePlan.mockResolvedValueOnce(retryPlan);

    const { result, setNowForm } = createHook();

    await act(async () => {
      await result.current.handleAIDraft();
    });

    expect(mockGeneratePlan).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Using smart templates",
      variant: "destructive",
    }));

    const update = setNowForm.mock.calls[0][0];
    expect(update({
      date: "2026-04-17",
      time: "",
      forename: "Mark",
      barrier: "CV",
      action: "",
      responsible: "Advisor",
      help: "",
      timescale: "2 weeks",
    }).action).toBeTruthy();
  });

  it("prewarms cached local AI only when AI mode is enabled", async () => {
    vi.useFakeTimers();
    llmReadyRef.value = false;
    llmCachedRef.value = true;
    mockPreloadIfCached.mockResolvedValue(true);

    createStatefulHook({ aiDraftRuntime: "browser" });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(mockPreloadIfCached).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("persists a null rating when the user untoggles feedback", async () => {
    mockGeneratePlan.mockResolvedValue(primaryPlan);
    const { result, storage } = createStatefulHook();

    await act(async () => {
      await result.current.handleAIDraft();
    });

    act(() => {
      result.current.handleFeedbackRate("relevant");
    });

    act(() => {
      result.current.handleFeedbackRate(null);
    });

    expect(storage.updateFeedback).toHaveBeenNthCalledWith(1, "feedback-1", { rating: "relevant" });
    expect(storage.updateFeedback).toHaveBeenNthCalledWith(2, "feedback-1", { rating: null });
  });

  it("passes an explicit avoid instruction on regenerate after thumbs down", async () => {
    mockGeneratePlan.mockResolvedValue(primaryPlan);
    const { result } = createStatefulHook();

    await act(async () => {
      await result.current.handleAIDraft();
    });

    act(() => {
      result.current.handleFeedbackRate("not-relevant");
    });

    await act(async () => {
      await result.current.handleAIDraft();
    });

    const secondInput = mockGeneratePlan.mock.calls[1][0];
    expect(secondInput.situation).toContain("The current action was marked not relevant.");
    expect(secondInput.situation).toContain("Do not repeat this action or a close variation");
    expect(secondInput.situation).toContain(primaryPlan.actions[0].action);
  });

  it("passes a distinct-variant instruction on regenerate after thumbs up", async () => {
    mockGeneratePlan.mockResolvedValue(primaryPlan);
    const { result } = createStatefulHook();

    await act(async () => {
      await result.current.handleAIDraft();
    });

    act(() => {
      result.current.handleFeedbackRate("relevant");
    });

    await act(async () => {
      await result.current.handleAIDraft();
    });

    const secondInput = mockGeneratePlan.mock.calls[1][0];
    expect(secondInput.situation).toContain("The current action was marked relevant.");
    expect(secondInput.situation).toContain("Do not lightly rephrase it");
    expect(secondInput.situation).toContain(primaryPlan.actions[0].action);
  });
});
