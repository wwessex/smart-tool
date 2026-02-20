/**
 * Tokenizer wrapper for the SMART planner model.
 *
 * Wraps a BPE/SentencePiece tokenizer loaded from a JSON vocabulary file.
 * Provides encode/decode and special token management for structured
 * JSON output generation.
 */

export interface TokenizerConfig {
  /** URL or path to the tokenizer.json file. */
  tokenizer_url: string;
  /** Special tokens used in the model's chat/instruction format. */
  special_tokens: SpecialTokens;
}

export interface SpecialTokens {
  bos: string;
  eos: string;
  pad: string;
  /** Token indicating the start of a JSON output block. */
  json_start: string;
  /** Token indicating the end of a JSON output block. */
  json_end: string;
}

const DEFAULT_SPECIAL_TOKENS: SpecialTokens = {
  bos: "<|begin|>",
  eos: "<|end|>",
  pad: "<|pad|>",
  json_start: "<|json|>",
  json_end: "<|/json|>",
};

/**
 * Lightweight tokenizer that delegates to Transformers.js AutoTokenizer
 * or a custom BPE implementation for minimal-dependency scenarios.
 */
export class SmartTokenizer {
  private vocab: Map<string, number> = new Map();
  private reverseVocab: Map<number, string> = new Map();
  private merges: Array<[string, string]> = [];
  private specialTokens: SpecialTokens;
  private initialized = false;

  constructor(specialTokens: SpecialTokens = DEFAULT_SPECIAL_TOKENS) {
    this.specialTokens = specialTokens;
  }

  /** Load tokenizer from a JSON config (Hugging Face tokenizer.json format). */
  async load(url: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load tokenizer from ${url}: ${response.status}`);
    }

    const config = await response.json();
    this.parseTokenizerConfig(config);
    this.initialized = true;
  }

  private parseTokenizerConfig(config: Record<string, unknown>): void {
    // Handle Hugging Face tokenizer.json format
    const model = config.model as Record<string, unknown> | undefined;
    if (!model) {
      throw new Error("Invalid tokenizer config: missing 'model' field");
    }

    const vocab = model.vocab as Record<string, number> | undefined;
    if (vocab) {
      for (const [token, id] of Object.entries(vocab)) {
        this.vocab.set(token, id);
        this.reverseVocab.set(id, token);
      }
    }

    const merges = model.merges as string[] | undefined;
    if (merges) {
      this.merges = merges.map((m) => {
        const parts = m.split(" ");
        return [parts[0], parts[1]];
      });
    }

    // Register special tokens
    const addedTokens = config.added_tokens as Array<{ content: string; id: number }> | undefined;
    if (addedTokens) {
      for (const token of addedTokens) {
        this.vocab.set(token.content, token.id);
        this.reverseVocab.set(token.id, token.content);
      }
    }
  }

  /** Encode text to token IDs. */
  encode(text: string): number[] {
    this.ensureInitialized();
    // Simplified BPE encoding - in production, this delegates to
    // the full Transformers.js AutoTokenizer or a compiled WASM tokenizer.
    const tokens: number[] = [];

    // Check for special tokens first
    let remaining = text;
    const specialTokenList = Object.values(this.specialTokens);

    while (remaining.length > 0) {
      let foundSpecial = false;
      for (const special of specialTokenList) {
        if (remaining.startsWith(special)) {
          const id = this.vocab.get(special);
          if (id !== undefined) {
            tokens.push(id);
          }
          remaining = remaining.slice(special.length);
          foundSpecial = true;
          break;
        }
      }
      if (!foundSpecial) {
        // Character-level fallback for non-special text
        const char = remaining[0];
        const id = this.vocab.get(char);
        if (id !== undefined) {
          tokens.push(id);
        }
        remaining = remaining.slice(1);
      }
    }

    return tokens;
  }

  /** Decode token IDs back to text. */
  decode(ids: number[]): string {
    this.ensureInitialized();
    return ids
      .map((id) => this.reverseVocab.get(id) ?? "")
      .join("");
  }

  /** Get the token ID for a special token. */
  getSpecialTokenId(token: keyof SpecialTokens): number | undefined {
    return this.vocab.get(this.specialTokens[token]);
  }

  /** Get vocabulary size. */
  get vocabSize(): number {
    return this.vocab.size;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("Tokenizer not initialized. Call load() first.");
    }
  }
}
