// Structured JSON helpers for Local AI drafting.
//
// We treat the model like a slot-filler with strict constraints and then:
// 1) parse JSON defensively
// 2) validate fields
// 3) run anti-repetition checks
// 4) retry once with stricter instructions

export type BarrierMatch = 'high' | 'medium' | 'low';

export interface DraftHelpJson {
  benefitstatement: string;
  barriermatch?: BarrierMatch;
  barrier_reason?: string;
  risk_flags?: string[];
}

// --- JSON extraction ---

// Models sometimes wrap JSON in extra text. Try to extract the first JSON object.
export function extractFirstJsonObject(text: string): string | null {
  const t = (text || '').trim();
  if (!t) return null;

  // Fast path: looks like JSON already
  if (t.startsWith('{') && t.endsWith('}')) return t;

  const start = t.indexOf('{');
  if (start < 0) return null;

  // Very small brace-matching to find the first full object.
  let depth = 0;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    if (depth === 0) {
      const candidate = t.slice(start, i + 1);
      return candidate;
    }
  }
  return null;
}

export function safeJsonParse<T>(text: string): { value: T | null; error?: string } {
  try {
    const extracted = extractFirstJsonObject(text);
    if (!extracted) return { value: null, error: 'nojson' };
    const value = JSON.parse(extracted) as T;
    return { value };
  } catch {
    return { value: null, error: 'parse' };
  }
}

// --- Anti-repetition ---

function normalize(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function jaccardSimilarity(a: string, b: string): number {
  const A = new Set(normalize(a).split(' ').filter(Boolean));
  const B = new Set(normalize(b).split(' ').filter(Boolean));
  const union = new Set([...A, ...B]);
  if (union.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / union.size;
}

export function benefitLooksLikeAction(actionSentence: string, benefit: string): boolean {
  const a = normalize(actionSentence);
  const b = normalize(benefit);
  if (!a || !b) return false;
  // Tune for tiny local models: allow some overlap but block near-echo.
  const sim = jaccardSimilarity(a, b);
  if (sim > 0.45) return true;
  // Also block if a long chunk is copied.
  const head = a.slice(0, 40);
  return head.length >= 20 && b.includes(head);
}

// --- Validation ---

export function validateDraftHelpJson(d: DraftHelpJson | null): string[] {
  const errors: string[] = [];
  if (!d || typeof d !== 'object') return ['notobject'];
  if (typeof d.benefitstatement !== 'string' || d.benefitstatement.trim().length < 8) errors.push('badbenefit');
  if (typeof d.benefitstatement === 'string' && d.benefitstatement.length > 240) errors.push('benefittoolong');
  if (d.risk_flags && !Array.isArray(d.risk_flags)) errors.push('badflags');
  if (d.barriermatch && !['high', 'medium', 'low'].includes(d.barriermatch)) errors.push('badbarriermatch');
  return errors;
}

// --- Sanitisation ---

export function stripLeadingSubject(phrase: string, forename: string): string {
  let t = (phrase || '').trim();
  const escaped = (forename || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (escaped) {
    // "Jim will ..." / "Jim has agreed to ..." / "Jim ..." -> remove the name and commitment lead-in.
    t = t.replace(new RegExp(`^\\s*${escaped}\\s+(?:will\\s+)?`, 'i'), '');
    t = t.replace(new RegExp(`^\\s*${escaped}\\s+`, 'i'), '');
  }
  t = t.replace(/^\s*will\s+/i, '');
  t = t.replace(/^\s*(this action will help|this will help|it will help)\s*/i, '');
  return t.trim();
}
