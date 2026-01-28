import { describe, it } from "vitest";

describe("useTransformersLLM", () => {
  describe("browser and device detection", () => {
    it.todo("detects Chrome, Safari, Firefox, and Edge user agents");
    it.todo("detects mobile vs desktop devices");
    it.todo("maps browser optimizations per platform");
  });

  describe("feature gating", () => {
    it.todo("blocks Android devices by default");
    it.todo("blocks iOS devices unless experimental flag is enabled");
    it.todo("handles model loading errors gracefully");
  });
});
