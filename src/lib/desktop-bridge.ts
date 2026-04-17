import type { SmartToolDesktopBridge } from "@/types/desktop";

declare global {
  interface Window {
    smartToolDesktop?: SmartToolDesktopBridge;
  }
}

export function getDesktopBridge(): SmartToolDesktopBridge | null {
  if (typeof window === "undefined") return null;
  return window.smartToolDesktop ?? null;
}

export function isDesktopApp(): boolean {
  return Boolean(getDesktopBridge()?.isDesktopApp);
}
