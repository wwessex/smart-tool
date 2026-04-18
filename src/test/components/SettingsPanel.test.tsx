import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPanel } from "@/components/smart/SettingsPanel";
import { getDesktopBridge } from "@/lib/desktop-bridge";

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock("@/lib/desktop-bridge", () => ({
  getDesktopBridge: vi.fn(() => null),
}));

describe("SettingsPanel", () => {
  it("explains that the browser build has no Desktop Accelerator installer and offers Browser AI fallback", async () => {
    const user = userEvent.setup();
    const updateAIDraftRuntime = vi.fn();
    const updatePreferredLLMModel = vi.fn();
    const loadModel = vi.fn().mockResolvedValue(true);

    const storage = {
      barriers: ["CV"],
      timescales: ["2 weeks"],
      resetBarriers: vi.fn(),
      updateBarriers: vi.fn(),
      resetTimescales: vi.fn(),
      updateTimescales: vi.fn(),
      minScoreEnabled: false,
      updateMinScoreEnabled: vi.fn(),
      minScoreThreshold: 4,
      updateMinScoreThreshold: vi.fn(),
      aiDraftMode: "ai",
      updateAIDraftMode: vi.fn(),
      aiDraftRuntime: "auto",
      updateAIDraftRuntime,
      preferredLLMModel: "amor-inteligente-built-in",
      updatePreferredLLMModel,
      allowMobileLLM: false,
      updateAllowMobileLLM: vi.fn(),
      safariWebGPUEnabled: false,
      updateSafariWebGPUEnabled: vi.fn(),
      keepSafariModelLoaded: false,
      updateKeepSafariModelLoaded: vi.fn(),
      history: [],
      retentionEnabled: false,
      updateRetentionEnabled: vi.fn(),
      retentionDays: 30,
      updateRetentionDays: vi.fn(),
      exportAllData: vi.fn(),
      deleteAllData: vi.fn(),
    } as never;

    const localSync = {
      isSupported: false,
      isConnected: false,
      folderName: null,
      lastSync: null,
      selectFolder: vi.fn(),
      disconnect: vi.fn(),
      syncEnabled: false,
      setSyncEnabled: vi.fn(),
      isConnecting: false,
      error: null,
      downloadAllAsZip: vi.fn(),
    } as never;

    const llm = {
      isReady: false,
      isLoading: false,
      isGenerating: false,
      error: null,
      classifiedError: null,
      loadingStatus: "",
      loadingProgress: 0,
      selectedModel: null,
      activeRuntime: "browser",
      supportedModels: [
        {
          id: "amor-inteligente-built-in",
          name: "Amor inteligente (Built-in)",
          size: "Included",
          description: "Built-in offline AI planner",
        },
      ],
      canUseLocalAI: true,
      isMobile: false,
      supportsDesktopHelper: true,
      browserInfo: { isSafari: false },
      deviceInfo: { isIOS: false },
      helperStatus: "not-installed",
      helperMessage: "Desktop accelerator not installed or not running.",
      helperBackend: null,
      loadModel,
      unload: vi.fn(),
      clearError: vi.fn(),
      refreshHelperHealth: vi.fn(),
    } as never;

    render(
      <SettingsPanel
        open
        onOpenChange={vi.fn()}
        storage={storage}
        localSync={localSync}
        llm={llm}
        promptPack={null}
        promptPackSource={null}
        wizardMode={false}
        setWizardMode={vi.fn()}
        privacySettingsOpen={false}
        setPrivacySettingsOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("No in-browser installer is available for Desktop Accelerator.")).toBeInTheDocument();
    expect(screen.getByText(/this browser build can detect a running desktop accelerator/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Switch to Browser AI" }));

    expect(updateAIDraftRuntime).toHaveBeenCalledWith("browser");
    await waitFor(() => {
      expect(loadModel).toHaveBeenCalledWith("amor-inteligente-built-in");
    });
    expect(updatePreferredLLMModel).toHaveBeenCalledWith("amor-inteligente-built-in");
  });

  it("points macOS browsers to the native app and helper guides", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const storage = {
      barriers: ["CV"],
      timescales: ["2 weeks"],
      resetBarriers: vi.fn(),
      updateBarriers: vi.fn(),
      resetTimescales: vi.fn(),
      updateTimescales: vi.fn(),
      minScoreEnabled: false,
      updateMinScoreEnabled: vi.fn(),
      minScoreThreshold: 4,
      updateMinScoreThreshold: vi.fn(),
      aiDraftMode: "ai",
      updateAIDraftMode: vi.fn(),
      aiDraftRuntime: "auto",
      updateAIDraftRuntime: vi.fn(),
      preferredLLMModel: "amor-inteligente-built-in",
      updatePreferredLLMModel: vi.fn(),
      allowMobileLLM: false,
      updateAllowMobileLLM: vi.fn(),
      safariWebGPUEnabled: false,
      updateSafariWebGPUEnabled: vi.fn(),
      keepSafariModelLoaded: false,
      updateKeepSafariModelLoaded: vi.fn(),
      history: [],
      retentionEnabled: false,
      updateRetentionEnabled: vi.fn(),
      retentionDays: 30,
      updateRetentionDays: vi.fn(),
      exportAllData: vi.fn(),
      deleteAllData: vi.fn(),
    } as never;

    const localSync = {
      isSupported: false,
      isConnected: false,
      folderName: null,
      lastSync: null,
      selectFolder: vi.fn(),
      disconnect: vi.fn(),
      syncEnabled: false,
      setSyncEnabled: vi.fn(),
      isConnecting: false,
      error: null,
      downloadAllAsZip: vi.fn(),
    } as never;

    const llm = {
      isReady: false,
      isLoading: false,
      isGenerating: false,
      error: null,
      classifiedError: null,
      loadingStatus: "",
      loadingProgress: 0,
      selectedModel: null,
      activeRuntime: "browser",
      supportedModels: [
        {
          id: "amor-inteligente-built-in",
          name: "Amor inteligente (Built-in)",
          size: "Included",
          description: "Built-in offline AI planner",
        },
      ],
      canUseLocalAI: true,
      isMobile: false,
      supportsDesktopHelper: true,
      browserInfo: { isSafari: true, isMac: true },
      deviceInfo: { isIOS: false },
      helperStatus: "not-installed",
      helperMessage: "Desktop accelerator not installed or not running.",
      helperBackend: null,
      loadModel: vi.fn().mockResolvedValue(true),
      unload: vi.fn(),
      clearError: vi.fn(),
      refreshHelperHealth: vi.fn(),
    } as never;

    render(
      <SettingsPanel
        open
        onOpenChange={vi.fn()}
        storage={storage}
        localSync={localSync}
        llm={llm}
        promptPack={null}
        promptPackSource={null}
        wizardMode={false}
        setWizardMode={vi.fn()}
        privacySettingsOpen={false}
        setPrivacySettingsOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("Desktop Accelerator needs the macOS app or manual helper.")).toBeInTheDocument();
    expect(screen.getByText(/native macos shell from the repo guide/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open macOS setup guide" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open helper guide" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open macOS setup guide" }));
    expect(openSpy).toHaveBeenCalledWith(
      "https://github.com/wwessex/smart-tool#native-macos-shell",
      "_blank",
      "noopener,noreferrer",
    );

    await user.click(screen.getByRole("button", { name: "Open helper guide" }));
    expect(openSpy).toHaveBeenCalledWith(
      "https://github.com/wwessex/smart-tool#desktop-accelerator-helper",
      "_blank",
      "noopener,noreferrer",
    );

    openSpy.mockRestore();
  });

  it("explains that desktop shells embed Desktop Accelerator and keep Browser AI as fallback", () => {
    vi.mocked(getDesktopBridge).mockReturnValue({
      isDesktopApp: true,
      platform: "darwin",
      version: "1.0.0",
      desktopHelper: {
        health: vi.fn(),
        load: vi.fn(),
        generate: vi.fn(),
        unload: vi.fn(),
      },
      syncFolder: {
        getState: vi.fn(),
        selectFolder: vi.fn(),
        clearFolder: vi.fn(),
        writeTextFile: vi.fn(),
      },
    });

    const storage = {
      barriers: ["CV"],
      timescales: ["2 weeks"],
      resetBarriers: vi.fn(),
      updateBarriers: vi.fn(),
      resetTimescales: vi.fn(),
      updateTimescales: vi.fn(),
      minScoreEnabled: false,
      updateMinScoreEnabled: vi.fn(),
      minScoreThreshold: 4,
      updateMinScoreThreshold: vi.fn(),
      aiDraftMode: "ai",
      updateAIDraftMode: vi.fn(),
      aiDraftRuntime: "auto",
      updateAIDraftRuntime: vi.fn(),
      preferredLLMModel: "amor-inteligente-built-in",
      updatePreferredLLMModel: vi.fn(),
      allowMobileLLM: false,
      updateAllowMobileLLM: vi.fn(),
      safariWebGPUEnabled: false,
      updateSafariWebGPUEnabled: vi.fn(),
      keepSafariModelLoaded: false,
      updateKeepSafariModelLoaded: vi.fn(),
      history: [],
      retentionEnabled: false,
      updateRetentionEnabled: vi.fn(),
      retentionDays: 30,
      updateRetentionDays: vi.fn(),
      exportAllData: vi.fn(),
      deleteAllData: vi.fn(),
    } as never;

    const localSync = {
      isSupported: false,
      isConnected: false,
      folderName: null,
      lastSync: null,
      selectFolder: vi.fn(),
      disconnect: vi.fn(),
      syncEnabled: false,
      setSyncEnabled: vi.fn(),
      isConnecting: false,
      error: null,
      downloadAllAsZip: vi.fn(),
    } as never;

    const llm = {
      isReady: false,
      isLoading: false,
      isGenerating: false,
      error: null,
      classifiedError: null,
      loadingStatus: "",
      loadingProgress: 0,
      selectedModel: null,
      activeRuntime: null,
      supportedModels: [
        {
          id: "amor-inteligente-built-in",
          name: "Amor inteligente (Built-in)",
          size: "Included",
          description: "Built-in offline AI planner",
        },
      ],
      canUseLocalAI: true,
      isMobile: false,
      supportsDesktopHelper: true,
      browserInfo: { isSafari: false },
      deviceInfo: { isIOS: false },
      helperStatus: "not-installed",
      helperMessage: "Desktop Accelerator could not find a local llama-server binary.",
      helperBackend: null,
      loadModel: vi.fn().mockResolvedValue(true),
      unload: vi.fn(),
      clearError: vi.fn(),
      refreshHelperHealth: vi.fn(),
    } as never;

    render(
      <SettingsPanel
        open
        onOpenChange={vi.fn()}
        storage={storage}
        localSync={localSync}
        llm={llm}
        promptPack={null}
        promptPackSource={null}
        wizardMode={false}
        setWizardMode={vi.fn()}
        privacySettingsOpen={false}
        setPrivacySettingsOpen={vi.fn()}
      />,
    );

    expect(screen.getByText(/auto prefers the built-in desktop accelerator/i)).toBeInTheDocument();
    expect(screen.getByText(/desktop accelerator could not find a local llama-server binary/i)).toBeInTheDocument();
    expect(screen.queryByText(/no in-browser installer is available/i)).not.toBeInTheDocument();
  });
});
