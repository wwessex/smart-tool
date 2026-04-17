const DESKTOP_HELPER_ORIGIN = "http://127.0.0.1:43117";
const JSON_HEADERS = {
  "Content-Type": "application/json",
};

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

interface DesktopHelperLoadResponse {
  ok: boolean;
  status: "downloading-model" | "warming-up" | "ready" | "error";
  ready: boolean;
  backend?: string | null;
  model_id?: string | null;
  message?: string | null;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Desktop helper request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export function getDesktopHelperOrigin(): string {
  return DESKTOP_HELPER_ORIGIN;
}

export async function getDesktopHelperHealth(signal?: AbortSignal): Promise<DesktopHelperHealth> {
  const response = await fetch(`${DESKTOP_HELPER_ORIGIN}/health`, {
    method: "GET",
    signal,
  });

  return readJson<DesktopHelperHealth>(response);
}

export async function loadDesktopHelper(modelId: string, signal?: AbortSignal): Promise<DesktopHelperLoadResponse> {
  const response = await fetch(`${DESKTOP_HELPER_ORIGIN}/load`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ model_id: modelId }),
    signal,
  });

  return readJson<DesktopHelperLoadResponse>(response);
}

export async function generateWithDesktopHelper(
  prompt: string,
  config: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<DesktopHelperGenerateResponse> {
  const response = await fetch(`${DESKTOP_HELPER_ORIGIN}/generate`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ prompt, config }),
    signal,
  });

  return readJson<DesktopHelperGenerateResponse>(response);
}

export async function unloadDesktopHelper(signal?: AbortSignal): Promise<{ ok: boolean }> {
  const response = await fetch(`${DESKTOP_HELPER_ORIGIN}/unload`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({}),
    signal,
  });

  return readJson<{ ok: boolean }>(response);
}
