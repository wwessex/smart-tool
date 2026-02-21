/**
 * Token-to-text decoders for BPE tokenizers.
 *
 * Handles converting token strings back to readable text,
 * including byte-level BPE decoding (GPT-2 style) and
 * SentencePiece-style "▁" replacement.
 */

import type { DecoderConfig } from "../core/types.js";
import { unicodeToBytes } from "./pre-tokenizer.js";

/** Interface for token decoders. */
export interface TokenDecoder {
  decode(tokens: string[]): string;
}

/**
 * Byte-level decoder.
 * Reverses the byte-to-unicode mapping used by ByteLevelPreTokenizer.
 * Converts BPE unicode characters back to UTF-8 bytes.
 */
export class ByteLevelDecoder implements TokenDecoder {
  decode(tokens: string[]): string {
    const joined = tokens.join("");
    const u2b = unicodeToBytes();
    const bytes: number[] = [];

    for (const char of joined) {
      const byte = u2b.get(char);
      if (byte !== undefined) {
        bytes.push(byte);
      } else {
        // Characters not in the byte mapping — encode as UTF-8
        const encoded = new TextEncoder().encode(char);
        for (const b of encoded) {
          bytes.push(b);
        }
      }
    }

    return new TextDecoder("utf-8", { fatal: false }).decode(
      new Uint8Array(bytes)
    );
  }
}

/**
 * Metaspace decoder (SentencePiece style).
 * Replaces the "▁" character with a space and strips leading space.
 */
export class MetaspaceDecoder implements TokenDecoder {
  private replacement: string;
  private addPrefixSpace: boolean;

  constructor(replacement: string = "▁", addPrefixSpace: boolean = true) {
    this.replacement = replacement;
    this.addPrefixSpace = addPrefixSpace;
  }

  decode(tokens: string[]): string {
    let text = tokens.join("").replace(
      new RegExp(escapeRegExp(this.replacement), "g"),
      " "
    );
    if (this.addPrefixSpace && text.startsWith(" ")) {
      text = text.slice(1);
    }
    return text;
  }
}

/**
 * WordPiece decoder.
 * Joins tokens, removing "##" prefix from continuation tokens.
 */
export class WordPieceDecoder implements TokenDecoder {
  private prefix: string;

  constructor(prefix: string = "##") {
    this.prefix = prefix;
  }

  decode(tokens: string[]): string {
    return tokens
      .map((t, i) => {
        if (i > 0 && t.startsWith(this.prefix)) {
          return t.slice(this.prefix.length);
        }
        return i > 0 ? " " + t : t;
      })
      .join("");
  }
}

/**
 * Sequence decoder: chains multiple decoders.
 * Each decoder processes the result of the previous one.
 */
export class SequenceDecoder implements TokenDecoder {
  private decoders: TokenDecoder[];

  constructor(decoders: TokenDecoder[]) {
    this.decoders = decoders;
  }

  decode(tokens: string[]): string {
    // First decoder processes the token array
    if (this.decoders.length === 0) return tokens.join("");

    let result = this.decoders[0].decode(tokens);

    // Subsequent decoders process the string as a single-element array
    for (let i = 1; i < this.decoders.length; i++) {
      result = this.decoders[i].decode([result]);
    }

    return result;
  }
}

/**
 * Replace decoder: replaces a pattern in joined tokens.
 */
export class ReplaceDecoder implements TokenDecoder {
  private pattern: string;
  private replacement: string;

  constructor(pattern: string, replacement: string) {
    this.pattern = pattern;
    this.replacement = replacement;
  }

  decode(tokens: string[]): string {
    return tokens
      .join("")
      .replace(new RegExp(escapeRegExp(this.pattern), "g"), this.replacement);
  }
}

/**
 * Fuse decoder: simply joins tokens with no separator.
 */
export class FuseDecoder implements TokenDecoder {
  decode(tokens: string[]): string {
    return tokens.join("");
  }
}

/**
 * Strip decoder: strips leading/trailing whitespace from each token.
 */
export class StripDecoder implements TokenDecoder {
  private content: string;
  private start: number;
  private stop: number;

  constructor(content: string = " ", start: number = 0, stop: number = 0) {
    this.content = content;
    this.start = start;
    this.stop = stop;
  }

  decode(tokens: string[]): string {
    return tokens
      .map((t) => {
        let result = t;
        if (this.start > 0) {
          while (result.startsWith(this.content) && this.start > 0) {
            result = result.slice(this.content.length);
          }
        }
        if (this.stop > 0) {
          while (result.endsWith(this.content) && this.stop > 0) {
            result = result.slice(0, -this.content.length);
          }
        }
        return result;
      })
      .join("");
  }
}

/** Identity decoder: just joins tokens. */
export class IdentityDecoder implements TokenDecoder {
  decode(tokens: string[]): string {
    return tokens.join("");
  }
}

/**
 * Build a TokenDecoder from a tokenizer.json decoder config.
 */
export function buildDecoder(
  config: DecoderConfig | null | undefined
): TokenDecoder {
  if (!config) return new IdentityDecoder();

  switch (config.type) {
    case "ByteLevel":
      return new ByteLevelDecoder();
    case "Metaspace":
      return new MetaspaceDecoder(
        config.replacement as string ?? "▁",
        config.add_prefix_space as boolean ?? true
      );
    case "WordPiece":
      return new WordPieceDecoder(config.prefix as string ?? "##");
    case "Sequence":
      return new SequenceDecoder(
        (config.decoders ?? []).map(buildDecoder)
      );
    case "Replace":
      return new ReplaceDecoder(
        config.pattern as string ?? "",
        config.content as string ?? ""
      );
    case "Fuse":
      return new FuseDecoder();
    case "Strip":
      return new StripDecoder(
        config.content as string ?? " ",
        config.start as number ?? 0,
        config.stop as number ?? 0
      );
    default:
      return new IdentityDecoder();
  }
}

/** Escape a string for use in a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
