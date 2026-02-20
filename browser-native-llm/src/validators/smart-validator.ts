/**
 * SMART criteria validator for generated actions.
 *
 * Applies rule-based checks for each SMART criterion:
 * - Specific: concrete verb + artefact
 * - Measurable: numeric target or countable outcome
 * - Achievable: effort fits hours/week and constraints
 * - Relevant: references stated goal/role/industry
 * - Time-bound: includes date or timeframe
 */

import type {
  SMARTAction,
  UserProfile,
  ValidationResult,
  SMARTCriteriaResult,
  CriterionResult,
} from "../types.js";

/**
 * Validate a single SMART action against criteria and user profile.
 */
export function validateAction(
  action: SMARTAction,
  profile: UserProfile
): ValidationResult {
  const criteria: SMARTCriteriaResult = {
    specific: checkSpecific(action),
    measurable: checkMeasurable(action),
    achievable: checkAchievable(action, profile),
    relevant: checkRelevant(action, profile),
    time_bound: checkTimeBound(action, profile),
  };

  const issues: string[] = [];
  const suggestions: string[] = [];

  for (const [key, result] of Object.entries(criteria)) {
    if (!result.passed) {
      issues.push(`${key}: ${result.reason}`);
      suggestions.push(getSuggestion(key as keyof SMARTCriteriaResult, action));
    }
  }

  const criteriaValues = Object.values(criteria);
  const totalScore = criteriaValues.reduce((sum, c) => sum + c.score, 0);
  const score = Math.round((totalScore / criteriaValues.length) * 100);

  return {
    valid: issues.length === 0,
    criteria,
    score,
    issues,
    suggestions,
  };
}

/**
 * Validate a complete plan (set of actions) for coverage and balance.
 */
export function validatePlan(
  actions: SMARTAction[],
  profile: UserProfile
): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  if (actions.length < 3) {
    issues.push(`Plan has only ${actions.length} actions (minimum 3 recommended)`);
    score -= 30;
  }

  if (actions.length > 8) {
    issues.push(`Plan has ${actions.length} actions (maximum 8 recommended)`);
    score -= 10;
  }

  // Check for duplicate actions
  const actionTexts = actions.map((a) => a.action.toLowerCase().trim());
  const uniqueActions = new Set(actionTexts);
  if (uniqueActions.size < actionTexts.length) {
    issues.push("Plan contains duplicate or very similar actions");
    score -= 20;
  }

  // Check that total effort doesn't exceed available hours
  const totalWeeklyHours = estimateTotalWeeklyHours(actions);
  if (totalWeeklyHours > profile.hours_per_week * 1.5) {
    issues.push(
      `Estimated total effort (~${totalWeeklyHours}h/week) exceeds available time (${profile.hours_per_week}h/week)`
    );
    score -= 15;
  }

  // Check deadline spread (not all on the same date)
  const deadlines = new Set(actions.map((a) => a.deadline));
  if (deadlines.size === 1 && actions.length > 2) {
    issues.push("All actions have the same deadline - consider staggering");
    score -= 10;
  }

  return { score: Math.max(0, score), issues };
}

// ---------------------------------------------------------------------------
// Criterion checks
// ---------------------------------------------------------------------------

/** Concrete verb + artefact patterns. */
const SPECIFIC_VERBS = [
  "write", "rewrite", "create", "update", "complete", "send", "apply",
  "research", "attend", "prepare", "build", "tailor", "proofread",
  "register", "set up", "configure", "draft", "review", "practise",
  "practice", "schedule", "contact", "identify", "list", "submit",
  "enrol", "enroll", "sign up", "download", "install", "upload",
  "edit", "revise", "organise", "organize", "track", "record",
  "request", "book", "join", "follow",
];

function checkSpecific(action: SMARTAction): CriterionResult {
  const text = action.action.toLowerCase();

  // Check for a concrete action verb
  const hasVerb = SPECIFIC_VERBS.some((verb) => text.includes(verb));

  // Check for vague/generic language
  const vagueTerms = ["improve", "try to", "maybe", "consider", "think about", "look into"];
  const hasVague = vagueTerms.some((term) => text.includes(term));

  // Check action length (too short = too vague)
  const hasDetail = action.action.length >= 20;

  // Check first_step is concrete
  const hasConcreteFirstStep = action.first_step.length >= 10;

  let score = 0;
  if (hasVerb) score += 40;
  if (!hasVague) score += 20;
  if (hasDetail) score += 20;
  if (hasConcreteFirstStep) score += 20;

  const passed = score >= 60;
  const reason = !passed
    ? hasVague
      ? "Action uses vague language; needs a concrete verb and specific artefact"
      : !hasVerb
        ? "Action lacks a concrete action verb (e.g., write, create, send, complete)"
        : "Action is too brief; add specific details about what will be done"
    : "Action is specific";

  return { passed, score, reason };
}

function checkMeasurable(action: SMARTAction): CriterionResult {
  const metricAndTarget = `${action.metric} ${action.target}`.toLowerCase();

  // Check for numeric values
  const hasNumber = /\d+/.test(metricAndTarget);

  // Check for countable terms
  const countableTerms = [
    "number of", "count", "completed", "submitted", "sent",
    "attended", "per week", "per day", "per month", "each",
    "times", "sessions", "applications", "responses",
  ];
  const hasCountable = countableTerms.some((term) => metricAndTarget.includes(term));

  // Check that metric and target differ from the action text
  const metricNotAction = action.metric.toLowerCase() !== action.action.toLowerCase();

  let score = 0;
  if (hasNumber) score += 50;
  if (hasCountable) score += 30;
  if (metricNotAction) score += 20;

  const passed = score >= 50;
  const reason = !passed
    ? "Metric lacks a numeric target or countable outcome"
    : "Metric includes measurable criteria";

  return { passed, score, reason };
}

function checkAchievable(
  action: SMARTAction,
  profile: UserProfile
): CriterionResult {
  let score = 50; // Start at neutral

  // Check effort estimate exists and is reasonable
  const effortText = action.effort_estimate.toLowerCase();
  const hoursMatch = effortText.match(/(\d+)\s*(?:-\s*(\d+))?\s*hours?/);

  if (hoursMatch) {
    const maxHours = parseInt(hoursMatch[2] || hoursMatch[1], 10);
    const isWeekly = /week|per\s+week|\/\s*w/i.test(effortText);

    if (isWeekly && maxHours > profile.hours_per_week) {
      score -= 30;
    } else {
      score += 25;
    }
  } else {
    score += 10; // Has some effort estimate even if not numeric
  }

  // Check that actions don't assume resources the user hasn't mentioned
  const action_text = action.action.toLowerCase();
  const requiresTransport =
    action_text.includes("attend") || action_text.includes("visit");
  if (
    requiresTransport &&
    profile.barriers.includes("transport")
  ) {
    score -= 20;
  }

  // Low confidence users should have smaller first steps
  if (profile.confidence_level <= 2 && action.first_step.length < 15) {
    score += 10; // Short first steps are good for low confidence
  }

  const passed = score >= 50;
  const reason = !passed
    ? "Action may not be achievable given stated constraints"
    : "Action appears achievable within stated constraints";

  return { passed, score, reason };
}

function checkRelevant(
  action: SMARTAction,
  profile: UserProfile
): CriterionResult {
  const actionText = `${action.action} ${action.rationale}`.toLowerCase();
  const goalTerms = profile.job_goal
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  // Check goal keyword overlap
  const goalOverlap = goalTerms.filter((term) =>
    actionText.includes(term)
  ).length;

  // Check industry mention
  const industryMentioned = profile.industry
    ? actionText.includes(profile.industry.toLowerCase())
    : false;

  // Check that rationale references the goal
  const rationaleReferencesGoal = goalTerms.some((term) =>
    action.rationale.toLowerCase().includes(term)
  );

  // Job-search relevance (even if not goal-specific)
  const jobSearchTerms = [
    "cv", "resume", "application", "interview", "network",
    "linkedin", "job", "role", "career", "employer", "hiring",
    "skill", "portfolio", "cover letter",
  ];
  const isJobSearchRelated = jobSearchTerms.some((term) =>
    actionText.includes(term)
  );

  let score = 0;
  if (goalOverlap > 0) score += Math.min(goalOverlap * 15, 40);
  if (industryMentioned) score += 20;
  if (rationaleReferencesGoal) score += 20;
  if (isJobSearchRelated) score += 20;

  const passed = score >= 40;
  const reason = !passed
    ? "Action does not clearly relate to the stated job goal"
    : "Action is relevant to the job goal";

  return { passed, score, reason };
}

function checkTimeBound(
  action: SMARTAction,
  profile: UserProfile
): CriterionResult {
  const deadlineText = action.deadline;

  // Check for ISO date format (YYYY-MM-DD)
  const hasISODate = /\d{4}-\d{2}-\d{2}/.test(deadlineText);

  // Check for common date formats
  const hasDateFormat =
    /\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(
      deadlineText
    ) ||
    /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}/i.test(
      deadlineText
    );

  // Check for relative timeframes
  const hasRelativeTime =
    /(\d+)\s*(week|day|month)/i.test(deadlineText) ||
    /end\s+of\s+(week|month)/i.test(deadlineText) ||
    /within\s+\d+/i.test(deadlineText) ||
    /by\s+(week|month|day)/i.test(deadlineText);

  // Validate deadline is within the user's timeframe
  let withinTimeframe = true;
  if (hasISODate) {
    const deadlineDate = new Date(deadlineText);
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + profile.timeframe_weeks * 7 + 7); // +1 week grace
    if (deadlineDate > maxDate) {
      withinTimeframe = false;
    }
  }

  let score = 0;
  if (hasISODate) score += 60;
  else if (hasDateFormat) score += 50;
  else if (hasRelativeTime) score += 40;

  if (withinTimeframe) score += 40;

  const passed = score >= 60;
  const reason = !passed
    ? "Deadline is missing or not a specific date/timeframe"
    : "Action has a clear time-bound deadline";

  return { passed, score, reason };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSuggestion(
  criterion: keyof SMARTCriteriaResult,
  action: SMARTAction
): string {
  switch (criterion) {
    case "specific":
      return `Rephrase "${action.action.slice(0, 40)}..." to include a concrete verb (e.g., "write", "send", "complete") and specific artefact.`;
    case "measurable":
      return `Add a numeric target to the metric (e.g., "Submit 5 applications" instead of "${action.metric.slice(0, 30)}...")`;
    case "achievable":
      return "Review the effort estimate and ensure it fits within the available hours and constraints.";
    case "relevant":
      return "Add a rationale that explicitly connects this action to the stated job goal.";
    case "time_bound":
      return `Replace "${action.deadline}" with a specific date (YYYY-MM-DD) or clear timeframe (e.g., "within 2 weeks").`;
  }
}

function estimateTotalWeeklyHours(actions: SMARTAction[]): number {
  let total = 0;

  for (const action of actions) {
    const effortText = action.effort_estimate.toLowerCase();
    const hoursMatch = effortText.match(/(\d+)\s*(?:-\s*(\d+))?\s*hours?/);

    if (hoursMatch) {
      const hours = parseInt(hoursMatch[2] || hoursMatch[1], 10);
      const isWeekly = /week|per\s+week|\/\s*w/i.test(effortText);
      const isOneOff = /one[\s-]off|once|single/i.test(effortText);

      if (isWeekly) {
        total += hours;
      } else if (isOneOff) {
        // Spread one-off tasks across weeks (rough)
        total += hours / 4;
      } else {
        total += hours;
      }
    } else {
      // Default estimate for actions without numeric effort
      total += 1;
    }
  }

  return Math.round(total * 10) / 10;
}
