/**
 * Right-to-left language utilities.
 *
 * Provides standalone RTL detection for use outside the full registry,
 * e.g., in UI components that only need direction info.
 */

import type { LanguageCode, ScriptDirection } from "../types.js";

/** Language codes that use right-to-left scripts. */
const RTL_LANGUAGES = new Set<LanguageCode>([
  "ar", // Arabic
  "he", // Hebrew
  "fa", // Persian (Farsi)
  "ur", // Urdu
  "ps", // Pashto
  "yi", // Yiddish
  "sd", // Sindhi
  "ku", // Kurdish (Sorani)
]);

/**
 * Check if a language code uses a right-to-left script.
 */
export function isRTL(code: LanguageCode): boolean {
  return RTL_LANGUAGES.has(code);
}

/**
 * Get the script direction for a language code.
 * Defaults to "ltr" for unknown languages.
 */
export function getDirection(code: LanguageCode): ScriptDirection {
  return isRTL(code) ? "rtl" : "ltr";
}

/**
 * Get the HTML dir attribute value for a language.
 */
export function getDirAttribute(code: LanguageCode): "rtl" | "ltr" {
  return isRTL(code) ? "rtl" : "ltr";
}
