import { useState, memo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { WarningBox } from './WarningBox';
import { cn } from '@/lib/utils';
import { DEFAULT_PROMPT_PACK, type PromptPack } from '@/lib/prompt-pack';
import { getDesktopBridge } from '@/lib/desktop-bridge';
import { useDesktopInstallTarget } from '@/hooks/useDesktopInstallTarget';
import type { useSmartStorage } from '@/hooks/useSmartStorage';
import type { useLocalSync } from '@/hooks/useLocalSync';
import {
  Settings, HelpCircle, Bot, AlertTriangle, ShieldCheck, Wand2,
  Sparkles, Check, RefreshCw, Loader2, Shield, FileDown, Clock,
  Trash2, Download, FolderSync, FolderOpen, FileArchive, CloudOff,
} from 'lucide-react';

function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`localStorage remove failed for key "${key}":`, error);
    return false;
  }
}

function openExternalLink(url: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storage: ReturnType<typeof useSmartStorage>;
  localSync: ReturnType<typeof useLocalSync>;
  llm: {
    isReady: boolean;
    isLoading: boolean;
    isGenerating: boolean;
    error: string | null;
    classifiedError: { title: string; message: string; retryable: boolean } | null;
    loadingStatus: string;
    loadingProgress: number;
    selectedModel: string | null;
    activeRuntime: 'browser' | 'desktop-helper' | 'template' | null;
    supportedModels: Array<{ id: string; name: string; size: string; description: string }>;
    canUseLocalAI: boolean;
    isMobile: boolean;
    supportsDesktopHelper: boolean;
    browserInfo: { isSafari: boolean; isMac?: boolean; isWindows?: boolean; isLinux?: boolean };
    deviceInfo: { isIOS: boolean } | null;
    helperStatus: 'checking' | 'not-installed' | 'downloading-model' | 'warming-up' | 'ready' | 'using-browser-fallback' | 'error';
    helperMessage: string | null;
    helperBackend: string | null;
    loadModel: (id: string) => Promise<boolean>;
    unload: () => void;
    clearError: () => void;
    refreshHelperHealth: () => Promise<unknown>;
  };
  promptPack: PromptPack | null;
  promptPackSource: string | null;
  wizardMode: boolean;
  setWizardMode: (v: boolean) => void;
  privacySettingsOpen: boolean;
  setPrivacySettingsOpen: (v: boolean) => void;
}

export const SettingsPanel = memo(function SettingsPanel({
  open,
  onOpenChange,
  storage,
  localSync,
  llm,
  promptPack,
  promptPackSource,
  wizardMode,
  setWizardMode,
  setPrivacySettingsOpen,
}: SettingsPanelProps) {
  const { toast } = useToast();
  const [settingsBarriers, setSettingsBarriers] = useState('');
  const [settingsTimescales, setSettingsTimescales] = useState('');

  const effectivePromptPack = promptPack || DEFAULT_PROMPT_PACK;
  const desktopBridge = getDesktopBridge();
  const isDesktopShell = Boolean(desktopBridge);
  const installTarget = useDesktopInstallTarget(llm.browserInfo);
  const helperUnavailableDescription = isDesktopShell
    ? 'Desktop Accelerator is built into this desktop app but is not ready yet.'
    : installTarget.canDirectDownload
      ? `Desktop Accelerator is not running in this browser. ${installTarget.label} to use the built-in accelerator.`
      : 'Desktop Accelerator is not installed or not running.';
  const helperSetupDescription = isDesktopShell
    ? 'This desktop build embeds Desktop Accelerator. It downloads its local model on first use and keeps Browser AI available as a fallback.'
    : installTarget.description;
  const helperStatusCopy = llm.helperStatus === 'ready'
    ? { label: 'Ready', description: llm.helperBackend ? `Desktop Accelerator is ready via ${llm.helperBackend}.` : 'Desktop Accelerator is ready.' }
    : llm.helperStatus === 'downloading-model'
      ? { label: 'Downloading model', description: llm.helperMessage || 'Desktop Accelerator is downloading its local model.' }
      : llm.helperStatus === 'warming-up'
        ? { label: 'Warming up', description: llm.helperMessage || 'Desktop Accelerator is starting and preloading the planner.' }
        : llm.helperStatus === 'using-browser-fallback'
          ? { label: 'Using browser fallback', description: llm.helperMessage || 'Desktop Accelerator was unavailable, so Browser AI will be used instead.' }
          : llm.helperStatus === 'checking'
            ? { label: 'Checking...', description: 'Looking for a running Desktop Accelerator on this computer.' }
            : llm.helperStatus === 'error'
              ? { label: 'Unavailable', description: llm.helperMessage || 'Desktop Accelerator returned an error.' }
              : { label: isDesktopShell ? 'Unavailable' : 'Not installed', description: llm.helperMessage || helperUnavailableDescription };
  const activeRuntimeLabel = llm.activeRuntime === 'desktop-helper'
    ? 'Desktop Accelerator'
    : llm.activeRuntime === 'browser'
      ? 'Browser AI'
      : llm.activeRuntime === 'template'
        ? 'Smart Templates'
        : 'Not loaded';
  const showHelperSetupCard = !isDesktopShell && llm.supportsDesktopHelper && (llm.helperStatus === 'not-installed' || llm.helperStatus === 'error');

  const handleOpen = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen) {
      setSettingsBarriers(storage.barriers.join('\n'));
      setSettingsTimescales(storage.timescales.join('\n'));
    }
  };

  const handleSwitchToBrowserAI = async () => {
    storage.updateAIDraftRuntime('browser');
    const modelId = llm.selectedModel || storage.preferredLLMModel || llm.supportedModels[0]?.id;
    if (!modelId || (llm.isReady && llm.activeRuntime === 'browser')) {
      return;
    }

    const success = await llm.loadModel(modelId);
    if (success) {
      storage.updatePreferredLLMModel?.(modelId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] sm:max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure SMART Tool drafting, storage, sync, and privacy preferences.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg border bg-card space-y-3 hover:border-primary/20 hover:shadow-sm transition-all duration-200 ease-spring">
              <h3 className="font-bold">Barriers list</h3>
              <p className="text-xs text-muted-foreground">One per line. Users can still type custom barriers.</p>
              <Textarea
                value={settingsBarriers}
                onChange={e => setSettingsBarriers(e.target.value)}
                className="font-mono text-sm min-h-[200px]"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  storage.resetBarriers();
                  setSettingsBarriers(storage.barriers.join('\n'));
                  toast({ title: 'Reset', description: 'Barriers reset to default.' });
                }}>Reset</Button>
                <Button size="sm" onClick={() => {
                  const list = settingsBarriers.split('\n').map(s => s.trim()).filter(Boolean);
                  if (!list.length) {
                    toast({ title: 'Error', description: 'Barriers list cannot be empty.', variant: 'destructive' });
                    return;
                  }
                  storage.updateBarriers(Array.from(new Set(list)));
                  toast({ title: 'Saved', description: 'Barriers updated.' });
                }}>Save</Button>
              </div>
            </div>
            <div className="p-4 rounded-lg border bg-card space-y-3 hover:border-primary/20 hover:shadow-sm transition-all duration-200 ease-spring">
              <h3 className="font-bold">Timescales</h3>
              <p className="text-xs text-muted-foreground">One per line.</p>
              <Textarea
                value={settingsTimescales}
                onChange={e => setSettingsTimescales(e.target.value)}
                className="font-mono text-sm min-h-[200px]"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  storage.resetTimescales();
                  setSettingsTimescales(storage.timescales.join('\n'));
                  toast({ title: 'Reset', description: 'Timescales reset to default.' });
                }}>Reset</Button>
                <Button size="sm" onClick={() => {
                  const list = settingsTimescales.split('\n').map(s => s.trim()).filter(Boolean);
                  if (!list.length) {
                    toast({ title: 'Error', description: 'Timescales list cannot be empty.', variant: 'destructive' });
                    return;
                  }
                  storage.updateTimescales(Array.from(new Set(list)));
                  toast({ title: 'Saved', description: 'Timescales updated.' });
                }}>Save</Button>
              </div>
            </div>
          </div>

          {/* Quality Enforcement Section */}
          <div className="p-4 rounded-lg border bg-card space-y-4 hover:border-primary/20 hover:shadow-sm transition-all duration-200 ease-spring">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Quality Enforcement</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Prevent saving actions that don't meet SMART quality standards.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={storage.minScoreEnabled}
                  onChange={e => storage.updateMinScoreEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium">Enforce minimum SMART score</span>
              </label>

              {storage.minScoreEnabled && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Minimum score:</span>
                  <Select
                    value={String(storage.minScoreThreshold)}
                    onValueChange={v => storage.updateMinScoreThreshold(parseInt(v, 10))}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4/5</SelectItem>
                      <SelectItem value="5">5/5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <WarningBox show={storage.minScoreEnabled} variant="warning">
              Actions with a SMART score below {storage.minScoreThreshold}/5 cannot be saved to history.
              This encourages higher quality action writing.
            </WarningBox>
          </div>

          {/* Wizard Mode Toggle */}
          <div className="p-4 rounded-lg border bg-card space-y-4 hover:border-primary/20 hover:shadow-sm transition-all duration-200 ease-spring">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Guided Wizard Mode</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Step-by-step guided form that walks you through creating a SMART action.
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={wizardMode}
                onChange={e => setWizardMode(e.target.checked)}
                className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium">Enable guided wizard mode</span>
            </label>
          </div>

          {/* AI Draft Settings Section */}
          <div className="p-4 rounded-lg border bg-card space-y-4 hover:border-primary/20 hover:shadow-sm transition-all duration-200 ease-spring">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              <h3 className="font-bold">AI Draft</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              AI drafting stays local. Desktop builds prefer the embedded Desktop Accelerator, browser
              builds prefer a detected helper, and Browser AI remains the fallback. Smart Templates stay
              available as the no-download option.
            </p>

            {/* Mode Toggle */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="aiDraftMode"
                  checked={storage.aiDraftMode === 'ai'}
                  onChange={() => storage.updateAIDraftMode('ai')}
                  className="w-4 h-4 accent-primary"
                />
                <div>
                  <span className="text-sm font-medium">Use Local AI</span>
                  <p className="text-xs text-muted-foreground">
                    AI-generated suggestions (requires a one-time model download in this browser)
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="aiDraftMode"
                  checked={storage.aiDraftMode === 'template'}
                  onChange={() => storage.updateAIDraftMode('template')}
                  className="w-4 h-4 accent-primary"
                />
                <div>
                  <span className="text-sm font-medium">Use Smart Templates</span>
                  <p className="text-xs text-muted-foreground">
                    Instant template-based suggestions (no download required)
                  </p>
                </div>
              </label>
            </div>

            {storage.aiDraftMode === 'ai' && !llm.isMobile && (
              <div className="pt-4 border-t space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-medium">Runtime</h4>
                    <p className="text-xs text-muted-foreground">
                      Current runtime: {activeRuntimeLabel}
                    </p>
                  </div>
                  {llm.supportsDesktopHelper && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => { void llm.refreshHelperHealth(); }}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Refresh
                    </Button>
                  )}
                </div>

                <Select
                  value={storage.aiDraftRuntime}
                  onValueChange={(value) => storage.updateAIDraftRuntime(value as 'auto' | 'browser' | 'desktop-helper')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="browser">Browser AI</SelectItem>
                    <SelectItem value="desktop-helper">Desktop Accelerator</SelectItem>
                  </SelectContent>
                </Select>

                <p className="text-xs text-muted-foreground">
                  {isDesktopShell
                    ? 'Auto prefers the built-in Desktop Accelerator in this desktop app. Browser AI stays available as a fallback if the accelerator is unavailable.'
                    : installTarget.canDirectDownload
                      ? `On ${installTarget.platformLabel}, Browser AI stays available in-browser. ${installTarget.label} to switch to the built-in Desktop Accelerator.`
                      : 'Auto prefers Desktop Accelerator when a running helper is available on this computer. Browser AI keeps everything in-browser. Advanced manual setup remains available for unsupported devices.'}
                </p>

                {llm.supportsDesktopHelper && (
                  <div className="rounded-lg border bg-muted/40 px-3 py-3 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">Desktop Accelerator</span>
                      <span className="text-xs text-muted-foreground">{helperStatusCopy.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{helperStatusCopy.description}</p>
                  </div>
                )}

                {showHelperSetupCard && (
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-3 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {isDesktopShell
                            ? 'Desktop Accelerator is unavailable in this desktop build.'
                            : installTarget.canDirectDownload
                              ? `${installTarget.label} to enable Desktop Accelerator.`
                              : 'No one-click Desktop Accelerator installer is available on this device.'}
                        </p>
                        <p className="text-xs text-muted-foreground">{helperSetupDescription}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {installTarget.canDirectDownload && installTarget.url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openExternalLink(installTarget.url)}
                        >
                          {installTarget.label}
                        </Button>
                      )}
                      {!installTarget.canDirectDownload && installTarget.showAdvancedManualSetup && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => openExternalLink(installTarget.manualGuideUrl)}
                        >
                          Advanced manual setup
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => { void handleSwitchToBrowserAI(); }}
                      >
                        {storage.aiDraftRuntime === 'browser' ? 'Load Browser AI' : 'Switch to Browser AI'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => { void llm.refreshHelperHealth(); }}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Refresh helper check
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* iOS / mobile enable (experimental) */}
            {storage.aiDraftMode === 'ai' && llm.deviceInfo?.isIOS && llm.isMobile && (
              <div className="pt-4 border-t space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={storage.allowMobileLLM}
                    onChange={e => storage.updateAllowMobileLLM(e.target.checked)}
                    className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-primary mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium">Enable Local AI on iPhone/iPad (experimental)</span>
                    <p className="text-xs text-muted-foreground">
                      iPhone is limited to the smallest model and shorter outputs to reduce memory use.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Safari WebGPU toggle (experimental) */}
            {storage.aiDraftMode === 'ai' && llm.browserInfo?.isSafari && (
              <div className="pt-4 border-t space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={storage.safariWebGPUEnabled}
                    onChange={e => storage.updateSafariWebGPUEnabled(e.target.checked)}
                    className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-primary mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium">Safari WebGPU (experimental)</span>
                    <p className="text-xs text-muted-foreground">
                      Enable WebGPU acceleration for faster inference. May cause tab reloads on heavy models due to increased memory and GPU usage.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Safari model unload behavior */}
            {storage.aiDraftMode === 'ai' && llm.browserInfo?.isSafari && (
              <div className="pt-4 border-t space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={storage.keepSafariModelLoaded}
                    onChange={e => storage.updateKeepSafariModelLoaded(e.target.checked)}
                    className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-primary mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium">Keep model loaded (Safari)</span>
                    <p className="text-xs text-muted-foreground">
                      Safari unloads the local model shortly after each draft to reduce memory pressure and
                      avoid tab reloads. Enable this to keep it loaded between drafts.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Browser AI controls */}
            {storage.aiDraftMode === 'ai' && llm.canUseLocalAI && (
              <div className="pt-4 border-t space-y-3">
                <h4 className="text-sm font-medium">Browser AI</h4>
                <p className="text-xs text-muted-foreground">
                  AI playbook v{effectivePromptPack.version} ({promptPackSource || 'default'})
                </p>

                {llm.isReady && llm.activeRuntime === 'browser' && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                      <Check className="w-4 h-4" />
                      {llm.supportedModels.find(m => m.id === llm.selectedModel)?.name || 'Browser AI'} loaded
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const modelId = llm.selectedModel;
                          if (modelId) {
                            storage.updateAIDraftRuntime('browser');
                            llm.unload();
                            await llm.loadModel(modelId);
                          }
                        }}
                        className="h-7 text-xs"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Reload
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => llm.unload()}
                        className="h-7 text-xs"
                      >
                        Unload
                      </Button>
                    </div>
                  </div>
                )}

                {llm.isLoading && (storage.aiDraftRuntime === 'browser' || llm.activeRuntime === 'browser' || llm.helperStatus === 'using-browser-fallback') && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">{llm.loadingStatus}</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${llm.loadingProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {(!llm.isReady || llm.activeRuntime !== 'browser') && !llm.isLoading && (
                  <div className="space-y-2">
                    {llm.supportedModels.map((model) => (
                      <button
                        key={model.id}
                        onClick={async () => {
                          storage.updateAIDraftRuntime('browser');
                          const success = await llm.loadModel(model.id);
                          if (success) {
                            if (storage.updatePreferredLLMModel) {
                              storage.updatePreferredLLMModel(model.id);
                            }
                          }
                        }}
                        className="w-full p-3 rounded-lg border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {storage.aiDraftRuntime === 'browser' ? 'Load Browser AI' : 'Switch to Browser AI'}
                          </span>
                          <span className="text-xs text-muted-foreground">{model.size}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {storage.aiDraftRuntime === 'browser'
                            ? model.description
                            : `${model.description}. This also changes the preferred runtime to Browser AI.`}
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {llm.error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        {llm.classifiedError && (
                          <p className="text-xs font-medium text-destructive">{llm.classifiedError.title}</p>
                        )}
                        <p className="text-xs text-destructive">{llm.classifiedError?.message || llm.error}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(!llm.classifiedError || llm.classifiedError.retryable) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={async () => {
                            llm.clearError();
                            const modelId = llm.selectedModel || storage.preferredLLMModel || llm.supportedModels[0]?.id;
                            if (modelId) {
                              storage.updateAIDraftRuntime('browser');
                              llm.unload();
                              await llm.loadModel(modelId);
                            }
                          }}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Try Again
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => llm.clearError()}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mobile warning */}
            {!llm.canUseLocalAI && storage.aiDraftMode === 'ai' && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Local AI is disabled for this device right now. Enable the iPhone/iPad toggle above (if available) or use Smart Templates instead.
                </p>
              </div>
            )}
          </div>

          <div className="p-4 rounded-lg border bg-card space-y-4 hover:border-primary/20 hover:shadow-sm transition-all duration-200 ease-spring">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Tutorial</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Replay the onboarding tutorial to learn about key features.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                safeRemoveItem('smartTool.onboardingComplete');
                onOpenChange(false);
                window.location.reload();
              }}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Replay Tutorial
            </Button>
          </div>

          {/* Local Folder Sync / Export Section */}
          <div className="p-4 rounded-lg border bg-card space-y-4 hover:border-primary/20 hover:shadow-sm transition-all duration-200 ease-spring">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {localSync.isSupported ? (
                  <FolderSync className="w-5 h-5 text-primary" />
                ) : (
                  <FileArchive className="w-5 h-5 text-primary" />
                )}
                <h3 className="font-bold">{localSync.isSupported ? 'Folder Sync' : 'Export Actions'}</h3>
              </div>
              {localSync.isSupported && localSync.isConnected && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3 h-3" />
                  Connected
                </div>
              )}
            </div>

            {localSync.isSupported ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Save actions to a folder on your device. Tip: Select your OneDrive or Google Drive folder for automatic cloud sync!
                </p>

                <div className="space-y-3">
                  {localSync.isConnected ? (
                    <>
                      <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <FolderOpen className="w-4 h-4 text-muted-foreground" />
                          {localSync.folderName}
                        </p>
                        {localSync.lastSync && (
                          <p className="text-xs text-muted-foreground">
                            Last sync: {new Date(localSync.lastSync).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => localSync.selectFolder()}
                          className="flex-1 gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Change Folder
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => localSync.disconnect()}
                          className="flex-1 gap-1.5"
                        >
                          <CloudOff className="w-3.5 h-3.5" />
                          Disconnect
                        </Button>
                      </div>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={localSync.syncEnabled}
                          onChange={e => localSync.setSyncEnabled(e.target.checked)}
                          className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-primary"
                        />
                        <span className="text-sm font-medium">Sync when saving to history</span>
                      </label>

                      {localSync.syncEnabled && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                          <FolderSync className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <p className="text-xs text-muted-foreground">
                            Each saved action will be written as a .txt file to your selected folder.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <Button
                      onClick={() => localSync.selectFolder()}
                      disabled={localSync.isConnecting}
                      className="w-full gap-2"
                    >
                      {localSync.isConnecting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Selecting...
                        </>
                      ) : (
                        <>
                          <FolderOpen className="w-4 h-4" />
                          Choose Folder
                        </>
                      )}
                    </Button>
                  )}

                  {localSync.error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive">{localSync.error}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Your browser doesn't support automatic folder sync, but you can download your actions as a ZIP file.
                </p>

                <Button
                  onClick={() => localSync.downloadAllAsZip(storage.history)}
                  disabled={storage.history.length === 0}
                  className="w-full gap-2"
                >
                  <FileArchive className="w-4 h-4" />
                  Download All as ZIP ({storage.history.length} action{storage.history.length !== 1 ? 's' : ''})
                </Button>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <Download className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Tip: Save the ZIP to your OneDrive or iCloud folder for cloud backup! For automatic sync, use Chrome or Edge on desktop.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Data Retention Section */}
          <div className="p-4 rounded-lg border bg-card space-y-4 hover:border-primary/20 hover:shadow-sm transition-all duration-200 ease-spring">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Data Retention</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Automatically delete old history items to comply with data minimisation principles.
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={storage.retentionEnabled}
                  onChange={e => storage.updateRetentionEnabled(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-primary text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium">Auto-delete old actions</span>
              </label>

              {storage.retentionEnabled && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Keep for:</span>
                  <Select
                    value={String(storage.retentionDays)}
                    onValueChange={v => storage.updateRetentionDays(parseInt(v, 10))}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                      <SelectItem value="180">180 days</SelectItem>
                      <SelectItem value="365">1 year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {storage.retentionEnabled && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Actions older than {storage.retentionDays} days will be automatically deleted when you open the app.
                  You currently have {storage.history.length} action{storage.history.length === 1 ? '' : 's'} in history.
                </p>
              </div>
            )}
          </div>

          {/* Privacy & Data Section - GDPR Compliance */}
          <div className="p-4 rounded-lg border bg-card space-y-4 hover:border-primary/20 hover:shadow-sm transition-all duration-200 ease-spring">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <h3 className="font-bold">Privacy & Data</h3>
              </div>
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
                llm.isReady
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              )}>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  llm.isReady ? "bg-emerald-500" : "bg-amber-500"
                )} />
                <span>{llm.isReady ? "Local AI ready" : "Local AI not loaded"}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Manage your data and privacy preferences in accordance with UK GDPR.
            </p>

            <div className="grid gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const data = storage.exportAllData();
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `smart-action-data-${new Date().toISOString().slice(0, 10)}.json`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                  toast({ title: 'Data exported', description: 'Your data has been downloaded.' });
                }}
                className="gap-2 justify-start"
              >
                <FileDown className="w-4 h-4" />
                Export All My Data
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPrivacySettingsOpen(true)}
                className="gap-2 justify-start"
              >
                <Shield className="w-4 h-4" />
                Manage Cookie Preferences
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (confirm('Are you sure you want to delete all your data? This cannot be undone.')) {
                    storage.deleteAllData();
                    toast({ title: 'Data deleted', description: 'All your data has been removed.' });
                    window.location.reload();
                  }
                }}
                className="gap-2 justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
                Delete All My Data
              </Button>
            </div>

            <a
              href="#/privacy"
              className="text-xs text-primary hover:underline block mt-2"
              onClick={() => onOpenChange(false)}
            >
              View Privacy Policy →
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
