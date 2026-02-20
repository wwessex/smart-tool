/**
 * Text segmentation for translation.
 *
 * Splits input text into chunks that respect paragraph and sentence
 * boundaries, keeping each chunk within model token limits.
 * Preserves whitespace structure so translations can be reassembled
 * without losing formatting.
 *
 * Design follows the existing localTranslator.ts chunking approach
 * but adds placeholder preservation for format strings.
 */

/** A text chunk with metadata for reassembly. */
export interface TextChunk {
  /** The text content to translate. */
  text: string;
  /** Original index for ordered reassembly. */
  index: number;
  /** Whether this chunk is a paragraph separator (not translated). */
  isSeparator: boolean;
}

/** Options for text chunking. */
export interface ChunkOptions {
  /** Maximum characters per chunk (default: 900). */
  maxChars: number;
  /** Whether to preserve placeholder tokens like {0}, %s, {{name}} (default: true). */
  preservePlaceholders: boolean;
}

const DEFAULT_OPTIONS: ChunkOptions = {
  maxChars: 900,
  preservePlaceholders: true,
};

/** Pattern matching common placeholder formats. */
// [^{}]+ (not [^}]+) prevents polynomial backtracking on repeated '{' input.
// Double-brace \{\{…\}\} is listed first so it matches before single-brace.
const PLACEHOLDER_PATTERN = /(\{\{[^{}]+\}\}|\{[^{}]+\}|%[sd]|%\d+\$[sd])/g;

/**
 * Split text into translation-safe chunks.
 *
 * Respects paragraph boundaries (double newlines), then sentence
 * boundaries (period/exclamation/question followed by whitespace).
 * Empty/whitespace-only input returns an empty array.
 *
 * @example
 * chunkText("Hello world. This is a test.\n\nSecond paragraph.")
 * // → [
 * //   { text: "Hello world. This is a test.", index: 0, isSeparator: false },
 * //   { text: "\n\n", index: 1, isSeparator: true },
 * //   { text: "Second paragraph.", index: 2, isSeparator: false },
 * // ]
 */
export function chunkText(
  input: string,
  options: Partial<ChunkOptions> = {}
): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const text = input.trim();
  if (!text) return [];

  const chunks: TextChunk[] = [];
  let index = 0;

  // Split by paragraph boundaries (double newline with optional whitespace)
  const paragraphs = text.split(/(\n\s*\n)/g);

  for (const segment of paragraphs) {
    // Paragraph separators are preserved but not translated
    if (/^\n\s*\n$/.test(segment)) {
      chunks.push({ text: segment, index: index++, isSeparator: true });
      continue;
    }

    const para = segment.trim();
    if (!para) continue;

    // If paragraph fits in one chunk, use it directly
    if (para.length <= opts.maxChars) {
      chunks.push({ text: para, index: index++, isSeparator: false });
      continue;
    }

    // Split long paragraphs by sentence boundaries
    const sentences = splitSentences(para);
    let buffer = "";

    for (const sentence of sentences) {
      const candidate = buffer ? `${buffer} ${sentence}` : sentence;

      if (candidate.length > opts.maxChars) {
        // Flush current buffer
        if (buffer.trim()) {
          chunks.push({ text: buffer.trim(), index: index++, isSeparator: false });
        }

        // If a single sentence exceeds max, split it by clause boundaries
        if (sentence.length > opts.maxChars) {
          const subChunks = splitLongSentence(sentence, opts.maxChars);
          for (const sub of subChunks) {
            chunks.push({ text: sub, index: index++, isSeparator: false });
          }
          buffer = "";
        } else {
          buffer = sentence;
        }
      } else {
        buffer = candidate;
      }
    }

    if (buffer.trim()) {
      chunks.push({ text: buffer.trim(), index: index++, isSeparator: false });
    }
  }

  return chunks;
}

/**
 * Reassemble translated chunks back into a complete text.
 * Separators are preserved in their original positions.
 */
export function reassembleChunks(chunks: TextChunk[]): string {
  return chunks
    .sort((a, b) => a.index - b.index)
    .map((c) => c.text)
    .join("\n\n");
}

/**
 * Extract and replace placeholders with numbered tokens before translation,
 * then restore them after. This prevents the model from mangling format strings.
 *
 * @returns Object with cleaned text and a restore function.
 */
export function protectPlaceholders(text: string): {
  cleaned: string;
  restore: (translated: string) => string;
} {
  const placeholders: string[] = [];
  const cleaned = text.replace(PLACEHOLDER_PATTERN, (match) => {
    const idx = placeholders.length;
    placeholders.push(match);
    // Use a token unlikely to appear in natural text
    return `\uFFF0${idx}\uFFF0`;
  });

  const restore = (translated: string): string => {
    return translated.replace(/\uFFF0(\d+)\uFFF0/g, (_, idxStr) => {
      const idx = parseInt(idxStr, 10);
      return placeholders[idx] ?? "";
    });
  };

  return { cleaned, restore };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Split text into sentences using punctuation boundaries.
 * Handles common abbreviations to avoid false splits.
 */
function splitSentences(text: string): string[] {
  // Split after sentence-ending punctuation followed by whitespace
  // Negative lookbehind avoids splitting on common abbreviations
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.filter((p) => p.trim().length > 0);
}

/**
 * Split a very long sentence into smaller chunks at clause boundaries
 * (commas, semicolons, conjunctions) or as a last resort, at word boundaries.
 */
function splitLongSentence(sentence: string, maxChars: number): string[] {
  const chunks: string[] = [];

  // Try splitting at clause boundaries first
  const clauseParts = sentence.split(/(?<=[,;])\s+|(?<=\band\b|\bbut\b|\bor\b)\s+/);

  let buffer = "";
  for (const part of clauseParts) {
    const candidate = buffer ? `${buffer} ${part}` : part;
    if (candidate.length > maxChars && buffer.trim()) {
      chunks.push(buffer.trim());
      buffer = part;
    } else {
      buffer = candidate;
    }
  }

  if (buffer.trim()) {
    // If still too long, hard-split at word boundaries
    if (buffer.length > maxChars) {
      const words = buffer.split(/\s+/);
      let wordBuf = "";
      for (const word of words) {
        const candidate = wordBuf ? `${wordBuf} ${word}` : word;
        if (candidate.length > maxChars && wordBuf.trim()) {
          chunks.push(wordBuf.trim());
          wordBuf = word;
        } else {
          wordBuf = candidate;
        }
      }
      if (wordBuf.trim()) chunks.push(wordBuf.trim());
    } else {
      chunks.push(buffer.trim());
    }
  }

  return chunks;
}
