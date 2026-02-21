import { createRoot } from "react-dom/client";
import { Component, ReactNode } from "react";
import App from "./App.tsx";
import "./index.css";
import { installGlobalErrorHandlers } from "./lib/error-handling";

// Install global unhandled-rejection listener early so no async error is lost.
installGlobalErrorHandlers();
// NOTE: The proprietary AI engines (Amor inteligente, Lengua Materna, Puente Engine)
// are imported lazily (dynamic import) inside useBrowserNativeLLM and useTranslation
// to avoid crashing iOS Safari at startup.

// CRITICAL FIX: Hide loading screen function - ALWAYS runs in finally block
const hideLoadingScreen = () => {
  // Clear any fallback timeout
  if (window.__loaderTimeout) {
    clearTimeout(window.__loaderTimeout);
  }
  const loader = document.getElementById('initial-loader');
  if (loader) {
    loader.style.display = 'none';
    loader.remove();
  }
};

// Extend window type for loader timeout
declare global {
  interface Window {
    __loaderTimeout?: ReturnType<typeof setTimeout>;
  }
}

// Error boundary to catch render errors
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidMount() {
    // Hide loader when error boundary mounts (success case handled by children)
    hideLoadingScreen();
  }

  render() {
    if (this.state.hasError) {
      // ALWAYS hide loader on error too
      hideLoadingScreen();
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
          <h1>Something went wrong</h1>
          <pre style={{ color: 'red', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.message}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{ 
              marginTop: '1rem', 
              padding: '0.5rem 1rem', 
              cursor: 'pointer',
              background: '#e89309',
              color: 'white',
              border: 'none',
              borderRadius: '0.25rem'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// CRITICAL: Mount the app with proper error handling
const initApp = () => {
  try {
    const root = document.getElementById("root");
    if (!root) {
      throw new Error("Root element not found");
    }
    
    createRoot(root).render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
    
    // Signal to service worker that app has loaded
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'APP_LOADED' });
    }
  } catch (error) {
    console.error("Failed to initialize app:", error);
    hideLoadingScreen();
    
    // Show error message in root (DOM API to avoid innerHTML XSS sink)
    const root = document.getElementById("root");
    if (root) {
      const container = document.createElement("div");
      container.style.cssText = "padding: 2rem; font-family: system-ui; text-align: center;";

      const heading = document.createElement("h1");
      heading.textContent = "Failed to load application";

      const msg = document.createElement("p");
      msg.style.color = "#666";
      msg.textContent = "Please try refreshing the page or clearing your cache.";

      const btn = document.createElement("button");
      btn.textContent = "Reload";
      btn.style.cssText = "margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; background: #e89309; color: white; border: none; border-radius: 0.25rem;";
      btn.addEventListener("click", () => location.reload());

      container.append(heading, msg, btn);
      root.textContent = "";
      root.appendChild(container);
    }
  }
};

// Start the app - use DOMContentLoaded to ensure DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // DOM already loaded
  initApp();
}
