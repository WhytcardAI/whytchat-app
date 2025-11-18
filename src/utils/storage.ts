/**
 * Safe localStorage wrapper with error handling
 * Prevents crashes when localStorage is unavailable or restricted
 */

export function getStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error("Failed to read localStorage key", key, error);
    return null;
  }
}

export function setStorageItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error("Failed to set localStorage key", key, error);
    return false;
  }
}

export function removeStorageItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error("Failed to remove localStorage key", key, error);
    return false;
  }
}

export function getStorageNumber(key: string, defaultValue: number): number {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : defaultValue;
  } catch (error) {
    console.error("Failed to parse localStorage number key", key, error);
    return defaultValue;
  }
}

export function getStorageNumberWithClamp(
  key: string,
  defaultValue: number,
  min: number,
  max: number
): number {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;
    const num = parseFloat(value);
    return Number.isFinite(num)
      ? Math.min(max, Math.max(min, num))
      : defaultValue;
  } catch (error) {
    console.error("Failed to parse localStorage number key", key, error);
    return defaultValue;
  }
}

export function getStorageBoolean(key: string, defaultValue: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;
    return value === "true";
  } catch (error) {
    console.error("Failed to parse localStorage boolean key", key, error);
    return defaultValue;
  }
}
