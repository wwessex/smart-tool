import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/hooks/usePWA';

export function PWAPrompt() {
  const { canInstall, isOnline, updateAvailable, promptInstall, applyUpdate } = usePWA();
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Show install banner after 30 seconds if can install and not dismissed
    if (canInstall && !dismissed) {
      const timer = setTimeout(() => {
        setShowInstallBanner(true);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [canInstall, dismissed]);

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      setShowInstallBanner(false);
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    setDismissed(true);
  };

  return (
    <>
      {/* Offline indicator */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2"
          >
            <WifiOff className="w-4 h-4" />
            You're offline. Some features may be limited.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Update available banner */}
      <AnimatePresence>
        {updateAvailable && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[100] bg-primary text-primary-foreground rounded-xl p-4 shadow-lg"
          >
            <div className="flex items-start gap-3">
              <RefreshCw className="w-5 h-5 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm">Update Available</p>
                <p className="text-xs opacity-90 mt-1">A new version is ready. Refresh to update.</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={applyUpdate}
                className="shrink-0"
              >
                Refresh
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Install prompt banner */}
      <AnimatePresence>
        {showInstallBanner && !updateAvailable && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[100] bg-card border border-border rounded-xl p-4 shadow-lg"
          >
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center text-white font-bold shrink-0">
                S
              </div>
              <div className="flex-1 pr-4">
                <p className="font-semibold text-sm">Install SMART Tool</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add to your home screen for quick access and offline use.
                </p>
                <Button
                  size="sm"
                  onClick={handleInstall}
                  className="mt-3 w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Install App
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
