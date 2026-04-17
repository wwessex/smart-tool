export type DesktopHelperStatus =
  | "checking"
  | "not-installed"
  | "downloading-model"
  | "warming-up"
  | "ready"
  | "using-browser-fallback"
  | "error";

export interface DesktopHelperHealth {
  ok: boolean;
  status: Exclude<DesktopHelperStatus, "checking" | "using-browser-fallback">;
  ready: boolean;
  backend?: string | null;
  model_id?: string | null;
  message?: string | null;
}

export interface DesktopHelperGenerateResponse {
  text: string;
  tokens_generated: number;
  time_ms: number;
  backend: string;
}

export interface DesktopHelperLoadResponse {
  ok: boolean;
  status: "downloading-model" | "warming-up" | "ready" | "error";
  ready: boolean;
  backend?: string | null;
  model_id?: string | null;
  message?: string | null;
}

export interface DesktopSyncFolderState {
  folderPath: string | null;
  folderName: string | null;
}

export interface SmartToolDesktopBridge {
  isDesktopApp: true;
  platform: string;
  version: string;
  desktopHelper: {
    health(): Promise<DesktopHelperHealth>;
    load(modelId: string): Promise<DesktopHelperLoadResponse>;
    generate(prompt: string, config: Record<string, unknown>): Promise<DesktopHelperGenerateResponse>;
    unload(): Promise<{ ok: boolean }>;
  };
  syncFolder: {
    getState(): Promise<DesktopSyncFolderState>;
    selectFolder(): Promise<DesktopSyncFolderState | null>;
    clearFolder(): Promise<{ ok: boolean }>;
    writeTextFile(filename: string, content: string): Promise<{ path: string }>;
  };
}
