import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useActionAnalytics } from "@/hooks/useActionAnalytics";
import type { HistoryItem } from "@/hooks/useSmartStorage";

function createItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: crypto.randomUUID(),
    mode: "now",
    createdAt: new Date().toISOString(),
    text: "John will update his CV and apply for 3 jobs by 20-Jan-26.",
    meta: {
      date: "2026-01-15",
      forename: "John",
      barrier: "CV",
      timescale: "2 weeks",
    },
    ...overrides,
  };
}

describe("useActionAnalytics", () => {
  describe("empty history", () => {
    it("returns zero totals", () => {
      const { result } = renderHook(() => useActionAnalytics([]));

      expect(result.current.totalActions).toBe(0);
      expect(result.current.averageScore).toBe(0);
      expect(result.current.perfectScoreCount).toBe(0);
      expect(result.current.needsWorkCount).toBe(0);
    });

    it("returns score distribution with all zeros", () => {
      const { result } = renderHook(() => useActionAnalytics([]));

      expect(result.current.scoreDistribution).toHaveLength(6);
      for (const bucket of result.current.scoreDistribution) {
        expect(bucket.count).toBe(0);
      }
    });

    it("returns empty barrier distribution", () => {
      const { result } = renderHook(() => useActionAnalytics([]));
      expect(result.current.barrierDistribution).toEqual([]);
    });

    it("returns mode breakdown with zero counts", () => {
      const { result } = renderHook(() => useActionAnalytics([]));
      expect(result.current.modeBreakdown).toEqual([
        { mode: "now", count: 0 },
        { mode: "future", count: 0 },
      ]);
    });
  });

  describe("with history items", () => {
    it("counts total actions", () => {
      const items = [createItem(), createItem(), createItem()];
      const { result } = renderHook(() => useActionAnalytics(items));

      expect(result.current.totalActions).toBe(3);
    });

    it("computes score distribution", () => {
      const items = [createItem(), createItem()];
      const { result } = renderHook(() => useActionAnalytics(items));

      const totalCount = result.current.scoreDistribution.reduce(
        (sum, b) => sum + b.count,
        0
      );
      expect(totalCount).toBe(2);
    });

    it("computes barrier distribution", () => {
      const items = [
        createItem({ meta: { date: "2026-01-15", forename: "John", barrier: "CV", timescale: "2 weeks" } }),
        createItem({ meta: { date: "2026-01-15", forename: "John", barrier: "CV", timescale: "2 weeks" } }),
        createItem({ meta: { date: "2026-01-15", forename: "Sarah", barrier: "Transport", timescale: "1 week" } }),
      ];
      const { result } = renderHook(() => useActionAnalytics(items));

      expect(result.current.barrierDistribution.length).toBeGreaterThanOrEqual(1);
      // CV should be first (2 items)
      expect(result.current.barrierDistribution[0].barrier).toBe("CV");
      expect(result.current.barrierDistribution[0].count).toBe(2);
    });

    it("tracks mode breakdown", () => {
      const items = [
        createItem({ mode: "now" }),
        createItem({ mode: "now" }),
        createItem({ mode: "future" }),
      ];
      const { result } = renderHook(() => useActionAnalytics(items));

      const nowMode = result.current.modeBreakdown.find(m => m.mode === "now");
      const futureMode = result.current.modeBreakdown.find(m => m.mode === "future");

      expect(nowMode?.count).toBe(2);
      expect(futureMode?.count).toBe(1);
    });

    it("detects weak language", () => {
      const items = [
        createItem({ text: "John might try to maybe update his CV." }),
        createItem({ text: "Sarah will possibly consider attending." }),
      ];
      const { result } = renderHook(() => useActionAnalytics(items));

      expect(result.current.commonWeakLanguage.length).toBeGreaterThan(0);
      const weakWords = result.current.commonWeakLanguage.map(w => w.word);
      expect(weakWords).toContain("try");
    });

    it("tracks top participants", () => {
      const items = [
        createItem({ meta: { date: "2026-01-15", forename: "John", barrier: "CV", timescale: "2 weeks" } }),
        createItem({ meta: { date: "2026-01-15", forename: "John", barrier: "CV", timescale: "2 weeks" } }),
        createItem({ meta: { date: "2026-01-15", forename: "Sarah", barrier: "CV", timescale: "2 weeks" } }),
      ];
      const { result } = renderHook(() => useActionAnalytics(items));

      expect(result.current.topParticipants.length).toBeGreaterThanOrEqual(1);
      expect(result.current.topParticipants[0].name).toBe("John");
      expect(result.current.topParticipants[0].count).toBe(2);
    });

    it("computes weekly trends", () => {
      const items = [createItem(), createItem()];
      const { result } = renderHook(() => useActionAnalytics(items));

      expect(result.current.weeklyTrend.length).toBeGreaterThanOrEqual(1);
      expect(result.current.weeklyTrend[0]).toHaveProperty("week");
      expect(result.current.weeklyTrend[0]).toHaveProperty("count");
      expect(result.current.weeklyTrend[0]).toHaveProperty("avgScore");
    });

    it("limits barrier distribution to 8 items", () => {
      const barriers = [
        "CV", "Transport", "Childcare", "Health", "Housing",
        "Training", "Finance", "Digital", "Confidence", "Experience",
      ];
      const items = barriers.map(barrier =>
        createItem({ meta: { date: "2026-01-15", forename: "Test", barrier, timescale: "2 weeks" } })
      );
      const { result } = renderHook(() => useActionAnalytics(items));

      expect(result.current.barrierDistribution.length).toBeLessThanOrEqual(8);
    });

    it("limits weekly trends to 8 weeks", () => {
      // Create items spread across 12 different weeks
      const items: HistoryItem[] = [];
      for (let w = 0; w < 12; w++) {
        const date = new Date();
        date.setDate(date.getDate() - w * 7);
        items.push(
          createItem({ createdAt: date.toISOString() })
        );
      }
      const { result } = renderHook(() => useActionAnalytics(items));

      expect(result.current.weeklyTrend.length).toBeLessThanOrEqual(8);
    });

    it("truncates barrier names to 30 chars", () => {
      const longBarrier = "A".repeat(50);
      const items = [
        createItem({
          meta: { date: "2026-01-15", forename: "John", barrier: longBarrier, timescale: "2 weeks" },
        }),
      ];
      const { result } = renderHook(() => useActionAnalytics(items));

      if (result.current.barrierDistribution.length > 0) {
        expect(result.current.barrierDistribution[0].barrier.length).toBeLessThanOrEqual(30);
      }
    });
  });
});
