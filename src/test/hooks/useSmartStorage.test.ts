import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSmartStorage, type HistoryItem, type ActionTemplate } from "@/hooks/useSmartStorage";

// Helper to create history items with specific dates
function createHistoryItem(id: string, daysAgo: number): HistoryItem {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    id,
    mode: "now",
    createdAt: date.toISOString(),
    text: `Test action ${id}`,
    meta: {
      date: date.toISOString().slice(0, 10),
      forename: "Test",
      barrier: "CV",
      timescale: "2 weeks",
    },
  };
}

// Helper to create template
function createTemplate(id: string, name: string): ActionTemplate {
  return {
    id,
    name,
    mode: "now",
    createdAt: new Date().toISOString(),
    barrier: "CV",
    action: "Test action",
    responsible: "Participant",
    help: "Test help",
  };
}

describe("useSmartStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("loads with default barriers and timescales", () => {
      const { result } = renderHook(() => useSmartStorage());

      expect(result.current.barriers.length).toBeGreaterThan(0);
      expect(result.current.timescales.length).toBeGreaterThan(0);
    });

    it("loads with empty history when no data exists", () => {
      const { result } = renderHook(() => useSmartStorage());

      expect(result.current.history).toEqual([]);
    });

    it("loads with default settings", () => {
      const { result } = renderHook(() => useSmartStorage());

      expect(result.current.minScoreEnabled).toBe(false);
      expect(result.current.minScoreThreshold).toBe(5);
      expect(result.current.retentionEnabled).toBe(true);
      expect(result.current.retentionDays).toBe(90);
    });
  });

  describe("history management", () => {
    it("adds items to history", () => {
      const { result } = renderHook(() => useSmartStorage());
      const item = createHistoryItem("h1", 0);

      act(() => {
        result.current.addToHistory(item);
      });

      expect(result.current.history.length).toBe(1);
      expect(result.current.history[0].id).toBe("h1");
    });

    it("prepends new items to history", () => {
      const { result } = renderHook(() => useSmartStorage());
      const item1 = createHistoryItem("h1", 0);
      const item2 = createHistoryItem("h2", 0);

      act(() => {
        result.current.addToHistory(item1);
        result.current.addToHistory(item2);
      });

      expect(result.current.history[0].id).toBe("h2");
      expect(result.current.history[1].id).toBe("h1");
    });

    it("limits history to 100 items", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        for (let i = 0; i < 105; i++) {
          result.current.addToHistory(createHistoryItem(`h${i}`, 0));
        }
      });

      expect(result.current.history.length).toBe(100);
    });

    it("deletes items from history", () => {
      const { result } = renderHook(() => useSmartStorage());
      const item = createHistoryItem("h1", 0);

      act(() => {
        result.current.addToHistory(item);
      });

      expect(result.current.history.length).toBe(1);

      act(() => {
        result.current.deleteFromHistory("h1");
      });

      expect(result.current.history.length).toBe(0);
    });

    it("clears all history", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.addToHistory(createHistoryItem("h1", 0));
        result.current.addToHistory(createHistoryItem("h2", 0));
        result.current.addToHistory(createHistoryItem("h3", 0));
      });

      expect(result.current.history.length).toBe(3);

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.history.length).toBe(0);
    });
  });

  describe("cleanupOldHistory", () => {
    it("deletes items older than retention days", () => {
      const { result } = renderHook(() => useSmartStorage());

      // Add items with different ages
      act(() => {
        result.current.addToHistory(createHistoryItem("recent", 10)); // 10 days ago
        result.current.addToHistory(createHistoryItem("old", 100)); // 100 days ago (older than 90)
      });

      expect(result.current.history.length).toBe(2);

      act(() => {
        const cleanup = result.current.cleanupOldHistory();
        expect(cleanup.deletedCount).toBe(1);
        expect(cleanup.deletedItems[0].id).toBe("old");
      });

      expect(result.current.history.length).toBe(1);
      expect(result.current.history[0].id).toBe("recent");
    });

    it("respects retentionEnabled flag", () => {
      const { result } = renderHook(() => useSmartStorage());

      // Disable retention
      act(() => {
        result.current.updateRetentionEnabled(false);
      });

      // Add old item
      act(() => {
        result.current.addToHistory(createHistoryItem("old", 100));
      });

      act(() => {
        const cleanup = result.current.cleanupOldHistory();
        expect(cleanup.deletedCount).toBe(0);
      });

      // Old item should still be there
      expect(result.current.history.length).toBe(1);
    });

    it("uses custom retention days", () => {
      const { result } = renderHook(() => useSmartStorage());

      // Set retention to 30 days
      act(() => {
        result.current.updateRetentionDays(30);
      });

      // Add items
      act(() => {
        result.current.addToHistory(createHistoryItem("recent", 20)); // Within 30 days
        result.current.addToHistory(createHistoryItem("old", 40)); // Older than 30 days
      });

      act(() => {
        const cleanup = result.current.cleanupOldHistory();
        expect(cleanup.deletedCount).toBe(1);
      });

      expect(result.current.history.length).toBe(1);
      expect(result.current.history[0].id).toBe("recent");
    });

    it("returns deleted items for reference", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.addToHistory(createHistoryItem("old1", 100));
        result.current.addToHistory(createHistoryItem("old2", 95));
      });

      let cleanup: { deletedCount: number; deletedItems: HistoryItem[] };
      act(() => {
        cleanup = result.current.cleanupOldHistory();
      });

      expect(cleanup!.deletedCount).toBe(2);
      expect(cleanup!.deletedItems.length).toBe(2);
    });

    it("does nothing when no items are expired", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.addToHistory(createHistoryItem("recent1", 10));
        result.current.addToHistory(createHistoryItem("recent2", 20));
      });

      act(() => {
        const cleanup = result.current.cleanupOldHistory();
        expect(cleanup.deletedCount).toBe(0);
        expect(cleanup.deletedItems).toEqual([]);
      });

      expect(result.current.history.length).toBe(2);
    });
  });

  describe("shouldRunCleanup", () => {
    it("returns true when no last check exists", () => {
      const { result } = renderHook(() => useSmartStorage());

      expect(result.current.shouldRunCleanup()).toBe(true);
    });

    it("returns false when checked recently", () => {
      const { result } = renderHook(() => useSmartStorage());

      // Run cleanup to set last check time
      act(() => {
        result.current.cleanupOldHistory();
      });

      expect(result.current.shouldRunCleanup()).toBe(false);
    });
  });

  describe("template management", () => {
    it("adds templates", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.addTemplate({
          name: "Test Template",
          mode: "now",
          barrier: "CV",
          action: "Test action",
          responsible: "Participant",
          help: "Test help",
        });
      });

      expect(result.current.templates.length).toBe(1);
      expect(result.current.templates[0].name).toBe("Test Template");
      expect(result.current.templates[0].id).toBeDefined();
    });

    it("limits templates to 50", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        for (let i = 0; i < 55; i++) {
          result.current.addTemplate({
            name: `Template ${i}`,
            mode: "now",
            barrier: "CV",
          });
        }
      });

      expect(result.current.templates.length).toBe(50);
    });

    it("deletes templates", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.addTemplate({
          name: "Test Template",
          mode: "now",
          barrier: "CV",
        });
      });

      const templateId = result.current.templates[0].id;

      act(() => {
        result.current.deleteTemplate(templateId);
      });

      expect(result.current.templates.length).toBe(0);
    });

    it("updates templates", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.addTemplate({
          name: "Original Name",
          mode: "now",
          barrier: "CV",
        });
      });

      const templateId = result.current.templates[0].id;

      act(() => {
        result.current.updateTemplate(templateId, { name: "Updated Name" });
      });

      expect(result.current.templates[0].name).toBe("Updated Name");
    });
  });

  describe("settings validation", () => {
    it("clamps minScoreThreshold to 1-5 range", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.updateMinScoreThreshold(10);
      });
      expect(result.current.minScoreThreshold).toBe(5);

      act(() => {
        result.current.updateMinScoreThreshold(0);
      });
      expect(result.current.minScoreThreshold).toBe(1);

      act(() => {
        result.current.updateMinScoreThreshold(3);
      });
      expect(result.current.minScoreThreshold).toBe(3);
    });

    it("clamps retentionDays to 7-365 range", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.updateRetentionDays(1000);
      });
      expect(result.current.retentionDays).toBe(365);

      act(() => {
        result.current.updateRetentionDays(1);
      });
      expect(result.current.retentionDays).toBe(7);

      act(() => {
        result.current.updateRetentionDays(60);
      });
      expect(result.current.retentionDays).toBe(60);
    });
  });

  describe("recent names", () => {
    it("adds recent names", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.addRecentName("John");
      });

      expect(result.current.recentNames).toContain("John");
    });

    it("deduplicates names case-insensitively", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.addRecentName("John");
        result.current.addRecentName("JOHN");
        result.current.addRecentName("john");
      });

      expect(result.current.recentNames.length).toBe(1);
    });

    it("moves recently used names to front", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.addRecentName("Alice");
        result.current.addRecentName("Bob");
        result.current.addRecentName("Alice"); // Use Alice again
      });

      expect(result.current.recentNames[0]).toBe("Alice");
    });

    it("limits to 10 recent names", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        for (let i = 0; i < 15; i++) {
          result.current.addRecentName(`Name${i}`);
        }
      });

      expect(result.current.recentNames.length).toBe(10);
    });

    it("ignores empty names", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.addRecentName("");
        result.current.addRecentName("   ");
      });

      expect(result.current.recentNames.length).toBe(0);
    });
  });

  describe("GDPR operations", () => {
    it("exports all data in correct format", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.addToHistory(createHistoryItem("h1", 0));
        result.current.addRecentName("John");
        result.current.addTemplate({
          name: "Test",
          mode: "now",
          barrier: "CV",
        });
      });

      const exported = result.current.exportAllData();

      expect(exported.version).toBe(2);
      expect(exported.exportedAt).toBeDefined();
      expect(exported.history.length).toBe(1);
      expect(exported.recentNames).toContain("John");
      expect(exported.templates.length).toBe(1);
      expect(exported.settings).toBeDefined();
      expect(exported.barriers).toBeDefined();
      expect(exported.timescales).toBeDefined();
    });

    it("deletes all data completely", () => {
      const { result } = renderHook(() => useSmartStorage());

      // Add some data
      act(() => {
        result.current.addToHistory(createHistoryItem("h1", 0));
        result.current.addRecentName("John");
        result.current.addTemplate({
          name: "Test",
          mode: "now",
          barrier: "CV",
        });
        result.current.updateMinScoreEnabled(true);
      });

      // Verify data exists
      expect(result.current.history.length).toBe(1);
      expect(result.current.recentNames.length).toBe(1);
      expect(result.current.templates.length).toBe(1);
      expect(result.current.minScoreEnabled).toBe(true);

      // Delete all data
      act(() => {
        result.current.deleteAllData();
      });

      // Verify everything is reset
      expect(result.current.history.length).toBe(0);
      expect(result.current.recentNames.length).toBe(0);
      expect(result.current.templates.length).toBe(0);
      expect(result.current.minScoreEnabled).toBe(false);
      expect(result.current.minScoreThreshold).toBe(5);
    });
  });

  describe("barriers and timescales", () => {
    it("updates barriers", () => {
      const { result } = renderHook(() => useSmartStorage());
      const newBarriers = ["Barrier 1", "Barrier 2"];

      act(() => {
        result.current.updateBarriers(newBarriers);
      });

      expect(result.current.barriers).toEqual(newBarriers);
    });

    it("resets barriers to defaults", () => {
      const { result } = renderHook(() => useSmartStorage());
      const originalBarriers = [...result.current.barriers];

      act(() => {
        result.current.updateBarriers(["Custom"]);
      });

      expect(result.current.barriers).toEqual(["Custom"]);

      act(() => {
        result.current.resetBarriers();
      });

      expect(result.current.barriers).toEqual(originalBarriers);
    });

    it("updates timescales", () => {
      const { result } = renderHook(() => useSmartStorage());
      const newTimescales = ["1 day", "1 week"];

      act(() => {
        result.current.updateTimescales(newTimescales);
      });

      expect(result.current.timescales).toEqual(newTimescales);
    });

    it("resets timescales to defaults", () => {
      const { result } = renderHook(() => useSmartStorage());
      const originalTimescales = [...result.current.timescales];

      act(() => {
        result.current.updateTimescales(["Custom"]);
      });

      act(() => {
        result.current.resetTimescales();
      });

      expect(result.current.timescales).toEqual(originalTimescales);
    });
  });

  describe("AI and language settings", () => {
    it("updates participant language", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.updateParticipantLanguage("es");
      });

      expect(result.current.participantLanguage).toBe("es");
    });

    it("updates AI draft mode", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.updateAIDraftMode("template");
      });

      expect(result.current.aiDraftMode).toBe("template");

      act(() => {
        result.current.updateAIDraftMode("ai");
      });

      expect(result.current.aiDraftMode).toBe("ai");
    });

    it("updates preferred LLM model", () => {
      const { result } = renderHook(() => useSmartStorage());

      act(() => {
        result.current.updatePreferredLLMModel("test-model");
      });

      expect(result.current.preferredLLMModel).toBe("test-model");

      act(() => {
        result.current.updatePreferredLLMModel(null);
      });

      expect(result.current.preferredLLMModel).toBeNull();
    });

    it("updates allowMobileLLM setting", () => {
      const { result } = renderHook(() => useSmartStorage());

      expect(result.current.allowMobileLLM).toBe(false);

      act(() => {
        result.current.updateAllowMobileLLM(true);
      });

      expect(result.current.allowMobileLLM).toBe(true);
    });
  });
});
