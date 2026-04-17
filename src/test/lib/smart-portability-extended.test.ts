import { describe, it, expect } from "vitest";
import { parseSmartToolImportFile } from "@/lib/smart-portability";

describe("smart-portability extended", () => {
  // ==================== validation edge cases ====================

  describe("validation edge cases", () => {
    it("rejects non-object input", () => {
      expect(() => parseSmartToolImportFile("just a string")).toThrow();
      expect(() => parseSmartToolImportFile(42)).toThrow();
      expect(() => parseSmartToolImportFile(null)).toThrow();
    });

    it("accepts empty payload (no history, no templates)", () => {
      const result = parseSmartToolImportFile({ version: 2 });

      expect(result.history).toBeUndefined();
      expect(result.templates).toBeUndefined();
    });

    it("rejects history items with invalid mode", () => {
      const raw = {
        version: 2,
        history: [
          {
            id: "1",
            mode: "invalid-mode",
            createdAt: "2026-01-01",
            text: "test",
            meta: { date: "2026-01-01", forename: "X", barrier: "CV", timescale: "1w" },
          },
        ],
      };

      expect(() => parseSmartToolImportFile(raw)).toThrow();
    });

    it("rejects settings with out-of-range threshold", () => {
      const raw = {
        version: 2,
        settings: { minScoreThreshold: 99 },
      };

      expect(() => parseSmartToolImportFile(raw)).toThrow();
    });

    it("rejects settings with threshold below minimum", () => {
      const raw = {
        version: 2,
        settings: { minScoreThreshold: 0 },
      };

      expect(() => parseSmartToolImportFile(raw)).toThrow();
    });

    it("rejects retention days below 7", () => {
      const raw = {
        version: 2,
        settings: { retentionDays: 1 },
      };

      expect(() => parseSmartToolImportFile(raw)).toThrow();
    });

    it("rejects retention days above 365", () => {
      const raw = {
        version: 2,
        settings: { retentionDays: 999 },
      };

      expect(() => parseSmartToolImportFile(raw)).toThrow();
    });

    it("accepts valid settings boundary values", () => {
      const raw = {
        version: 2,
        settings: {
          minScoreThreshold: 1,
          retentionDays: 7,
        },
      };

      const result = parseSmartToolImportFile(raw);
      expect(result.settings!.minScoreThreshold).toBe(1);
      expect(result.settings!.retentionDays).toBe(7);
    });

    it("accepts valid settings upper boundary values", () => {
      const raw = {
        version: 2,
        settings: {
          minScoreThreshold: 5,
          retentionDays: 365,
        },
      };

      const result = parseSmartToolImportFile(raw);
      expect(result.settings!.minScoreThreshold).toBe(5);
      expect(result.settings!.retentionDays).toBe(365);
    });
  });

  // ==================== max length enforcement ====================

  describe("max length enforcement", () => {
    it("rejects history exceeding 100 items", () => {
      const items = Array.from({ length: 101 }, (_, i) => ({
        id: String(i),
        mode: "now" as const,
        createdAt: "2026-01-01",
        text: "test",
        meta: { date: "2026-01-01", forename: "X", barrier: "CV", timescale: "1w" },
      }));

      expect(() => parseSmartToolImportFile({ version: 2, history: items })).toThrow();
    });

    it("accepts history at exactly 100 items", () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        mode: "now" as const,
        createdAt: "2026-01-01",
        text: "test",
        meta: { date: "2026-01-01", forename: "X", barrier: "CV", timescale: "1w" },
      }));

      const result = parseSmartToolImportFile({ version: 2, history: items });
      expect(result.history).toHaveLength(100);
    });

    it("rejects templates exceeding 50 items", () => {
      const templates = Array.from({ length: 51 }, (_, i) => ({
        id: String(i),
        name: `template-${i}`,
        mode: "now" as const,
        createdAt: "2026-01-01",
      }));

      expect(() =>
        parseSmartToolImportFile({ version: 2, templates })
      ).toThrow();
    });
  });

  // ==================== data wrapper handling ====================

  describe("data wrapper handling", () => {
    it("unwraps nested data object", () => {
      const raw = {
        version: 1,
        data: {
          barriers: ["CV", "Housing"],
          timescales: ["1 week"],
        },
      };

      const result = parseSmartToolImportFile(raw);
      expect(result.barriers).toEqual(["CV", "Housing"]);
    });

    it("uses top-level when data is not an object", () => {
      const raw = {
        version: 2,
        data: "not an object",
        barriers: ["CV"],
      };

      const result = parseSmartToolImportFile(raw);
      expect(result.barriers).toEqual(["CV"]);
    });

    it("uses top-level when data is an array", () => {
      const raw = {
        version: 2,
        data: [1, 2, 3],
        barriers: ["Transport"],
      };

      const result = parseSmartToolImportFile(raw);
      expect(result.barriers).toEqual(["Transport"]);
    });
  });

  // ==================== action feedback ====================

  describe("action feedback", () => {
    it("parses action feedback array", () => {
      const raw = {
        version: 2,
        actionFeedback: [
          {
            id: "f1",
            createdAt: "2026-01-01",
            barrier: "CV",
            category: "skills",
            generatedAction: "Update CV",
            rating: "relevant",
            acceptedAsIs: true,
            source: "ai",
            forename: "Test",
            timescale: "2 weeks",
          },
        ],
      };

      const result = parseSmartToolImportFile(raw);
      expect(result.actionFeedback).toHaveLength(1);
      expect(result.actionFeedback![0].rating).toBe("relevant");
    });

    it("accepts null rating in action feedback", () => {
      const raw = {
        version: 2,
        actionFeedback: [
          {
            id: "f1",
            createdAt: "2026-01-01",
            barrier: "CV",
            category: "skills",
            generatedAction: "Update CV",
            rating: null,
            acceptedAsIs: false,
            source: "template",
            forename: "Test",
            timescale: "2 weeks",
          },
        ],
      };

      const result = parseSmartToolImportFile(raw);
      expect(result.actionFeedback![0].rating).toBeNull();
    });
  });
});
