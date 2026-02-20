/**
 * Translation quality evaluation toolkit.
 *
 * Provides automated metrics (character-level chrF, placeholder preservation)
 * for regression testing translation quality. BLEU is omitted in favour of
 * chrF as it's more robust for morphologically rich languages and short texts.
 *
 * Usage:
 *   npx tsx evaluation/evaluate.ts
 *
 * This is a development tool, not part of the runtime bundle.
 */

// ---------------------------------------------------------------------------
// chrF score (character n-gram F-score)
// ---------------------------------------------------------------------------

/**
 * Compute chrF score between a hypothesis and reference translation.
 * Based on Popović (2015). Uses character 6-grams by default.
 *
 * @param hypothesis - The translation output to evaluate.
 * @param reference - The expected reference translation.
 * @param maxN - Maximum character n-gram order (default: 6).
 * @param beta - Recall weight (default: 2, favouring recall).
 * @returns chrF score between 0 and 1.
 */
export function chrF(
  hypothesis: string,
  reference: string,
  maxN = 6,
  beta = 2
): number {
  if (!reference || !hypothesis) return 0;

  let totalPrecision = 0;
  let totalRecall = 0;
  let count = 0;

  for (let n = 1; n <= maxN; n++) {
    const hypNgrams = extractCharNgrams(hypothesis, n);
    const refNgrams = extractCharNgrams(reference, n);

    if (refNgrams.size === 0 && hypNgrams.size === 0) continue;

    const { precision, recall } = ngramOverlap(hypNgrams, refNgrams);
    totalPrecision += precision;
    totalRecall += recall;
    count++;
  }

  if (count === 0) return 0;

  const avgPrecision = totalPrecision / count;
  const avgRecall = totalRecall / count;

  if (avgPrecision + avgRecall === 0) return 0;

  const betaSq = beta * beta;
  return ((1 + betaSq) * avgPrecision * avgRecall) / (betaSq * avgPrecision + avgRecall);
}

// ---------------------------------------------------------------------------
// Placeholder preservation check
// ---------------------------------------------------------------------------

/** Common placeholder patterns. */
const PLACEHOLDER_PATTERNS = [
  /\{[^}]+\}/g,     // {name}, {0}
  /\{\{[^}]+\}\}/g, // {{name}}
  /%[sd]/g,          // %s, %d
  /%\d+\$[sd]/g,     // %1$s
];

/**
 * Check that all placeholders from the source text are preserved
 * in the translated text.
 *
 * @returns Object with pass/fail and list of missing placeholders.
 */
export function checkPlaceholders(
  source: string,
  translated: string
): { passed: boolean; missing: string[]; found: string[] } {
  const sourcePlaceholders = new Set<string>();
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matches = source.match(pattern);
    if (matches) {
      for (const m of matches) sourcePlaceholders.add(m);
    }
  }

  const missing: string[] = [];
  const found: string[] = [];

  for (const ph of sourcePlaceholders) {
    if (translated.includes(ph)) {
      found.push(ph);
    } else {
      missing.push(ph);
    }
  }

  return {
    passed: missing.length === 0,
    missing,
    found,
  };
}

// ---------------------------------------------------------------------------
// Batch evaluation
// ---------------------------------------------------------------------------

/** Result of evaluating a single translation. */
export interface EvaluationResult {
  id: string;
  sourceLang: string;
  targetLang: string;
  source: string;
  hypothesis: string;
  reference: string;
  chrfScore: number;
  placeholderCheck: { passed: boolean; missing: string[]; found: string[] };
}

/**
 * Evaluate a batch of translations against reference golden set entries.
 */
export function evaluateBatch(
  translations: Array<{
    id: string;
    source: string;
    hypothesis: string;
    reference: string;
    sourceLang: string;
    targetLang: string;
  }>
): EvaluationResult[] {
  return translations.map((t) => ({
    id: t.id,
    sourceLang: t.sourceLang,
    targetLang: t.targetLang,
    source: t.source,
    hypothesis: t.hypothesis,
    reference: t.reference,
    chrfScore: chrF(t.hypothesis, t.reference),
    placeholderCheck: checkPlaceholders(t.source, t.hypothesis),
  }));
}

/**
 * Compute aggregate statistics from evaluation results.
 */
export function aggregateResults(results: EvaluationResult[]): {
  count: number;
  avgChrF: number;
  placeholderPassRate: number;
  byLanguage: Record<string, { count: number; avgChrF: number }>;
} {
  if (results.length === 0) {
    return { count: 0, avgChrF: 0, placeholderPassRate: 0, byLanguage: {} };
  }

  const totalChrF = results.reduce((sum, r) => sum + r.chrfScore, 0);
  const placeholderPassed = results.filter((r) => r.placeholderCheck.passed).length;

  const byLanguage: Record<string, { count: number; totalChrF: number }> = {};
  for (const r of results) {
    if (!byLanguage[r.targetLang]) {
      byLanguage[r.targetLang] = { count: 0, totalChrF: 0 };
    }
    byLanguage[r.targetLang].count++;
    byLanguage[r.targetLang].totalChrF += r.chrfScore;
  }

  const byLanguageFinal: Record<string, { count: number; avgChrF: number }> = {};
  for (const [lang, data] of Object.entries(byLanguage)) {
    byLanguageFinal[lang] = {
      count: data.count,
      avgChrF: data.totalChrF / data.count,
    };
  }

  return {
    count: results.length,
    avgChrF: totalChrF / results.length,
    placeholderPassRate: placeholderPassed / results.length,
    byLanguage: byLanguageFinal,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function extractCharNgrams(text: string, n: number): Map<string, number> {
  const ngrams = new Map<string, number>();
  // Remove whitespace for character-level comparison
  const cleaned = text.replace(/\s+/g, " ").trim();
  for (let i = 0; i <= cleaned.length - n; i++) {
    const ngram = cleaned.substring(i, i + n);
    ngrams.set(ngram, (ngrams.get(ngram) ?? 0) + 1);
  }
  return ngrams;
}

function ngramOverlap(
  hypothesis: Map<string, number>,
  reference: Map<string, number>
): { precision: number; recall: number } {
  let matchCount = 0;
  let hypTotal = 0;
  let refTotal = 0;

  for (const [ngram, count] of hypothesis) {
    hypTotal += count;
    const refCount = reference.get(ngram) ?? 0;
    matchCount += Math.min(count, refCount);
  }

  for (const [_, count] of reference) {
    refTotal += count;
  }

  const precision = hypTotal > 0 ? matchCount / hypTotal : 0;
  const recall = refTotal > 0 ? matchCount / refTotal : 0;

  return { precision, recall };
}
