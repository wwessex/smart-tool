import { describe, it, expect, vi, afterEach } from "vitest";

import {
  safeLocalStorageGetItem,
  safeLocalStorageRemoveItem,
  safeLocalStorageSetItem,
} from "./safeStorage";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("safeStorage", () => {
  it("does not throw if localStorage.setItem throws", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => safeLocalStorageSetItem("k", "v")).not.toThrow();
    expect(safeLocalStorageSetItem("k", "v")).toBe(false);
  });

  it("does not throw if localStorage.getItem throws", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => safeLocalStorageGetItem("k")).not.toThrow();
    expect(safeLocalStorageGetItem("k")).toBeNull();
  });

  it("does not throw if localStorage.removeItem throws", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => safeLocalStorageRemoveItem("k")).not.toThrow();
    expect(safeLocalStorageRemoveItem("k")).toBe(false);
  });
});

