import { describe, it, expect } from "vitest";
import {
  retrieveExemplars,
  formatExemplarsForPrompt,
  computeAcceptanceRates,
  getCategoryAcceptanceRate,
  computeFeedbackQuality,
} from "@/lib/smart-retrieval";
import type { ActionFeedback } from "@/hooks/useSmartStorage";

function makeFeedback(overrides: Partial<ActionFeedback> = {}): ActionFeedback {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    barrier: "CV",
    category: "job-search",
    generatedAction: "Update your CV by next week.",
    rating: null,
    acceptedAsIs: false,
    source: "ai",
    forename: "Test",
    timescale: "2 weeks",
    ...overrides,
  };
}

describe("smart-retrieval", () => {
  describe("computeFeedbackQuality", () => {
    it("scores 1.0 for rated relevant + accepted as-is", () => {
      const fb = makeFeedback({ rating: "relevant", acceptedAsIs: true });
      expect(computeFeedbackQuality(fb)).toBe(1.0);
    });

    it("scores 0.9 for rated relevant + edited", () => {
      const fb = makeFeedback({
        rating: "relevant",
        editedAction: "Rewrite CV personal statement by Friday",
      });
      expect(computeFeedbackQuality(fb)).toBe(0.9);
    });

    it("scores 0.8 for rated relevant only", () => {
      const fb = makeFeedback({ rating: "relevant" });
      expect(computeFeedbackQuality(fb)).toBe(0.8);
    });

    it("scores 0.6 for accepted as-is without rating", () => {
      const fb = makeFeedback({ acceptedAsIs: true });
      expect(computeFeedbackQuality(fb)).toBe(0.6);
    });

    it("scores 0.4 for edited without rating", () => {
      const fb = makeFeedback({ editedAction: "Better action text" });
      expect(computeFeedbackQuality(fb)).toBe(0.4);
    });

    it("scores 0 for no rating, not accepted, not edited", () => {
      const fb = makeFeedback({});
      expect(computeFeedbackQuality(fb)).toBe(0);
    });

    it("scores -1 for not-relevant rating", () => {
      const fb = makeFeedback({ rating: "not-relevant" });
      expect(computeFeedbackQuality(fb)).toBe(-1);
    });
  });

  describe("computeAcceptanceRates", () => {
    it("returns empty array for empty store", () => {
      expect(computeAcceptanceRates([])).toEqual([]);
    });

    it("computes correct rates for a single category", () => {
      const store: ActionFeedback[] = [
        makeFeedback({ rating: "relevant", acceptedAsIs: true }),
        makeFeedback({ rating: "relevant", editedAction: "edited" }),
        makeFeedback({ rating: "not-relevant" }),
        makeFeedback({}), // no rating, not accepted
      ];

      const rates = computeAcceptanceRates(store);
      expect(rates).toHaveLength(1);
      expect(rates[0].category).toBe("job-search");
      expect(rates[0].total).toBe(4);
      expect(rates[0].accepted).toBe(2);
      expect(rates[0].rejected).toBe(1);
      expect(rates[0].edited).toBe(1);
      expect(rates[0].acceptanceRate).toBe(0.5);
    });

    it("separates multiple categories", () => {
      const store: ActionFeedback[] = [
        makeFeedback({ barrier: "CV", category: "job-search", rating: "relevant" }),
        makeFeedback({ barrier: "Confidence", category: "confidence", acceptedAsIs: true }),
      ];

      const rates = computeAcceptanceRates(store);
      expect(rates).toHaveLength(2);
      const jobSearch = rates.find(r => r.category === "job-search");
      const confidence = rates.find(r => r.category === "confidence");
      expect(jobSearch?.accepted).toBe(1);
      expect(confidence?.accepted).toBe(1);
    });
  });

  describe("getCategoryAcceptanceRate", () => {
    it("returns null for unknown category", () => {
      const result = getCategoryAcceptanceRate([], "nonexistent");
      expect(result).toBeNull();
    });

    it("returns rate for known category", () => {
      const store: ActionFeedback[] = [
        makeFeedback({ rating: "relevant", acceptedAsIs: true }),
        makeFeedback({ rating: "not-relevant" }),
      ];

      const result = getCategoryAcceptanceRate(store, "job-search");
      expect(result).not.toBeNull();
      expect(result!.acceptanceRate).toBe(0.5);
    });
  });

  describe("retrieveExemplars", () => {
    it("returns empty for empty barrier", () => {
      expect(retrieveExemplars("", [])).toEqual([]);
      expect(retrieveExemplars("  ", [])).toEqual([]);
    });

    it("returns curated exemplars for known barrier", () => {
      const results = retrieveExemplars("CV", []);
      expect(results.length).toBeGreaterThan(0);
      // Should have library exemplars for CV
      expect(results.some(r => r.source === "library")).toBe(true);
    });

    it("prioritises high-quality feedback over low-quality", () => {
      const goldFeedback = makeFeedback({
        barrier: "CV",
        category: "job-search",
        rating: "relevant",
        acceptedAsIs: true,
        generatedAction: "Rewrite personal statement and tailor CV to warehouse role by Friday",
      });

      const weakFeedback = makeFeedback({
        barrier: "CV",
        category: "job-search",
        rating: null,
        acceptedAsIs: false,
        // No editedAction, no rating, not accepted — quality = 0, excluded
      });

      // Gold feedback should appear; weak feedback should be excluded (quality = 0)
      const results = retrieveExemplars("CV", [goldFeedback, weakFeedback]);
      const feedbackResults = results.filter(r => r.source === "feedback");
      // Gold feedback included (quality > 0), weak excluded (quality = 0)
      expect(feedbackResults.length).toBe(1);
      expect(feedbackResults[0].action).toContain("Rewrite personal statement");
    });

    it("excludes not-relevant feedback", () => {
      const rejectedFeedback = makeFeedback({
        barrier: "CV",
        rating: "not-relevant",
        generatedAction: "Some rejected action",
      });

      const results = retrieveExemplars("CV", [rejectedFeedback]);
      const feedbackResults = results.filter(r => r.source === "feedback");
      expect(feedbackResults).toHaveLength(0);
    });

    it("uses edited action over generated when available", () => {
      const fb = makeFeedback({
        barrier: "CV",
        rating: "relevant",
        acceptedAsIs: false,
        generatedAction: "Original generated text",
        editedAction: "Better edited text for CV improvement",
      });

      const results = retrieveExemplars("CV", [fb]);
      const feedbackResults = results.filter(r => r.source === "feedback");
      expect(feedbackResults.length).toBe(1);
      expect(feedbackResults[0].action).toBe("Better edited text for CV improvement");
    });

    it("respects maxResults limit", () => {
      const results = retrieveExemplars("CV", [], 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe("formatExemplarsForPrompt", () => {
    it("returns empty string for no examples", () => {
      expect(formatExemplarsForPrompt([], "John", "15-Jan-26")).toBe("");
    });

    it("replaces placeholders in exemplar text", () => {
      const examples = [
        {
          action: "{forename} will update CV by {targetDate}",
          help: "improve job applications",
          barrier: "CV",
          source: "library" as const,
          score: 10,
        },
      ];

      const result = formatExemplarsForPrompt(examples, "Sarah", "20-Feb-26");
      expect(result).toContain("Sarah will update CV by 20-Feb-26");
      expect(result).toContain("SIMILAR SUCCESSFUL ACTIONS");
    });
  });
});
