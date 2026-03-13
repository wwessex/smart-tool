import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSmartForm } from "@/hooks/useSmartForm";

/**
 * Integration tests for the main SMART tool flow.
 *
 * SmartActionTool.tsx has deep dependencies (Supabase, LLM, translation,
 * next-themes, framer-motion) which make full render tests impractical
 * without extensive mocking. Instead, we test the core logic flows via
 * the extracted hooks, which is where the real complexity lives.
 *
 * Component-level visual/interaction tests for individual panels
 * (OutputPanel, HistoryPanel, SmartChecklist, etc.) are in their own
 * dedicated test files.
 */

describe("SmartActionTool — form hook integration", () => {
  it("initializes with now mode and empty forms", () => {
    const { result } = renderHook(() => useSmartForm());

    expect(result.current.mode).toBe("now");
    expect(result.current.nowForm.forename).toBe("");
    expect(result.current.taskBasedForm.forename).toBe("");
    expect(result.current.isValid).toBe(false);
  });

  it("switches between now and task-based modes", () => {
    const { result } = renderHook(() => useSmartForm());

    expect(result.current.mode).toBe("now");

    act(() => {
      result.current.setMode("future");
    });

    expect(result.current.mode).toBe("future");

    act(() => {
      result.current.setMode("now");
    });

    expect(result.current.mode).toBe("now");
  });

  it("validates now form — requires all fields", () => {
    const { result } = renderHook(() => useSmartForm());

    // Empty form is invalid
    expect(result.current.validateNow()).toBe(false);

    // Fill all required fields
    act(() => {
      result.current.setNowForm({
        date: "2026-03-13",
        time: "",
        forename: "John",
        barrier: "CV",
        action: "Update CV by Friday",
        responsible: "Participant",
        help: "get shortlisted for interviews",
        timescale: "2 weeks",
      });
    });

    expect(result.current.validateNow()).toBe(true);
  });

  it("validates task-based form — requires all fields including future date", () => {
    const { result } = renderHook(() => useSmartForm());

    act(() => {
      result.current.setMode("future");
    });

    expect(result.current.validateTaskBased()).toBe(false);

    act(() => {
      result.current.setTaskBasedForm({
        date: result.current.today,
        forename: "Sarah",
        task: "Job Fair at Twickenham",
        responsible: "Participant",
        outcome: "Speak with employers and collect contacts",
        timescale: "2 weeks",
      });
    });

    expect(result.current.validateTaskBased()).toBe(true);
  });

  it("detects past date error for task-based form", () => {
    const { result } = renderHook(() => useSmartForm());

    act(() => {
      result.current.setMode("future");
      result.current.setTaskBasedForm((prev) => ({
        ...prev,
        date: "2020-01-01",
      }));
    });

    expect(result.current.taskBasedDateError).toBeTruthy();
    expect(result.current.taskBasedDateError).toContain("today or in the future");
  });

  it("no date error for task-based form when date is today or later", () => {
    const { result } = renderHook(() => useSmartForm());

    act(() => {
      result.current.setMode("future");
      result.current.setTaskBasedForm((prev) => ({
        ...prev,
        date: result.current.today,
      }));
    });

    expect(result.current.taskBasedDateError).toBe("");
  });

  it("resets form for current mode only", () => {
    const { result } = renderHook(() => useSmartForm());

    // Fill now form
    act(() => {
      result.current.setNowForm((prev) => ({
        ...prev,
        forename: "John",
        barrier: "CV",
      }));
    });

    // Fill task-based form
    act(() => {
      result.current.setTaskBasedForm((prev) => ({
        ...prev,
        forename: "Sarah",
        task: "Job Fair",
      }));
    });

    // Reset now form (current mode is 'now')
    act(() => {
      result.current.resetForm();
    });

    // Now form is reset
    expect(result.current.nowForm.forename).toBe("");
    // Task-based form is untouched
    expect(result.current.taskBasedForm.forename).toBe("Sarah");
  });

  it("isValid reflects the current mode's validation", () => {
    const { result } = renderHook(() => useSmartForm());

    // In 'now' mode, form is invalid (empty)
    expect(result.current.isValid).toBe(false);

    // Fill now form completely
    act(() => {
      result.current.setNowForm({
        date: result.current.today,
        time: "",
        forename: "John",
        barrier: "CV",
        action: "Update CV",
        responsible: "Participant",
        help: "get interviews",
        timescale: "2 weeks",
      });
    });

    expect(result.current.isValid).toBe(true);

    // Switch to task-based - should be invalid (empty)
    act(() => {
      result.current.setMode("future");
    });

    expect(result.current.isValid).toBe(false);
  });

  it("getFieldClass returns empty string when showValidation is false", () => {
    const { result } = renderHook(() => useSmartForm());

    expect(result.current.getFieldClass(true)).toBe("");
    expect(result.current.getFieldClass(false)).toBe("");
  });

  it("getFieldClass returns appropriate classes when showValidation is true", () => {
    const { result } = renderHook(() => useSmartForm());

    act(() => {
      result.current.setShowValidation(true);
    });

    expect(result.current.getFieldClass(true)).toContain("green");
    expect(result.current.getFieldClass(false)).toContain("destructive");
  });
});

describe("SmartActionTool — SMART scoring integration", () => {
  it("checkSmart scores a well-formed action correctly", async () => {
    const { checkSmart } = await import("@/lib/smart-checker");

    const result = checkSmart(
      "During our meeting on 13 Mar 2026, John identified development areas around CV. " +
        "As discussed and agreed, John will update his CV with recent warehouse experience and submit " +
        "3 applications to warehouse roles by 27 Mar 2026. " +
        "This action will help John get shortlisted for interviews. " +
        "We have agreed today that this action is both realistic and achievable. " +
        "This will be reviewed in our next review meeting in 2 weeks.",
      {
        forename: "John",
        barrier: "CV",
        timescale: "2 weeks",
        date: "2026-03-13",
      }
    );

    // A well-formed action should score at least 4/5
    expect(result.overallScore).toBeGreaterThanOrEqual(4);
    expect(result.specific.met).toBe(true);
    expect(result.achievable.met).toBe(true);
  });

  it("checkSmart detects missing criteria", async () => {
    const { checkSmart } = await import("@/lib/smart-checker");

    const result = checkSmart("Do something about the CV.", {
      forename: "John",
      barrier: "CV",
      timescale: "2 weeks",
    });

    // A vague action should score low
    expect(result.overallScore).toBeLessThanOrEqual(2);
  });
});

describe("SmartActionTool — output building integration", () => {
  it("buildNowOutput produces well-formed text", async () => {
    const { buildNowOutput } = await import("@/lib/smart-utils");

    const output = buildNowOutput(
      "2026-03-13",
      "John",
      "CV",
      "update his CV with recent experience and submit 3 applications",
      "Advisor",
      "get shortlisted for interviews",
      "2 weeks"
    );

    expect(output).toContain("John");
    expect(output).toContain("CV");
    expect(output).toContain("update his CV");
    expect(output).toContain("2 weeks");
  });

  it("buildFutureOutput produces well-formed text", async () => {
    const { buildFutureOutput } = await import("@/lib/smart-utils");

    const output = buildFutureOutput(
      "2026-03-20",
      "Sarah",
      "attend the Christmas Job Fair at Twickenham Stadium",
      "Participant",
      "speak with employers about warehouse roles",
      "2 weeks"
    );

    expect(output).toContain("Sarah");
    expect(output).toContain("attend the Christmas Job Fair");
    expect(output).toContain("speak with employers");
  });
});
