/**
 * Puente Engine — Custom Neural Network Inference Engine
 *
 * A from-scratch inference engine for running ONNX neural network models
 * in the browser via ONNX Runtime Web. Serves as the primary inference backend
 * for the Amor inteligente LLM and Lengua Materna translation engines.
 *
 * Supports:
 * - Decoder-only transformer models (text generation / LLM)
 * - Encoder-decoder models (sequence-to-sequence translation)
 * - Full BPE tokenization (tokenizer.json format)
 * - WebGPU and WASM backends
 * - KV cache for efficient autoregressive generation
 * - Greedy and nucleus (top-p) sampling
 *
 * @example
 * ```ts
 * import { TextGenerationPipeline } from "@smart-tool/puente-engine";
 *
 * const pipeline = await TextGenerationPipeline.create("./models/my-model/");
 * const result = await pipeline.generate("Hello, world!", {
 *   max_new_tokens: 100,
 *   temperature: 0.7,
 * });
 * console.log(result.text);
 * ```
 *
 * @example
 * ```ts
 * import { TranslationPipeline } from "@smart-tool/puente-engine";
 *
 * const pipeline = await TranslationPipeline.create("./models/opus-mt-en-de/");
 * const result = await pipeline.translate("Hello, how are you?", {
 *   src_lang: "en",
 *   tgt_lang: "de",
 * });
 * console.log(result.translation_text);
 * ```
 *
 * @packageDocumentation
 */

// ---- High-level Pipelines (primary API) ----
export { TextGenerationPipeline } from "./pipelines/text-generation.js";
export type { TextGenerationPipelineOptions } from "./pipelines/text-generation.js";
export { TranslationPipeline } from "./pipelines/translation.js";
export type { TranslationPipelineOptions } from "./pipelines/translation.js";

// ---- Tokenizer ----
export { BPETokenizer } from "./tokenizer/bpe-tokenizer.js";

// ---- Generation ----
export { CausalGenerator } from "./generation/causal-generator.js";
export { Seq2SeqGenerator } from "./generation/seq2seq-generator.js";
export { KVCache } from "./generation/kv-cache.js";
export type { KVCacheConfig } from "./generation/kv-cache.js";
export { sampleToken, greedyDecode } from "./generation/sampler.js";
export type { SamplingConfig } from "./generation/sampler.js";
export {
  RepetitionPenaltyProcessor,
  ForcedTokenProcessor,
  NoRepeatNgramProcessor,
  LogitsProcessorList,
} from "./generation/logits-processor.js";
export type { LogitsProcessor } from "./generation/logits-processor.js";
export {
  MaxTokensCriterion,
  EosTokenCriterion,
  StopSequenceCriterion,
  StoppingCriteriaList,
} from "./generation/stopping.js";
export type { StoppingCriterion } from "./generation/stopping.js";

// ---- Model Loading ----
export { fetchModel, fetchModelFiles, fetchModelWithShards, computeSha256 } from "./model/model-loader.js";
export type { FetchModelOptions, ModelFileInfo, ShardManifest, ShardEntry } from "./model/model-loader.js";
export {
  loadModelConfig,
  loadGenerationConfig,
  getHeadDim,
  getFirstEosTokenId,
} from "./model/model-config.js";
export { ModelCache } from "./model/model-cache.js";
export type { CacheMetadata } from "./model/model-cache.js";

// ---- Core ----
export {
  createSession,
  runSession,
  disposeSession,
  getInputNames,
  getOutputNames,
  getExecutionProvider,
} from "./core/session.js";
export {
  createInt64Tensor,
  createAttentionMask,
  createPositionIds,
  argmax,
  softmax,
  topPFilter,
  topKFilter,
  extractLastTokenLogits,
  createEmptyFloat32,
  createEmptyFloat16,
} from "./core/tensor.js";

// ---- Runtime ----
export {
  detectCapabilities,
  selectBackend,
  canUseThreads,
  describeBackend,
} from "./runtime/device.js";
export { configureBackend, getOrtExecutionProvider } from "./runtime/backend.js";
export type { BackendOptions } from "./runtime/backend.js";

// ---- Tokenizer internals (for advanced use) ----
export {
  bytesToUnicode,
  unicodeToBytes,
  textToByteTokens,
  ByteLevelPreTokenizer,
  WhitespacePreTokenizer,
  buildPreTokenizer,
} from "./tokenizer/pre-tokenizer.js";
export {
  NFCNormalizer,
  NFKCNormalizer,
  LowercaseNormalizer,
  SequenceNormalizer,
  buildNormalizer,
} from "./tokenizer/normalizer.js";
export {
  ByteLevelDecoder,
  MetaspaceDecoder,
  WordPieceDecoder,
  buildDecoder,
} from "./tokenizer/decoder.js";

// ---- Types ----
export type {
  InferenceBackend,
  BrowserCapabilities,
  GenerateOptions,
  GenerateResult,
  TranslationOptions,
  TranslationResult,
  ModelConfig,
  GenerationConfig,
  DownloadProgress,
  SessionOptions,
  TokenizerJSON,
  AddedToken,
  NormalizerConfig,
  PreTokenizerConfig,
  TokenizerModelConfig,
  DecoderConfig,
} from "./core/types.js";
