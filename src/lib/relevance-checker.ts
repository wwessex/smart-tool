/**
 * Relevance Checker — post-generation validation for AI-drafted actions.
 *
 * Phase 2 enhancement: after the LLM generates actions, this module
 * checks whether each action adequately addresses the stated barrier.
 * Actions that fail relevance checks are flagged or filtered, and the
 * best action is promoted to the top of the list.
 *
 * Checks performed:
 *   1. Barrier alignment — does the action text reference the barrier?
 *   2. SMART score — does the action meet a minimum SMART quality threshold?
 *   3. Generic-action detection — is this a vague, catch-all action?
 *   4. Combined relevance score for ranking multiple actions
 */

import { checkSmart, type SmartCheck } from './smart-checker';
import { classifyBarrier } from './smart-data';
import { evaluateBarrierRelevance } from '@smart-tool/browser-native-llm';

export interface RelevanceResult {
  /** The action text that was checked. */
  action: string;
  /** Whether the action passes relevance checks. */
  isRelevant: boolean;
  /** Combined relevance score (0-1). Higher = more relevant. */
  relevanceScore: number;
  /** SMART criteria check result. */
  smartCheck: SmartCheck;
  /** Whether the action appears to address the barrier directly. */
  barrierAligned: boolean;
  /** Whether the action was flagged as too generic. */
  isGeneric: boolean;
  /** Human-readable reason if not relevant. */
  reason?: string;
}

// Generic action patterns — actions that are too vague or catch-all
const GENERIC_PATTERNS = [
  /\b(work on|improve|get better at|do something|make progress|keep trying)\b/i,
  /\b(continue to|carry on|keep going|stay positive|be more)\b/i,
  /\b(think about|consider|look into|explore options|reflect on)\b/i,
];

// Employment-domain verbs that indicate a concrete action
const CONCRETE_ACTION_VERBS = /\b(apply|submit|attend|complete|register|create|update|contact|call|email|visit|write|rewrite|prepare|research|practise|practice|book|schedule|discuss|enrol|identify|gather|bring|confirm|arrange|set up|sign up|send|save|upload|print|tailor|review|obtain|start|join|speak|meet|check|explore|develop|build)\b/i;

/**
 * Detect whether an action is too generic / not concrete enough.
 */
function isGenericAction(action: string): boolean {
  // Check against generic patterns
  const matchesGeneric = GENERIC_PATTERNS.some(p => p.test(action));
  if (matchesGeneric) return true;

  // Check for lack of concrete action verbs
  const hasConcreteVerb = CONCRETE_ACTION_VERBS.test(action);
  if (!hasConcreteVerb) return true;

  // Too short to be specific
  if (action.split(/\s+/).length < 8) return true;

  return false;
}

/**
 * Check the relevance of a single AI-generated action against a barrier.
 *
 * @param action   The generated action text
 * @param barrier  The barrier being addressed
 * @param forename Participant name (for SMART check context)
 * @param timescale Review period (for SMART check context)
 * @returns        RelevanceResult with scores and flags
 */
export function checkActionRelevance(
  action: string,
  barrier: string,
  forename?: string,
  timescale?: string,
): RelevanceResult {
  const smartCheck = checkSmart(action, { forename, barrier, timescale });
  const barrierRelevance = evaluateBarrierRelevance({
    text: action,
    barrierLabel: barrier,
    barrierCategory: classifyBarrier(barrier),
  });
  const barrierAligned = barrierRelevance.isRelevant;
  const generic = isGenericAction(action);

  // Compute combined relevance score (0-1)
  let relevanceScore = 0;

  // SMART score contributes up to 0.4 (each criterion = 0.08)
  relevanceScore += (smartCheck.overallScore / 5) * 0.4;

  // Barrier alignment contributes 0.35
  if (barrierAligned) relevanceScore += 0.35;

  // Concrete (non-generic) action contributes 0.15
  if (!generic) relevanceScore += 0.15;

  // Has commitment language ("will", "has agreed to") contributes 0.1
  const hasCommitment = /\b(will|has agreed to|commits to|shall)\b/i.test(action);
  if (hasCommitment) relevanceScore += 0.1;

  // Cap at 1.0
  relevanceScore = Math.min(1, relevanceScore);

  // Determine if relevant: must be barrier-aligned AND have a minimum SMART score
  const isRelevant = barrierAligned && smartCheck.overallScore >= 2 && !generic;

  let reason: string | undefined;
  if (!isRelevant) {
    if (generic) {
      reason = 'Action is too generic. It needs a more concrete, specific task.';
    } else if (!barrierAligned) {
      reason = barrierRelevance.antiPatternDetected
        ? `Action mentions the "${barrier}" barrier but uses generic language and no mitigation step.`
        : `Action does not appear to address the "${barrier}" barrier directly.`;
    } else if (smartCheck.overallScore < 2) {
      reason = `Action only meets ${smartCheck.overallScore}/5 SMART criteria. Needs more detail.`;
    }
  }

  return {
    action,
    isRelevant,
    relevanceScore,
    smartCheck,
    barrierAligned,
    isGeneric: generic,
    reason,
  };
}

/**
 * Rank and filter an array of generated actions by relevance.
 *
 * Returns actions sorted by relevance score (best first).
 * Actions that fail the relevance check are moved to the end but
 * NOT removed — the advisor may still find them useful.
 *
 * @param actions  Array of action objects with an `action` string field
 * @param barrier  The barrier being addressed
 * @param forename Participant name
 * @param timescale Review period
 * @returns        The same actions array, re-ordered by relevance (best first)
 */
export function rankActionsByRelevance<T extends { action: string }>(
  actions: T[],
  barrier: string,
  forename?: string,
  timescale?: string,
): T[] {
  if (actions.length <= 1) return actions;

  const withScores = actions.map(a => ({
    original: a,
    result: checkActionRelevance(a.action, barrier, forename, timescale),
  }));

  // Sort: relevant actions first (by score desc), then irrelevant actions
  withScores.sort((a, b) => {
    // Relevant actions come before irrelevant
    if (a.result.isRelevant && !b.result.isRelevant) return -1;
    if (!a.result.isRelevant && b.result.isRelevant) return 1;
    // Within same relevance group, sort by score
    return b.result.relevanceScore - a.result.relevanceScore;
  });

  return withScores.map(w => w.original);
}
