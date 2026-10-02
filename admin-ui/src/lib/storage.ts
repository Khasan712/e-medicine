/** localStorage that never throws (private mode, disabled storage, quota). */
export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      /* storage unavailable — the preference just is not remembered */
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
  getJSON<T>(key: string): T | null {
    const raw = storage.get(key)
    if (!raw) return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  },
  setJSON(key: string, value: unknown): void {
    storage.set(key, JSON.stringify(value))
  },
}

export const STORAGE_KEYS = {
  theme: 'admin.theme',
  lang: 'admin.lang',
  sidebar: 'admin.sidebar',
  business: 'admin.business',
} as const
