/**
 * Smart Retrieval — finds similar exemplars before AI generation.
 *
 * This implements a lightweight "RAG-style" flow:
 *   1. Classify the barrier to a category
 *   2. Search the curated EXEMPLAR_LIBRARY for matching barrier/category
 *   3. Search user-accepted feedback exemplars, ranked by success quality
 *   4. Rank by relevance (exact barrier > same category > keyword match)
 *      with quality weighting: accepted+rated > edited+rated > accepted > edited
 *   5. Return top N examples to inject into the prompt
 *
 * Phase 2 enhancements:
 *   - Feedback records are scored by quality tier (accepted+relevant > edited > unrated)
 *   - Recency bonus gives fresher feedback a slight edge
 *   - Acceptance-rate data per barrier category influences retrieval weighting
 */

import {
  EXEMPLAR_LIBRARY,
  classifyBarrier,
  type ActionExemplar,
} from './smart-data';
import type { ActionFeedback } from '@/hooks/useSmartStorage';

export interface RetrievedExample {
  action: string;
  help: string;
  barrier: string;
  source: 'library' | 'feedback';
  score: number;       // relevance score (higher = better)
}

// ---- Phase 2: Acceptance rate tracking per barrier category ----

export interface CategoryAcceptanceRate {
  category: string;
  total: number;
  accepted: number;        // rated 'relevant' OR acceptedAsIs
  edited: number;          // has editedAction
  rejected: number;        // rated 'not-relevant'
  acceptanceRate: number;  // 0-1
  editRate: number;        // 0-1
}

/**
 * Compute acceptance rates per barrier category from the feedback store.
 * Used to prioritise exemplars from high-performing categories and to
 * surface metrics for tracking improvement.
 */
export function computeAcceptanceRates(
  feedbackStore: ActionFeedback[],
): CategoryAcceptanceRate[] {
  const buckets = new Map<string, { total: number; accepted: number; edited: number; rejected: number }>();

  for (const fb of feedbackStore) {
    const cat = fb.category || 'unknown';
    if (!buckets.has(cat)) {
      buckets.set(cat, { total: 0, accepted: 0, edited: 0, rejected: 0 });
    }
    const b = buckets.get(cat)!;
    b.total++;
    if (fb.rating === 'not-relevant') {
      b.rejected++;
    } else if (fb.rating === 'relevant' || fb.acceptedAsIs) {
      b.accepted++;
    }
    if (fb.editedAction) {
      b.edited++;
    }
  }

  const rates: CategoryAcceptanceRate[] = [];
  for (const [category, b] of buckets) {
    rates.push({
      category,
      total: b.total,
      accepted: b.accepted,
      edited: b.edited,
      rejected: b.rejected,
      acceptanceRate: b.total > 0 ? b.accepted / b.total : 0,
      editRate: b.total > 0 ? b.edited / b.total : 0,
    });
  }

  return rates.sort((a, b) => b.total - a.total);
}

/**
 * Get acceptance rate for a specific barrier category.
 * Returns null if no data for this category.
 */
export function getCategoryAcceptanceRate(
  feedbackStore: ActionFeedback[],
  category: string,
): CategoryAcceptanceRate | null {
  const rates = computeAcceptanceRates(feedbackStore);
  return rates.find(r => r.category === category) ?? null;
}

// ---- Phase 2: Quality-weighted feedback scoring ----

/**
 * Compute a quality score for a single feedback record.
 *
 * Scoring tiers:
 *   - Rated 'relevant' + accepted as-is:  1.0  (gold exemplar)
 *   - Rated 'relevant' + edited:          0.9  (advisor refined + confirmed)
 *   - Accepted as-is, no rating:          0.6  (implicit acceptance)
 *   - Edited, no rating:                  0.4  (advisor changed it, may be good)
 *   - No rating, not accepted:            0.0  (excluded from retrieval)
 *   - Rated 'not-relevant':              -1.0  (excluded)
 */
export function computeFeedbackQuality(fb: ActionFeedback): number {
  if (fb.rating === 'not-relevant') return -1;

  let quality = 0;

  if (fb.rating === 'relevant' && fb.acceptedAsIs) {
    quality = 1.0;
  } else if (fb.rating === 'relevant' && fb.editedAction) {
    quality = 0.9;
  } else if (fb.rating === 'relevant') {
    quality = 0.8;
  } else if (fb.acceptedAsIs) {
    quality = 0.6;
  } else if (fb.editedAction) {
    quality = 0.4;
  }

  return quality;
}

/**
 * Compute a recency bonus (0-1) based on how recent the feedback is.
 * Feedback from the last 7 days gets full bonus; decays over 90 days.
 */
function recencyBonus(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) return 1.0;
  if (ageDays >= 90) return 0.0;
  // Linear decay from 1.0 at 7 days to 0.0 at 90 days
  return Math.max(0, 1 - (ageDays - 7) / 83);
}

// ---- Core retrieval ----

/**
 * Tokenise a string into lowercase words for keyword matching.
 */
function tokenise(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
  );
}

/**
 * Compute keyword overlap score between two token sets.
 */
function overlapScore(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const token of a) {
    if (b.has(token)) count++;
  }
  return count;
}

/**
 * Retrieve the most relevant exemplars for a given barrier/context.
 *
 * Phase 2 enhancements:
 *   - Feedback scored by quality tier (accepted+relevant > edited > unrated)
 *   - Recency bonus for fresher feedback
 *   - Category acceptance rate boosts exemplars from well-performing categories
 *
 * @param barrier       The barrier label (e.g. "CV", "Confidence", or free text)
 * @param feedbackStore Accepted feedback records from the user's localStorage
 * @param maxResults    Maximum number of examples to return (default 5)
 * @returns             Sorted array of the best-matching examples
 */
export function retrieveExemplars(
  barrier: string,
  feedbackStore: ActionFeedback[] = [],
  maxResults = 5,
): RetrievedExample[] {
  if (!barrier?.trim()) return [];

  const category = classifyBarrier(barrier);
  const barrierLower = barrier.toLowerCase();
  const barrierTokens = tokenise(barrier);

  // Pre-compute category acceptance rates for weighting
  const categoryRate = getCategoryAcceptanceRate(feedbackStore, category);
  // Boost exemplars from categories with high acceptance (max +2)
  const categoryBoost = categoryRate && categoryRate.total >= 3
    ? categoryRate.acceptanceRate * 2
    : 0;

  const scored: RetrievedExample[] = [];

  // --- Score curated exemplars ---
  for (const ex of EXEMPLAR_LIBRARY) {
    let score = 0;

    // Exact barrier match: +10
    if (ex.barrier.toLowerCase() === barrierLower) {
      score += 10;
    }
    // Same category: +5
    else if (ex.category === category && category !== 'unknown') {
      score += 5;
    }

    // Tag keyword overlap: +1 per matching tag
    const tagTokens = new Set(ex.tags.map(t => t.toLowerCase()));
    score += overlapScore(barrierTokens, tagTokens);

    // Action text keyword overlap
    const actionTokens = tokenise(ex.action);
    score += overlapScore(barrierTokens, actionTokens) * 0.5;

    if (score > 0) {
      scored.push({
        action: ex.action,
        help: ex.help,
        barrier: ex.barrier,
        source: 'library',
        score,
      });
    }
  }

  // --- Score user feedback exemplars (Phase 2: quality-weighted) ---
  // Filter to usable feedback (quality > 0)
  const usableFeedback = feedbackStore.filter(f => computeFeedbackQuality(f) > 0);

  for (const fb of usableFeedback) {
    const quality = computeFeedbackQuality(fb);
    const recency = recencyBonus(fb.createdAt);

    // Use the edited action if available (advisor-improved version)
    const actionText = fb.editedAction || fb.generatedAction;

    let score = 0;

    // Exact barrier match: base +12, scaled by quality
    if (fb.barrier.toLowerCase() === barrierLower) {
      score += 12 * quality;
    }
    // Same category: base +6, scaled by quality
    else if (fb.category === category && category !== 'unknown') {
      score += 6 * quality;
    }

    // Keyword overlap with action
    const actionTokens = tokenise(actionText);
    score += overlapScore(barrierTokens, actionTokens) * 0.5;

    // Recency bonus: up to +2 for very recent feedback
    score += recency * 2;

    // Category acceptance rate boost (high-performing categories get a lift)
    if (fb.category === category) {
      score += categoryBoost;
    }

    if (score > 0) {
      scored.push({
        action: actionText,
        help: `address ${fb.barrier.toLowerCase()} barrier`,
        barrier: fb.barrier,
        source: 'feedback',
        score,
      });
    }
  }

  // Sort by score descending, then deduplicate by action text
  scored.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const results: RetrievedExample[] = [];
  for (const item of scored) {
    const key = item.action.toLowerCase().slice(0, 80);
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(item);
    if (results.length >= maxResults) break;
  }

  return results;
}

/**
 * Format retrieved examples into a prompt-ready string.
 * Used to inject examples before AI generation.
 */
export function formatExemplarsForPrompt(
  examples: RetrievedExample[],
  forename: string,
  targetDate: string,
): string {
  if (!examples.length) return '';

  const lines = examples.map((ex, i) => {
    const action = ex.action
      .replace(/\{forename\}/g, forename || '[Name]')
      .replace(/\{targetDate\}/g, targetDate || '[Date]');
    return `${i + 1}. "${action}" — helps: ${ex.help}`;
  });

  return [
    'SIMILAR SUCCESSFUL ACTIONS (use as guidance, do NOT copy verbatim):',
    ...lines,
  ].join('\n');
}
