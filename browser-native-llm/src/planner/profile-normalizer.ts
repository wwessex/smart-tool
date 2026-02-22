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
  "caring responsibilities": "caring_responsibilities",
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
  "health condition": "health",
  disability: "disability",
  disabled: "disability",
  health: "health",
  stamina: "health",
  "mental wellbeing": "mental_health",
  "mental health": "mental_health",
  wellbeing: "mental_health",
  depression: "mental_health",

  // Digital
  "digital hardware": "digital_access",
  connectivity: "digital_access",
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

  // Finance
  finance: "finance",
  debt: "finance",
  money: "finance",
  "financial difficulties": "finance",

  // Social / Support Networks
  "social & support networks": "social_isolation",
  "support network": "social_isolation",
  social: "social_isolation",
  isolation: "social_isolation",

  // Communication
  "communication skills": "communication",
  communication: "communication",

  // Literacy/Numeracy
  "literacy and/or numeracy": "literacy_numeracy",
  literacy: "literacy_numeracy",
  numeracy: "literacy_numeracy",

  // Qualifications
  qualifications: "qualifications",
  "no qualifications": "qualifications",

  // Transferable Skills
  "transferable skills": "transferable_skills",
  transferable: "transferable_skills",

  // Learning Capability
  "learning capability": "learning_capability",

  // Previous Work History
  "previous work history": "work_history",
  "work history": "work_history",

  // Job Search
  "job search": "job_search",

  // Job Applications
  "job applications": "applications",
  applications: "applications",

  // Interviews
  interviews: "interviewing",
  interview: "interviewing",

  // Job Goal
  "job goal": "job_goal",

  // Photo ID / Documents
  "photo id": "id_documents",
  "id documents": "id_documents",

  // Substance Misuse
  "substance misuse": "substance_misuse",
  substance: "substance_misuse",

  // Neurodiversity
  autism: "neurodiversity",
  adhd: "neurodiversity",

  // Learning Difficulties
  "learning difficulties": "learning_difficulties",
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
    participant_name: input.participant_name?.trim() || "",
    supporter: input.supporter?.trim() || "",
  };
}

function normalizeGoal(goal: string): string {
  let normalized = goal.trim();

  // Bound input length to prevent ReDoS
  normalized = normalized.slice(0, 2000);

  // Remove common prefixes like "I want to", "I'm looking for"
  // Manual matching to avoid ReDoS from patterns like /\s+want\s+to\s+/
  normalized = stripCommonPrefixes(normalized);

  // Remove trailing punctuation (manual loop to avoid ReDoS)
  let end = normalized.length;
  while (end > 0 && (normalized[end - 1] === "." || normalized[end - 1] === "!")) {
    end--;
  }
  normalized = normalized.slice(0, end).trim();

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

  // Try to extract from timeframe string (manual parse to avoid ReDoS)
  if (timeframeStr) {
    const lower = timeframeStr.slice(0, 500).toLowerCase();
    if (lower.includes("week") && lower.includes("hour")) {
      const hours = findNumberBeforeKeyword(lower, "hour");
      if (hours !== null && hours > 0) return hours;
    }
  }

  return DEFAULTS.hours_per_week;
}

function parseTimeframeWeeks(timeframeStr?: string): number {
  if (!timeframeStr) return DEFAULTS.timeframe_weeks;

  const str = timeframeStr.trim().toLowerCase().slice(0, 500);

  // "X weeks" (manual parse to avoid ReDoS)
  const weeks = findNumberBeforeKeyword(str, "week");
  if (weeks !== null) return weeks;

  // "X months"
  const months = findNumberBeforeKeyword(str, "month");
  if (months !== null) return months * 4;

  // "X days"
  const days = findNumberBeforeKeyword(str, "day");
  if (days !== null) return Math.ceil(days / 7);

  return DEFAULTS.timeframe_weeks;
}

function parseSkills(skillsStr?: string): string[] {
  if (!skillsStr) return [];

  // Split on commas, semicolons, "and", or newlines (manual split to avoid ReDoS)
  return splitOnDelimiters(skillsStr)
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
    const explicit = splitOnDelimiters(barriersStr)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);

    for (const b of explicit) {
      // If it wasn't caught by keywords, add it as-is
      if (!Array.from(barriers).some((canonical) => b.includes(canonical))) {
        barriers.add(collapseWhitespace(b, "_"));
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

/**
 * Strip common freeform prefixes from a goal string.
 * Manual matching to avoid ReDoS from regex patterns like /^i\s+want\s+to\s+/.
 */
function stripCommonPrefixes(text: string): string {
  const lower = text.toLowerCase();
  const i = 0;

  // Helper: skip whitespace starting at position i, return new position
  function skipWs(pos: number): number {
    while (pos < lower.length && (lower[pos] === " " || lower[pos] === "\t")) pos++;
    return pos;
  }

  // Helper: check if text at position starts with word, return position after word or -1
  function matchWord(pos: number, word: string): number {
    if (lower.startsWith(word, pos)) {
      const end = pos + word.length;
      if (end >= lower.length || lower[end] === " " || lower[end] === "\t") {
        return end;
      }
    }
    return -1;
  }

  // Try "i want to (find|get) (a )?"
  let j = matchWord(i, "i");
  if (j !== -1) {
    j = skipWs(j);
    const jWant = matchWord(j, "want");
    if (jWant !== -1) {
      let k = skipWs(jWant);
      const kTo = matchWord(k, "to");
      if (kTo !== -1) {
        k = skipWs(kTo);
        const kFind = matchWord(k, "find");
        const kGet = matchWord(k, "get");
        const kVerb = kFind !== -1 ? kFind : kGet;
        if (kVerb !== -1) {
          let m = skipWs(kVerb);
          const mA = matchWord(m, "a");
          if (mA !== -1) m = skipWs(mA);
          return text.slice(m);
        }
      }
    }

    // Try "i'm looking for (a )?" or "im looking for (a )?"
    const jmApostrophe = lower.startsWith("'m", j) ? j + 2 : lower.startsWith("m", j) && j === 1 ? j + 1 : -1;
    if (jmApostrophe !== -1) {
      let k = skipWs(jmApostrophe);
      const kLooking = matchWord(k, "looking");
      if (kLooking !== -1) {
        k = skipWs(kLooking);
        const kFor = matchWord(k, "for");
        if (kFor !== -1) {
          let m = skipWs(kFor);
          const mA = matchWord(m, "a");
          if (mA !== -1) m = skipWs(mA);
          return text.slice(m);
        }
      }
    }

    // Try "i need (a )?"
    const jNeed = matchWord(j, "need");
    if (jNeed !== -1) {
      let k = skipWs(jNeed);
      const kA = matchWord(k, "a");
      if (kA !== -1) k = skipWs(kA);
      return text.slice(k);
    }
  }

  // Try "i'm looking for (a )?"
  j = matchWord(i, "i'm");
  if (j !== -1) {
    j = skipWs(j);
    const jLooking = matchWord(j, "looking");
    if (jLooking !== -1) {
      const k = skipWs(jLooking);
      const kFor = matchWord(k, "for");
      if (kFor !== -1) {
        let m = skipWs(kFor);
        const mA = matchWord(m, "a");
        if (mA !== -1) m = skipWs(mA);
        return text.slice(m);
      }
    }
  }

  // Try "looking for (a )?"
  j = matchWord(i, "looking");
  if (j !== -1) {
    j = skipWs(j);
    const jFor = matchWord(j, "for");
    if (jFor !== -1) {
      let k = skipWs(jFor);
      const kA = matchWord(k, "a");
      if (kA !== -1) k = skipWs(kA);
      return text.slice(k);
    }
  }

  // Try "find (a )?"
  j = matchWord(i, "find");
  if (j !== -1) {
    let k = skipWs(j);
    const kA = matchWord(k, "a");
    if (kA !== -1) k = skipWs(kA);
    return text.slice(k);
  }

  // Try "get (a )?"
  j = matchWord(i, "get");
  if (j !== -1) {
    let k = skipWs(j);
    const kA = matchWord(k, "a");
    if (kA !== -1) k = skipWs(kA);
    return text.slice(k);
  }

  return text;
}

/**
 * Split text on commas, semicolons, newlines, and " and " (case-insensitive).
 * Manual O(n) scan to avoid ReDoS from /[,;\n]|(?:\s+and\s+)/i.
 */
function splitOnDelimiters(text: string): string[] {
  const result: string[] = [];
  let current = "";
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    // Single-char delimiters
    if (ch === "," || ch === ";" || ch === "\n") {
      result.push(current);
      current = "";
      i++;
      continue;
    }

    // Check for whitespace + "and" + whitespace
    if (ch === " " || ch === "\t") {
      let j = i;
      while (j < text.length && (text[j] === " " || text[j] === "\t")) j++;
      if (
        j + 3 <= text.length &&
        text.slice(j, j + 3).toLowerCase() === "and" &&
        j + 3 < text.length &&
        (text[j + 3] === " " || text[j + 3] === "\t")
      ) {
        result.push(current);
        current = "";
        i = j + 4;
        while (i < text.length && (text[i] === " " || text[i] === "\t")) i++;
        continue;
      }
    }

    current += ch;
    i++;
  }

  result.push(current);
  return result;
}

/**
 * Replace runs of whitespace with a replacement character.
 * Manual O(n) scan to avoid ReDoS from /\s+/g.
 */
function collapseWhitespace(text: string, replacement: string): string {
  let result = "";
  let inWhitespace = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      if (!inWhitespace) {
        result += replacement;
        inWhitespace = true;
      }
    } else {
      result += ch;
      inWhitespace = false;
    }
  }

  return result;
}

/**
 * Find a number immediately preceding a keyword in text.
 * Manual string scanning to avoid ReDoS from regex patterns like /(\d+)\s*keyword/.
 */
function findNumberBeforeKeyword(text: string, keyword: string): number | null {
  const idx = text.indexOf(keyword);
  if (idx <= 0) return null;

  // Skip whitespace before keyword
  let i = idx - 1;
  while (i >= 0 && text[i] === " ") i--;

  // Collect digits backwards
  const digitEnd = i + 1;
  while (i >= 0 && text[i] >= "0" && text[i] <= "9") i--;

  if (i + 1 === digitEnd) return null;
  const num = parseInt(text.slice(i + 1, digitEnd), 10);
  return isNaN(num) ? null : num;
}
