import { describe, it, expect } from "vitest";
import { TranslationPipeline } from "../../src/pipelines/translation.js";

describe("TranslationPipeline", () => {
  it("exports the TranslationPipeline class", () => {
    expect(TranslationPipeline).toBeDefined();
    expect(typeof TranslationPipeline.create).toBe("function");
  });

  it("has the expected static create method signature", () => {
    const createFn = TranslationPipeline.create;
    expect(createFn.length).toBeGreaterThanOrEqual(1);
  });

  // Note: Full integration tests require actual ONNX models.
  // These verify the API surface and TypeScript types compile correctly.
});
