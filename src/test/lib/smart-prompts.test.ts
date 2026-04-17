import { describe, it, expect } from "vitest";
import {
  IMPROVE_PROMPT,
  FIX_CRITERION_PROMPT,
  CRITERION_GUIDANCE,
  WIZARD_PROMPTS,
  DRAFT_ACTION_PROMPT,
  DRAFT_ACTION_PROMPT_COMPACT,
  DRAFT_HELP_PROMPT,
  DRAFT_HELP_PROMPT_COMPACT,
  DRAFT_OUTCOME_PROMPT,
  DRAFT_OUTCOME_PROMPT_COMPACT,
  getPromptForModel,
  getHelpSubject,
} from "@/lib/smart-prompts";

describe("smart-prompts", () => {
  describe("getPromptForModel", () => {
    it("returns full action prompt by default", () => {
      const prompt = getPromptForModel("action");
      expect(prompt).toBe(DRAFT_ACTION_PROMPT);
    });

    it("returns compact action prompt for 35m model", () => {
      const prompt = getPromptForModel("action", "model-35m-v1");
      expect(prompt).toBe(DRAFT_ACTION_PROMPT_COMPACT);
    });

    it("returns compact prompt when isCompact is true", () => {
      const prompt = getPromptForModel("action", undefined, true);
      expect(prompt).toBe(DRAFT_ACTION_PROMPT_COMPACT);
    });

    it("returns full help prompt by default", () => {
      const prompt = getPromptForModel("help");
      expect(prompt).toBe(DRAFT_HELP_PROMPT);
    });

    it("returns compact help prompt for small models", () => {
      const prompt = getPromptForModel("help", "tiny-35m", true);
      expect(prompt).toBe(DRAFT_HELP_PROMPT_COMPACT);
    });

    it("returns full outcome prompt by default", () => {
      const prompt = getPromptForModel("outcome");
      expect(prompt).toBe(DRAFT_OUTCOME_PROMPT);
    });

    it("returns compact outcome prompt when compact", () => {
      const prompt = getPromptForModel("outcome", undefined, true);
      expect(prompt).toBe(DRAFT_OUTCOME_PROMPT_COMPACT);
    });

    it("returns full action prompt for larger models", () => {
      const prompt = getPromptForModel("action", "model-350m-v2");
      expect(prompt).toBe(DRAFT_ACTION_PROMPT);
    });

    it("falls back to action prompt for unknown prompt type", () => {
      const prompt = getPromptForModel("unknown" as "action");
      expect(prompt).toBe(DRAFT_ACTION_PROMPT);
    });
  });

  describe("getHelpSubject", () => {
    it("returns 'me' when responsible is 'I'", () => {
      expect(getHelpSubject("John", "I")).toBe("me");
    });

    it("returns 'me' when responsible is 'i' (case insensitive)", () => {
      expect(getHelpSubject("John", "i")).toBe("me");
    });

    it("returns 'me' for 'I' with whitespace", () => {
      expect(getHelpSubject("John", "  I  ")).toBe("me");
    });

    it("returns the forename for other responsible values", () => {
      expect(getHelpSubject("John", "Advisor")).toBe("John");
      expect(getHelpSubject("Sarah", "Participant")).toBe("Sarah");
    });
  });

  describe("prompt templates", () => {
    it("IMPROVE_PROMPT contains required placeholders", () => {
      expect(IMPROVE_PROMPT).toContain("{action}");
      expect(IMPROVE_PROMPT).toContain("{barrier}");
      expect(IMPROVE_PROMPT).toContain("{forename}");
      expect(IMPROVE_PROMPT).toContain("{score}");
      expect(IMPROVE_PROMPT).toContain("{unmetCriteria}");
    });

    it("FIX_CRITERION_PROMPT contains required placeholders", () => {
      expect(FIX_CRITERION_PROMPT).toContain("{criterion}");
      expect(FIX_CRITERION_PROMPT).toContain("{action}");
      expect(FIX_CRITERION_PROMPT).toContain("{barrier}");
      expect(FIX_CRITERION_PROMPT).toContain("{forename}");
      expect(FIX_CRITERION_PROMPT).toContain("{criterionGuidance}");
    });

    it("DRAFT_ACTION_PROMPT contains required placeholders", () => {
      expect(DRAFT_ACTION_PROMPT).toContain("{forename}");
      expect(DRAFT_ACTION_PROMPT).toContain("{barrier}");
      expect(DRAFT_ACTION_PROMPT).toContain("{targetDate}");
      expect(DRAFT_ACTION_PROMPT).toContain("{exemplars}");
    });

    it("DRAFT_HELP_PROMPT contains subject placeholder", () => {
      expect(DRAFT_HELP_PROMPT).toContain("{subject}");
      expect(DRAFT_HELP_PROMPT).toContain("{action}");
    });

    it("DRAFT_OUTCOME_PROMPT contains required placeholders", () => {
      expect(DRAFT_OUTCOME_PROMPT).toContain("{forename}");
      expect(DRAFT_OUTCOME_PROMPT).toContain("{task}");
    });
  });

  describe("CRITERION_GUIDANCE", () => {
    it("provides guidance for all 5 SMART criteria", () => {
      expect(CRITERION_GUIDANCE).toHaveProperty("specific");
      expect(CRITERION_GUIDANCE).toHaveProperty("measurable");
      expect(CRITERION_GUIDANCE).toHaveProperty("achievable");
      expect(CRITERION_GUIDANCE).toHaveProperty("relevant");
      expect(CRITERION_GUIDANCE).toHaveProperty("timeBound");
    });

    it("each guidance contains actionable instructions", () => {
      for (const [, guidance] of Object.entries(CRITERION_GUIDANCE)) {
        expect(guidance.length).toBeGreaterThan(50);
        expect(guidance).toContain("Example:");
      }
    });
  });

  describe("WIZARD_PROMPTS", () => {
    it("has prompts for 'now' mode with all required fields", () => {
      expect(WIZARD_PROMPTS.now).toHaveProperty("who");
      expect(WIZARD_PROMPTS.now).toHaveProperty("barrier");
      expect(WIZARD_PROMPTS.now).toHaveProperty("what");
      expect(WIZARD_PROMPTS.now).toHaveProperty("responsible");
      expect(WIZARD_PROMPTS.now).toHaveProperty("help");
      expect(WIZARD_PROMPTS.now).toHaveProperty("when");
    });

    it("has prompts for 'future' mode with all required fields", () => {
      expect(WIZARD_PROMPTS.future).toHaveProperty("who");
      expect(WIZARD_PROMPTS.future).toHaveProperty("task");
      expect(WIZARD_PROMPTS.future).toHaveProperty("outcome");
      expect(WIZARD_PROMPTS.future).toHaveProperty("when");
    });
  });
});
