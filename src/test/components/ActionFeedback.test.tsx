import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionFeedback } from "@/components/smart/ActionFeedback";

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

describe("ActionFeedback", () => {
  it("explains that votes improve future drafts and regenerate results", () => {
    render(
      <ActionFeedback
        visible
        rating={null}
        onRate={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.getByText("Votes improve regenerate results and future AI drafts.")).toBeInTheDocument();
  });

  it("sends a relevant rating when thumbs up is clicked", async () => {
    const user = userEvent.setup();
    const onRate = vi.fn();

    render(
      <ActionFeedback
        visible
        rating={null}
        onRate={onRate}
        onRegenerate={vi.fn()}
      />
    );

    await user.click(screen.getByLabelText("Mark as relevant"));
    expect(onRate).toHaveBeenCalledWith("relevant");
  });
});
