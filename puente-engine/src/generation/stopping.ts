/**
 * Stopping criteria for autoregressive generation.
 *
 * Determines when the generation loop should halt based on:
 * - Maximum token count reached
 * - EOS token generated
 * - Stop sequence detected in generated text
 */

/** Interface for stopping criteria. */
export interface StoppingCriterion {
  /** Returns true if generation should stop. */
  shouldStop(generatedIds: number[], generatedText: string): boolean;
}

/**
 * Stop after generating a maximum number of tokens.
 */
export class MaxTokensCriterion implements StoppingCriterion {
  private maxTokens: number;

  constructor(maxTokens: number) {
    this.maxTokens = maxTokens;
  }

  shouldStop(generatedIds: number[]): boolean {
    return generatedIds.length >= this.maxTokens;
  }
}

/**
 * Stop when an EOS token is generated.
 * Supports multiple EOS token IDs.
 */
export class EosTokenCriterion implements StoppingCriterion {
  private eosTokenIds: Set<number>;

  constructor(eosTokenIds: number | number[]) {
    if (typeof eosTokenIds === "number") {
      this.eosTokenIds = new Set([eosTokenIds]);
    } else {
      this.eosTokenIds = new Set(eosTokenIds);
    }
  }

  shouldStop(generatedIds: number[]): boolean {
    if (generatedIds.length === 0) return false;
    const lastToken = generatedIds[generatedIds.length - 1];
    return this.eosTokenIds.has(lastToken);
  }
}

/**
 * Stop when a stop sequence is detected in the generated text.
 */
export class StopSequenceCriterion implements StoppingCriterion {
  private stopSequences: string[];

  constructor(stopSequences: string[]) {
    this.stopSequences = stopSequences;
  }

  shouldStop(_generatedIds: number[], generatedText: string): boolean {
    for (const seq of this.stopSequences) {
      if (generatedText.includes(seq)) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Combined stopping criteria: stops if ANY criterion is met.
 */
export class StoppingCriteriaList implements StoppingCriterion {
  private criteria: StoppingCriterion[] = [];

  add(criterion: StoppingCriterion): void {
    this.criteria.push(criterion);
  }

  shouldStop(generatedIds: number[], generatedText: string): boolean {
    for (const criterion of this.criteria) {
      if (criterion.shouldStop(generatedIds, generatedText)) {
        return true;
      }
    }
    return false;
  }

  get length(): number {
    return this.criteria.length;
  }
}
