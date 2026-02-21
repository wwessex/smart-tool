import { describe, it, expect } from "vitest";
import {
  MaxTokensCriterion,
  EosTokenCriterion,
  StopSequenceCriterion,
  StoppingCriteriaList,
} from "../../src/generation/stopping.js";

describe("MaxTokensCriterion", () => {
  it("stops when max tokens reached", () => {
    const criterion = new MaxTokensCriterion(3);
    expect(criterion.shouldStop([1, 2, 3], "abc")).toBe(true);
  });

  it("does not stop before max tokens", () => {
    const criterion = new MaxTokensCriterion(3);
    expect(criterion.shouldStop([1, 2], "ab")).toBe(false);
  });

  it("stops when exceeded", () => {
    const criterion = new MaxTokensCriterion(2);
    expect(criterion.shouldStop([1, 2, 3], "abc")).toBe(true);
  });
});

describe("EosTokenCriterion", () => {
  it("stops on single EOS token", () => {
    const criterion = new EosTokenCriterion(2);
    expect(criterion.shouldStop([1, 3, 2], "")).toBe(true);
  });

  it("does not stop on non-EOS token", () => {
    const criterion = new EosTokenCriterion(2);
    expect(criterion.shouldStop([1, 3, 4], "")).toBe(false);
  });

  it("handles multiple EOS token IDs", () => {
    const criterion = new EosTokenCriterion([2, 5]);
    expect(criterion.shouldStop([1, 5], "")).toBe(true);
    expect(criterion.shouldStop([1, 2], "")).toBe(true);
    expect(criterion.shouldStop([1, 3], "")).toBe(false);
  });

  it("does not stop on empty list", () => {
    const criterion = new EosTokenCriterion(2);
    expect(criterion.shouldStop([], "")).toBe(false);
  });
});

describe("StopSequenceCriterion", () => {
  it("stops when stop sequence found", () => {
    const criterion = new StopSequenceCriterion(["<|end|>"]);
    expect(criterion.shouldStop([], "Hello<|end|>")).toBe(true);
  });

  it("does not stop when stop sequence not found", () => {
    const criterion = new StopSequenceCriterion(["<|end|>"]);
    expect(criterion.shouldStop([], "Hello world")).toBe(false);
  });

  it("handles multiple stop sequences", () => {
    const criterion = new StopSequenceCriterion(["<|end|>", "<|/json|>"]);
    expect(criterion.shouldStop([], "data<|/json|>")).toBe(true);
  });

  it("handles empty text", () => {
    const criterion = new StopSequenceCriterion(["stop"]);
    expect(criterion.shouldStop([], "")).toBe(false);
  });
});

describe("StoppingCriteriaList", () => {
  it("stops if any criterion is met", () => {
    const list = new StoppingCriteriaList();
    list.add(new MaxTokensCriterion(10));
    list.add(new EosTokenCriterion(2));

    // EOS met but not max tokens
    expect(list.shouldStop([1, 2], "ab")).toBe(true);
  });

  it("does not stop if no criteria met", () => {
    const list = new StoppingCriteriaList();
    list.add(new MaxTokensCriterion(10));
    list.add(new EosTokenCriterion(2));

    expect(list.shouldStop([1, 3], "ac")).toBe(false);
  });

  it("reports correct length", () => {
    const list = new StoppingCriteriaList();
    expect(list.length).toBe(0);
    list.add(new MaxTokensCriterion(5));
    expect(list.length).toBe(1);
  });
});
