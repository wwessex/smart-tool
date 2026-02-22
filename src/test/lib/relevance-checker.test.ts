import { describe, it, expect, beforeEach } from "vitest";
import { clearSmartCache } from "@/lib/smart-checker";
import {
  checkActionRelevance,
  rankActionsByRelevance,
} from "@/lib/relevance-checker";

describe("relevance-checker", () => {
  beforeEach(() => {
    clearSmartCache();
  });

  describe("checkActionRelevance", () => {
    it("marks a well-formed CV action as relevant", () => {
      const action =
        "Sarah will rewrite her personal statement and tailor her CV to warehouse roles by 20-Feb-26.";
      const result = checkActionRelevance(action, "CV", "Sarah", "2 weeks");

      expect(result.isRelevant).toBe(true);
      expect(result.barrierAligned).toBe(true);
      expect(result.isGeneric).toBe(false);
      expect(result.relevanceScore).toBeGreaterThan(0.5);
    });

    it("marks a generic action as not relevant", () => {
      const action = "Keep trying to improve things.";
      const result = checkActionRelevance(action, "CV");

      expect(result.isRelevant).toBe(false);
      expect(result.isGeneric).toBe(true);
      expect(result.reason).toContain("generic");
    });

    it("flags actions that do not address the barrier", () => {
      // Action about transport when barrier is CV
      const action =
        "John will research bus routes to the industrial estate and plan travel times by 15-Mar-26.";
      const result = checkActionRelevance(action, "CV", "John");

      expect(result.barrierAligned).toBe(false);
      expect(result.relevanceScore).toBeLessThan(0.7);
    });

    it("recognises confidence barrier actions", () => {
      const action =
        "Emma has agreed to complete two mock interviews with advisor support by 10-Mar-26.";
      const result = checkActionRelevance(
        action,
        "Confidence",
        "Emma",
        "2 weeks",
      );

      expect(result.barrierAligned).toBe(true);
      expect(result.isRelevant).toBe(true);
    });

    it("recognises transport barrier actions", () => {
      const action =
        "James will research and save a reliable bus route to the job centre by 20-Mar-26.";
      const result = checkActionRelevance(
        action,
        "Transport",
        "James",
        "2 weeks",
      );

      expect(result.barrierAligned).toBe(true);
      expect(result.isRelevant).toBe(true);
    });

    it("flags very short actions as generic", () => {
      const action = "Apply for jobs.";
      const result = checkActionRelevance(action, "Job Search");

      expect(result.isGeneric).toBe(true);
    });

    it("returns a reason when not relevant", () => {
      const action = "Do something about the problem.";
      const result = checkActionRelevance(action, "Housing");

      expect(result.isRelevant).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe("rankActionsByRelevance", () => {
    it("returns single action unchanged", () => {
      const actions = [{ action: "Submit CV by Friday" }];
      const ranked = rankActionsByRelevance(actions, "CV");
      expect(ranked).toEqual(actions);
    });

    it("puts relevant actions before irrelevant ones", () => {
      const actions = [
        { action: "Think about doing something.", id: "generic" },
        {
          action:
            "Sarah will rewrite her personal statement and tailor her CV to care roles, sending it to advisor by 20-Feb-26.",
          id: "relevant",
        },
      ];

      const ranked = rankActionsByRelevance(
        actions,
        "CV",
        "Sarah",
        "2 weeks",
      );

      expect(ranked[0].id).toBe("relevant");
    });

    it("ranks higher-relevance actions first among relevant ones", () => {
      const actions = [
        {
          action:
            "Mark will attend a workshop at the job centre by 15-Mar-26.",
          id: "medium",
        },
        {
          action:
            "Mark has agreed to update his CV with two STAR examples and send the draft to advisor by 15-Mar-26.",
          id: "high",
        },
      ];

      const ranked = rankActionsByRelevance(actions, "CV", "Mark", "2 weeks");

      // The one with more CV-specific content should rank higher
      expect(ranked[0].id).toBe("high");
    });

    it("returns empty array for empty input", () => {
      expect(rankActionsByRelevance([], "CV")).toEqual([]);
    });
  });
});
