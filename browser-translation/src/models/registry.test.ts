import { describe, expect, it } from "vitest";

import {
  getModelForPair,
  hasDirectModel,
  SUPPORTED_LANGUAGES,
  getSupportedLanguageCodes,
} from "./registry.js";

const NEW_REVERSE_PAIRS = [
  "cy-en",
  "ur-en",
  "bn-en",
  "pa-en",
  "ps-en",
  "so-en",
  "ti-en",
  "it-en",
  "pt-en",
  "hi-en",
] as const;

describe("SUPPORTED_LANGUAGES language knowledge", () => {
  const codes = getSupportedLanguageCodes();

  it("every language has a valid iso639_2 code (3 characters)", () => {
    for (const code of codes) {
      const info = SUPPORTED_LANGUAGES[code];
      expect(info.iso639_2, `${code} missing iso639_2`).toBeDefined();
      expect(info.iso639_2!.length, `${code} iso639_2 should be 3 chars`).toBe(3);
    }
  });

  it("every language has a valid iso639_3 code (3 characters)", () => {
    for (const code of codes) {
      const info = SUPPORTED_LANGUAGES[code];
      expect(info.iso639_3, `${code} missing iso639_3`).toBeDefined();
      expect(info.iso639_3!.length, `${code} iso639_3 should be 3 chars`).toBe(3);
    }
  });

  it("every language has a non-empty script name", () => {
    for (const code of codes) {
      const info = SUPPORTED_LANGUAGES[code];
      expect(info.script, `${code} missing script`).toBeDefined();
      expect(info.script!.length, `${code} script should be non-empty`).toBeGreaterThan(0);
    }
  });

  it("every language has a non-empty family array", () => {
    for (const code of codes) {
      const info = SUPPORTED_LANGUAGES[code];
      expect(info.family, `${code} missing family`).toBeDefined();
      expect(info.family!.length, `${code} family should have at least one entry`).toBeGreaterThan(0);
    }
  });

  it("every language has at least one region", () => {
    for (const code of codes) {
      const info = SUPPORTED_LANGUAGES[code];
      expect(info.regions, `${code} missing regions`).toBeDefined();
      expect(info.regions!.length, `${code} should have at least one region`).toBeGreaterThan(0);
    }
  });

  it("every language has a greeting", () => {
    for (const code of codes) {
      const info = SUPPORTED_LANGUAGES[code];
      expect(info.greeting, `${code} missing greeting`).toBeDefined();
      expect(info.greeting!.length, `${code} greeting should be non-empty`).toBeGreaterThan(0);
    }
  });

  it("every language has a positive speakersMillions value", () => {
    for (const code of codes) {
      const info = SUPPORTED_LANGUAGES[code];
      expect(info.speakersMillions, `${code} missing speakersMillions`).toBeDefined();
      expect(info.speakersMillions!, `${code} speakersMillions should be positive`).toBeGreaterThan(0);
    }
  });

  it("RTL languages use Arabic script", () => {
    for (const code of codes) {
      const info = SUPPORTED_LANGUAGES[code];
      if (info.direction === "rtl") {
        expect(info.script, `RTL language ${code} should use Arabic script`).toBe("Arabic");
      }
    }
  });
});

describe("MODEL_REGISTRY reverse language coverage", () => {
  it("registers direct reverse entries for target-only languages", () => {
    for (const pair of NEW_REVERSE_PAIRS) {
      expect(hasDirectModel(pair)).toBe(true);

      const model = getModelForPair(pair);
      expect(model).toBeDefined();
      expect(model?.modelId).toBe(`opus-mt-${pair}`);
      expect(model?.availableDtypes).toEqual(["fp32", "fp16", "int8", "q4"]);
      expect(model?.recommendedDtype).toBe("q4");
      expect(model?.approximateSizeBytes).toBeGreaterThan(0);
      expect(model?.attribution).toContain("OPUS-MT");
    }
  });
});
