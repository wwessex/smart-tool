/**
 * SMART Action Checker
 * Auto-detects Specific, Measurable, Achievable, Relevant, Time-bound elements
 */

export interface SmartCriterion {
  met: boolean;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  hint?: string;
}

export interface SmartCheck {
  specific: SmartCriterion;
  measurable: SmartCriterion;
  achievable: SmartCriterion;
  relevant: SmartCriterion;
  timeBound: SmartCriterion;
  overallScore: number; // 0-5
}

// Patterns for detection
const SPECIFIC_PATTERNS = {
  who: /\b(I|we|he|she|they|participant|advisor|john|jane|[A-Z][a-z]+)\s+(will|agreed|has|have|is going to|shall)/i,
  what: /\b(will|agreed to|has agreed|have agreed|is going to|shall|must)\s+\w+/i,
  where: /\b(at|in|to|from|via|through|online|website|centre|center|library|jobcentre|job centre|office)\b/i,
  action: /\b(apply|submit|attend|complete|register|create|update|search|contact|call|email|visit|speak|meet|write|prepare|research)\b/i,
};

const MEASURABLE_PATTERNS = {
  quantity: /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|several|multiple|at least|minimum|maximum)\b/i,
  date: /\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{1,2}(st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|by\s+\w+day|within\s+\d+\s*(days?|weeks?|months?))\b/i,
  frequency: /\b(daily|weekly|monthly|every\s+\w+|twice|once|per\s+(day|week|month))\b/i,
  target: /\b(applications?|interviews?|contacts?|calls?|jobs?|opportunities|employers?)\b/i,
};

const ACHIEVABLE_PATTERNS = {
  agreement: /\b(agreed|discussed|realistic|achievable|can|able|willing|committed|confirmed)\b/i,
  responsibility: /\b(participant|advisor|I|we|they|he|she)\s+(will|has agreed|have agreed|is responsible)\b/i,
  support: /\b(with support|help from|assistance|guidance|together)\b/i,
};

const RELEVANT_PATTERNS = {
  barrier: /\b(barrier|challenge|obstacle|issue|problem|difficulty|lack of|need|gap)\b/i,
  goal: /\b(employment|job|work|career|role|position|opportunity|goal|objective|aim)\b/i,
  connection: /\b(help|enable|allow|support|improve|increase|enhance|develop|build|gain|acquire)\b/i,
};

const TIMEBOUND_PATTERNS = {
  deadline: /\b(by|before|until|within|no later than)\s+(\d|next|this|end of)/i,
  review: /\b(review(ed)?|check|follow[- ]?up|progress|revisit)\s*(in|on|at|within|after)?\s*(\d+\s*)?(days?|weeks?|months?|next)?/i,
  specific_date: /\b\d{1,2}[-\/\.]\d{1,2}[-\/\.]\d{2,4}\b|\b\d{1,2}(st|nd|rd|th)?\s*(of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i,
  timeframe: /\b(today|tomorrow|this week|next week|this month|next month|immediate|soon)\b/i,
};

function countMatches(text: string, patterns: Record<string, RegExp>): number {
  return Object.values(patterns).filter(pattern => pattern.test(text)).length;
}

export function checkSmart(text: string, meta?: {
  forename?: string;
  barrier?: string;
  timescale?: string;
  date?: string;
}): SmartCheck {
  const lowerText = text.toLowerCase();
  const fullContext = [text, meta?.barrier, meta?.timescale].filter(Boolean).join(' ');

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

  // MEASURABLE check
  const measurableMatches = countMatches(fullContext, MEASURABLE_PATTERNS);
  const hasDate = MEASURABLE_PATTERNS.date.test(fullContext);
  const hasQuantity = MEASURABLE_PATTERNS.quantity.test(text);
  
  const measurable: SmartCriterion = {
    met: measurableMatches >= 2 || (hasDate && hasQuantity),
    confidence: measurableMatches >= 3 ? 'high' : measurableMatches >= 2 ? 'medium' : 'low',
    reason: measurableMatches >= 2 
      ? `Contains ${hasDate ? 'date' : ''}${hasDate && hasQuantity ? ' and ' : ''}${hasQuantity ? 'quantity' : ''}`
      : 'Add a specific date or quantity',
    hint: !hasQuantity ? 'Try adding a number like "2 applications" or "3 contacts"' : undefined,
  };

  // ACHIEVABLE check
  const achievableMatches = countMatches(text, ACHIEVABLE_PATTERNS);
  const hasAgreement = ACHIEVABLE_PATTERNS.agreement.test(text);
  
  const achievable: SmartCriterion = {
    met: achievableMatches >= 1,
    confidence: achievableMatches >= 2 ? 'high' : achievableMatches >= 1 ? 'medium' : 'low',
    reason: achievableMatches >= 1 
      ? hasAgreement ? 'Shows agreement and commitment' : 'Responsibility is clear'
      : 'Add who agreed or is responsible',
    hint: !hasAgreement ? 'Add "discussed and agreed" or "has committed to"' : undefined,
  };

  // RELEVANT check
  const relevantMatches = countMatches(fullContext, RELEVANT_PATTERNS);
  const hasBarrierRef = meta?.barrier && lowerText.includes(meta.barrier.toLowerCase().slice(0, 10));
  const hasGoalConnection = RELEVANT_PATTERNS.goal.test(fullContext) && RELEVANT_PATTERNS.connection.test(text);
  
  const relevant: SmartCriterion = {
    met: relevantMatches >= 2 || hasBarrierRef || hasGoalConnection,
    confidence: (hasBarrierRef && hasGoalConnection) ? 'high' : relevantMatches >= 2 ? 'medium' : 'low',
    reason: hasBarrierRef || hasGoalConnection 
      ? 'Connected to barrier and employment goal'
      : 'Link action to the barrier or employment goal',
    hint: meta?.barrier ? `Explain how this addresses "${meta.barrier}"` : 'Add how this helps with employment',
  };

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

  // Calculate overall score
  const criteria = [specific, measurable, achievable, relevant, timeBound];
  const overallScore = criteria.filter(c => c.met).length;

  return {
    specific,
    measurable,
    achievable,
    relevant,
    timeBound,
    overallScore,
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
