/**
 * Model configuration loader.
 *
 * Parses config.json and generation_config.json from model
 * repositories into normalised ModelConfig and GenerationConfig types.
 * Handles differences between decoder-only (GPT-2, LLaMA) and
 * encoder-decoder (Marian/OPUS-MT) architectures.
 */

import type { ModelConfig, GenerationConfig } from "../core/types.js";

/**
 * Load and parse a model's config.json.
 * Accepts a URL string or a pre-parsed object.
 */
export async function loadModelConfig(
  source: string | Record<string, unknown>
): Promise<ModelConfig> {
  let raw: Record<string, unknown>;

  if (typeof source === "string") {
    const response = await fetch(source);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          `Failed to load model config from ${source}: 404 — model files not found. Ensure models have been downloaded.`
        );
      }
      throw new Error(
        `Failed to load model config from ${source}: ${response.status}`
      );
    }
    raw = (await response.json()) as Record<string, unknown>;
  } else {
    raw = source;
  }

  return normalizeModelConfig(raw);
}

/**
 * Load and parse a generation_config.json.
 * Returns undefined if the file doesn't exist (404).
 */
export async function loadGenerationConfig(
  source: string | Record<string, unknown>
): Promise<GenerationConfig | undefined> {
  let raw: Record<string, unknown>;

  if (typeof source === "string") {
    const response = await fetch(source);
    if (!response.ok) {
      if (response.status === 404) return undefined;
      throw new Error(
        `Failed to load generation config from ${source}: ${response.status}`
      );
    }
    raw = (await response.json()) as Record<string, unknown>;
  } else {
    raw = source;
  }

  return normalizeGenerationConfig(raw);
}

/**
 * Normalise a raw config.json into a ModelConfig.
 * Handles naming variations across model architectures.
 */
function normalizeModelConfig(raw: Record<string, unknown>): ModelConfig {
  const modelType = (raw.model_type as string) ?? "unknown";
  const isEncoderDecoder =
    (raw.is_encoder_decoder as boolean) ??
    isEncoderDecoderArchitecture(modelType);

  return {
    model_type: modelType,
    vocab_size: (raw.vocab_size as number) ?? 0,
    hidden_size:
      (raw.hidden_size as number) ??
      (raw.d_model as number) ??
      0,
    num_hidden_layers:
      (raw.num_hidden_layers as number) ??
      (raw.n_layers as number) ??
      (raw.num_layers as number) ??
      (raw.decoder_layers as number) ??
      0,
    num_attention_heads:
      (raw.num_attention_heads as number) ??
      (raw.n_heads as number) ??
      (raw.num_heads as number) ??
      (raw.decoder_attention_heads as number) ??
      0,
    num_key_value_heads:
      (raw.num_key_value_heads as number) ??
      (raw.n_kv_heads as number) ??
      (raw.num_attention_heads as number) ??
      0,
    intermediate_size:
      (raw.intermediate_size as number) ??
      (raw.d_ff as number) ??
      (raw.decoder_ffn_dim as number) ??
      0,
    max_position_embeddings:
      (raw.max_position_embeddings as number) ??
      (raw.max_seq_length as number) ??
      (raw.n_positions as number) ??
      512,
    is_encoder_decoder: isEncoderDecoder,
    decoder_start_token_id: toSafeInt(raw.decoder_start_token_id),
    eos_token_id: normalizeTokenId(raw.eos_token_id),
    bos_token_id: toSafeInt(raw.bos_token_id),
    pad_token_id: toSafeInt(raw.pad_token_id),
    forced_bos_token_id: toSafeInt(raw.forced_bos_token_id),
    rope_theta:
      (raw.rope_theta as number) ??
      (raw.rope_scaling ? 10000 : undefined),
    rms_norm_eps:
      (raw.rms_norm_eps as number) ??
      (raw.layer_norm_eps as number) ??
      undefined,
    _raw: raw,
  };
}

/**
 * Normalise a raw generation_config.json into a GenerationConfig.
 */
function normalizeGenerationConfig(
  raw: Record<string, unknown>
): GenerationConfig {
  return {
    max_new_tokens: raw.max_new_tokens as number | undefined,
    max_length: raw.max_length as number | undefined,
    temperature: raw.temperature as number | undefined,
    top_p: raw.top_p as number | undefined,
    top_k: raw.top_k as number | undefined,
    repetition_penalty: raw.repetition_penalty as number | undefined,
    do_sample: raw.do_sample as boolean | undefined,
    num_beams: raw.num_beams as number | undefined,
    eos_token_id: normalizeTokenId(raw.eos_token_id),
    bos_token_id: raw.bos_token_id as number | undefined,
    pad_token_id: raw.pad_token_id as number | undefined,
    decoder_start_token_id:
      raw.decoder_start_token_id as number | undefined,
    forced_bos_token_id: raw.forced_bos_token_id as number | undefined,
    no_repeat_ngram_size: raw.no_repeat_ngram_size as number | undefined,
  };
}

/**
 * Coerce a raw config value to a safe integer, or return undefined.
 * Handles string-typed IDs that some model config files produce.
 */
function toSafeInt(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/**
 * Normalise eos_token_id which can be a number or array of numbers.
 */
function normalizeTokenId(
  value: unknown
): number | number[] | undefined {
  if (typeof value === "number") return value;
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (typeof value === "string") return toSafeInt(value);
  return undefined;
}

/**
 * Check if a model type is an encoder-decoder architecture.
 */
function isEncoderDecoderArchitecture(modelType: string): boolean {
  const encoderDecoderTypes = [
    "marian",
    "t5",
    "mt5",
    "bart",
    "mbart",
    "pegasus",
    "opus-mt",
    "nllb",
    "m2m_100",
    "seamless_m4t",
  ];
  return encoderDecoderTypes.includes(modelType.toLowerCase());
}

/**
 * Get the head dimension for a model config.
 * head_dim = hidden_size / num_attention_heads
 */
export function getHeadDim(config: ModelConfig): number {
  if (config.num_attention_heads === 0) return 0;
  return Math.floor(config.hidden_size / config.num_attention_heads);
}

/**
 * Get the first EOS token ID (handles both single and array formats).
 */
export function getFirstEosTokenId(
  config: ModelConfig | GenerationConfig
): number | undefined {
  const eos = config.eos_token_id;
  if (typeof eos === "number") return eos;
  if (Array.isArray(eos) && eos.length > 0) return eos[0];
  return undefined;
}
