/**
 * Security utilities for URL validation and string sanitization.
 *
 * Prevents SSRF, log injection, and other input-handling vulnerabilities
 * in the browser-native LLM runtime.
 */

/**
 * Validate and sanitize a URL before fetching.
 * Prevents SSRF by ensuring URLs use only allowed protocols.
 * Relative URLs are passed through since they resolve to the page origin.
 */
export function validateUrl(url: string): string {
  // Relative URLs are safe (resolve to the page origin)
  if (url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) {
    return url;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL provided");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Disallowed URL protocol: ${parsed.protocol}`);
  }

  return parsed.href;
}

/**
 * Sanitize a string for safe inclusion in log/error messages.
 * Strips control characters and limits length to prevent log injection.
 */
export function sanitizeForLog(input: string, maxLength = 200): string {
  return input.replace(/[\x00-\x1F\x7F]/g, "").slice(0, maxLength);
}

/**
 * Split text on whitespace. Manual O(n) scan to avoid ReDoS from /\s+/.
 */
export function splitOnWhitespace(text: string): string[] {
  const result: string[] = [];
  let current = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      if (current.length > 0) {
        result.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current.length > 0) result.push(current);
  return result;
}
