/**
 * Text normalisation for tokenization.
 *
 * Applies Unicode normalisation and other text transformations
 * before pre-tokenization. Supports the normaliser configs found
 * in HuggingFace tokenizer.json files.
 */

import type { NormalizerConfig } from "../core/types.js";

/** Interface for text normalisers. */
export interface Normalizer {
  normalize(text: string): string;
}

/** Unicode NFC normalisation. */
export class NFCNormalizer implements Normalizer {
  normalize(text: string): string {
    return text.normalize("NFC");
  }
}

/** Unicode NFKC normalisation. */
export class NFKCNormalizer implements Normalizer {
  normalize(text: string): string {
    return text.normalize("NFKC");
  }
}

/** Lowercase normalisation. */
export class LowercaseNormalizer implements Normalizer {
  normalize(text: string): string {
    return text.toLowerCase();
  }
}

/** Strip accents/diacritics. */
export class StripAccentsNormalizer implements Normalizer {
  normalize(text: string): string {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
}

/** Replace patterns (used by some tokenizers for whitespace normalisation). */
export class ReplaceNormalizer implements Normalizer {
  private pattern: RegExp;
  private replacement: string;

  constructor(pattern: string, replacement: string) {
    this.pattern = new RegExp(pattern, "g");
    this.replacement = replacement;
  }

  normalize(text: string): string {
    return text.replace(this.pattern, this.replacement);
  }
}

/** Prepend a string (e.g. "▁" for SentencePiece). */
export class PrependNormalizer implements Normalizer {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  normalize(text: string): string {
    return this.prefix + text;
  }
}

/** Identity normaliser (no-op). */
export class IdentityNormalizer implements Normalizer {
  normalize(text: string): string {
    return text;
  }
}

/** Chain multiple normalisers in sequence. */
export class SequenceNormalizer implements Normalizer {
  private normalizers: Normalizer[];

  constructor(normalizers: Normalizer[]) {
    this.normalizers = normalizers;
  }

  normalize(text: string): string {
    let result = text;
    for (const norm of this.normalizers) {
      result = norm.normalize(result);
    }
    return result;
  }
}

/**
 * Build a Normalizer from a tokenizer.json normalizer config.
 */
export function buildNormalizer(config: NormalizerConfig | null | undefined): Normalizer {
  if (!config) return new IdentityNormalizer();

  switch (config.type) {
    case "NFC":
      return new NFCNormalizer();
    case "NFKC":
      return new NFKCNormalizer();
    case "Lowercase":
      return new LowercaseNormalizer();
    case "StripAccents":
      return new StripAccentsNormalizer();
    case "Replace":
      return new ReplaceNormalizer(
        config.pattern as string ?? "",
        config.content as string ?? ""
      );
    case "Prepend":
      return new PrependNormalizer(config.prepend as string ?? "");
    case "Sequence":
      return new SequenceNormalizer(
        (config.normalizers ?? []).map(buildNormalizer)
      );
    case "BertNormalizer":
      // BertNormalizer does: clean text, handle chinese chars, strip accents, lowercase
      return new SequenceNormalizer([
        new NFCNormalizer(),
        ...(config.lowercase ? [new LowercaseNormalizer()] : []),
        ...(config.strip_accents ? [new StripAccentsNormalizer()] : []),
      ]);
    case "Precompiled":
      // Precompiled normalizers (SentencePiece) - approximate with NFKC
      return new NFKCNormalizer();
    default:
      return new IdentityNormalizer();
  }
}
