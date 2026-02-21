import { describe, it, expect } from "vitest";
import {
  NFCNormalizer,
  NFKCNormalizer,
  LowercaseNormalizer,
  StripAccentsNormalizer,
  SequenceNormalizer,
  IdentityNormalizer,
  buildNormalizer,
} from "../../src/tokenizer/normalizer.js";

describe("NFCNormalizer", () => {
  it("normalizes to NFC", () => {
    const norm = new NFCNormalizer();
    // é composed vs decomposed
    const decomposed = "e\u0301"; // e + combining accent
    const composed = "\u00e9"; // é
    expect(norm.normalize(decomposed)).toBe(composed);
  });

  it("passes through ASCII unchanged", () => {
    const norm = new NFCNormalizer();
    expect(norm.normalize("hello")).toBe("hello");
  });
});

describe("NFKCNormalizer", () => {
  it("normalizes to NFKC", () => {
    const norm = new NFKCNormalizer();
    // ﬁ ligature → fi
    expect(norm.normalize("\ufb01")).toBe("fi");
  });
});

describe("LowercaseNormalizer", () => {
  it("lowercases text", () => {
    const norm = new LowercaseNormalizer();
    expect(norm.normalize("Hello WORLD")).toBe("hello world");
  });
});

describe("StripAccentsNormalizer", () => {
  it("removes diacritics", () => {
    const norm = new StripAccentsNormalizer();
    expect(norm.normalize("café")).toBe("cafe");
    expect(norm.normalize("naïve")).toBe("naive");
  });
});

describe("SequenceNormalizer", () => {
  it("chains normalisers", () => {
    const norm = new SequenceNormalizer([
      new NFCNormalizer(),
      new LowercaseNormalizer(),
    ]);
    expect(norm.normalize("HELLO")).toBe("hello");
  });
});

describe("IdentityNormalizer", () => {
  it("passes through unchanged", () => {
    const norm = new IdentityNormalizer();
    expect(norm.normalize("Hello!")).toBe("Hello!");
  });
});

describe("buildNormalizer", () => {
  it("returns identity for null config", () => {
    const norm = buildNormalizer(null);
    expect(norm.normalize("test")).toBe("test");
  });

  it("builds NFC normalizer", () => {
    const norm = buildNormalizer({ type: "NFC" });
    expect(norm.normalize("e\u0301")).toBe("\u00e9");
  });

  it("builds Lowercase normalizer", () => {
    const norm = buildNormalizer({ type: "Lowercase" });
    expect(norm.normalize("ABC")).toBe("abc");
  });

  it("builds Sequence normalizer", () => {
    const norm = buildNormalizer({
      type: "Sequence",
      normalizers: [
        { type: "NFC" },
        { type: "Lowercase" },
      ],
    });
    expect(norm.normalize("HELLO")).toBe("hello");
  });

  it("returns identity for unknown type", () => {
    const norm = buildNormalizer({ type: "UnknownType" });
    expect(norm.normalize("test")).toBe("test");
  });
});
