/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WINDOWS_DOWNLOAD_LINK: string
  readonly VITE_MAC_DOWNLOAD_LINK: string
  readonly SHOULD_SHOW_DOWNLOAD_PAGE_TO_ADMIN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
