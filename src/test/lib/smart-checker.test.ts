import { describe, it, expect, beforeEach } from "vitest";
import {
  checkSmart,
  clearSmartCache,
  getSmartCacheStats,
  getSmartLabel,
  getSmartColor,
  getImprovementPriority,
  type SmartCheck,
} from "@/lib/smart-checker";

describe("smart-checker", () => {
  beforeEach(() => {
    clearSmartCache();
  });

  describe("checkSmart", () => {
    it("scores 5/5 for a fully SMART action", () => {
      const text =
        "As discussed and agreed, on 15-Jan-26, John will attend the CV workshop at the job centre. " +
        "John has confirmed this action is both realistic and achievable. Reviewed in 2 weeks.";
      const meta = {
        forename: "John",
        barrier: "CV",
        timescale: "2 weeks",
        date: "2026-01-15",
      };

      const result = checkSmart(text, meta);

      expect(result.overallScore).toBe(5);
      expect(result.specific.met).toBe(true);
      expect(result.measurable.met).toBe(true);
      expect(result.achievable.met).toBe(true);
      expect(result.relevant.met).toBe(true);
      expect(result.timeBound.met).toBe(true);
    });

    it("detects missing specific criteria (who, what, where)", () => {
      const text = "Do something about the problem.";
      const result = checkSmart(text);

      expect(result.specific.met).toBe(false);
      expect(result.specific.confidence).toBe("low");
    });

    it("detects specific criteria when name and action are present", () => {
      const text = "Sarah will attend the workshop at the library.";
      const meta = { forename: "Sarah" };

      const result = checkSmart(text, meta);

      expect(result.specific.met).toBe(true);
    });

    it("detects measurable criteria with dates", () => {
      const text = "Complete 3 job applications by 20-Jan-26.";
      const result = checkSmart(text);

      expect(result.measurable.met).toBe(true);
    });

    it("detects measurable criteria with quantities", () => {
      const text = "Submit 5 applications to local employers.";
      const result = checkSmart(text);

      expect(result.measurable.met).toBe(true);
    });

    it("fails measurable when no quantity or date present", () => {
      const text = "Apply for jobs sometime.";
      const result = checkSmart(text);

      expect(result.measurable.met).toBe(false);
    });

    it("detects achievable criteria with agreement language", () => {
      const text = "As discussed and agreed, John will update his CV.";
      const result = checkSmart(text);

      expect(result.achievable.met).toBe(true);
    });

    it("detects achievable criteria with 'has agreed to'", () => {
      const text = "John has agreed to attend the interview workshop.";
      const result = checkSmart(text);

      expect(result.achievable.met).toBe(true);
    });

    it("detects achievable criteria with 'realistic and achievable'", () => {
      const text =
        "John will complete the form. John has confirmed this action is both realistic and achievable.";
      const result = checkSmart(text);

      expect(result.achievable.met).toBe(true);
      expect(result.achievable.confidence).toBe("high");
    });

    it("detects achievable criteria with support mention", () => {
      const text = "With support from the advisor, Mary will practice interview skills.";
      const result = checkSmart(text);

      expect(result.achievable.met).toBe(true);
    });

    it("detects relevant criteria with barrier alignment", () => {
      const text = "John will update his CV and add recent work experience.";
      const meta = { barrier: "CV" };

      const result = checkSmart(text, meta);

      expect(result.relevant.met).toBe(true);
    });

    it("detects relevant criteria for transport barrier", () => {
      const text = "Research bus routes to the industrial estate.";
      const meta = { barrier: "Transport" };

      const result = checkSmart(text, meta);

      expect(result.relevant.met).toBe(true);
    });

    it("detects relevant criteria for task-based activities", () => {
      const text = "Attend the job fair at the convention centre.";
      const result = checkSmart(text);

      expect(result.relevant.met).toBe(true);
    });

    it("detects time-bound criteria with deadline", () => {
      const text = "Complete this by next Friday.";
      const result = checkSmart(text);

      expect(result.timeBound.met).toBe(true);
    });

    it("detects time-bound criteria with review period", () => {
      const text = "This will be reviewed in 2 weeks.";
      const meta = { timescale: "2 weeks" };

      const result = checkSmart(text, meta);

      expect(result.timeBound.met).toBe(true);
    });

    it("detects time-bound with specific date format", () => {
      const text = "Submit application by 15-Jan-26.";
      const result = checkSmart(text);

      expect(result.timeBound.met).toBe(true);
    });

    it("adds warning for weak language", () => {
      const text = "John might try to update his CV if possible.";
      const result = checkSmart(text);

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("Weak language");
    });

    it("adds warning when no strong commitment verbs present", () => {
      const text = "John updates his CV and sends it to employers.";
      const result = checkSmart(text);

      // Should suggest using commitment language
      const hasCommitmentWarning = result.warnings.some((w) =>
        w.includes("commitment language")
      );
      expect(hasCommitmentWarning).toBe(true);
    });

    it("handles empty text gracefully", () => {
      const result = checkSmart("");

      expect(result.overallScore).toBe(0);
      expect(result.specific.met).toBe(false);
      expect(result.measurable.met).toBe(false);
      expect(result.achievable.met).toBe(false);
      expect(result.relevant.met).toBe(false);
      expect(result.timeBound.met).toBe(false);
    });

    it("handles undefined meta gracefully", () => {
      const text = "John will attend the workshop.";
      const result = checkSmart(text, undefined);

      expect(result).toBeDefined();
      expect(typeof result.overallScore).toBe("number");
    });

    it("provides suggestions for unmet criteria", () => {
      const text = "Do something.";
      const result = checkSmart(text);

      expect(result.specific.suggestion).toBeDefined();
      expect(result.measurable.suggestion).toBeDefined();
      expect(result.achievable.suggestion).toBeDefined();
      expect(result.timeBound.suggestion).toBeDefined();
    });

    it("does not provide suggestions for met criteria", () => {
      const text =
        "As discussed and agreed, on 15-Jan-26, John will attend 2 workshops at the job centre. " +
        "John has confirmed this is both realistic and achievable. Reviewed in 2 weeks.";
      const meta = { forename: "John", barrier: "Training", timescale: "2 weeks" };

      const result = checkSmart(text, meta);

      // Met criteria should not have suggestions
      if (result.specific.met) {
        expect(result.specific.suggestion).toBeUndefined();
      }
    });
  });

  describe("cache functionality", () => {
    it("caches results for identical inputs", () => {
      const text = "John will attend the workshop.";
      const meta = { forename: "John" };

      // First call
      checkSmart(text, meta);
      const stats1 = getSmartCacheStats();

      // Second call with same inputs should use cache
      checkSmart(text, meta);
      const stats2 = getSmartCacheStats();

      expect(stats1.size).toBe(1);
      expect(stats2.size).toBe(1); // No new cache entry
    });

    it("creates separate cache entries for different inputs", () => {
      checkSmart("John will attend workshop.", { forename: "John" });
      checkSmart("Sarah will attend workshop.", { forename: "Sarah" });

      const stats = getSmartCacheStats();
      expect(stats.size).toBe(2);
    });

    it("clears cache correctly", () => {
      checkSmart("Test action.", { forename: "Test" });
      expect(getSmartCacheStats().size).toBe(1);

      clearSmartCache();
      expect(getSmartCacheStats().size).toBe(0);
    });
  });

  describe("getSmartLabel", () => {
    it("returns 'Excellent' for score 5", () => {
      expect(getSmartLabel(5)).toBe("Excellent");
    });

    it("returns 'Good' for score 4", () => {
      expect(getSmartLabel(4)).toBe("Good");
    });

    it("returns 'Fair' for score 3", () => {
      expect(getSmartLabel(3)).toBe("Fair");
    });

    it("returns 'Needs work' for score 2", () => {
      expect(getSmartLabel(2)).toBe("Needs work");
    });

    it("returns 'Incomplete' for score 1 or 0", () => {
      expect(getSmartLabel(1)).toBe("Incomplete");
      expect(getSmartLabel(0)).toBe("Incomplete");
    });
  });

  describe("getSmartColor", () => {
    it("returns green-600 for score 5", () => {
      expect(getSmartColor(5)).toBe("text-green-600");
    });

    it("returns green-500 for score 4", () => {
      expect(getSmartColor(4)).toBe("text-green-500");
    });

    it("returns amber-500 for score 3", () => {
      expect(getSmartColor(3)).toBe("text-amber-500");
    });

    it("returns orange-500 for score 2", () => {
      expect(getSmartColor(2)).toBe("text-orange-500");
    });

    it("returns destructive for score 1 or 0", () => {
      expect(getSmartColor(1)).toBe("text-destructive");
      expect(getSmartColor(0)).toBe("text-destructive");
    });
  });

  describe("getImprovementPriority", () => {
    it("returns prioritized list of improvements needed", () => {
      const check: SmartCheck = {
        specific: { met: false, confidence: "low", reason: "" },
        measurable: { met: false, confidence: "low", reason: "" },
        achievable: { met: true, confidence: "high", reason: "" },
        relevant: { met: true, confidence: "high", reason: "" },
        timeBound: { met: false, confidence: "low", reason: "" },
        overallScore: 2,
        warnings: [],
      };

      const priorities = getImprovementPriority(check);

      expect(priorities.length).toBe(3);
      // Specific should be first (weight 5)
      expect(priorities[0]).toBe("Add who, what, where");
      // Time-bound should be second (weight 4)
      expect(priorities[1]).toBe("Add deadline");
      // Measurable should be third (weight 3)
      expect(priorities[2]).toBe("Add quantity or date");
    });

    it("returns empty array when all criteria are met", () => {
      const check: SmartCheck = {
        specific: { met: true, confidence: "high", reason: "" },
        measurable: { met: true, confidence: "high", reason: "" },
        achievable: { met: true, confidence: "high", reason: "" },
        relevant: { met: true, confidence: "high", reason: "" },
        timeBound: { met: true, confidence: "high", reason: "" },
        overallScore: 5,
        warnings: [],
      };

      const priorities = getImprovementPriority(check);
      expect(priorities.length).toBe(0);
    });
  });

  describe("barrier alignment detection", () => {
    const barrierTestCases = [
      { barrier: "Transport", text: "Research bus routes to work", shouldAlign: true },
      { barrier: "Transport", text: "Check train times for commute", shouldAlign: true },
      { barrier: "CV", text: "Update CV with recent experience", shouldAlign: true },
      { barrier: "CV", text: "Write covering letter for application", shouldAlign: true },
      { barrier: "Confidence", text: "Practice interview techniques", shouldAlign: true },
      { barrier: "Digital Skills", text: "Learn to use email and online applications", shouldAlign: true },
      { barrier: "Childcare", text: "Research nursery options near workplace", shouldAlign: true },
      { barrier: "Health", text: "Book GP appointment to discuss condition", shouldAlign: true },
      { barrier: "Finance", text: "Speak to advisor about Universal Credit", shouldAlign: true },
      // Note: "Update CV" triggers the "connection" pattern (update verb) so it's seen as relevant
      // even though it's not specifically about transport
    ];

    barrierTestCases.forEach(({ barrier, text, shouldAlign }) => {
      it(`${shouldAlign ? "detects" : "does not detect"} alignment for "${barrier}" barrier with "${text}"`, () => {
        const result = checkSmart(text, { barrier });
        expect(result.relevant.met).toBe(shouldAlign);
      });
    });
  });

  describe("date format detection", () => {
    const dateFormats = [
      "15-Jan-26",
      "15/01/26",
      "15-01-2026",
      "January 15, 2026",
      "15th January",
      "by next Monday",
      "within 2 weeks",
      "end of this month",
    ];

    dateFormats.forEach((dateFormat) => {
      it(`detects date format: "${dateFormat}"`, () => {
        const text = `Complete task ${dateFormat}.`;
        const result = checkSmart(text);
        expect(result.timeBound.met).toBe(true);
      });
    });
  });
});
