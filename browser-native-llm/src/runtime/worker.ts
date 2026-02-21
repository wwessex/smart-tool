/**
 * Web Worker for off-main-thread LLM inference.
 *
 * Runs the inference engine in a dedicated worker thread so the UI
 * remains responsive during model loading and token generation.
 * Communicates with the main thread via structured WorkerMessage protocol.
 */

import type { WorkerMessage, InferenceConfig, InferenceBackend } from "../types.js";
import { detectCapabilities, selectBackend } from "./backend-selector.js";
import {
  PuenteInferenceEngine,
  type InferenceEngine,
  type GenerateResult,
} from "../model/inference.js";

let engine: InferenceEngine | null = null;
let activeBackend: InferenceBackend = "wasm-basic";

/**
 * Handle messages from the main thread.
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case "init":
      await handleInit(msg.config);
      break;
    case "generate":
      await handleGenerate(msg.id, msg.prompt, msg.config);
      break;
    case "abort":
      // Abort is handled via AbortController in generate
      break;
  }
};

async function handleInit(config: InferenceConfig): Promise<void> {
  try {
    // Detect browser capabilities
    const capabilities = await detectCapabilities();
    activeBackend = selectBackend(
      capabilities,
      config.preferred_backend
    );

    // Create Puente Engine inference (custom ONNX Runtime backend with
    // full tokenization, KV cache, and generation loop).
    engine = new PuenteInferenceEngine(config, activeBackend);
    await engine.load((loaded, total) => {
      postMessage({
        type: "progress",
        progress: {
          file: "model",
          loaded_bytes: loaded,
          total_bytes: total,
          phase: "downloading",
        },
      } satisfies WorkerMessage);
    });

    // Read actual backend from the engine (may differ from initial
    // selection if WebGPU failed and the pipeline fell back to WASM)
    activeBackend = engine.backend;

    postMessage({
      type: "init_complete",
      backend: activeBackend,
    } satisfies WorkerMessage);
  } catch (error) {
    postMessage({
      type: "init_error",
      error: error instanceof Error ? error.message : String(error),
    } satisfies WorkerMessage);
  }
}

async function handleGenerate(
  id: string,
  prompt: string,
  configOverrides: Partial<InferenceConfig>
): Promise<void> {
  if (!engine || !engine.isLoaded) {
    postMessage({
      type: "generate_error",
      id,
      error: "Model not loaded",
    } satisfies WorkerMessage);
    return;
  }

  try {
    const abortController = new AbortController();

    // Listen for abort messages for this generation ID
    const abortHandler = (event: MessageEvent<WorkerMessage>) => {
      if (event.data.type === "abort" && event.data.id === id) {
        abortController.abort();
      }
    };
    self.addEventListener("message", abortHandler as EventListener);

    const result: GenerateResult = await engine.generate({
      prompt,
      max_new_tokens: configOverrides.max_new_tokens,
      temperature: configOverrides.temperature,
      top_p: configOverrides.top_p,
      repetition_penalty: configOverrides.repetition_penalty,
      signal: abortController.signal,
      stop_sequences: ["<|/json|>", "<|end|>"],
      on_token: (token, done) => {
        postMessage({
          type: "token",
          id,
          token,
          done,
        } satisfies WorkerMessage);
      },
    });

    self.removeEventListener("message", abortHandler as EventListener);

    postMessage({
      type: "generate_complete",
      id,
      text: result.text,
      tokens_generated: result.tokens_generated,
      time_ms: result.time_ms,
    } satisfies WorkerMessage);
  } catch (error) {
    postMessage({
      type: "generate_error",
      id,
      error: error instanceof Error ? error.message : String(error),
    } satisfies WorkerMessage);
  }
}
