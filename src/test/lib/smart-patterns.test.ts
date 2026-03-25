import { describe, it, expect } from "vitest";
import {
  ENHANCED_DATE_PATTERN,
  SPECIFIC_PATTERNS,
  MEASURABLE_PATTERNS,
  ACHIEVABLE_PATTERNS,
  RELEVANT_PATTERNS,
  TIMEBOUND_PATTERNS,
  WEAK_PATTERNS,
  STRONG_VERB_PATTERN,
  ACTION_VERBS,
  VAGUE_TERMS,
  BARRIER_KEYWORDS,
} from "@/lib/smart-patterns";

describe("smart-patterns", () => {
  describe("ENHANCED_DATE_PATTERN", () => {
    const dateExamples = [
      "15/01/2026",
      "15-01-2026",
      "15-Jan-2026",
      "15 January 2026",
      "15th January",
      "15th of January",
      "January 15th",
      "Jan 15, 2026",
      "by next Monday",
      "within 2 weeks",
      "within 3 days",
      "end of this week",
      "end of next month",
      "next Friday",
    ];

    dateExamples.forEach((example) => {
      it(`matches date: "${example}"`, () => {
        expect(ENHANCED_DATE_PATTERN.test(example)).toBe(true);
      });
    });

    it("does not match plain text without dates", () => {
      expect(ENHANCED_DATE_PATTERN.test("hello world")).toBe(false);
    });
  });

  describe("SPECIFIC_PATTERNS", () => {
    it("matches who pattern with name and commitment", () => {
      expect(SPECIFIC_PATTERNS.who.test("John will attend")).toBe(true);
      expect(SPECIFIC_PATTERNS.who.test("Sarah has agreed")).toBe(true);
      expect(SPECIFIC_PATTERNS.who.test("participant is going to")).toBe(true);
    });

    it("matches what pattern with will/agreed", () => {
      expect(SPECIFIC_PATTERNS.what.test("will complete the task")).toBe(true);
      expect(SPECIFIC_PATTERNS.what.test("agreed to attend")).toBe(true);
    });

    it("matches where pattern with locations", () => {
      expect(SPECIFIC_PATTERNS.where.test("at the library")).toBe(true);
      expect(SPECIFIC_PATTERNS.where.test("online")).toBe(true);
      expect(SPECIFIC_PATTERNS.where.test("at the jobcentre")).toBe(true);
    });

    it("matches action verbs", () => {
      const verbs = ["apply", "submit", "attend", "complete", "register", "contact", "research"];
      for (const verb of verbs) {
        expect(SPECIFIC_PATTERNS.action.test(verb)).toBe(true);
      }
    });
  });

  describe("MEASURABLE_PATTERNS", () => {
    it("matches quantities", () => {
      expect(MEASURABLE_PATTERNS.quantity.test("5 applications")).toBe(true);
      expect(MEASURABLE_PATTERNS.quantity.test("at least three")).toBe(true);
      expect(MEASURABLE_PATTERNS.quantity.test("multiple employers")).toBe(true);
    });

    it("matches frequency patterns", () => {
      expect(MEASURABLE_PATTERNS.frequency.test("daily")).toBe(true);
      expect(MEASURABLE_PATTERNS.frequency.test("twice per week")).toBe(true);
      expect(MEASURABLE_PATTERNS.frequency.test("every Monday")).toBe(true);
    });

    it("matches targets", () => {
      expect(MEASURABLE_PATTERNS.target.test("3 applications")).toBe(true);
      expect(MEASURABLE_PATTERNS.target.test("2 interviews")).toBe(true);
      expect(MEASURABLE_PATTERNS.target.test("5 employers")).toBe(true);
    });

    it("matches outcomes", () => {
      expect(MEASURABLE_PATTERNS.outcome.test("complete the form")).toBe(true);
      expect(MEASURABLE_PATTERNS.outcome.test("submit application")).toBe(true);
      expect(MEASURABLE_PATTERNS.outcome.test("attend session")).toBe(true);
    });
  });

  describe("ACHIEVABLE_PATTERNS", () => {
    it("matches agreement language", () => {
      expect(ACHIEVABLE_PATTERNS.agreement.test("as discussed and agreed")).toBe(true);
      expect(ACHIEVABLE_PATTERNS.agreement.test("realistic")).toBe(true);
      expect(ACHIEVABLE_PATTERNS.agreement.test("confirmed")).toBe(true);
    });

    it("matches responsibility patterns", () => {
      expect(ACHIEVABLE_PATTERNS.responsibility.test("participant will attend")).toBe(true);
      expect(ACHIEVABLE_PATTERNS.responsibility.test("John has agreed to")).toBe(true);
    });

    it("matches support patterns", () => {
      expect(ACHIEVABLE_PATTERNS.support.test("with support from advisor")).toBe(true);
      expect(ACHIEVABLE_PATTERNS.support.test("help from the team")).toBe(true);
      expect(ACHIEVABLE_PATTERNS.support.test("both realistic and achievable")).toBe(true);
    });

    it("matches has agreed to", () => {
      expect(ACHIEVABLE_PATTERNS.hasAgreedTo.test("has agreed to attend")).toBe(true);
    });

    it("matches realistic and achievable", () => {
      expect(ACHIEVABLE_PATTERNS.realisticAchievable.test("realistic and achievable")).toBe(true);
      expect(ACHIEVABLE_PATTERNS.realisticAchievable.test("is achievable")).toBe(true);
    });
  });

  describe("RELEVANT_PATTERNS", () => {
    it("matches barrier terms", () => {
      expect(RELEVANT_PATTERNS.barrier.test("the main barrier")).toBe(true);
      expect(RELEVANT_PATTERNS.barrier.test("overcome the challenge")).toBe(true);
      expect(RELEVANT_PATTERNS.barrier.test("lack of experience")).toBe(true);
    });

    it("matches goal terms", () => {
      expect(RELEVANT_PATTERNS.goal.test("employment opportunity")).toBe(true);
      expect(RELEVANT_PATTERNS.goal.test("career goal")).toBe(true);
    });

    it("matches connection verbs", () => {
      expect(RELEVANT_PATTERNS.connection.test("will help improve")).toBe(true);
      expect(RELEVANT_PATTERNS.connection.test("enable and support")).toBe(true);
    });

    it("matches task-based terms", () => {
      expect(RELEVANT_PATTERNS.taskBased.test("attend the workshop")).toBe(true);
      expect(RELEVANT_PATTERNS.taskBased.test("job fair")).toBe(true);
      expect(RELEVANT_PATTERNS.taskBased.test("interview preparation")).toBe(true);
    });
  });

  describe("TIMEBOUND_PATTERNS", () => {
    it("matches deadlines", () => {
      expect(TIMEBOUND_PATTERNS.deadline.test("by next Friday")).toBe(true);
      expect(TIMEBOUND_PATTERNS.deadline.test("before end of month")).toBe(true);
      expect(TIMEBOUND_PATTERNS.deadline.test("within 2 weeks")).toBe(true);
    });

    it("matches review patterns", () => {
      expect(TIMEBOUND_PATTERNS.review.test("review in 2 weeks")).toBe(true);
      expect(TIMEBOUND_PATTERNS.review.test("follow-up after 3 days")).toBe(true);
    });

    it("matches timeframe terms", () => {
      expect(TIMEBOUND_PATTERNS.timeframe.test("today")).toBe(true);
      expect(TIMEBOUND_PATTERNS.timeframe.test("tomorrow")).toBe(true);
      expect(TIMEBOUND_PATTERNS.timeframe.test("next week")).toBe(true);
      expect(TIMEBOUND_PATTERNS.timeframe.test("this month")).toBe(true);
    });
  });

  describe("WEAK_PATTERNS", () => {
    it("detects vague language", () => {
      expect(WEAK_PATTERNS.vague.test("try to find")).toBe(true);
      expect(WEAK_PATTERNS.vague.test("maybe attend")).toBe(true);
      expect(WEAK_PATTERNS.vague.test("might consider")).toBe(true);
      expect(WEAK_PATTERNS.vague.test("think about")).toBe(true);
    });

    it("detects passive constructions", () => {
      expect(WEAK_PATTERNS.passive.test("should be done")).toBe(true);
      expect(WEAK_PATTERNS.passive.test("could be better")).toBe(true);
      expect(WEAK_PATTERNS.passive.test("might be useful")).toBe(true);
    });

    it("detects uncertain timeframes", () => {
      expect(WEAK_PATTERNS.uncertain.test("if possible")).toBe(true);
      expect(WEAK_PATTERNS.uncertain.test("eventually")).toBe(true);
      expect(WEAK_PATTERNS.uncertain.test("at some point")).toBe(true);
    });
  });

  describe("STRONG_VERB_PATTERN", () => {
    it("matches strong commitment verbs", () => {
      expect(STRONG_VERB_PATTERN.test("will attend")).toBe(true);
      expect(STRONG_VERB_PATTERN.test("shall complete")).toBe(true);
      expect(STRONG_VERB_PATTERN.test("agrees to do")).toBe(true);
      expect(STRONG_VERB_PATTERN.test("commits to achieving")).toBe(true);
      expect(STRONG_VERB_PATTERN.test("has agreed to attend")).toBe(true);
    });

    it("does not match weak language", () => {
      expect(STRONG_VERB_PATTERN.test("might try")).toBe(false);
      expect(STRONG_VERB_PATTERN.test("could maybe")).toBe(false);
    });
  });

  describe("ACTION_VERBS", () => {
    it("contains essential employment action verbs", () => {
      const essentialVerbs = [
        "apply", "submit", "attend", "complete", "register",
        "contact", "email", "visit", "prepare", "research",
      ];
      for (const verb of essentialVerbs) {
        expect(ACTION_VERBS).toContain(verb);
      }
    });

    it("is a non-empty readonly array", () => {
      expect(ACTION_VERBS.length).toBeGreaterThan(20);
    });
  });

  describe("VAGUE_TERMS", () => {
    it("contains common weak/vague terms", () => {
      const expectedTerms = ["try", "maybe", "might", "hope", "consider", "think about"];
      for (const term of expectedTerms) {
        expect(VAGUE_TERMS).toContain(term);
      }
    });

    it("is a non-empty readonly array", () => {
      expect(VAGUE_TERMS.length).toBeGreaterThan(10);
    });
  });

  describe("BARRIER_KEYWORDS", () => {
    it("covers all major barrier categories", () => {
      const expectedBarriers = [
        "transport", "childcare", "cv", "confidence", "digital",
        "health", "housing", "training", "experience", "id",
        "disclosure", "language", "finance",
      ];
      for (const barrier of expectedBarriers) {
        expect(BARRIER_KEYWORDS).toHaveProperty(barrier);
        expect(BARRIER_KEYWORDS[barrier].length).toBeGreaterThan(0);
      }
    });

    it("has relevant keywords for transport barrier", () => {
      const transportKeywords = BARRIER_KEYWORDS["transport"];
      expect(transportKeywords).toContain("bus");
      expect(transportKeywords).toContain("train");
      expect(transportKeywords).toContain("commute");
    });

    it("has relevant keywords for cv barrier", () => {
      const cvKeywords = BARRIER_KEYWORDS["cv"];
      expect(cvKeywords).toContain("cv");
      expect(cvKeywords).toContain("application");
      expect(cvKeywords).toContain("cover letter");
    });

    it("has relevant keywords for health barrier", () => {
      const healthKeywords = BARRIER_KEYWORDS["health"];
      expect(healthKeywords).toContain("doctor");
      expect(healthKeywords).toContain("gp");
      expect(healthKeywords).toContain("mental");
    });
  });
});
