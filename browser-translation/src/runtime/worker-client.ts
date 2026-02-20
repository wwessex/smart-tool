/**
 * Main-thread client for the translation Web Worker.
 *
 * Provides a Promise-based API over the Worker message protocol,
 * handling request/response correlation, timeouts, and cleanup.
 *
 * @example
 * ```ts
 * const client = new TranslationWorkerClient("/worker.js");
 *
 * await client.initialize({
 *   modelBasePath: "/models/",
 *   allowRemoteModels: false,
 *   useBrowserCache: true,
 *   maxLoadedPipelines: 3,
 *   maxChunkChars: 900,
 * });
 *
 * const result = await client.translate({
 *   text: "Hello world",
 *   sourceLang: "en",
 *   targetLang: "de",
 * });
 * ```
 */

import type {
  WorkerMessage,
  TranslationEngineConfig,
  TranslationRequest,
  TranslationResult,
  InferenceBackend,
  ModelLoadProgress,
  LanguagePairId,
  ModelDtype,
} from "../types.js";

/** Callbacks for worker events. */
export interface WorkerClientCallbacks {
  onProgress?: (progress: ModelLoadProgress) => void;
  onBackendSelected?: (backend: InferenceBackend) => void;
}

/** Pending request awaiting worker response. */
interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/** Default timeout for translation requests (5 minutes). */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export class TranslationWorkerClient {
  private worker: Worker | null = null;
  private readonly workerUrl: string;
  private readonly pending = new Map<string, PendingRequest<any>>();
  private callbacks: WorkerClientCallbacks = {};
  private nextId = 0;
  private initPromise: Promise<InferenceBackend> | null = null;

  constructor(workerUrl: string) {
    this.workerUrl = workerUrl;
  }

  /**
   * Initialize the worker and the translation engine within it.
   * Returns the selected inference backend.
   */
  async initialize(
    config: TranslationEngineConfig,
    callbacks: WorkerClientCallbacks = {}
  ): Promise<InferenceBackend> {
    this.callbacks = callbacks;

    // Create worker
    this.worker = new Worker(this.workerUrl, { type: "module" });
    this.worker.onmessage = (event) => this.handleMessage(event.data);
    this.worker.onerror = (event) => this.handleError(event);

    // Send init and wait for response
    this.initPromise = new Promise<InferenceBackend>((resolve, reject) => {
      const id = "__init__";
      this.pending.set(id, {
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.pending.delete(id);
          reject(new Error("Translation engine initialization timed out"));
        }, 30_000),
      });

      this.post({ type: "init", config });
    });

    return this.initPromise;
  }

  /**
   * Translate text using the worker.
   */
  async translate(
    request: TranslationRequest,
    timeoutMs = DEFAULT_TIMEOUT_MS
  ): Promise<TranslationResult> {
    this.ensureWorker();

    const id = this.generateId();

    return new Promise<TranslationResult>((resolve, reject) => {
      this.pending.set(id, {
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.pending.delete(id);
          this.post({ type: "abort", id });
          reject(new Error(`Translation timed out after ${timeoutMs}ms`));
        }, timeoutMs),
      });

      this.post({ type: "translate", id, request });
    });
  }

  /**
   * Preload a model for a language pair.
   */
  async preload(pair: LanguagePairId, dtype?: ModelDtype): Promise<void> {
    this.ensureWorker();

    const id = `preload:${pair}`;

    return new Promise<void>((resolve, reject) => {
      this.pending.set(id, {
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`Preload timed out for ${pair}`));
        }, 60_000),
      });

      this.post({ type: "preload", pair, dtype });
    });
  }

  /**
   * Evict a loaded model from the worker.
   */
  evict(pair: LanguagePairId): void {
    if (this.worker) {
      this.post({ type: "evict", pair });
    }
  }

  /**
   * Abort a pending translation.
   */
  abort(id: string): void {
    const pending = this.pending.get(id);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Translation aborted"));
      this.pending.delete(id);
    }
    if (this.worker) {
      this.post({ type: "abort", id });
    }
  }

  /**
   * Terminate the worker and clean up.
   */
  dispose(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Worker disposed"));
    }
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
    this.initPromise = null;
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private handleMessage(msg: WorkerMessage): void {
    switch (msg.type) {
      case "init_complete": {
        const pending = this.pending.get("__init__");
        if (pending) {
          clearTimeout(pending.timeout);
          pending.resolve(msg.backend);
          this.pending.delete("__init__");
        }
        this.callbacks.onBackendSelected?.(msg.backend);
        break;
      }

      case "init_error": {
        const pending = this.pending.get("__init__");
        if (pending) {
          clearTimeout(pending.timeout);
          pending.reject(new Error(msg.error));
          this.pending.delete("__init__");
        }
        break;
      }

      case "translate_complete": {
        const pending = this.pending.get(msg.id);
        if (pending) {
          clearTimeout(pending.timeout);
          pending.resolve(msg.result);
          this.pending.delete(msg.id);
        }
        break;
      }

      case "translate_error": {
        const pending = this.pending.get(msg.id);
        if (pending) {
          clearTimeout(pending.timeout);
          pending.reject(new Error(msg.error));
          this.pending.delete(msg.id);
        }
        break;
      }

      case "preload_complete": {
        const id = `preload:${msg.pair}`;
        const pending = this.pending.get(id);
        if (pending) {
          clearTimeout(pending.timeout);
          pending.resolve(undefined);
          this.pending.delete(id);
        }
        break;
      }

      case "evict_complete":
        // No pending promise to resolve; fire-and-forget
        break;

      case "progress":
        this.callbacks.onProgress?.(msg.progress);
        break;
    }
  }

  private handleError(event: ErrorEvent): void {
    // Reject all pending requests
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Worker error: ${event.message}`));
    }
    this.pending.clear();
  }

  private post(message: WorkerMessage): void {
    this.worker?.postMessage(message);
  }

  private ensureWorker(): void {
    if (!this.worker) {
      throw new Error("Worker not initialized. Call initialize() first.");
    }
  }

  private generateId(): string {
    return `tr_${++this.nextId}_${Date.now()}`;
  }
}
