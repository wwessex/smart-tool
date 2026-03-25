import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useKeyboardShortcuts,
  formatShortcut,
  toAriaKeyShortcuts,
  groupShortcuts,
  createShortcutMap,
  type ShortcutConfig,
} from "@/hooks/useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  let addEventSpy: ReturnType<typeof vi.spyOn>;
  let removeEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventSpy = vi.spyOn(window, "addEventListener");
    removeEventSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    addEventSpy.mockRestore();
    removeEventSpy.mockRestore();
  });

  it("registers shortcuts and tears them down on unmount", () => {
    const action = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: "s", ctrl: true, action, description: "Save" },
    ];

    const { unmount } = renderHook(() => useKeyboardShortcuts(shortcuts));

    expect(addEventSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    unmount();

    expect(removeEventSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  // Helper: dispatch a keydown from a real DOM element so target.closest() works
  function fireKey(el: HTMLElement, opts: KeyboardEventInit) {
    const event = new KeyboardEvent("keydown", { ...opts, bubbles: true });
    el.dispatchEvent(event);
  }

  it("invokes handler when shortcut matches", () => {
    const action = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: "s", ctrl: true, action, description: "Save" },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKey(document.body, { key: "s", ctrlKey: true });

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("does not invoke handler when modifiers do not match", () => {
    const action = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: "s", ctrl: true, action, description: "Save" },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKey(document.body, { key: "s", ctrlKey: false });

    expect(action).not.toHaveBeenCalled();
  });

  it("handles shift modifier correctly", () => {
    const action = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: "n", ctrl: true, shift: true, action, description: "New" },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    // Ctrl+Shift+N
    fireKey(document.body, { key: "n", ctrlKey: true, shiftKey: true });
    expect(action).toHaveBeenCalledTimes(1);

    // Ctrl+N (no shift) should not trigger
    fireKey(document.body, { key: "n", ctrlKey: true, shiftKey: false });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("handles alt modifier correctly", () => {
    const action = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: "h", alt: true, action, description: "Help" },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    fireKey(document.body, { key: "h", altKey: true });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("does not fire shortcuts when disabled", () => {
    const action = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: "s", ctrl: true, action, description: "Save" },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts, false));

    fireKey(document.body, { key: "s", ctrlKey: true });

    expect(action).not.toHaveBeenCalled();
  });

  it("does not fire non-ctrl shortcuts when typing in an input", () => {
    const action = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: "d", action, description: "Draft" },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const input = document.createElement("input");
    document.body.appendChild(input);

    fireKey(input, { key: "d" });

    expect(action).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it("fires ctrl shortcuts even in inputs", () => {
    const action = vi.fn();
    const shortcuts: ShortcutConfig[] = [
      { key: "s", ctrl: true, action, description: "Save" },
    ];

    renderHook(() => useKeyboardShortcuts(shortcuts));

    const input = document.createElement("input");
    document.body.appendChild(input);

    fireKey(input, { key: "s", ctrlKey: true });

    expect(action).toHaveBeenCalledTimes(1);

    document.body.removeChild(input);
  });
});

describe("formatShortcut", () => {
  it("formats simple key", () => {
    const result = formatShortcut({ key: "s" });
    expect(result).toBe("S");
  });

  it("formats Ctrl+key (non-Mac)", () => {
    // jsdom navigator.platform won't be Mac
    const result = formatShortcut({ key: "s", ctrl: true });
    expect(result).toContain("Ctrl");
    expect(result).toContain("S");
  });

  it("formats Shift+key", () => {
    const result = formatShortcut({ key: "n", shift: true });
    expect(result).toContain("Shift");
    expect(result).toContain("N");
  });

  it("formats Enter as ↵", () => {
    const result = formatShortcut({ key: "Enter" });
    expect(result).toContain("↵");
  });

  it("formats space key", () => {
    const result = formatShortcut({ key: " " });
    expect(result).toContain("Space");
  });
});

describe("toAriaKeyShortcuts", () => {
  it("returns undefined for empty key", () => {
    expect(toAriaKeyShortcuts({ key: "" })).toBeUndefined();
  });

  it("formats simple key for ARIA", () => {
    const result = toAriaKeyShortcuts({ key: "s" });
    expect(result).toBe("S");
  });

  it("includes Control and Meta variants for ctrl shortcuts", () => {
    const result = toAriaKeyShortcuts({ key: "s", ctrl: true });
    expect(result).toContain("Control");
    expect(result).toContain("Meta");
  });

  it("formats space as Space", () => {
    const result = toAriaKeyShortcuts({ key: " " });
    expect(result).toBe("Space");
  });
});

describe("groupShortcuts", () => {
  it("groups shortcuts by category", () => {
    const shortcuts: ShortcutConfig[] = [
      { key: "s", ctrl: true, action: vi.fn(), description: "Save", category: "File" },
      { key: "n", ctrl: true, action: vi.fn(), description: "New", category: "File" },
      { key: "h", action: vi.fn(), description: "Help", category: "General" },
    ];

    const groups = groupShortcuts(shortcuts);

    expect(groups).toHaveLength(2);
    const fileGroup = groups.find(g => g.category === "File");
    expect(fileGroup?.shortcuts).toHaveLength(2);
  });

  it("uses 'General' as default category", () => {
    const shortcuts: ShortcutConfig[] = [
      { key: "h", action: vi.fn(), description: "Help" },
    ];

    const groups = groupShortcuts(shortcuts);
    expect(groups[0].category).toBe("General");
  });
});

describe("createShortcutMap", () => {
  it("creates map from id to formatted shortcut", () => {
    const shortcuts: ShortcutConfig[] = [
      { key: "s", ctrl: true, action: vi.fn(), description: "Save", id: "save" },
      { key: "n", action: vi.fn(), description: "New", id: "new" },
    ];

    const map = createShortcutMap(shortcuts);

    expect(map).toHaveProperty("save");
    expect(map).toHaveProperty("new");
  });

  it("skips shortcuts without id", () => {
    const shortcuts: ShortcutConfig[] = [
      { key: "s", action: vi.fn(), description: "Save" },
    ];

    const map = createShortcutMap(shortcuts);
    expect(Object.keys(map)).toHaveLength(0);
  });
});
