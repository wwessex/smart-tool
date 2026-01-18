/**
 * Safe localStorage utilities
 * Handles quota errors, security errors, and other storage failures gracefully.
 */

/**
 * Safely write to localStorage, catching quota errors and blocked storage.
 * @returns true if the write succeeded, false otherwise.
 */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    // QuotaExceededError, SecurityError, or other storage errors
    console.warn(`localStorage write failed for key "${key}":`, error);
    return false;
  }
}

/**
 * Safely remove from localStorage, catching any errors.
 * @returns true if the removal succeeded, false otherwise.
 */
export function safeRemoveItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`localStorage remove failed for key "${key}":`, error);
    return false;
  }
}

/**
 * Safely read from localStorage, catching any errors.
 * @returns the value if found, null otherwise.
 */
export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`localStorage read failed for key "${key}":`, error);
    return null;
  }
}

/**
 * Load and parse a JSON list from localStorage with a fallback.
 */
export function loadList<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = safeGetItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Save a list to localStorage as JSON.
 */
export function saveList<T>(key: string, list: T[]): boolean {
  return safeSetItem(key, JSON.stringify(list));
}

/**
 * Load a boolean value from localStorage with a fallback.
 */
export function loadBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = safeGetItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch {
    return fallback;
  }
}

/**
 * Load a number value from localStorage with a fallback.
 */
export function loadNumber(key: string, fallback: number): number {
  try {
    const raw = safeGetItem(key);
    if (raw === null) return fallback;
    const num = parseInt(raw, 10);
    return isNaN(num) ? fallback : num;
  } catch {
    return fallback;
  }
}

/**
 * Load a string value from localStorage with a fallback.
 */
export function loadString(key: string, fallback: string): string {
  try {
    const raw = safeGetItem(key);
    return raw ?? fallback;
  } catch {
    return fallback;
  }
}
