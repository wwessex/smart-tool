/**
 * Boots the legacy DOM-driven app once.
 * Keeps StrictMode + HMR from double-starting the legacy code.
 */
export async function bootLegacyOnce(): Promise<void> {
  if (window.__CS_LEGACY_BOOTED__) return;
  window.__CS_LEGACY_BOOTED__ = true;

  try {
    // Vite will pick legacy-app (or .ts) via extensionless import.
    await import("../legacy/legacy-app");
  } catch (err) {
    // Last-resort visible error (same behaviour as before, just centralised)
    const details =
      err && typeof err === "object" && "stack" in err && (err as any).stack
        ? String((err as any).stack)
        : err && typeof err === "object" && "message" in err && (err as any).message
        ? String((err as any).message)
        : String(err);

    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.style.padding = "16px";
    pre.style.margin = "16px";
    pre.style.borderRadius = "12px";
    pre.style.border = "1px solid rgba(148,163,184,.25)";
    pre.style.background = "rgba(17,24,39,.65)";
    pre.style.color = "#f9fafb";
    pre.textContent = `CineSafari failed to start.\n\n${details}`;
    document.body.innerHTML = "";
    document.body.appendChild(pre);
  }
}
