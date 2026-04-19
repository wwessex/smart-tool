export const SMART_TOOL_RELEASES_PAGE_URL = "https://github.com/wwessex/smart-tool/releases/latest";
export const SMART_TOOL_ADVANCED_SETUP_URL = "https://github.com/wwessex/smart-tool#advanced-manual-desktop-setup";

export type DesktopInstallPlatform = "macos" | "windows" | "unsupported";
export type DesktopInstallArchitecture = "arm64" | "x64" | "unknown";

export interface DesktopInstallBrowserInfo {
  isMac?: boolean;
  isWindows?: boolean;
  isLinux?: boolean;
}

export interface DesktopInstallSnapshot {
  userAgent?: string | null;
  platform?: string | null;
  architecture?: string | null;
  bitness?: string | null;
  isMobile?: boolean;
  browserInfo?: DesktopInstallBrowserInfo | null;
}

export interface DesktopInstallTarget {
  platform: DesktopInstallPlatform;
  architecture: DesktopInstallArchitecture;
  platformLabel: string;
  label: string;
  url: string | null;
  canDirectDownload: boolean;
  showAdvancedManualSetup: boolean;
  manualGuideUrl: string;
  description: string;
}

const WINDOWS_RELEASE_URL = SMART_TOOL_RELEASES_PAGE_URL;
const MACOS_RELEASE_URL = SMART_TOOL_RELEASES_PAGE_URL;

function normalizePlatform(snapshot: DesktopInstallSnapshot): DesktopInstallPlatform {
  const platform = `${snapshot.platform || ""}`.toLowerCase();
  const userAgent = `${snapshot.userAgent || ""}`.toLowerCase();

  if (platform.includes("mac") || platform === "darwin") return "macos";
  if (platform.includes("win")) return "windows";

  if (userAgent.includes("mac os x") || userAgent.includes("macintosh")) return "macos";
  if (userAgent.includes("windows")) return "windows";

  if (snapshot.browserInfo?.isMac) return "macos";
  if (snapshot.browserInfo?.isWindows) return "windows";

  return "unsupported";
}

function normalizeArchitecture(snapshot: DesktopInstallSnapshot): DesktopInstallArchitecture {
  const architecture = `${snapshot.architecture || ""}`.toLowerCase();
  const bitness = `${snapshot.bitness || ""}`.toLowerCase();
  const userAgent = `${snapshot.userAgent || ""}`.toLowerCase();

  if (architecture.includes("arm") || architecture.includes("aarch64")) return "arm64";
  if (architecture.includes("x64") || architecture.includes("amd64")) return "x64";
  if (architecture.includes("x86") && bitness === "64") return "x64";

  if (userAgent.includes("arm64") || userAgent.includes("aarch64")) return "arm64";
  if (userAgent.includes("x86_64") || userAgent.includes("win64") || userAgent.includes("wow64")) return "x64";

  return "unknown";
}

export function resolveDesktopInstallTarget(snapshot: DesktopInstallSnapshot = {}): DesktopInstallTarget {
  if (snapshot.isMobile) {
    return {
      platform: "unsupported",
      architecture: "unknown",
      platformLabel: "this device",
      label: "Advanced manual setup",
      url: null,
      canDirectDownload: false,
      showAdvancedManualSetup: true,
      manualGuideUrl: SMART_TOOL_ADVANCED_SETUP_URL,
      description: "One-click Desktop Accelerator installs are only available on desktop macOS and Windows.",
    };
  }

  const platform = normalizePlatform(snapshot);
  const architecture = normalizeArchitecture(snapshot);

  if (platform === "windows") {
    const resolvedArchitecture = architecture === "arm64" ? "arm64" : "x64";
    return {
      platform: "windows",
      architecture: resolvedArchitecture,
      platformLabel: "Windows",
      label: "Open SMART Tool Windows release",
      url: WINDOWS_RELEASE_URL,
      canDirectDownload: true,
      showAdvancedManualSetup: false,
      manualGuideUrl: SMART_TOOL_ADVANCED_SETUP_URL,
      description: resolvedArchitecture === "arm64"
        ? "Open the latest SMART Tool GitHub release and download the Windows arm64 installer for the built-in Desktop Accelerator. The first launch downloads the local model automatically."
        : "Open the latest SMART Tool GitHub release and download the Windows x64 installer for the built-in Desktop Accelerator. The first launch downloads the local model automatically.",
    };
  }

  if (platform === "macos") {
    if (architecture === "x64") {
      return {
        platform: "unsupported",
        architecture: "x64",
        platformLabel: "this Mac",
        label: "Advanced manual setup",
        url: null,
        canDirectDownload: false,
        showAdvancedManualSetup: true,
        manualGuideUrl: SMART_TOOL_ADVANCED_SETUP_URL,
        description: "One-click Desktop Accelerator installs currently target Apple Silicon Macs. Intel Macs should stay on Browser AI or use manual setup.",
      };
    }

    return {
      platform: "macos",
      architecture,
      platformLabel: "macOS",
      label: "Open SMART Tool macOS release",
      url: MACOS_RELEASE_URL,
      canDirectDownload: true,
      showAdvancedManualSetup: false,
      manualGuideUrl: SMART_TOOL_ADVANCED_SETUP_URL,
      description: architecture === "arm64"
        ? "Open the latest SMART Tool GitHub release and download the Apple Silicon DMG for the built-in Desktop Accelerator. The first launch downloads the local model automatically."
        : "Open the latest SMART Tool GitHub release and download the Apple Silicon DMG for the built-in Desktop Accelerator. Apple Silicon is required for the one-click install.",
    };
  }

  return {
    platform: "unsupported",
    architecture,
    platformLabel: "this device",
    label: "Advanced manual setup",
    url: null,
    canDirectDownload: false,
    showAdvancedManualSetup: true,
    manualGuideUrl: SMART_TOOL_ADVANCED_SETUP_URL,
    description: "This device does not have a one-click Desktop Accelerator installer yet. Browser AI stays available, and manual setup is still documented for advanced use.",
  };
}
