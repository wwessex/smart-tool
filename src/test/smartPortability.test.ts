import { describe, it, expect } from "vitest";
import { parseSmartToolImportFile } from "@/lib/smart-portability";
import { renderHook, act } from "@testing-library/react";
import { useSmartStorage, type ActionTemplate, type HistoryItem } from "@/hooks/useSmartStorage";

const sampleHistoryItem: HistoryItem = {
  id: "h1",
  mode: "now",
  createdAt: "2026-01-01T00:00:00.000Z",
  text: "John will do something by next week.",
  meta: {
    date: "2026-01-01",
    forename: "John",
    barrier: "Confidence",
    timescale: "2 weeks",
    translatedText: "Juan hará algo para la próxima semana.",
    translationLanguage: "es",
  },
};

const sampleTemplate: ActionTemplate = {
  id: "t1",
  name: "CV update",
  mode: "now",
  createdAt: "2026-01-01T00:00:00.000Z",
  barrier: "CV",
  action: "Update CV",
  responsible: "Participant",
  help: "Advisor will review",
};

describe("smart portability", () => {
  it("parses canonical (v2) top-level export payload", () => {
    const raw = {
      version: 2,
      exportedAt: "2026-01-02T00:00:00.000Z",
      history: [sampleHistoryItem],
      barriers: ["Confidence"],
      timescales: ["2 weeks"],
      recentNames: ["John"],
      templates: [sampleTemplate],
      settings: {
        minScoreEnabled: true,
        minScoreThreshold: 4,
        retentionEnabled: false,
        retentionDays: 30,
        participantLanguage: "es",
      },
    };

    const parsed = parseSmartToolImportFile(raw);
    expect(parsed.history?.[0]?.meta.translationLanguage).toBe("es");
    expect(parsed.templates?.[0]?.name).toBe("CV update");
    expect(parsed.settings?.minScoreThreshold).toBe(4);
  });

  it("parses legacy exportAllData payload with `data` wrapper", () => {
    const raw = {
      version: 1,
      exportedAt: "2026-01-02T00:00:00.000Z",
      data: {
        history: [sampleHistoryItem],
        barriers: ["Confidence"],
        timescales: ["2 weeks"],
        recentNames: ["John"],
        templates: [sampleTemplate],
        settings: { minScoreEnabled: true, minScoreThreshold: 3 },
      },
    };

    const parsed = parseSmartToolImportFile(raw);
    expect(parsed.history?.length).toBe(1);
    expect(parsed.settings?.minScoreThreshold).toBe(3);
  });

  it("parses legacy history export payload (top-level history/barriers/timescales)", () => {
    const raw = {
      version: 1,
      exportedAt: "2026-01-02T00:00:00.000Z",
      history: [sampleHistoryItem],
      barriers: ["Confidence"],
      timescales: ["2 weeks"],
    };

    const parsed = parseSmartToolImportFile(raw);
    expect(parsed.history?.[0]?.id).toBe("h1");
    expect(parsed.templates).toBeUndefined();
  });

  it("round-trips via storage import/export without a `data` wrapper", () => {
    localStorage.clear();

    const { result } = renderHook(() => useSmartStorage());
    act(() => {
      result.current.importData({
        history: [sampleHistoryItem],
        barriers: ["Confidence"],
        timescales: ["2 weeks"],
        recentNames: [" John ", "john", "Alice"],
        templates: [sampleTemplate],
        settings: {
          minScoreEnabled: true,
          minScoreThreshold: 4,
          retentionEnabled: false,
          retentionDays: 30,
          participantLanguage: "es",
        },
      });
    });

    const exported = result.current.exportAllData();
    expect("data" in exported).toBe(false);
    expect(exported.version).toBe(2);
    expect(exported.recentNames).toEqual(["John", "Alice"]);
    expect(exported.settings.participantLanguage).toBe("es");
  });

  it("import validation accepts templates, recentNames, and settings", () => {
    // Verify schema explicitly includes all expected fields
    const fullPayload = {
      version: 2,
      exportedAt: "2026-01-02T00:00:00.000Z",
      history: [sampleHistoryItem],
      barriers: ["Confidence", "Transport"],
      timescales: ["2 weeks", "1 month"],
      recentNames: ["John", "Jane", "Bob"],
      templates: [sampleTemplate],
      settings: {
        minScoreEnabled: true,
        minScoreThreshold: 3,
        retentionEnabled: true,
        retentionDays: 60,
        participantLanguage: "fr",
      },
    };

    const parsed = parseSmartToolImportFile(fullPayload);

    // Verify all fields are properly parsed
    expect(parsed.history).toHaveLength(1);
    expect(parsed.barriers).toEqual(["Confidence", "Transport"]);
    expect(parsed.timescales).toEqual(["2 weeks", "1 month"]);
    expect(parsed.recentNames).toEqual(["John", "Jane", "Bob"]);
    expect(parsed.templates).toHaveLength(1);
    expect(parsed.templates?.[0]?.name).toBe("CV update");
    expect(parsed.settings?.minScoreEnabled).toBe(true);
    expect(parsed.settings?.minScoreThreshold).toBe(3);
    expect(parsed.settings?.retentionEnabled).toBe(true);
    expect(parsed.settings?.retentionDays).toBe(60);
    expect(parsed.settings?.participantLanguage).toBe("fr");
  });

  it("storage importData properly stores templates, recentNames, and settings", () => {
    localStorage.clear();

    const { result } = renderHook(() => useSmartStorage());

    // Import data with all fields
    act(() => {
      result.current.importData({
        templates: [sampleTemplate],
        recentNames: ["Alice", "Bob"],
        settings: {
          minScoreEnabled: true,
          minScoreThreshold: 4,
          retentionEnabled: false,
          retentionDays: 120,
          participantLanguage: "de",
        },
      });
    });

    // Verify templates are stored
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.templates[0].name).toBe("CV update");

    // Verify recentNames are stored
    expect(result.current.recentNames).toEqual(["Alice", "Bob"]);

    // Verify settings are stored
    expect(result.current.minScoreEnabled).toBe(true);
    expect(result.current.minScoreThreshold).toBe(4);
    expect(result.current.retentionEnabled).toBe(false);
    expect(result.current.retentionDays).toBe(120);
    expect(result.current.participantLanguage).toBe("de");
  });
});

