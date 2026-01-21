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
  version: 1,
  updatedAt: new Date().toISOString().slice(0, 10),
  systemPrompt:
    "You are a SMART action writing assistant for UK employment advisors. " +
    "Create actions that are Specific, Measurable, Achievable, Relevant, and Time-bound. " +
    "Use UK job search context (Indeed, CV Library, Universal Credit, NHS, local employers). " +
    "Avoid generic waffle. Avoid mentioning booklets or forms unless the user explicitly mentions them. " +
    "Output must match the requested format exactly.",
  bannedTopics: ["coding", "software", "AI", "Hugging Face", "Python", "project", "team meeting"],
  barrierGuidance: {
    Transport: ["routes (bus/rail)", "travel costs", "backup travel plan", "railcard/bus pass"],
    Health: ["GP/NHS support", "reasonable adjustments", "wellbeing routines", "fit note if needed"],
    Confidence: ["mock interviews", "strengths list", "gradual exposure", "positive evidence log"],
    Digital: ["email setup", "job site accounts", "upload CV", "basic IT skills"],
    Housing: ["housing options", "support services", "stable contact details", "budget for rent"],
    Finance: ["budget", "priority bills", "benefits check", "travel/work costs"],
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
      action: "Alex will upload an updated CV to Indeed and apply for 3 suitable roles by 25-Jan-26.",
      help: "increase job applications",
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
  return t;
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
  const exampleBlock = ex
    ? `EXAMPLE (style + format):\nAction: ${applyExampleTemplate(ex.action, { forename: params.forename, targetDate: params.targetDate, targetTime: params.targetTime })}\nBenefit: ${ex.help}\n`
    : "";

  return [
    "TASK: Write ONE employment action sentence.",
    "FORMAT: '{forename} will ... by {targetDate}.' (or use 'on {targetDate} at {targetTime}' if a time is provided).",
    "RULES:",
    `1) Must start with '${params.forename} will'`,
    "2) Must include a measurable element (number or clear deliverable)",
    `3) Must be relevant to the barrier: '${params.barrier}'`,
    `4) Must include the deadline date '${params.targetDate}'${params.targetTime ? ` and time '${params.targetTime}'` : ''}`,
    `5) Avoid: ${banned || "off-topic content"}`,
    "CONTEXT:",
    `- Person: ${params.forename}`,
    `- Barrier: ${params.barrier}`,
    `- Deadline: ${params.targetDate}`,
    params.targetTime ? `- Time: ${params.targetTime}` : '',
    `- Supporter: ${params.responsible || "Advisor"}`,
    guidanceLine,
    exampleBlock ? "" : "",
    exampleBlock,
    "OUTPUT: One sentence only. No quotes. No bullet points.",
  ]
    .filter(Boolean)
    .join("\n");
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
    "- Do not repeat the action sentence; describe the benefit using different words.",
    "- No first-person (I / my).",
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
    "TASK: Write ONE sentence describing the employment outcome.",
    `FORMAT: '${params.forename} will ...'.`,
    "CONTEXT:",
    `- Person: ${params.forename}`,
    `- Activity: ${params.task}`,
    "RULES:",
    "- Employment benefit only (skills, confidence, knowledge for work).",
    banned ? `- Avoid: ${banned}` : "",
    "OUTPUT: One sentence only. No quotes.",
  ]
    .filter(Boolean)
    .join("\n");
}

// -------- Light post-processing (defensive) --------

export function sanitizeOneSentence(text: string): string {
  let t = (text || "").trim();
  // Strip quotes / assistant prefixes
  t = t.replace(/^"+|"+$/g, "");
  t = t.replace(/^\s*(assistant:|<\|assistant\|>)\s*/i, "");
  // Strip bullets / numbering ("1.", "-", "•")
  t = t.replace(/^\s*([\-\*\u2022]|\d+\.)\s*/g, "");
  // Keep only first sentence if model rambles.
  const m = t.match(/^(.+?[.!?])\s/);
  if (m && m[1]) t = m[1].trim();
  // If it is still too short, treat as invalid (caller can retry/fallback)
  const stripped = t.replace(/[^a-z0-9]+/gi, " ").trim();
  if (!stripped || stripped.length < 12) return "";
  // Ensure it ends with punctuation for consistency
  if (t && !/[.!?]$/.test(t)) t += ".";
  return t;
}

export function sanitizeOnePhrase(text: string): string {
  let t = (text || "").trim();
  t = t.replace(/^"+|"+$/g, "");
  t = t.replace(/^\s*(assistant:|<\|assistant\|>)\s*/i, "");
  // Remove common lead-ins that cause duplication
  t = t.replace(/^\s*(this will help|it will help|this action will help)\s*/i, "");
  // Strip bullets / numbering
  t = t.replace(/^\s*([\-\*\u2022]|\d+\.)\s*/g, "");
  // Remove trailing punctuation that makes it look like a sentence.
  t = t.replace(/[.!?]+$/, "").trim();
  // Avoid first-person phrasing in the "help" box
  if (/\b(i|i\x27ve|i have|my)\b/i.test(t)) return "";
  // Too short? invalid
  if (t.replace(/[^a-z0-9]+/gi, " ").trim().length < 8) return "";
  return t;
}