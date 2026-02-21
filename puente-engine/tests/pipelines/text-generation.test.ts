import { describe, it, expect } from "vitest";
import { TextGenerationPipeline } from "../../src/pipelines/text-generation.js";

describe("TextGenerationPipeline", () => {
  it("exports the TextGenerationPipeline class", () => {
    expect(TextGenerationPipeline).toBeDefined();
    expect(typeof TextGenerationPipeline.create).toBe("function");
  });

  it("has the expected static create method signature", () => {
    // Verify the create method exists and accepts modelPath + options
    const createFn = TextGenerationPipeline.create;
    expect(createFn.length).toBeGreaterThanOrEqual(1);
  });

  // Note: Full integration tests require actual ONNX models and are
  // intended for browser/WebGPU environments. These unit tests verify
  // the API surface and TypeScript types are correct.
});
