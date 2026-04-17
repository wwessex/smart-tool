import { getDesktopBridge } from "@/lib/desktop-bridge";
import type {
  DesktopHelperGenerateResponse,
  DesktopHelperHealth,
  DesktopHelperLoadResponse,
} from "@/types/desktop";

const DESKTOP_HELPER_ORIGIN = "http://127.0.0.1:43117";
const JSON_HEADERS = {
  "Content-Type": "application/json",
};

export type { DesktopHelperGenerateResponse, DesktopHelperHealth, DesktopHelperLoadResponse };

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Desktop helper request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export function getDesktopHelperOrigin(): string {
  if (getDesktopBridge()) {
    return "desktop-helper://ipc";
  }
  return DESKTOP_HELPER_ORIGIN;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
}

export async function getDesktopHelperHealth(signal?: AbortSignal): Promise<DesktopHelperHealth> {
  throwIfAborted(signal);
  const desktopBridge = getDesktopBridge();
  if (desktopBridge) {
    return desktopBridge.desktopHelper.health();
  }

  const response = await fetch(`${DESKTOP_HELPER_ORIGIN}/health`, {
    method: "GET",
    signal,
  });

  return readJson<DesktopHelperHealth>(response);
}

export async function loadDesktopHelper(modelId: string, signal?: AbortSignal): Promise<DesktopHelperLoadResponse> {
  throwIfAborted(signal);
  const desktopBridge = getDesktopBridge();
  if (desktopBridge) {
    return desktopBridge.desktopHelper.load(modelId);
  }

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
  throwIfAborted(signal);
  const desktopBridge = getDesktopBridge();
  if (desktopBridge) {
    return desktopBridge.desktopHelper.generate(prompt, config);
  }

  const response = await fetch(`${DESKTOP_HELPER_ORIGIN}/generate`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ prompt, config }),
    signal,
  });

  return readJson<DesktopHelperGenerateResponse>(response);
}

export async function unloadDesktopHelper(signal?: AbortSignal): Promise<{ ok: boolean }> {
  throwIfAborted(signal);
  const desktopBridge = getDesktopBridge();
  if (desktopBridge) {
    return desktopBridge.desktopHelper.unload();
  }

  const response = await fetch(`${DESKTOP_HELPER_ORIGIN}/unload`, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({}),
    signal,
  });

  return readJson<{ ok: boolean }>(response);
}
