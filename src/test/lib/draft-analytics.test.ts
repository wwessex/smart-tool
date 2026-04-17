import { describe, it, expect, beforeEach } from "vitest";
import {
  logDraftAnalytics,
  loadDraftAnalytics,
  clearDraftAnalytics,
  exportDraftAnalytics,
  type DraftAnalyticsEntry,
} from "@/lib/draft-analytics";

const STORAGE_KEY = "smartTool.draftAnalytics";

function createEntry(signal: DraftAnalyticsEntry["signal"], barrier?: string): DraftAnalyticsEntry {
  return {
    timestamp: new Date().toISOString(),
    signal,
    barrier,
    actions_count: 3,
    smart_score: 4,
    source: "ai",
  };
}

describe("draft-analytics", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("loadDraftAnalytics", () => {
    it("returns empty array when no data exists", () => {
      expect(loadDraftAnalytics()).toEqual([]);
    });

    it("returns parsed entries from localStorage", () => {
      const entries = [createEntry("generated", "CV"), createEntry("selected", "Transport")];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));

      const result = loadDraftAnalytics();
      expect(result).toHaveLength(2);
      expect(result[0].signal).toBe("generated");
      expect(result[1].signal).toBe("selected");
    });

    it("returns empty array for corrupt JSON", () => {
      localStorage.setItem(STORAGE_KEY, "not valid json{{{");

      expect(loadDraftAnalytics()).toEqual([]);
    });

    it("returns empty array for non-array JSON", () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: "bar" }));

      expect(loadDraftAnalytics()).toEqual([]);
    });
  });

  describe("logDraftAnalytics", () => {
    it("stores an entry to localStorage", () => {
      const entry = createEntry("generated", "CV");
      logDraftAnalytics(entry);

      const stored = loadDraftAnalytics();
      expect(stored).toHaveLength(1);
      expect(stored[0].signal).toBe("generated");
      expect(stored[0].barrier).toBe("CV");
    });

    it("appends to existing entries", () => {
      logDraftAnalytics(createEntry("generated"));
      logDraftAnalytics(createEntry("selected"));
      logDraftAnalytics(createEntry("saved"));

      const stored = loadDraftAnalytics();
      expect(stored).toHaveLength(3);
    });

    it("trims to 500 entries max (keeps most recent)", () => {
      // Pre-populate with 499 entries
      const existingEntries: DraftAnalyticsEntry[] = [];
      for (let i = 0; i < 499; i++) {
        existingEntries.push(createEntry("generated", `Barrier-${i}`));
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existingEntries));

      // Add two more to go over 500
      logDraftAnalytics(createEntry("selected", "Final-1"));
      logDraftAnalytics(createEntry("saved", "Final-2"));

      const stored = loadDraftAnalytics();
      expect(stored.length).toBeLessThanOrEqual(500);
      // Most recent should be at the end
      expect(stored[stored.length - 1].barrier).toBe("Final-2");
    });

    it("preserves all signal fields", () => {
      const entry: DraftAnalyticsEntry = {
        timestamp: "2026-01-15T10:00:00Z",
        signal: "edited",
        barrier: "CV",
        barrier_id: "cv-001",
        actions_count: 3,
        selected_index: 1,
        generated_text: "John will update his CV",
        final_text: "John will update his CV with support",
        smart_score: 4,
        source: "ai",
      };
      logDraftAnalytics(entry);

      const stored = loadDraftAnalytics();
      expect(stored[0]).toEqual(entry);
    });

    it("stores primary acceptance metadata", () => {
      const entry: DraftAnalyticsEntry = {
        timestamp: "2026-04-17T10:00:00.000Z",
        signal: "accepted",
        barrier: "I keep forgetting",
        barrier_type: "habit",
        generated_text: "Set a daily reminder to review saved vacancies by 24-Apr-26.",
        relevance_score: 0.92,
        draft_mode: "primary",
        source: "ai",
      };

      logDraftAnalytics(entry);

      const stored = loadDraftAnalytics();
      expect(stored[0]).toEqual(entry);
    });

    it("stores more like this usage events", () => {
      const entry: DraftAnalyticsEntry = {
        timestamp: "2026-04-17T10:05:00.000Z",
        signal: "more_like_this",
        barrier: "CV",
        barrier_type: "clarity",
        draft_mode: "alternates",
        source: "ai",
      };

      logDraftAnalytics(entry);

      expect(loadDraftAnalytics()[0]).toEqual(entry);
    });

    it("silently fails on localStorage errors", () => {
      // Force localStorage to throw
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = () => { throw new Error("QuotaExceededError"); };

      // Should not throw
      expect(() => logDraftAnalytics(createEntry("generated"))).not.toThrow();

      localStorage.setItem = originalSetItem;
    });
  });

  describe("clearDraftAnalytics", () => {
    it("removes all entries", () => {
      logDraftAnalytics(createEntry("generated"));
      logDraftAnalytics(createEntry("selected"));

      clearDraftAnalytics();

      expect(loadDraftAnalytics()).toEqual([]);
    });

    it("is safe to call when no data exists", () => {
      expect(() => clearDraftAnalytics()).not.toThrow();
    });
  });

  describe("exportDraftAnalytics", () => {
    it("returns same data as loadDraftAnalytics", () => {
      logDraftAnalytics(createEntry("generated", "CV"));
      logDraftAnalytics(createEntry("saved", "Transport"));

      const exported = exportDraftAnalytics();
      const loaded = loadDraftAnalytics();

      expect(exported).toEqual(loaded);
    });

    it("returns empty array when no data", () => {
      expect(exportDraftAnalytics()).toEqual([]);
    });
  });
});
