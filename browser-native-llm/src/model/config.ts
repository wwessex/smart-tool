/**
 * Model architecture configuration for the SMART action planner.
 *
 * Defines the ~150M parameter decoder-only transformer with modern
 * efficiency defaults: RoPE, RMSNorm, SwiGLU activations.
 * These are training-time architectural choices; the browser runtime
 * loads pre-trained + quantised weights in ONNX or GGUF format.
 */

/** Transformer architecture hyperparameters. */
export interface ModelArchitectureConfig {
  /** Human-readable model name. */
  name: string;
  /** Approximate parameter count. */
  params_approx: string;
  /** Hidden dimension size (d_model). */
  d_model: number;
  /** Number of transformer layers. */
  n_layers: number;
  /** Number of attention heads. */
  n_heads: number;
  /** Key/value heads (for grouped-query attention; equals n_heads for standard MHA). */
  n_kv_heads: number;
  /** Feed-forward intermediate dimension. */
  d_ff: number;
  /** Vocabulary size (BPE/SentencePiece). */
  vocab_size: number;
  /** Maximum context length during training. */
  max_seq_length: number;
  /** Positional embedding type. */
  position_embedding: "rope";
  /** Normalisation type. */
  norm_type: "rmsnorm";
  /** FFN activation type. */
  activation: "swiglu";
  /** RMSNorm epsilon. */
  norm_eps: number;
  /** RoPE theta base frequency. */
  rope_theta: number;
}

/**
 * Predefined model size variants.
 * Start with "balanced" (~150M) as recommended by the research.
 */
export const MODEL_CONFIGS: Record<string, ModelArchitectureConfig> = {
  /** Ultra-tiny: ~35M params. Smallest viable option for CPU-first WASM. */
  "smart-planner-35m": {
    name: "SMART Planner 35M",
    params_approx: "35M",
    d_model: 512,
    n_layers: 8,
    n_heads: 8,
    n_kv_heads: 4,
    d_ff: 1408,
    vocab_size: 16384,
    max_seq_length: 1024,
    position_embedding: "rope",
    norm_type: "rmsnorm",
    activation: "swiglu",
    norm_eps: 1e-5,
    rope_theta: 10000,
  },

  /** Balanced: ~150M params. Recommended starting point. */
  "smart-planner-150m": {
    name: "SMART Planner 150M",
    params_approx: "150M",
    d_model: 768,
    n_layers: 12,
    n_heads: 12,
    n_kv_heads: 4,
    d_ff: 2048,
    vocab_size: 32000,
    max_seq_length: 1024,
    position_embedding: "rope",
    norm_type: "rmsnorm",
    activation: "swiglu",
    norm_eps: 1e-5,
    rope_theta: 10000,
  },

  /** Higher-quality: ~350M params. Desktop-focused, requires WebGPU. */
  "smart-planner-350m": {
    name: "SMART Planner 350M",
    params_approx: "350M",
    d_model: 1024,
    n_layers: 24,
    n_heads: 16,
    n_kv_heads: 4,
    d_ff: 2816,
    vocab_size: 32000,
    max_seq_length: 1024,
    position_embedding: "rope",
    norm_type: "rmsnorm",
    activation: "swiglu",
    norm_eps: 1e-5,
    rope_theta: 10000,
  },
};

/**
 * Estimate KV-cache memory for a given model config and sequence length.
 * Formula: layers * seq_len * 2 (K,V) * d_model * bytes_per_element
 */
export function estimateKVCacheBytes(
  config: ModelArchitectureConfig,
  seqLength: number,
  bytesPerElement: number = 2 // fp16
): number {
  return config.n_layers * seqLength * 2 * config.d_model * bytesPerElement;
}

/**
 * Estimate total weight size at a given quantisation level.
 * Rough formula: params * bits_per_weight / 8
 */
export function estimateWeightBytes(
  paramsMillions: number,
  bitsPerWeight: number = 4
): number {
  return (paramsMillions * 1e6 * bitsPerWeight) / 8;
}

/** Default inference configuration for the balanced 150M model. */
export const DEFAULT_INFERENCE_CONFIG = {
  model_id: "smart-planner-150m",
  model_base_url: "./models/smart-planner-150m-q4/",
  max_seq_length: 1024,
  max_new_tokens: 512,
  temperature: 0,
  top_p: 1.0,
  repetition_penalty: 1.1,
} as const;
