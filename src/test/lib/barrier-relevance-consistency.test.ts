import { describe, expect, it } from "vitest";
import { checkActionRelevance } from "@/lib/relevance-checker";
import { validatePlan } from "../../../browser-native-llm/src/validators/smart-validator";
import type { SMARTAction, UserProfile } from "../../../browser-native-llm/src/types";

const baseProfile: UserProfile = {
  job_goal: "Warehouse operative",
  current_situation: "unemployed",
  hours_per_week: 10,
  timeframe_weeks: 6,
  skills: ["teamwork"],
  barriers: ["Transport"],
  confidence_level: 3,
  participant_name: "Jamie",
  supporter: "Advisor",
  resolved_barrier: {
    id: "transport",
    label: "Transport",
    category: "practical_access",
    retrieval_tags: ["transport", "bus_route", "commute"],
    prompt_hints: [],
    do_not_assume: [],
    contraindicated_stages: [],
  },
};

const trailingActions: SMARTAction[] = [
  {
    action: "Jamie will update their CV with two recent achievements by 2026-03-10.",
    metric: "CV updated",
    baseline: "0 updates",
    target: "2 achievements added",
    deadline: "2026-03-10",
    rationale: "Supports warehouse applications",
    effort_estimate: "2 hours/week",
    first_step: "Open CV draft and list achievements",
  },
  {
    action: "Jamie will submit 3 warehouse applications by 2026-03-14.",
    metric: "Applications submitted",
    baseline: "0",
    target: "3",
    deadline: "2026-03-14",
    rationale: "Creates job opportunities",
    effort_estimate: "2 hours/week",
    first_step: "Save three vacancies and draft responses",
  },
];

describe("barrier relevance consistency between planner and UI", () => {
  it("returns the same relevant verdict for a mitigation action", () => {
    const actionText = "Jamie will research and save two bus routes to the industrial estate by 2026-03-08.";

    const uiVerdict = checkActionRelevance(actionText, "Transport", "Jamie", "2 weeks");

    const planVerdict = validatePlan(
      [
        {
          action: actionText,
          metric: "Routes saved",
          baseline: "0",
          target: "2",
          deadline: "2026-03-08",
          rationale: "Removes commute uncertainty",
          effort_estimate: "1 hour/week",
          first_step: "Open travel planner and shortlist routes",
        },
        ...trailingActions,
      ],
      baseProfile,
    );

    expect(uiVerdict.barrierAligned).toBe(true);
    expect(planVerdict.issues).not.toContain(
      'First action should address the "Transport" barrier',
    );
  });

  it("returns the same irrelevant verdict for anti-pattern actions", () => {
    const actionText = "Jamie will think about transport problems this week.";

    const uiVerdict = checkActionRelevance(actionText, "Transport", "Jamie", "2 weeks");

    const planVerdict = validatePlan(
      [
        {
          action: actionText,
          metric: "Thoughts recorded",
          baseline: "0",
          target: "1",
          deadline: "2026-03-08",
          rationale: "General reflection",
          effort_estimate: "1 hour/week",
          first_step: "Set a reminder",
        },
        ...trailingActions,
      ],
      baseProfile,
    );

    expect(uiVerdict.barrierAligned).toBe(false);
    expect(planVerdict.issues).toContain(
      'First action should address the "Transport" barrier',
    );
  });
});
