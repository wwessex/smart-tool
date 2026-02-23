import type { ResolvedBarrier, SMARTAction } from "../types.js";

const STOP_WORDS = new Set(["and", "the", "for", "with", "or", "to", "of", "in", "on", "a", "an"]);

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  practical_access: ["housing", "council", "rent", "transport", "bus", "train", "route", "childcare", "nursery", "budget", "money", "debt", "benefits", "id", "passport", "licence", "license", "computer", "laptop", "internet", "wifi"],
  confidence_and_motivation: ["confidence", "strength", "self-esteem", "self belief", "nervous", "anxiety", "mock", "practice", "practise", "interview prep", "mentor", "support group"],
  health_and_wellbeing: ["wellbeing", "mental", "health", "self-care", "gp", "counselling", "counseling", "support service", "coping"],
  skills_and_qualifications: ["course", "module", "certificate", "training", "digital", "email", "literacy", "numeracy", "esol", "english", "qualification"],
  job_search_readiness: ["cv", "resume", "application", "job search", "job alert", "interview", "indeed", "apply", "vacancy", "star example", "personal statement", "cover letter"],
  neurodiversity_and_learning: ["adjustment", "routine", "reminder", "structure", "focus", "support worker", "communication profile", "sensory"],
  identity_and_documents: ["passport", "birth certificate", "proof of address", "id", "right to work", "ni number", "national insurance"],
};

const CATEGORY_ALIASES: Record<string, string> = {
  practical: "practical_access",
  confidence: "confidence_and_motivation",
  wellbeing: "health_and_wellbeing",
  skills: "skills_and_qualifications",
  experience: "job_search_readiness",
  "job-search": "job_search_readiness",
  neurodiversity: "neurodiversity_and_learning",
};

const ANTI_PATTERN_PREFIXES = [
  "think about",
  "consider",
  "look into",
  "reflect on",
  "be aware of",
  "keep trying",
  "work on",
  "improve",
  "be better at",
];

const MITIGATION_VERBS = [
  "book", "arrange", "apply", "contact", "call", "email", "register", "enrol", "enroll", "attend", "complete", "submit", "update", "create", "draft", "prepare", "set up", "schedule", "request", "gather", "obtain", "practise", "practice", "review", "send", "speak", "visit",
];

export interface BarrierRelevanceInput {
  text: string;
  resolvedBarrier?: Pick<ResolvedBarrier, "id" | "label" | "retrieval_tags" | "category">;
  barrierLabel?: string;
  barrierCategory?: string;
}

export interface BarrierRelevanceResult {
  isRelevant: boolean;
  matchedByResolvedBarrier: boolean;
  matchedByCategory: boolean;
  matchedTerms: string[];
  antiPatternDetected: boolean;
}

export function evaluateBarrierRelevance(input: BarrierRelevanceInput): BarrierRelevanceResult {
  const text = input.text.toLowerCase();

  const resolvedTerms = input.resolvedBarrier
    ? getResolvedBarrierTerms(input.resolvedBarrier)
    : getLabelTerms(input.barrierLabel);

  const matchedTerms = resolvedTerms.filter((term) => text.includes(term));
  const matchedByResolvedBarrier = matchedTerms.length > 0;

  const normalizedCategory = normalizeCategory(
    input.resolvedBarrier?.category ?? input.barrierCategory,
  );

  const categoryKeywords = normalizedCategory ? CATEGORY_KEYWORDS[normalizedCategory] ?? [] : [];
  const matchedByCategory = !matchedByResolvedBarrier && categoryKeywords.some((keyword) => text.includes(keyword));

  const antiPatternDetected = detectBarrierAntiPattern(
    text,
    matchedByResolvedBarrier || matchedByCategory,
    resolvedTerms,
    categoryKeywords,
  );

  const isRelevant = (matchedByResolvedBarrier || matchedByCategory) && !antiPatternDetected;

  return {
    isRelevant,
    matchedByResolvedBarrier,
    matchedByCategory,
    matchedTerms,
    antiPatternDetected,
  };
}

function getResolvedBarrierTerms(
  barrier: Pick<ResolvedBarrier, "id" | "label" | "retrieval_tags">,
): string[] {
  const terms = [
    barrier.id.replace(/_/g, " "),
    barrier.label.toLowerCase(),
    ...barrier.retrieval_tags.map((tag) => tag.toLowerCase().replace(/_/g, " ")),
    ...barrier.label.toLowerCase().split(/\s+/),
  ];

  return normalizeTerms(terms);
}

function getLabelTerms(label?: string): string[] {
  if (!label) return [];
  return normalizeTerms(label.toLowerCase().split(/\s+/));
}

function normalizeTerms(terms: string[]): string[] {
  return [...new Set(terms)]
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term));
}

function normalizeCategory(category?: string): string | undefined {
  if (!category) return undefined;
  const key = category.toLowerCase().trim();
  return CATEGORY_KEYWORDS[key] ? key : CATEGORY_ALIASES[key];
}

function detectBarrierAntiPattern(
  text: string,
  hasBarrierMatch: boolean,
  resolvedTerms: string[],
  categoryKeywords: string[],
): boolean {
  if (!hasBarrierMatch) return false;

  const mentionsBarrierWord = [...resolvedTerms, ...categoryKeywords]
    .some((term) => text.includes(term));

  if (!mentionsBarrierWord) return false;

  const hasGenericLanguage = ANTI_PATTERN_PREFIXES
    .some((prefix) => text.includes(prefix));

  const hasMitigationVerb = MITIGATION_VERBS.some((verb) => text.includes(verb));

  return hasGenericLanguage && !hasMitigationVerb;
}

export function evaluateActionBarrierRelevance(
  action: SMARTAction,
  barrier: Pick<ResolvedBarrier, "id" | "label" | "retrieval_tags" | "category">,
): BarrierRelevanceResult {
  return evaluateBarrierRelevance({
    text: `${action.action} ${action.rationale} ${action.first_step}`,
    resolvedBarrier: barrier,
  });
}
