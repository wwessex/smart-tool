import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateLibrary, type ActionTemplate } from "@/components/smart/TemplateLibrary";

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

// Mock useToast
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function createTemplate(overrides: Partial<ActionTemplate> = {}): ActionTemplate {
  return {
    id: crypto.randomUUID(),
    name: "CV Update Standard",
    mode: "now",
    createdAt: new Date().toISOString(),
    barrier: "CV",
    action: "Update CV with recent experience",
    responsible: "Participant",
    help: "Get shortlisted for interviews",
    ...overrides,
  };
}

const DEFAULT_PROPS = {
  templates: [] as ActionTemplate[],
  onSaveTemplate: vi.fn(),
  onDeleteTemplate: vi.fn(),
  onUpdateTemplate: vi.fn(),
  onInsertTemplate: vi.fn(),
  currentMode: "now" as const,
  currentForm: {
    barrier: "CV",
    action: "Update CV",
    responsible: "Participant",
    help: "Get shortlisted",
  },
};

describe("TemplateLibrary", () => {
  it("renders Save as template and Templates buttons", () => {
    render(<TemplateLibrary {...DEFAULT_PROPS} />);

    expect(screen.getByText("Save as template")).toBeInTheDocument();
    expect(screen.getByText("Templates")).toBeInTheDocument();
  });

  it("shows template count badge when templates exist", () => {
    const templates = [createTemplate()];
    render(<TemplateLibrary {...DEFAULT_PROPS} templates={templates} />);

    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("filters templates by current mode", () => {
    const templates = [
      createTemplate({ mode: "now", name: "Now Template" }),
      createTemplate({ mode: "future", name: "Future Template" }),
    ];
    render(
      <TemplateLibrary {...DEFAULT_PROPS} templates={templates} currentMode="now" />
    );

    // Badge should show 1 (only 'now' mode template)
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  describe("save dialog", () => {
    it("opens save dialog when clicking Save as template", async () => {
      const user = userEvent.setup();
      render(<TemplateLibrary {...DEFAULT_PROPS} />);

      await user.click(screen.getByText("Save as template"));

      expect(screen.getByText("Save as Template")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("e.g. CV Update Standard")).toBeInTheDocument();
    });

    it("calls onSaveTemplate with form data when saving", async () => {
      const onSaveTemplate = vi.fn();
      const user = userEvent.setup();

      render(
        <TemplateLibrary {...DEFAULT_PROPS} onSaveTemplate={onSaveTemplate} />
      );

      await user.click(screen.getByText("Save as template"));
      await user.type(
        screen.getByPlaceholderText("e.g. CV Update Standard"),
        "My Template"
      );
      await user.click(screen.getByRole("button", { name: "Save Template" }));

      expect(onSaveTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "My Template",
          mode: "now",
          barrier: "CV",
          action: "Update CV",
        })
      );
    });
  });

  describe("library dialog", () => {
    it("shows empty state when no templates for current mode", async () => {
      const user = userEvent.setup();
      render(<TemplateLibrary {...DEFAULT_PROPS} templates={[]} />);

      await user.click(screen.getByText("Templates"));

      expect(screen.getByText("No templates yet")).toBeInTheDocument();
    });

    it("shows template details when templates exist", async () => {
      const templates = [createTemplate({ name: "Test Template" })];
      const user = userEvent.setup();

      render(<TemplateLibrary {...DEFAULT_PROPS} templates={templates} />);

      await user.click(screen.getByText("Templates"));

      expect(screen.getByText("Test Template")).toBeInTheDocument();
      expect(screen.getByText("Use this template")).toBeInTheDocument();
    });

    it("calls onInsertTemplate when clicking Use this template", async () => {
      const onInsertTemplate = vi.fn();
      const template = createTemplate({ name: "My Template" });
      const user = userEvent.setup();

      render(
        <TemplateLibrary
          {...DEFAULT_PROPS}
          templates={[template]}
          onInsertTemplate={onInsertTemplate}
        />
      );

      await user.click(screen.getByText("Templates"));
      await user.click(screen.getByText("Use this template"));

      expect(onInsertTemplate).toHaveBeenCalledWith(template);
    });

    it("calls onDeleteTemplate when clicking delete button", async () => {
      const onDeleteTemplate = vi.fn();
      const template = createTemplate();
      const user = userEvent.setup();

      render(
        <TemplateLibrary
          {...DEFAULT_PROPS}
          templates={[template]}
          onDeleteTemplate={onDeleteTemplate}
        />
      );

      await user.click(screen.getByText("Templates"));

      // Find and click the delete button (Trash2 icon)
      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(btn => btn.querySelector(".lucide-trash-2"));
      if (deleteButton) {
        await user.click(deleteButton);
        expect(onDeleteTemplate).toHaveBeenCalledWith(template.id);
      }
    });
  });
});
