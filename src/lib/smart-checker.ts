/**
 * SMART Action Checker
 * Auto-detects Specific, Measurable, Achievable, Relevant, Time-bound elements
 * Enhanced with semantic scoring, weak language detection, barrier alignment, and caching
 */

import {
  SPECIFIC_PATTERNS,
  MEASURABLE_PATTERNS,
  ACHIEVABLE_PATTERNS,
  RELEVANT_PATTERNS,
  TIMEBOUND_PATTERNS,
  WEAK_PATTERNS,
  STRONG_VERB_PATTERN,
  BARRIER_KEYWORDS,
} from './smart-patterns';

export interface SmartCriterion {
  met: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  hint?: string;
  suggestion?: string; // Dynamic, contextual suggestion
}

export interface SmartCheck {
  specific: SmartCriterion;
  measurable: SmartCriterion;
  achievable: SmartCriterion;
  relevant: SmartCriterion;
  timeBound: SmartCriterion;
  overallScore: number; // 0-5
  warnings: string[]; // Semantic warnings (weak language, etc.)
}

// ============= LRU Cache for checkSmart results =============
interface CacheEntry {
  result: SmartCheck;
  timestamp: number;
}

const CACHE_MAX_SIZE = 100;
const CACHE_TTL_MS = 60000; // 1 minute TTL
const smartCheckCache = new Map<string, CacheEntry>();

function getCacheKey(text: string, meta?: { forename?: string; barrier?: string; timescale?: string; date?: string }): string {
  return `${text}|${meta?.forename ?? ''}|${meta?.barrier ?? ''}|${meta?.timescale ?? ''}|${meta?.date ?? ''}`;
}

function getFromCache(key: string): SmartCheck | null {
  const entry = smartCheckCache.get(key);
  if (!entry) return null;

  // Check TTL
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    smartCheckCache.delete(key);
    return null;
  }

  return entry.result;
}

function setInCache(key: string, result: SmartCheck): void {
  // Evict oldest entries if cache is full
  if (smartCheckCache.size > CACHE_MAX_SIZE) {
    const oldestKey = smartCheckCache.keys().next().value;
    if (oldestKey) smartCheckCache.delete(oldestKey);
  }

  smartCheckCache.set(key, { result, timestamp: Date.now() });
}

// Export for testing/debugging
export function clearSmartCache(): void {
  smartCheckCache.clear();
}

export function getSmartCacheStats(): { size: number; maxSize: number } {
  return { size: smartCheckCache.size, maxSize: CACHE_MAX_SIZE };
}

// ============= Optimized Pattern Matching =============
// Cache pattern test results within a single checkSmart call
function countMatchesWithCache(text: string, patterns: Record<string, RegExp>, cache: Map<string, boolean>): number {
  let count = 0;
  for (const [key, pattern] of Object.entries(patterns)) {
    const cacheKey = `${key}:${pattern.source}`;
    let result = cache.get(cacheKey);
    if (result === undefined) {
      result = pattern.test(text);
      cache.set(cacheKey, result);
    }
    if (result) count++;
  }
  return count;
}

function hasWeakLanguage(text: string): { hasWeak: boolean; matches: string[] } {
  const matches: string[] = [];
  for (const [, pattern] of Object.entries(WEAK_PATTERNS)) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0].toLowerCase());
    }
  }
  return { hasWeak: matches.length > 0, matches };
}

function checkBarrierAlignment(action: string, barrier?: string): { aligned: boolean; keywords: string[]; confidence: 'high' | 'medium' | 'low' } {
  if (!barrier) return { aligned: false, keywords: [], confidence: 'low' };
  
  const barrierLower = barrier.toLowerCase();
  const actionLower = action.toLowerCase();
  const matchedKeywords: string[] = [];
  
  // Check all barrier categories for matches
  for (const [category, keywords] of Object.entries(BARRIER_KEYWORDS)) {
    // Check if barrier mentions this category
    const barrierMatchesCategory = barrierLower.includes(category) || keywords.some(kw => barrierLower.includes(kw));
    
    if (barrierMatchesCategory) {
      // Find all matching keywords in action
      const actionMatches = keywords.filter(kw => actionLower.includes(kw));
      matchedKeywords.push(...actionMatches);
    }
  }
  
  // Remove duplicates
  const uniqueKeywords = [...new Set(matchedKeywords)];
  
  // Determine confidence based on number of matches
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (uniqueKeywords.length >= 3) confidence = 'high';
  else if (uniqueKeywords.length >= 1) confidence = 'medium';
  
  if (uniqueKeywords.length > 0) {
    return { aligned: true, keywords: uniqueKeywords, confidence };
  }
  
  // Fallback: check if any barrier words (>3 chars) appear in action
  const barrierWords = barrierLower.split(/\s+/).filter(w => w.length > 3);
  const matchedWords = barrierWords.filter(w => actionLower.includes(w));
  
  return { 
    aligned: matchedWords.length > 0, 
    keywords: matchedWords,
    confidence: matchedWords.length >= 2 ? 'medium' : 'low'
  };
}

function generateSuggestion(key: string, criterion: SmartCriterion, meta?: {
  forename?: string;
  barrier?: string;
}): string | undefined {
  if (criterion.met) return undefined;
  
  switch (key) {
    case 'specific':
      if (meta?.forename) {
        return `Try: "${meta.forename} will [action] at [location]"`;
      }
      return 'Add: "[Name] will [do what] at [where]"';
    
    case 'measurable':
      return 'Add a number or date, e.g., "2 applications by 20-Jan-26"';
    
    case 'achievable':
      return 'Add: "has discussed and agreed to..." or "with support from advisor"';
    
    case 'relevant':
      if (meta?.barrier) {
        return `Link to "${meta.barrier}" - explain how this helps`;
      }
      return 'Explain how this action helps with the employment goal';
    
    case 'timeBound':
      return 'Add a deadline: "by [date]" or "within [timeframe]"';
    
    default:
      return undefined;
  }
}

// ============= Weighted Confidence Scoring =============
function calculateConfidence(matches: number, thresholds: { high: number; medium: number }): 'high' | 'medium' | 'low' {
  if (matches >= thresholds.high) return 'high';
  if (matches >= thresholds.medium) return 'medium';
  return 'low';
}

export function checkSmart(text: string, meta?: {
  forename?: string;
  barrier?: string;
  timescale?: string;
  date?: string;
}): SmartCheck {
  // Check cache first
  const cacheKey = getCacheKey(text, meta);
  const cached = getFromCache(cacheKey);
  if (cached) return cached;

  // Pattern match cache for this call
  const patternCache = new Map<string, boolean>();
  
  const lowerText = text.toLowerCase();
  const fullContext = [text, meta?.barrier, meta?.timescale].filter(Boolean).join(' ');
  const warnings: string[] = [];

  // Check for weak language
  const weakCheck = hasWeakLanguage(text);
  if (weakCheck.hasWeak) {
    warnings.push(`Weak language detected: "${weakCheck.matches.join('", "')}". Use stronger commitment words.`);
  }

  // Check for strong verbs
  const hasStrongVerb = STRONG_VERB_PATTERN.test(text);
  if (!hasStrongVerb && text.length > 20) {
    warnings.push('Consider using commitment language like "will", "agrees to", or "commits to".');
  }

  // SPECIFIC check
  const specificMatches = countMatchesWithCache(text, SPECIFIC_PATTERNS, patternCache);
  const hasForename = meta?.forename && lowerText.includes(meta.forename.toLowerCase());
  const specificScore = specificMatches + (hasForename ? 1 : 0);
  
  const specific: SmartCriterion = {
    met: specificScore >= 2,
    confidence: calculateConfidence(specificScore, { high: 3, medium: 2 }),
    reason: specificScore >= 2 
      ? `Contains ${hasForename ? 'name, ' : ''}action, and context`
      : 'Add WHO will do WHAT and WHERE',
    hint: !hasForename && meta?.forename ? `Consider starting with "${meta.forename} will..."` : undefined,
  };
  specific.suggestion = generateSuggestion('specific', specific, meta);

  // MEASURABLE check
  const measurableMatches = countMatchesWithCache(fullContext, MEASURABLE_PATTERNS, patternCache);
  const hasDate = MEASURABLE_PATTERNS.date.test(fullContext);
  const hasQuantity = MEASURABLE_PATTERNS.quantity.test(text);
  const hasOutcome = MEASURABLE_PATTERNS.outcome.test(text);
  
  const measurableMet = measurableMatches >= 2 || (hasDate && (hasQuantity || hasOutcome));
  const measurableConfidenceRaw = calculateConfidence(measurableMatches, { high: 3, medium: 2 });
  // If met via date+quantity/outcome combination, confidence should be at least 'medium'
  const measurableConfidence: 'high' | 'medium' | 'low' = measurableMet && measurableConfidenceRaw === 'low' ? 'medium' : measurableConfidenceRaw;

  const measurable: SmartCriterion = {
    met: measurableMet,
    confidence: measurableConfidence,
    reason: measurableMatches >= 2 || (hasDate && (hasQuantity || hasOutcome))
      ? [hasDate && 'date', hasQuantity && 'quantity', hasOutcome && !hasQuantity && 'outcome'].filter(Boolean).join(' and ') || 'Has measurable elements'
      : 'Add a specific date or quantity',
    hint: !hasQuantity ? 'Try adding a number like "2 applications" or "3 contacts"' : undefined,
  };
  measurable.suggestion = generateSuggestion('measurable', measurable, meta);

  // ACHIEVABLE check
  const achievableMatches = countMatchesWithCache(text, ACHIEVABLE_PATTERNS, patternCache);
  const hasAgreement = ACHIEVABLE_PATTERNS.agreement.test(text);
  const hasCommitment = ACHIEVABLE_PATTERNS.commitment.test(text);
  const hasSupport = ACHIEVABLE_PATTERNS.support.test(text);
  const hasAgreedTo = ACHIEVABLE_PATTERNS.hasAgreedTo.test(text) || ACHIEVABLE_PATTERNS.agreedTo.test(text);
  const hasRealisticAchievable = ACHIEVABLE_PATTERNS.realisticAchievable.test(text);
  
  const achievableMet = achievableMatches >= 2 || hasCommitment || (hasAgreement && hasSupport) || hasAgreedTo || hasRealisticAchievable || hasSupport;
  
  const achievable: SmartCriterion = {
    met: achievableMet,
    confidence: achievableMatches >= 3 || hasCommitment || hasAgreedTo || hasRealisticAchievable ? 'high' : achievableMatches >= 2 ? 'medium' : 'low',
    reason: achievableMet
      ? hasCommitment ? 'Shows clear commitment' : hasAgreedTo ? 'Shows explicit agreement' : hasRealisticAchievable ? 'Confirmed realistic and achievable' : hasAgreement ? 'Shows agreement and commitment' : 'Responsibility is clear'
      : 'Add who agreed or is responsible',
    hint: !hasAgreement ? 'Add "discussed and agreed" or "has committed to"' : undefined,
  };
  achievable.suggestion = generateSuggestion('achievable', achievable, meta);

  // RELEVANT check - now includes barrier alignment with improved matching
  const relevantMatches = countMatchesWithCache(fullContext, RELEVANT_PATTERNS, patternCache);
  // Check if any significant word from the barrier (3+ chars) appears in the action text
  const hasBarrierRef = meta?.barrier && meta.barrier.toLowerCase()
    .split(/\s+/)
    .filter(word => word.length >= 3 && !['and', 'the', 'for', 'with'].includes(word))
    .some(word => lowerText.includes(word));
  const hasGoalConnection = RELEVANT_PATTERNS.goal.test(fullContext) && RELEVANT_PATTERNS.connection.test(text);
  const hasTaskActivity = RELEVANT_PATTERNS.taskBased.test(fullContext);
  const barrierAlignment = checkBarrierAlignment(text, meta?.barrier);
  
  const relevantMet = relevantMatches >= 2 || hasBarrierRef || hasGoalConnection || barrierAlignment.aligned || hasTaskActivity;
  
  // Determine confidence with weighted approach
  let relevantConfidence: 'high' | 'medium' | 'low' = 'low';
  if (barrierAlignment.aligned && barrierAlignment.confidence === 'high') relevantConfidence = 'high';
  else if ((barrierAlignment.aligned && hasGoalConnection) || (hasBarrierRef && hasGoalConnection) || hasTaskActivity) relevantConfidence = 'high';
  else if (relevantMatches >= 2 || barrierAlignment.aligned) relevantConfidence = 'medium';
  
  const relevant: SmartCriterion = {
    met: relevantMet,
    confidence: relevantConfidence,
    reason: barrierAlignment.aligned 
      ? `Addresses barrier with: ${barrierAlignment.keywords.slice(0, 3).join(', ')}`
      : hasTaskActivity
        ? 'Activity supports employment goal'
        : hasBarrierRef || hasGoalConnection 
          ? 'Connected to barrier and employment goal'
          : 'Link action to the barrier or employment goal',
    hint: meta?.barrier ? `Explain how this addresses "${meta.barrier}"` : 'Add how this helps with employment',
  };
  relevant.suggestion = generateSuggestion('relevant', relevant, meta);

  // TIME-BOUND check
  const timeboundMatches = countMatchesWithCache(fullContext, TIMEBOUND_PATTERNS, patternCache);
  const hasTimescale = !!meta?.timescale;
  const hasSpecificDate = TIMEBOUND_PATTERNS.specific_date.test(fullContext);
  
  const timeBound: SmartCriterion = {
    met: timeboundMatches >= 1 || hasTimescale,
    confidence: (hasSpecificDate && hasTimescale) ? 'high' : hasSpecificDate || timeboundMatches >= 2 ? 'medium' : 'low',
    reason: hasTimescale || timeboundMatches >= 1
      ? `${hasSpecificDate ? 'Has deadline' : ''}${hasSpecificDate && hasTimescale ? ' and ' : ''}${hasTimescale ? 'review scheduled' : ''}`
      : 'Add a deadline or review date',
    hint: !hasSpecificDate ? 'Add a specific date like "by 20-Jan-26"' : undefined,
  };
  timeBound.suggestion = generateSuggestion('timeBound', timeBound, meta);

  // Calculate overall score
  const criteria = [specific, measurable, achievable, relevant, timeBound];
  const overallScore = criteria.filter(c => c.met).length;
  
  // Semantic warning for weak language with high score
  if (weakCheck.hasWeak && overallScore >= 4) {
    warnings.push('Score is high but weak language may undermine the action\'s clarity.');
  }

  const result: SmartCheck = {
    specific,
    measurable,
    achievable,
    relevant,
    timeBound,
    overallScore,
    warnings,
  };

  // Cache the result
  setInCache(cacheKey, result);

  return result;
}

export function getSmartLabel(score: number): string {
  if (score === 5) return 'Excellent';
  if (score >= 4) return 'Good';
  if (score >= 3) return 'Fair';
  if (score >= 2) return 'Needs work';
  return 'Incomplete';
}

export function getSmartColor(score: number): string {
  if (score === 5) return 'text-green-600';
  if (score >= 4) return 'text-green-500';
  if (score >= 3) return 'text-amber-500';
  if (score >= 2) return 'text-orange-500';
  return 'text-destructive';
}

// Utility to get improvement priority
export function getImprovementPriority(check: SmartCheck): string[] {
  const priorities: { key: string; label: string; weight: number }[] = [];
  
  if (!check.specific.met) priorities.push({ key: 'specific', label: 'Add who, what, where', weight: 5 });
  if (!check.timeBound.met) priorities.push({ key: 'timeBound', label: 'Add deadline', weight: 4 });
  if (!check.measurable.met) priorities.push({ key: 'measurable', label: 'Add quantity or date', weight: 3 });
  if (!check.achievable.met) priorities.push({ key: 'achievable', label: 'Show agreement', weight: 2 });
  if (!check.relevant.met) priorities.push({ key: 'relevant', label: 'Link to barrier', weight: 1 });
  
  return priorities.sort((a, b) => b.weight - a.weight).map(p => p.label);
}
