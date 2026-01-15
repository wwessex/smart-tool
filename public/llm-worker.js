// Web Worker for WebLLM - Isolates heavy LLM computation from main UI thread
// Using jsdelivr for faster, more reliable CDN delivery

let handler = null;
let initError = null;

// Async initialization with error handling
async function initHandler() {
  try {
    // Dynamic import for better error handling
    const module = await import("https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.80/+esm");
    handler = new module.WebWorkerMLCEngineHandler();
    // Notify main thread that worker is ready
    self.postMessage({ type: "worker-ready" });
  } catch (err) {
    initError = err;
    console.error("Worker initialization failed:", err);
    // Notify main thread of failure
    self.postMessage({ 
      type: "worker-error", 
      error: err.message || "Failed to load WebLLM module" 
    });
  }
}

// Start initialization immediately
initHandler();

// Listen for messages from the main thread
self.onmessage = (msg) => {
  if (initError) {
    // If initialization failed, notify the caller
    self.postMessage({ 
      type: "error", 
      error: initError.message || "Worker failed to initialize" 
    });
    return;
  }
  
  if (!handler) {
    // Still initializing, queue or reject
    self.postMessage({ 
      type: "error", 
      error: "Worker still initializing, please wait..." 
    });
    return;
  }
  
  // Forward to handler
  handler.onmessage(msg);
};
