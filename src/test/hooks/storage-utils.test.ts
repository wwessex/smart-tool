import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  safeSetItem,
  safeRemoveItem,
  loadList,
  saveList,
  loadBoolean,
  loadNumber,
  loadString,
  STORAGE_KEYS,
} from "@/hooks/storage-utils";

describe("storage-utils", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ==================== safeSetItem ====================

  describe("safeSetItem", () => {
    it("writes to localStorage and returns true", () => {
      const result = safeSetItem("test-key", "test-value");

      expect(result).toBe(true);
      expect(localStorage.getItem("test-key")).toBe("test-value");
    });

    it("returns false when localStorage throws", () => {
      const original = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error("QuotaExceeded");
      });

      const result = safeSetItem("test-key", "test-value");

      expect(result).toBe(false);
      localStorage.setItem = original;
    });
  });

  // ==================== safeRemoveItem ====================

  describe("safeRemoveItem", () => {
    it("removes from localStorage and returns true", () => {
      localStorage.setItem("test-key", "value");

      const result = safeRemoveItem("test-key");

      expect(result).toBe(true);
      expect(localStorage.getItem("test-key")).toBeNull();
    });

    it("returns false when localStorage throws", () => {
      const original = localStorage.removeItem;
      localStorage.removeItem = vi.fn(() => {
        throw new Error("SecurityError");
      });

      const result = safeRemoveItem("test-key");

      expect(result).toBe(false);
      localStorage.removeItem = original;
    });
  });

  // ==================== loadList ====================

  describe("loadList", () => {
    it("returns fallback when key does not exist", () => {
      expect(loadList("missing", ["default"])).toEqual(["default"]);
    });

    it("returns parsed array from localStorage", () => {
      localStorage.setItem("test-list", JSON.stringify(["a", "b"]));

      expect(loadList("test-list", [])).toEqual(["a", "b"]);
    });

    it("returns fallback for invalid JSON", () => {
      localStorage.setItem("test-list", "not json");

      expect(loadList("test-list", ["fallback"])).toEqual(["fallback"]);
    });

    it("returns fallback when stored value is not an array", () => {
      localStorage.setItem("test-list", JSON.stringify({ not: "array" }));

      expect(loadList("test-list", [])).toEqual([]);
    });

    it("returns fallback for stored string", () => {
      localStorage.setItem("test-list", JSON.stringify("a string"));

      expect(loadList("test-list", ["fb"])).toEqual(["fb"]);
    });
  });

  // ==================== saveList ====================

  describe("saveList", () => {
    it("saves an array as JSON to localStorage", () => {
      saveList("test-list", [1, 2, 3]);

      expect(JSON.parse(localStorage.getItem("test-list")!)).toEqual([1, 2, 3]);
    });

    it("saves empty array", () => {
      saveList("test-list", []);

      expect(JSON.parse(localStorage.getItem("test-list")!)).toEqual([]);
    });
  });

  // ==================== loadBoolean ====================

  describe("loadBoolean", () => {
    it("returns fallback when key does not exist", () => {
      expect(loadBoolean("missing", true)).toBe(true);
      expect(loadBoolean("missing", false)).toBe(false);
    });

    it("returns true for stored 'true'", () => {
      localStorage.setItem("test-bool", "true");

      expect(loadBoolean("test-bool", false)).toBe(true);
    });

    it("returns false for stored 'false'", () => {
      localStorage.setItem("test-bool", "false");

      expect(loadBoolean("test-bool", true)).toBe(false);
    });

    it("returns false for any non-'true' string", () => {
      localStorage.setItem("test-bool", "yes");

      expect(loadBoolean("test-bool", true)).toBe(false);
    });
  });

  // ==================== loadNumber ====================

  describe("loadNumber", () => {
    it("returns fallback when key does not exist", () => {
      expect(loadNumber("missing", 42)).toBe(42);
    });

    it("returns parsed integer", () => {
      localStorage.setItem("test-num", "7");

      expect(loadNumber("test-num", 0)).toBe(7);
    });

    it("returns fallback for non-numeric string", () => {
      localStorage.setItem("test-num", "abc");

      expect(loadNumber("test-num", 99)).toBe(99);
    });

    it("parses only integer part (parseInt behavior)", () => {
      localStorage.setItem("test-num", "3.7");

      expect(loadNumber("test-num", 0)).toBe(3);
    });

    it("handles negative numbers", () => {
      localStorage.setItem("test-num", "-5");

      expect(loadNumber("test-num", 0)).toBe(-5);
    });
  });

  // ==================== loadString ====================

  describe("loadString", () => {
    it("returns fallback when key does not exist", () => {
      expect(loadString("missing", "default")).toBe("default");
    });

    it("returns stored string", () => {
      localStorage.setItem("test-str", "hello");

      expect(loadString("test-str", "default")).toBe("hello");
    });

    it("returns fallback for empty string (falsy)", () => {
      localStorage.setItem("test-str", "");

      expect(loadString("test-str", "default")).toBe("default");
    });
  });

  // ==================== STORAGE_KEYS ====================

  describe("STORAGE_KEYS", () => {
    it("has all expected keys", () => {
      expect(STORAGE_KEYS.barriers).toBe("smartTool.barriers");
      expect(STORAGE_KEYS.history).toBe("smartTool.history");
      expect(STORAGE_KEYS.templates).toBe("smartTool.templates");
      expect(STORAGE_KEYS.gdprConsent).toBe("smartTool.gdprConsent");
      expect(STORAGE_KEYS.retentionDays).toBe("smartTool.retentionDays");
      expect(STORAGE_KEYS.aiDraftMode).toBe("smartTool.aiDraftMode");
      expect(STORAGE_KEYS.aiDraftRuntime).toBe("smartTool.aiDraftRuntime");
    });

    it("all keys are prefixed with smartTool.", () => {
      for (const [, value] of Object.entries(STORAGE_KEYS)) {
        expect(value).toMatch(/^smartTool\./);
      }
    });
  });
});
