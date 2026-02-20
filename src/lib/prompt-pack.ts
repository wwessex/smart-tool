// Central, backend-taught prompt pack for the Local LLM.
//
// Goals:
// - Prompts are curated by you (backend-served JSON), not learned per end user.
// - Cached in IndexedDB so it survives model deletion / re-download.
// - Falls back to safe built-in defaults if fetch fails.

export interface PromptPack {
  version: number;
  updatedAt: string; // ISO date string
  systemPrompt: string;
  bannedTopics: string[];
  barrierGuidance: Record<string, string[]>; // key -> short guidance bullets
  fewShot: Array<{
    barrier: string;
    action: string;
    help: string;
  }>;
}

// -------- Defaults (ships with the app) --------

export const DEFAULT_PROMPT_PACK: PromptPack = {
  version: 2,
  updatedAt: new Date().toISOString().slice(0, 10),
  systemPrompt:
    "You are a SMART action writing assistant for UK employment advisors. " +
    "Create actions that are Specific, Measurable, Achievable, Relevant, and Time-bound. " +
    "Use UK job search context (Indeed, CV Library, Universal Credit, NHS, local employers). " +
    "Avoid generic waffle. Avoid mentioning booklets or forms unless the user explicitly mentions them. " +
    "IMPORTANT: Only suggest realistic, practical actions a job seeker can actually do. " +
    "NEVER invent monetary rewards, prizes, payments, bonuses, or guaranteed job offers. " +
    "NEVER promise specific outcomes like 'will be awarded', 'will receive £', or 'will get hired'. " +
    "Focus on practical steps: applications, CV updates, attending events, making calls, practising skills. " +
    "Output must match the requested format exactly.",
  bannedTopics: [
    "coding", "software", "AI", "Hugging Face", "Python", "project", "team meeting",
    "prize", "award", "£", "reward", "bonus", "lottery", "winning", "scholarship",
    "guaranteed job", "will be hired", "will get paid", "payment for attending",
    "certificate of achievement", "trophy", "competition",
  ],
  barrierGuidance: {
    Transport: ["routes (bus/rail)", "travel costs", "backup travel plan", "railcard/bus pass"],
    Health: ["GP/NHS support", "reasonable adjustments", "wellbeing routines", "fit note if needed"],
    Confidence: ["mock interviews", "strengths list", "gradual exposure", "positive evidence log"],
    Digital: ["email setup", "job site accounts", "upload CV", "basic IT skills"],
    Housing: ["housing options", "support services", "stable contact details", "budget for rent"],
    Finance: ["budget", "priority bills", "benefits check", "travel/work costs"],
    CV: ["update CV", "tailor CV to roles", "add recent experience", "proofread and format"],
    Interviews: ["practise answers", "mock interview", "research the employer", "prepare questions"],
    "Work History": ["volunteering", "work placement", "transferable skills", "reference from activity"],
    "Job Search": ["search on Indeed/CV Library", "set up job alerts", "apply for suitable roles", "track applications"],
    Motivation: ["set small daily goals", "routine planning", "identify interests", "reward progress"],
    "Caring Responsibilities": ["childcare options", "flexible working roles", "support services", "schedule around caring"],
    "Mental Wellbeing": ["GP referral", "talking therapies", "daily routine", "self-care plan"],
    Communication: ["practise phone calls", "email templates", "speaking exercises", "group activities"],
    "Literacy and/or Numeracy": ["skills assessment", "online courses", "library resources", "practice exercises"],
  },
  fewShot: [
    {
      barrier: "Transport",
      action: "Alex will plan bus routes to the industrial estate and confirm travel costs by 25-Jan-26.",
      help: "attend interviews on time",
    },
    {
      barrier: "Confidence",
      action: "Alex will complete one mock interview with their advisor and note 3 improvements by 25-Jan-26.",
      help: "feel more confident in interviews",
    },
    {
      barrier: "Digital",
      action: "Alex will set up an email account and register on 2 job boards to enable online job searching by 25-Jan-26.",
      help: "access online job vacancies",
    },
    {
      barrier: "CV",
      action: "Alex will update their CV with recent work experience and send it to their advisor for feedback by 25-Jan-26.",
      help: "have a stronger CV for applications",
    },
    {
      barrier: "Interviews",
      action: "Alex will research 2 target employers and prepare answers to 5 common interview questions by 25-Jan-26.",
      help: "perform better at interviews",
    },
    {
      barrier: "Job Search",
      action: "Alex will set up job alerts on 2 job boards and apply for 3 suitable vacancies by 25-Jan-26.",
      help: "increase chances of getting shortlisted",
    },
    {
      barrier: "Health",
      action: "Alex will book a GP appointment to discuss a fit note and identify 2 roles with reasonable adjustments by 25-Jan-26.",
      help: "find suitable work that fits health needs",
    },
    {
      barrier: "Motivation",
      action: "Alex will create a weekly job search routine with 3 specific daily tasks and review progress with advisor by 25-Jan-26.",
      help: "stay focused and build momentum",
    },
    {
      barrier: "Finance",
      action: "Alex will create a weekly budget listing income and essential outgoings using the provided template by 25-Jan-26.",
      help: "understand finances and reduce money worries",
    },
    {
      barrier: "Housing",
      action: "Alex will contact the local council Housing Options team to discuss current housing situation by 25-Jan-26.",
      help: "access housing support and reduce instability",
    },
  ],
};

// -------- Minimal IndexedDB KV store (no deps) --------

const DB_NAME = "smart-tool";
const DB_VERSION = 1;
const STORE = "kv";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as T | undefined);
  });
}

async function kvSet<T>(key: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req = store.put(value as any, key);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function kvDel(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.delete(key);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// -------- Fetch + cache --------

const CACHE_KEY = "promptPack";

// ---- Admin helpers (so you can update/teach prompts centrally) ----

export async function getCachedPromptPack(): Promise<PromptPack | undefined> {
  const cached = await kvGet<PromptPack>(CACHE_KEY);
  return cached && isValidPack(cached) ? cached : undefined;
}

export async function setCachedPromptPack(pack: PromptPack): Promise<void> {
  if (!isValidPack(pack)) throw new Error("Invalid prompt pack JSON");
  await kvSet(CACHE_KEY, pack);
}

export async function clearCachedPromptPack(): Promise<void> {
  await kvDel(CACHE_KEY);
}

export async function fetchRemotePromptPack(): Promise<PromptPack> {
  const raw = await fetchJsonWithTimeout(getPromptPackUrl());
  if (!isValidPack(raw)) throw new Error("Remote prompt pack JSON is invalid");
  return raw;
}

function getPromptPackUrl(): string {
  // Optional override: VITE_PROMPT_PACK_URL=https://.../prompt-pack.json
  const envUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PROMPT_PACK_URL;

  // Default: served from this app's base URL (supports subfolder hosting)
  // e.g. BASE_URL="/smart-support-tool-webapp/" => "/smart-support-tool-webapp/prompt-pack.json"
  const base = (import.meta as unknown as { env?: Record<string, string> }).env?.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : base + "/";

  return envUrl || `${normalizedBase}prompt-pack.json`;
}

function isValidPack(pack: unknown): pack is PromptPack {
  const p = pack as PromptPack;
  return !!p &&
    typeof p.version === "number" &&
    typeof p.updatedAt === "string" &&
    typeof p.systemPrompt === "string" &&
    Array.isArray(p.bannedTopics) &&
    typeof p.barrierGuidance === "object" &&
    Array.isArray(p.fewShot);
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 4000): Promise<unknown> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`Prompt pack fetch failed (${res.status})`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function loadPromptPack(): Promise<{ pack: PromptPack; source: "default" | "cache" | "remote" }>
{
  // 1) Use cached pack immediately if present
  const cached = await kvGet<PromptPack>(CACHE_KEY);
  if (cached && isValidPack(cached)) {
    // 2) In background, try to refresh from remote and update cache (best-effort)
    void (async () => {
      try {
        const remoteRaw = await fetchJsonWithTimeout(getPromptPackUrl());
        if (isValidPack(remoteRaw) && remoteRaw.version >= cached.version) {
          await kvSet(CACHE_KEY, remoteRaw);
        }
      } catch {
        // ignore refresh failures
      }
    })();
    return { pack: cached, source: "cache" };
  }

  // 3) No cache: try remote
  try {
    const remoteRaw = await fetchJsonWithTimeout(getPromptPackUrl());
    if (isValidPack(remoteRaw)) {
      await kvSet(CACHE_KEY, remoteRaw);
      return { pack: remoteRaw, source: "remote" };
    }
  } catch {
    // ignore and fall back
  }

  // 4) Fall back to baked-in defaults
  return { pack: DEFAULT_PROMPT_PACK, source: "default" };
}

// -------- Prompt builders (use the pack content) --------

function normalize(s: string): string {
  return (s || "").toLowerCase();
}

function stripTrailingPunctuation(s: string): string {
  return (s || "").trim().replace(/[.!?]+$/, "");
}

function applyExampleTemplate(template: string, params: { forename: string; targetDate: string; targetTime?: string }): string {
  let t = (template || "").trim();
  // Replace common placeholder tokens with runtime values.
  // Teacher tool stores examples using [NAME] and [DATE] so we can safely substitute.
  const nameTokens = ["[NAME]", "[NAME}", "{NAME}", "<NAME>", "%(NAME)%", "{{NAME}}", "{name}", "[name]", "[name}"];
  const dateTokens = ["[DATE]", "[DATE}", "{DATE}", "<DATE>", "%(DATE)%", "{{DATE}}", "{date}", "[date]", "[date}"];
  for (const tok of nameTokens) {
    t = t.split(tok).join(params.forename);
    t = t.split(tok.toLowerCase()).join(params.forename);
  }
  for (const tok of dateTokens) {
    t = t.split(tok).join(params.targetDate);
    t = t.split(tok.toLowerCase()).join(params.targetDate);
  }
  const timeTokens = ["[TIME]", "[TIME}", "{TIME}", "<TIME>", "%(TIME)%", "{{TIME}}", "{time}", "[time]", "[time}", "[Time}"];
  const timeValue = (params.targetTime || "").trim() || "TBC";
  for (const tok of timeTokens) {
    t = t.split(tok).join(timeValue);
    t = t.split(tok.toLowerCase()).join(timeValue);
  }

  // Defensive: if an example was saved with a literal name (e.g. "Alex will"),
  // treat it as a placeholder so the participant's name is always used.
  // Only replace tokens that look like a first name immediately before "will".
  t = t.replace(/(^|[\n\r\t ,.])([A-Z][a-z]{2,20})(?=\s+will\b)/g, `$1${params.forename}`);
  return t;
}

function toActionPhrase(actionSentence: string): string {
  const raw = (actionSentence || "").trim();
  // Remove common leading scaffolding.
  let t = raw.replace(/^\s*(as\s+discussed\s+and\s+agreed,\s*)/i, "");
  // Convert "Name will ..." into just the phrase.
  const m = t.match(/\bwill\s+([\s\S]+)$/i);
  if (m && m[1]) t = m[1].trim();
  // Remove any leading "action:" fragments
  t = t.replace(/^\s*action\s*:\s*/i, "");
  // Ensure lower-case start (buildNowOutput adds "{name} will")
  if (t) t = t.charAt(0).toLowerCase() + t.slice(1);
  return stripTrailingPunctuation(t);
}


function pickBarrierKey(barrier: string, guidance: Record<string, string[]>): string | null {
  const b = normalize(barrier);
  const keys = Object.keys(guidance);
  for (const k of keys) {
    if (b.includes(normalize(k))) return k;
  }
  return keys.length ? keys[0] : null;
}

function pickFewShot(pack: PromptPack, barrier: string): { action: string; help: string } | null {
  const b = normalize(barrier);
  const match = pack.fewShot.find((ex) => b.includes(normalize(ex.barrier)));
  return match ? { action: match.action, help: match.help } : null;
}

export function buildSystemPrompt(pack: PromptPack): string {
  return pack.systemPrompt;
}

/**
 * Return barrier-specific RIGHT examples for the AI draft prompt.
 * This prevents the model from generating generic job-application actions
 * when the barrier is about something else (e.g. Finance, Housing, Transport).
 */
function getBarrierRightExamples(barrier: string): string {
  const b = normalize(barrier);

  // Finance / money barriers
  if (b.includes("finance") || b.includes("money") || b.includes("debt") || b.includes("budget")) {
    return "'create a weekly budget listing income and essential outgoings by [date]', 'use a benefits calculator to check entitlement by [date]', 'contact creditor to set up an affordable repayment plan by [date]'";
  }
  // Housing
  if (b.includes("housing") || b.includes("homeless") || b.includes("accommodation")) {
    return "'contact the local council Housing Options team by [date]', 'gather housing documents and bring to next appointment by [date]', 'search and shortlist 3 affordable properties on 2 approved sites by [date]'";
  }
  // Transport
  if (b.includes("transport") || b.includes("travel") || b.includes("commut")) {
    return "'plan and save a reliable route to appointments including costs and timings by [date]', 'complete the travel support application and submit evidence by [date]'";
  }
  // Confidence
  if (b.includes("confidence") || b.includes("self-esteem") || b.includes("self esteem")) {
    return "'identify 3 strengths with evidence examples and bring to next meeting by [date]', 'take one small agreed step such as making a phone call and note how it went by [date]'";
  }
  // Mental Wellbeing
  if (b.includes("mental") || b.includes("wellbeing") || b.includes("anxiety") || b.includes("depression")) {
    return "'contact the agreed wellbeing service to arrange an initial appointment by [date]', 'practise one self-care activity at least 3 times this week by [date]'";
  }
  // CV
  if (b.includes("cv") || b.includes("resume")) {
    return "'update CV for target role including a tailored profile and send to advisor by [date]', 'write 2 STAR examples for key skills by [date]'";
  }
  // Interviews
  if (b.includes("interview")) {
    return "'prepare answers to 5 common interview questions and practise twice by [date]', 'book and attend a mock interview session by [date]'";
  }
  // Digital Skills
  if (b.includes("digital skill")) {
    return "'complete the first module of the agreed online digital skills course by [date]', 'practise writing a professional email and send to advisor for feedback by [date]'";
  }
  // Digital Hardware & Connectivity
  if (b.includes("digital") || b.includes("hardware") || b.includes("connectivity") || b.includes("computer") || b.includes("internet")) {
    return "'register for free computer access at the local library by [date]', 'complete a basic digital skills assessment with advisor support by [date]'";
  }
  // Job Search
  if (b.includes("job search")) {
    return "'complete 2 job searches per week on agreed sites saving at least 3 suitable roles by [date]', 'set up job alerts for target role on 2 job boards by [date]'";
  }
  // Job Applications
  if (b.includes("job application") || b.includes("application")) {
    return "'submit 2 quality applications tailored to the job description by [date]', 'start an application tracker and update after every application by [date]'";
  }
  // Caring Responsibilities
  if (b.includes("caring") || b.includes("childcare") || b.includes("children") || b.includes("carer")) {
    return "'research and note 2 local childcare options including costs by [date]', 'contact local carers support service to discuss available support by [date]'";
  }
  // Motivation
  if (b.includes("motivation")) {
    return "'set one realistic weekly goal linked to job goal and report back by [date]', 'create a simple weekly routine including job search time and try it for one week by [date]'";
  }
  // Qualifications
  if (b.includes("qualification") || b.includes("training") || b.includes("course")) {
    return "'research and shortlist 2 relevant courses that support job goal by [date]', 'complete the application for the agreed course by [date]'";
  }
  // Health / Disability
  if (b.includes("health") || b.includes("disability") || b.includes("disab")) {
    return "'discuss work limitations or adjustments needed with advisor by [date]', 'explore Access to Work support and begin application if eligible by [date]'";
  }
  // Photo ID
  if (b.includes("photo id") || b.includes("id")) {
    return "'apply for a provisional driving licence online at gov.uk by [date]', 'apply for a PASS-approved ID card by [date]'";
  }
  // Literacy / Numeracy
  if (b.includes("literacy") || b.includes("numeracy") || b.includes("reading") || b.includes("writing") || b.includes("maths")) {
    return "'complete an initial literacy and numeracy assessment by [date]', 'enrol in a free functional skills course at a local provider by [date]'";
  }
  // Substance Misuse
  if (b.includes("substance") || b.includes("alcohol") || b.includes("drug")) {
    return "'contact the agreed local support service to arrange an initial appointment by [date]', 'attend the scheduled support appointment and note next steps by [date]'";
  }
  // Communication Skills
  if (b.includes("communication") || b.includes("speaking") || b.includes("language")) {
    return "'practise introducing yourself professionally in under one minute 3 times by [date]', 'book and attend the communication skills workshop by [date]'";
  }
  // ADHD / Autism / Learning Difficulties
  if (b.includes("adhd") || b.includes("autism") || b.includes("learning difficult")) {
    return "'create a structured daily routine for job search activities with advisor support by [date]', 'identify reasonable workplace adjustments and discuss with advisor by [date]'";
  }
  // Job Goal
  if (b.includes("job goal") || b.includes("career")) {
    return "'write down target job role including type of work hours and location preferences by [date]', 'research skills and qualifications needed for target role by [date]'";
  }

  // Generic fallback - barrier-neutral practical examples
  return "'attend the agreed appointment and note next steps by [date]', 'gather key documents needed and bring to next appointment by [date]', 'complete the required form and save confirmation by [date]'";
}

export function buildDraftActionPrompt(pack: PromptPack, params: {
  forename: string;
  barrier: string;
  targetDate: string;
  targetTime?: string;
  responsible: string;
}): string {
  const barrierKey = pickBarrierKey(params.barrier, pack.barrierGuidance);
  const bullets = barrierKey ? pack.barrierGuidance[barrierKey] : [];
  const ex = pickFewShot(pack, params.barrier);

  const guidanceLine = bullets?.length
    ? `Barrier hints: ${bullets.slice(0, 5).join(", ")}`
    : "Barrier hints: keep it directly linked to the barrier";

  const banned = pack.bannedTopics?.length ? pack.bannedTopics.join(", ") : "";

  // Keep it short for small models, but include ONE example if available.
  // IMPORTANT: our UI templates already add "As discussed and agreed, ... {name} will".
  // So we ask the local model for a verb-phrase only (no names), which avoids name leakage.
  const examplePhrase = ex
    ? toActionPhrase(applyExampleTemplate(ex.action, { forename: params.forename, targetDate: params.targetDate, targetTime: params.targetTime }))
    : "";
  const exampleBlock = examplePhrase
    ? `EXAMPLE (just the phrase):\n${examplePhrase}\n(benefit: ${ex!.help})\n`
    : "";

  // Build barrier-relevant RIGHT examples so the model stays on-topic
  const barrierRightExamples = getBarrierRightExamples(params.barrier);

  return [
    "TASK: Write ONE realistic employment action PHRASE (no name).",
    "FORMAT: a verb phrase that can follow '{forename} will ...'.",
    "RULES:",
    "1) Do NOT include any person's name.",
    "2) Do NOT include the word 'will' (the app adds it).",
    "3) Must include a measurable element (number or clear deliverable).",
    `4) CRITICAL: The action MUST directly address the barrier '${params.barrier}'. Do NOT suggest generic job applications unless the barrier is specifically about Job Search or Job Applications.`,
    `5) Must include the deadline '${params.targetDate}'${params.targetTime ? ` and time '${params.targetTime}'` : ''}.`,
    `6) Avoid: ${banned || "off-topic content"}`,
    "7) NEVER mention money, prizes, awards, payments, or rewards.",
    "8) NEVER promise job offers or guaranteed outcomes.",
    "9) Only suggest practical steps that directly help overcome the stated barrier.",
    "CONTEXT:",
    `- Person: ${params.forename}`,
    `- Barrier: ${params.barrier}`,
    `- Deadline: ${params.targetDate}`,
    params.targetTime ? `- Time: ${params.targetTime}` : '',
    `- Supporter: ${params.responsible || "Advisor"}`,
    guidanceLine,
    exampleBlock,
    "WRONG: 'be awarded £5000', 'receive a prize', 'get hired', 'win a scholarship'",
    `RIGHT for '${params.barrier}': ${barrierRightExamples}`,
    "OUTPUT: One short phrase only. No quotes. No bullet points.",
  ]
    .filter(Boolean)
    .join("\n");
}

// -------- Local-AI specific post-processing --------

/**
 * The app UI renders: "As discussed and agreed, on DATE, {name} ... {name} will {ACTION}."
 * So Local AI should return only the action phrase.
 */
// Patterns that indicate unrealistic/hallucinated content from small local models
const UNREALISTIC_PATTERNS = /(?:(?:be |get |receive |win |earn |collect )(?:awarded|paid|given|offered)|£\d|€\d|\$\d|\bprize\b|\baward\b|\breward\b|\bbonus\b|\blottery\b|\bscholarship\b|\btrophy\b|\bcompetition\b|\bwill be hired\b|\bguaranteed (?:a )?job\b|\bwill get (?:a )?job\b|\bwill (?:receive|get|be given) (?:a )?(?:job offer|certificate|diploma)\b)/i;

export function sanitizeActionPhrase(text: string, forename: string): string {
  let t = (text || "").trim();
  t = t.replace(/^"+|"+$/g, "");
  t = t.replace(/^\s*(assistant:|<\|assistant\|>)\s*/i, "");

  // Strip any leading wrappers.
  t = t.replace(/^\s*(as\s+discussed\s+and\s+agreed,\s*)/i, "");
  t = t.replace(/^\s*action\s*:\s*/i, "");

  // Remove any leading "Name will" (or "Name will action:") so buildNowOutput doesn't double-name.
  t = t.replace(/^\s*[A-Z][a-z]{2,20}\s+will\s+(?:action\s*:\s*)?/i, "");
  t = t.replace(new RegExp(`^\\s*${forename.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s+will\\s+`, "i"), "");

  // If the model still outputs a full sentence, try to extract the phrase after "will".
  const m = t.match(/\bwill\s+([\s\S]+)$/i);
  if (m && m[1]) t = m[1].trim();

  // Prevent "Jim will action: Alex will ..." type leakage: replace any other-name-before-will.
  t = t.replace(/(^|[\n\r\t ,.])([A-Z][a-z]{2,20})(?=\s+will\b)/g, `$1${forename}`);
  t = t.replace(new RegExp(`\\b${forename}\\s+will\\s+`, "gi"), "");

  // Lowercase start (template adds the capitalised name).
  t = stripTrailingPunctuation(t.trim());
  if (t) t = t.charAt(0).toLowerCase() + t.slice(1);

  // Minimal sanity: avoid returning just "1." etc.
  if (!/[a-z0-9]/i.test(t) || t.length < 4) return "";

  // Reject unrealistic/hallucinated content (monetary rewards, prizes, guaranteed jobs)
  if (UNREALISTIC_PATTERNS.test(t)) {
    console.warn("[LLM] Rejected unrealistic action phrase:", t);
    return "";
  }

  return t;
}

export function buildDraftHelpPrompt(pack: PromptPack, params: {
  action: string;
  subject: string;
}): string {
  const banned = pack.bannedTopics?.length ? pack.bannedTopics.join(", ") : "";
  return [
    `Action: "${params.action}"`,
    "TASK: Describe the job-related benefit in ONE short phrase.",
    `Who benefits: ${params.subject}`,
    "RULES:",
    "- No full sentences. No 'This will help'.",
    "- Must be employment-related (applications, interviews, confidence, skills).",
    banned ? `- Avoid: ${banned}` : "",
    "OUTPUT: One phrase only.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDraftOutcomePrompt(pack: PromptPack, params: {
  forename: string;
  task: string;
}): string {
  const banned = pack.bannedTopics?.length ? pack.bannedTopics.join(", ") : "";
  return [
    "TASK: Write ONE sentence describing a realistic employment outcome.",
    `FORMAT: '${params.forename} will ...'.`,
    "CONTEXT:",
    `- Person: ${params.forename}`,
    `- Activity: ${params.task}`,
    "RULES:",
    "- Employment benefit only (skills, confidence, knowledge for work).",
    "- NEVER mention money, prizes, awards, payments, or guaranteed jobs.",
    "- Focus on learning, networking, building skills, or gaining experience.",
    banned ? `- Avoid: ${banned}` : "",
    "WRONG: 'will be awarded £5000', 'will get a job offer', 'will receive a prize'",
    "RIGHT: 'will gain knowledge of local employers and identify suitable roles to apply for'",
    "OUTPUT: One sentence only. No quotes.",
  ]
    .filter(Boolean)
    .join("\n");
}

// -------- Light post-processing (defensive) --------

export function sanitizeOneSentence(text: string): string {
  let t = (text || "").trim();
  t = t.replace(/^"+|"+$/g, "");
  t = t.replace(/^\s*(assistant:|<\|assistant\|>)\s*/i, "");
  // Keep only first sentence if model rambles.
  const m = t.match(/^(.+?[.!?])\s/);
  if (m && m[1]) t = m[1].trim();
  // Ensure it ends with a period for consistency (unless already ends in ! or ?)
  if (t && !/[.!?]$/.test(t)) t += ".";
  // Reject unrealistic/hallucinated content
  if (UNREALISTIC_PATTERNS.test(t)) {
    console.warn("[LLM] Rejected unrealistic sentence:", t);
    return "";
  }
  return t;
}

export function sanitizeOnePhrase(text: string): string {
  let t = (text || "").trim();
  t = t.replace(/^"+|"+$/g, "");
  // Strip common prefixes - the UI already adds "This action will help..."
  t = t.replace(/^\s*(this action will help|this will help|it will help)\s*/i, "");
  t = t.replace(/^\s*(assistant:|<\|assistant\|>)\s*/i, "");
  // Remove trailing punctuation that makes it look like a sentence.
  t = t.replace(/[.!?]+$/, "").trim();

  // De-dupe an accidental immediate repeat (common on tiny local models)
  // e.g. "upload a CV by Friday upload a CV by Friday" -> "upload a CV by Friday"
  t = t.replace(/^(.{10,120})\s+\1$/i, "$1");
  return t;
}
