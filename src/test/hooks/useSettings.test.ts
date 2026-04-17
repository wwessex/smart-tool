import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSettings } from "@/hooks/useSettings";

describe("useSettings", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ==================== defaults ====================

  describe("defaults", () => {
    it("has correct default values", () => {
      const { result } = renderHook(() => useSettings());

      expect(result.current.minScoreEnabled).toBe(false);
      expect(result.current.minScoreThreshold).toBe(5);
      expect(result.current.participantLanguage).toBe("none");
      expect(result.current.aiDraftMode).toBe("ai");
      expect(result.current.aiDraftRuntime).toBe("auto");
      expect(result.current.preferredLLMModel).toBeNull();
      expect(result.current.allowMobileLLM).toBe(false);
      expect(result.current.safariWebGPUEnabled).toBe(false);
      expect(result.current.keepSafariModelLoaded).toBe(false);
    });
  });

  // ==================== minScoreEnabled ====================

  describe("updateMinScoreEnabled", () => {
    it("toggles min score enabled", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateMinScoreEnabled(true));
      expect(result.current.minScoreEnabled).toBe(true);

      act(() => result.current.updateMinScoreEnabled(false));
      expect(result.current.minScoreEnabled).toBe(false);
    });

    it("persists to localStorage", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateMinScoreEnabled(true));

      expect(localStorage.getItem("smartTool.minScoreEnabled")).toBe("true");
    });
  });

  // ==================== minScoreThreshold ====================

  describe("updateMinScoreThreshold", () => {
    it("sets a valid threshold", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateMinScoreThreshold(3));

      expect(result.current.minScoreThreshold).toBe(3);
    });

    it("clamps threshold to min 1", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateMinScoreThreshold(0));

      expect(result.current.minScoreThreshold).toBe(1);
    });

    it("clamps threshold to max 5", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateMinScoreThreshold(10));

      expect(result.current.minScoreThreshold).toBe(5);
    });

    it("rounds non-integer values", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateMinScoreThreshold(3.7));

      expect(result.current.minScoreThreshold).toBe(4);
    });

    it("handles NaN by defaulting to 5", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateMinScoreThreshold(NaN));

      expect(result.current.minScoreThreshold).toBe(5);
    });

    it("handles Infinity by defaulting to 5", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateMinScoreThreshold(Infinity));

      expect(result.current.minScoreThreshold).toBe(5);
    });

    it("persists clamped value to localStorage", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateMinScoreThreshold(10));

      expect(localStorage.getItem("smartTool.minScoreThreshold")).toBe("5");
    });
  });

  // ==================== participantLanguage ====================

  describe("updateParticipantLanguage", () => {
    it("updates language", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateParticipantLanguage("es"));

      expect(result.current.participantLanguage).toBe("es");
    });

    it("persists to localStorage", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateParticipantLanguage("fr"));

      expect(localStorage.getItem("smartTool.participantLanguage")).toBe("fr");
    });
  });

  // ==================== aiDraftMode ====================

  describe("updateAIDraftMode", () => {
    it("switches to template mode", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateAIDraftMode("template"));

      expect(result.current.aiDraftMode).toBe("template");
    });

    it("switches back to ai mode", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateAIDraftMode("template"));
      act(() => result.current.updateAIDraftMode("ai"));

      expect(result.current.aiDraftMode).toBe("ai");
    });
  });

  describe("updateAIDraftRuntime", () => {
    it("defaults to auto and persists browser/helper runtime changes", () => {
      const { result } = renderHook(() => useSettings());

      expect(result.current.aiDraftRuntime).toBe("auto");

      act(() => result.current.updateAIDraftRuntime("browser"));
      expect(result.current.aiDraftRuntime).toBe("browser");
      expect(localStorage.getItem("smartTool.aiDraftRuntime")).toBe("browser");

      act(() => result.current.updateAIDraftRuntime("desktop-helper"));
      expect(result.current.aiDraftRuntime).toBe("desktop-helper");
      expect(localStorage.getItem("smartTool.aiDraftRuntime")).toBe("desktop-helper");
    });
  });

  // ==================== preferredLLMModel ====================

  describe("updatePreferredLLMModel", () => {
    it("sets a model", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updatePreferredLLMModel("model-1"));

      expect(result.current.preferredLLMModel).toBe("model-1");
    });

    it("clears model with null", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updatePreferredLLMModel("model-1"));
      act(() => result.current.updatePreferredLLMModel(null));

      expect(result.current.preferredLLMModel).toBeNull();
    });

    it("removes localStorage key when set to null", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updatePreferredLLMModel("model-1"));
      act(() => result.current.updatePreferredLLMModel(null));

      expect(localStorage.getItem("smartTool.preferredLLMModel")).toBeNull();
    });
  });

  // ==================== boolean toggles ====================

  describe("boolean toggle settings", () => {
    it("toggles allowMobileLLM", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateAllowMobileLLM(true));
      expect(result.current.allowMobileLLM).toBe(true);
      expect(localStorage.getItem("smartTool.allowMobileLLM")).toBe("true");
    });

    it("toggles safariWebGPUEnabled", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateSafariWebGPUEnabled(true));
      expect(result.current.safariWebGPUEnabled).toBe(true);
      expect(localStorage.getItem("smartTool.safariWebGPUEnabled")).toBe("true");
    });

    it("toggles keepSafariModelLoaded", () => {
      const { result } = renderHook(() => useSettings());

      act(() => result.current.updateKeepSafariModelLoaded(true));
      expect(result.current.keepSafariModelLoaded).toBe(true);
      expect(localStorage.getItem("smartTool.keepSafariModelLoaded")).toBe("true");
    });
  });

  // ==================== loading from localStorage ====================

  describe("loading persisted values", () => {
    it("loads aiDraftMode from localStorage", () => {
      localStorage.setItem("smartTool.aiDraftMode", "template");

      const { result } = renderHook(() => useSettings());

      expect(result.current.aiDraftMode).toBe("template");
    });

    it("loads aiDraftRuntime from localStorage", () => {
      localStorage.setItem("smartTool.aiDraftRuntime", "desktop-helper");

      const { result } = renderHook(() => useSettings());

      expect(result.current.aiDraftRuntime).toBe("desktop-helper");
    });

    it("defaults aiDraftMode to ai for unknown stored value", () => {
      localStorage.setItem("smartTool.aiDraftMode", "unknown-mode");

      const { result } = renderHook(() => useSettings());

      expect(result.current.aiDraftMode).toBe("ai");
    });

    it("loads preferredLLMModel from localStorage", () => {
      localStorage.setItem("smartTool.preferredLLMModel", "my-model");

      const { result } = renderHook(() => useSettings());

      expect(result.current.preferredLLMModel).toBe("my-model");
    });

    it("loads boolean settings from localStorage", () => {
      localStorage.setItem("smartTool.minScoreEnabled", "true");
      localStorage.setItem("smartTool.allowMobileLLM", "true");

      const { result } = renderHook(() => useSettings());

      expect(result.current.minScoreEnabled).toBe(true);
      expect(result.current.allowMobileLLM).toBe(true);
    });
  });
});
