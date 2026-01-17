let warned = false;

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function warnOnce(operation: string, err: unknown) {
  // Avoid spamming logs; storage failures are expected in some environments
  if (warned) return;
  warned = true;
  // Keep this lightweight and non-fatal
  // eslint-disable-next-line no-console
  console.warn(`[safeStorage] localStorage ${operation} failed (non-fatal)`, err);
}

export function safeLocalStorageGetItem(key: string): string | null {
  const storage = getLocalStorage();
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch (err) {
    warnOnce("getItem", err);
    return null;
  }
}

export function safeLocalStorageSetItem(key: string, value: string): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch (err) {
    warnOnce("setItem", err);
    return false;
  }
}

export function safeLocalStorageRemoveItem(key: string): boolean {
  const storage = getLocalStorage();
  if (!storage) return false;
  try {
    storage.removeItem(key);
    return true;
  } catch (err) {
    warnOnce("removeItem", err);
    return false;
  }
}

