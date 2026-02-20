/**
 * Translation Web Worker entry point.
 *
 * Runs translation inference off the main thread to keep the UI responsive.
 * Communicates with the main thread via structured WorkerMessage types.
 *
 * Usage: instantiate as a Web Worker from the main thread:
 *   const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
 */

import type { WorkerMessage, TranslationEngineConfig, TranslationRequest, LanguagePairId, ModelDtype } from "../types.js";
import { TranslationEngine } from "../engine/translator.js";

let engine: TranslationEngine | null = null;
const abortControllers = new Map<string, AbortController>();

/**
 * Post a typed message back to the main thread.
 */
function post(message: WorkerMessage): void {
  self.postMessage(message);
}

/**
 * Handle incoming messages from the main thread.
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;

  switch (msg.type) {
    case "init":
      await handleInit(msg.config);
      break;

    case "translate":
      await handleTranslate(msg.id, msg.request);
      break;

    case "preload":
      await handlePreload(msg.pair, msg.dtype);
      break;

    case "evict":
      handleEvict(msg.pair);
      break;

    case "abort":
      handleAbort(msg.id);
      break;
  }
};

async function handleInit(config: TranslationEngineConfig): Promise<void> {
  try {
    engine = new TranslationEngine(config);
    await engine.initialize({
      onModelLoadProgress: (progress) => {
        post({ type: "progress", progress });
      },
      onBackendSelected: (backend) => {
        post({ type: "init_complete", backend });
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    post({ type: "init_error", error: message });
  }
}

async function handleTranslate(id: string, request: TranslationRequest): Promise<void> {
  if (!engine) {
    post({ type: "translate_error", id, error: "Engine not initialized" });
    return;
  }

  const controller = new AbortController();
  abortControllers.set(id, controller);

  try {
    const result = await engine.translate(request);
    // Check if aborted during translation
    if (!controller.signal.aborted) {
      post({ type: "translate_complete", id, result });
    }
  } catch (error) {
    if (!controller.signal.aborted) {
      const message = error instanceof Error ? error.message : String(error);
      post({ type: "translate_error", id, error: message });
    }
  } finally {
    abortControllers.delete(id);
  }
}

async function handlePreload(
  pair: string,
  dtype?: string
): Promise<void> {
  if (!engine) return;

  try {
    const [source, target] = pair.split("-");
    await engine.preload(source, target, dtype as ModelDtype | undefined);
    post({ type: "preload_complete", pair: pair as LanguagePairId });
  } catch {
    // Preload failures are non-critical
  }
}

function handleEvict(pair: string): void {
  if (!engine) return;

  const [source, target] = pair.split("-");
  engine.evict(source, target);
  post({ type: "evict_complete", pair: pair as LanguagePairId });
}

function handleAbort(id: string): void {
  const controller = abortControllers.get(id);
  if (controller) {
    controller.abort();
    abortControllers.delete(id);
  }
}
