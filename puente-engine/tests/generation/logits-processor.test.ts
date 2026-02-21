import { describe, it, expect } from "vitest";
import {
  RepetitionPenaltyProcessor,
  ForcedTokenProcessor,
  NoRepeatNgramProcessor,
  LogitsProcessorList,
} from "../../src/generation/logits-processor.js";

describe("RepetitionPenaltyProcessor", () => {
  it("no-ops when penalty is 1.0", () => {
    const proc = new RepetitionPenaltyProcessor(1.0);
    const logits = new Float32Array([1.0, 2.0, 3.0]);
    const result = proc.process(logits, [0, 1]);
    expect(Array.from(result)).toEqual([1.0, 2.0, 3.0]);
  });

  it("reduces positive logits of seen tokens", () => {
    const proc = new RepetitionPenaltyProcessor(2.0);
    const logits = new Float32Array([4.0, 2.0, 3.0]);
    const result = proc.process(logits, [0]); // token 0 was seen
    expect(result[0]).toBe(2.0); // 4.0 / 2.0
    expect(result[1]).toBe(2.0); // unchanged
    expect(result[2]).toBe(3.0); // unchanged
  });

  it("amplifies negative logits of seen tokens", () => {
    const proc = new RepetitionPenaltyProcessor(2.0);
    const logits = new Float32Array([-4.0, 2.0, 3.0]);
    const result = proc.process(logits, [0]);
    expect(result[0]).toBe(-8.0); // -4.0 * 2.0
    expect(result[1]).toBe(2.0);
  });

  it("handles empty inputIds", () => {
    const proc = new RepetitionPenaltyProcessor(2.0);
    const logits = new Float32Array([1.0, 2.0, 3.0]);
    const result = proc.process(logits, []);
    expect(Array.from(result)).toEqual([1.0, 2.0, 3.0]);
  });

  it("handles out-of-range token IDs gracefully", () => {
    const proc = new RepetitionPenaltyProcessor(2.0);
    const logits = new Float32Array([1.0, 2.0]);
    const result = proc.process(logits, [5, -1]); // out of range
    expect(Array.from(result)).toEqual([1.0, 2.0]);
  });
});

describe("ForcedTokenProcessor", () => {
  it("forces token at specified step", () => {
    const proc = new ForcedTokenProcessor([[0, 5]]); // step 0 → token 5
    const logits = new Float32Array(10).fill(1.0);
    const result = proc.process(logits, []); // step 0 (inputIds length = 0)
    expect(result[5]).toBe(0);
    for (let i = 0; i < 10; i++) {
      if (i !== 5) expect(result[i]).toBe(-Infinity);
    }
  });

  it("does not force at non-matching step", () => {
    const proc = new ForcedTokenProcessor([[0, 5]]);
    const logits = new Float32Array([1.0, 2.0, 3.0]);
    const result = proc.process(logits, [5]); // step 1
    expect(Array.from(result)).toEqual([1.0, 2.0, 3.0]);
  });
});

describe("NoRepeatNgramProcessor", () => {
  it("bans tokens that would repeat a bigram", () => {
    const proc = new NoRepeatNgramProcessor(2);
    const logits = new Float32Array(5).fill(1.0);
    // History: [1, 2, 3, 1] — next token 2 would repeat bigram [1, 2]
    const result = proc.process(logits, [1, 2, 3, 1]);
    expect(result[2]).toBe(-Infinity); // token 2 banned
    expect(result[0]).toBe(1.0); // other tokens unchanged
    expect(result[3]).toBe(1.0);
  });

  it("no-ops with empty history", () => {
    const proc = new NoRepeatNgramProcessor(2);
    const logits = new Float32Array([1.0, 2.0, 3.0]);
    const result = proc.process(logits, []);
    expect(Array.from(result)).toEqual([1.0, 2.0, 3.0]);
  });

  it("no-ops when ngram size is 0", () => {
    const proc = new NoRepeatNgramProcessor(0);
    const logits = new Float32Array([1.0, 2.0, 3.0]);
    const result = proc.process(logits, [0, 1, 0]);
    expect(Array.from(result)).toEqual([1.0, 2.0, 3.0]);
  });
});

describe("LogitsProcessorList", () => {
  it("chains processors in order", () => {
    const list = new LogitsProcessorList();
    list.add(new RepetitionPenaltyProcessor(2.0));
    list.add(new ForcedTokenProcessor([[1, 0]])); // force at step 1

    const logits = new Float32Array([4.0, 2.0, 3.0]);
    const result = list.process(logits, [0]); // step 1, token 0 seen

    // After repetition penalty: [2.0, 2.0, 3.0]
    // After forced token at step 1: force token 0
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(-Infinity);
    expect(result[2]).toBe(-Infinity);
  });

  it("reports correct length", () => {
    const list = new LogitsProcessorList();
    expect(list.length).toBe(0);
    list.add(new RepetitionPenaltyProcessor(1.0));
    expect(list.length).toBe(1);
  });
});
