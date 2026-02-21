/**
 * KV cache management for autoregressive transformer generation.
 *
 * During generation, each transformer layer produces key and value tensors
 * that can be cached and reused in subsequent steps, avoiding redundant
 * computation of the already-processed prefix.
 *
 * ONNX decoder-only models use:
 * - Inputs:  past_key_values.{layer}.key, past_key_values.{layer}.value
 * - Outputs: present.{layer}.key, present.{layer}.value
 *
 * Shape: [batch_size, num_kv_heads, seq_length, head_dim]
 *
 * For encoder-decoder models, the decoder also has cross-attention KV cache
 * from the encoder output, which is computed once and reused:
 * - past_key_values.{layer}.encoder.key
 * - past_key_values.{layer}.encoder.value
 */

import * as ort from "onnxruntime-web";
import { createEmptyFloat32 } from "../core/tensor.js";

/** Configuration for KV cache dimensions. */
export interface KVCacheConfig {
  /** Number of transformer layers. */
  numLayers: number;
  /** Number of KV heads (may differ from attention heads in GQA). */
  numKVHeads: number;
  /** Dimension per head (hidden_size / num_attention_heads). */
  headDim: number;
  /** Whether to include cross-attention cache entries (encoder-decoder). */
  hasCrossAttention?: boolean;
  /** Data type for cache tensors. */
  dtype?: "float32" | "float16";
}

export class KVCache {
  private config: KVCacheConfig;
  /** Current cached key tensors per layer. */
  private keys: (ort.Tensor | null)[];
  /** Current cached value tensors per layer. */
  private values: (ort.Tensor | null)[];
  /** Encoder cross-attention key tensors (encoder-decoder only). */
  private encoderKeys: (ort.Tensor | null)[];
  /** Encoder cross-attention value tensors (encoder-decoder only). */
  private encoderValues: (ort.Tensor | null)[];
  /** Current sequence length of the cached entries. */
  private _seqLength = 0;

  constructor(config: KVCacheConfig) {
    this.config = config;
    this.keys = new Array(config.numLayers).fill(null);
    this.values = new Array(config.numLayers).fill(null);
    this.encoderKeys = new Array(config.numLayers).fill(null);
    this.encoderValues = new Array(config.numLayers).fill(null);
  }

  /**
   * Get current cache tensors as ONNX Runtime feed tensors.
   * For the first step (empty cache), returns tensors with seq_length=0.
   */
  getFeedTensors(): Record<string, ort.Tensor> {
    const feeds: Record<string, ort.Tensor> = {};

    for (let i = 0; i < this.config.numLayers; i++) {
      const keyName = `past_key_values.${i}.key`;
      const valName = `past_key_values.${i}.value`;

      if (this.keys[i]) {
        feeds[keyName] = this.keys[i]!;
        feeds[valName] = this.values[i]!;
      } else {
        // Empty cache: [1, num_kv_heads, 0, head_dim]
        feeds[keyName] = createEmptyFloat32([
          1,
          this.config.numKVHeads,
          0,
          this.config.headDim,
        ]);
        feeds[valName] = createEmptyFloat32([
          1,
          this.config.numKVHeads,
          0,
          this.config.headDim,
        ]);
      }

      // Cross-attention cache (encoder-decoder models)
      if (this.config.hasCrossAttention) {
        const encKeyName = `past_key_values.${i}.encoder.key`;
        const encValName = `past_key_values.${i}.encoder.value`;

        if (this.encoderKeys[i]) {
          feeds[encKeyName] = this.encoderKeys[i]!;
          feeds[encValName] = this.encoderValues[i]!;
        } else {
          feeds[encKeyName] = createEmptyFloat32([
            1,
            this.config.numKVHeads,
            0,
            this.config.headDim,
          ]);
          feeds[encValName] = createEmptyFloat32([
            1,
            this.config.numKVHeads,
            0,
            this.config.headDim,
          ]);
        }
      }
    }

    return feeds;
  }

  /**
   * Update cache with new key/value tensors from model output.
   * The model outputs "present.{i}.key" which contains the full
   * accumulated KV cache (past + new tokens).
   */
  updateFromOutputs(outputs: Record<string, ort.Tensor>): void {
    for (let i = 0; i < this.config.numLayers; i++) {
      // Self-attention KV cache
      const key = outputs[`present.${i}.key`];
      const value = outputs[`present.${i}.value`];

      if (key && value) {
        this.keys[i] = key;
        this.values[i] = value;
        // Update seq length from the tensor dims
        // Shape: [batch, heads, seq_len, head_dim]
        if (key.dims.length >= 3) {
          this._seqLength = key.dims[2] as number;
        }
      }

      // Cross-attention cache (set once from encoder output)
      if (this.config.hasCrossAttention) {
        const encKey = outputs[`present.${i}.encoder.key`];
        const encValue = outputs[`present.${i}.encoder.value`];
        if (encKey && encValue) {
          this.encoderKeys[i] = encKey;
          this.encoderValues[i] = encValue;
        }
      }
    }
  }

  /**
   * Set the cross-attention cache from encoder output.
   * Called once after the encoder pass.
   */
  setEncoderCache(
    layerIndex: number,
    key: ort.Tensor,
    value: ort.Tensor
  ): void {
    this.encoderKeys[layerIndex] = key;
    this.encoderValues[layerIndex] = value;
  }

  /** Get the current cached sequence length. */
  get seqLength(): number {
    return this._seqLength;
  }

  /** Check if the cache has any entries. */
  get isEmpty(): boolean {
    return this._seqLength === 0;
  }

  /** Reset the cache (free all tensors). */
  clear(): void {
    this.keys.fill(null);
    this.values.fill(null);
    this.encoderKeys.fill(null);
    this.encoderValues.fill(null);
    this._seqLength = 0;
  }

  /** Release all tensor resources. */
  dispose(): void {
    this.clear();
  }
}
