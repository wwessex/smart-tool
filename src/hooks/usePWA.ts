import { useState, useEffect, useCallback } from 'react';
import { isDesktopApp } from '@/lib/desktop-bridge';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type InstallKind = 'prompt' | 'safari-add-to-dock' | 'safari-add-to-home-screen' | null;

// Check if SW should be disabled (for debugging deployment issues)
const getSWDisabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return (
      new URLSearchParams(window.location.search).has('no-sw') ||
      localStorage.getItem('disable-sw') === 'true'
    );
  } catch {
    return false;
  }
};

function detectManualInstallKind(): Exclude<InstallKind, 'prompt' | null> | null {
  if (typeof navigator === 'undefined') return null;

  const ua = navigator.userAgent || '';
  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua);
  if (!isSafari) return null;

  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  if (isIOS) return 'safari-add-to-home-screen';

  const isMac = /Macintosh|Mac OS X/i.test(ua);
  return isMac ? 'safari-add-to-dock' : null;
}

export function usePWA() {
  const desktopApp = isDesktopApp();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(desktopApp);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const manualInstallKind = detectManualInstallKind();

  useEffect(() => {
    if (desktopApp) {
      setIsInstalled(true);
      return;
    }

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
  }, [desktopApp]);

  useEffect(() => {
    // Skip SW registration if disabled or not supported
    if (desktopApp || getSWDisabled() || !('serviceWorker' in navigator)) {
      return;
    }

    let updateInterval: number | null = null;
    let idleCallbackId: number | null = null;
    let timeoutId: number | null = null;
    let loadHandler: (() => void) | null = null;

    // CRITICAL: Only register SW after app is fully interactive
    // Use requestIdleCallback or setTimeout as fallback
    const registerSW = () => {
      const doRegister = async () => {
        try {
          // Simple relative path - works from any hosting location
          const reg = await navigator.serviceWorker.register('./sw.js', { 
            scope: './',
            updateViaCache: 'none' // Always check for SW updates
          });
          
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

          // Periodically check for updates (every hour)
          updateInterval = window.setInterval(() => {
            reg.update().catch(() => {});
          }, 60 * 60 * 1000);
        } catch (err) {
          // Silently fail - app works without SW
          console.warn('[PWA] SW registration failed:', err);
        }
      };

      // Use requestIdleCallback if available, otherwise setTimeout
      if ('requestIdleCallback' in window) {
        idleCallbackId = (window as unknown as { requestIdleCallback: (cb: () => void, opts: { timeout: number }) => number }).requestIdleCallback(doRegister, { timeout: 5000 });
      } else {
        timeoutId = setTimeout(doRegister, 3000) as unknown as number;
      }
    };

    // Wait for load event to ensure page is fully loaded
    if (document.readyState === 'complete') {
      registerSW();
    } else {
      loadHandler = () => registerSW();
      window.addEventListener('load', loadHandler, { once: true });
    }

    return () => {
      if (updateInterval) {
        window.clearInterval(updateInterval);
      }
      if (idleCallbackId && 'cancelIdleCallback' in window) {
        (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (loadHandler) {
        window.removeEventListener('load', loadHandler);
      }
    };
  }, [desktopApp]);

  const promptInstall = useCallback(async () => {
    if (desktopApp) return false;
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
  }, [desktopApp, installPrompt]);

  const applyUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }, [registration]);

  const clearCache = useCallback(async () => {
    if (registration?.active) {
      registration.active.postMessage({ type: 'CLEAR_CACHE' });
    }
    // Also clear via Cache API directly
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    window.location.reload();
  }, [registration]);

  const installKind: InstallKind = isInstalled
    ? null
    : installPrompt
      ? 'prompt'
      : manualInstallKind;

  const installTitle = installKind === 'safari-add-to-dock'
    ? 'Install SMART Tool in Safari'
    : installKind === 'safari-add-to-home-screen'
      ? 'Install SMART Tool on iPhone or iPad'
      : 'Install SMART Tool';

  const installDescription = installKind === 'safari-add-to-dock'
    ? 'Safari on macOS installs this app with File > Add to Dock or Share > Add to Dock.'
    : installKind === 'safari-add-to-home-screen'
      ? 'Safari on iPhone and iPad installs this app from the Share menu with Add to Home Screen.'
      : 'Add to your home screen for quick access and offline use.';

  return {
    canInstall: !!installPrompt && !isInstalled,
    hasInstallSurface: installKind !== null,
    installKind,
    installTitle,
    installDescription,
    isInstalled,
    isOnline,
    updateAvailable,
    promptInstall,
    applyUpdate,
    clearCache
  };
}
