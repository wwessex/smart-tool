/**
 * Pipeline debug logger for the SMART action planner.
 *
 * Captures a structured trace of each `generatePlan` call:
 * assembled prompt, raw model output, per-action validation,
 * repair loop details, and stage timing.
 *
 * Activated via `debug: true` in PlannerConfig. All methods are
 * no-ops when disabled — zero overhead in production.
 */

import type { UserProfile, SMARTCriteriaResult } from "../types.js";
import type { AssembledPrompt } from "../planner/prompt-assembler.js";

/** Per-action validation detail captured during pipeline execution. */
export interface ActionValidationEntry {
  actionText: string;
  score: number;
  criteria: Record<string, { passed: boolean; score: number; reason: string }>;
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
      console.groupCollapsed("[smart-planner] Pipeline Debug");

      console.debug("Profile:", this.log.normalizedProfile);
      console.debug(
        "Retrieval:",
        this.log.retrievalSummary,
        `(${this.log.templatesRetrieved} templates, ${this.log.skillsRetrieved} skills)`,
      );

      console.groupCollapsed("Assembled Prompt");
      console.debug(this.log.assembledPrompt);
      console.debug("Estimated tokens:", this.log.promptEstimatedTokens);
      console.debug("Dropped sections:", this.log.promptDroppedSections);
      console.debug(
        `Templates: ${this.log.promptTemplatesIncluded} included, ${this.log.promptTemplatesDropped} dropped`,
      );
      console.groupEnd();

      console.groupCollapsed("Raw Model Output");
      console.debug(this.log.rawModelOutput);
      console.debug(`Inference time: ${this.log.inferenceTimeMs.toFixed(0)}ms`);
      console.groupEnd();

      console.debug(
        "JSON Parse:",
        this.log.jsonParseSuccess ? "OK" : "FAILED",
        `(${this.log.parsedActionCount} actions)`,
      );

      if (this.log.actionValidations.length > 0) {
        console.groupCollapsed(`Action Validations (${this.log.actionValidations.length})`);
        for (const v of this.log.actionValidations) {
          const status = v.passed ? "PASS" : v.repaired ? "REPAIRED" : "FAIL";
          console.debug(
            `[${status}] score=${v.score}`,
            truncate(v.actionText, 80),
            v.criteria,
          );
        }
        console.groupEnd();
      }

      if (this.log.planValidation) {
        console.debug(
          "Plan Validation:",
          `score=${this.log.planValidation.score}`,
          this.log.planValidation.issues,
        );
      }

      if (this.log.repairAttempts.length > 0) {
        console.groupCollapsed(`Repair Attempts (${this.log.repairAttempts.length})`);
        for (const r of this.log.repairAttempts) {
          console.debug(
            `Attempt ${r.attempt}: temp=${r.temperature}`,
            `json=${r.jsonParseSuccess ? "OK" : "FAIL"}`,
            `actions=${r.parsedActionCount}`,
            `time=${r.timeMs.toFixed(0)}ms`,
            r.validationOutcome,
          );
          console.debug("Raw output:", r.rawOutput);
        }
        console.groupEnd();
      }

      console.debug(
        "Outcome:",
        this.log.outcome,
        `| ${this.log.finalActionCount} actions`,
        `| ${this.log.totalTimeMs.toFixed(0)}ms total`,
      );

      console.groupEnd();
    } catch {
      // Never let debug logging break the pipeline
    }

    return this.log;
  }
}

function truncate(text: string, maxLen: number): string {
  return text.length <= maxLen ? text : text.slice(0, maxLen) + "...";
}
