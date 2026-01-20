import { useSyncExternalStore } from "react";
import {
  GDPR_CONSENT_CHANGE_EVENT,
  GDPR_CONSENT_STORAGE_KEY,
  hasAIConsent,
} from "@/components/smart/CookieConsent";

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onConsentEvent = () => callback();
  const onStorage = (e: StorageEvent) => {
    if (e.key === GDPR_CONSENT_STORAGE_KEY) callback();
  };

  window.addEventListener(GDPR_CONSENT_CHANGE_EVENT, onConsentEvent);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(GDPR_CONSENT_CHANGE_EVENT, onConsentEvent);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAIConsent(): boolean {
  return useSyncExternalStore(subscribe, hasAIConsent, () => false);
}

