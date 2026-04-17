/**
 * Pipeline debug logger for the SMART action planner.
 *
 * Captures a structured trace of each `generatePlan` call:
 * assembled prompt, raw model output, per-action validation,
 * repair loop details, and stage timing.
 *
 * Activated via `debug: true` in PlannerConfig. All methods are
 * no-ops when disabled — zero overhead in production.
 *
 * Console output uses indirect references so that esbuild's
 * `drop: ['console']` (used in production builds) does not strip
 * debug logging — the user has explicitly opted in via localStorage.
 */

import type { UserProfile, SMARTCriteriaResult } from "../types.js";
import type { AssembledPrompt } from "../planner/prompt-assembler.js";

// Indirect console references survive esbuild `drop: ['console']`.
// Only resolved when debug mode is active, so zero cost otherwise.
const _console = /* @__PURE__ */ (() => globalThis.console)();
const _log = _console.log.bind(_console);
const _group = (_console.groupCollapsed ?? _console.log).bind(_console);
const _groupEnd = (_console.groupEnd ?? (() => {})).bind(_console);

/** Per-action validation detail captured during pipeline execution. */
export interface ActionValidationEntry {
  actionText: string;
  score: number;
  criteria: Partial<Record<keyof SMARTCriteriaResult, { passed: boolean; score: number; reason: string }>>;
  passed: boolean;
  repaired: boolean;
}

/** Detail for a single repair loop attempt. */
export interface RepairAttemptEntry {
  attempt: number;
  temperature: number;
  rawOutput: string;
  jsonParseSuccess: boolean;
  parsedActionCount: number;
  validationOutcome: string;
  timeMs: number;
}

/** Complete pipeline debug log for one `generatePlan` call. */
export interface PipelineDebugLog {
  timestamp: string;

  // Stage 1: Profile
  normalizedProfile: UserProfile | null;

  // Stage 2: Retrieval
  retrievalSummary: string;
  templatesRetrieved: number;
  skillsRetrieved: number;

  // Stage 3: Prompt assembly
  assembledPrompt: string;
  promptEstimatedTokens: number;
  promptDroppedSections: string[];
  promptTemplatesIncluded: number;
  promptTemplatesDropped: number;

  // Stage 4: Inference
  rawModelOutput: string;
  inferenceTimeMs: number;

  // Stage 5: Validation
  jsonParseSuccess: boolean;
  parsedActionCount: number;
  actionValidations: ActionValidationEntry[];
  planValidation: { score: number; issues: string[] } | null;

  // Stage 6: Repair loop
  repairAttempts: RepairAttemptEntry[];

  // Stage 7: Outcome
  outcome: "llm_success" | "repair_success" | "fallback_templates";
  totalTimeMs: number;
  finalActionCount: number;
}

function emptyLog(): PipelineDebugLog {
  return {
    timestamp: new Date().toISOString(),
    normalizedProfile: null,
    retrievalSummary: "",
    templatesRetrieved: 0,
    skillsRetrieved: 0,
    assembledPrompt: "",
    promptEstimatedTokens: 0,
    promptDroppedSections: [],
    promptTemplatesIncluded: 0,
    promptTemplatesDropped: 0,
    rawModelOutput: "",
    inferenceTimeMs: 0,
    jsonParseSuccess: false,
    parsedActionCount: 0,
    actionValidations: [],
    planValidation: null,
    repairAttempts: [],
    outcome: "fallback_templates",
    totalTimeMs: 0,
    finalActionCount: 0,
  };
}

/**
 * Structured debug logger for the SMART planner pipeline.
 * All methods are no-ops when `enabled` is false.
 */
export class PipelineDebugLogger {
  private enabled: boolean;
  private log: PipelineDebugLog;

  constructor(enabled: boolean) {
    this.enabled = enabled;
    this.log = emptyLog();
  }

  logProfile(profile: UserProfile): void {
    if (!this.enabled) return;
    this.log.normalizedProfile = profile;
  }

  logRetrieval(summary: string, templateCount: number, skillCount: number): void {
    if (!this.enabled) return;
    this.log.retrievalSummary = summary;
    this.log.templatesRetrieved = templateCount;
    this.log.skillsRetrieved = skillCount;
  }

  logPrompt(prompt: AssembledPrompt): void {
    if (!this.enabled) return;
    this.log.assembledPrompt = prompt.text;
    this.log.promptEstimatedTokens = prompt.estimated_tokens;
    this.log.promptDroppedSections = prompt.metadata.dropped_sections;
    this.log.promptTemplatesIncluded = prompt.metadata.templates_included_count;
    this.log.promptTemplatesDropped = prompt.metadata.templates_dropped_count;
  }

  logRawOutput(output: string, timeMs: number): void {
    if (!this.enabled) return;
    this.log.rawModelOutput = output;
    this.log.inferenceTimeMs = timeMs;
  }

  logJsonParse(success: boolean, actionCount: number): void {
    if (!this.enabled) return;
    this.log.jsonParseSuccess = success;
    this.log.parsedActionCount = actionCount;
  }

  logActionValidation(entry: ActionValidationEntry): void {
    if (!this.enabled) return;
    this.log.actionValidations.push(entry);
  }

  logPlanValidation(score: number, issues: string[]): void {
    if (!this.enabled) return;
    this.log.planValidation = { score, issues };
  }

  logRepairAttempt(entry: RepairAttemptEntry): void {
    if (!this.enabled) return;
    this.log.repairAttempts.push(entry);
  }

  logOutcome(
    outcome: PipelineDebugLog["outcome"],
    totalTimeMs: number,
    finalActionCount: number,
  ): void {
    if (!this.enabled) return;
    this.log.outcome = outcome;
    this.log.totalTimeMs = totalTimeMs;
    this.log.finalActionCount = finalActionCount;
  }

  /**
   * Emit the full trace to the console and return the log object.
   * Returns null when disabled.
   */
  flush(): PipelineDebugLog | null {
    if (!this.enabled) return null;

    try {
      _group("[smart-planner] Pipeline Debug");

      _log("Profile:", this.log.normalizedProfile);
      _log(
        "Retrieval:",
        this.log.retrievalSummary,
        `(${this.log.templatesRetrieved} templates, ${this.log.skillsRetrieved} skills)`,
      );

      _group("Assembled Prompt");
      _log(this.log.assembledPrompt);
      _log("Estimated tokens:", this.log.promptEstimatedTokens);
      _log("Dropped sections:", this.log.promptDroppedSections);
      _log(
        `Templates: ${this.log.promptTemplatesIncluded} included, ${this.log.promptTemplatesDropped} dropped`,
      );
      _groupEnd();

      _group("Raw Model Output");
      _log(this.log.rawModelOutput);
      _log(`Inference time: ${this.log.inferenceTimeMs.toFixed(0)}ms`);
      _groupEnd();

      _log(
        "JSON Parse:",
        this.log.jsonParseSuccess ? "OK" : "FAILED",
        `(${this.log.parsedActionCount} actions)`,
      );

      if (this.log.actionValidations.length > 0) {
        _group(`Action Validations (${this.log.actionValidations.length})`);
        for (const v of this.log.actionValidations) {
          const status = v.passed ? "PASS" : v.repaired ? "REPAIRED" : "FAIL";
          _log(
            `[${status}] score=${v.score}`,
            truncate(v.actionText, 80),
            v.criteria,
          );
        }
        _groupEnd();
      }

      if (this.log.planValidation) {
        _log(
          "Plan Validation:",
          `score=${this.log.planValidation.score}`,
          this.log.planValidation.issues,
        );
      }

      if (this.log.repairAttempts.length > 0) {
        _group(`Repair Attempts (${this.log.repairAttempts.length})`);
        for (const r of this.log.repairAttempts) {
          _log(
            `Attempt ${r.attempt}: temp=${r.temperature}`,
            `json=${r.jsonParseSuccess ? "OK" : "FAIL"}`,
            `actions=${r.parsedActionCount}`,
            `time=${r.timeMs.toFixed(0)}ms`,
            r.validationOutcome,
          );
          _log("Raw output:", r.rawOutput);
        }
        _groupEnd();
      }

      _log(
        "Outcome:",
        this.log.outcome,
        `| ${this.log.finalActionCount} actions`,
        `| ${this.log.totalTimeMs.toFixed(0)}ms total`,
      );

      _groupEnd();
    } catch {
      // Never let debug logging break the pipeline
    }

    return this.log;
  }
}

function truncate(text: string, maxLen: number): string {
  return text.length <= maxLen ? text : text.slice(0, maxLen) + "...";
}
