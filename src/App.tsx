import { lazy, Suspense, useState, useEffect, Component, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { PWAPrompt } from "@/components/PWAPrompt";
import { CookieConsent } from "@/components/smart/CookieConsent";

// Lazy load pages for better initial load time
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
// Hidden admin route (not linked anywhere)
const AdminPromptPack = lazy(() => import("./pages/AdminPromptPack"));

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

// BUG FIX #2: Loading fallback with progressive timeout stages
const PageLoader = () => {
  const [stage, setStage] = useState<'loading' | 'slow' | 'stuck'>('loading');

  useEffect(() => {
    // First stage: show "slow" message after 5 seconds
    const slowTimer = setTimeout(() => setStage('slow'), 5000);
    // Second stage: show "stuck" message after 10 seconds
    const stuckTimer = setTimeout(() => setStage('stuck'), 10000);
    return () => {
      clearTimeout(slowTimer);
      clearTimeout(stuckTimer);
    };
  }, []);

  const handleClearCacheAndReload = async () => {
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }
      
      // Force hard reload with cache bust
      const baseUrl = window.location.href.split('#')[0].split('?')[0];
      window.location.href = `${baseUrl}?cache_bust=${Date.now()}`;
    } catch (error) {
      // Fallback to simple reload
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-center p-4 max-w-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading SMART Action Tool...</p>
        
        {stage === 'slow' && (
          <p className="text-xs text-muted-foreground animate-pulse">
            Still loading, please wait...
          </p>
        )}
        
        {stage === 'stuck' && (
          <div className="mt-4 space-y-3 p-4 rounded-lg border border-border bg-card">
            <p className="text-sm font-medium text-foreground">
              Loading is taking longer than expected
            </p>
            <p className="text-xs text-muted-foreground">
              This might be due to cached files or a slow connection.
            </p>
            <button
              onClick={handleClearCacheAndReload}
              className="w-full px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Clear cache & reload
            </button>
            <p className="text-xs text-muted-foreground">
              If the problem persists, try opening in a private/incognito window.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

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
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/admin-playbook" element={<AdminPromptPack />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </LazyErrorBoundary>
          </HashRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
