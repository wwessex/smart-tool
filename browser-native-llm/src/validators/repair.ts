/**
 * Repair loop and template fallback for SMART action validation.
 *
 * When model outputs fail validation, this module attempts to repair
 * individual actions by filling missing fields, fixing format issues,
 * and applying template-based corrections. If repair fails, it
 * generates fallback actions from the retrieval pack templates.
 */

import type {
  SMARTAction,
  UserProfile,
  ValidationResult,
  ActionTemplate,
} from "../types.js";

/**
 * Attempt to repair a single action that failed validation.
 * Returns the repaired action or null if repair is not possible.
 */
export function repairAction(
  action: SMARTAction,
  validationResult: ValidationResult,
  profile: UserProfile
): SMARTAction | null {
  const repaired = { ...action };
  let changed = false;

  // Fix specificity: add a verb if missing
  if (!validationResult.criteria.specific.passed) {
    const improved = improveSpecificity(repaired.action);
    if (improved !== repaired.action) {
      repaired.action = improved;
      changed = true;
    }
  }

  // Fix measurability: add numeric target
  if (!validationResult.criteria.measurable.passed) {
    const improved = improveMeasurability(repaired);
    if (improved) {
      repaired.metric = improved.metric;
      repaired.target = improved.target;
      changed = true;
    }
  }

  // Fix time-bound: add a date
  if (!validationResult.criteria.time_bound.passed) {
    const deadline = generateDeadline(profile.timeframe_weeks);
    if (deadline !== repaired.deadline) {
      repaired.deadline = deadline;
      changed = true;
    }
  }

  // Fix relevance: add rationale connecting to goal
  if (!validationResult.criteria.relevant.passed) {
    repaired.rationale = `This supports the goal of securing a ${profile.job_goal} role by ${repaired.rationale.toLowerCase()}`;
    changed = true;
  }

  // Fix achievability: adjust effort estimate
  if (!validationResult.criteria.achievable.passed) {
    repaired.effort_estimate = adjustEffortEstimate(
      repaired.effort_estimate,
      profile.hours_per_week
    );
    changed = true;
  }

  return changed ? repaired : null;
}

/**
 * Generate fallback actions from retrieval pack templates.
 * Used when the repair loop is exhausted and LLM output is unusable.
 */
export function createFallbackActions(
  profile: UserProfile,
  templates: ActionTemplate[]
): SMARTAction[] {
  const actions: SMARTAction[] = [];
  const usedStages = new Set<string>();

  // Determine how many actions to generate
  const targetCount = profile.hours_per_week <= 4 ? 3 : profile.hours_per_week <= 8 ? 4 : 5;

  // Sort templates by relevance (barrier match + confidence appropriateness)
  const scored = templates
    .filter((t) => t.min_confidence <= profile.confidence_level)
    .map((t) => ({
      template: t,
      score: scoreTemplate(t, profile),
    }))
    .sort((a, b) => b.score - a.score);

  for (const { template } of scored) {
    if (actions.length >= targetCount) break;

    // Diversify across stages
    if (usedStages.has(template.stage) && actions.length < targetCount - 1) {
      continue;
    }

    const action = templateToAction(template, profile, actions.length);
    actions.push(action);
    usedStages.add(template.stage);
  }

  // If we still don't have enough, relax the stage constraint
  if (actions.length < targetCount) {
    for (const { template } of scored) {
      if (actions.length >= targetCount) break;
      if (actions.some((a) => a.template_id === template.id)) continue;

      const action = templateToAction(template, profile, actions.length);
      actions.push(action);
    }
  }

  return actions;
}

// ---------------------------------------------------------------------------
// Repair helpers
// ---------------------------------------------------------------------------

function improveSpecificity(actionText: string): string {
  const text = actionText.trim();

  // If it starts with a vague term, try to make it more concrete
  const vagueReplacements: Record<string, string> = {
    "improve my cv": "Rewrite CV bullet points to highlight measurable achievements",
    "improve cv": "Rewrite CV bullet points to highlight measurable achievements",
    "work on my cv": "Update and tailor CV with role-specific keywords",
    "look for jobs": "Search for and bookmark suitable job listings on 3 job boards",
    "find a job": "Search for and apply to suitable positions on job boards",
    "get better at interviews": "Prepare STAR-format answers for 5 common interview questions",
    "network more": "Send 3 personalised connection requests on LinkedIn per week",
    "learn new skills": "Complete an online course module in a relevant skill area",
  };

  const lowerText = text.toLowerCase();
  for (const [vague, concrete] of Object.entries(vagueReplacements)) {
    if (lowerText.includes(vague)) {
      return concrete;
    }
  }

  // If still no verb, prepend "Complete: "
  const hasVerb = /^(write|create|send|apply|research|attend|prepare|build|complete|update|draft|review|submit|set up|register|practise|practice|schedule|contact|identify|list)/i.test(text);
  if (!hasVerb) {
    return `Complete: ${text}`;
  }

  return text;
}

function improveMeasurability(
  action: SMARTAction
): { metric: string; target: string } | null {
  const metricLower = action.metric.toLowerCase();

  // If metric has no number, try to add a reasonable default
  if (!/\d/.test(metricLower)) {
    // Infer a reasonable count from the action type
    const actionLower = action.action.toLowerCase();

    if (actionLower.includes("apply") || actionLower.includes("application")) {
      return { metric: "Number of applications submitted", target: "5 per week" };
    }
    if (actionLower.includes("connection") || actionLower.includes("network")) {
      return { metric: "Number of connections made", target: "3 per week" };
    }
    if (actionLower.includes("interview") || actionLower.includes("mock")) {
      return { metric: "Number of practice sessions completed", target: "2" };
    }
    if (actionLower.includes("course") || actionLower.includes("module")) {
      return { metric: "Number of modules completed", target: "1 per week" };
    }
    if (actionLower.includes("cv") || actionLower.includes("resume")) {
      return { metric: "CV sections updated", target: "All key sections" };
    }

    // Generic fallback
    return { metric: `Number of ${action.metric.toLowerCase()} completed`, target: "1" };
  }

  return null;
}

function generateDeadline(timeframeWeeks: number): string {
  // Generate a date within the user's timeframe
  const today = new Date();
  // Place deadline at 75% of the timeframe (leaving buffer)
  const daysOffset = Math.round(timeframeWeeks * 7 * 0.75);
  const deadline = new Date(today);
  deadline.setDate(today.getDate() + daysOffset);
  return deadline.toISOString().split("T")[0];
}

function adjustEffortEstimate(
  currentEstimate: string,
  hoursPerWeek: number
): string {
  const hoursMatch = currentEstimate.match(/(\d+)\s*(?:-\s*(\d+))?\s*hours?/i);

  if (hoursMatch) {
    const maxHours = parseInt(hoursMatch[2] || hoursMatch[1], 10);
    const isWeekly = /week|per\s+week|\/\s*w/i.test(currentEstimate);

    if (isWeekly && maxHours > hoursPerWeek) {
      // Cap at a reasonable fraction of available time
      const adjusted = Math.max(1, Math.floor(hoursPerWeek * 0.3));
      return `${adjusted} hours/week`;
    }
  }

  return currentEstimate;
}

// ---------------------------------------------------------------------------
// Template-to-action conversion
// ---------------------------------------------------------------------------

function scoreTemplate(
  template: ActionTemplate,
  profile: UserProfile
): number {
  let score = 0;

  // Barrier match
  for (const barrier of profile.barriers) {
    if (template.relevant_barriers.some((rb) =>
      rb.toLowerCase().includes(barrier.toLowerCase())
    )) {
      score += 3;
    }
  }

  // Goal keyword match
  const goalTerms = profile.job_goal.toLowerCase().split(/\s+/);
  for (const term of goalTerms) {
    if (
      term.length > 2 &&
      template.tags.some((tag) => tag.toLowerCase().includes(term))
    ) {
      score += 2;
    }
  }

  // Confidence appropriateness
  if (template.min_confidence <= profile.confidence_level) {
    score += 1;
  }

  return score;
}

function templateToAction(
  template: ActionTemplate,
  profile: UserProfile,
  index: number
): SMARTAction {
  // Substitute placeholders
  const action = substituteTemplateVars(template.action_template, profile);
  const metric = substituteTemplateVars(template.metric_template, profile);

  // Stagger deadlines across the timeframe
  const dayOffset = Math.round(
    ((index + 1) / 6) * profile.timeframe_weeks * 7
  );
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + dayOffset);

  return {
    action,
    metric,
    baseline: "Not yet started",
    target: inferTarget(template, profile),
    deadline: deadline.toISOString().split("T")[0],
    rationale: `Supports the goal of finding a ${profile.job_goal} role.`,
    effort_estimate: template.effort_hint,
    first_step: inferFirstStep(template, profile),
    template_id: template.id,
  };
}

function substituteTemplateVars(text: string, profile: UserProfile): string {
  return text
    .replace(/\{goal\}/g, profile.job_goal)
    .replace(/\{industry\}/g, profile.industry ?? "your target sector")
    .replace(/\{skill\}/g, profile.skills[0] ?? "relevant skill")
    .replace(/\{count\}/g, getReasonableCount(profile))
    .replace(/\{barrier\}/g, profile.barriers[0]?.replace(/_/g, " ") ?? "challenge");
}

function getReasonableCount(profile: UserProfile): string {
  if (profile.hours_per_week <= 4) return "2";
  if (profile.hours_per_week <= 8) return "3";
  return "5";
}

function inferTarget(
  template: ActionTemplate,
  profile: UserProfile
): string {
  const count = getReasonableCount(profile);
  if (template.metric_template.includes("Number")) return count;
  if (template.metric_template.includes("completed")) return "Complete by deadline";
  return count;
}

function inferFirstStep(
  template: ActionTemplate,
  profile: UserProfile
): string {
  const stage = template.stage;

  const firstSteps: Record<string, string> = {
    cv_preparation: "Open your current CV document and review it against the target role requirements",
    online_presence: "Log in to LinkedIn and review your current profile headline",
    applications: `Search "${profile.job_goal}" on a job board and bookmark 3 relevant listings`,
    networking: "Identify 3 people in your network who work in or near your target field",
    interviewing: "Write down 3 strengths you would mention in an interview",
    upskilling: "Search for a free online course in your skill gap area",
    discovery: "Spend 15 minutes reading about your target role on a careers website",
    follow_up: "Create a simple spreadsheet or document to track your applications",
  };

  return firstSteps[stage] ?? "Spend 15 minutes planning how to start this action";
}
