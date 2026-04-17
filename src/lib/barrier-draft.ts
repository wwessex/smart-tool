import type { SMARTAction } from "@smart-tool/browser-native-llm";
import { lookupBarrier } from "@smart-tool/browser-native-llm";
import { checkActionRelevance, type RelevanceResult } from "@/lib/relevance-checker";

export type DraftBarrierType =
  | "clarity"
  | "motivation"
  | "time"
  | "confidence"
  | "resources"
  | "fear/avoidance"
  | "habit"
  | "competing priorities"
  | "other";

export interface BarrierDraftContext {
  barrierType: DraftBarrierType;
  barrierSummary: string;
  whyItFits: string;
}

export interface RankedBarrierAction<T extends SMARTAction = SMARTAction> {
  action: T;
  relevance: RelevanceResult;
}

export interface BarrierDraftSelection<T extends SMARTAction = SMARTAction> {
  barrierType: DraftBarrierType;
  barrierSummary: string;
  whyItFits: string;
  primaryAction: T;
  alternates: T[];
  relevanceScore: number;
  relevance: RelevanceResult;
  candidateCount: number;
}

export const PRIMARY_RELEVANCE_THRESHOLD = 0.65;
const DEFAULT_ALTERNATE_COUNT = 3;

const BARRIER_TYPE_LABELS: Record<DraftBarrierType, string> = {
  clarity: "Clarity",
  motivation: "Motivation",
  time: "Time",
  confidence: "Confidence",
  resources: "Resources",
  "fear/avoidance": "Fear / avoidance",
  habit: "Habit",
  "competing priorities": "Competing priorities",
  other: "Other",
};

const KEYWORD_RULES: Array<{ type: DraftBarrierType; terms: string[] }> = [
  {
    type: "fear/avoidance",
    terms: ["avoid", "scared", "fear", "afraid", "worried", "anxious", "panic", "overwhelmed", "embarrassed"],
  },
  {
    type: "habit",
    terms: ["forget", "remember", "routine", "habit", "consistent", "consistency", "adhd", "autism", "organis", "organiz"],
  },
  {
    type: "competing priorities",
    terms: ["childcare", "caring", "carer", "family", "school run", "appointments", "other commitments", "competing priorities"],
  },
  {
    type: "time",
    terms: ["no time", "dont have time", "don't have time", "busy", "time", "schedule", "availability", "hours"],
  },
  {
    type: "motivation",
    terms: ["motivation", "motivated", "unmotivated", "procrast", "stuck", "low energy", "lost hope"],
  },
  {
    type: "confidence",
    terms: ["confidence", "self esteem", "nervous", "interview", "speak to employers", "presentation", "phone calls"],
  },
  {
    type: "resources",
    terms: [
      "transport", "travel", "bus", "train", "money", "finance", "debt", "housing", "documents", "id", "phone",
      "laptop", "internet", "access", "equipment", "health", "wellbeing", "gp", "support",
    ],
  },
  {
    type: "clarity",
    terms: [
      "where to start", "dont know", "don't know", "not sure", "unclear", "confused", "cv", "cover letter",
      "application", "job search", "digital skills", "qualifications", "english", "literacy", "numeracy",
    ],
  },
];

const CATEGORY_DEFAULTS: Record<string, DraftBarrierType> = {
  confidence_and_motivation: "confidence",
  practical_access: "resources",
  identity_and_documents: "resources",
  health_and_wellbeing: "resources",
  skills_and_qualifications: "clarity",
  job_search_readiness: "clarity",
  neurodiversity_and_learning: "habit",
};

function normalizeText(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summariseBarrier(barrier: string): string {
  const clean = (barrier || "").trim().replace(/\s+/g, " ");
  if (!clean) return "current barrier";

  const short = clean
    .split(/(?:[.!?;]| but | because | so that | and then )/i)[0]
    ?.trim() || clean;

  return short.length > 80 ? `${short.slice(0, 77).trimEnd()}...` : short;
}

function inferBarrierType(barrier: string): DraftBarrierType {
  const normalized = normalizeText(barrier);
  if (!normalized) return "other";

  for (const rule of KEYWORD_RULES) {
    if (rule.terms.some((term) => normalized.includes(term))) {
      return rule.type;
    }
  }

  const resolved = lookupBarrier(barrier);
  if (resolved) {
    const categoryType = CATEGORY_DEFAULTS[resolved.category];
    if (categoryType) return categoryType;
  }

  return "other";
}

function buildWhyItFits(barrierType: DraftBarrierType, barrierSummary: string): string {
  switch (barrierType) {
    case "clarity":
      return `Turns "${barrierSummary}" into one clear next step instead of generic advice.`;
    case "motivation":
      return `Keeps the action small and concrete so "${barrierSummary}" feels easier to start.`;
    case "time":
      return `Focuses on a short, time-scoped action that works around "${barrierSummary}".`;
    case "confidence":
      return `Builds confidence through a practical action linked directly to "${barrierSummary}".`;
    case "resources":
      return `Targets the practical support needed to reduce "${barrierSummary}" as a blocker.`;
    case "fear/avoidance":
      return `Uses a low-friction step to reduce avoidance around "${barrierSummary}".`;
    case "habit":
      return `Supports routine and follow-through so "${barrierSummary}" is easier to manage.`;
    case "competing priorities":
      return `Keeps the step realistic around the competing demands inside "${barrierSummary}".`;
    default:
      return `Keeps the action tightly focused on "${barrierSummary}".`;
  }
}

function actionSignature(text: string): string[] {
  return normalizeText(text)
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ")
    .replace(/\b\d{1,2}-[a-z]{3}-\d{2,4}\b/g, " ")
    .replace(/\b\d+\b/g, " ")
    .split(" ")
    .filter((token) => token.length > 2 && token !== "will" && token !== "has" && token !== "agreed");
}

function areNearDuplicate(a: string, b: string): boolean {
  const aTokens = actionSignature(a);
  const bTokens = actionSignature(b);

  if (aTokens.length === 0 || bTokens.length === 0) return false;
  if (aTokens.join(" ") === bTokens.join(" ")) return true;

  const bSet = new Set(bTokens);
  const overlap = aTokens.filter((token) => bSet.has(token)).length;
  const ratio = overlap / Math.min(aTokens.length, bTokens.length);
  return ratio >= 0.8;
}

export function formatBarrierTypeLabel(barrierType: DraftBarrierType): string {
  return BARRIER_TYPE_LABELS[barrierType];
}

export function createBarrierDraftContext(barrier: string): BarrierDraftContext {
  const barrierSummary = summariseBarrier(barrier);
  const barrierType = inferBarrierType(barrierSummary);

  return {
    barrierType,
    barrierSummary,
    whyItFits: buildWhyItFits(barrierType, barrierSummary),
  };
}

export function rankBarrierActions<T extends SMARTAction>(
  actions: T[],
  barrier: string,
  forename?: string,
  timescale?: string,
): RankedBarrierAction<T>[] {
  const scored = actions
    .filter((action) => !!action?.action?.trim())
    .map((action) => ({
      action,
      relevance: checkActionRelevance(action.action, barrier, forename, timescale),
    }));

  scored.sort((a, b) => {
    if (a.relevance.isRelevant && !b.relevance.isRelevant) return -1;
    if (!a.relevance.isRelevant && b.relevance.isRelevant) return 1;
    return b.relevance.relevanceScore - a.relevance.relevanceScore;
  });

  const unique: RankedBarrierAction<T>[] = [];
  for (const candidate of scored) {
    if (unique.some((existing) => areNearDuplicate(existing.action.action, candidate.action.action))) {
      continue;
    }
    unique.push(candidate);
  }

  return unique;
}

export function selectAlternateActions<T extends SMARTAction>(
  actions: T[],
  barrier: string,
  primaryActionText: string,
  forename?: string,
  timescale?: string,
  count: number = DEFAULT_ALTERNATE_COUNT,
): T[] {
  return rankBarrierActions(actions, barrier, forename, timescale)
    .filter((candidate) => candidate.relevance.isRelevant)
    .filter((candidate) => !areNearDuplicate(candidate.action.action, primaryActionText))
    .slice(0, count)
    .map((candidate) => candidate.action);
}

export function selectPrimaryBarrierDraft<T extends SMARTAction>(
  actions: T[],
  barrier: string,
  forename?: string,
  timescale?: string,
): BarrierDraftSelection<T> | null {
  const context = createBarrierDraftContext(barrier);
  const ranked = rankBarrierActions(actions, barrier, forename, timescale);
  const primary = ranked[0];

  if (!primary) return null;

  return {
    barrierType: context.barrierType,
    barrierSummary: context.barrierSummary,
    whyItFits: context.whyItFits,
    primaryAction: primary.action,
    alternates: ranked
      .filter((candidate) => candidate.relevance.isRelevant)
      .filter((candidate) => !areNearDuplicate(candidate.action.action, primary.action.action))
      .slice(0, DEFAULT_ALTERNATE_COUNT)
      .map((candidate) => candidate.action),
    relevanceScore: primary.relevance.relevanceScore,
    relevance: primary.relevance,
    candidateCount: ranked.length,
  };
}
