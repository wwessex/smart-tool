import React, { useEffect } from "react";
import { SHELL_HTML } from "../legacy/shell";
import { TopNavController } from "./TopNavController";
import { bootLegacyOnce } from "../lib/bootLegacy";

/**
 * AppShell renders the legacy CineSafari DOM so existing DOM-driven logic can attach.
 * We boot the legacy app ONLY after React commits the DOM (useEffect) to avoid null element refs.
 */
export function AppShell() {
  useEffect(() => {
    // Boot legacy asynchronously after mount so all expected IDs exist.
    void bootLegacyOnce();
  }, []);

  return (
    <>
      <TopNavController />
      <div
        id="cinesafari-shell"
        dangerouslySetInnerHTML={{ __html: SHELL_HTML }}
      />
    </>
  );
}
