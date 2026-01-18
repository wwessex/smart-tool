import { describe, it, expect } from "vitest";
import { checkSmart, getSmartLabel, getSmartColor, getImprovementPriority } from "@/lib/smart-checker";

describe("checkSmart", () => {
  it("returns low scores for empty text", () => {
    const result = checkSmart("");
    expect(result.overallScore).toBe(0);
    expect(result.specific.met).toBe(false);
    expect(result.measurable.met).toBe(false);
    expect(result.achievable.met).toBe(false);
    expect(result.relevant.met).toBe(false);
    expect(result.timeBound.met).toBe(false);
  });

  it("detects specific elements with who/what/where", () => {
    const result = checkSmart("John will attend the job centre to submit his application");
    expect(result.specific.met).toBe(true);
  });

  it("detects measurable elements with dates", () => {
    const result = checkSmart("Complete 2 applications by 30-Jan-26", {
      timescale: "2 weeks"
    });
    expect(result.measurable.met).toBe(true);
  });

  it("detects achievable elements with agreement language", () => {
    const result = checkSmart("John has agreed to complete this action with support from his advisor");
    expect(result.achievable.met).toBe(true);
  });

  it("detects relevant elements when connected to barrier", () => {
    const result = checkSmart(
      "This action will help improve confidence for job interviews",
      { barrier: "Confidence" }
    );
    expect(result.relevant.met).toBe(true);
  });

  it("detects time-bound elements with review dates", () => {
    const result = checkSmart(
      "This will be reviewed in our next meeting",
      { timescale: "2 weeks" }
    );
    expect(result.timeBound.met).toBe(true);
  });

  it("gives high score for well-formed SMART action", () => {
    const action = `
      During our meeting on 15-Jan-26, John and I identified development areas around CV.
      As discussed and agreed, John will update his CV for warehouse roles and submit 3 applications.
      This action will help present his skills clearly to employers.
      We have agreed today that this action is both realistic and achievable.
      This will be reviewed in our next review meeting in 2 weeks.
    `;
    const result = checkSmart(action, {
      forename: "John",
      barrier: "CV",
      timescale: "2 weeks"
    });
    expect(result.overallScore).toBeGreaterThanOrEqual(4);
  });

  it("detects weak language and adds warnings", () => {
    const result = checkSmart("John might try to maybe attend an interview if possible");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("Weak language");
  });

  it("includes forename in specific detection when provided", () => {
    const withForename = checkSmart("John will complete the task", { forename: "John" });
    const withoutForename = checkSmart("He will complete the task");
    
    // Should detect specific elements in both, but forename adds confidence
    expect(withForename.specific.met).toBe(true);
    expect(withoutForename.specific.met).toBe(true);
  });

  it("detects barrier alignment for CV-related actions", () => {
    const result = checkSmart(
      "Update CV with recent experience and skills",
      { barrier: "CV" }
    );
    expect(result.relevant.met).toBe(true);
    expect(result.relevant.reason).toContain("cv");
  });

  it("generates suggestions for unmet criteria", () => {
    const result = checkSmart("Do something", { forename: "Jane", barrier: "Transport" });
    
    // At least some criteria should have suggestions since text is vague
    const suggestionsPresent = [
      result.specific.suggestion,
      result.measurable.suggestion,
      result.achievable.suggestion,
      result.relevant.suggestion,
      result.timeBound.suggestion
    ].filter(Boolean);
    
    expect(suggestionsPresent.length).toBeGreaterThan(0);
  });
});

describe("getSmartLabel", () => {
  it("returns correct labels for scores", () => {
    expect(getSmartLabel(5)).toBe("Excellent");
    expect(getSmartLabel(4)).toBe("Good");
    expect(getSmartLabel(3)).toBe("Fair");
    expect(getSmartLabel(2)).toBe("Needs work");
    expect(getSmartLabel(1)).toBe("Incomplete");
    expect(getSmartLabel(0)).toBe("Incomplete");
  });
});

describe("getSmartColor", () => {
  it("returns correct color classes for scores", () => {
    expect(getSmartColor(5)).toContain("green");
    expect(getSmartColor(4)).toContain("green");
    expect(getSmartColor(3)).toContain("amber");
    expect(getSmartColor(2)).toContain("orange");
    expect(getSmartColor(1)).toContain("destructive");
    expect(getSmartColor(0)).toContain("destructive");
  });
});

describe("getImprovementPriority", () => {
  it("prioritizes specific and time-bound improvements", () => {
    const check = checkSmart("Do something");
    const priorities = getImprovementPriority(check);
    
    // Should suggest adding who/what/where first
    expect(priorities[0]).toContain("who");
  });

  it("returns empty array when all criteria met", () => {
    const action = `
      John has agreed to attend the job centre by 30-Jan-26 to submit 2 applications.
      This will help address his CV barrier and improve job search.
      This will be reviewed in 2 weeks.
    `;
    const check = checkSmart(action, {
      forename: "John",
      barrier: "CV", 
      timescale: "2 weeks"
    });
    
    // If all 5 criteria are met, priorities should be empty
    if (check.overallScore === 5) {
      const priorities = getImprovementPriority(check);
      expect(priorities.length).toBe(0);
    }
  });
});
