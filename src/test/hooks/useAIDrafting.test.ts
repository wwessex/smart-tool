import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAIDrafting } from "@/hooks/useAIDrafting";

const mockToast = vi.fn();
const mockGeneratePlan = vi.fn();
const mockLogDraftAnalytics = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock("@/hooks/usePromptPack", () => ({
  usePromptPack: () => ({ pack: null, source: "default", error: null }),
}));

vi.mock("@/hooks/useBrowserNativeLLM", () => ({
  useBrowserNativeLLM: () => ({
    isReady: true,
    isGenerating: false,
    isMobile: false,
    canUseLocalAI: true,
    browserInfo: { isSafari: false },
    deviceInfo: { isIOS: false },
    classifiedError: null,
    clearError: vi.fn(),
    unload: vi.fn(),
    generatePlan: mockGeneratePlan,
    lastDebugLog: null,
  }),
}));

vi.mock("@/lib/smart-retrieval", () => ({
  retrieveExemplars: () => [],
  formatExemplarsForPrompt: () => "",
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
  ],
  metadata: {
    model_id: "test-model",
    model_version: "0.1.0",
    backend: "wasm-basic" as const,
    retrieval_pack_version: "1.0.0",
    generated_at: new Date().toISOString(),
    generation_time_ms: 120,
    tokens_generated: 180,
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
    retrieval_pack_version: "1.0.0",
    generated_at: new Date().toISOString(),
    generation_time_ms: 140,
    tokens_generated: 190,
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

describe("useAIDrafting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("auto-applies the best-fit primary action and exposes alternates", async () => {
    mockGeneratePlan.mockResolvedValue(primaryPlan);
    const { result, setNowForm } = createHook();

    await act(async () => {
      await result.current.handleAIDraft();
    });

    expect(mockGeneratePlan).toHaveBeenCalledTimes(1);
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

    expect(result.current.showPlanPicker).toBe(true);
    expect(result.current.planResult?.actions.length).toBeGreaterThanOrEqual(2);
  });

  it("retries once when the first primary draft is not relevant enough", async () => {
    mockGeneratePlan
      .mockResolvedValueOnce(retryPlan)
      .mockResolvedValueOnce(primaryPlan);

    const { result, setNowForm } = createHook();

    await act(async () => {
      await result.current.handleAIDraft();
    });

    expect(mockGeneratePlan).toHaveBeenCalledTimes(2);
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
});
