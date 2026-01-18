import { BUILDER_NOW, BUILDER_TASK, ACTION_LIBRARY, FALLBACK_SUGGESTIONS, TASK_SUGGESTIONS } from './smart-data';

export function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tz * 60000);
  return local.toISOString().slice(0, 10);
}

export function formatDDMMMYY(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mmm = d.toLocaleString("en-GB", { month: "short" });
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mmm}-${yy}`;
}

export function parseTimescaleToTargetISO(baseISO: string, timescale: string): string {
  const d = new Date(baseISO + "T00:00:00");
  const t = (timescale || "").trim().toLowerCase();
  if (!t) return baseISO;

  const w = t.match(/^(\d+)\s*week/);
  if (w) {
    const days = parseInt(w[1], 10) * 7;
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  const m = t.match(/^(\d+)\s*month/);
  if (m) {
    const months = parseInt(m[1], 10);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() < day) {
      d.setDate(0);
    }
    return d.toISOString().slice(0, 10);
  }

  return baseISO;
}

export function pickLibraryKey(barrier: string): string {
  const b = (barrier || "").trim().toLowerCase();
  if (!b) return "";
  const keys = Object.keys(ACTION_LIBRARY);
  
  // Exact match first
  for (const k of keys) {
    if (k.toLowerCase() === b) return k;
  }
  
  // Partial match - barrier contains key
  for (const k of keys) {
    if (b.includes(k.toLowerCase())) return k;
  }
  
  // Partial match - key contains barrier
  for (const k of keys) {
    if (k.toLowerCase().includes(b)) return k;
  }
  
  // Semantic matches for common variations
  const semanticMatches: Record<string, string[]> = {
    "Autism": ["autistic", "asd", "asperger", "autism spectrum"],
    "Learning Difficulties": ["learning disability", "developmental delay", "global developmental", "intellectual disability", "special needs", "learning need"],
    "ADHD": ["attention deficit", "add", "hyperactivity", "concentration"],
    "Health Condition": ["health", "illness", "medical", "chronic", "physical health"],
    "Disability": ["disabled", "physical disability", "impairment"],
    "Mental Wellbeing": ["mental health", "anxiety", "depression", "stress", "wellbeing", "psychological"],
    "Literacy and/or Numeracy": ["literacy", "numeracy", "reading", "writing", "maths", "dyslexia", "dyscalculia"],
    "Digital Skills": ["computer", "digital", "it skills", "technology", "internet"],
    "Communication Skills": ["speech", "language", "communication", "stammer", "stutter"],
  };
  
  for (const [key, variations] of Object.entries(semanticMatches)) {
    for (const variation of variations) {
      if (b.includes(variation)) {
        return key;
      }
    }
  }
  
  return "";
}

export function resolvePlaceholders(str: string, ctx: { targetPretty: string; n?: number; forename?: string }): string {
  return (str || "")
    .split("{targetDate}").join(ctx.targetPretty)
    .split("{n}").join(String(ctx.n ?? 2))
    .split("{forename}").join(ctx.forename || "[Name]");
}

function lowerFirstLetter(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function forenameWillify(action: string, forename: string): string {
  const a = (action || "").trim();
  const f = (forename || "").trim();
  if (!a) return "";
  if (!f) return a;
  if (a.toLowerCase().startsWith(f.toLowerCase())) return a;
  return `${f} will ${lowerFirstLetter(a)}`;
}

export function bestNowSuggestion(barrier: string, query?: string) {
  const barrierKey = pickLibraryKey(barrier);
  let list = barrierKey ? (ACTION_LIBRARY[barrierKey] || []) : [];
  if (!list.length) list = FALLBACK_SUGGESTIONS;

  const q = (query || "").trim().toLowerCase();
  if (!q) return list[0];

  let best = list[0];
  let bestScore = -1;
  for (const s of list) {
    const t = (s.title || "").toLowerCase();
    const a = (s.action || "").toLowerCase();
    const h = (s.help || "").toLowerCase();
    let score = 0;
    if (t.includes(q)) score += 3;
    if (a.includes(q)) score += 2;
    if (h.includes(q)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

export function pickTaskKey(taskDesc: string): string {
  const t = (taskDesc || "").trim().toLowerCase();
  if (!t) return "default";
  
  if (/job\s*fair|careers?\s*fair|recruitment\s*(event|fair)/i.test(t)) return "job fair";
  if (/workshop|session|group|course|training/i.test(t)) return "workshop";
  if (/interview|mock/i.test(t)) return "interview";
  if (/cv|resume|curriculum/i.test(t)) return "cv";
  if (/application|apply|applying/i.test(t)) return "application";
  
  return "default";
}

export function bestTaskSuggestion(taskDesc: string) {
  const key = pickTaskKey(taskDesc);
  const list = TASK_SUGGESTIONS[key] || TASK_SUGGESTIONS.default || [];
  return list[0] || { title: "General activity", outcome: "[Name] will participate in this activity and identify next steps towards their employment goal." };
}

export function getTaskSuggestions(taskDesc: string) {
  const key = pickTaskKey(taskDesc);
  return TASK_SUGGESTIONS[key] || TASK_SUGGESTIONS.default || [];
}

export function getSuggestionList(barrier: string) {
  const barrierKey = pickLibraryKey(barrier);
  return barrierKey ? (ACTION_LIBRARY[barrierKey] || []) : FALLBACK_SUGGESTIONS;
}

export function aiDraftNow(
  barrier: string,
  forename: string,
  responsible: string,
  timescale: string,
  baseISO: string,
  suggestQuery?: string
): { action: string; help: string } {
  const targetISO = parseTimescaleToTargetISO(baseISO, timescale);
  // Include forename in context so {forename} placeholders get replaced
  const ctx = { targetPretty: formatDDMMMYY(targetISO), n: 2, forename };

  const s = bestNowSuggestion(barrier, suggestQuery);
  const rawAction = resolvePlaceholders(s.action, ctx);
  
  // Only add "forename will" prefix if action doesn't already start with forename
  let action = rawAction;
  const startsWithForename = forename && rawAction.toLowerCase().startsWith(forename.toLowerCase());
  if (!startsWithForename && forename) {
    action = forenameWillify(rawAction, forename);
  }
  
  const help = resolvePlaceholders(s.help, ctx);

  if (responsible && /\bsend it to me\b/i.test(action) && !/\bI\b|advisor/i.test(responsible.toLowerCase())) {
    action = action.replace(/\bsend it to me\b/i, "save it and bring it to our next meeting");
  }

  return { action: action.trim(), help: help.trim() };
}

export function aiDraftFuture(task: string, forename: string): string {
  const s = bestTaskSuggestion(task);
  return s.outcome.replace(/\[Name\]/g, forename);
}

export function formatTaskOutcome(forename: string, rawOutcome: string): string {
  let outcome = (rawOutcome || "").trim().replace(/\s+/g, " ");
  if (!outcome) return "";
  
  if (outcome.endsWith(".")) {
    outcome = outcome.slice(0, -1);
  }
  
  const lowerOutcome = outcome.toLowerCase();
  const lowerName = (forename || "").toLowerCase();
  const name = forename || "They";
  
  if (lowerName && lowerOutcome.startsWith(lowerName + " ")) {
    return forename + outcome.slice(lowerName.length);
  }
  
  if (/^(they|he|she)\s/i.test(outcome)) {
    return outcome.charAt(0).toUpperCase() + outcome.slice(1);
  }
  
  if (/^will\s/i.test(outcome)) {
    return `${name} ${outcome.charAt(0).toLowerCase() + outcome.slice(1)}`;
  }
  
  const startsWithVerb = /^(speak|attend|complete|submit|practise|practice|review|participate|collect|hand|receive|prepare|create|discuss|identify|make|apply|learn|meet|call|book|gather|research|write|contact|take|engage|work|visit|follow|organise|organize|arrange|ask|bring|check|confirm|email|find|get|go|help|look|phone|read|register|search|send|sign|talk|update|upload|use)/i.test(outcome);
  if (startsWithVerb) {
    return `${name} will ${outcome.charAt(0).toLowerCase() + outcome.slice(1)}`;
  }
  
  return outcome.charAt(0).toUpperCase() + outcome.slice(1);
}

// Helper to strip trailing punctuation
function stripTrailingPunctuation(s: string): string {
  return (s || "").trim().replace(/[.!?]+$/, "");
}

export function buildNowOutput(
  date: string,
  forename: string,
  barrier: string,
  action: string,
  responsible: string,
  help: string,
  timescale: string
): string {
  const formattedDate = formatDDMMMYY(date);
  let formattedAction = stripTrailingPunctuation(action.trim().replace(/\s+/g, " "));
  
  // Escape special regex characters in forename
  const escapedName = forename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Remove various phrase patterns that would duplicate with the template:
  // - "{Name} will ..."
  // - "{Name} has agreed to ..."
  // - "{Name} commits to ..."
  // - "{Name} plans to ..."
  // These all start with the participant's name followed by commitment language
  // The name is dynamically escaped so this works for any forename (John, Sarah, etc.)
  const redundantPhrasePattern = new RegExp(
    `^${escapedName}\\s+(?:will\\s+)?(?:` +
    `has\\s+agreed\\s+to|agrees\\s+to|` +
    `commits?\\s+to|has\\s+committed\\s+to|` +
    `is\\s+going\\s+to|is\\s+committed\\s+to|` +
    `has\\s+decided\\s+to|decides?\\s+to|` +
    `plans?\\s+to|is\\s+planning\\s+to|` +
    `intends?\\s+to|is\\s+intending\\s+to|` +
    `aims?\\s+to|is\\s+aiming\\s+to|` +
    `wants?\\s+to|wishes?\\s+to|` +
    `needs?\\s+to|` +
    `shall|will` +
    `)\\s+`,
    'i'
  );
  
  if (redundantPhrasePattern.test(formattedAction)) {
    formattedAction = formattedAction.replace(redundantPhrasePattern, '');
  }
  
  // Also handle simpler "Name will" pattern if above didn't match
  const nameWillPattern = new RegExp(`^${escapedName}\\s+will\\s+`, 'i');
  if (nameWillPattern.test(formattedAction)) {
    formattedAction = formattedAction.replace(nameWillPattern, '');
  }
  
  if (formattedAction) {
    formattedAction = formattedAction.charAt(0).toLowerCase() + formattedAction.slice(1);
  }
  
  // Strip trailing punctuation from help text too
  const cleanHelp = stripTrailingPunctuation(help);
  const cleanBarrier = stripTrailingPunctuation(barrier);
  const cleanTimescale = stripTrailingPunctuation(timescale);

  return [
    `${BUILDER_NOW.p1} ${formattedDate}, ${forename} and I ${BUILDER_NOW.p2} ${cleanBarrier}.`,
    `${BUILDER_NOW.p3} ${forename} will ${formattedAction}.`,
    `${BUILDER_NOW.p5} ${cleanHelp}.`,
    `${BUILDER_NOW.p6}`,
    `${BUILDER_NOW.p7} ${cleanTimescale}.`
  ].join(" ");
}

// Detect appropriate verb for task
function getTaskVerb(task: string): string {
  const t = (task || "").trim().toLowerCase();
  
  // Comprehensive list of verbs that tasks might start with
  const startsWithVerb = /^(attend|complete|submit|call|contact|visit|meet|book|apply|register|prepare|create|write|send|upload|take|go|make|have|do|start|finish|begin|schedule|arrange|organise|organize|speak|talk|discuss|review|check|follow|collect|gather|bring|pick|drop|return|update|fill|sign|hand|research|practice|practise|work\s+on|work\s+with|engage|participate|join|learn|study|read|watch|listen|observe|shadow|volunteer|help|assist|support|explore|investigate|try|attempt|test|demonstrate|present|deliver|lead|run|host|facilitate|coordinate|manage|plan|design|develop|build|set\s+up|clean|tidy|sort|file|scan|print|copy|fax|post|mail|order|purchase|buy|sell|pay|receive|accept|decline|confirm|cancel|reschedule|postpone|delay|wait|stay|leave|arrive|depart|travel|commute|drive|walk|cycle|use|access|log\s+in|download|install|configure|troubleshoot)/i.test(t);
  if (startsWithVerb) return "";
  
  // Events/appointments/sessions -> "attend"
  if (/\b(appointment|meeting|session|workshop|fair|event|interview|assessment|course|class|training|induction|orientation|webinar|seminar|group|clinic|surgery|consultation|hearing|tribunal|panel|review|drop-in|open\s+day|taster|trial|placement|work\s+experience)\b/i.test(t)) {
    return "attend ";
  }
  
  // Phone-related -> "make"
  if (/\b(phone\s+call|call\s+to|calls\s+to|telephone)\b/i.test(t)) {
    return "make ";
  }
  
  // Document/form related -> "complete"
  if (/\b(form|application|questionnaire|survey|assessment|paperwork|documentation)\b/i.test(t)) {
    return "complete ";
  }
  
  // Default - no verb prefix needed if context unclear
  return "";
}

export function buildFutureOutput(
  date: string,
  forename: string,
  task: string,
  responsible: string,
  rawOutcome: string,
  timescale: string
): string {
  const formattedDate = formatDDMMMYY(date);
  let formattedTask = stripTrailingPunctuation(task.trim().replace(/\s+/g, " "));
  const formattedOutcome = stripTrailingPunctuation(formatTaskOutcome(forename, rawOutcome));
  const cleanTimescale = stripTrailingPunctuation(timescale);
  
  // Get appropriate verb and format task
  const verb = getTaskVerb(formattedTask);
  
  // If no verb prefix needed and task starts with verb, lowercase the first letter
  if (!verb && /^[A-Z]/.test(formattedTask)) {
    formattedTask = formattedTask.charAt(0).toLowerCase() + formattedTask.slice(1);
  }

  // Structure: "As discussed and agreed, on [date], [name] will [verb] [task]. [Outcome]. [Responsible]. Reviewed in [timescale]."
  const parts = [
    `${BUILDER_TASK.p1} ${formattedDate}, ${forename} ${BUILDER_TASK.p2} ${verb}${formattedTask}.`
  ];
  
  if (formattedOutcome) {
    parts.push(`${formattedOutcome}.`);
  }
  
  // Add responsibility clause if specified
  if (responsible && responsible !== 'Participant alone') {
    if (responsible === 'Participant with advisor support') {
      parts.push(`${forename} will complete this with support from their advisor.`);
    } else if (responsible === 'Advisor on behalf of participant') {
      parts.push(`The advisor has agreed to support ${forename} with this action.`);
    } else if (responsible === 'Third party support') {
      parts.push(`${forename} will receive support from a third party to complete this.`);
    }
  }
  
  parts.push(`${BUILDER_TASK.p3} ${cleanTimescale}.`);

  return parts.join(" ");
}
