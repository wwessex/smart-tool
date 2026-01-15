// Web Worker for WebLLM - Isolates heavy LLM computation from main UI thread
// Using jsdelivr for faster, more reliable CDN delivery
import { WebWorkerMLCEngineHandler } from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.80/+esm";

// Initialize the handler that manages the LLM engine
const handler = new WebWorkerMLCEngineHandler();

// Listen for messages from the main thread and forward to handler
self.onmessage = (msg) => {
  handler.onmessage(msg);
};