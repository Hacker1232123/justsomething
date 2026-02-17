export const STORAGE_KEYS = {
  serverUrl: "private-chess:server-url",
  muted: "private-chess:muted",
  clientId: "private-chess:client-id"
} as const;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore localStorage failures (private mode / quotas).
  }
}

export function readString(key: string, fallback = ""): string {
  const value = safeGet(key);
  if (value === null) {
    return fallback;
  }
  return value;
}

export function writeString(key: string, value: string): void {
  safeSet(key, value);
}

export function readBoolean(key: string, fallback = false): boolean {
  const value = safeGet(key);
  if (value === null) {
    return fallback;
  }
  return value === "1" || value.toLowerCase() === "true";
}

export function writeBoolean(key: string, value: boolean): void {
  safeSet(key, value ? "1" : "0");
}

export function getOrCreateClientId(): string {
  const existing = readString(STORAGE_KEYS.clientId);
  if (existing) {
    return existing;
  }

  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  const generated = Array.from(bytes)
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");

  writeString(STORAGE_KEYS.clientId, generated);
  return generated;
}
