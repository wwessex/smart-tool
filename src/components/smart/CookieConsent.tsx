import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Shield, Cookie, X, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface GDPRConsent {
  essential: boolean; // Always true - required for functionality
  consentDate: string;
  version: number;
}

const CONSENT_KEY = 'smartTool.gdprConsent';
const CONSENT_VERSION = 2;

export function getStoredConsent(): GDPRConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GDPRConsent;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeConsent() {
  const consent: GDPRConsent = {
    essential: true,
    consentDate: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
}

export function ManageConsentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const accept = () => {
    storeConsent();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Cookies & Local Storage
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm text-muted-foreground">
          <div className="rounded-lg border p-3">
            <p className="font-medium text-foreground">Essential</p>
            <p className="mt-1">
              Required to remember your settings, templates and history on this device.
              Stored locally in your browser and never sent to a server.
            </p>
          </div>

          <div className="rounded-lg border p-3">
            <p className="font-medium text-foreground">AI processing</p>
            <p className="mt-1">
              AI drafting/translation runs locally in your browser. Your text is not sent to any cloud AI service.
              Model files are downloaded from this website (self-hosted) when you enable the AI Module.
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={accept}>Accept</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const consent = getStoredConsent();
    setShowBanner(!consent);
  }, []);

  const accept = () => {
    storeConsent();
    setShowBanner(false);
    setShowSettings(false);
  };

  return (
    <>
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={cn(
              'fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-3xl rounded-xl border bg-card/95 backdrop-blur p-4 shadow-lg',
              'supports-[backdrop-filter]:bg-card/80'
            )}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1 flex-shrink-0 rounded-lg bg-muted/50 p-2">
                <Cookie className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Privacy-first: local storage only</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This tool stores your history, templates and settings in your browser (localStorage).
                  It does not use analytics or advertising cookies. AI features run locally in your browser.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={accept}>
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowSettings(true)}>
                    <Settings className="h-4 w-4 mr-1" />
                    Details
                  </Button>
                </div>
              </div>

              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setShowBanner(false)}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Cookies & Local Storage
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-lg border p-3">
              <p className="font-medium text-foreground">Essential</p>
              <p className="mt-1">
                Required to remember your settings, templates and history on this device.
                Stored locally in your browser and never sent to a server.
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="font-medium text-foreground">AI processing</p>
              <p className="mt-1">
                AI drafting/translation runs locally in your browser. Your text is not sent to any cloud AI service.
              Model files are downloaded from this website (self-hosted) when you enable the AI Module.
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Close
            </Button>
            <Button onClick={accept}>Accept</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}