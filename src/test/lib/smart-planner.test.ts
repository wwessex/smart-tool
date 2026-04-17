import { describe, expect, it, vi } from "vitest";
import { SmartPlanner, type ActionTemplate, type RawUserInput } from "@smart-tool/browser-native-llm";

function createTemplate(id: string, stage: ActionTemplate["stage"], actionTemplate: string): ActionTemplate {
  return {
    id,
    stage,
    action_template: actionTemplate,
    metric_template: "1 completed action",
    effort_hint: "30 minutes",
    tags: ["cv", "warehouse"],
    relevant_barriers: ["CV"],
    min_confidence: 1,
    source_attribution: "test",
  };
}

function createAction(action: string) {
  return {
    action,
    metric: "1 tailored CV completed",
    baseline: "CV is not tailored",
    target: "Tailored CV ready to use",
    deadline: "2026-04-24",
    rationale: "A stronger CV helps with applications",
    effort_estimate: "30 minutes",
    first_step: "Open the current CV and highlight two achievements",
  };
}

function createPlanner(runInferenceImpl: () => Promise<string>) {
  const templates = [
    createTemplate("cv-1", "cv_preparation", "Update CV with two measurable warehouse examples"),
    createTemplate("cv-2", "applications", "Tailor CV to one warehouse vacancy"),
    createTemplate("cv-3", "interviewing", "Review the tailored CV before the next employer contact"),
  ];

  const planner = new SmartPlanner({
    inference: {
      model_id: "test-model",
      model_base_url: "./models/test/",
      max_seq_length: 1024,
      max_new_tokens: 512,
      temperature: 0.5,
      top_p: 0.85,
      repetition_penalty: 1.3,
    },
    retrieval_pack_url: "./retrieval-pack.json",
    worker_url: "./worker.js",
  }) as SmartPlanner & {
    initialized: boolean;
    worker: object | null;
    retriever: { retrieve: ReturnType<typeof vi.fn> } | null;
    runInference: ReturnType<typeof vi.fn>;
    library: { loadPack: (pack: { version: string; updated_at: string; templates: ActionTemplate[]; skills: [] }) => void };
  };

  planner.initialized = true;
  planner.worker = {};
  planner.library.loadPack({
    version: "1.0.0",
    updated_at: "2026-04-17",
    templates,
    skills: [],
  });
  planner.retriever = {
    retrieve: vi.fn().mockReturnValue({
      templates,
      skills: [],
      stages: ["cv_preparation", "applications", "interviewing"],
      retrieval_summary: "Retrieved 3 templates across 3 stages, 0 skills (barrier: cv)",
      score_breakdown: [],
    }),
  };
  planner.runInference = vi.fn(runInferenceImpl);

  return planner;
}

const baseInput: RawUserInput = {
  goal: "Warehouse role",
  barriers: "CV",
  timeframe: "2 weeks",
  participant_name: "Mark",
  supporter: "Advisor",
};

describe("SmartPlanner generation profiles", () => {
  it("accepts a single valid action for primary_draft", async () => {
    const planner = createPlanner(async () =>
      JSON.stringify([
        createAction("Mark will update his CV with two STAR examples for warehouse roles and send it to his advisor by 2026-04-24."),
      ]).slice(1)
    );

    const plan = await planner.generatePlan(baseInput, { profile: "primary_draft" });

    expect(plan.actions).toHaveLength(1);
    expect(plan.metadata.generation_profile).toBe("primary_draft");
    expect(plan.metadata.repair_attempts).toBe(0);
    expect(planner.runInference).toHaveBeenCalledTimes(1);
    expect(planner.runInference.mock.calls[0][2]).toMatchObject({
      max_new_tokens: 220,
      temperature: 0,
      top_p: 1,
    });
  });

  it("accepts alternate_drafts output without requiring a multi-step plan", async () => {
    const planner = createPlanner(async () =>
      JSON.stringify([
        createAction("Mark will tailor his CV to one warehouse vacancy and email the draft to his advisor by 2026-04-24."),
      ]).slice(1)
    );

    const plan = await planner.generatePlan(baseInput, { profile: "alternate_drafts" });

    expect(plan.actions).toHaveLength(1);
    expect(plan.metadata.generation_profile).toBe("alternate_drafts");
    expect(plan.metadata.repair_attempts).toBe(0);
    expect(planner.runInference.mock.calls[0][2]).toMatchObject({
      max_new_tokens: 320,
      temperature: 0,
      top_p: 1,
    });
  });

  it("caps planner retries for primary_draft at one repair attempt", async () => {
    const planner = createPlanner(async () => "not valid json");

    const plan = await planner.generatePlan(baseInput, { profile: "primary_draft" });

    expect(planner.runInference).toHaveBeenCalledTimes(2);
    expect(plan.metadata.generation_profile).toBe("primary_draft");
    expect(plan.metadata.repair_attempts).toBe(1);
    expect(plan.actions.length).toBeGreaterThan(0);
  });
});
