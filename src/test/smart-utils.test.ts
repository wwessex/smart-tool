import { describe, it, expect } from "vitest";
import {
  todayISO,
  formatDDMMMYY,
  parseTimescaleToTargetISO,
  pickLibraryKey,
  resolvePlaceholders,
  pickTaskKey,
  buildNowOutput,
  buildFutureOutput,
} from "@/lib/smart-utils";

describe("todayISO", () => {
  it("returns a date string in YYYY-MM-DD format", () => {
    const result = todayISO();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatDDMMMYY", () => {
  it("formats ISO date to DD-MMM-YY format", () => {
    expect(formatDDMMMYY("2026-01-15")).toBe("15-Jan-26");
    expect(formatDDMMMYY("2026-12-25")).toBe("25-Dec-26");
  });

  it("handles single digit days", () => {
    expect(formatDDMMMYY("2026-03-05")).toBe("05-Mar-26");
  });
});

describe("parseTimescaleToTargetISO", () => {
  const baseDate = "2026-01-15";

  it("returns base date for empty timescale", () => {
    expect(parseTimescaleToTargetISO(baseDate, "")).toBe(baseDate);
  });

  it("adds weeks correctly", () => {
    expect(parseTimescaleToTargetISO(baseDate, "1 week")).toBe("2026-01-22");
    expect(parseTimescaleToTargetISO(baseDate, "2 weeks")).toBe("2026-01-29");
  });

  it("adds months correctly", () => {
    expect(parseTimescaleToTargetISO(baseDate, "1 month")).toBe("2026-02-15");
    expect(parseTimescaleToTargetISO(baseDate, "3 months")).toBe("2026-04-15");
  });

  it("handles month overflow", () => {
    // Jan 31 + 1 month should give Feb 28/29
    const result = parseTimescaleToTargetISO("2026-01-31", "1 month");
    expect(result).toMatch(/^2026-02-\d{2}$/);
  });
});

describe("pickLibraryKey", () => {
  it("returns empty string for empty barrier", () => {
    expect(pickLibraryKey("")).toBe("");
  });

  it("finds exact match", () => {
    expect(pickLibraryKey("Housing")).toBe("Housing");
    expect(pickLibraryKey("CV")).toBe("CV");
  });

  it("finds partial match (case insensitive)", () => {
    expect(pickLibraryKey("housing issues")).toBe("Housing");
    expect(pickLibraryKey("cv needs update")).toBe("CV");
  });

  it("finds semantic matches", () => {
    expect(pickLibraryKey("autistic")).toBe("Autism");
    expect(pickLibraryKey("anxiety")).toBe("Mental Wellbeing");
    expect(pickLibraryKey("dyslexia")).toBe("Literacy and/or Numeracy");
  });
});

describe("resolvePlaceholders", () => {
  it("replaces {targetDate} placeholder", () => {
    const result = resolvePlaceholders("Complete by {targetDate}", {
      targetPretty: "15-Jan-26",
    });
    expect(result).toBe("Complete by 15-Jan-26");
  });

  it("replaces {n} placeholder", () => {
    const result = resolvePlaceholders("Submit {n} applications", {
      targetPretty: "",
      n: 3,
    });
    expect(result).toBe("Submit 3 applications");
  });

  it("replaces {forename} placeholder", () => {
    const result = resolvePlaceholders("{forename} will attend", {
      targetPretty: "",
      forename: "John",
    });
    expect(result).toBe("John will attend");
  });

  it("defaults {n} to 2 if not provided", () => {
    const result = resolvePlaceholders("Submit {n} applications", {
      targetPretty: "",
    });
    expect(result).toBe("Submit 2 applications");
  });
});

describe("pickTaskKey", () => {
  it("returns 'default' for empty task", () => {
    expect(pickTaskKey("")).toBe("default");
  });

  it("detects job fair related tasks", () => {
    expect(pickTaskKey("Christmas job fair")).toBe("job fair");
    expect(pickTaskKey("careers fair")).toBe("job fair");
  });

  it("detects workshop related tasks", () => {
    expect(pickTaskKey("CV workshop")).toBe("workshop");
    expect(pickTaskKey("training session")).toBe("workshop");
  });

  it("detects interview related tasks", () => {
    expect(pickTaskKey("mock interview")).toBe("interview");
    expect(pickTaskKey("interview practice")).toBe("interview");
  });
});

describe("buildNowOutput", () => {
  it("builds correctly formatted output", () => {
    const result = buildNowOutput(
      "2026-01-15",
      "John",
      "CV",
      "Update CV with recent experience",
      "Participant",
      "present skills clearly",
      "2 weeks"
    );

    expect(result).toContain("15-Jan-26");
    expect(result).toContain("John");
    expect(result).toContain("CV");
    expect(result).toContain("update CV with recent experience");
    expect(result).toContain("present skills clearly");
    expect(result).toContain("2 weeks");
  });

  it("removes trailing punctuation from fields", () => {
    const result = buildNowOutput(
      "2026-01-15",
      "John",
      "CV.",
      "Update CV.",
      "Participant",
      "help with skills.",
      "2 weeks."
    );

    // Should not have double periods
    expect(result).not.toContain("..");
  });
});

describe("buildFutureOutput", () => {
  it("builds correctly formatted output", () => {
    const result = buildFutureOutput(
      "2026-01-20",
      "Jane",
      "Job fair at Twickenham Stadium",
      "will speak with employers and collect contacts",
      "2 weeks"
    );

    expect(result).toContain("20-Jan-26");
    expect(result).toContain("Jane");
    expect(result.toLowerCase()).toContain("job fair");
    expect(result).toContain("employers");
    expect(result).toContain("2 weeks");
  });

  it("handles tasks that need verb prefix", () => {
    const result = buildFutureOutput(
      "2026-01-20",
      "Jane",
      "CV workshop",
      "will learn to improve CV",
      "1 month"
    );

    expect(result).toContain("Jane will attend");
  });
});
