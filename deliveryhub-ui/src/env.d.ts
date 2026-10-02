interface ImportMetaEnv {
  /** Optional: the platform domain shown in address previews (`portex.uz`). */
  readonly VITE_PLATFORM_DOMAIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
