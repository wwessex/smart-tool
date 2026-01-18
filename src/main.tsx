import { createRoot } from "react-dom/client";
import { Component, ReactNode } from "react";
import App from "./App.tsx";
import "./index.css";

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

  render() {
    if (this.state.hasError) {
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

// Hide loading screen once React mounts
const hideLoadingScreen = () => {
  const loadingContainer = document.querySelector('.loading-container');
  if (loadingContainer) {
    loadingContainer.remove();
  }
};

// Mount the app
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  // Hide loading screen after React mounts
  hideLoadingScreen();
}

// Signal to service worker that app has loaded successfully
// Only do this AFTER React has successfully mounted
requestAnimationFrame(() => {
  if ('serviceWorker' in navigator) {
    // Signal existing controller
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'APP_LOADED' });
    }
    // Also signal when SW becomes active
    navigator.serviceWorker.ready.then(reg => {
      reg.active?.postMessage({ type: 'APP_LOADED' });
    }).catch(() => {
      // Silently ignore - SW might not be available
    });
  }
});
