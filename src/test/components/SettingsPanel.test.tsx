import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsPanel } from "@/components/smart/SettingsPanel";

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
});
