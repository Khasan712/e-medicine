/**
 * localStorage scoped to the shop host (`dh:<host>:<key>`), JSON-encoded and safe in private mode.
 * Every business lives on its own host, so carts, tokens and settings never mix.
 * index.html reads the same keys before the first paint (theme, lang, brand).
 */

export type StorageKey = 'token' | 'cart' | 'lang' | 'theme' | 'contact' | 'brand' | 'catalog'

export const storageKey = (key: StorageKey) => `dh:${window.location.host}:${key}`

export function readStorage<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(storageKey(key))
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeStorage(key: StorageKey, value: unknown): void {
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(value))
  } catch {
    /* private mode or quota — the app keeps working without persistence */
  }
}

export function removeStorage(key: StorageKey): void {
  try {
    window.localStorage.removeItem(storageKey(key))
  } catch {
    /* ignore */
  }
}

/** Per-tab draft storage (checkout form). */
export function readSession<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(`dh:${key}`)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeSession(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(`dh:${key}`, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

export function removeSession(key: string): void {
  try {
    window.sessionStorage.removeItem(`dh:${key}`)
  } catch {
    /* ignore */
  }
}
