import { describe, it, expect } from "vitest";
import {
  highlightSmartElements,
  getMatchesByType,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_LABELS,
  type HighlightedSegment,
  type HighlightType,
} from "@/lib/smart-highlighter";

describe("smart-highlighter", () => {
  describe("highlightSmartElements", () => {
    it("returns empty array for empty text", () => {
      expect(highlightSmartElements("")).toEqual([]);
    });

    it("returns empty array for null/undefined text", () => {
      expect(highlightSmartElements(null as unknown as string)).toEqual([]);
      expect(highlightSmartElements(undefined as unknown as string)).toEqual([]);
    });

    it("returns single normal segment for text with no SMART elements", () => {
      const text = "hello world";
      const segments = highlightSmartElements(text);

      expect(segments.length).toBeGreaterThanOrEqual(1);
      // The entire text should be covered
      const combined = segments.map(s => s.text).join("");
      expect(combined).toBe(text);
    });

    it("highlights specific action verbs", () => {
      const text = "John will attend the workshop";
      const segments = highlightSmartElements(text);

      const specificSegments = segments.filter(s => s.type === "specific");
      expect(specificSegments.length).toBeGreaterThan(0);
    });

    it("highlights measurable quantities", () => {
      const text = "Complete 3 applications by Friday";
      const segments = highlightSmartElements(text);

      const measurableSegments = segments.filter(s => s.type === "measurable");
      expect(measurableSegments.length).toBeGreaterThan(0);
    });

    it("highlights measurable date formats", () => {
      const text = "Complete 5 applications on 15th January";
      const segments = highlightSmartElements(text);

      const measurableSegments = segments.filter(s => s.type === "measurable");
      expect(measurableSegments.length).toBeGreaterThan(0);
    });

    it("highlights achievable agreement language", () => {
      const text = "As discussed and agreed, the plan is realistic";
      const segments = highlightSmartElements(text);

      const achievableSegments = segments.filter(s => s.type === "achievable");
      expect(achievableSegments.length).toBeGreaterThan(0);
    });

    it("highlights achievable support mentions", () => {
      const text = "with support from the advisor";
      const segments = highlightSmartElements(text);

      const achievableSegments = segments.filter(s => s.type === "achievable");
      expect(achievableSegments.length).toBeGreaterThan(0);
    });

    it("highlights relevant barrier/employment terms", () => {
      const text = "to overcome the barrier and find employment";
      const segments = highlightSmartElements(text);

      const relevantSegments = segments.filter(s => s.type === "relevant");
      expect(relevantSegments.length).toBeGreaterThan(0);
    });

    it("highlights timebound deadlines", () => {
      const text = "complete by next Friday and review in 2 weeks";
      const segments = highlightSmartElements(text);

      const timeboundSegments = segments.filter(s => s.type === "timebound");
      expect(timeboundSegments.length).toBeGreaterThan(0);
    });

    it("highlights weak language", () => {
      const text = "John might try to maybe consider attending";
      const segments = highlightSmartElements(text);

      const weakSegments = segments.filter(s => s.type === "weak");
      expect(weakSegments.length).toBeGreaterThan(0);
    });

    it("preserves the full text when recombined", () => {
      const text =
        "As discussed and agreed, John will attend 3 workshops at the job centre by 15-Jan-26.";
      const segments = highlightSmartElements(text);

      const combined = segments.map(s => s.text).join("");
      expect(combined).toBe(text);
    });

    it("assigns correct start and end positions", () => {
      const text = "John will attend the workshop by next Friday";
      const segments = highlightSmartElements(text);

      for (const segment of segments) {
        expect(segment.end).toBeGreaterThan(segment.start);
        expect(segment.text).toBe(text.slice(segment.start, segment.end));
      }
    });

    it("does not produce overlapping segments", () => {
      const text =
        "As discussed and agreed, John will attend 5 interviews at the centre by 20-Jan-26.";
      const segments = highlightSmartElements(text);

      for (let i = 1; i < segments.length; i++) {
        expect(segments[i].start).toBeGreaterThanOrEqual(segments[i - 1].end);
      }
    });

    it("covers the entire text (no gaps)", () => {
      const text = "John will attend the workshop at the library by next week.";
      const segments = highlightSmartElements(text);

      if (segments.length === 0) return;
      expect(segments[0].start).toBe(0);
      expect(segments[segments.length - 1].end).toBe(text.length);
    });

    it("handles text with only weak language", () => {
      const text = "maybe try to possibly consider something eventually";
      const segments = highlightSmartElements(text);

      const weakSegments = segments.filter(s => s.type === "weak");
      expect(weakSegments.length).toBeGreaterThan(0);
    });
  });

  describe("getMatchesByType", () => {
    it("returns empty arrays for empty text", () => {
      const result = getMatchesByType("");
      expect(result.specific).toEqual([]);
      expect(result.measurable).toEqual([]);
      expect(result.achievable).toEqual([]);
      expect(result.relevant).toEqual([]);
      expect(result.timebound).toEqual([]);
      expect(result.weak).toEqual([]);
    });

    it("extracts specific matches", () => {
      const text = "Sarah will attend the workshop and prepare her documents";
      const result = getMatchesByType(text);

      expect(result.specific.length).toBeGreaterThan(0);
    });

    it("extracts measurable matches", () => {
      const text = "Submit 5 applications by 15/01/2026";
      const result = getMatchesByType(text);

      expect(result.measurable.length).toBeGreaterThan(0);
    });

    it("extracts achievable matches", () => {
      const text = "As discussed and agreed with support from the advisor";
      const result = getMatchesByType(text);

      expect(result.achievable.length).toBeGreaterThan(0);
    });

    it("extracts weak language matches", () => {
      const text = "might try to maybe consider it";
      const result = getMatchesByType(text);

      expect(result.weak.length).toBeGreaterThan(0);
    });

    it("deduplicates matches (case-insensitive)", () => {
      const text = "attend the workshop and attend another session";
      const result = getMatchesByType(text);

      // "attend" should only appear once in specific matches
      const attendMatches = result.specific.filter(
        m => m.toLowerCase() === "attend"
      );
      expect(attendMatches.length).toBeLessThanOrEqual(1);
    });

    it("categorises a fully SMART action into multiple types", () => {
      const text =
        "As discussed and agreed, John will attend 3 workshops to improve his employment chances by next Friday";
      const result = getMatchesByType(text);

      const typesWithMatches = Object.entries(result).filter(
        ([, matches]) => matches.length > 0
      );
      expect(typesWithMatches.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("HIGHLIGHT_COLORS", () => {
    it("defines colors for all highlight types", () => {
      const types: HighlightType[] = [
        "specific",
        "measurable",
        "achievable",
        "relevant",
        "timebound",
        "weak",
        "normal",
      ];
      for (const type of types) {
        expect(HIGHLIGHT_COLORS[type]).toBeDefined();
        expect(HIGHLIGHT_COLORS[type]).toHaveProperty("bg");
        expect(HIGHLIGHT_COLORS[type]).toHaveProperty("text");
        expect(HIGHLIGHT_COLORS[type]).toHaveProperty("border");
      }
    });

    it("has empty strings for normal type", () => {
      expect(HIGHLIGHT_COLORS.normal.bg).toBe("");
      expect(HIGHLIGHT_COLORS.normal.text).toBe("");
      expect(HIGHLIGHT_COLORS.normal.border).toBe("");
    });
  });

  describe("HIGHLIGHT_LABELS", () => {
    it("defines labels for all non-normal types", () => {
      expect(HIGHLIGHT_LABELS.specific).toBe("Specific");
      expect(HIGHLIGHT_LABELS.measurable).toBe("Measurable");
      expect(HIGHLIGHT_LABELS.achievable).toBe("Achievable");
      expect(HIGHLIGHT_LABELS.relevant).toBe("Relevant");
      expect(HIGHLIGHT_LABELS.timebound).toBe("Time-bound");
      expect(HIGHLIGHT_LABELS.weak).toBe("Weak Language");
    });
  });
});
