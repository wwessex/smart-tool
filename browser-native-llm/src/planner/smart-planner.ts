/**
 * Main SMART planner orchestrator.
 *
 * Coordinates the full pipeline: profile normalisation → retrieval →
 * prompt assembly → inference → validation → repair loop.
 * This is the primary public API for generating SMART action plans.
 */

import type {
  SMARTAction,
  SMARTPlan,
  RawUserInput,
  UserProfile,
  InferenceConfig,
  InferenceBackend,
  WorkerMessage,
  DownloadProgress,
} from "../types.js";
import { normalizeProfile } from "./profile-normalizer.js";
import { assemblePrompt } from "./prompt-assembler.js";
import { ActionLibrary } from "../retrieval/action-library.js";
import { LocalRetriever } from "../retrieval/retriever.js";
import { validateAction, validatePlan } from "../validators/smart-validator.js";
import { repairAction, createFallbackActions } from "../validators/repair.js";
import { SMART_ACTION_SCHEMA, parseJsonOutput } from "../validators/schema.js";
import { DEFAULT_INFERENCE_CONFIG } from "../model/config.js";
import { sanitizeForLog } from "../utils/sanitize.js";

/** Configuration for the SMART planner. */
export interface PlannerConfig {
  /** Inference configuration. */
  inference: InferenceConfig;
  /** URL for the retrieval pack JSON. */
  retrieval_pack_url: string;
  /** URL for the inference worker script. */
  worker_url: string;
  /** Pre-created Worker instance (takes precedence over worker_url). */
  worker?: Worker;
  /** Maximum repair attempts before falling back to templates. */
  max_repair_attempts: number;
  /** Minimum acceptable overall validation score (0-100). */
  min_validation_score: number;
}

const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  inference: DEFAULT_INFERENCE_CONFIG as InferenceConfig,
  retrieval_pack_url: "./retrieval-packs/job-search-actions.json",
  worker_url: "./worker.js",
  max_repair_attempts: 2,
  min_validation_score: 60,
};

/** Events emitted by the planner during plan generation. */
export interface PlannerCallbacks {
  onProgress?: (progress: DownloadProgress) => void;
  onBackendSelected?: (backend: InferenceBackend) => void;
  onTokenGenerated?: (token: string) => void;
  onValidationResult?: (score: number, issues: string[]) => void;
  onRepairAttempt?: (attempt: number, issues: string[]) => void;
}

/**
 * The SMART action planner.
 *
 * Usage:
 * ```ts
 * const planner = new SmartPlanner();
 * await planner.initialize();
 *
 * const plan = await planner.generatePlan({
 *   goal: "Entry-level admin role",
 *   hours_per_week: 6,
 *   timeframe: "8 weeks",
 *   skills: "Excel, customer service",
 * });
 * ```
 */
export class SmartPlanner {
  private config: PlannerConfig;
  private library: ActionLibrary;
  private retriever: LocalRetriever | null = null;
  private worker: Worker | null = null;
  private initialized = false;
  private activeBackend: InferenceBackend = "wasm-basic";
  private pendingGenerations = new Map<
    string,
    {
      resolve: (text: string) => void;
      reject: (error: Error) => void;
      tokens: string[];
      onToken?: (token: string) => void;
    }
  >();

  constructor(config: Partial<PlannerConfig> = {}) {
    this.config = { ...DEFAULT_PLANNER_CONFIG, ...config };
    this.library = new ActionLibrary();
  }

  /**
   * Initialize the planner: load retrieval pack and inference engine.
   */
  async initialize(callbacks?: PlannerCallbacks): Promise<void> {
    // Load retrieval pack
    await this.library.loadFromUrl(this.config.retrieval_pack_url);
    this.retriever = new LocalRetriever(this.library);

    // Initialize inference worker (use provided instance or create from URL)
    this.worker = this.config.worker ?? new Worker(this.config.worker_url, { type: "module" });

    await new Promise<void>((resolve, reject) => {
      if (!this.worker) return reject(new Error("Worker not created"));

      // Handle worker load failures (e.g. invalid URL, network error)
      this.worker.onerror = (event: ErrorEvent) => {
        reject(new Error(`Worker failed to load: ${event.message || "unknown error"}`));
      };

      this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const msg = event.data;

        switch (msg.type) {
          case "init_complete":
            this.activeBackend = msg.backend;
            callbacks?.onBackendSelected?.(msg.backend);
            resolve();
            break;

          case "init_error":
            reject(new Error(msg.error));
            break;

          case "progress":
            callbacks?.onProgress?.(msg.progress);
            break;

          case "token": {
            const gen = this.pendingGenerations.get(msg.id);
            if (gen) {
              gen.tokens.push(msg.token);
              gen.onToken?.(msg.token);
            }
            break;
          }

          case "generate_complete": {
            const gen = this.pendingGenerations.get(msg.id);
            if (gen) {
              this.pendingGenerations.delete(msg.id);
              gen.resolve(msg.text);
            }
            break;
          }

          case "generate_error": {
            const gen = this.pendingGenerations.get(msg.id);
            if (gen) {
              this.pendingGenerations.delete(msg.id);
              gen.reject(new Error(msg.error));
            }
            break;
          }
        }
      };

      this.worker.postMessage({
        type: "init",
        config: this.config.inference,
      } satisfies WorkerMessage);
    });

    // After init succeeds, replace the onerror handler so that worker
    // crashes during generation reject any pending generation promises
    // instead of silently calling the (already-resolved) init reject.
    if (this.worker) {
      this.worker.onerror = (event: ErrorEvent) => {
        const error = new Error(`Worker error: ${event.message || "unknown error"}`);
        for (const [id, gen] of this.pendingGenerations) {
          this.pendingGenerations.delete(id);
          gen.reject(error);
        }
      };
    }

    this.initialized = true;
  }

  /**
   * Generate a SMART action plan from user input.
   */
  async generatePlan(
    input: RawUserInput,
    callbacks?: PlannerCallbacks
  ): Promise<SMARTPlan> {
    if (!this.initialized || !this.retriever || !this.worker) {
      throw new Error("Planner not initialized. Call initialize() first.");
    }

    const startTime = performance.now();

    // Step 1: Normalise user profile
    const profile = normalizeProfile(input);

    // Step 2: Retrieve relevant templates and skills
    const retrieval = this.retriever.retrieve(profile);

    // Step 3: Assemble prompt
    const prompt = assemblePrompt(profile, retrieval);

    // Step 4: Generate with the LLM
    let rawOutput = await this.runInference(
      prompt.text,
      callbacks?.onTokenGenerated
    );

    // Step 5: Parse and validate output
    let actions = this.parseAndValidate(rawOutput, profile, callbacks);

    // Step 6: Repair loop if needed
    let repairAttempts = 0;
    while (
      actions === null &&
      repairAttempts < this.config.max_repair_attempts
    ) {
      repairAttempts++;
      callbacks?.onRepairAttempt?.(repairAttempts, ["Regenerating..."]);

      rawOutput = await this.runInference(
        prompt.text,
        callbacks?.onTokenGenerated
      );
      actions = this.parseAndValidate(rawOutput, profile, callbacks);
    }

    // Step 7: Fallback to template-based actions if repair loop exhausted
    if (actions === null) {
      actions = createFallbackActions(
        profile,
        retrieval.templates
      );
    }

    const endTime = performance.now();

    return {
      actions,
      metadata: {
        model_id: this.config.inference.model_id,
        model_version: "0.1.0",
        backend: this.activeBackend,
        retrieval_pack_version: this.library.packVersion,
        generated_at: new Date().toISOString(),
        generation_time_ms: endTime - startTime,
        tokens_generated: Math.ceil(rawOutput.length / 4),
      },
    };
  }

  /**
   * Generate a plan using only the retrieval pack (no LLM inference).
   * Useful as a zero-download fallback.
   */
  generateTemplatePlan(input: RawUserInput): SMARTPlan {
    if (!this.retriever) {
      throw new Error("Retrieval pack not loaded.");
    }

    const startTime = performance.now();
    const profile = normalizeProfile(input);
    const retrieval = this.retriever.retrieve(profile);

    const actions = createFallbackActions(profile, retrieval.templates);

    return {
      actions,
      metadata: {
        model_id: "template-only",
        model_version: "0.1.0",
        backend: "wasm-basic",
        retrieval_pack_version: this.library.packVersion,
        generated_at: new Date().toISOString(),
        generation_time_ms: performance.now() - startTime,
        tokens_generated: 0,
      },
    };
  }

  /** Release all resources. */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.initialized = false;
    this.pendingGenerations.clear();
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get backend(): InferenceBackend {
    return this.activeBackend;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Maximum time (ms) to wait for a single inference call before timing out. */
  private static readonly INFERENCE_TIMEOUT_MS = 120_000; // 2 minutes

  private runInference(
    prompt: string,
    onToken?: (token: string) => void
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.worker) return reject(new Error("Worker not available"));

      const id = crypto.randomUUID();

      // Timeout guard: if the worker never responds, reject the promise
      // so the caller can fall back to templates instead of hanging forever.
      const timer = setTimeout(() => {
        const gen = this.pendingGenerations.get(id);
        if (gen) {
          this.pendingGenerations.delete(id);
          gen.reject(new Error("Inference timed out"));
        }
      }, SmartPlanner.INFERENCE_TIMEOUT_MS);

      this.pendingGenerations.set(id, {
        resolve: (text: string) => {
          clearTimeout(timer);
          resolve(text);
        },
        reject: (err: Error) => {
          clearTimeout(timer);
          reject(err);
        },
        tokens: [],
        onToken,
      });

      this.worker.postMessage({
        type: "generate",
        id,
        prompt,
        config: {},
      } satisfies WorkerMessage);
    });
  }

  private parseAndValidate(
    rawOutput: string,
    profile: UserProfile,
    callbacks?: PlannerCallbacks
  ): SMARTAction[] | null {
    // Parse JSON from model output
    const parsed = parseJsonOutput(rawOutput);
    if (!parsed) return null;

    // Validate each action
    const validatedActions: SMARTAction[] = [];
    const allIssues: string[] = [];

    for (const rawAction of parsed) {
      // Check schema compliance
      if (!SMART_ACTION_SCHEMA.validate(rawAction)) {
        allIssues.push(`Schema validation failed for action: ${sanitizeForLog(JSON.stringify(rawAction))}`);
        continue;
      }

      const action = rawAction as SMARTAction;
      const result = validateAction(action, profile);

      if (result.score >= this.config.min_validation_score) {
        validatedActions.push(action);
      } else {
        // Attempt repair
        const repaired = repairAction(action, result, profile);
        if (repaired) {
          validatedActions.push(repaired);
        } else {
          allIssues.push(...result.issues);
        }
      }
    }

    const planResult = validatePlan(validatedActions, profile);
    callbacks?.onValidationResult?.(planResult.score, planResult.issues);

    if (validatedActions.length < 3) {
      return null;
    }

    return validatedActions;
  }
}
