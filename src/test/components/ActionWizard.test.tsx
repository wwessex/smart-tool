import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionWizard } from "@/components/smart/ActionWizard";

// Framer-motion props to strip
const MOTION_PROPS = new Set([
  "initial", "animate", "exit", "transition", "whileHover", "whileTap",
  "whileInView", "variants", "layout", "layoutId",
]);

function filterMotionProps(props: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!MOTION_PROPS.has(key)) filtered[key] = value;
  }
  return filtered;
}

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
  };
});

const DEFAULT_PROPS = {
  mode: "now" as const,
  barriers: ["CV", "Transport", "Confidence"],
  timescales: ["1 week", "2 weeks", "1 month"],
  recentNames: ["John", "Sarah"],
  onComplete: vi.fn(),
  onCancel: vi.fn(),
};

describe("ActionWizard", () => {
  it("renders the first step with guided mode header", () => {
    render(<ActionWizard {...DEFAULT_PROPS} />);

    expect(screen.getByText("Guided Mode")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
    expect(screen.getByText("What is the participant's first name?")).toBeInTheDocument();
  });

  it("navigates between steps and preserves input state", async () => {
    const user = userEvent.setup();
    render(<ActionWizard {...DEFAULT_PROPS} />);

    // Step 1: Enter name
    const nameInput = screen.getByPlaceholderText("e.g. John");
    await user.type(nameInput, "Alice");

    // Click Next
    await user.click(screen.getByText("Next"));

    // Step 2: Barrier step
    expect(screen.getByText("Step 2 of 6")).toBeInTheDocument();
    expect(screen.getByText("What barrier to work are we addressing?")).toBeInTheDocument();

    // Go back
    await user.click(screen.getByText("Back"));

    // Step 1 again - name should be preserved
    expect(screen.getByText("Step 1 of 6")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
  });

  it("validates required fields before proceeding", () => {
    render(<ActionWizard {...DEFAULT_PROPS} />);

    // Next button should be disabled when field is empty
    const nextButton = screen.getByText("Next");
    expect(nextButton).toBeDisabled();
  });

  it("enables Next when required field has a value", async () => {
    const user = userEvent.setup();
    render(<ActionWizard {...DEFAULT_PROPS} />);

    const nameInput = screen.getByPlaceholderText("e.g. John");
    await user.type(nameInput, "John");

    const nextButton = screen.getByText("Next");
    expect(nextButton).not.toBeDisabled();
  });

  it("shows Back button disabled on first step", () => {
    render(<ActionWizard {...DEFAULT_PROPS} />);

    const backButton = screen.getByText("Back");
    expect(backButton).toBeDisabled();
  });

  it("calls onCancel when Exit button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ActionWizard {...DEFAULT_PROPS} onCancel={onCancel} />);

    await user.click(screen.getByText("Exit"));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows progress bar", () => {
    render(<ActionWizard {...DEFAULT_PROPS} />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows preview of filled data", async () => {
    const user = userEvent.setup();
    render(<ActionWizard {...DEFAULT_PROPS} />);

    const nameInput = screen.getByPlaceholderText("e.g. John");
    await user.type(nameInput, "Bob");

    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText(/forename: Bob/)).toBeInTheDocument();
  });

  it("renders future mode steps correctly", () => {
    render(<ActionWizard {...DEFAULT_PROPS} mode="future" />);

    expect(screen.getByText("Step 1 of 5")).toBeInTheDocument();
    expect(screen.getByText("What is the participant's first name?")).toBeInTheDocument();
  });

  it("shows AI Draft button for steps with canAIDraft", async () => {
    const user = userEvent.setup();
    const onAIDraft = vi.fn().mockResolvedValue("AI generated text");
    render(
      <ActionWizard {...DEFAULT_PROPS} onAIDraft={onAIDraft} />
    );

    // Navigate to step 3 (action) which has canAIDraft
    const nameInput = screen.getByPlaceholderText("e.g. John");
    await user.type(nameInput, "John");
    await user.click(screen.getByText("Next"));

    // Step 2: barrier
    const barrierInput = screen.getByRole("combobox");
    await user.type(barrierInput, "CV");
    await user.keyboard("{Enter}");
    await user.click(screen.getByText("Next"));

    // Step 3: action - should show AI Draft button
    expect(screen.getByText("AI Draft")).toBeInTheDocument();
  });

  it("shows last step with Complete button", async () => {
    const user = userEvent.setup();
    render(<ActionWizard {...DEFAULT_PROPS} mode="future" />);

    // Navigate through all future mode steps
    // Step 1: forename
    await user.type(screen.getByPlaceholderText("e.g. John"), "Sam");
    await user.click(screen.getByText("Next"));

    // Step 2: task
    await user.type(screen.getByPlaceholderText(/Christmas Job Fair/), "Job Fair");
    await user.click(screen.getByText("Next"));

    // Step 3: responsible (combobox)
    const comboInput = screen.getByRole("combobox");
    await user.type(comboInput, "Advisor");
    await user.keyboard("{Enter}");
    await user.click(screen.getByText("Next"));

    // Step 4: outcome
    await user.type(screen.getByPlaceholderText(/will speak with employers/), "Gain contacts");
    await user.click(screen.getByText("Next"));

    // Step 5 (last): timescale - should show Complete button
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });
});
