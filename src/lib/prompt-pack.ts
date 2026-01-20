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
  // Vite env var (optional): VITE_PROMPT_PACK_URL=https://.../prompt-pack.json
  // Default: served from /public/prompt-pack.json
  const envUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_PROMPT_PACK_URL;
  if (envUrl) return envUrl;

  // When hosted in a sub-folder (e.g. /smart-tool/), using an absolute path
  // would incorrectly point to the site root. Vite exposes BASE_URL for this.
  const base = (import.meta as any).env?.BASE_URL || "/";
  return `${base}prompt-pack.json`;
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
    ? `EXAMPLE (style + format):\nAction: ${ex.action}\nBenefit: ${ex.help}\n`
    : "";

  return [
    "TASK: Write ONE employment action sentence.",
    "FORMAT: '{forename} will ... by {targetDate}.'.",
    "RULES:",
    `1) Must start with '${params.forename} will'`,
    "2) Must include a measurable element (number or clear deliverable)",
    `3) Must be relevant to the barrier: '${params.barrier}'`,
    `4) Must end with 'by ${params.targetDate}'`,
    `5) Avoid: ${banned || "off-topic content"}`,
    "CONTEXT:",
    `- Person: ${params.forename}`,
    `- Barrier: ${params.barrier}`,
    `- Deadline: ${params.targetDate}`,
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
  t = t.replace(/^"+|"+$/g, "");
  t = t.replace(/^\s*(assistant:|<\|assistant\|>)\s*/i, "");
  // Keep only first sentence if model rambles.
  const m = t.match(/^(.+?[.!?])\s/);
  if (m && m[1]) t = m[1].trim();
  // Ensure it ends with a period for consistency (unless already ends in ! or ?)
  if (t && !/[.!?]$/.test(t)) t += ".";
  return t;
}

export function sanitizeOnePhrase(text: string): string {
  let t = (text || "").trim();
  t = t.replace(/^"+|"+$/g, "");
  t = t.replace(/^\s*(this will help|it will help)\s*/i, "");
  t = t.replace(/^\s*(assistant:|<\|assistant\|>)\s*/i, "");
  // Remove trailing punctuation that makes it look like a sentence.
  t = t.replace(/[.!?]+$/, "").trim();
  return t;
}
