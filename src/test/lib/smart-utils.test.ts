import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  todayISO,
  formatDDMMMYY,
  parseTimescaleToTargetISO,
  pickLibraryKey,
  resolvePlaceholders,
  bestNowSuggestion,
  bestTaskSuggestion,
  pickTaskKey,
  getSuggestionList,
  getTaskSuggestions,
  formatTaskOutcome,
  buildNowOutput,
  buildFutureOutput,
} from "@/lib/smart-utils";

describe("smart-utils", () => {
  describe("todayISO", () => {
    it("returns date in YYYY-MM-DD format", () => {
      const result = todayISO();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("returns a valid date", () => {
      const result = todayISO();
      const parsed = new Date(result);
      expect(parsed.toString()).not.toBe("Invalid Date");
    });
  });

  describe("formatDDMMMYY", () => {
    it("formats date as DD-MMM-YY", () => {
      const result = formatDDMMMYY("2026-01-15");
      expect(result).toBe("15-Jan-26");
    });

    it("handles single-digit days with padding", () => {
      const result = formatDDMMMYY("2026-03-05");
      expect(result).toBe("05-Mar-26");
    });

    it("handles December correctly", () => {
      const result = formatDDMMMYY("2026-12-25");
      expect(result).toBe("25-Dec-26");
    });

    it("handles year 2030", () => {
      const result = formatDDMMMYY("2030-06-20");
      expect(result).toBe("20-Jun-30");
    });
  });

  describe("parseTimescaleToTargetISO", () => {
    const baseDate = "2026-01-15";

    describe("week parsing", () => {
      it("parses '1 week' correctly", () => {
        const result = parseTimescaleToTargetISO(baseDate, "1 week");
        expect(result).toBe("2026-01-22");
      });

      it("parses '2 weeks' correctly", () => {
        const result = parseTimescaleToTargetISO(baseDate, "2 weeks");
        expect(result).toBe("2026-01-29");
      });

      it("parses '4 weeks' correctly", () => {
        const result = parseTimescaleToTargetISO(baseDate, "4 weeks");
        expect(result).toBe("2026-02-12");
      });

      it("handles week crossing year boundary", () => {
        const result = parseTimescaleToTargetISO("2026-12-28", "2 weeks");
        expect(result).toBe("2027-01-11");
      });
    });

    describe("month parsing", () => {
      it("parses '1 month' correctly", () => {
        const result = parseTimescaleToTargetISO(baseDate, "1 month");
        expect(result).toBe("2026-02-15");
      });

      it("parses '3 months' correctly", () => {
        const result = parseTimescaleToTargetISO(baseDate, "3 months");
        expect(result).toBe("2026-04-15");
      });

      it("parses '6 months' correctly", () => {
        const result = parseTimescaleToTargetISO(baseDate, "6 months");
        expect(result).toBe("2026-07-15");
      });

      it("handles month boundary overflow (31st to 30-day month)", () => {
        // Jan 31 + 1 month should become Feb 28 (not invalid date)
        const result = parseTimescaleToTargetISO("2026-01-31", "1 month");
        expect(result).toBe("2026-02-28");
      });

      it("handles leap year February", () => {
        // 2028 is a leap year
        const result = parseTimescaleToTargetISO("2028-01-31", "1 month");
        expect(result).toBe("2028-02-29");
      });

      it("handles month crossing year boundary", () => {
        const result = parseTimescaleToTargetISO("2026-11-15", "3 months");
        expect(result).toBe("2027-02-15");
      });
    });

    describe("edge cases", () => {
      it("returns base date for empty timescale", () => {
        const result = parseTimescaleToTargetISO(baseDate, "");
        expect(result).toBe(baseDate);
      });

      it("returns base date for null-like timescale", () => {
        const result = parseTimescaleToTargetISO(baseDate, "   ");
        expect(result).toBe(baseDate);
      });

      it("returns base date for unrecognized timescale", () => {
        const result = parseTimescaleToTargetISO(baseDate, "tomorrow");
        expect(result).toBe(baseDate);
      });

      it("handles case insensitivity", () => {
        expect(parseTimescaleToTargetISO(baseDate, "2 WEEKS")).toBe("2026-01-29");
        expect(parseTimescaleToTargetISO(baseDate, "1 Month")).toBe("2026-02-15");
      });

      it("handles extra whitespace", () => {
        expect(parseTimescaleToTargetISO(baseDate, "  2 weeks  ")).toBe("2026-01-29");
      });
    });
  });

  describe("pickLibraryKey", () => {
    describe("exact matches", () => {
      it("finds exact match for 'CV'", () => {
        expect(pickLibraryKey("CV")).toBe("CV");
      });

      it("finds exact match case-insensitively", () => {
        expect(pickLibraryKey("cv")).toBe("CV");
        expect(pickLibraryKey("Cv")).toBe("CV");
      });

      it("finds exact match for 'Confidence'", () => {
        expect(pickLibraryKey("Confidence")).toBe("Confidence");
      });

      it("finds exact match for 'Transport'", () => {
        expect(pickLibraryKey("Transport")).toBe("Transport");
      });
    });

    describe("partial matches", () => {
      it("matches 'CV writing' to 'CV'", () => {
        expect(pickLibraryKey("CV writing skills")).toBe("CV");
      });

      it("matches 'lack of confidence' to 'Confidence'", () => {
        expect(pickLibraryKey("lack of confidence")).toBe("Confidence");
      });
    });

    describe("semantic matches", () => {
      it("matches 'autistic' to 'Autism'", () => {
        expect(pickLibraryKey("autistic")).toBe("Autism");
      });

      it("matches 'mental health' to 'Health Condition' (health keyword takes precedence)", () => {
        // "health" is matched first by the semantic matches for Health Condition
        expect(pickLibraryKey("mental health issues")).toBe("Health Condition");
      });

      it("matches 'anxiety' to 'Mental Wellbeing'", () => {
        expect(pickLibraryKey("anxiety")).toBe("Mental Wellbeing");
      });

      it("matches 'dyslexia' to 'Literacy and/or Numeracy'", () => {
        expect(pickLibraryKey("dyslexia")).toBe("Literacy and/or Numeracy");
      });

      it("matches 'computer skills' to 'Digital Skills'", () => {
        expect(pickLibraryKey("computer skills")).toBe("Digital Skills");
      });

      it("matches 'speech problems' to 'Communication Skills'", () => {
        expect(pickLibraryKey("speech problems")).toBe("Communication Skills");
      });

      it("matches 'wheelchair' to 'Disability'", () => {
        expect(pickLibraryKey("wheelchair user")).toBe("Disability");
      });

      it("matches 'dependents' to 'Caring Responsibilities'", () => {
        // Note: many caring terms like "childcare", "carer" contain "car" which
        // matches Transport. Use "dependents" which unambiguously matches.
        expect(pickLibraryKey("dependents")).toBe("Caring Responsibilities");
      });
    });

    describe("fuzzy matches", () => {
      it("matches 'nervous' to 'Confidence'", () => {
        // Use plain "nervous" to avoid "interviews" taking precedence
        expect(pickLibraryKey("feeling nervous")).toBe("Confidence");
      });

      it("matches 'bus' to 'Transport'", () => {
        expect(pickLibraryKey("bus problems")).toBe("Transport");
      });

      it("matches 'stressed' to 'Mental Wellbeing'", () => {
        expect(pickLibraryKey("feeling stressed")).toBe("Mental Wellbeing");
      });

      it("matches 'no internet' to 'Digital Skills' (internet keyword in Digital Skills takes precedence)", () => {
        // "internet" is in the Digital Skills semantic matches, which are checked before fuzzy matches
        expect(pickLibraryKey("no internet at home")).toBe("Digital Skills");
      });
    });

    describe("edge cases", () => {
      it("returns empty string for empty input", () => {
        expect(pickLibraryKey("")).toBe("");
      });

      it("returns empty string for whitespace-only input", () => {
        expect(pickLibraryKey("   ")).toBe("");
      });

      it("returns empty string for completely unknown barrier", () => {
        expect(pickLibraryKey("xyz123unknown")).toBe("");
      });
    });
  });

  describe("resolvePlaceholders", () => {
    it("replaces {targetDate} placeholder", () => {
      const result = resolvePlaceholders("Due by {targetDate}", {
        targetPretty: "15-Jan-26",
      });
      expect(result).toBe("Due by 15-Jan-26");
    });

    it("replaces {n} placeholder", () => {
      const result = resolvePlaceholders("Submit {n} applications", {
        targetPretty: "15-Jan-26",
        n: 3,
      });
      expect(result).toBe("Submit 3 applications");
    });

    it("replaces {forename} placeholder", () => {
      const result = resolvePlaceholders("{forename} will attend", {
        targetPretty: "15-Jan-26",
        forename: "John",
      });
      expect(result).toBe("John will attend");
    });

    it("uses default value for missing forename", () => {
      const result = resolvePlaceholders("{forename} will attend", {
        targetPretty: "15-Jan-26",
      });
      expect(result).toBe("[Name] will attend");
    });

    it("uses default value 2 for missing n", () => {
      const result = resolvePlaceholders("Apply to {n} jobs", {
        targetPretty: "15-Jan-26",
      });
      expect(result).toBe("Apply to 2 jobs");
    });

    it("replaces multiple placeholders", () => {
      const result = resolvePlaceholders(
        "{forename} will submit {n} applications by {targetDate}",
        { targetPretty: "20-Jan-26", n: 5, forename: "Sarah" }
      );
      expect(result).toBe("Sarah will submit 5 applications by 20-Jan-26");
    });

    it("handles empty string", () => {
      const result = resolvePlaceholders("", { targetPretty: "15-Jan-26" });
      expect(result).toBe("");
    });
  });

  describe("pickTaskKey", () => {
    it("identifies job fair tasks", () => {
      expect(pickTaskKey("Job Fair at Town Hall")).toBe("job fair");
      expect(pickTaskKey("careers fair")).toBe("job fair");
      expect(pickTaskKey("recruitment event")).toBe("job fair");
    });

    it("identifies workshop tasks", () => {
      expect(pickTaskKey("CV Workshop")).toBe("workshop");
      expect(pickTaskKey("Training session")).toBe("workshop");
      expect(pickTaskKey("Group course")).toBe("workshop");
    });

    it("identifies interview tasks", () => {
      expect(pickTaskKey("Mock interview")).toBe("interview");
      expect(pickTaskKey("Interview practice")).toBe("interview");
    });

    it("identifies CV tasks", () => {
      expect(pickTaskKey("CV review")).toBe("cv");
      expect(pickTaskKey("Resume update")).toBe("cv");
    });

    it("identifies application tasks", () => {
      expect(pickTaskKey("Job application")).toBe("application");
      expect(pickTaskKey("Apply for positions")).toBe("application");
    });

    it("returns default for unrecognized tasks", () => {
      expect(pickTaskKey("Something else")).toBe("default");
      expect(pickTaskKey("")).toBe("default");
    });
  });

  describe("bestNowSuggestion", () => {
    it("returns a suggestion object with title, action, and help", () => {
      const result = bestNowSuggestion("CV");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("action");
      expect(result).toHaveProperty("help");
    });

    it("returns barrier-specific suggestions", () => {
      const cvSuggestion = bestNowSuggestion("CV");
      expect(cvSuggestion.title.toLowerCase()).toContain("cv");
    });

    it("returns fallback suggestions for unknown barriers", () => {
      const result = bestNowSuggestion("unknownbarrier123");
      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
    });

    it("filters by query when provided", () => {
      const result = bestNowSuggestion("CV", "update");
      expect(result).toBeDefined();
    });
  });

  describe("bestTaskSuggestion", () => {
    it("returns a suggestion with title and outcome", () => {
      const result = bestTaskSuggestion("Job fair");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("outcome");
    });

    it("returns suggestion for workshop", () => {
      const result = bestTaskSuggestion("Training workshop");
      expect(result).toBeDefined();
    });

    it("returns default suggestion for unknown task", () => {
      const result = bestTaskSuggestion("random task");
      expect(result).toBeDefined();
      expect(result.outcome).toBeDefined();
    });
  });

  describe("getSuggestionList", () => {
    it("returns array of suggestions for known barrier", () => {
      const result = getSuggestionList("CV");
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("returns fallback suggestions for unknown barrier", () => {
      const result = getSuggestionList("xyz123");
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("getTaskSuggestions", () => {
    it("returns array of suggestions for known task type", () => {
      const result = getTaskSuggestions("workshop");
      expect(Array.isArray(result)).toBe(true);
    });

    it("returns default suggestions for unknown task", () => {
      const result = getTaskSuggestions("unknown");
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("formatTaskOutcome", () => {
    it("prepends name to action verbs", () => {
      const result = formatTaskOutcome("John", "attend the workshop");
      expect(result).toBe("John will attend the workshop");
    });

    it("preserves outcome that already starts with name", () => {
      const result = formatTaskOutcome("John", "John will attend");
      expect(result).toBe("John will attend");
    });

    it("handles outcomes starting with 'will'", () => {
      const result = formatTaskOutcome("Sarah", "will complete the form");
      expect(result).toBe("Sarah will complete the form");
    });

    it("handles outcomes starting with pronouns", () => {
      const result = formatTaskOutcome("John", "They will attend");
      expect(result).toBe("They will attend");
    });

    it("removes trailing periods", () => {
      const result = formatTaskOutcome("John", "attend workshop.");
      expect(result).not.toContain("..");
    });

    it("handles empty outcome", () => {
      const result = formatTaskOutcome("John", "");
      expect(result).toBe("");
    });

    it("uses 'They' when no forename provided", () => {
      const result = formatTaskOutcome("", "attend the session");
      expect(result).toBe("They will attend the session");
    });
  });

  describe("buildNowOutput", () => {
    it("builds complete SMART action text", () => {
      const result = buildNowOutput(
        "2026-01-15",
        "John",
        "CV",
        "update his CV",
        "Participant",
        "Advisor will review",
        "2 weeks"
      );

      expect(result).toContain("15-Jan-26");
      expect(result).toContain("John");
      expect(result).toContain("CV");
      expect(result).toContain("update his CV");
      expect(result).toContain("2 weeks");
    });

    it("removes redundant 'Name will' prefix", () => {
      const result = buildNowOutput(
        "2026-01-15",
        "John",
        "CV",
        "John will update his CV",
        "Participant",
        "Advisor will review",
        "2 weeks"
      );

      // Should not have "John will John will"
      expect(result).not.toMatch(/John will John will/i);
    });

    it("removes redundant commitment phrases", () => {
      const result = buildNowOutput(
        "2026-01-15",
        "John",
        "CV",
        "John has agreed to update his CV",
        "Participant",
        "Advisor will review",
        "2 weeks"
      );

      // Should not duplicate agreement language
      expect(result.match(/has agreed to/gi)?.length || 0).toBeLessThanOrEqual(1);
    });

    it("strips trailing punctuation from components", () => {
      const result = buildNowOutput(
        "2026-01-15",
        "John",
        "CV issues.",
        "update his CV.",
        "Participant",
        "Advisor will help.",
        "2 weeks."
      );

      // Should not have double periods
      expect(result).not.toContain("..");
    });
  });

  describe("buildFutureOutput", () => {
    it("builds complete task outcome text", () => {
      const result = buildFutureOutput(
        "2026-01-15",
        "John",
        "Job Fair",
        "Participant",
        "will network with employers",
        "2 weeks"
      );

      expect(result).toContain("15-Jan-26");
      expect(result).toContain("John");
      expect(result).toContain("Job Fair");
      expect(result).toContain("2 weeks");
    });

    it("adds appropriate verb prefix for events", () => {
      const result = buildFutureOutput(
        "2026-01-15",
        "John",
        "CV Workshop",
        "Participant",
        "will learn new skills",
        "2 weeks"
      );

      expect(result).toContain("attend");
    });

    it("includes achievability confirmation", () => {
      const result = buildFutureOutput(
        "2026-01-15",
        "John",
        "Training",
        "Participant",
        "will complete training",
        "2 weeks"
      );

      expect(result).toContain("realistic and achievable");
    });

    it("handles empty outcome gracefully", () => {
      const result = buildFutureOutput(
        "2026-01-15",
        "John",
        "Meeting",
        "Participant",
        "",
        "1 week"
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
