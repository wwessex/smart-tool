import { describe, expect, it } from "vitest";
import { resolveDesktopInstallTarget } from "@/lib/desktop-installer";

describe("desktop-installer", () => {
  it("maps Apple Silicon macOS to the direct DMG download", () => {
    const target = resolveDesktopInstallTarget({
      platform: "macOS",
      architecture: "arm64",
    });

    expect(target).toMatchObject({
      platform: "macos",
      architecture: "arm64",
      canDirectDownload: true,
      label: "Download SMART Tool for macOS",
      url: "https://github.com/wwessex/smart-tool/releases/latest/download/SMART-Tool-macOS-arm64.dmg",
    });
  });

  it("treats Intel macOS as manual-setup-only", () => {
    const target = resolveDesktopInstallTarget({
      platform: "macOS",
      architecture: "x64",
    });

    expect(target).toMatchObject({
      platform: "unsupported",
      architecture: "x64",
      canDirectDownload: false,
      showAdvancedManualSetup: true,
    });
  });

  it("defaults Windows downloads to x64 when the browser does not expose architecture", () => {
    const target = resolveDesktopInstallTarget({
      platform: "Windows",
      architecture: "unknown",
    });

    expect(target).toMatchObject({
      platform: "windows",
      architecture: "x64",
      canDirectDownload: true,
      label: "Download SMART Tool for Windows",
      url: "https://github.com/wwessex/smart-tool/releases/latest/download/SMART-Tool-Windows-x64-Setup.exe",
    });
  });

  it("uses the arm64 Windows installer when the browser exposes that architecture", () => {
    const target = resolveDesktopInstallTarget({
      platform: "Windows",
      architecture: "arm64",
    });

    expect(target).toMatchObject({
      platform: "windows",
      architecture: "arm64",
      url: "https://github.com/wwessex/smart-tool/releases/latest/download/SMART-Tool-Windows-x64-Setup.exe",
    });
  });
});
