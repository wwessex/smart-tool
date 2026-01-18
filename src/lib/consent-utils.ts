/**
 * GDPR Consent utilities
 * Separated from CookieConsent component for better HMR support
 */

export interface GDPRConsent {
  essential: boolean; // Always true - required for functionality
  aiProcessing: boolean; // Consent for sending data to AI service
  consentDate: string;
  version: number;
}

export const CONSENT_KEY = 'smartTool.gdprConsent';
export const CONSENT_VERSION = 1;

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

export function notifyConsentChanged(): void {
  // `window` is always defined in the app runtime, but guard for tests/edge environments.
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(GDPR_CONSENT_CHANGE_EVENT));
}

/**
 * Safely save consent to localStorage, catching quota errors and blocked storage.
 * Returns true if the save succeeded, false otherwise.
 */
export function saveConsent(consent: GDPRConsent): boolean {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    notifyConsentChanged();
    return true;
  } catch (error) {
    // QuotaExceededError, SecurityError, or other storage errors
    console.warn('Failed to save consent to localStorage:', error);
    return false;
  }
}

/**
 * Safely clear consent from localStorage, catching any errors.
 * Returns true if the removal succeeded, false otherwise.
 */
export function clearConsent(): boolean {
  try {
    localStorage.removeItem(CONSENT_KEY);
    notifyConsentChanged();
    return true;
  } catch (error) {
    console.warn('Failed to clear consent from localStorage:', error);
    return false;
  }
}
