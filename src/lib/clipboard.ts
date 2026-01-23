/**
 * Clipboard helper designed for Safari/iOS reliability.
 *
 * iOS Safari can reject async clipboard calls unless they are tightly
 * coupled to a user gesture. We try the modern API first, then fall back
 * to a synchronous execCommand-based copy.
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // Modern path (requires secure context + user gesture in many browsers)
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to legacy path
  }

  // Legacy fallback (best effort)
  try {
    if (typeof document === 'undefined') return false;

    const ta = document.createElement('textarea');
    ta.value = text;
    // Keep it off-screen but selectable
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';

    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);

    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
