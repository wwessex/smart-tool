import { describe, it, expect } from "vitest";
import { classifyAIError, type AIErrorCategory } from "@/lib/error-handling";

describe("error-handling", () => {
  describe("classifyAIError", () => {
    describe("memory errors", () => {
      it("classifies 'out of memory' as memory", () => {
        const result = classifyAIError(new Error("out of memory"));
        expect(result.category).toBe("memory");
        expect(result.retryable).toBe(false);
      });

      it("classifies OOM as memory", () => {
        const result = classifyAIError("OOM detected");
        expect(result.category).toBe("memory");
      });

      it("classifies allocation failed as memory", () => {
        const result = classifyAIError(new Error("allocation failed for buffer"));
        expect(result.category).toBe("memory");
      });

      it("classifies Worker crashed with memory as memory", () => {
        const result = classifyAIError("Worker crashed due to memory pressure");
        expect(result.category).toBe("memory");
      });
    });

    describe("timeout errors", () => {
      it("classifies 'timed out' as generation", () => {
        const result = classifyAIError(new Error("Request timed out"));
        expect(result.category).toBe("generation");
        expect(result.retryable).toBe(true);
      });

      it("classifies 'timeout' as generation", () => {
        const result = classifyAIError("Operation timeout");
        expect(result.category).toBe("generation");
      });
    });

    describe("authorization errors", () => {
      it("classifies 'unauthorized' as model_load", () => {
        const result = classifyAIError(new Error("unauthorized access"));
        expect(result.category).toBe("model_load");
        expect(result.retryable).toBe(true);
      });

      it("classifies 401 as model_load", () => {
        const result = classifyAIError("HTTP 401 response");
        expect(result.category).toBe("model_load");
      });

      it("classifies 403 as model_load", () => {
        const result = classifyAIError("403 Forbidden");
        expect(result.category).toBe("model_load");
      });
    });

    describe("network errors", () => {
      it("classifies 'Failed to fetch' as network", () => {
        const result = classifyAIError(new Error("Failed to fetch"));
        expect(result.category).toBe("network");
        expect(result.retryable).toBe(true);
      });

      it("classifies ECONNREFUSED as network", () => {
        const result = classifyAIError("ECONNREFUSED");
        expect(result.category).toBe("network");
      });

      it("classifies offline as network", () => {
        const result = classifyAIError("Device is offline");
        expect(result.category).toBe("network");
      });

      it("classifies net::ERR as network", () => {
        const result = classifyAIError("net::ERR_CONNECTION_REFUSED");
        expect(result.category).toBe("network");
      });
    });

    describe("device errors", () => {
      it("classifies WebGPU errors as device", () => {
        const result = classifyAIError(new Error("WebGPU not available"));
        expect(result.category).toBe("device");
        expect(result.retryable).toBe(true);
      });

      it("classifies SharedArrayBuffer errors as device (non-retryable)", () => {
        const result = classifyAIError("SharedArrayBuffer is not defined");
        expect(result.category).toBe("device");
        expect(result.retryable).toBe(false);
      });

      it("classifies 'not yet implemented' as device", () => {
        const result = classifyAIError("Feature not yet implemented");
        expect(result.category).toBe("device");
        expect(result.retryable).toBe(false);
      });
    });

    describe("model load errors", () => {
      it("classifies model not found (404) as model_load", () => {
        const result = classifyAIError("model not found 404");
        expect(result.category).toBe("model_load");
        expect(result.retryable).toBe(false);
      });

      it("classifies 'Failed to load model' as model_load", () => {
        const result = classifyAIError(new Error("Failed to load model weights"));
        expect(result.category).toBe("model_load");
        expect(result.retryable).toBe(true);
      });

      it("classifies 'warmup failed' as model_load", () => {
        const result = classifyAIError("warmup failed after 30s");
        expect(result.category).toBe("model_load");
      });
    });

    describe("validation errors", () => {
      it("classifies SMART criteria failure as validation", () => {
        const result = classifyAIError("No actions passed the validation");
        expect(result.category).toBe("validation");
        expect(result.retryable).toBe(true);
      });

      it("classifies score below threshold as validation", () => {
        const result = classifyAIError("validation score is below threshold");
        expect(result.category).toBe("validation");
      });
    });

    describe("plan rejection errors", () => {
      it("classifies plan score below as plan_rejected", () => {
        const result = classifyAIError("Plan score is below minimum");
        expect(result.category).toBe("plan_rejected");
        expect(result.retryable).toBe(true);
      });

      it("classifies barrier mismatch as plan_rejected", () => {
        const result = classifyAIError("No actions directly address the barrier");
        expect(result.category).toBe("plan_rejected");
      });
    });

    describe("parse errors", () => {
      it("classifies JSON errors as parse", () => {
        const result = classifyAIError("Unexpected JSON at position 0");
        expect(result.category).toBe("parse");
        expect(result.retryable).toBe(true);
      });

      it("classifies empty response as parse", () => {
        const result = classifyAIError("AI returned empty response");
        expect(result.category).toBe("parse");
      });

      it("classifies Invalid response format as parse", () => {
        const result = classifyAIError("Invalid response format from model");
        expect(result.category).toBe("parse");
      });
    });

    describe("generation errors", () => {
      it("classifies 'Generation failed' as generation", () => {
        const result = classifyAIError(new Error("Generation failed"));
        expect(result.category).toBe("generation");
        expect(result.retryable).toBe(true);
      });

      it("classifies Worker error as generation", () => {
        const result = classifyAIError("Worker error during inference");
        expect(result.category).toBe("generation");
      });
    });

    describe("consent errors", () => {
      it("classifies consent errors as consent", () => {
        const result = classifyAIError("AI consent not granted");
        expect(result.category).toBe("consent");
        expect(result.retryable).toBe(false);
      });
    });

    describe("unknown errors", () => {
      it("classifies unrecognised errors as unknown", () => {
        const result = classifyAIError(new Error("Something completely unexpected"));
        expect(result.category).toBe("unknown");
        expect(result.retryable).toBe(true);
      });

      it("handles non-Error objects", () => {
        const result = classifyAIError({ code: 500 });
        expect(result.category).toBe("unknown");
        expect(result.message).toBe("Unknown error");
      });

      it("handles null/undefined", () => {
        const result = classifyAIError(null);
        expect(result.category).toBe("unknown");

        const result2 = classifyAIError(undefined);
        expect(result2.category).toBe("unknown");
      });
    });

    describe("result structure", () => {
      it("includes all required fields", () => {
        const result = classifyAIError(new Error("test error"));

        expect(result).toHaveProperty("category");
        expect(result).toHaveProperty("title");
        expect(result).toHaveProperty("message");
        expect(result).toHaveProperty("retryable");
        expect(result).toHaveProperty("original");
      });

      it("preserves the original error", () => {
        const original = new Error("test error");
        const result = classifyAIError(original);

        expect(result.original).toBe(original);
      });

      it("provides non-empty title and message", () => {
        const result = classifyAIError(new Error("Failed to fetch"));
        expect(result.title.length).toBeGreaterThan(0);
        expect(result.message.length).toBeGreaterThan(0);
      });
    });

    describe("pattern matching order", () => {
      it("matches timeout before network (both contain 'timed out')", () => {
        const result = classifyAIError("Request timed out during fetch");
        // "timed out" should match timeout pattern first, not network
        expect(result.category).toBe("generation");
      });

      it("matches memory before generation (OOM during generation)", () => {
        const result = classifyAIError("Generation out of memory");
        expect(result.category).toBe("memory");
      });

      it("matches auth before network (401 fetch failure)", () => {
        const result = classifyAIError("401 Unauthorized fetch failed");
        expect(result.category).toBe("model_load");
      });
    });
  });
});
