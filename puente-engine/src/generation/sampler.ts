/**
 * Token sampling strategies for text generation.
 *
 * Implements greedy decoding, temperature-scaled sampling,
 * top-p (nucleus) sampling, and top-k sampling.
 */

import { argmax, softmax, topPFilter, topKFilter } from "../core/tensor.js";

/** Sampling configuration. */
export interface SamplingConfig {
  /** Temperature for sampling. 0 = greedy decoding. */
  temperature: number;
  /** Top-p nucleus sampling threshold (0-1). 1.0 = no filtering. */
  top_p: number;
  /** Top-k sampling (0 = disabled). */
  top_k: number;
}

const DEFAULT_SAMPLING: SamplingConfig = {
  temperature: 0,
  top_p: 1.0,
  top_k: 0,
};

/**
 * Sample a token ID from logits using the specified strategy.
 *
 * Strategy selection:
 * - temperature === 0 → greedy (argmax)
 * - temperature > 0 → sample from temperature-scaled distribution
 *   - top_k > 0 → apply top-k filter first
 *   - top_p < 1.0 → apply top-p filter first
 */
export function sampleToken(
  logits: Float32Array,
  config: Partial<SamplingConfig> = {}
): number {
  const { temperature, top_p, top_k } = {
    ...DEFAULT_SAMPLING,
    ...config,
  };

  // Greedy decoding
  if (temperature === 0 || temperature < 1e-8) {
    return argmax(logits);
  }

  // Apply top-k filtering
  let filtered = logits;
  if (top_k > 0) {
    filtered = topKFilter(filtered, top_k);
  }

  // Apply top-p filtering
  if (top_p < 1.0) {
    filtered = topPFilter(filtered, top_p);
  }

  // Temperature-scaled softmax
  const probs = softmax(filtered, temperature);

  // Sample from the distribution
  return multinomialSample(probs);
}

/**
 * Greedy decode: return the index of the highest logit.
 */
export function greedyDecode(logits: Float32Array): number {
  return argmax(logits);
}

/**
 * Sample an index from a probability distribution (multinomial sampling).
 * Uses a single random draw against the cumulative distribution.
 */
function multinomialSample(probs: Float32Array): number {
  const r = Math.random();
  let cumSum = 0;

  for (let i = 0; i < probs.length; i++) {
    cumSum += probs[i];
    if (r < cumSum) return i;
  }

  // Fallback: return last index (can happen due to floating point)
  return probs.length - 1;
}
