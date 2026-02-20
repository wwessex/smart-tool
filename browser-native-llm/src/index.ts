/**
 * Browser-Native LLM for SMART Job-Seeker Actions
 *
 * Offline-first, privacy-preserving LLM system for generating
 * SMART (Specific, Measurable, Achievable, Relevant, Time-bound)
 * action plans for job seekers.
 *
 * Architecture: constrained planner with local retrieval-augmented
 * generation, JSON schema validation, and repair loop fallback.
 *
 * @example
 * ```ts
 * import { SmartPlanner } from "@smart-tool/browser-native-llm";
 *
 * const planner = new SmartPlanner({
 *   inference: {
 *     model_id: "smart-planner-150m",
 *     model_base_url: "./models/smart-planner-150m-q4/",
 *     max_seq_length: 1024,
 *     max_new_tokens: 512,
 *     temperature: 0,
 *     top_p: 1.0,
 *     repetition_penalty: 1.1,
 *   },
 *   retrieval_pack_url: "./retrieval-packs/job-search-actions.json",
 *   worker_url: "./worker.js",
 * });
 *
 * await planner.initialize({
 *   onProgress: (p) => console.log(`Loading: ${p.file} ${p.loaded_bytes}/${p.total_bytes}`),
 *   onBackendSelected: (b) => console.log(`Backend: ${b}`),
 * });
 *
 * const plan = await planner.generatePlan({
 *   goal: "Entry-level admin role",
 *   hours_per_week: 6,
 *   timeframe: "8 weeks",
 *   skills: "Excel, customer service",
 * });
 *
 * console.log(plan.actions); // SMARTAction[]
 * ```
 *
 * @packageDocumentation
 */

// ---- Core planner (primary public API) ----
export { SmartPlanner } from "./planner/smart-planner.js";
export type { PlannerConfig, PlannerCallbacks } from "./planner/smart-planner.js";

// ---- Profile handling ----
export { normalizeProfile } from "./planner/profile-normalizer.js";

// ---- Prompt assembly ----
export { assemblePrompt } from "./planner/prompt-assembler.js";
export type { AssembledPrompt, PromptAssemblerConfig } from "./planner/prompt-assembler.js";

// ---- Retrieval ----
export { ActionLibrary } from "./retrieval/action-library.js";
export { LocalRetriever } from "./retrieval/retriever.js";
export type { RetrievalResult, RetrieverConfig } from "./retrieval/retriever.js";

// ---- Validators ----
export { validateAction, validatePlan } from "./validators/smart-validator.js";
export { repairAction, createFallbackActions } from "./validators/repair.js";
export { SMART_ACTION_SCHEMA, parseJsonOutput } from "./validators/schema.js";

// ---- Model configuration ----
export { MODEL_CONFIGS, DEFAULT_INFERENCE_CONFIG, estimateKVCacheBytes, estimateWeightBytes } from "./model/config.js";
export type { ModelArchitectureConfig } from "./model/config.js";

// ---- Runtime ----
export { detectCapabilities, selectBackend, canUseThreads, describeBackend } from "./runtime/backend-selector.js";

// ---- Inference engines ----
export { OnnxInferenceEngine, TransformersInferenceEngine } from "./model/inference.js";
export type { InferenceEngine, GenerateOptions, GenerateResult } from "./model/inference.js";

// ---- Tokenizer ----
export { SmartTokenizer } from "./model/tokenizer.js";

// ---- Delivery ----
export { loadManifest, loadModelFiles, estimateDownloadInfo } from "./delivery/chunk-loader.js";
export { CacheManager, downloadWithCache } from "./delivery/cache-manager.js";
export type { CacheManagerOptions } from "./delivery/cache-manager.js";

// ---- Types (re-export all) ----
export type {
  SMARTAction,
  SMARTPlan,
  PlanMetadata,
  UserProfile,
  RawUserInput,
  ActionTemplate,
  JobSearchStage,
  SkillEntry,
  RetrievalPack,
  InferenceBackend,
  BrowserCapabilities,
  InferenceConfig,
  ModelManifest,
  ModelFile,
  ValidationResult,
  SMARTCriteriaResult,
  CriterionResult,
  CacheEntry,
  DownloadProgress,
  WorkerMessage,
} from "./types.js";
