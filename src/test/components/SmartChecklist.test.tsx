import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SmartChecklist } from "@/components/smart/SmartChecklist";
import type { SmartCheck, SmartCriterion } from "@/lib/smart-checker";

// Framer-motion props to strip from DOM elements
const MOTION_PROPS = new Set([
  "initial", "animate", "exit", "transition", "whileHover", "whileTap",
  "whileInView", "whileFocus", "whileDrag", "variants", "layout", "layoutId",
  "onAnimationStart", "onAnimationComplete", "onUpdate", "onDragStart",
  "onDrag", "onDragEnd", "dragConstraints", "dragElastic",
]);

function filterMotionProps(props: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!MOTION_PROPS.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

// Mock framer-motion with a Proxy to handle all HTML elements
vi.mock("framer-motion", () => {
  const motion = new Proxy({}, {
    get: (_target, prop: string) => {
      return React.forwardRef(({ children, ...props }: Record<string, unknown>, ref: React.Ref<unknown>) => {
        return React.createElement(prop, { ...filterMotionProps(props), ref }, children as React.ReactNode);
      });
    },
  });
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    motion,
    forwardRef: React.forwardRef,
  };
});

function makeCriterion(met: boolean, reason = "test reason", confidence: "high" | "medium" | "low" = "medium"): SmartCriterion {
  return { met, confidence, reason, hint: met ? undefined : "Try adding more detail" };
}

function makeCheck(overrides: Partial<SmartCheck> = {}): SmartCheck {
  return {
    specific: makeCriterion(false, "Not specific enough"),
    measurable: makeCriterion(false, "No quantities found"),
    achievable: makeCriterion(false, "No agreement shown"),
    relevant: makeCriterion(false, "No barrier link"),
    timeBound: makeCriterion(false, "No date found"),
    overallScore: 0,
    warnings: [],
    ...overrides,
  };
}

describe("SmartChecklist", () => {
  it("renders all 5 SMART criteria", () => {
    render(<SmartChecklist check={makeCheck()} />);

    expect(screen.getByText("Specific")).toBeInTheDocument();
    expect(screen.getByText("Measurable")).toBeInTheDocument();
    expect(screen.getByText("Achievable")).toBeInTheDocument();
    expect(screen.getByText("Relevant")).toBeInTheDocument();
    expect(screen.getByText("Time-bound")).toBeInTheDocument();
  });

  it("shows met/unmet states for each criterion", () => {
    const check = makeCheck({
      specific: makeCriterion(true, "Names a specific action"),
      measurable: makeCriterion(true, "Includes quantities"),
      achievable: makeCriterion(false, "No agreement shown"),
      relevant: makeCriterion(true, "Links to barrier"),
      timeBound: makeCriterion(false, "No date found"),
      overallScore: 3,
    });

    render(<SmartChecklist check={check} />);

    // Met criteria show their success reasons
    expect(screen.getByText("Names a specific action")).toBeInTheDocument();
    expect(screen.getByText("Includes quantities")).toBeInTheDocument();
    expect(screen.getByText("Links to barrier")).toBeInTheDocument();

    // Unmet criteria show their failure reasons
    expect(screen.getByText("No agreement shown")).toBeInTheDocument();
    expect(screen.getByText("No date found")).toBeInTheDocument();
  });

  it("displays the correct overall score", () => {
    const check = makeCheck({ overallScore: 3 });
    render(<SmartChecklist check={check} />);

    expect(screen.getByText(/3\/5/)).toBeInTheDocument();
  });

  it("shows improvement suggestions when criteria are missing", () => {
    const check = makeCheck({ overallScore: 2 });
    render(<SmartChecklist check={check} />);

    expect(screen.getByText("Next steps to improve:")).toBeInTheDocument();
  });

  it("shows empty state guidance when score is 0", () => {
    render(<SmartChecklist check={makeCheck()} />);

    expect(screen.getByText("Generate an action to see SMART analysis.")).toBeInTheDocument();
  });

  it("shows perfect score celebration when all criteria met", () => {
    const check = makeCheck({
      specific: makeCriterion(true, "Clear action"),
      measurable: makeCriterion(true, "Has quantities"),
      achievable: makeCriterion(true, "Agreement shown"),
      relevant: makeCriterion(true, "Links to barrier"),
      timeBound: makeCriterion(true, "Has date"),
      overallScore: 5,
    });

    render(<SmartChecklist check={check} />);

    expect(screen.getByText(/Perfect! This is a fully SMART action./)).toBeInTheDocument();
  });

  it("renders warnings when present", () => {
    const check = makeCheck({
      overallScore: 3,
      warnings: ["Action uses weak language"],
    });

    render(<SmartChecklist check={check} />);

    expect(screen.getByText("Action uses weak language")).toBeInTheDocument();
  });

  it("shows 'Strong' badge for high-confidence met criteria", () => {
    const check = makeCheck({
      specific: makeCriterion(true, "Very specific", "high"),
      overallScore: 1,
    });

    render(<SmartChecklist check={check} />);

    expect(screen.getByText("Strong")).toBeInTheDocument();
  });

  it("renders progress bar with correct aria attributes", () => {
    const check = makeCheck({ overallScore: 3 });
    render(<SmartChecklist check={check} />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "3");
    expect(progressBar).toHaveAttribute("aria-valuemax", "5");
  });

  it("shows Fix buttons when onFixCriterion is provided and criteria have suggestions", () => {
    const check = makeCheck({
      specific: {
        met: false,
        confidence: "low",
        reason: "Not specific",
        suggestion: "Add who, what, where",
      },
      overallScore: 0,
    });
    const onFix = vi.fn();

    render(<SmartChecklist check={check} onFixCriterion={onFix} />);

    const fixButtons = screen.getAllByText("Fix");
    expect(fixButtons.length).toBeGreaterThan(0);
  });

  it("calls onFixCriterion with the correct criterion and suggestion when Fix is clicked", async () => {
    const user = userEvent.setup();
    const check = makeCheck({
      specific: {
        met: false,
        confidence: "low",
        reason: "Not specific",
        suggestion: "Add who, what, where",
      },
      overallScore: 0,
    });
    const onFix = vi.fn();

    render(<SmartChecklist check={check} onFixCriterion={onFix} />);

    const fixButton = screen.getByRole("button", { name: /Fix Specific/i });
    await user.click(fixButton);

    expect(onFix).toHaveBeenCalledWith("specific", "Add who, what, where");
  });

  it("disables Fix buttons when fixingCriterion is set", () => {
    const check = makeCheck({
      specific: {
        met: false,
        confidence: "low",
        reason: "Not specific",
        suggestion: "Add detail",
      },
      measurable: {
        met: false,
        confidence: "low",
        reason: "No quantities",
        suggestion: "Add numbers",
      },
      overallScore: 0,
    });

    render(
      <SmartChecklist
        check={check}
        onFixCriterion={vi.fn()}
        fixingCriterion="specific"
      />
    );

    // All fix buttons should be disabled when one is being fixed
    const buttons = screen.getAllByRole("button", { name: /Fix|Fixing/i });
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});
