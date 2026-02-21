/**
 * Pre-tokenization: splitting text into words before BPE.
 *
 * Supports the pre-tokenizer configs found in HuggingFace tokenizer.json:
 * - ByteLevel: GPT-2/LLaMA style byte-level BPE
 * - Whitespace: simple whitespace splitting (Marian/OPUS-MT)
 * - Sequence: chain multiple pre-tokenizers
 */

import type { PreTokenizerConfig } from "../core/types.js";

/** Interface for pre-tokenizers. */
export interface PreTokenizer {
  preTokenize(text: string): string[];
}

// ---------------------------------------------------------------------------
// Byte-level BPE helpers (GPT-2 style)
// ---------------------------------------------------------------------------

/**
 * GPT-2's bytes-to-unicode mapping.
 * Maps each byte value (0-255) to a unique Unicode character.
 * This allows BPE to operate on arbitrary byte sequences as printable text.
 */
function buildBytesToUnicode(): Map<number, string> {
  const bs: number[] = [];
  const cs: number[] = [];

  // Printable ASCII ranges that map to themselves
  for (let i = "!".charCodeAt(0); i <= "~".charCodeAt(0); i++) {
    bs.push(i);
    cs.push(i);
  }
  for (let i = "¡".charCodeAt(0); i <= "¬".charCodeAt(0); i++) {
    bs.push(i);
    cs.push(i);
  }
  for (let i = "®".charCodeAt(0); i <= "ÿ".charCodeAt(0); i++) {
    bs.push(i);
    cs.push(i);
  }

  // Remaining bytes map to 256+
  let n = 0;
  for (let b = 0; b < 256; b++) {
    if (!bs.includes(b)) {
      bs.push(b);
      cs.push(256 + n);
      n++;
    }
  }

  const map = new Map<number, string>();
  for (let i = 0; i < bs.length; i++) {
    map.set(bs[i], String.fromCharCode(cs[i]));
  }
  return map;
}

/** Cached bytes-to-unicode mapping. */
let _bytesToUnicode: Map<number, string> | null = null;

/** Get the bytes-to-unicode mapping (cached). */
export function bytesToUnicode(): Map<number, string> {
  if (!_bytesToUnicode) {
    _bytesToUnicode = buildBytesToUnicode();
  }
  return _bytesToUnicode;
}

/** Reverse mapping: unicode character → byte value. */
let _unicodeToBytes: Map<string, number> | null = null;

export function unicodeToBytes(): Map<string, number> {
  if (!_unicodeToBytes) {
    _unicodeToBytes = new Map<string, number>();
    for (const [byte, char] of bytesToUnicode()) {
      _unicodeToBytes.set(char, byte);
    }
  }
  return _unicodeToBytes;
}

/**
 * Convert a UTF-8 string to byte-level BPE tokens.
 * Each byte of the UTF-8 encoding maps to a Unicode character via bytesToUnicode().
 */
export function textToByteTokens(text: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);
  const b2u = bytesToUnicode();
  let result = "";
  for (const byte of bytes) {
    result += b2u.get(byte) ?? "";
  }
  return result;
}

// ---------------------------------------------------------------------------
// Pre-tokenizer implementations
// ---------------------------------------------------------------------------

/**
 * Byte-level pre-tokenizer (GPT-2 style).
 * Splits text on whitespace/punctuation boundaries using a regex,
 * then maps each byte to a BPE unicode character.
 */
export class ByteLevelPreTokenizer implements PreTokenizer {
  private addPrefixSpace: boolean;

  // GPT-2 tokenization regex: split on contractions, letters, numbers, punctuation
  private readonly SPLIT_PATTERN =
    /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

  constructor(addPrefixSpace: boolean = false) {
    this.addPrefixSpace = addPrefixSpace;
  }

  preTokenize(text: string): string[] {
    let input = text;
    if (this.addPrefixSpace && input.length > 0 && input[0] !== " ") {
      input = " " + input;
    }

    const matches = input.match(this.SPLIT_PATTERN);
    if (!matches) return [];

    // Convert each matched segment to byte-level tokens
    return matches.map((word) => textToByteTokens(word));
  }
}

/**
 * Whitespace pre-tokenizer.
 * Splits on whitespace boundaries. Used by Marian/OPUS-MT models.
 */
export class WhitespacePreTokenizer implements PreTokenizer {
  preTokenize(text: string): string[] {
    return text.split(/\s+/).filter((w) => w.length > 0);
  }
}

/**
 * Split pre-tokenizer.
 * Splits using a pattern and can split on the matched pattern itself,
 * or on the content between matches.
 */
export class SplitPreTokenizer implements PreTokenizer {
  private pattern: RegExp;
  private behavior: string;

  constructor(pattern: string, behavior: string = "removed") {
    this.pattern = new RegExp(pattern, "g");
    this.behavior = behavior;
  }

  preTokenize(text: string): string[] {
    if (this.behavior === "isolated") {
      // Split and keep the separators as separate tokens
      const parts = text.split(this.pattern);
      return parts.filter((p) => p.length > 0);
    }
    // Default: remove separators
    return text.split(this.pattern).filter((p) => p.length > 0);
  }
}

/**
 * Digits pre-tokenizer.
 * Splits digits into individual characters (used by some models).
 */
export class DigitsPreTokenizer implements PreTokenizer {
  private individualDigits: boolean;

  constructor(individualDigits: boolean = true) {
    this.individualDigits = individualDigits;
  }

  preTokenize(text: string): string[] {
    if (!this.individualDigits) return [text];
    // Split around digit boundaries
    return text.split(/(\d)/).filter((p) => p.length > 0);
  }
}

/**
 * Sequence pre-tokenizer: chains multiple pre-tokenizers.
 */
export class SequencePreTokenizer implements PreTokenizer {
  private pretokenizers: PreTokenizer[];

  constructor(pretokenizers: PreTokenizer[]) {
    this.pretokenizers = pretokenizers;
  }

  preTokenize(text: string): string[] {
    let tokens = [text];

    for (const pt of this.pretokenizers) {
      const next: string[] = [];
      for (const token of tokens) {
        next.push(...pt.preTokenize(token));
      }
      tokens = next;
    }

    return tokens;
  }
}

/** Identity pre-tokenizer (returns text as single token). */
export class IdentityPreTokenizer implements PreTokenizer {
  preTokenize(text: string): string[] {
    return text.length > 0 ? [text] : [];
  }
}

/**
 * Build a PreTokenizer from a tokenizer.json pre_tokenizer config.
 */
export function buildPreTokenizer(
  config: PreTokenizerConfig | null | undefined
): PreTokenizer {
  if (!config) return new IdentityPreTokenizer();

  switch (config.type) {
    case "ByteLevel":
      return new ByteLevelPreTokenizer(config.add_prefix_space ?? false);
    case "Whitespace":
      return new WhitespacePreTokenizer();
    case "Split":
      return new SplitPreTokenizer(
        config.pattern as string ?? "\\s+",
        config.behavior as string ?? "removed"
      );
    case "Digits":
      return new DigitsPreTokenizer(
        config.individual_digits as boolean ?? true
      );
    case "Sequence":
      return new SequencePreTokenizer(
        (config.pretokenizers ?? []).map(buildPreTokenizer)
      );
    default:
      return new IdentityPreTokenizer();
  }
}
