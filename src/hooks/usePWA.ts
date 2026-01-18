import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    // Listen for online/offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    // BUG FIX #4: Better service worker registration with error handling
    if ('serviceWorker' in navigator) {
      // Defer SW registration to not block initial render
      const registerSW = async () => {
        try {
          // Use relative path to support subfolder deployments (e.g., /smart-action-tool-webapp/)
          const swPath = new URL('./sw.js', import.meta.url).pathname;
          const reg = await navigator.serviceWorker.register(swPath, { scope: './' });
          setRegistration(reg);
          console.log('[PWA] Service worker registered at:', swPath);

          // Check for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                }
              });
            }
          });

          // Periodically check for updates
          setInterval(() => {
            reg.update().catch(() => {});
          }, 60 * 60 * 1000); // Check every hour
        } catch (err) {
          console.warn('[PWA] Service worker registration failed:', err);
          // Don't block app functionality if SW fails
        }
      };

      // Use requestIdleCallback if available, otherwise setTimeout
      if ('requestIdleCallback' in window) {
        (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(registerSW);
      } else {
        setTimeout(registerSW, 1000);
      }
    }
  }, []);

  const promptInstall = useCallback(async () => {
    if (!installPrompt) return false;

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setInstallPrompt(null);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[PWA] Install prompt error:', err);
      return false;
    }
  }, [installPrompt]);

  const applyUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }, [registration]);

  return {
    canInstall: !!installPrompt && !isInstalled,
    isInstalled,
    isOnline,
    updateAvailable,
    promptInstall,
    applyUpdate
  };
}
