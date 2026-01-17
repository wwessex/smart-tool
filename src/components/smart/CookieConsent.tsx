import { useState, useEffect, useCallback, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Shield, Cookie, Brain, X, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface GDPRConsent {
  essential: boolean; // Always true - required for functionality
  aiProcessing: boolean; // Consent for sending data to AI service
  consentDate: string;
  version: number;
}

const CONSENT_KEY = 'smartTool.gdprConsent';
const CONSENT_VERSION = 1;

// Used to notify the app (same-tab) that consent changed.
// Cross-tab updates are handled via the native `storage` event.
export const GDPR_CONSENT_CHANGE_EVENT = 'smartTool.gdprConsentChanged';
export const GDPR_CONSENT_STORAGE_KEY = CONSENT_KEY;

export function getStoredConsent(): GDPRConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasValidConsent(): boolean {
  const consent = getStoredConsent();
  return consent !== null;
}

export function hasAIConsent(): boolean {
  const consent = getStoredConsent();
  return consent?.aiProcessing === true;
}

function notifyConsentChanged(): void {
  // `window` is always defined in the app runtime, but guard for tests/edge environments.
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(GDPR_CONSENT_CHANGE_EVENT));
}

function saveConsent(consent: GDPRConsent): void {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  notifyConsentChanged();
}

export function clearConsent(): void {
  localStorage.removeItem(CONSENT_KEY);
  notifyConsentChanged();
}

interface CookieConsentProps {
  onConsentChange?: (consent: GDPRConsent) => void;
}

export function CookieConsent({ onConsentChange }: CookieConsentProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(true);

  useEffect(() => {
    // Check if consent has been given or version has changed
    const consent = getStoredConsent();
    if (!consent) {
      // No consent - show banner
      const timer = setTimeout(() => setShowBanner(true), 500);
      return () => clearTimeout(timer);
    }
    // Note: getStoredConsent already returns null if version mismatch,
    // so if consent exists here, it's valid and current version
  }, []);

  const handleAcceptAll = useCallback(() => {
    const consent: GDPRConsent = {
      essential: true,
      aiProcessing: true,
      consentDate: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    saveConsent(consent);
    setShowBanner(false);
    onConsentChange?.(consent);
  }, [onConsentChange]);

  const handleAcceptSelected = useCallback(() => {
    const consent: GDPRConsent = {
      essential: true,
      aiProcessing,
      consentDate: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    saveConsent(consent);
    setShowBanner(false);
    setShowDetails(false);
    onConsentChange?.(consent);
  }, [aiProcessing, onConsentChange]);

  const handleRejectNonEssential = useCallback(() => {
    const consent: GDPRConsent = {
      essential: true,
      aiProcessing: false,
      consentDate: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    saveConsent(consent);
    setShowBanner(false);
    onConsentChange?.(consent);
  }, [onConsentChange]);

  return (
    <>
      <AnimatePresence>
        {showBanner && !showDetails && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              "fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6",
              "bg-card/95 backdrop-blur-xl border-t border-border shadow-lg"
            )}
          >
            <div className="max-w-4xl mx-auto">
              <div className="flex items-start gap-4">
                <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Cookie className="w-6 h-6 text-primary" />
                </div>
                
                <div className="flex-1 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-foreground">Your Privacy Matters</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        We use local storage to save your actions and preferences. We also use AI services to help improve your SMART actions.
                        You can choose which features to enable.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleAcceptAll}
                      size="sm"
                      className="gap-2"
                    >
                      <Shield className="w-4 h-4" />
                      Accept All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRejectNonEssential}
                      className="gap-2"
                    >
                      <X className="w-4 h-4" />
                      Essential Only
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDetails(true)}
                      className="gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Customise
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    By clicking "Accept All", you agree to storing data locally and using AI features. 
                    <a href="#/privacy" className="underline hover:text-foreground ml-1">
                      View Privacy Policy
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detailed Preferences Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Privacy Preferences
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Essential Storage */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-muted/30">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Cookie className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">Essential Storage</span>
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Required</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Stores your actions, templates, and preferences locally on your device. 
                  No data is sent to external servers for this purpose.
                </p>
              </div>
              <Switch checked disabled className="opacity-70" />
            </div>

            {/* AI Processing */}
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg border">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">AI Assistant</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Enables AI-powered features to help improve your SMART actions. 
                  Your action text is sent to our AI service for processing. 
                  Data is not stored or used for training.
                </p>
              </div>
              <Switch 
                checked={aiProcessing} 
                onCheckedChange={setAiProcessing}
              />
            </div>

          </div>

          <div className="flex gap-2 mt-6">
            <Button onClick={handleAcceptSelected} className="flex-1">
              Save Preferences
            </Button>
            <Button variant="outline" onClick={() => setShowDetails(false)}>
              Cancel
            </Button>
          </div>
          
          <p className="text-xs text-center text-muted-foreground mt-4">
            You can change these preferences anytime in Settings → Privacy & Data
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Manage preferences dialog - can be opened from settings
interface ManageConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConsentChange?: (consent: GDPRConsent) => void;
}

export const ManageConsentDialog = forwardRef<HTMLDivElement, ManageConsentDialogProps>(
  function ManageConsentDialog({ open, onOpenChange, onConsentChange }, ref) {
  const [consent, setConsent] = useState<GDPRConsent | null>(null);
  const [aiProcessing, setAiProcessing] = useState(true);

  useEffect(() => {
    if (open) {
      const stored = getStoredConsent();
      if (stored) {
        setConsent(stored);
        setAiProcessing(stored.aiProcessing);
      }
    }
  }, [open]);

  const handleSave = () => {
    const newConsent: GDPRConsent = {
      essential: true,
      aiProcessing,
      consentDate: new Date().toISOString(),
      version: CONSENT_VERSION,
    };
    saveConsent(newConsent);
    onConsentChange?.(newConsent);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Manage Privacy Preferences
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {/* Essential Storage */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-muted/30">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Cookie className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Essential Storage</span>
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">Required</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Required for the app to function. Stores your data locally.
              </p>
            </div>
            <Switch checked disabled className="opacity-70" />
          </div>

          {/* AI Processing */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg border">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">AI Assistant</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Enables AI-powered suggestions. Your text is processed by our AI service.
              </p>
            </div>
            <Switch 
              checked={aiProcessing} 
              onCheckedChange={setAiProcessing}
            />
          </div>

          {consent && (
            <p className="text-xs text-muted-foreground text-center">
              Last updated: {new Date(consent.consentDate).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <Button onClick={handleSave} className="flex-1">
            Save Changes
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
