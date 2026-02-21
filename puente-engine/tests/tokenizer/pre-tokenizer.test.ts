import { describe, it, expect } from "vitest";
import {
  ByteLevelPreTokenizer,
  WhitespacePreTokenizer,
  bytesToUnicode,
  unicodeToBytes,
  textToByteTokens,
} from "../../src/tokenizer/pre-tokenizer.js";

describe("bytesToUnicode", () => {
  it("returns a map with 256 entries", () => {
    const map = bytesToUnicode();
    expect(map.size).toBe(256);
  });

  it("maps printable ASCII to itself", () => {
    const map = bytesToUnicode();
    expect(map.get("A".charCodeAt(0))).toBe("A");
    expect(map.get("z".charCodeAt(0))).toBe("z");
    expect(map.get("0".charCodeAt(0))).toBe("0");
  });

  it("maps all 256 byte values to unique characters", () => {
    const map = bytesToUnicode();
    const chars = new Set(map.values());
    expect(chars.size).toBe(256);
  });
});

describe("unicodeToBytes", () => {
  it("is the inverse of bytesToUnicode", () => {
    const b2u = bytesToUnicode();
    const u2b = unicodeToBytes();
    for (const [byte, char] of b2u) {
      expect(u2b.get(char)).toBe(byte);
    }
  });
});

describe("textToByteTokens", () => {
  it("converts ASCII text to byte tokens", () => {
    const result = textToByteTokens("Hi");
    // H and i are printable ASCII, should map to themselves
    expect(result).toBe("Hi");
  });

  it("converts space to its byte token", () => {
    const result = textToByteTokens(" ");
    const b2u = bytesToUnicode();
    expect(result).toBe(b2u.get(32)); // space = byte 32
  });
});

describe("ByteLevelPreTokenizer", () => {
  it("splits text into word-level segments", () => {
    const pt = new ByteLevelPreTokenizer();
    const tokens = pt.preTokenize("Hello world");
    expect(tokens.length).toBeGreaterThanOrEqual(2);
  });

  it("handles empty input", () => {
    const pt = new ByteLevelPreTokenizer();
    expect(pt.preTokenize("")).toEqual([]);
  });

  it("handles single word", () => {
    const pt = new ByteLevelPreTokenizer();
    const tokens = pt.preTokenize("Hello");
    expect(tokens.length).toBe(1);
  });

  it("adds prefix space when configured", () => {
    const pt = new ByteLevelPreTokenizer(true);
    const tokens = pt.preTokenize("Hello");
    // With prefix space, "Hello" becomes " Hello" before splitting
    expect(tokens.length).toBeGreaterThanOrEqual(1);
  });

  it("preserves punctuation as separate tokens", () => {
    const pt = new ByteLevelPreTokenizer();
    const tokens = pt.preTokenize("Hello, world!");
    expect(tokens.length).toBeGreaterThanOrEqual(3);
  });
});

describe("WhitespacePreTokenizer", () => {
  it("splits on whitespace", () => {
    const pt = new WhitespacePreTokenizer();
    expect(pt.preTokenize("Hello world")).toEqual(["Hello", "world"]);
  });

  it("handles multiple spaces", () => {
    const pt = new WhitespacePreTokenizer();
    expect(pt.preTokenize("a  b   c")).toEqual(["a", "b", "c"]);
  });

  it("handles empty input", () => {
    const pt = new WhitespacePreTokenizer();
    expect(pt.preTokenize("")).toEqual([]);
  });

  it("handles tabs and newlines", () => {
    const pt = new WhitespacePreTokenizer();
    expect(pt.preTokenize("a\tb\nc")).toEqual(["a", "b", "c"]);
  });
});
