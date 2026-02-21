import { describe, it, expect, beforeEach } from "vitest";
import { BPETokenizer } from "../../src/tokenizer/bpe-tokenizer.js";
import type { TokenizerJSON } from "../../src/core/types.js";

/**
 * Minimal tokenizer.json config for testing.
 * Uses a small vocabulary with a few BPE merges.
 */
function createMockTokenizerConfig(): TokenizerJSON {
  return {
    version: "1.0",
    model: {
      type: "BPE",
      vocab: {
        h: 0,
        e: 1,
        l: 2,
        o: 3,
        w: 4,
        r: 5,
        d: 6,
        " ": 7,
        he: 8,
        ll: 9,
        lo: 10,
        wo: 11,
        rl: 12,
        hel: 13,
        wor: 14,
        helo: 15,  // not used in merges but in vocab
      },
      merges: [
        "h e",   // rank 0: h + e → he
        "l l",   // rank 1: l + l → ll
        "l o",   // rank 2: l + o → lo
        "w o",   // rank 3: w + o → wo
        "r l",   // rank 4: r + l → rl
        "he l",  // rank 5: he + l → hel
        "wo r",  // rank 6: wo + r → wor
      ],
    },
    added_tokens: [
      { id: 100, content: "<s>", single_word: false, lstrip: false, rstrip: false, normalized: false, special: true },
      { id: 101, content: "</s>", single_word: false, lstrip: false, rstrip: false, normalized: false, special: true },
      { id: 102, content: "<pad>", single_word: false, lstrip: false, rstrip: false, normalized: false, special: true },
    ],
    normalizer: null,
    pre_tokenizer: null,
    decoder: null,
  };
}

describe("BPETokenizer", () => {
  let tokenizer: BPETokenizer;

  beforeEach(async () => {
    tokenizer = new BPETokenizer();
    await tokenizer.load(createMockTokenizerConfig());
  });

  describe("initialization", () => {
    it("reports as initialized after load", () => {
      expect(tokenizer.isInitialized).toBe(true);
    });

    it("throws if used before initialization", async () => {
      const fresh = new BPETokenizer();
      expect(() => fresh.encode("test")).toThrow("not initialized");
    });

    it("has correct vocab size", () => {
      // 16 vocab entries + 3 added tokens
      expect(tokenizer.vocabSize).toBeGreaterThanOrEqual(16);
    });

    it("identifies special tokens", () => {
      expect(tokenizer.bosTokenId).toBe(100);
      expect(tokenizer.eosTokenId).toBe(101);
      expect(tokenizer.padTokenId).toBe(102);
    });
  });

  describe("encode", () => {
    it("encodes empty string to empty array", () => {
      expect(tokenizer.encode("")).toEqual([]);
    });

    it("encodes a single character", () => {
      const ids = tokenizer.encode("h");
      expect(ids).toEqual([0]);
    });

    it("applies BPE merges correctly", () => {
      // "he" should merge: h + e → he (rank 0)
      const ids = tokenizer.encode("he");
      expect(ids).toEqual([8]); // he=8
    });

    it("applies multiple BPE merges", () => {
      // "hel" should merge: h+e → he (rank 0), then he+l → hel (rank 5)
      const ids = tokenizer.encode("hel");
      expect(ids).toEqual([13]); // hel=13
    });

    it("handles text with spaces", () => {
      // Without pre-tokenizer, space is just another character
      const ids = tokenizer.encode("he d");
      expect(ids).toEqual([8, 7, 6]); // he=8, ' '=7, d=6
    });

    it("handles special tokens in text", () => {
      const ids = tokenizer.encode("<s>he</s>");
      expect(ids).toEqual([100, 8, 101]); // <s>=100, he=8, </s>=101
    });
  });

  describe("decode", () => {
    it("decodes empty array to empty string", () => {
      expect(tokenizer.decode([])).toBe("");
    });

    it("decodes single token", () => {
      expect(tokenizer.decode([0])).toBe("h");
    });

    it("decodes merged tokens", () => {
      expect(tokenizer.decode([8])).toBe("he");
    });

    it("decodes multiple tokens", () => {
      expect(tokenizer.decode([8, 7, 6])).toBe("he d");
    });

    it("skips special tokens by default", () => {
      expect(tokenizer.decode([100, 8, 101])).toBe("he");
    });

    it("includes special tokens when skipSpecialTokens=false", () => {
      expect(tokenizer.decode([100, 8, 101], false)).toBe("<s>he</s>");
    });
  });

  describe("getTokenId", () => {
    it("returns ID for regular tokens", () => {
      expect(tokenizer.getTokenId("he")).toBe(8);
    });

    it("returns ID for special tokens", () => {
      expect(tokenizer.getTokenId("<s>")).toBe(100);
    });

    it("returns undefined for unknown tokens", () => {
      expect(tokenizer.getTokenId("xyz")).toBeUndefined();
    });
  });

  describe("roundtrip", () => {
    it("encode then decode produces original text", () => {
      const text = "hello world";
      const ids = tokenizer.encode(text);
      const decoded = tokenizer.decode(ids);
      expect(decoded).toBe(text);
    });
  });
});
