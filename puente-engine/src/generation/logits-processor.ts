/**
 * Logits processors for modifying model output logits before sampling.
 *
 * Implements a pipeline pattern where multiple processors can be
 * chained together. Each processor modifies the logits in-place or
 * returns a new array.
 */

/** Interface for logits processors. */
export interface LogitsProcessor {
  /** Process logits, given the generated token IDs so far. */
  process(logits: Float32Array, inputIds: number[]): Float32Array;
}

/**
 * Repetition penalty: reduce the logit of tokens that have already appeared.
 * Penalty > 1.0 discourages repetition, < 1.0 encourages it.
 *
 * Algorithm (from Ctrl paper):
 * - If logit > 0: logit = logit / penalty
 * - If logit < 0: logit = logit * penalty
 * This always reduces the absolute value for positive penalties.
 */
export class RepetitionPenaltyProcessor implements LogitsProcessor {
  private penalty: number;

  constructor(penalty: number = 1.0) {
    this.penalty = penalty;
  }

  process(logits: Float32Array, inputIds: number[]): Float32Array {
    if (this.penalty === 1.0) return logits;

    const result = new Float32Array(logits);
    const seen = new Set(inputIds);

    for (const tokenId of seen) {
      if (tokenId < 0 || tokenId >= result.length) continue;

      if (result[tokenId] > 0) {
        result[tokenId] /= this.penalty;
      } else {
        result[tokenId] *= this.penalty;
      }
    }

    return result;
  }
}

/**
 * Forced token processor: force specific tokens at specific positions.
 * Used by encoder-decoder models to force BOS/language tokens.
 */
export class ForcedTokenProcessor implements LogitsProcessor {
  /** Map of generation step → forced token ID. */
  private forcedTokens: Map<number, number>;

  constructor(forcedTokens: Array<[number, number]>) {
    this.forcedTokens = new Map(forcedTokens);
  }

  process(logits: Float32Array, inputIds: number[]): Float32Array {
    const step = inputIds.length;
    const forcedToken = this.forcedTokens.get(step);

    if (forcedToken === undefined) return logits;

    // Set all logits to -Infinity except the forced token
    const result = new Float32Array(logits.length).fill(-Infinity);
    if (forcedToken >= 0 && forcedToken < result.length) {
      result[forcedToken] = 0;
    }
    return result;
  }
}

/**
 * No-repeat n-gram processor: prevent n-grams from repeating.
 * If the last (n-1) tokens match a previously seen (n-1)-gram,
 * the token that would complete the repeated n-gram is penalised.
 */
export class NoRepeatNgramProcessor implements LogitsProcessor {
  private ngramSize: number;

  constructor(ngramSize: number) {
    this.ngramSize = ngramSize;
  }

  process(logits: Float32Array, inputIds: number[]): Float32Array {
    if (this.ngramSize <= 0 || inputIds.length < this.ngramSize - 1) {
      return logits;
    }

    const result = new Float32Array(logits);

    // Build set of all (n-1)-grams seen and what token followed
    const bannedTokens = new Set<number>();
    const contextSize = this.ngramSize - 1;

    // Current context (last n-1 tokens)
    const currentContext = inputIds.slice(-contextSize);

    // Scan through history for matching contexts
    for (let i = 0; i <= inputIds.length - this.ngramSize; i++) {
      const contextMatch = inputIds.slice(i, i + contextSize);
      if (arraysEqual(contextMatch, currentContext)) {
        // The token after this context would create a repeated n-gram
        const nextToken = inputIds[i + contextSize];
        if (nextToken !== undefined) {
          bannedTokens.add(nextToken);
        }
      }
    }

    // Ban the tokens
    for (const token of bannedTokens) {
      if (token >= 0 && token < result.length) {
        result[token] = -Infinity;
      }
    }

    return result;
  }
}

/**
 * Chain of logits processors, applied in order.
 */
export class LogitsProcessorList implements LogitsProcessor {
  private processors: LogitsProcessor[] = [];

  add(processor: LogitsProcessor): void {
    this.processors.push(processor);
  }

  process(logits: Float32Array, inputIds: number[]): Float32Array {
    let result = logits;
    for (const processor of this.processors) {
      result = processor.process(result, inputIds);
    }
    return result;
  }

  get length(): number {
    return this.processors.length;
  }
}

/** Check if two arrays are element-wise equal. */
function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
