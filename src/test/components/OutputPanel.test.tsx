import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OutputPanel, OutputPanelProps } from "@/components/smart/OutputPanel";
import type { SmartCheck } from "@/lib/smart-checker";

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

// Mock SmartChecklist to keep OutputPanel tests focused
vi.mock("@/components/smart/SmartChecklist", () => ({
  SmartChecklist: ({ check }: { check: SmartCheck }) => (
    <div data-testid="smart-checklist">Score: {check.overallScore}/5</div>
  ),
}));

// Mock ActionFeedback
vi.mock("@/components/smart/ActionFeedback", () => ({
  ActionFeedback: ({ visible }: { visible: boolean }) => (
    visible ? <div data-testid="action-feedback">Feedback UI</div> : null
  ),
}));

// Mock DelightfulError
vi.mock("@/components/smart/DelightfulError", () => ({
  DelightfulError: ({ title, message }: { title: string; message: string }) => (
    <div data-testid="delightful-error">{title}: {message}</div>
  ),
}));

// Mock LanguageSelector
vi.mock("@/components/smart/LanguageSelector", () => ({
  LanguageSelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select data-testid="language-selector" value={value} onChange={e => onChange(e.target.value)}>
      <option value="none">None</option>
      <option value="cy">Welsh</option>
    </select>
  ),
}));

function makeSmartCheck(overallScore = 0): SmartCheck {
  const makeCriterion = (met: boolean) => ({ met, confidence: "low" as const, reason: "test" });
  return {
    specific: makeCriterion(overallScore >= 1),
    measurable: makeCriterion(overallScore >= 2),
    achievable: makeCriterion(overallScore >= 3),
    relevant: makeCriterion(overallScore >= 4),
    timeBound: makeCriterion(overallScore >= 5),
    overallScore,
    warnings: [],
  };
}

function makeProps(overrides: Partial<OutputPanelProps> = {}): OutputPanelProps {
  return {
    output: "",
    setOutput: vi.fn(),
    setOutputSource: vi.fn(),
    setTranslatedOutput: vi.fn(),
    translatedOutput: null,
    hasTranslation: false,
    hasOutput: false,
    copied: false,
    smartCheck: makeSmartCheck(),
    participantLanguage: "none",
    handleCopy: vi.fn(),
    handleDownload: vi.fn(),
    handleTranslate: vi.fn(),
    handleLanguageChange: vi.fn(),
    translation: {
      isTranslating: false,
      canTranslate: true,
      error: null,
      isRTL: () => false,
    },
    llm: {
      isReady: false,
      isGenerating: false,
      error: null,
      classifiedError: null,
      clearError: vi.fn(),
    },
    showFeedbackUI: false,
    feedbackRating: null,
    handleFeedbackRate: vi.fn(),
    handleAIDraft: vi.fn(),
    aiDrafting: false,
    ...overrides,
  };
}

describe("OutputPanel", () => {
  it("renders the output heading and action buttons", () => {
    render(<OutputPanel {...makeProps()} />);

    expect(screen.getByText("Generated action")).toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText(".txt")).toBeInTheDocument();
  });

  it("displays the generated output text", () => {
    render(
      <OutputPanel
        {...makeProps({
          output: "John will update his CV by next Friday.",
          hasOutput: true,
        })}
      />
    );

    const textarea = screen.getByLabelText("Generated SMART action text");
    expect(textarea).toHaveValue("John will update his CV by next Friday.");
  });

  it("calls handleCopy when Copy button is clicked", async () => {
    const user = userEvent.setup();
    const handleCopy = vi.fn();

    render(<OutputPanel {...makeProps({ handleCopy, hasOutput: true, output: "test" })} />);

    await user.click(screen.getByText("Copy"));
    expect(handleCopy).toHaveBeenCalledTimes(1);
  });

  it("calls handleDownload when .txt button is clicked", async () => {
    const user = userEvent.setup();
    const handleDownload = vi.fn();

    render(<OutputPanel {...makeProps({ handleDownload, hasOutput: true, output: "test" })} />);

    await user.click(screen.getByText(".txt"));
    expect(handleDownload).toHaveBeenCalledTimes(1);
  });

  it("renders the SMART checklist", () => {
    render(<OutputPanel {...makeProps({ smartCheck: makeSmartCheck(3) })} />);

    expect(screen.getByTestId("smart-checklist")).toHaveTextContent("Score: 3/5");
  });

  it("shows translation error when present", () => {
    render(
      <OutputPanel
        {...makeProps({
          translation: {
            isTranslating: false,
            canTranslate: true,
            error: "Translation model failed to load",
            isRTL: () => false,
          },
        })}
      />
    );

    expect(screen.getByText("Translation model failed to load")).toBeInTheDocument();
  });

  it("shows LLM error with DelightfulError component", () => {
    render(
      <OutputPanel
        {...makeProps({
          llm: {
            isReady: false,
            isGenerating: false,
            error: "Model failed to load",
            classifiedError: { title: "AI Error", message: "Model failed to load", retryable: false },
            clearError: vi.fn(),
          },
        })}
      />
    );

    expect(screen.getByTestId("delightful-error")).toBeInTheDocument();
  });

  it("shows feedback UI when showFeedbackUI and hasOutput are true", () => {
    render(
      <OutputPanel
        {...makeProps({
          showFeedbackUI: true,
          hasOutput: true,
          output: "Some action text",
        })}
      />
    );

    expect(screen.getByTestId("action-feedback")).toBeInTheDocument();
  });

  it("hides feedback UI when showFeedbackUI is false", () => {
    render(
      <OutputPanel
        {...makeProps({
          showFeedbackUI: false,
          hasOutput: true,
          output: "Some action text",
        })}
      />
    );

    expect(screen.queryByTestId("action-feedback")).not.toBeInTheDocument();
  });

  it("allows manual editing of output and sets source to manual", async () => {
    const user = userEvent.setup();
    const setOutput = vi.fn();
    const setOutputSource = vi.fn();
    const setTranslatedOutput = vi.fn();

    render(
      <OutputPanel
        {...makeProps({
          output: "Original text",
          hasOutput: true,
          setOutput,
          setOutputSource,
          setTranslatedOutput,
        })}
      />
    );

    const textarea = screen.getByLabelText("Generated SMART action text");
    await user.clear(textarea);
    await user.type(textarea, "Edited");

    expect(setOutput).toHaveBeenCalled();
    expect(setOutputSource).toHaveBeenCalledWith("manual");
    expect(setTranslatedOutput).toHaveBeenCalledWith(null);
  });

  it("renders language selector", () => {
    render(<OutputPanel {...makeProps()} />);

    expect(screen.getByTestId("language-selector")).toBeInTheDocument();
  });

  it("shows Translate button when a language is selected", () => {
    render(
      <OutputPanel
        {...makeProps({
          participantLanguage: "cy",
          hasOutput: true,
          output: "test",
        })}
      />
    );

    expect(screen.getByText("Translate")).toBeInTheDocument();
  });

  it("does not show Translate button when language is none", () => {
    render(
      <OutputPanel
        {...makeProps({
          participantLanguage: "none",
        })}
      />
    );

    expect(screen.queryByText("Translate")).not.toBeInTheDocument();
  });
});
