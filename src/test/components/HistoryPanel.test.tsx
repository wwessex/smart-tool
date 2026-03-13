import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HistoryPanel, HistoryPanelProps } from "@/components/smart/HistoryPanel";
import type { HistoryItem } from "@/hooks/useSmartStorage";
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

// Mock lazy-loaded HistoryInsights
vi.mock("@/components/smart/HistoryInsights", () => ({
  HistoryInsights: () => <div data-testid="history-insights">Insights</div>,
}));

function createHistoryItem(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: crypto.randomUUID(),
    mode: "now",
    createdAt: new Date().toISOString(),
    text: "John will update his CV with recent experience by 15 Mar 2026.",
    meta: {
      date: "2026-03-13",
      forename: "John",
      barrier: "CV",
      timescale: "2 weeks",
    },
    ...overrides,
  };
}

function makeSmartCheck(score = 3): SmartCheck {
  const criterion = (met: boolean) => ({ met, confidence: "medium" as const, reason: "test" });
  return {
    specific: criterion(score >= 1),
    measurable: criterion(score >= 2),
    achievable: criterion(score >= 3),
    relevant: criterion(score >= 4),
    timeBound: criterion(score >= 5),
    overallScore: score,
    warnings: [],
  };
}

function makeProps(overrides: Partial<HistoryPanelProps> = {}): HistoryPanelProps {
  return {
    history: [],
    hasOutput: false,
    output: "",
    smartCheck: makeSmartCheck(),
    minScoreEnabled: false,
    minScoreThreshold: 3,
    onSave: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onClearHistory: vi.fn(),
    onEditHistory: vi.fn(),
    onDeleteFromHistory: vi.fn(),
    ...overrides,
  };
}

describe("HistoryPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders heading and action buttons", () => {
    render(<HistoryPanel {...makeProps()} />);

    // "History" appears as both heading and tab — use heading role to disambiguate
    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(screen.getByText("Save to History")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
    expect(screen.getByText("Import")).toBeInTheDocument();
  });

  it("disables Save button when no output", () => {
    render(<HistoryPanel {...makeProps({ hasOutput: false, output: "" })} />);

    expect(screen.getByText("Save to History")).toBeDisabled();
  });

  it("enables Save button when output is present", () => {
    render(
      <HistoryPanel
        {...makeProps({
          hasOutput: true,
          output: "Test action",
        })}
      />
    );

    expect(screen.getByText("Save to History")).not.toBeDisabled();
  });

  it("disables Save button when min score is enabled and score is below threshold", () => {
    render(
      <HistoryPanel
        {...makeProps({
          hasOutput: true,
          output: "Test action",
          minScoreEnabled: true,
          minScoreThreshold: 4,
          smartCheck: makeSmartCheck(3),
        })}
      />
    );

    expect(screen.getByText("Save to History")).toBeDisabled();
  });

  it("shows empty state when history is empty", () => {
    render(<HistoryPanel {...makeProps({ history: [] })} />);

    // EmptyState component renders for history variant
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders history items", () => {
    const items = [
      createHistoryItem({ text: "First action text" }),
      createHistoryItem({ text: "Second action text", mode: "future" }),
    ];

    render(<HistoryPanel {...makeProps({ history: items })} />);

    expect(screen.getByText("First action text")).toBeInTheDocument();
    expect(screen.getByText("Second action text")).toBeInTheDocument();
  });

  it("shows mode badges for history items", () => {
    const items = [
      createHistoryItem({ mode: "now" }),
      createHistoryItem({ mode: "future" }),
    ];

    render(<HistoryPanel {...makeProps({ history: items })} />);

    expect(screen.getByText("Barrier to action")).toBeInTheDocument();
    expect(screen.getByText("Task-based")).toBeInTheDocument();
  });

  it("shows forename in history item metadata", () => {
    const items = [createHistoryItem({ meta: { date: "2026-03-13", forename: "Alice", barrier: "CV", timescale: "2 weeks" } })];

    render(<HistoryPanel {...makeProps({ history: items })} />);

    expect(screen.getByText("• Alice")).toBeInTheDocument();
  });

  it("filters history based on search input", async () => {
    const user = userEvent.setup();
    const items = [
      createHistoryItem({ text: "John will update CV", meta: { date: "2026-03-13", forename: "John", barrier: "CV", timescale: "2 weeks" } }),
      createHistoryItem({ text: "Sarah will attend interview", meta: { date: "2026-03-13", forename: "Sarah", barrier: "Interviews", timescale: "1 week" } }),
    ];

    render(<HistoryPanel {...makeProps({ history: items })} />);

    const searchInput = screen.getByPlaceholderText("Search history…");
    await user.type(searchInput, "Sarah");

    expect(screen.queryByText("John will update CV")).not.toBeInTheDocument();
    expect(screen.getByText("Sarah will attend interview")).toBeInTheDocument();
  });

  it("filters by barrier text", async () => {
    const user = userEvent.setup();
    const items = [
      createHistoryItem({ text: "Action 1", meta: { date: "2026-03-13", forename: "John", barrier: "Transport", timescale: "2 weeks" } }),
      createHistoryItem({ text: "Action 2", meta: { date: "2026-03-13", forename: "Sarah", barrier: "CV", timescale: "1 week" } }),
    ];

    render(<HistoryPanel {...makeProps({ history: items })} />);

    const searchInput = screen.getByPlaceholderText("Search history…");
    await user.type(searchInput, "Transport");

    expect(screen.getByText("Action 1")).toBeInTheDocument();
    expect(screen.queryByText("Action 2")).not.toBeInTheDocument();
  });

  it("calls onSave when Save button is clicked", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <HistoryPanel
        {...makeProps({
          hasOutput: true,
          output: "Test",
          onSave,
        })}
      />
    );

    await user.click(screen.getByText("Save to History"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("calls onExport when Export button is clicked", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();

    render(<HistoryPanel {...makeProps({ onExport })} />);

    await user.click(screen.getByText("Export"));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("calls onEditHistory when Edit button is clicked", async () => {
    const user = userEvent.setup();
    const onEditHistory = vi.fn();
    const item = createHistoryItem();

    render(
      <HistoryPanel
        {...makeProps({
          history: [item],
          onEditHistory,
        })}
      />
    );

    await user.click(screen.getByText("Edit"));
    expect(onEditHistory).toHaveBeenCalledWith(item);
  });

  it("has tabs for history and insights", () => {
    render(<HistoryPanel {...makeProps()} />);

    expect(screen.getByRole("tab", { name: /History/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Insights/i })).toBeInTheDocument();
  });

  it("renders search input with correct attributes", () => {
    render(<HistoryPanel {...makeProps()} />);

    const searchInput = screen.getByPlaceholderText("Search history…");
    expect(searchInput).toHaveAttribute("type", "search");
    expect(searchInput).toHaveAttribute("aria-label", "Search history");
  });

  it("shows translated text in history items when present", () => {
    const item = createHistoryItem({
      meta: {
        date: "2026-03-13",
        forename: "John",
        barrier: "CV",
        timescale: "2 weeks",
        translatedText: "Bydd John yn diweddaru ei CV",
        translationLanguage: "cy",
      },
    });

    render(<HistoryPanel {...makeProps({ history: [item] })} />);

    expect(screen.getByText("Bydd John yn diweddaru ei CV")).toBeInTheDocument();
  });
});
