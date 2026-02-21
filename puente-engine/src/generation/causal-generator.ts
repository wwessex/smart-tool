/**
 * Autoregressive text generation for decoder-only transformer models.
 *
 * Implements the full generation loop:
 * 1. Encode prompt → token IDs
 * 2. Prefill pass (process entire prompt, build initial KV cache)
 * 3. Decode loop (generate one token at a time using KV cache)
 * 4. Apply logits processors (repetition penalty, etc.)
 * 5. Sample next token (greedy or nucleus)
 * 6. Check stopping criteria (EOS, stop sequences, max tokens)
 * 7. Stream tokens via callback
 *
 * ONNX model I/O (decoder-only like GPT-2/LLaMA/SmolLM):
 * - Inputs:  input_ids, attention_mask, position_ids,
 *            past_key_values.{i}.key, past_key_values.{i}.value
 * - Outputs: logits, present.{i}.key, present.{i}.value
 */

import type * as ort from "onnxruntime-web";
import type { GenerateOptions, GenerateResult, ModelConfig } from "../core/types.js";
import {
  createInt64Tensor,
  createAttentionMask,
  createPositionIds,
  extractLastTokenLogits,
} from "../core/tensor.js";
import { runSession, getInputNames } from "../core/session.js";
import { BPETokenizer } from "../tokenizer/bpe-tokenizer.js";
import { KVCache } from "./kv-cache.js";
import { sampleToken } from "./sampler.js";
import { RepetitionPenaltyProcessor, LogitsProcessorList } from "./logits-processor.js";
import {
  MaxTokensCriterion,
  EosTokenCriterion,
  StopSequenceCriterion,
  StoppingCriteriaList,
} from "./stopping.js";
import { getHeadDim, getFirstEosTokenId } from "../model/model-config.js";

/** Default generation parameters. */
const DEFAULTS = {
  max_new_tokens: 512,
  temperature: 0,
  top_p: 1.0,
  top_k: 0,
  repetition_penalty: 1.0,
};

export class CausalGenerator {
  private session: ort.InferenceSession;
  private tokenizer: BPETokenizer;
  private modelConfig: ModelConfig;
  private inputNames: Set<string>;

  constructor(
    session: ort.InferenceSession,
    tokenizer: BPETokenizer,
    modelConfig: ModelConfig
  ) {
    this.session = session;
    this.tokenizer = tokenizer;
    this.modelConfig = modelConfig;
    this.inputNames = new Set(getInputNames(session));
  }

  /**
   * Generate text autoregressively from a prompt.
   */
  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const startTime = performance.now();
    const maxNewTokens = options.max_new_tokens ?? DEFAULTS.max_new_tokens;
    const temperature = options.temperature ?? DEFAULTS.temperature;
    const topP = options.top_p ?? DEFAULTS.top_p;
    const topK = options.top_k ?? DEFAULTS.top_k;
    const repetitionPenalty =
      options.repetition_penalty ?? DEFAULTS.repetition_penalty;

    // Step 1: Encode prompt
    const promptIds = this.tokenizer.encode(options.prompt);
    if (promptIds.length === 0) {
      return {
        text: "",
        tokens_generated: 0,
        time_ms: performance.now() - startTime,
        backend: "wasm-basic",
      };
    }

    // Step 2: Set up logits processors
    const logitsProcessors = new LogitsProcessorList();
    if (repetitionPenalty !== 1.0) {
      logitsProcessors.add(
        new RepetitionPenaltyProcessor(repetitionPenalty)
      );
    }

    // Step 3: Set up stopping criteria
    const stoppingCriteria = new StoppingCriteriaList();
    stoppingCriteria.add(new MaxTokensCriterion(maxNewTokens));

    const eosId = getFirstEosTokenId(this.modelConfig);
    if (eosId !== undefined) {
      stoppingCriteria.add(new EosTokenCriterion(eosId));
    }
    if (options.stop_sequences && options.stop_sequences.length > 0) {
      stoppingCriteria.add(
        new StopSequenceCriterion(options.stop_sequences)
      );
    }

    // Step 4: Initialise KV cache
    const headDim = getHeadDim(this.modelConfig);
    const kvCache = new KVCache({
      numLayers: this.modelConfig.num_hidden_layers,
      numKVHeads: this.modelConfig.num_key_value_heads,
      headDim,
    });

    // Step 5: Prefill pass — process entire prompt
    const allIds = [...promptIds]; // all token IDs (prompt + generated)
    const generatedIds: number[] = [];

    let nextLogits = await this.prefill(promptIds, kvCache);

    // Step 6: Decode loop
    while (true) {
      // Check for abort
      if (options.signal?.aborted) {
        break;
      }

      // Apply logits processors
      const logits = logitsProcessors.process(nextLogits, allIds);

      // Sample next token
      const nextToken = sampleToken(logits, {
        temperature,
        top_p: topP,
        top_k: topK,
      });

      // Record token
      generatedIds.push(nextToken);
      allIds.push(nextToken);

      // Decode generated text so far (for stop sequence detection)
      const generatedText = this.tokenizer.decode(generatedIds);

      // Notify callback
      options.on_token?.(
        this.tokenizer.decode([nextToken]),
        false
      );

      // Check stopping criteria
      if (stoppingCriteria.shouldStop(generatedIds, generatedText)) {
        break;
      }

      // Step 7: Decode next token using KV cache
      nextLogits = await this.decodeStep(nextToken, kvCache);
    }

    // Notify final token
    options.on_token?.("", true);

    // Decode full generated text
    let text = this.tokenizer.decode(generatedIds);

    // Trim at stop sequences
    if (options.stop_sequences) {
      text = trimAtStopSequence(text, options.stop_sequences);
    }

    // Clean up
    kvCache.dispose();

    return {
      text,
      tokens_generated: generatedIds.length,
      time_ms: performance.now() - startTime,
      backend: "wasm-basic", // actual backend determined by session
    };
  }

  /**
   * Prefill: run the full prompt through the model to build initial KV cache.
   * Returns logits for the last position.
   */
  private async prefill(
    promptIds: number[],
    kvCache: KVCache
  ): Promise<Float32Array> {
    const seqLen = promptIds.length;

    // Build input feeds
    const feeds: Record<string, ort.Tensor> = {
      input_ids: createInt64Tensor(promptIds, [1, seqLen]),
      attention_mask: createAttentionMask(seqLen),
    };

    // Add position_ids if the model expects them
    if (this.inputNames.has("position_ids")) {
      feeds.position_ids = createPositionIds(0, seqLen);
    }

    // Add empty KV cache
    const kvFeeds = kvCache.getFeedTensors();
    for (const [name, tensor] of Object.entries(kvFeeds)) {
      if (this.inputNames.has(name)) {
        feeds[name] = tensor;
      }
    }

    // Run inference
    const outputs = await runSession(this.session, feeds);

    // Update KV cache from outputs
    kvCache.updateFromOutputs(
      outputs as unknown as Record<string, ort.Tensor>
    );

    // Extract logits for last position
    const logitsTensor = outputs.logits as ort.Tensor;
    return extractLastTokenLogits(logitsTensor);
  }

  /**
   * Decode step: generate logits for a single new token using KV cache.
   */
  private async decodeStep(
    tokenId: number,
    kvCache: KVCache
  ): Promise<Float32Array> {
    const currentSeqLen = kvCache.seqLength;

    // Build input feeds — single token
    const feeds: Record<string, ort.Tensor> = {
      input_ids: createInt64Tensor([tokenId], [1, 1]),
      attention_mask: createAttentionMask(currentSeqLen + 1),
    };

    // Position ID is the next position
    if (this.inputNames.has("position_ids")) {
      feeds.position_ids = createPositionIds(currentSeqLen, 1);
    }

    // Add KV cache from previous step
    const kvFeeds = kvCache.getFeedTensors();
    for (const [name, tensor] of Object.entries(kvFeeds)) {
      if (this.inputNames.has(name)) {
        feeds[name] = tensor;
      }
    }

    // Run inference
    const outputs = await runSession(this.session, feeds);

    // Update KV cache
    kvCache.updateFromOutputs(
      outputs as unknown as Record<string, ort.Tensor>
    );

    // Extract logits
    const logitsTensor = outputs.logits as ort.Tensor;
    return extractLastTokenLogits(logitsTensor);
  }
}

/**
 * Trim text at the first occurrence of any stop sequence.
 */
function trimAtStopSequence(text: string, stopSequences: string[]): string {
  let earliest = text.length;
  for (const seq of stopSequences) {
    const idx = text.indexOf(seq);
    if (idx !== -1 && idx < earliest) {
      earliest = idx;
    }
  }
  return earliest < text.length ? text.slice(0, earliest) : text;
}
