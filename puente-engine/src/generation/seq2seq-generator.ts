/**
 * Encoder-decoder generation for sequence-to-sequence models.
 *
 * Implements the translation inference pipeline for Marian/OPUS-MT models:
 * 1. Encode source text → token IDs
 * 2. Encoder pass → encoder hidden states
 * 3. Initialize decoder with start token (+ optional language token)
 * 4. Autoregressive decoder loop using cross-attention with encoder output
 * 5. Decode output tokens → translated text
 *
 * ONNX model structure (Marian/OPUS-MT via Xenova):
 *
 * Encoder model (encoder_model.onnx):
 * - Inputs:  input_ids [batch, src_len], attention_mask [batch, src_len]
 * - Outputs: last_hidden_state [batch, src_len, hidden_size]
 *
 * Decoder model (decoder_model_merged.onnx):
 * - Inputs:  input_ids [batch, 1],
 *            encoder_hidden_states [batch, src_len, hidden_size],
 *            encoder_attention_mask [batch, src_len],
 *            past_key_values.{i}.decoder.key/value (self-attention cache),
 *            past_key_values.{i}.encoder.key/value (cross-attention cache)
 * - Outputs: logits [batch, 1, vocab_size],
 *            present.{i}.decoder.key/value,
 *            present.{i}.encoder.key/value
 *
 * Note: The "merged" decoder model handles both the initial step
 * (no past KV) and subsequent steps (with past KV) via the
 * use_cache_branch input.
 */

import type * as ort from "onnxruntime-web";
import type { TranslationOptions, TranslationResult, ModelConfig } from "../core/types.js";
import {
  createInt64Tensor,
  createAttentionMask,
  extractLastTokenLogits,
  createEmptyFloat32,
} from "../core/tensor.js";
import { runSession, getInputNames } from "../core/session.js";
import { BPETokenizer } from "../tokenizer/bpe-tokenizer.js";
import { greedyDecode } from "./sampler.js";
import { getFirstEosTokenId } from "../model/model-config.js";

/** Default decoder parameters. */
const DEFAULTS = {
  max_new_tokens: 512,
};

export class Seq2SeqGenerator {
  private encoderSession: ort.InferenceSession;
  private decoderSession: ort.InferenceSession;
  private tokenizer: BPETokenizer;
  private modelConfig: ModelConfig;
  private decoderInputNames: Set<string>;

  constructor(
    encoderSession: ort.InferenceSession,
    decoderSession: ort.InferenceSession,
    tokenizer: BPETokenizer,
    modelConfig: ModelConfig
  ) {
    this.encoderSession = encoderSession;
    this.decoderSession = decoderSession;
    this.tokenizer = tokenizer;
    this.modelConfig = modelConfig;
    this.decoderInputNames = new Set(getInputNames(decoderSession));
  }

  /**
   * Translate text using encoder-decoder inference.
   */
  async generate(options: TranslationOptions): Promise<TranslationResult> {
    const maxNewTokens = options.max_new_tokens ?? DEFAULTS.max_new_tokens;

    // Step 1: Prepare source text
    let sourceText = options.text;

    // For multilingual models with target language tokens, prepend >>tgt<<
    if (options.tgt_lang) {
      const langToken = `>>${options.tgt_lang}<<`;
      // Check if the tokenizer knows this token
      if (this.tokenizer.getTokenId(langToken) !== undefined) {
        sourceText = langToken + " " + sourceText;
      }
    }

    // Step 2: Encode source text to token IDs
    const sourceIds = this.tokenizer.encode(sourceText);
    if (sourceIds.length === 0) {
      return { translation_text: "" };
    }

    // Step 3: Run encoder
    const encoderOutput = await this.runEncoder(sourceIds);

    // Step 4: Get decoder start token
    const decoderStartTokenId = this.getDecoderStartTokenId();

    // Step 5: Autoregressive decoder loop
    const generatedIds = await this.decodeLoop(
      encoderOutput,
      sourceIds.length,
      decoderStartTokenId,
      maxNewTokens
    );

    // Step 6: Decode output tokens
    const translatedText = this.tokenizer.decode(generatedIds, true);

    return { translation_text: translatedText };
  }

  /**
   * Run the encoder and return the hidden states tensor.
   */
  private async runEncoder(
    sourceIds: number[]
  ): Promise<ort.Tensor> {
    const seqLen = sourceIds.length;

    const feeds: Record<string, ort.Tensor> = {
      input_ids: createInt64Tensor(sourceIds, [1, seqLen]),
      attention_mask: createAttentionMask(seqLen),
    };

    const outputs = await runSession(this.encoderSession, feeds);

    // The encoder outputs "last_hidden_state" or "encoder_hidden_states"
    const hiddenStates =
      (outputs as Record<string, ort.Tensor>).last_hidden_state ??
      (outputs as Record<string, ort.Tensor>).encoder_hidden_states;

    if (!hiddenStates) {
      throw new Error(
        "Encoder output missing. Expected 'last_hidden_state' or 'encoder_hidden_states'."
      );
    }

    return hiddenStates;
  }

  /**
   * Autoregressive decoder loop.
   * Generates tokens until EOS or max tokens reached.
   */
  private async decodeLoop(
    encoderOutput: ort.Tensor,
    sourceLen: number,
    startTokenId: number,
    maxNewTokens: number
  ): Promise<number[]> {
    const eosTokenId = getFirstEosTokenId(this.modelConfig);
    const generatedIds: number[] = [];

    // Decoder KV cache state — accumulates across steps
    let pastKeyValues: Record<string, ort.Tensor> = {};
    let isFirstStep = true;

    // Current decoder input: start with the decoder start token
    let currentTokenId = startTokenId;

    for (let step = 0; step < maxNewTokens; step++) {
      // Build decoder feeds
      const feeds: Record<string, ort.Tensor> = {
        input_ids: createInt64Tensor([currentTokenId], [1, 1]),
      };

      // Encoder hidden states and attention mask
      if (this.decoderInputNames.has("encoder_hidden_states")) {
        feeds.encoder_hidden_states = encoderOutput;
      }
      if (this.decoderInputNames.has("encoder_attention_mask")) {
        feeds.encoder_attention_mask = createAttentionMask(sourceLen);
      }

      // Use cache branch flag (some merged decoder models use this)
      if (this.decoderInputNames.has("use_cache_branch")) {
        const { Tensor } = await import("onnxruntime-web");
        feeds.use_cache_branch = new Tensor("bool", [!isFirstStep], [1]);
      }

      // Past key values (empty for first step)
      this.addPastKeyValues(feeds, pastKeyValues, isFirstStep);

      // Run decoder
      const outputs = await runSession(this.decoderSession, feeds);

      // Extract logits and sample
      const logitsTensor = (outputs as Record<string, ort.Tensor>).logits;
      const logits = extractLastTokenLogits(logitsTensor);
      const nextToken = greedyDecode(logits);

      // Check for EOS
      if (eosTokenId !== undefined && nextToken === eosTokenId) {
        break;
      }

      generatedIds.push(nextToken);
      currentTokenId = nextToken;

      // Update KV cache from outputs
      pastKeyValues = this.extractPresentKeyValues(
        outputs as Record<string, ort.Tensor>
      );
      isFirstStep = false;
    }

    return generatedIds;
  }

  /**
   * Add past key-value tensors to the decoder feeds.
   * For the first step, adds empty tensors.
   */
  private addPastKeyValues(
    feeds: Record<string, ort.Tensor>,
    pastKeyValues: Record<string, ort.Tensor>,
    isFirstStep: boolean
  ): void {
    // Detect the KV cache naming pattern from the decoder's input names
    for (const inputName of this.decoderInputNames) {
      if (!inputName.startsWith("past_key_values.")) continue;

      if (isFirstStep) {
        // Provide empty tensors for the first step
        // We need to infer the shape: [batch=1, heads, seq_len=0, head_dim]
        // Use the model config for dimensions
        const numHeads = this.modelConfig.num_key_value_heads || this.modelConfig.num_attention_heads;
        const headDim = this.modelConfig.hidden_size / this.modelConfig.num_attention_heads || 64;
        feeds[inputName] = createEmptyFloat32([1, numHeads, 0, headDim]);
      } else {
        // Use the present KV from the previous step
        const presentName = inputName.replace("past_key_values.", "present.");
        const tensor = pastKeyValues[presentName];
        if (tensor) {
          feeds[inputName] = tensor;
        } else {
          // Fallback: try with the original name
          const directTensor = pastKeyValues[inputName];
          if (directTensor) {
            feeds[inputName] = directTensor;
          }
        }
      }
    }
  }

  /**
   * Extract present key-value tensors from decoder outputs.
   */
  private extractPresentKeyValues(
    outputs: Record<string, ort.Tensor>
  ): Record<string, ort.Tensor> {
    const kvs: Record<string, ort.Tensor> = {};
    for (const [name, tensor] of Object.entries(outputs)) {
      if (name.startsWith("present.")) {
        kvs[name] = tensor;
      }
    }
    return kvs;
  }

  /**
   * Determine the decoder start token ID.
   * Marian models typically use the EOS token (</s>) or pad_token_id as the start.
   */
  private getDecoderStartTokenId(): number {
    // Explicit decoder_start_token_id from config
    if (this.modelConfig.decoder_start_token_id !== undefined) {
      return this.modelConfig.decoder_start_token_id;
    }

    // Forced BOS token (some Marian models)
    if (this.modelConfig.forced_bos_token_id !== undefined) {
      return this.modelConfig.forced_bos_token_id;
    }

    // Fallback: pad_token_id (Marian convention)
    if (this.modelConfig.pad_token_id !== undefined) {
      return this.modelConfig.pad_token_id;
    }

    // Last resort: EOS token
    const eos = getFirstEosTokenId(this.modelConfig);
    if (eos !== undefined) return eos;

    // Absolute fallback
    return 0;
  }
}
