import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getStoredConsent,
  storeConsent,
  hasAIConsent,
  GDPR_CONSENT_STORAGE_KEY,
  GDPR_CONSENT_CHANGE_EVENT,
} from "@/lib/gdpr-consent";

describe("gdpr-consent", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ==================== getStoredConsent ====================

  describe("getStoredConsent", () => {
    it("returns null when no consent is stored", () => {
      expect(getStoredConsent()).toBeNull();
    });

    it("returns null for invalid JSON", () => {
      localStorage.setItem(GDPR_CONSENT_STORAGE_KEY, "not-json");

      expect(getStoredConsent()).toBeNull();
    });

    it("returns null for non-object stored value", () => {
      localStorage.setItem(GDPR_CONSENT_STORAGE_KEY, '"just a string"');

      expect(getStoredConsent()).toBeNull();
    });

    it("returns null when version does not match current", () => {
      localStorage.setItem(
        GDPR_CONSENT_STORAGE_KEY,
        JSON.stringify({ essential: true, consentDate: "2026-01-01", version: 1 })
      );

      expect(getStoredConsent()).toBeNull();
    });

    it("returns consent when version matches (version 3)", () => {
      const consent = {
        essential: true,
        consentDate: "2026-01-01T00:00:00.000Z",
        version: 3,
      };
      localStorage.setItem(GDPR_CONSENT_STORAGE_KEY, JSON.stringify(consent));

      const result = getStoredConsent();
      expect(result).not.toBeNull();
      expect(result!.essential).toBe(true);
      expect(result!.version).toBe(3);
    });

    it("returns null for null stored value", () => {
      localStorage.setItem(GDPR_CONSENT_STORAGE_KEY, "null");

      expect(getStoredConsent()).toBeNull();
    });
  });

  // ==================== storeConsent ====================

  describe("storeConsent", () => {
    it("stores consent with version 3", () => {
      storeConsent();

      const stored = JSON.parse(
        localStorage.getItem(GDPR_CONSENT_STORAGE_KEY)!
      );
      expect(stored.version).toBe(3);
      expect(stored.essential).toBe(true);
      expect(stored.consentDate).toBeDefined();
    });

    it("stores a valid ISO date string", () => {
      storeConsent();

      const stored = JSON.parse(
        localStorage.getItem(GDPR_CONSENT_STORAGE_KEY)!
      );
      const date = new Date(stored.consentDate);
      expect(date.getTime()).not.toBeNaN();
    });

    it("dispatches change event", () => {
      const handler = vi.fn();
      window.addEventListener(GDPR_CONSENT_CHANGE_EVENT, handler);

      storeConsent();

      expect(handler).toHaveBeenCalledTimes(1);

      window.removeEventListener(GDPR_CONSENT_CHANGE_EVENT, handler);
    });
  });

  // ==================== hasAIConsent ====================

  describe("hasAIConsent", () => {
    it("returns false when no consent stored", () => {
      expect(hasAIConsent()).toBe(false);
    });

    it("returns true after storing consent", () => {
      storeConsent();

      expect(hasAIConsent()).toBe(true);
    });

    it("returns false when stored consent has wrong version", () => {
      localStorage.setItem(
        GDPR_CONSENT_STORAGE_KEY,
        JSON.stringify({ essential: true, consentDate: "2026-01-01", version: 1 })
      );

      expect(hasAIConsent()).toBe(false);
    });
  });

  // ==================== round-trip ====================

  describe("round-trip", () => {
    it("store then retrieve produces valid consent", () => {
      storeConsent();
      const consent = getStoredConsent();

      expect(consent).not.toBeNull();
      expect(consent!.essential).toBe(true);
      expect(consent!.version).toBe(3);
      expect(hasAIConsent()).toBe(true);
    });
  });
});
