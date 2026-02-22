import { describe, expect, it } from "vitest";

import { getModelForPair, hasDirectModel } from "./registry.js";

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
