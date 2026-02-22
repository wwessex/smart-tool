/**
 * Smart Retrieval — finds similar exemplars before AI generation.
 *
 * This implements a lightweight "RAG-style" flow:
 *   1. Classify the barrier to a category
 *   2. Search the curated EXEMPLAR_LIBRARY for matching barrier/category
 *   3. Search user-accepted feedback exemplars for additional matches
 *   4. Rank by relevance (exact barrier > same category > keyword match)
 *   5. Return top N examples to inject into the prompt
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

  // --- Score user feedback exemplars ---
  // Only use accepted/positively-rated feedback
  const acceptedFeedback = feedbackStore.filter(f => {
    if (f.rating === 'not-relevant') return false;
    return f.rating === 'relevant' || f.acceptedAsIs;
  });

  for (const fb of acceptedFeedback) {
    let score = 0;

    // Use the edited action if available (advisor-improved version)
    const actionText = fb.editedAction || fb.generatedAction;

    // Exact barrier match: +12 (slightly higher than library — real usage trumps)
    if (fb.barrier.toLowerCase() === barrierLower) {
      score += 12;
    }
    // Same category: +6
    else if (fb.category === category && category !== 'unknown') {
      score += 6;
    }

    // Keyword overlap with action
    const actionTokens = tokenise(actionText);
    score += overlapScore(barrierTokens, actionTokens) * 0.5;

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
