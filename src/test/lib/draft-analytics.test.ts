import { describe, it, expect, beforeEach } from "vitest";
import {
  clearDraftAnalytics,
  loadDraftAnalytics,
  logDraftAnalytics,
} from "@/lib/draft-analytics";

describe("draft-analytics", () => {
  beforeEach(() => {
    clearDraftAnalytics();
  });

  it("stores primary acceptance metadata", () => {
    logDraftAnalytics({
      timestamp: "2026-04-17T10:00:00.000Z",
      signal: "accepted",
      barrier: "I keep forgetting",
      barrier_type: "habit",
      generated_text: "Set a daily reminder to review saved vacancies by 24-Apr-26.",
      relevance_score: 0.92,
      draft_mode: "primary",
      source: "ai",
    });

    expect(loadDraftAnalytics()).toEqual([
      expect.objectContaining({
        signal: "accepted",
        barrier_type: "habit",
        draft_mode: "primary",
        relevance_score: 0.92,
      }),
    ]);
  });

  it("stores More like this usage events", () => {
    logDraftAnalytics({
      timestamp: "2026-04-17T10:05:00.000Z",
      signal: "more_like_this",
      barrier: "CV",
      barrier_type: "clarity",
      draft_mode: "alternates",
      source: "ai",
    });

    expect(loadDraftAnalytics()[0]).toMatchObject({
      signal: "more_like_this",
      barrier: "CV",
      draft_mode: "alternates",
    });
  });

  it("stores explicit feedback vote events with the selected rating", () => {
    logDraftAnalytics({
      timestamp: "2026-04-17T10:10:00.000Z",
      signal: "feedback_not_relevant",
      barrier: "CV",
      generated_text: "Review generic job boards by Friday.",
      feedback_rating: "not-relevant",
      source: "ai",
    });

    logDraftAnalytics({
      timestamp: "2026-04-17T10:11:00.000Z",
      signal: "feedback_cleared",
      barrier: "CV",
      generated_text: "Review generic job boards by Friday.",
      feedback_rating: null,
      source: "ai",
    });

    expect(loadDraftAnalytics()).toEqual([
      expect.objectContaining({
        signal: "feedback_not_relevant",
        feedback_rating: "not-relevant",
      }),
      expect.objectContaining({
        signal: "feedback_cleared",
        feedback_rating: null,
      }),
    ]);
  });
});
