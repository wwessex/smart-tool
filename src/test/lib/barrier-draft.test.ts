import { describe, it, expect } from "vitest";
import {
  createBarrierDraftContext,
  selectAlternateActions,
  selectPrimaryBarrierDraft,
} from "@/lib/barrier-draft";

const cvActions = [
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
    action: "Mark will research bus routes to the industrial estate and save the timetable by 24-Apr-26.",
    metric: "1 route saved",
    baseline: "No route saved",
    target: "Reliable route confirmed",
    deadline: "2026-04-24",
    rationale: "Transport planning reduces missed appointments",
    effort_estimate: "20 minutes",
    first_step: "Check the local bus website",
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
    action: "Keep trying to improve things.",
    metric: "Progress made",
    baseline: "Stuck",
    target: "Feels improved",
    deadline: "2026-04-24",
    rationale: "General progress is helpful",
    effort_estimate: "Unknown",
    first_step: "Think about the issue",
  },
];

describe("barrier-draft", () => {
  it("classifies forgetting barriers as habit-related", () => {
    const result = createBarrierDraftContext("I keep forgetting to check my applications");
    expect(result.barrierType).toBe("habit");
  });

  it("classifies unclear-start barriers as clarity-related", () => {
    const result = createBarrierDraftContext("I do not know where to start with my CV");
    expect(result.barrierType).toBe("clarity");
  });

  it("classifies time-pressure barriers as time-related", () => {
    const result = createBarrierDraftContext("I do not have time to apply during the week");
    expect(result.barrierType).toBe("time");
  });

  it("selects the strongest barrier-relevant primary action", () => {
    const selection = selectPrimaryBarrierDraft(cvActions, "CV", "Mark", "2 weeks");

    expect(selection).not.toBeNull();
    expect(selection?.primaryAction.action).toContain("two STAR examples");
    expect(selection?.relevance.isRelevant).toBe(true);
    expect(selection?.alternates.length).toBeGreaterThan(0);
  });

  it("returns only relevant non-duplicate alternates", () => {
    const alternates = selectAlternateActions(
      cvActions,
      "CV",
      "Mark will update his CV with two STAR examples for warehouse roles and send it to his advisor by 24-Apr-26.",
      "Mark",
      "2 weeks",
    );

    expect(alternates.length).toBe(1);
    expect(alternates[0].action).toContain("tailor his CV");
  });
});
