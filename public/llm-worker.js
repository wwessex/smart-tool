// Web Worker for WebLLM - Isolates heavy LLM computation from main UI thread
import { WebWorkerMLCEngineHandler } from "https://esm.run/@mlc-ai/web-llm";

// Initialize the handler that manages the LLM engine
const handler = new WebWorkerMLCEngineHandler();

// Listen for messages from the main thread and forward to handler
self.onmessage = (msg) => {
  handler.onmessage(msg);
};
