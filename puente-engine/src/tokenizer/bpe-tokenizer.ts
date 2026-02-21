/**
 * Full BPE tokenizer implementation for Puente Engine.
 *
 * Loads HuggingFace tokenizer.json format and provides encode/decode
 * with proper BPE merge algorithm, pre-tokenization, normalisation,
 * and special token handling.
 *
 * Supports:
 * - GPT-2/LLaMA style byte-level BPE
 * - SentencePiece/Marian style BPE
 * - Added/special token matching
 * - Configurable normaliser, pre-tokenizer, and decoder chains
 */

import type { TokenizerJSON, AddedToken } from "../core/types.js";
import { buildNormalizer, type Normalizer } from "./normalizer.js";
import {
  buildPreTokenizer,
  type PreTokenizer,
} from "./pre-tokenizer.js";
import { buildDecoder, type TokenDecoder } from "./decoder.js";

/** A single BPE merge rule: pair of symbols → merged symbol. */
interface MergeRule {
  a: string;
  b: string;
  rank: number;
}

export class BPETokenizer {
  /** Token string → token ID. */
  private vocab: Map<string, number> = new Map();
  /** Token ID → token string. */
  private reverseVocab: Map<number, string> = new Map();
  /** Ordered BPE merge rules. rank = index = priority (lower = higher priority). */
  private merges: MergeRule[] = [];
  /** Merge pair key → rank for O(1) lookup. */
  private mergeRanks: Map<string, number> = new Map();
  /** Added tokens (special tokens) with their properties. */
  private addedTokens: AddedToken[] = [];
  /** Added token content → ID for fast lookup. */
  private addedTokenMap: Map<string, number> = new Map();
  /** Set of special token IDs. */
  private specialTokenIds: Set<number> = new Set();
  /** BOS, EOS, PAD token IDs. */
  private _bosTokenId: number | undefined;
  private _eosTokenId: number | undefined;
  private _padTokenId: number | undefined;
  /** Unknown token. */
  private unkToken: string | undefined;
  private unkTokenId: number | undefined;

  /** Text normaliser. */
  private normalizer: Normalizer;
  /** Pre-tokenizer (splits text into words before BPE). */
  private preTokenizer: PreTokenizer;
  /** Token decoder (converts tokens back to text). */
  private decoder: TokenDecoder;

  private initialized = false;

  constructor() {
    // Set default no-op normaliser/pre-tokenizer/decoder.
    // These will be replaced when load() parses the tokenizer config.
    this.normalizer = { normalize: (t: string) => t };
    this.preTokenizer = { preTokenize: (t: string) => [t] };
    this.decoder = { decode: (tokens: string[]) => tokens.join("") };
  }

  /**
   * Load tokenizer from a tokenizer.json source.
   * Accepts a URL string, an ArrayBuffer, or a pre-parsed object.
   */
  async load(source: string | ArrayBuffer | TokenizerJSON): Promise<void> {
    let config: TokenizerJSON;

    if (typeof source === "string") {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(
          `Failed to load tokenizer from ${source}: ${response.status}`
        );
      }
      config = (await response.json()) as TokenizerJSON;
    } else if (source instanceof ArrayBuffer) {
      const text = new TextDecoder().decode(source);
      config = JSON.parse(text) as TokenizerJSON;
    } else {
      config = source;
    }

    this.parseConfig(config);
    this.initialized = true;
  }

  /**
   * Encode text to an array of token IDs.
   */
  encode(text: string): number[] {
    this.ensureInitialized();
    if (text.length === 0) return [];

    // Step 1: Normalise
    const normalized = this.normalizer.normalize(text);

    // Step 2: Handle added/special tokens — split text around them
    const segments = this.splitOnAddedTokens(normalized);

    const ids: number[] = [];

    for (const segment of segments) {
      if (segment.isSpecial) {
        // Added token: look up directly
        const id = this.addedTokenMap.get(segment.text);
        if (id !== undefined) {
          ids.push(id);
        }
      } else {
        // Regular text: pre-tokenize → BPE each word → collect IDs
        const words = this.preTokenizer.preTokenize(segment.text);
        for (const word of words) {
          const bpeTokens = this.bpe(word);
          for (const token of bpeTokens) {
            const id = this.vocab.get(token);
            if (id !== undefined) {
              ids.push(id);
            } else if (this.unkTokenId !== undefined) {
              ids.push(this.unkTokenId);
            }
          }
        }
      }
    }

    return ids;
  }

  /**
   * Decode token IDs back to text.
   */
  decode(ids: number[], skipSpecialTokens: boolean = true): string {
    this.ensureInitialized();
    if (ids.length === 0) return "";

    const tokens: string[] = [];
    for (const id of ids) {
      if (skipSpecialTokens && this.specialTokenIds.has(id)) {
        continue;
      }
      const token = this.reverseVocab.get(id);
      if (token !== undefined) {
        tokens.push(token);
      }
    }

    return this.decoder.decode(tokens);
  }

  /**
   * Get the token ID for a given token string.
   */
  getTokenId(token: string): number | undefined {
    return this.vocab.get(token) ?? this.addedTokenMap.get(token);
  }

  /** Vocabulary size (including added tokens). */
  get vocabSize(): number {
    return this.vocab.size;
  }

  get bosTokenId(): number | undefined {
    return this._bosTokenId;
  }

  get eosTokenId(): number | undefined {
    return this._eosTokenId;
  }

  get padTokenId(): number | undefined {
    return this._padTokenId;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  // -------------------------------------------------------------------------
  // Private: Config parsing
  // -------------------------------------------------------------------------

  private parseConfig(config: TokenizerJSON): void {
    const model = config.model;
    if (!model) {
      throw new Error("Invalid tokenizer.json: missing 'model' field");
    }

    // Parse vocabulary
    if (model.vocab) {
      for (const [token, id] of Object.entries(model.vocab)) {
        this.vocab.set(token, id);
        this.reverseVocab.set(id, token);
      }
    }

    // Parse merge rules
    if (model.merges) {
      for (let i = 0; i < model.merges.length; i++) {
        const parts = model.merges[i].split(" ");
        if (parts.length >= 2) {
          const rule: MergeRule = { a: parts[0], b: parts[1], rank: i };
          this.merges.push(rule);
          this.mergeRanks.set(`${parts[0]} ${parts[1]}`, i);
        }
      }
    }

    // Unknown token
    this.unkToken = model.unk_token ?? undefined;
    if (this.unkToken) {
      this.unkTokenId = this.vocab.get(this.unkToken);
    }

    // Parse added tokens
    if (config.added_tokens) {
      this.addedTokens = config.added_tokens;
      for (const token of config.added_tokens) {
        this.addedTokenMap.set(token.content, token.id);
        // Also add to vocab/reverseVocab if not already present
        if (!this.vocab.has(token.content)) {
          this.vocab.set(token.content, token.id);
        }
        if (!this.reverseVocab.has(token.id)) {
          this.reverseVocab.set(token.id, token.content);
        }
        if (token.special) {
          this.specialTokenIds.add(token.id);
        }
      }

      // Identify BOS/EOS/PAD
      this.identifySpecialTokens(config.added_tokens);
    }

    // Build normaliser, pre-tokenizer, decoder from config
    this.normalizer = buildNormalizer(config.normalizer);
    this.preTokenizer = buildPreTokenizer(config.pre_tokenizer);
    this.decoder = buildDecoder(config.decoder);
  }

  private identifySpecialTokens(tokens: AddedToken[]): void {
    for (const token of tokens) {
      const content = token.content.toLowerCase();
      if (
        content === "<s>" ||
        content === "<bos>" ||
        content === "<|begin|>" ||
        content === "<|startoftext|>"
      ) {
        this._bosTokenId = token.id;
      }
      if (
        content === "</s>" ||
        content === "<eos>" ||
        content === "<|end|>" ||
        content === "<|endoftext|>"
      ) {
        this._eosTokenId = token.id;
      }
      if (
        content === "<pad>" ||
        content === "<|pad|>"
      ) {
        this._padTokenId = token.id;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Private: BPE algorithm
  // -------------------------------------------------------------------------

  /**
   * Apply BPE to a single word (pre-tokenized segment).
   * Returns an array of BPE token strings.
   *
   * The algorithm:
   * 1. Start with the word split into individual characters
   * 2. Repeatedly find the highest-priority merge pair
   * 3. Merge that pair into a single symbol
   * 4. Continue until no more merges apply
   */
  private bpe(word: string): string[] {
    if (word.length === 0) return [];
    if (word.length === 1) {
      return this.vocab.has(word) ? [word] : (this.unkToken ? [this.unkToken] : []);
    }

    // Start with individual characters
    let symbols = Array.from(word);

    // Check for single-character tokens not in vocab (byte fallback)
    // For most BPE tokenizers, all single bytes are in the vocab

    while (symbols.length > 1) {
      // Find the pair with the lowest rank (highest priority)
      let bestRank = Infinity;
      let bestIdx = -1;

      for (let i = 0; i < symbols.length - 1; i++) {
        const pairKey = `${symbols[i]} ${symbols[i + 1]}`;
        const rank = this.mergeRanks.get(pairKey);
        if (rank !== undefined && rank < bestRank) {
          bestRank = rank;
          bestIdx = i;
        }
      }

      // No more merges possible
      if (bestIdx === -1) break;

      // Apply the merge: combine symbols[bestIdx] and symbols[bestIdx+1]
      const merged = symbols[bestIdx] + symbols[bestIdx + 1];
      const newSymbols: string[] = [];

      let i = 0;
      while (i < symbols.length) {
        if (i === bestIdx) {
          newSymbols.push(merged);
          i += 2; // Skip both merged symbols
        } else {
          newSymbols.push(symbols[i]);
          i++;
        }
      }

      symbols = newSymbols;
    }

    return symbols;
  }

  // -------------------------------------------------------------------------
  // Private: Added token splitting
  // -------------------------------------------------------------------------

  /**
   * Split text around added/special tokens.
   * Added tokens are matched literally and take priority over BPE.
   */
  private splitOnAddedTokens(
    text: string
  ): Array<{ text: string; isSpecial: boolean }> {
    if (this.addedTokens.length === 0) {
      return [{ text, isSpecial: false }];
    }

    // Build a regex that matches any added token
    // Sort by length descending so longer tokens match first
    const sortedTokens = [...this.addedTokens].sort(
      (a, b) => b.content.length - a.content.length
    );

    const escapedPatterns = sortedTokens.map((t) =>
      escapeRegExp(t.content)
    );
    const pattern = new RegExp(`(${escapedPatterns.join("|")})`, "g");

    const segments: Array<{ text: string; isSpecial: boolean }> = [];
    let lastIndex = 0;

    for (const match of text.matchAll(pattern)) {
      const matchStart = match.index!;
      const matchText = match[0];

      // Text before the match
      if (matchStart > lastIndex) {
        const before = text.slice(lastIndex, matchStart);
        if (before.length > 0) {
          segments.push({ text: before, isSpecial: false });
        }
      }

      // The matched added token
      segments.push({ text: matchText, isSpecial: true });
      lastIndex = matchStart + matchText.length;
    }

    // Remaining text after last match
    if (lastIndex < text.length) {
      const remaining = text.slice(lastIndex);
      if (remaining.length > 0) {
        segments.push({ text: remaining, isSpecial: false });
      }
    }

    if (segments.length === 0 && text.length > 0) {
      segments.push({ text, isSpecial: false });
    }

    return segments;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("Tokenizer not initialized. Call load() first.");
    }
  }
}

/** Escape a string for use in a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
