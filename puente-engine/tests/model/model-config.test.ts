import { describe, it, expect } from "vitest";
import { loadModelConfig, getHeadDim, getFirstEosTokenId } from "../../src/model/model-config.js";
import type { ModelConfig } from "../../src/core/types.js";

describe("loadModelConfig", () => {
  it("parses a decoder-only model config", async () => {
    const raw = {
      model_type: "gpt2",
      vocab_size: 32000,
      hidden_size: 768,
      num_hidden_layers: 12,
      num_attention_heads: 12,
      intermediate_size: 2048,
      max_position_embeddings: 1024,
      eos_token_id: 2,
      bos_token_id: 1,
      pad_token_id: 0,
    };

    const config = await loadModelConfig(raw);

    expect(config.model_type).toBe("gpt2");
    expect(config.vocab_size).toBe(32000);
    expect(config.hidden_size).toBe(768);
    expect(config.num_hidden_layers).toBe(12);
    expect(config.num_attention_heads).toBe(12);
    expect(config.num_key_value_heads).toBe(12); // defaults to num_attention_heads
    expect(config.intermediate_size).toBe(2048);
    expect(config.max_position_embeddings).toBe(1024);
    expect(config.is_encoder_decoder).toBe(false);
    expect(config.eos_token_id).toBe(2);
    expect(config.bos_token_id).toBe(1);
    expect(config.pad_token_id).toBe(0);
  });

  it("parses a Marian/encoder-decoder config", async () => {
    const raw = {
      model_type: "marian",
      vocab_size: 58101,
      d_model: 512,
      decoder_layers: 6,
      decoder_attention_heads: 8,
      decoder_ffn_dim: 2048,
      max_position_embeddings: 512,
      is_encoder_decoder: true,
      decoder_start_token_id: 58100,
      eos_token_id: 0,
      pad_token_id: 58100,
    };

    const config = await loadModelConfig(raw);

    expect(config.model_type).toBe("marian");
    expect(config.hidden_size).toBe(512);
    expect(config.num_hidden_layers).toBe(6);
    expect(config.num_attention_heads).toBe(8);
    expect(config.is_encoder_decoder).toBe(true);
    expect(config.decoder_start_token_id).toBe(58100);
  });

  it("handles GQA model with num_key_value_heads", async () => {
    const raw = {
      model_type: "llama",
      vocab_size: 32000,
      hidden_size: 768,
      num_hidden_layers: 12,
      num_attention_heads: 12,
      num_key_value_heads: 4,
      intermediate_size: 2048,
      max_position_embeddings: 1024,
    };

    const config = await loadModelConfig(raw);
    expect(config.num_key_value_heads).toBe(4);
  });

  it("handles eos_token_id as array", async () => {
    const raw = {
      model_type: "gpt2",
      vocab_size: 32000,
      hidden_size: 768,
      num_hidden_layers: 12,
      num_attention_heads: 12,
      eos_token_id: [2, 32000],
    };

    const config = await loadModelConfig(raw);
    expect(config.eos_token_id).toEqual([2, 32000]);
  });

  it("stores raw config for model-specific fields", async () => {
    const raw = {
      model_type: "custom",
      vocab_size: 1000,
      hidden_size: 256,
      num_hidden_layers: 4,
      num_attention_heads: 4,
      custom_field: "custom_value",
    };

    const config = await loadModelConfig(raw);
    expect(config._raw.custom_field).toBe("custom_value");
  });
});

describe("getHeadDim", () => {
  it("computes head dimension correctly", () => {
    const config = {
      hidden_size: 768,
      num_attention_heads: 12,
    } as ModelConfig;
    expect(getHeadDim(config)).toBe(64);
  });

  it("returns 0 for 0 heads", () => {
    const config = {
      hidden_size: 768,
      num_attention_heads: 0,
    } as ModelConfig;
    expect(getHeadDim(config)).toBe(0);
  });
});

describe("getFirstEosTokenId", () => {
  it("returns number directly", () => {
    expect(getFirstEosTokenId({ eos_token_id: 2 } as ModelConfig)).toBe(2);
  });

  it("returns first element of array", () => {
    expect(getFirstEosTokenId({ eos_token_id: [2, 3] } as ModelConfig)).toBe(2);
  });

  it("returns undefined for missing eos", () => {
    expect(getFirstEosTokenId({} as ModelConfig)).toBeUndefined();
  });
});
