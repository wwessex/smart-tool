import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionFeedback, type FeedbackRating } from "@/components/smart/ActionFeedback";

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
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion,
  };
});

const DEFAULT_PROPS = {
  visible: true,
  rating: null as FeedbackRating,
  onRate: vi.fn(),
  onRegenerate: vi.fn(),
  isRegenerating: false,
};

describe("ActionFeedback", () => {
  it("renders nothing when not visible", () => {
    const { container } = render(
      <ActionFeedback {...DEFAULT_PROPS} visible={false} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders feedback UI when visible", () => {
    render(<ActionFeedback {...DEFAULT_PROPS} />);

    expect(screen.getByText("Was this relevant?")).toBeInTheDocument();
    expect(screen.getByText("Votes improve regenerate results and future AI drafts.")).toBeInTheDocument();
    expect(screen.getByLabelText("Mark as relevant")).toBeInTheDocument();
    expect(screen.getByLabelText("Mark as not relevant")).toBeInTheDocument();
    expect(screen.getByLabelText("Regenerate action")).toBeInTheDocument();
  });

  it("calls onRate with 'relevant' when thumbs up is clicked", async () => {
    const onRate = vi.fn();
    render(<ActionFeedback {...DEFAULT_PROPS} onRate={onRate} />);

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Mark as relevant"));

    expect(onRate).toHaveBeenCalledWith("relevant");
  });

  it("calls onRate with 'not-relevant' when thumbs down is clicked", async () => {
    const onRate = vi.fn();
    render(<ActionFeedback {...DEFAULT_PROPS} onRate={onRate} />);

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Mark as not relevant"));

    expect(onRate).toHaveBeenCalledWith("not-relevant");
  });

  it("toggles off when clicking the same rating", async () => {
    const onRate = vi.fn();
    render(
      <ActionFeedback {...DEFAULT_PROPS} onRate={onRate} rating="relevant" />
    );

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Mark as relevant"));

    // Should toggle to null
    expect(onRate).toHaveBeenCalledWith(null);
  });

  it("calls onRegenerate when regenerate button is clicked", async () => {
    const onRegenerate = vi.fn();
    render(<ActionFeedback {...DEFAULT_PROPS} onRegenerate={onRegenerate} />);

    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Regenerate action"));

    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("disables regenerate button when isRegenerating", () => {
    render(<ActionFeedback {...DEFAULT_PROPS} isRegenerating={true} />);

    const regenButton = screen.getByLabelText("Regenerate action");
    expect(regenButton).toBeDisabled();
  });

  it("sets aria-pressed on active rating button", () => {
    render(<ActionFeedback {...DEFAULT_PROPS} rating="relevant" />);

    const thumbsUp = screen.getByLabelText("Mark as relevant");
    expect(thumbsUp).toHaveAttribute("aria-pressed", "true");

    const thumbsDown = screen.getByLabelText("Mark as not relevant");
    expect(thumbsDown).toHaveAttribute("aria-pressed", "false");
  });
});
