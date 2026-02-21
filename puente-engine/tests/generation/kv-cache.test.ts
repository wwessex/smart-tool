import { describe, it, expect } from "vitest";
import { KVCache } from "../../src/generation/kv-cache.js";

describe("KVCache", () => {
  const baseConfig = {
    numLayers: 2,
    numKVHeads: 4,
    headDim: 64,
  };

  describe("initialization", () => {
    it("starts empty", () => {
      const cache = new KVCache(baseConfig);
      expect(cache.isEmpty).toBe(true);
      expect(cache.seqLength).toBe(0);
    });
  });

  describe("getFeedTensors", () => {
    it("returns empty tensors for initial state", () => {
      const cache = new KVCache(baseConfig);
      const feeds = cache.getFeedTensors();

      // Should have 4 entries: 2 layers × (key + value)
      expect(Object.keys(feeds)).toHaveLength(4);

      // Check naming pattern
      expect(feeds["past_key_values.0.key"]).toBeDefined();
      expect(feeds["past_key_values.0.value"]).toBeDefined();
      expect(feeds["past_key_values.1.key"]).toBeDefined();
      expect(feeds["past_key_values.1.value"]).toBeDefined();

      // Empty tensors should have seq_length=0
      const key0 = feeds["past_key_values.0.key"];
      expect(key0.dims).toEqual([1, 4, 0, 64]);
    });

    it("includes cross-attention entries for encoder-decoder", () => {
      const cache = new KVCache({
        ...baseConfig,
        hasCrossAttention: true,
      });
      const feeds = cache.getFeedTensors();

      // 2 layers × (self key + self value + enc key + enc value) = 8
      expect(Object.keys(feeds)).toHaveLength(8);
      expect(feeds["past_key_values.0.encoder.key"]).toBeDefined();
      expect(feeds["past_key_values.0.encoder.value"]).toBeDefined();
    });
  });

  describe("clear", () => {
    it("resets sequence length", () => {
      const cache = new KVCache(baseConfig);
      cache.clear();
      expect(cache.seqLength).toBe(0);
      expect(cache.isEmpty).toBe(true);
    });
  });

  describe("dispose", () => {
    it("clears all state", () => {
      const cache = new KVCache(baseConfig);
      cache.dispose();
      expect(cache.isEmpty).toBe(true);
    });
  });
});
