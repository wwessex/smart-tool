/**
 * Core type definitions for Puente Engine.
 *
 * Puente ("bridge" in Spanish) bridges ONNX models to the browser,
 * providing neural network inference for both decoder-only LLMs
 * and encoder-decoder translation models.
 */

// ---------------------------------------------------------------------------
// Inference backend
// ---------------------------------------------------------------------------

/** Inference backend for ONNX Runtime Web. */
export type InferenceBackend = "webgpu" | "wasm-simd" | "wasm-basic";

/** Browser capabilities relevant to inference. */
export interface BrowserCapabilities {
  webgpu: boolean;
  wasmSimd: boolean;
  wasmThreads: boolean;
  crossOriginIsolated: boolean;
  estimatedMemoryMB?: number;
}

// ---------------------------------------------------------------------------
// Generation (decoder-only LLM)
// ---------------------------------------------------------------------------

/** Options for autoregressive text generation. */
export interface GenerateOptions {
  /** The prompt string to generate from. */
  prompt: string;
  /** Maximum new tokens to generate. */
  max_new_tokens?: number;
  /** Sampling temperature (0 = greedy). */
  temperature?: number;
  /** Top-p nucleus sampling threshold. */
  top_p?: number;
  /** Top-k sampling (0 = disabled). */
  top_k?: number;
  /** Repetition penalty (1.0 = no penalty). */
  repetition_penalty?: number;
  /** Stop sequences to halt generation. */
  stop_sequences?: string[];
  /** Callback for each generated token (for streaming). */
  on_token?: (token: string, done: boolean) => void;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

/** Result of text generation. */
export interface GenerateResult {
  /** Generated text (excluding prompt). */
  text: string;
  /** Number of tokens generated. */
  tokens_generated: number;
  /** Time taken in milliseconds. */
  time_ms: number;
  /** Backend used for inference. */
  backend: InferenceBackend;
}

// ---------------------------------------------------------------------------
// Translation (encoder-decoder)
// ---------------------------------------------------------------------------

/** Options for sequence-to-sequence translation. */
export interface TranslationOptions {
  /** Source text to translate. */
  text: string;
  /** Source language code (e.g. "en"). */
  src_lang?: string;
  /** Target language code (e.g. "de"). */
  tgt_lang?: string;
  /** Maximum new tokens for the decoder. */
  max_new_tokens?: number;
}

/** Result of a translation operation. */
export interface TranslationResult {
  /** Translated text. */
  translation_text: string;
}

// ---------------------------------------------------------------------------
// Model configuration
// ---------------------------------------------------------------------------

/** Parsed model configuration (from config.json). */
export interface ModelConfig {
  /** Model architecture type (e.g. "gpt2", "llama", "marian"). */
  model_type: string;
  /** Vocabulary size. */
  vocab_size: number;
  /** Hidden dimension (d_model). */
  hidden_size: number;
  /** Number of transformer layers. */
  num_hidden_layers: number;
  /** Number of attention heads. */
  num_attention_heads: number;
  /** Number of KV heads (for GQA; equals num_attention_heads for MHA). */
  num_key_value_heads: number;
  /** Feed-forward intermediate dimension. */
  intermediate_size: number;
  /** Maximum sequence length. */
  max_position_embeddings: number;
  /** Whether this is an encoder-decoder model. */
  is_encoder_decoder: boolean;
  /** Decoder start token ID (encoder-decoder models). */
  decoder_start_token_id?: number;
  /** EOS token ID. */
  eos_token_id?: number | number[];
  /** BOS token ID. */
  bos_token_id?: number;
  /** PAD token ID. */
  pad_token_id?: number;
  /** Forced BOS token ID for decoder (Marian models). */
  forced_bos_token_id?: number;
  /** RoPE theta base frequency. */
  rope_theta?: number;
  /** RMSNorm epsilon. */
  rms_norm_eps?: number;
  /** Raw config object for model-specific fields. */
  _raw: Record<string, unknown>;
}

/** Parsed generation configuration (from generation_config.json). */
export interface GenerationConfig {
  max_new_tokens?: number;
  max_length?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  repetition_penalty?: number;
  do_sample?: boolean;
  num_beams?: number;
  eos_token_id?: number | number[];
  bos_token_id?: number;
  pad_token_id?: number;
  decoder_start_token_id?: number;
  forced_bos_token_id?: number;
  no_repeat_ngram_size?: number;
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

/** Structure of a HuggingFace tokenizer.json file. */
export interface TokenizerJSON {
  version?: string;
  truncation?: unknown;
  padding?: unknown;
  added_tokens?: AddedToken[];
  normalizer?: NormalizerConfig | null;
  pre_tokenizer?: PreTokenizerConfig | null;
  model?: TokenizerModelConfig;
  decoder?: DecoderConfig | null;
  post_processor?: unknown;
}

export interface AddedToken {
  id: number;
  content: string;
  single_word: boolean;
  lstrip: boolean;
  rstrip: boolean;
  normalized: boolean;
  special: boolean;
}

export interface NormalizerConfig {
  type: string;
  normalizers?: NormalizerConfig[];
  [key: string]: unknown;
}

export interface PreTokenizerConfig {
  type: string;
  pretokenizers?: PreTokenizerConfig[];
  add_prefix_space?: boolean;
  trim_offsets?: boolean;
  use_regex?: boolean;
  [key: string]: unknown;
}

export interface TokenizerModelConfig {
  type: string;
  dropout?: number | null;
  unk_token?: string;
  continuing_subword_prefix?: string;
  end_of_word_suffix?: string;
  fuse_unk?: boolean;
  byte_fallback?: boolean;
  vocab: Record<string, number>;
  merges: string[];
}

export interface DecoderConfig {
  type: string;
  decoders?: DecoderConfig[];
  add_prefix_space?: boolean;
  trim_offsets?: boolean;
  use_regex?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Download progress
// ---------------------------------------------------------------------------

/** Progress callback for model downloads. */
export interface DownloadProgress {
  /** File being downloaded. */
  file: string;
  /** Bytes loaded so far. */
  loaded_bytes: number;
  /** Total bytes expected (0 if unknown). */
  total_bytes: number;
  /** Current phase. */
  phase: "downloading" | "caching" | "initializing" | "complete" | "error";
  /** Error message if phase is "error". */
  error?: string;
}

/** Options for creating an ONNX session. */
export interface SessionOptions {
  /** Execution provider to use. */
  executionProvider: string;
  /** Whether to use the graph optimization level. */
  graphOptimizationLevel?: "disabled" | "basic" | "extended" | "all";
}
