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
import {
  repairAction,
  createFallbackActions,
  buildRetryInstructionBlock,
  type RetryFailureSummary,
} from "../validators/repair.js";
import { SMART_ACTION_SCHEMA, parseJsonOutput } from "../validators/schema.js";
import { DEFAULT_INFERENCE_CONFIG } from "../model/config.js";
import { sanitizeForLog } from "../utils/sanitize.js";
import { PipelineDebugLogger, type PipelineDebugLog } from "../utils/debug-logger.js";

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
  /** Minimum acceptable plan-level validation score (0-100). */
  min_plan_validation_score: number;
  /** Skip model worker init and run in retrieval/template-only mode. */
  template_only?: boolean;
  /** Enable detailed pipeline debug logging to console. Default: false. */
  debug?: boolean;
}

const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
  inference: DEFAULT_INFERENCE_CONFIG as InferenceConfig,
  retrieval_pack_url: "./retrieval-packs/job-search-actions.json",
  worker_url: "./worker.js",
  max_repair_attempts: 3,
  min_validation_score: 45,
  min_plan_validation_score: 55,
  template_only: false,
  debug: false,
};

/** Events emitted by the planner during plan generation. */
export interface PlannerCallbacks {
  onProgress?: (progress: DownloadProgress) => void;
  onBackendSelected?: (backend: InferenceBackend) => void;
  onTokenGenerated?: (token: string) => void;
  onValidationResult?: (score: number, issues: string[]) => void;
  onRepairAttempt?: (attempt: number, issues: string[]) => void;
  onPlanRejected?: (reason: string, score: number, issues: string[]) => void;
  /** Called with the complete pipeline debug log when debug mode is enabled. */
  onDebugLog?: (log: PipelineDebugLog) => void;
  /** Enable debug logging for this generation call (overrides config.debug). */
  debug?: boolean;
}

interface ParseValidationOutcome {
  actions: SMARTAction[] | null;
  rejectionReason?: string;
  failureSummary?: RetryFailureSummary;
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

    if (this.config.template_only) {
      this.activeBackend = "wasm-basic";
      this.initialized = true;
      callbacks?.onBackendSelected?.(this.activeBackend);
      return;
    }

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
        const error = new Error(
          `Worker error: ${event.message || "unknown error"}. ` +
          "This may be caused by memory pressure — try closing other tabs."
        );
        this.rejectAllPending(error);
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
    if (!this.initialized || !this.retriever) {
      throw new Error("Planner not initialized. Call initialize() first.");
    }

    if (!this.worker) {
      return this.generateTemplatePlan(input);
    }

    // Check debug at generation time so it can be toggled without re-creating the planner
    const debugEnabled = callbacks?.debug ?? this.config.debug ?? false;
    const debugLog = new PipelineDebugLogger(debugEnabled);
    const startTime = performance.now();

    // Step 1: Normalise user profile
    const profile = normalizeProfile(input);
    debugLog.logProfile(profile);

    // Step 2: Retrieve relevant templates and skills
    const retrieval = this.retriever.retrieve(profile);
    debugLog.logRetrieval(
      retrieval.retrieval_summary,
      retrieval.templates.length,
      retrieval.skills.length,
    );

    // Step 3: Assemble prompt
    const prompt = assemblePrompt(profile, retrieval);
    const basePrompt = prompt.text;
    debugLog.logPrompt(prompt);

    // Step 4: Generate with the LLM
    // The prompt primes the assistant with "[" so we prepend it to the output.
    const inferStart = performance.now();
    let rawOutput = "[" + await this.runInference(
      basePrompt,
      callbacks?.onTokenGenerated
    );
    debugLog.logRawOutput(rawOutput, performance.now() - inferStart);

    // Step 5: Parse and validate output
    let validation = this.parseAndValidate(rawOutput, profile, callbacks, debugLog);
    let actions = validation.actions;

    // Step 6: Repair loop if needed
    let repairAttempts = 0;
    let usedRepair = false;
    while (
      actions === null &&
      repairAttempts < this.config.max_repair_attempts
    ) {
      repairAttempts++;
      const retryPrompt = validation.failureSummary
        ? `${basePrompt}
${buildRetryInstructionBlock(validation.failureSummary, repairAttempts)}`
        : basePrompt;

      const retryIssues = validation.rejectionReason
        ? [`Regenerating due to: ${validation.rejectionReason}`]
        : ["Regenerating..."];
      if (validation.failureSummary?.categories.length) {
        retryIssues.push(`Failure categories: ${validation.failureSummary.categories.join(", ")}`);
      }
      callbacks?.onRepairAttempt?.(repairAttempts, retryIssues);

      if (validation.failureSummary) {
        console.info(
          `[smart-planner] Retry attempt ${repairAttempts} failure categories: ${validation.failureSummary.categories.join(",")}`
        );
      }

      // Use progressively higher temperature on retries to increase output diversity
      const retryTemperature = Math.min(0.7, this.config.inference.temperature + repairAttempts * 0.15);
      const repairInferStart = performance.now();
      rawOutput = "[" + await this.runInference(
        retryPrompt,
        callbacks?.onTokenGenerated,
        { temperature: retryTemperature },
      );
      const repairInferTime = performance.now() - repairInferStart;

      validation = this.parseAndValidate(rawOutput, profile, callbacks, debugLog);
      actions = validation.actions;

      debugLog.logRepairAttempt({
        attempt: repairAttempts,
        temperature: retryTemperature,
        rawOutput,
        jsonParseSuccess: validation.actions !== null || validation.rejectionReason !== "Model output was not valid JSON",
        parsedActionCount: validation.actions?.length ?? 0,
        validationOutcome: validation.actions ? "passed" : (validation.rejectionReason ?? "failed"),
        timeMs: repairInferTime,
      });

      if (actions !== null) usedRepair = true;
    }

    // Step 7: Fallback to template-based actions if repair loop exhausted
    const isFallback = actions === null;
    if (isFallback) {
      actions = createFallbackActions(
        profile,
        retrieval.templates
      );
    }

    const endTime = performance.now();

    // Log outcome
    debugLog.logOutcome(
      isFallback ? "fallback_templates" : usedRepair ? "repair_success" : "llm_success",
      endTime - startTime,
      actions.length,
    );
    const debugResult = debugLog.flush();
    if (debugResult) {
      callbacks?.onDebugLog?.(debugResult);
    }

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

  /** Reject all pending generation promises (e.g. on worker crash). */
  private rejectAllPending(error: Error): void {
    for (const [id, gen] of this.pendingGenerations) {
      this.pendingGenerations.delete(id);
      gen.reject(error);
    }
  }

  /** Maximum time (ms) to wait for a single inference call before timing out. */
  private static readonly INFERENCE_TIMEOUT_MS = 120_000; // 2 minutes

  private runInference(
    prompt: string,
    onToken?: (token: string) => void,
    configOverrides: Partial<InferenceConfig> = {},
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
        config: configOverrides,
      } satisfies WorkerMessage);
    });
  }

  private parseAndValidate(
    rawOutput: string,
    profile: UserProfile,
    callbacks?: PlannerCallbacks,
    debugLog?: PipelineDebugLogger,
  ): ParseValidationOutcome {
    // Parse JSON from model output
    const parsed = parseJsonOutput(rawOutput);
    if (!parsed) {
      debugLog?.logJsonParse(false, 0);
      const rejectionReason = "Model output was not valid JSON";
      const failureSummary: RetryFailureSummary = {
        smartCriteriaFailures: {
          specific: 0,
          measurable: 0,
          achievable: 0,
          relevant: 0,
          time_bound: 0,
        },
        barrierFitFailures: [],
        planLevelIssues: [rejectionReason],
        categories: ["json_parse"],
        compact: rejectionReason,
      };
      callbacks?.onPlanRejected?.(rejectionReason, 0, [rejectionReason]);
      return { actions: null, rejectionReason, failureSummary };
    }

    debugLog?.logJsonParse(true, parsed.length);

    // Validate each action
    const validatedActions: SMARTAction[] = [];
    const allIssues: string[] = [];
    const smartCriteriaFailures = {
      specific: 0,
      measurable: 0,
      achievable: 0,
      relevant: 0,
      time_bound: 0,
    };

    for (const rawAction of parsed) {
      // Check schema compliance
      if (!SMART_ACTION_SCHEMA.validate(rawAction)) {
        allIssues.push(`Schema validation failed for action: ${sanitizeForLog(JSON.stringify(rawAction))}`);
        debugLog?.logActionValidation({
          actionText: sanitizeForLog(JSON.stringify(rawAction), 100),
          score: 0,
          criteria: {},
          passed: false,
          repaired: false,
        });
        continue;
      }

      const action = rawAction as SMARTAction;
      const result = validateAction(action, profile);

      if (result.score >= this.config.min_validation_score) {
        validatedActions.push(action);
        debugLog?.logActionValidation({
          actionText: action.action,
          score: result.score,
          criteria: result.criteria,
          passed: true,
          repaired: false,
        });
      } else {
        // Attempt repair
        const repaired = repairAction(action, result, profile);
        if (repaired) {
          validatedActions.push(repaired);
          debugLog?.logActionValidation({
            actionText: action.action,
            score: result.score,
            criteria: result.criteria,
            passed: false,
            repaired: true,
          });
        } else {
          allIssues.push(...result.issues);
          for (const criterion of Object.keys(result.criteria) as Array<keyof typeof smartCriteriaFailures>) {
            if (!result.criteria[criterion].passed) {
              smartCriteriaFailures[criterion]++;
            }
          }
          debugLog?.logActionValidation({
            actionText: action.action,
            score: result.score,
            criteria: result.criteria,
            passed: false,
            repaired: false,
          });
        }
      }
    }

    const planResult = validatePlan(validatedActions, profile);
    debugLog?.logPlanValidation(planResult.score, planResult.issues);

    const barrierFitFailures = planResult.issues.filter((issue) =>
      issue.includes("No actions directly address") || issue.includes("First action should address")
    );
    const planLevelIssues = planResult.issues.filter((issue) => !barrierFitFailures.includes(issue));

    const failureCategories = new Set<string>();
    if (Object.values(smartCriteriaFailures).some((count) => count > 0)) {
      failureCategories.add("smart_criteria");
    }
    if (barrierFitFailures.length > 0) {
      failureCategories.add("barrier_fit");
    }
    if (planLevelIssues.length > 0) {
      failureCategories.add("plan_level");
    }
    if (allIssues.some((issue) => issue.startsWith("Schema validation failed"))) {
      failureCategories.add("schema");
    }

    const summaryParts: string[] = [];
    const failedCriteriaEntries = Object.entries(smartCriteriaFailures).filter(([, count]) => count > 0);
    if (failedCriteriaEntries.length > 0) {
      summaryParts.push(
        `SMART failures ${failedCriteriaEntries.map(([k, v]) => `${k}:${v}`).join(",")}`
      );
    }
    if (barrierFitFailures.length > 0) {
      summaryParts.push(`Barrier-fit: ${barrierFitFailures.join("; ")}`);
    }
    if (planLevelIssues.length > 0) {
      summaryParts.push(`Plan-level: ${planLevelIssues.join("; ")}`);
    }
    if (summaryParts.length === 0 && allIssues.length > 0) {
      summaryParts.push(`Action issues: ${allIssues.slice(0, 2).join("; ")}`);
    }

    const failureSummary: RetryFailureSummary = {
      smartCriteriaFailures,
      barrierFitFailures,
      planLevelIssues,
      categories: Array.from(failureCategories),
      compact: summaryParts.join(" | ") || "Validation failed",
    };

    callbacks?.onValidationResult?.(planResult.score, planResult.issues);

    if (validatedActions.length < 1) {
      const rejectionReason = "No actions passed action-level validation";
      callbacks?.onPlanRejected?.(rejectionReason, planResult.score, [
        ...allIssues,
        ...planResult.issues,
      ]);
      return { actions: null, rejectionReason, failureSummary };
    }

    const criticalPlanIssues = planResult.issues.filter((issue) =>
      issue.includes("No actions directly address") ||
      issue.includes("duplicate or very similar actions") ||
      issue.includes("Estimated total effort")
    );

    const belowPlanScoreThreshold =
      planResult.score < this.config.min_plan_validation_score;

    if (belowPlanScoreThreshold || criticalPlanIssues.length > 0) {
      const reasons: string[] = [];
      if (belowPlanScoreThreshold) {
        reasons.push(
          `Plan score ${planResult.score} is below minimum ${this.config.min_plan_validation_score}`
        );
      }
      if (criticalPlanIssues.length > 0) {
        reasons.push(`Critical issues: ${criticalPlanIssues.join("; ")}`);
      }

      const rejectionReason = reasons.join(" | ");
      callbacks?.onPlanRejected?.(rejectionReason, planResult.score, planResult.issues);
      return { actions: null, rejectionReason, failureSummary };
    }

    return { actions: validatedActions };
  }
}
