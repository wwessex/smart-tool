/**
 * SMART Action Checker
 * Auto-detects Specific, Measurable, Achievable, Relevant, Time-bound elements
 * Enhanced with semantic scoring, weak language detection, and barrier alignment
 */

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

// Patterns for detection
const SPECIFIC_PATTERNS = {
  who: /\b(I|we|he|she|they|participant|advisor|john|jane|[A-Z][a-z]+)\s+(will|agreed|has|have|is going to|shall)/i,
  what: /\b(will|agreed to|has agreed|have agreed|is going to|shall|must)\s+\w+/i,
  where: /\b(at|in|to|from|via|through|online|website|centre|center|library|jobcentre|job centre|office)\b/i,
  action: /\b(apply|submit|attend|complete|register|create|update|search|contact|call|email|visit|speak|meet|write|prepare|research)\b/i,
};

const MEASURABLE_PATTERNS = {
  // Fixed date pattern to handle formats like "30-Jan-26", "30 Jan 26", "30/01/26"
  quantity: /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|several|multiple|at least|minimum|maximum)\b/i,
  date: /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}[-\s]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[-\s]*\d{2,4}|\d{1,2}(st|nd|rd|th)?[-\s]*(of[-\s]*)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|by\s+\w+day|within\s+\d+\s*(days?|weeks?|months?))\b/i,
  frequency: /\b(daily|weekly|monthly|every\s+\w+|twice|once|per\s+(day|week|month))\b/i,
  target: /\b(applications?|interviews?|contacts?|calls?|jobs?|opportunities|employers?)\b/i,
  outcome: /\b(result|outcome|achieve|complete|finish|receive|submit|attend|obtain|acquire|gain|secure|present|findings|review)\b/i,
};

const ACHIEVABLE_PATTERNS = {
  agreement: /\b(agreed|discussed|realistic|achievable|can|able|willing|committed|confirmed|understood)\b/i,
  responsibility: /\b(participant|advisor|I|we|they|he|she)\s+(will|has agreed|have agreed|is responsible|takes responsibility)\b/i,
  support: /\b(with support|help from|assistance|guidance|together|advisor will)\b/i,
  commitment: /\b(commits? to|undertakes? to|pledges? to|promises? to)\b/i,
  // Additional patterns for AI-generated fixes
  hasAgreedTo: /\bhas agreed to\b/i,
  agreedTo: /\bagreed to\b/i,
};

const RELEVANT_PATTERNS = {
  barrier: /\b(barrier|challenge|obstacle|issue|problem|difficulty|lack of|need|gap)\b/i,
  goal: /\b(employment|job|work|career|role|position|opportunity|goal|objective|aim)\b/i,
  connection: /\b(help|enable|allow|support|improve|increase|enhance|develop|build|gain|acquire|address|overcome|resolve)\b/i,
};

const TIMEBOUND_PATTERNS = {
  deadline: /\b(by|before|until|within|no later than)\s+(\d|next|this|end of)/i,
  review: /\b(review(ed)?|check|follow[- ]?up|progress|revisit)\s*(in|on|at|within|after)?\s*(\d+\s*)?(days?|weeks?|months?|next)?/i,
  // Fixed to match hyphenated dates like "30-Jan-26" as well as spaced dates
  specific_date: /\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b|\b\d{1,2}[-\s]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[-\s]*\d{2,4}\b|\b\d{1,2}(st|nd|rd|th)?[-\s]*(of[-\s]*)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i,
  timeframe: /\b(today|tomorrow|this week|next week|this month|next month|immediate|soon)\b/i,
};

// Weak language patterns - these weaken SMART actions
const WEAK_PATTERNS = {
  vague: /\b(try|maybe|might|possibly|consider|hope|attempt|think about|look into|explore)\b/i,
  passive: /\b(should be|could be|would be|may be|might be)\b/i,
  uncertain: /\b(if possible|when possible|as soon as|sometime|eventually|at some point)\b/i,
};

// Strong action verbs that indicate commitment
const STRONG_VERB_PATTERN = /\b(will|shall|agrees to|commits to|is responsible for|has agreed to|undertakes to)\b/i;

// Barrier-to-action keyword mappings for better relevance detection
const BARRIER_KEYWORDS: Record<string, string[]> = {
  'transport': ['bus', 'train', 'travel', 'route', 'journey', 'commute', 'driving', 'license', 'licence', 'car'],
  'childcare': ['childcare', 'nursery', 'school', 'pick up', 'drop off', 'hours', 'flexible', 'children'],
  'cv': ['cv', 'resume', 'application', 'experience', 'skills', 'template', 'format', 'update'],
  'confidence': ['confidence', 'interview', 'practice', 'skills', 'presentation', 'anxiety', 'support'],
  'digital': ['computer', 'online', 'internet', 'email', 'website', 'digital', 'technology', 'access'],
  'health': ['health', 'medical', 'doctor', 'gp', 'appointment', 'condition', 'support', 'wellbeing'],
  'housing': ['housing', 'accommodation', 'rent', 'address', 'stable', 'home', 'council'],
  'training': ['training', 'course', 'qualification', 'certificate', 'learn', 'skill', 'develop'],
  'experience': ['experience', 'volunteer', 'placement', 'internship', 'work trial', 'reference'],
  'id': ['id', 'passport', 'driving licence', 'birth certificate', 'proof', 'identity', 'document'],
  'disclosure': ['disclosure', 'dbs', 'criminal', 'record', 'conviction', 'background'],
  'language': ['english', 'esol', 'language', 'speak', 'communicate', 'interpreter', 'translation'],
  'finance': ['money', 'debt', 'budget', 'benefit', 'income', 'payment', 'financial', 'bank'],
  'interview': ['interview', 'prepare', 'practice', 'questions', 'answers', 'technique', 'mock'],
  'sector': ['sector', 'industry', 'field', 'career', 'pathway', 'options', 'explore', 'research'],
};

function countMatches(text: string, patterns: Record<string, RegExp>): number {
  return Object.values(patterns).filter(pattern => pattern.test(text)).length;
}

function hasWeakLanguage(text: string): { hasWeak: boolean; matches: string[] } {
  const matches: string[] = [];
  for (const [key, pattern] of Object.entries(WEAK_PATTERNS)) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0].toLowerCase());
    }
  }
  return { hasWeak: matches.length > 0, matches };
}

function checkBarrierAlignment(action: string, barrier?: string): { aligned: boolean; keywords: string[] } {
  if (!barrier) return { aligned: false, keywords: [] };
  
  const barrierLower = barrier.toLowerCase();
  const actionLower = action.toLowerCase();
  
  // Find matching barrier category
  for (const [category, keywords] of Object.entries(BARRIER_KEYWORDS)) {
    if (barrierLower.includes(category) || keywords.some(kw => barrierLower.includes(kw))) {
      // Check if action mentions relevant keywords
      const matchedKeywords = keywords.filter(kw => actionLower.includes(kw));
      if (matchedKeywords.length > 0) {
        return { aligned: true, keywords: matchedKeywords };
      }
    }
  }
  
  // Fallback: check if barrier words appear in action
  const barrierWords = barrierLower.split(/\s+/).filter(w => w.length > 3);
  const matchedWords = barrierWords.filter(w => actionLower.includes(w));
  return { aligned: matchedWords.length > 0, keywords: matchedWords };
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

export function checkSmart(text: string, meta?: {
  forename?: string;
  barrier?: string;
  timescale?: string;
  date?: string;
}): SmartCheck {
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
  const specificMatches = countMatches(text, SPECIFIC_PATTERNS);
  const hasForename = meta?.forename && text.toLowerCase().includes(meta.forename.toLowerCase());
  const specificScore = specificMatches + (hasForename ? 1 : 0);
  
  const specific: SmartCriterion = {
    met: specificScore >= 2,
    confidence: specificScore >= 3 ? 'high' : specificScore >= 2 ? 'medium' : 'low',
    reason: specificScore >= 2 
      ? `Contains ${hasForename ? 'name, ' : ''}action, and context`
      : 'Add WHO will do WHAT and WHERE',
    hint: !hasForename && meta?.forename ? `Consider starting with "${meta.forename} will..."` : undefined,
  };
  specific.suggestion = generateSuggestion('specific', specific, meta);

  // MEASURABLE check
  const measurableMatches = countMatches(fullContext, MEASURABLE_PATTERNS);
  const hasDate = MEASURABLE_PATTERNS.date.test(fullContext);
  const hasQuantity = MEASURABLE_PATTERNS.quantity.test(text);
  const hasOutcome = MEASURABLE_PATTERNS.outcome.test(text);
  
  const measurable: SmartCriterion = {
    met: measurableMatches >= 2 || (hasDate && (hasQuantity || hasOutcome)),
    confidence: measurableMatches >= 3 ? 'high' : measurableMatches >= 2 ? 'medium' : 'low',
    reason: measurableMatches >= 2 || (hasDate && (hasQuantity || hasOutcome))
      ? [hasDate && 'date', hasQuantity && 'quantity', hasOutcome && !hasQuantity && 'outcome'].filter(Boolean).join(' and ') || 'Has measurable elements'
      : 'Add a specific date or quantity',
    hint: !hasQuantity ? 'Try adding a number like "2 applications" or "3 contacts"' : undefined,
  };
  measurable.suggestion = generateSuggestion('measurable', measurable, meta);

  // ACHIEVABLE check - check for agreement language with more flexibility
  const achievableMatches = countMatches(text, ACHIEVABLE_PATTERNS);
  const hasAgreement = ACHIEVABLE_PATTERNS.agreement.test(text);
  const hasCommitment = ACHIEVABLE_PATTERNS.commitment.test(text);
  const hasSupport = ACHIEVABLE_PATTERNS.support.test(text);
  const hasAgreedTo = ACHIEVABLE_PATTERNS.hasAgreedTo.test(text) || ACHIEVABLE_PATTERNS.agreedTo.test(text);
  
  // More lenient: "has agreed to" or "agreed to" in text is strong enough on its own
  const achievableMet = achievableMatches >= 2 || hasCommitment || (hasAgreement && hasSupport) || hasAgreedTo;
  
  const achievable: SmartCriterion = {
    met: achievableMet,
    confidence: achievableMatches >= 3 || hasCommitment || hasAgreedTo ? 'high' : achievableMatches >= 2 ? 'medium' : 'low',
    reason: achievableMet
      ? hasCommitment ? 'Shows clear commitment' : hasAgreedTo ? 'Shows explicit agreement' : hasAgreement ? 'Shows agreement and commitment' : 'Responsibility is clear'
      : 'Add who agreed or is responsible',
    hint: !hasAgreement ? 'Add "discussed and agreed" or "has committed to"' : undefined,
  };
  achievable.suggestion = generateSuggestion('achievable', achievable, meta);

  // RELEVANT check - now includes barrier alignment
  const relevantMatches = countMatches(fullContext, RELEVANT_PATTERNS);
  const hasBarrierRef = meta?.barrier && lowerText.includes(meta.barrier.toLowerCase().slice(0, 10));
  const hasGoalConnection = RELEVANT_PATTERNS.goal.test(fullContext) && RELEVANT_PATTERNS.connection.test(text);
  const barrierAlignment = checkBarrierAlignment(text, meta?.barrier);
  
  const relevant: SmartCriterion = {
    met: relevantMatches >= 2 || hasBarrierRef || hasGoalConnection || barrierAlignment.aligned,
    confidence: (barrierAlignment.aligned && hasGoalConnection) || (hasBarrierRef && hasGoalConnection) ? 'high' : relevantMatches >= 2 ? 'medium' : 'low',
    reason: barrierAlignment.aligned 
      ? `Addresses barrier with: ${barrierAlignment.keywords.slice(0, 2).join(', ')}`
      : hasBarrierRef || hasGoalConnection 
        ? 'Connected to barrier and employment goal'
        : 'Link action to the barrier or employment goal',
    hint: meta?.barrier ? `Explain how this addresses "${meta.barrier}"` : 'Add how this helps with employment',
  };
  relevant.suggestion = generateSuggestion('relevant', relevant, meta);

  // TIME-BOUND check
  const timeboundMatches = countMatches(fullContext, TIMEBOUND_PATTERNS);
  const hasTimescale = !!meta?.timescale;
  const hasSpecificDate = TIMEBOUND_PATTERNS.specific_date.test(fullContext);
  
  const timeBound: SmartCriterion = {
    met: timeboundMatches >= 1 || hasTimescale,
    confidence: (hasSpecificDate && hasTimescale) ? 'high' : timeboundMatches >= 1 ? 'medium' : 'low',
    reason: hasTimescale || timeboundMatches >= 1
      ? `${hasSpecificDate ? 'Has deadline' : ''}${hasSpecificDate && hasTimescale ? ' and ' : ''}${hasTimescale ? 'review scheduled' : ''}`
      : 'Add a deadline or review date',
    hint: !hasSpecificDate ? 'Add a specific date like "by 20-Jan-26"' : undefined,
  };
  timeBound.suggestion = generateSuggestion('timeBound', timeBound, meta);

  // Calculate overall score with semantic penalty
  const criteria = [specific, measurable, achievable, relevant, timeBound];
  const overallScore = criteria.filter(c => c.met).length;
  
  // Semantic penalty for weak language (reduce effective score for display purposes)
  // Note: We don't actually reduce the score number, but we add warnings
  if (weakCheck.hasWeak && overallScore >= 4) {
    warnings.push('Score is high but weak language may undermine the action\'s clarity.');
  }

  return {
    specific,
    measurable,
    achievable,
    relevant,
    timeBound,
    overallScore,
    warnings,
  };
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
