// NOTE: @huggingface/transformers is imported dynamically (not at module level)
// to avoid crashing iOS Safari at page load. The library is very large and
// eagerly importing it causes the WebContent process to exceed memory limits.
import type { TranslationPipeline } from "@huggingface/transformers";

/**
 * Offline translation using a real translation model (NOT a chat LLM prompt).
 * This fixes looping / partial / unchanged outputs seen in some languages.
 *
 * Model: Xenova/nllb-200-distilled-600M (broad language coverage)
 *
 * The model is downloaded from Hugging Face Hub on first use and cached
 * in the browser for subsequent offline access.
 */
const MODEL_ID = "Xenova/nllb-200-distilled-600M";

const TARGET_LANG: Record<string, string> = {
  ar: "ara_Arab",
  ps: "pus_Arab",
  ur: "urd_Arab",
  bn: "ben_Beng",
  hi: "hin_Deva",
  pa: "pan_Guru",
  pl: "pol_Latn",
  cy: "cym_Latn",
  so: "som_Latn",
  ti: "tir_Ethi",
};

const RTL = new Set(["ar", "ps", "ur"]);

let translatorPromise: Promise<TranslationPipeline> | null = null;

async function getTranslator() {
  if (!translatorPromise) {
    translatorPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      return pipeline("translation", MODEL_ID) as Promise<TranslationPipeline>;
    })();
  }
  return translatorPromise;
}

function chunkText(input: string, maxChars = 900) {
  const text = input.trim();
  if (!text) return [];

  // Keep paragraph structure
  const paras = text.split(/\n\s*\n/g).map(p => p.trim()).filter(Boolean);
  const chunks: string[] = [];

  for (const para of paras) {
    if (para.length <= maxChars) {
      chunks.push(para);
      continue;
    }

    // Sentence-ish split
    const parts = para.split(/(?<=[\.!\?])\s+/);
    let buf = "";
    for (const part of parts) {
      const candidate = buf ? `${buf} ${part}` : part;
      if (candidate.length > maxChars) {
        if (buf.trim()) chunks.push(buf.trim());
        buf = part;
      } else {
        buf = candidate;
      }
    }
    if (buf.trim()) chunks.push(buf.trim());
  }

  return chunks;
}

export function isRTL(lang: string) {
  return RTL.has(lang);
}

export async function translateOffline(englishText: string, targetLang: string) {
  const tgt_lang = TARGET_LANG[targetLang];
  if (!tgt_lang) throw new Error(`Offline translation not configured for: ${targetLang}`);

  const translator = await getTranslator();
  const chunks = chunkText(englishText);

  const out: string[] = [];
  for (const c of chunks) {
    const res = await translator(c, {
      src_lang: "eng_Latn",
      tgt_lang,
      max_new_tokens: 512,
    } as any);

    const t = Array.isArray(res) ? (res[0] as any)?.translation_text : (res as any)?.translation_text;
    out.push(String(t ?? "").trim());
  }

  const joined = out.join("\n\n").trim();

  // If output is unchanged, treat as failure (prevents "English in quotes" cases)
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  if (joined && norm(joined) === norm(englishText)) {
    throw new Error("Translation failed (model returned unchanged text).");
  }

  return joined;
}
