/**
 * Lightweight tensor helpers wrapping ONNX Runtime Web tensors.
 *
 * Provides convenience functions for creating typed tensors,
 * attention masks, and performing logit operations (argmax, softmax,
 * top-p filtering) needed during autoregressive generation.
 */

import * as ort from "onnxruntime-web";

/**
 * Create a 1-D Int64 tensor from an array of token IDs.
 * ONNX Runtime Web uses BigInt64Array for int64 tensors.
 */
export function createInt64Tensor(
  data: number[],
  dims: number[]
): ort.Tensor {
  const bigIntData = BigInt64Array.from(data.map((v) => BigInt(v)));
  return new ort.Tensor("int64", bigIntData, dims);
}

/**
 * Create an attention mask tensor (all ones) for a given sequence length.
 * Shape: [1, seqLen]
 */
export function createAttentionMask(seqLen: number): ort.Tensor {
  const data = BigInt64Array.from({ length: seqLen }, () => 1n);
  return new ort.Tensor("int64", data, [1, seqLen]);
}

/**
 * Create position IDs tensor for a sequence.
 * For the prefill pass: [0, 1, 2, ..., seqLen-1]
 * For decode steps with offset: [offset]
 * Shape: [1, length]
 */
export function createPositionIds(
  startPos: number,
  length: number
): ort.Tensor {
  const data = BigInt64Array.from(
    { length },
    (_, i) => BigInt(startPos + i)
  );
  return new ort.Tensor("int64", data, [1, length]);
}

/**
 * Find the index of the maximum value in a Float32Array.
 * Used for greedy decoding.
 */
export function argmax(logits: Float32Array): number {
  let maxIdx = 0;
  let maxVal = logits[0];
  for (let i = 1; i < logits.length; i++) {
    if (logits[i] > maxVal) {
      maxVal = logits[i];
      maxIdx = i;
    }
  }
  return maxIdx;
}

/**
 * Apply softmax to logits with optional temperature scaling.
 * Returns probabilities as a new Float32Array.
 */
export function softmax(
  logits: Float32Array,
  temperature: number = 1.0
): Float32Array {
  const scaled = new Float32Array(logits.length);

  // Apply temperature scaling
  const temp = Math.max(temperature, 1e-8);
  for (let i = 0; i < logits.length; i++) {
    scaled[i] = logits[i] / temp;
  }

  // Find max for numerical stability
  let maxVal = scaled[0];
  for (let i = 1; i < scaled.length; i++) {
    if (scaled[i] > maxVal) maxVal = scaled[i];
  }

  // Exponentiate and sum
  let sum = 0;
  for (let i = 0; i < scaled.length; i++) {
    scaled[i] = Math.exp(scaled[i] - maxVal);
    sum += scaled[i];
  }

  // Normalize
  for (let i = 0; i < scaled.length; i++) {
    scaled[i] /= sum;
  }

  return scaled;
}

/**
 * Apply top-p (nucleus) filtering to logits.
 * Sets logits outside the top-p probability mass to -Infinity.
 * Returns a new Float32Array with filtered logits.
 */
export function topPFilter(
  logits: Float32Array,
  p: number
): Float32Array {
  if (p >= 1.0) return new Float32Array(logits);

  // Create index-value pairs and sort by value descending
  const indices = Array.from({ length: logits.length }, (_, i) => i);
  indices.sort((a, b) => logits[b] - logits[a]);

  // Compute softmax probabilities for sorted order
  const probs = softmax(logits, 1.0);

  // Accumulate probability mass
  let cumSum = 0;
  const keep = new Set<number>();

  for (const idx of indices) {
    cumSum += probs[idx];
    keep.add(idx);
    if (cumSum >= p) break;
  }

  // Filter: set non-kept logits to -Infinity
  const filtered = new Float32Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    filtered[i] = keep.has(i) ? logits[i] : -Infinity;
  }

  return filtered;
}

/**
 * Apply top-k filtering to logits.
 * Keeps only the top k highest logits, sets others to -Infinity.
 */
export function topKFilter(
  logits: Float32Array,
  k: number
): Float32Array {
  if (k <= 0 || k >= logits.length) return new Float32Array(logits);

  // Find the k-th largest value
  const sorted = Array.from(logits).sort((a, b) => b - a);
  const threshold = sorted[k - 1];

  const filtered = new Float32Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    filtered[i] = logits[i] >= threshold ? logits[i] : -Infinity;
  }

  return filtered;
}

/**
 * Extract the logits for the last token position from a 3-D logits tensor.
 * Input shape: [batch_size, seq_length, vocab_size]
 * Returns: Float32Array of shape [vocab_size]
 */
export function extractLastTokenLogits(
  logitsTensor: ort.Tensor
): Float32Array {
  const data = logitsTensor.data as Float32Array;
  const [, seqLen, vocabSize] = logitsTensor.dims;
  const offset = (seqLen - 1) * vocabSize;
  return data.slice(offset, offset + vocabSize);
}

/**
 * Create an empty Float32 tensor with the given dimensions.
 * Used for initializing empty KV cache on first pass.
 */
export function createEmptyFloat32(dims: number[]): ort.Tensor {
  const size = dims.reduce((a, b) => a * b, 1);
  return new ort.Tensor("float32", new Float32Array(size), dims);
}

/**
 * Create an empty Float16 tensor with the given dimensions.
 * Some quantized models use float16 for KV cache.
 */
export function createEmptyFloat16(dims: number[]): ort.Tensor {
  const size = dims.reduce((a, b) => a * b, 1);
  return new ort.Tensor("float16", new Uint16Array(size), dims);
}
