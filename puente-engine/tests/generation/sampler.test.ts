import { describe, it, expect } from "vitest";
import { sampleToken, greedyDecode } from "../../src/generation/sampler.js";

describe("greedyDecode", () => {
  it("returns index of highest logit", () => {
    const logits = new Float32Array([1.0, 3.0, 2.0, 0.5]);
    expect(greedyDecode(logits)).toBe(1);
  });

  it("returns first index on tie", () => {
    const logits = new Float32Array([5.0, 5.0, 1.0]);
    expect(greedyDecode(logits)).toBe(0);
  });

  it("handles negative logits", () => {
    const logits = new Float32Array([-3.0, -1.0, -2.0]);
    expect(greedyDecode(logits)).toBe(1);
  });

  it("handles single element", () => {
    const logits = new Float32Array([42.0]);
    expect(greedyDecode(logits)).toBe(0);
  });
});

describe("sampleToken", () => {
  it("uses greedy decoding when temperature=0", () => {
    const logits = new Float32Array([1.0, 5.0, 2.0]);
    expect(sampleToken(logits, { temperature: 0 })).toBe(1);
  });

  it("returns a valid token index with sampling", () => {
    const logits = new Float32Array([1.0, 2.0, 3.0, 4.0, 5.0]);
    const token = sampleToken(logits, { temperature: 1.0 });
    expect(token).toBeGreaterThanOrEqual(0);
    expect(token).toBeLessThan(logits.length);
  });

  it("respects top_k filtering", () => {
    // With top_k=1, should always pick the max
    const logits = new Float32Array([1.0, 5.0, 2.0]);
    const token = sampleToken(logits, { temperature: 1.0, top_k: 1 });
    expect(token).toBe(1);
  });

  it("respects top_p filtering with very low p", () => {
    // With very low top_p, should only sample from the most probable token
    const logits = new Float32Array([0.0, 10.0, 0.0, 0.0]);
    const token = sampleToken(logits, { temperature: 1.0, top_p: 0.01 });
    expect(token).toBe(1);
  });

  it("handles all-zero logits", () => {
    const logits = new Float32Array([0.0, 0.0, 0.0, 0.0]);
    const token = sampleToken(logits, { temperature: 1.0 });
    expect(token).toBeGreaterThanOrEqual(0);
    expect(token).toBeLessThan(logits.length);
  });
});
