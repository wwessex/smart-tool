import { useState, useEffect, Component, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { PWAPrompt } from "@/components/PWAPrompt";
import { CookieConsent } from "@/components/smart/CookieConsent";

// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import AdminPromptPack from "./pages/AdminPromptPack";

// BUG FIX #3: Error boundary for lazy load failures
class LazyErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-xl font-semibold text-foreground">Failed to load page</h2>
            <p className="text-sm text-muted-foreground">
              This might be due to a network issue or cached files.
            </p>
            <button
              onClick={() => {
                // Clear caches and reload
                if ('caches' in window) {
                  caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                  });
                }
                window.location.reload();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Clear cache & reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Performance: reduce unnecessary refetches
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1, // Reduce retries for faster failure feedback
    },
    mutations: {
      retry: 1,
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <PWAPrompt />
          <CookieConsent />
          <HashRouter>
            <LazyErrorBoundary>
              <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/admin-playbook" element={<AdminPromptPack />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
            </LazyErrorBoundary>
          </HashRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
