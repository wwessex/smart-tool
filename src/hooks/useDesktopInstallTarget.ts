import { startTransition, useEffect, useState } from "react";
import {
  resolveDesktopInstallTarget,
  type DesktopInstallBrowserInfo,
  type DesktopInstallTarget,
} from "@/lib/desktop-installer";

interface NavigatorUADataLike {
  architecture?: string;
  bitness?: string;
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{
    architecture?: string;
    bitness?: string;
  }>;
}

function readDesktopInstallSnapshot(browserInfo?: DesktopInstallBrowserInfo | null) {
  if (typeof navigator === "undefined") {
    return { browserInfo };
  }

  const userAgentData = (navigator as Navigator & { userAgentData?: NavigatorUADataLike }).userAgentData;
  return {
    userAgent: navigator.userAgent,
    platform: userAgentData?.platform ?? navigator.platform,
    architecture: userAgentData?.architecture ?? null,
    bitness: userAgentData?.bitness ?? null,
    isMobile: Boolean(userAgentData?.mobile) || /android|iphone|ipad|ipod/i.test(navigator.userAgent),
    browserInfo,
  };
}

export function useDesktopInstallTarget(browserInfo?: DesktopInstallBrowserInfo | null): DesktopInstallTarget {
  const isLinux = browserInfo?.isLinux;
  const isMac = browserInfo?.isMac;
  const isWindows = browserInfo?.isWindows;
  const [target, setTarget] = useState(() => resolveDesktopInstallTarget(readDesktopInstallSnapshot({
    isLinux,
    isMac,
    isWindows,
  })));

  useEffect(() => {
    let cancelled = false;
    const snapshot = readDesktopInstallSnapshot({
      isLinux,
      isMac,
      isWindows,
    });
    setTarget(resolveDesktopInstallTarget(snapshot));

    const userAgentData = (typeof navigator !== "undefined"
      ? (navigator as Navigator & { userAgentData?: NavigatorUADataLike }).userAgentData
      : undefined);

    if (!userAgentData?.getHighEntropyValues) {
      return () => {
        cancelled = true;
      };
    }

    void userAgentData.getHighEntropyValues(["architecture", "bitness"])
      .then((values) => {
        if (cancelled) return;
        startTransition(() => {
          setTarget(resolveDesktopInstallTarget({
            ...snapshot,
            architecture: values.architecture ?? snapshot.architecture,
            bitness: values.bitness ?? snapshot.bitness,
          }));
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [isLinux, isMac, isWindows]);

  return target;
}
