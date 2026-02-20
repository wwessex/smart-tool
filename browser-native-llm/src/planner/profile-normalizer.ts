/**
 * Profile normaliser for user input.
 *
 * Converts raw, freeform user input into a structured UserProfile
 * suitable for retrieval and prompt assembly. Handles defaults,
 * input sanitisation, and classification of freeform text into
 * structured fields.
 */

import type { RawUserInput, UserProfile } from "../types.js";

/** Default values for optional profile fields. */
const DEFAULTS = {
  hours_per_week: 10,
  timeframe_weeks: 8,
  confidence_level: 3,
  work_arrangement: "any" as const,
};

/** Common barrier keywords mapped to canonical barrier names. */
const BARRIER_KEYWORDS: Record<string, string> = {
  // Transport
  transport: "transport",
  "no car": "transport",
  "bus routes": "transport",
  travel: "transport",
  commute: "transport",

  // Childcare/caring
  childcare: "childcare",
  children: "childcare",
  "school run": "childcare",
  caring: "caring_responsibilities",
  carer: "caring_responsibilities",

  // Confidence
  confidence: "confidence",
  anxious: "confidence",
  anxiety: "confidence",
  nervous: "confidence",
  scared: "confidence",
  worried: "confidence",

  // CV/experience
  cv: "cv_gaps",
  "no experience": "lack_of_experience",
  "career change": "career_change",
  "changing career": "career_change",
  "gaps in": "cv_gaps",
  "employment gap": "cv_gaps",

  // Health/disability
  disability: "disability",
  disabled: "disability",
  health: "health",
  stamina: "health",
  "mental health": "mental_health",
  depression: "mental_health",

  // Digital
  "digital skills": "digital_skills",
  computer: "digital_skills",
  technology: "digital_skills",
  "not good with": "digital_skills",

  // Time
  "limited time": "time_management",
  "not much time": "time_management",
  busy: "time_management",

  // Language
  english: "language",
  "english not": "language",
  language: "language",

  // Motivation
  motivation: "motivation",
  unmotivated: "motivation",
  "lost hope": "motivation",

  // Criminal record
  "criminal record": "criminal_record",
  conviction: "criminal_record",

  // Housing
  housing: "housing",
  homeless: "housing",
  "temporary accommodation": "housing",
};

/** Confidence level keywords. */
const CONFIDENCE_KEYWORDS: Record<string, number> = {
  "very anxious": 1,
  "very nervous": 1,
  "really worried": 1,
  anxious: 2,
  nervous: 2,
  worried: 2,
  unsure: 2,
  okay: 3,
  "quite confident": 4,
  confident: 4,
  "very confident": 5,
  ready: 5,
};

/**
 * Normalise raw user input into a structured profile.
 */
export function normalizeProfile(input: RawUserInput): UserProfile {
  return {
    job_goal: normalizeGoal(input.goal),
    current_situation: input.situation ?? "",
    hours_per_week: parseHoursPerWeek(input.hours_per_week, input.timeframe),
    timeframe_weeks: parseTimeframeWeeks(input.timeframe),
    skills: parseSkills(input.skills),
    barriers: parseBarriers(input.barriers, input.situation),
    confidence_level: parseConfidence(input.confidence),
    industry: input.industry?.trim() || undefined,
    work_arrangement: parseWorkArrangement(input.work_arrangement),
  };
}

function normalizeGoal(goal: string): string {
  let normalized = goal.trim();

  // Remove common prefixes like "I want to", "I'm looking for"
  const prefixes = [
    /^i\s+want\s+to\s+(find|get)\s+(a\s+)?/i,
    /^i'?m\s+looking\s+for\s+(a\s+)?/i,
    /^looking\s+for\s+(a\s+)?/i,
    /^i\s+need\s+(a\s+)?/i,
    /^find\s+(a\s+)?/i,
    /^get\s+(a\s+)?/i,
  ];

  for (const prefix of prefixes) {
    normalized = normalized.replace(prefix, "");
  }

  // Remove trailing punctuation
  normalized = normalized.replace(/[.!]+$/, "").trim();

  // Capitalise first letter
  if (normalized.length > 0) {
    normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  return normalized;
}

function parseHoursPerWeek(
  explicit?: number,
  timeframeStr?: string
): number {
  if (explicit !== undefined && explicit > 0) return explicit;

  // Try to extract from timeframe string
  if (timeframeStr) {
    const hoursMatch = timeframeStr.match(/(\d+)\s*hours?\s*(?:per|\/|a)\s*week/i);
    if (hoursMatch) return parseInt(hoursMatch[1], 10);
  }

  return DEFAULTS.hours_per_week;
}

function parseTimeframeWeeks(timeframeStr?: string): number {
  if (!timeframeStr) return DEFAULTS.timeframe_weeks;

  const str = timeframeStr.trim().toLowerCase();

  // "X weeks"
  const weeksMatch = str.match(/(\d+)\s*weeks?/);
  if (weeksMatch) return parseInt(weeksMatch[1], 10);

  // "X months"
  const monthsMatch = str.match(/(\d+)\s*months?/);
  if (monthsMatch) return parseInt(monthsMatch[1], 10) * 4;

  // "X days"
  const daysMatch = str.match(/(\d+)\s*days?/);
  if (daysMatch) return Math.ceil(parseInt(daysMatch[1], 10) / 7);

  return DEFAULTS.timeframe_weeks;
}

function parseSkills(skillsStr?: string): string[] {
  if (!skillsStr) return [];

  // Split on commas, semicolons, "and", or newlines
  return skillsStr
    .split(/[,;\n]|(?:\s+and\s+)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseBarriers(
  barriersStr?: string,
  situationStr?: string
): string[] {
  const barriers = new Set<string>();
  const textsToScan = [barriersStr, situationStr].filter(Boolean).join(" ").toLowerCase();

  if (!textsToScan) return [];

  for (const [keyword, canonical] of Object.entries(BARRIER_KEYWORDS)) {
    if (textsToScan.includes(keyword)) {
      barriers.add(canonical);
    }
  }

  // Also include explicitly listed barriers
  if (barriersStr) {
    const explicit = barriersStr
      .split(/[,;\n]|(?:\s+and\s+)/i)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);

    for (const b of explicit) {
      // If it wasn't caught by keywords, add it as-is
      if (!Array.from(barriers).some((canonical) => b.includes(canonical))) {
        barriers.add(b.replace(/\s+/g, "_"));
      }
    }
  }

  return Array.from(barriers);
}

function parseConfidence(confidenceStr?: string): number {
  if (!confidenceStr) return DEFAULTS.confidence_level;

  const str = confidenceStr.trim().toLowerCase();

  // Check for numeric value
  const numMatch = str.match(/^(\d)$/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (num >= 1 && num <= 5) return num;
  }

  // Check keyword matches (longer matches first for accuracy)
  const sortedKeywords = Object.entries(CONFIDENCE_KEYWORDS).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [keyword, level] of sortedKeywords) {
    if (str.includes(keyword)) {
      return level;
    }
  }

  return DEFAULTS.confidence_level;
}

function parseWorkArrangement(
  arrangement?: string
): "any" | "remote" | "hybrid" | "on-site" {
  if (!arrangement) return DEFAULTS.work_arrangement;

  const str = arrangement.trim().toLowerCase();
  if (str.includes("remote") || str.includes("home")) return "remote";
  if (str.includes("hybrid") || str.includes("flex")) return "hybrid";
  if (str.includes("on-site") || str.includes("onsite") || str.includes("office"))
    return "on-site";
  return "any";
}
