/**
 * Canonical SMART Criteria Patterns
 *
 * Single source of truth for all pattern-based SMART analysis.
 * Used by:
 *   - src/lib/smart-checker.ts (frontend real-time scoring)
 *   - browser-native-llm/validators/smart-validator.ts (post-generation validation — kept in sync manually)
 *   - browser-native-llm/relevance/barrier-relevance.ts (barrier relevance scoring — kept in sync manually)
 */

// ============= Enhanced date pattern =============
export const ENHANCED_DATE_PATTERN = /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}[-\s]*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\s]*\d{2,4}|\d{1,2}(st|nd|rd|th)?[-\s]*(of[-\s]*)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\s]*,?[-\s]*\d{0,4}|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-\s]*\d{1,2}(st|nd|rd|th)?[-\s]*,?[-\s]*\d{0,4}|by\s+(next\s+)?\w+day|within\s+\d+\s*(days?|weeks?|months?)|end\s+of\s+(this|next)\s+(week|month)|next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month))\b/i;

// ============= SPECIFIC patterns =============
export const SPECIFIC_PATTERNS = {
  who: /\b(I|we|he|she|they|participant|advisor|john|jane|[A-Z][a-z]+)\s+(will|agreed|has|have|is going to|shall)/i,
  what: /\b(will|agreed to|has agreed|have agreed|is going to|shall|must|has confirmed)\s+\w+/i,
  where: /\b(at|in|to|from|via|through|online|website|centre|center|library|jobcentre|job centre|office|meeting|session|workshop|fair)\b/i,
  action: /\b(apply|submit|attend|complete|register|create|update|search|contact|call|email|visit|speak|meet|write|prepare|research|participate|practise|practice|review|bring|gather|book|schedule|discuss|identify|collect|confirm)\b/i,
};

// ============= MEASURABLE patterns =============
export const MEASURABLE_PATTERNS = {
  quantity: /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|several|multiple|at least|minimum|maximum)\b/i,
  date: ENHANCED_DATE_PATTERN,
  frequency: /\b(daily|weekly|monthly|every\s+\w+|twice|once|per\s+(day|week|month))\b/i,
  target: /\b(applications?|interviews?|contacts?|calls?|jobs?|opportunities|employers?)\b/i,
  outcome: /\b(result|outcome|achieve|complete|finish|receive|submit|attend|obtain|acquire|gain|secure|present|findings|review)\b/i,
};

// ============= ACHIEVABLE patterns =============
export const ACHIEVABLE_PATTERNS = {
  agreement: /\b(agreed|discussed|realistic|achievable|can|able|willing|committed|confirmed|understood|as discussed and agreed)\b/i,
  responsibility: /\b(participant|advisor|I|we|they|he|she|[A-Z][a-z]+)\s+(will|has agreed|have agreed|is responsible|takes responsibility|agreed to)\b/i,
  support: /\b(with support|help from|assistance|guidance|together|advisor will|we have agreed|both realistic and achievable)\b/i,
  commitment: /\b(commits? to|undertakes? to|pledges? to|promises? to|we have agreed)\b/i,
  hasAgreedTo: /\bhas agreed to\b/i,
  agreedTo: /\b(agreed to|as discussed and agreed)\b/i,
  realisticAchievable: /\b(realistic and achievable|both realistic|is achievable|can achieve)\b/i,
};

// ============= RELEVANT patterns =============
export const RELEVANT_PATTERNS = {
  barrier: /\b(barrier|challenge|obstacle|issue|problem|difficulty|lack of|need|gap|development areas?)\b/i,
  goal: /\b(employment|job|work|career|role|position|opportunity|goal|objective|aim|next steps?|identified|participate|engagement)\b/i,
  connection: /\b(help|enable|allow|support|improve|increase|enhance|develop|build|gain|acquire|address|overcome|resolve|will|attend|complete|submit|participate)\b/i,
  taskBased: /\b(workshop|training|fair|event|interview|application|cv|course|session|meeting|assessment|appointment)\b/i,
};

// ============= TIME-BOUND patterns =============
export const TIMEBOUND_PATTERNS = {
  deadline: /\b(by|before|until|within|no later than)\s+(\d|next|this|end of)/i,
  review: /\b(review(ed)?|check|follow[- ]?up|progress|revisit)\s*(in|on|at|within|after)?\s*(\d+\s*)?(days?|weeks?|months?|next)?/i,
  specific_date: ENHANCED_DATE_PATTERN,
  timeframe: /\b(today|tomorrow|this week|next week|this month|next month|immediate|soon)\b/i,
};

// ============= Weak language patterns =============
export const WEAK_PATTERNS = {
  vague: /\b(try|maybe|might|possibly|consider|hope|attempt|think about|look into|explore)\b/i,
  passive: /\b(should be|could be|would be|may be|might be)\b/i,
  uncertain: /\b(if possible|when possible|as soon as|sometime|eventually|at some point)\b/i,
};

// ============= Strong verb pattern =============
export const STRONG_VERB_PATTERN = /\b(will|shall|agrees to|commits to|is responsible for|has agreed to|undertakes to)\b/i;

// ============= Canonical action verb vocabulary =============
// Shared between frontend checker and LLM validator.
// If you add a verb here, also add it to browser-native-llm/validators/smart-validator.ts SPECIFIC_VERBS.
export const ACTION_VERBS = [
  "apply", "submit", "attend", "complete", "register", "create", "update",
  "search", "contact", "call", "email", "visit", "speak", "meet", "write",
  "prepare", "research", "participate", "practise", "practice", "review",
  "bring", "gather", "book", "schedule", "discuss", "identify", "collect",
  "confirm", "send", "draft", "build", "tailor", "proofread", "set up",
  "configure", "list", "enrol", "enroll", "sign up", "download", "install",
  "upload", "edit", "revise", "organise", "organize", "track", "record",
  "request", "join", "follow",
] as const;

// ============= Canonical vague/anti-pattern terms =============
// Shared between frontend weak-language detection and LLM validator.
export const VAGUE_TERMS = [
  "try", "maybe", "might", "possibly", "consider", "hope", "attempt",
  "think about", "look into", "explore", "improve", "reflect on",
  "be aware of", "keep trying", "work on", "be better at",
] as const;

// ============= Barrier-to-action keyword mappings =============
// Used by smart-checker.ts for barrier alignment scoring.
// For LLM barrier relevance, see browser-native-llm/relevance/barrier-relevance.ts CATEGORY_KEYWORDS.
export const BARRIER_KEYWORDS: Record<string, string[]> = {
  'transport': ['bus', 'train', 'travel', 'route', 'journey', 'commute', 'driving', 'license', 'licence', 'car', 'taxi', 'cycle', 'cycling', 'walk', 'walking', 'fare', 'ticket'],
  'childcare': ['childcare', 'nursery', 'school', 'pick up', 'drop off', 'hours', 'flexible', 'children', 'family', 'wrap around', 'breakfast club', 'after school'],
  'cv': ['cv', 'resume', 'application', 'experience', 'skills', 'template', 'format', 'update', 'covering letter', 'cover letter', 'personal statement'],
  'confidence': ['confidence', 'interview', 'practice', 'skills', 'presentation', 'anxiety', 'support', 'self-esteem', 'nervous', 'shy', 'assertive'],
  'digital': ['computer', 'online', 'internet', 'email', 'website', 'digital', 'technology', 'access', 'laptop', 'phone', 'tablet', 'wifi', 'broadband', 'software'],
  'health': ['health', 'medical', 'doctor', 'gp', 'appointment', 'condition', 'support', 'wellbeing', 'mental', 'physical', 'disability', 'sick', 'illness'],
  'housing': ['housing', 'accommodation', 'rent', 'address', 'stable', 'home', 'council', 'homeless', 'shelter', 'tenancy', 'landlord'],
  'training': ['training', 'course', 'qualification', 'certificate', 'learn', 'skill', 'develop', 'nvq', 'gcse', 'maths', 'english', 'functional skills'],
  'experience': ['experience', 'volunteer', 'placement', 'internship', 'work trial', 'reference', 'work experience', 'sector-based'],
  'id': ['id', 'passport', 'driving licence', 'birth certificate', 'proof', 'identity', 'document', 'national insurance', 'ni number', 'share code'],
  'disclosure': ['disclosure', 'dbs', 'criminal', 'record', 'conviction', 'background', 'spent', 'unspent', 'rehabilitation'],
  'language': ['english', 'esol', 'language', 'speak', 'communicate', 'interpreter', 'translation', 'fluent', 'vocabulary', 'grammar'],
  'finance': ['money', 'debt', 'budget', 'benefit', 'income', 'payment', 'financial', 'bank', 'universal credit', 'uc', 'sanction', 'arrears'],
  'interview': ['interview', 'prepare', 'practice', 'questions', 'answers', 'technique', 'mock', 'star', 'competency'],
  'sector': ['sector', 'industry', 'field', 'career', 'pathway', 'options', 'explore', 'research', 'labour market', 'vacancies'],
  'motivation': ['motivation', 'routine', 'punctuality', 'time management', 'goal', 'focus', 'direction', 'purpose'],
  'interviews': ['interview', 'prepare', 'practice', 'mock', 'questions', 'technique', 'presentation', 'assessment centre'],
  'literacy': ['reading', 'writing', 'literacy', 'numeracy', 'maths', 'english', 'spelling', 'grammar', 'dyslexia'],
};
