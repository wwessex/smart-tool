import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHistory } from "@/hooks/useHistory";
import type { HistoryItem } from "@/hooks/useSmartStorage";

function makeItem(id: string, daysAgo: number): HistoryItem {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    id,
    mode: "now",
    createdAt: date.toISOString(),
    text: `Action ${id}`,
    meta: {
      date: date.toISOString().slice(0, 10),
      forename: "Test",
      barrier: "CV",
      timescale: "2 weeks",
    },
  };
}

describe("useHistory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ==================== addToHistory ====================

  describe("addToHistory", () => {
    it("adds an item to history", () => {
      const { result } = renderHook(() => useHistory());
      const item = makeItem("1", 0);

      act(() => result.current.addToHistory(item));

      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0].id).toBe("1");
    });

    it("prepends new items (most recent first)", () => {
      const { result } = renderHook(() => useHistory());

      act(() => result.current.addToHistory(makeItem("1", 2)));
      act(() => result.current.addToHistory(makeItem("2", 0)));

      expect(result.current.history[0].id).toBe("2");
      expect(result.current.history[1].id).toBe("1");
    });

    it("caps history at 100 items", () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        for (let i = 0; i < 105; i++) {
          result.current.addToHistory(makeItem(`item-${i}`, 0));
        }
      });

      expect(result.current.history.length).toBeLessThanOrEqual(100);
    });
  });

  // ==================== deleteFromHistory ====================

  describe("deleteFromHistory", () => {
    it("removes item by id", () => {
      const { result } = renderHook(() => useHistory());

      act(() => result.current.addToHistory(makeItem("1", 0)));
      act(() => result.current.addToHistory(makeItem("2", 0)));
      act(() => result.current.deleteFromHistory("1"));

      expect(result.current.history).toHaveLength(1);
      expect(result.current.history[0].id).toBe("2");
    });

    it("does nothing for non-existent id", () => {
      const { result } = renderHook(() => useHistory());

      act(() => result.current.addToHistory(makeItem("1", 0)));
      act(() => result.current.deleteFromHistory("nonexistent"));

      expect(result.current.history).toHaveLength(1);
    });
  });

  // ==================== clearHistory ====================

  describe("clearHistory", () => {
    it("removes all history items", () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.addToHistory(makeItem("1", 0));
        result.current.addToHistory(makeItem("2", 0));
      });
      act(() => result.current.clearHistory());

      expect(result.current.history).toHaveLength(0);
    });
  });

  // ==================== addRecentName ====================

  describe("addRecentName", () => {
    it("adds a name to recent names", () => {
      const { result } = renderHook(() => useHistory());

      act(() => result.current.addRecentName("Alice"));

      expect(result.current.recentNames).toContain("Alice");
    });

    it("ignores empty/whitespace names", () => {
      const { result } = renderHook(() => useHistory());

      act(() => result.current.addRecentName(""));
      act(() => result.current.addRecentName("   "));

      expect(result.current.recentNames).toHaveLength(0);
    });

    it("trims whitespace", () => {
      const { result } = renderHook(() => useHistory());

      act(() => result.current.addRecentName("  Alice  "));

      expect(result.current.recentNames).toContain("Alice");
    });

    it("deduplicates case-insensitively", () => {
      const { result } = renderHook(() => useHistory());

      act(() => result.current.addRecentName("Alice"));
      act(() => result.current.addRecentName("alice"));

      expect(result.current.recentNames).toHaveLength(1);
      // Most recent version (lowercase) should be kept
      expect(result.current.recentNames[0]).toBe("alice");
    });

    it("moves re-added name to front", () => {
      const { result } = renderHook(() => useHistory());

      act(() => result.current.addRecentName("Alice"));
      act(() => result.current.addRecentName("Bob"));
      act(() => result.current.addRecentName("Alice"));

      expect(result.current.recentNames[0]).toBe("Alice");
    });

    it("caps at 10 names", () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        for (let i = 0; i < 15; i++) {
          result.current.addRecentName(`Name${i}`);
        }
      });

      expect(result.current.recentNames.length).toBeLessThanOrEqual(10);
    });
  });

  // ==================== retention settings ====================

  describe("retention settings", () => {
    it("defaults retention to enabled with 90 days", () => {
      const { result } = renderHook(() => useHistory());

      expect(result.current.retentionEnabled).toBe(true);
      expect(result.current.retentionDays).toBe(90);
    });

    it("updates retention enabled", () => {
      const { result } = renderHook(() => useHistory());

      act(() => result.current.updateRetentionEnabled(false));

      expect(result.current.retentionEnabled).toBe(false);
    });

    it("clamps retention days to min 7", () => {
      const { result } = renderHook(() => useHistory());

      act(() => result.current.updateRetentionDays(1));

      expect(result.current.retentionDays).toBe(7);
    });

    it("clamps retention days to max 365", () => {
      const { result } = renderHook(() => useHistory());

      act(() => result.current.updateRetentionDays(1000));

      expect(result.current.retentionDays).toBe(365);
    });

    it("accepts valid retention days", () => {
      const { result } = renderHook(() => useHistory());

      act(() => result.current.updateRetentionDays(30));

      expect(result.current.retentionDays).toBe(30);
    });
  });

  // ==================== cleanupOldHistory ====================

  describe("cleanupOldHistory", () => {
    it("does nothing when retention is disabled", () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.addToHistory(makeItem("old", 200));
        result.current.updateRetentionEnabled(false);
      });

      let cleanup: { deletedCount: number };
      act(() => {
        cleanup = result.current.cleanupOldHistory();
      });

      expect(cleanup!.deletedCount).toBe(0);
      expect(result.current.history).toHaveLength(1);
    });

    it("removes items older than retention period", () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.updateRetentionDays(30);
        result.current.addToHistory(makeItem("recent", 5));
        result.current.addToHistory(makeItem("old", 60));
      });

      let cleanup: { deletedCount: number; deletedItems: HistoryItem[] };
      act(() => {
        cleanup = result.current.cleanupOldHistory();
      });

      expect(cleanup!.deletedCount).toBe(1);
      expect(cleanup!.deletedItems[0].id).toBe("old");
    });

    it("keeps items within retention period", () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.updateRetentionDays(90);
        result.current.addToHistory(makeItem("recent", 10));
        result.current.addToHistory(makeItem("also-recent", 80));
      });

      let cleanup: { deletedCount: number };
      act(() => {
        cleanup = result.current.cleanupOldHistory();
      });

      expect(cleanup!.deletedCount).toBe(0);
      expect(result.current.history).toHaveLength(2);
    });

    it("returns deleted items in result", () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.updateRetentionDays(7);
        result.current.addToHistory(makeItem("a", 3));
        result.current.addToHistory(makeItem("b", 20));
        result.current.addToHistory(makeItem("c", 30));
      });

      let cleanup: { deletedCount: number; deletedItems: HistoryItem[] };
      act(() => {
        cleanup = result.current.cleanupOldHistory();
      });

      expect(cleanup!.deletedCount).toBe(2);
      expect(cleanup!.deletedItems.map(i => i.id).sort()).toEqual(["b", "c"]);
    });
  });

  // ==================== shouldRunCleanup ====================

  describe("shouldRunCleanup", () => {
    it("returns true when no last check is stored", () => {
      const { result } = renderHook(() => useHistory());

      expect(result.current.shouldRunCleanup()).toBe(true);
    });

    it("returns false when last check was recent", () => {
      localStorage.setItem(
        "smartTool.lastRetentionCheck",
        new Date().toISOString()
      );
      const { result } = renderHook(() => useHistory());

      expect(result.current.shouldRunCleanup()).toBe(false);
    });

    it("returns true when last check was over 24 hours ago", () => {
      const old = new Date();
      old.setHours(old.getHours() - 25);
      localStorage.setItem(
        "smartTool.lastRetentionCheck",
        old.toISOString()
      );
      const { result } = renderHook(() => useHistory());

      expect(result.current.shouldRunCleanup()).toBe(true);
    });

    it("returns false when last check value is invalid (NaN comparison)", () => {
      localStorage.setItem("smartTool.lastRetentionCheck", "not-a-date");
      const { result } = renderHook(() => useHistory());

      // new Date("not-a-date") produces NaN; (now - NaN) / ms = NaN; NaN >= 24 = false
      expect(result.current.shouldRunCleanup()).toBe(false);
    });
  });
});
