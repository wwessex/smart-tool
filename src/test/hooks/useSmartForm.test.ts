import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSmartForm } from "@/hooks/useSmartForm";

describe("useSmartForm", () => {
  describe("initial state", () => {
    it("defaults to 'now' mode", () => {
      const { result } = renderHook(() => useSmartForm());
      expect(result.current.mode).toBe("now");
    });

    it("initialises nowForm with today's date", () => {
      const { result } = renderHook(() => useSmartForm());
      expect(result.current.nowForm.date).toBe(result.current.today);
    });

    it("initialises taskBasedForm with today's date", () => {
      const { result } = renderHook(() => useSmartForm());
      expect(result.current.taskBasedForm.date).toBe(result.current.today);
    });

    it("initialises responsible as 'Participant'", () => {
      const { result } = renderHook(() => useSmartForm());
      expect(result.current.nowForm.responsible).toBe("Participant");
      expect(result.current.taskBasedForm.responsible).toBe("Participant");
    });

    it("starts with showValidation false", () => {
      const { result } = renderHook(() => useSmartForm());
      expect(result.current.showValidation).toBe(false);
    });

    it("starts with wizardMode false", () => {
      const { result } = renderHook(() => useSmartForm());
      expect(result.current.wizardMode).toBe(false);
    });
  });

  describe("mode switching", () => {
    it("can switch to future mode", () => {
      const { result } = renderHook(() => useSmartForm());

      act(() => {
        result.current.setMode("future");
      });

      expect(result.current.mode).toBe("future");
    });

    it("can switch back to now mode", () => {
      const { result } = renderHook(() => useSmartForm());

      act(() => {
        result.current.setMode("future");
      });
      act(() => {
        result.current.setMode("now");
      });

      expect(result.current.mode).toBe("now");
    });
  });

  describe("now form validation", () => {
    it("is invalid when form is empty", () => {
      const { result } = renderHook(() => useSmartForm());
      expect(result.current.isValid).toBe(false);
    });

    it("is valid when all now fields are filled", () => {
      const { result } = renderHook(() => useSmartForm());

      act(() => {
        result.current.setNowForm({
          ...result.current.nowForm,
          forename: "John",
          barrier: "CV",
          action: "Update CV",
          responsible: "Participant",
          help: "Get shortlisted",
          timescale: "2 weeks",
        });
      });

      expect(result.current.isValid).toBe(true);
    });

    it("is invalid when forename is empty", () => {
      const { result } = renderHook(() => useSmartForm());

      act(() => {
        result.current.setNowForm({
          ...result.current.nowForm,
          forename: "",
          barrier: "CV",
          action: "Update CV",
          responsible: "Participant",
          help: "Get shortlisted",
          timescale: "2 weeks",
        });
      });

      expect(result.current.isValid).toBe(false);
    });

    it("is invalid when forename is whitespace only", () => {
      const { result } = renderHook(() => useSmartForm());

      act(() => {
        result.current.setNowForm({
          ...result.current.nowForm,
          forename: "   ",
          barrier: "CV",
          action: "Update CV",
          responsible: "Participant",
          help: "Get shortlisted",
          timescale: "2 weeks",
        });
      });

      expect(result.current.isValid).toBe(false);
    });

    it("is invalid when action is missing", () => {
      const { result } = renderHook(() => useSmartForm());

      act(() => {
        result.current.setNowForm({
          ...result.current.nowForm,
          forename: "John",
          barrier: "CV",
          action: "",
          responsible: "Participant",
          help: "Get shortlisted",
          timescale: "2 weeks",
        });
      });

      expect(result.current.isValid).toBe(false);
    });
  });

  describe("task-based form validation", () => {
    it("is valid with all fields and today's date", () => {
      const { result } = renderHook(() => useSmartForm());

      act(() => {
        result.current.setMode("future");
      });

      act(() => {
        result.current.setTaskBasedForm({
          ...result.current.taskBasedForm,
          forename: "John",
          task: "Job fair",
          outcome: "Gain contacts",
          timescale: "2 weeks",
        });
      });

      expect(result.current.isValid).toBe(true);
    });

    it("is invalid with past date", () => {
      const { result } = renderHook(() => useSmartForm());

      act(() => {
        result.current.setMode("future");
      });

      act(() => {
        result.current.setTaskBasedForm({
          ...result.current.taskBasedForm,
          date: "2020-01-01",
          forename: "John",
          task: "Job fair",
          outcome: "Gain contacts",
          timescale: "2 weeks",
        });
      });

      expect(result.current.isValid).toBe(false);
    });

    it("shows date error for past dates", () => {
      const { result } = renderHook(() => useSmartForm());

      act(() => {
        result.current.setTaskBasedForm({
          ...result.current.taskBasedForm,
          date: "2020-01-01",
        });
      });

      expect(result.current.taskBasedDateError).toContain("today or in the future");
    });

    it("no date error for today", () => {
      const { result } = renderHook(() => useSmartForm());
      expect(result.current.taskBasedDateError).toBe("");
    });
  });

  describe("now form date warning", () => {
    it("no warning when date is today", () => {
      const { result } = renderHook(() => useSmartForm());
      expect(result.current.nowDateWarning).toBe("");
    });

    it("shows warning when date differs from today", () => {
      const { result } = renderHook(() => useSmartForm());

      act(() => {
        result.current.setNowForm({
          ...result.current.nowForm,
          date: "2020-06-15",
        });
      });

      expect(result.current.nowDateWarning).toContain("differs from today");
    });
  });

  describe("resetForm", () => {
    it("resets now form fields to initial values", () => {
      const { result } = renderHook(() => useSmartForm());

      act(() => {
        result.current.setNowForm({
          ...result.current.nowForm,
          forename: "John",
          barrier: "CV",
          action: "Update CV",
        });
      });

      act(() => {
        result.current.resetForm();
      });

      expect(result.current.nowForm.forename).toBe("");
      expect(result.current.nowForm.barrier).toBe("");
      expect(result.current.nowForm.action).toBe("");
    });

    it("resets task-based form when in future mode", () => {
      const { result } = renderHook(() => useSmartForm());

      act(() => {
        result.current.setMode("future");
      });

      act(() => {
        result.current.setTaskBasedForm({
          ...result.current.taskBasedForm,
          forename: "Sarah",
          task: "Workshop",
        });
      });

      act(() => {
        result.current.resetForm();
      });

      expect(result.current.taskBasedForm.forename).toBe("");
      expect(result.current.taskBasedForm.task).toBe("");
    });

    it("clears showValidation", () => {
      const { result } = renderHook(() => useSmartForm());

      act(() => {
        result.current.setShowValidation(true);
      });
      expect(result.current.showValidation).toBe(true);

      act(() => {
        result.current.resetForm();
      });
      expect(result.current.showValidation).toBe(false);
    });
  });

  describe("getFieldClass", () => {
    it("returns empty string when validation not shown", () => {
      const { result } = renderHook(() => useSmartForm());
      expect(result.current.getFieldClass(true)).toBe("");
      expect(result.current.getFieldClass(false)).toBe("");
    });

    it("returns green class for valid field when showing validation", () => {
      const { result } = renderHook(() => useSmartForm());

      act(() => {
        result.current.setShowValidation(true);
      });

      expect(result.current.getFieldClass(true)).toContain("green");
    });

    it("returns destructive class for invalid field when showing validation", () => {
      const { result } = renderHook(() => useSmartForm());

      act(() => {
        result.current.setShowValidation(true);
      });

      expect(result.current.getFieldClass(false)).toContain("destructive");
    });
  });
});
