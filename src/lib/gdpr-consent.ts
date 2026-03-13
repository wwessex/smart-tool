export interface GDPRConsent {
  essential: boolean; // Always true - required for functionality
  consentDate: string;
  version: number;
}

export const GDPR_CONSENT_STORAGE_KEY = 'smartTool.gdprConsent';
export const GDPR_CONSENT_CHANGE_EVENT = 'smartTool.gdprConsentChanged';
const CONSENT_VERSION = 3;

export function getStoredConsent(): GDPRConsent | null {
  try {
    const raw = localStorage.getItem(GDPR_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GDPRConsent;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeConsent() {
  const consent: GDPRConsent = {
    essential: true,
    consentDate: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  localStorage.setItem(GDPR_CONSENT_STORAGE_KEY, JSON.stringify(consent));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(GDPR_CONSENT_CHANGE_EVENT));
  }
}

export function hasAIConsent(): boolean {
  if (typeof window === 'undefined') return false;
  return !!getStoredConsent();
}
