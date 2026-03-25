import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFeedback } from "@/hooks/useFeedback";

describe("useFeedback", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("initial state", () => {
    it("starts with empty feedback array", () => {
      const { result } = renderHook(() => useFeedback());
      expect(result.current.actionFeedback).toEqual([]);
    });
  });

  describe("addFeedback", () => {
    it("adds a feedback entry with auto-generated id and timestamp", () => {
      const { result } = renderHook(() => useFeedback());

      act(() => {
        result.current.addFeedback({
          barrier: "CV",
          category: "cv",
          rating: "relevant",
          generatedAction: "John will update his CV",
          acceptedAsIs: true,
        });
      });

      expect(result.current.actionFeedback).toHaveLength(1);
      expect(result.current.actionFeedback[0].id).toBeDefined();
      expect(result.current.actionFeedback[0].createdAt).toBeDefined();
      expect(result.current.actionFeedback[0].barrier).toBe("CV");
      expect(result.current.actionFeedback[0].rating).toBe("relevant");
    });

    it("prepends new feedback (most recent first)", () => {
      const { result } = renderHook(() => useFeedback());

      act(() => {
        result.current.addFeedback({
          barrier: "CV",
          category: "cv",
          rating: "relevant",
          generatedAction: "First action",
          acceptedAsIs: true,
        });
      });

      act(() => {
        result.current.addFeedback({
          barrier: "Transport",
          category: "transport",
          rating: "not-relevant",
          generatedAction: "Second action",
          acceptedAsIs: false,
        });
      });

      expect(result.current.actionFeedback[0].barrier).toBe("Transport");
      expect(result.current.actionFeedback[1].barrier).toBe("CV");
    });

    it("limits to 500 entries", () => {
      const { result } = renderHook(() => useFeedback());

      act(() => {
        for (let i = 0; i < 510; i++) {
          result.current.addFeedback({
            barrier: `Barrier-${i}`,
            category: "test",
            rating: "relevant",
            generatedAction: `Action ${i}`,
            acceptedAsIs: true,
          });
        }
      });

      expect(result.current.actionFeedback.length).toBeLessThanOrEqual(500);
    });

    it("returns the created record", () => {
      const { result } = renderHook(() => useFeedback());

      let record: unknown;
      act(() => {
        record = result.current.addFeedback({
          barrier: "CV",
          category: "cv",
          rating: "relevant",
          generatedAction: "Test action",
          acceptedAsIs: true,
        });
      });

      expect(record).toHaveProperty("id");
      expect(record).toHaveProperty("createdAt");
    });
  });

  describe("updateFeedback", () => {
    it("updates feedback by id", () => {
      const { result } = renderHook(() => useFeedback());

      let id: string;
      act(() => {
        const record = result.current.addFeedback({
          barrier: "CV",
          category: "cv",
          rating: "relevant",
          generatedAction: "Test action",
          acceptedAsIs: true,
        });
        id = record.id;
      });

      act(() => {
        result.current.updateFeedback(id!, { rating: "not-relevant" });
      });

      expect(result.current.actionFeedback[0].rating).toBe("not-relevant");
    });

    it("does not affect other entries", () => {
      const { result } = renderHook(() => useFeedback());

      act(() => {
        result.current.addFeedback({
          barrier: "CV",
          category: "cv",
          rating: "relevant",
          generatedAction: "First",
          acceptedAsIs: true,
        });
        result.current.addFeedback({
          barrier: "Transport",
          category: "transport",
          rating: "relevant",
          generatedAction: "Second",
          acceptedAsIs: true,
        });
      });

      const firstId = result.current.actionFeedback[1].id;

      act(() => {
        result.current.updateFeedback(firstId, { rating: "not-relevant" });
      });

      // The other entry should be unchanged
      expect(result.current.actionFeedback[0].rating).toBe("relevant");
    });
  });

  describe("getAcceptedExemplars", () => {
    it("returns entries matching barrier that are rated relevant", () => {
      const { result } = renderHook(() => useFeedback());

      act(() => {
        result.current.addFeedback({
          barrier: "CV",
          category: "cv",
          rating: "relevant",
          generatedAction: "Good CV action",
          acceptedAsIs: true,
        });
        result.current.addFeedback({
          barrier: "Transport",
          category: "transport",
          rating: "relevant",
          generatedAction: "Transport action",
          acceptedAsIs: true,
        });
      });

      const exemplars = result.current.getAcceptedExemplars("CV");
      expect(exemplars).toHaveLength(1);
      expect(exemplars[0].barrier).toBe("CV");
    });

    it("excludes not-relevant entries", () => {
      const { result } = renderHook(() => useFeedback());

      act(() => {
        result.current.addFeedback({
          barrier: "CV",
          category: "cv",
          rating: "not-relevant",
          generatedAction: "Bad action",
          acceptedAsIs: false,
        });
      });

      const exemplars = result.current.getAcceptedExemplars("CV");
      expect(exemplars).toHaveLength(0);
    });

    it("includes acceptedAsIs entries even without rating", () => {
      const { result } = renderHook(() => useFeedback());

      act(() => {
        result.current.addFeedback({
          barrier: "CV",
          category: "cv",
          rating: null as unknown as string,
          generatedAction: "Accepted action",
          acceptedAsIs: true,
        });
      });

      const exemplars = result.current.getAcceptedExemplars("CV");
      expect(exemplars).toHaveLength(1);
    });

    it("matches barrier case-insensitively", () => {
      const { result } = renderHook(() => useFeedback());

      act(() => {
        result.current.addFeedback({
          barrier: "CV",
          category: "cv",
          rating: "relevant",
          generatedAction: "Action",
          acceptedAsIs: true,
        });
      });

      const exemplars = result.current.getAcceptedExemplars("cv");
      expect(exemplars).toHaveLength(1);
    });

    it("matches by category when barrier not provided", () => {
      const { result } = renderHook(() => useFeedback());

      act(() => {
        result.current.addFeedback({
          barrier: "CV Gaps",
          category: "cv",
          rating: "relevant",
          generatedAction: "Action",
          acceptedAsIs: true,
        });
      });

      const exemplars = result.current.getAcceptedExemplars(undefined, "cv");
      expect(exemplars).toHaveLength(1);
    });
  });
});
