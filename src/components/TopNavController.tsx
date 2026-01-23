import { useEffect, useState } from "react";

/**
 * Observes the legacy nav without taking over routing.
 * Phase 3: event-driven updates (less polling on mobile).
 */
export function TopNavController() {
  const [activeTab, setActiveTab] = useState<string>("for-you");

  useEffect(() => {
    const updateFromDom = () => {
      const btn = document.querySelector<HTMLButtonElement>(".tab-btn.active");
      const tab = btn?.dataset?.tab || "for-you";
      setActiveTab(tab);
      window.__CS_ACTIVE_TAB__ = tab;
    };

    const onClick = (e: Event) => {
      const t = (e.target as HTMLElement | null)?.closest?.(
        ".tab-btn, .bottom-nav-btn, .menu-item"
      ) as HTMLButtonElement | null;
      if (!t) return;
      const tab = t.dataset?.tab;
      if (tab) {
        setActiveTab(tab);
        window.__CS_ACTIVE_TAB__ = tab;
      }
    };

    const onLegacyTab = (e: Event) => {
      // CustomEvent<{ tab: string }>
      const ce = e as CustomEvent<{ tab?: string }>;
      const tab = ce?.detail?.tab;
      if (tab) {
        setActiveTab(tab);
        window.__CS_ACTIVE_TAB__ = tab;
      }
    };

    document.addEventListener("click", onClick, { passive: true });
    window.addEventListener("cinesafari:tab", onLegacyTab as EventListener);

    // One initial sync.
    updateFromDom();

    // Low-frequency safety sync (covers programmatic tab switches not triggered by click/event)
    const id = window.setInterval(() => {
      if (!document.hidden) updateFromDom();
    }, 3000);

    return () => {
      document.removeEventListener("click", onClick as any);
      window.removeEventListener("cinesafari:tab", onLegacyTab as EventListener);
      window.clearInterval(id);
    };
  }, []);

  // Intentionally unused right now; kept for future React routing refactor.
  void activeTab;

  return null;
}
