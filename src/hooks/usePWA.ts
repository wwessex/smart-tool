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
    // BUG FIX #4: Better service worker registration - FULLY NON-BLOCKING
    if ('serviceWorker' in navigator) {
      // CRITICAL: Defer SW registration significantly to ensure app loads first
      const registerSW = async () => {
        try {
          // Add timeout to prevent hanging
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('SW registration timeout')), 10000)
          );
          
          // Use simple relative path - works from any hosting location
          const regPromise = navigator.serviceWorker.register('./sw.js', { scope: './' });
          
          const reg = await Promise.race([regPromise, timeoutPromise]);
          setRegistration(reg);

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
          // Silently fail - app should work without SW
        }
      };

      // CRITICAL: Wait 3 seconds after page load before even attempting SW registration
      // This ensures the app is fully loaded and interactive first
      setTimeout(registerSW, 3000);
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
