import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePWA } from "@/hooks/usePWA";

vi.mock("@/lib/desktop-bridge", () => ({
  isDesktopApp: vi.fn(() => false),
}));

const originalUserAgent = navigator.userAgent;

function setUserAgent(value: string) {
  Object.defineProperty(window.navigator, "userAgent", {
    value,
    configurable: true,
  });
}

describe("usePWA", () => {
  beforeEach(() => {
    setUserAgent(originalUserAgent);
  });

  afterEach(() => {
    setUserAgent(originalUserAgent);
    vi.restoreAllMocks();
  });

  it("surfaces Add to Dock guidance for Safari on macOS when no install prompt is available", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    );

    const { result } = renderHook(() => usePWA());

    expect(result.current.canInstall).toBe(false);
    expect(result.current.hasInstallSurface).toBe(true);
    expect(result.current.installKind).toBe("safari-add-to-dock");
    expect(result.current.installTitle).toBe("Install SMART Tool in Safari");
    expect(result.current.installDescription).toMatch(/File > Add to Dock/i);
  });

  it("uses the browser install prompt when beforeinstallprompt fires", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    );

    const { result } = renderHook(() => usePWA());
    const beforeInstallPrompt = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
    };

    beforeInstallPrompt.prompt = vi.fn().mockResolvedValue(undefined);
    beforeInstallPrompt.userChoice = Promise.resolve({ outcome: "dismissed" });

    act(() => {
      window.dispatchEvent(beforeInstallPrompt);
    });

    expect(result.current.canInstall).toBe(true);
    expect(result.current.hasInstallSurface).toBe(true);
    expect(result.current.installKind).toBe("prompt");
    expect(result.current.installTitle).toBe("Install SMART Tool");
  });
});
