import { describe, it, expect } from "vitest";
import {
  sanitizeActionPhrase,
  sanitizeOneSentence,
  sanitizeOnePhrase,
  buildDraftActionPrompt,
  buildDraftHelpPrompt,
  buildDraftOutcomePrompt,
  DEFAULT_PROMPT_PACK,
} from "@/lib/prompt-pack";

describe("prompt-pack", () => {
  describe("sanitizeActionPhrase", () => {
    it("strips trailing punctuation from action text", () => {
      const result = sanitizeActionPhrase("upload a CV to Indeed by 25-Jan-26.", "Alex");
      expect(result).toBe("upload a CV to Indeed by 25-Jan-26");
    });

    it("removes leading name-will pattern", () => {
      const result = sanitizeActionPhrase("Alex will upload a CV to Indeed", "Alex");
      expect(result).toBe("upload a CV to Indeed");
    });

    it("removes assistant prefix", () => {
      const result = sanitizeActionPhrase("assistant: upload a CV to Indeed", "Alex");
      expect(result).toBe("upload a CV to Indeed");
    });

    it("removes 'as discussed and agreed' scaffolding", () => {
      const result = sanitizeActionPhrase(
        "As discussed and agreed, upload a CV to Indeed by 25-Jan-26",
        "Alex"
      );
      expect(result).toBe("upload a CV to Indeed by 25-Jan-26");
    });

    it("returns empty string for very short output", () => {
      expect(sanitizeActionPhrase("ok", "Alex")).toBe("");
    });

    it("returns empty string for non-text garbage", () => {
      expect(sanitizeActionPhrase("1.", "Alex")).toBe("");
    });

    it("lowercases the first character", () => {
      const result = sanitizeActionPhrase("Upload a CV to Indeed by 25-Jan-26", "Alex");
      expect(result.charAt(0)).toBe("u");
    });

    it("does not throw on empty input", () => {
      expect(() => sanitizeActionPhrase("", "Alex")).not.toThrow();
      expect(sanitizeActionPhrase("", "Alex")).toBe("");
    });

    it("does not throw on undefined-like input", () => {
      expect(() => sanitizeActionPhrase(null as unknown as string, "Alex")).not.toThrow();
    });

    it("extracts phrase after 'will' when model includes it", () => {
      const result = sanitizeActionPhrase("will attend a job fair by 10-Feb-26", "Alex");
      expect(result).toBe("attend a job fair by 10-Feb-26");
    });
  });

  describe("buildDraftActionPrompt", () => {
    it("does not throw when barrier matches a few-shot example", () => {
      // This is the exact path that threw ReferenceError before the fix:
      // buildDraftActionPrompt -> pickFewShot (matches) -> toActionPhrase -> stripTrailingPunctuation
      expect(() =>
        buildDraftActionPrompt(DEFAULT_PROMPT_PACK, {
          forename: "Alex",
          barrier: "Transport",
          targetDate: "25-Jan-26",
          targetTime: "",
          responsible: "Advisor",
        })
      ).not.toThrow();
    });

    it("does not throw when barrier does not match few-shot examples", () => {
      expect(() =>
        buildDraftActionPrompt(DEFAULT_PROMPT_PACK, {
          forename: "Alex",
          barrier: "Childcare",
          targetDate: "25-Jan-26",
          targetTime: "",
          responsible: "Advisor",
        })
      ).not.toThrow();
    });

    it("returns a prompt containing the barrier and deadline", () => {
      const result = buildDraftActionPrompt(DEFAULT_PROMPT_PACK, {
        forename: "Alex",
        barrier: "Transport",
        targetDate: "25-Jan-26",
        responsible: "Advisor",
      });
      expect(result).toContain("Transport");
      expect(result).toContain("25-Jan-26");
    });

    it("includes example block for matching barriers", () => {
      const result = buildDraftActionPrompt(DEFAULT_PROMPT_PACK, {
        forename: "Alex",
        barrier: "Transport",
        targetDate: "25-Jan-26",
        responsible: "Advisor",
      });
      expect(result).toContain("EXAMPLE");
    });
  });

  describe("buildDraftHelpPrompt", () => {
    it("includes the action in the prompt", () => {
      const result = buildDraftHelpPrompt(DEFAULT_PROMPT_PACK, {
        action: "upload a CV to Indeed",
        subject: "Alex",
      });
      expect(result).toContain("upload a CV to Indeed");
    });
  });

  describe("buildDraftOutcomePrompt", () => {
    it("includes the forename and task", () => {
      const result = buildDraftOutcomePrompt(DEFAULT_PROMPT_PACK, {
        forename: "Alex",
        task: "Job fair",
      });
      expect(result).toContain("Alex");
      expect(result).toContain("Job fair");
    });
  });

  describe("sanitizeOneSentence", () => {
    it("adds trailing period if missing", () => {
      const result = sanitizeOneSentence("Alex will attend a job fair");
      expect(result).toMatch(/\.$/);
    });

    it("keeps existing trailing punctuation", () => {
      expect(sanitizeOneSentence("Done!")).toBe("Done!");
      expect(sanitizeOneSentence("Really?")).toBe("Really?");
    });
  });

  describe("sanitizeOnePhrase", () => {
    it("removes trailing punctuation", () => {
      const result = sanitizeOnePhrase("increase job applications.");
      expect(result).toBe("increase job applications");
    });

    it("strips 'this will help' prefix", () => {
      const result = sanitizeOnePhrase("This will help increase confidence");
      expect(result).toBe("increase confidence");
    });

    it("de-duplicates repeated phrases", () => {
      const result = sanitizeOnePhrase("upload a CV by Friday upload a CV by Friday");
      expect(result).toBe("upload a CV by Friday");
    });
  });
});
