export const APP_KEY = import.meta.env.VITE_APP_KEY ?? ''

export const API_KEY_1 = import.meta.env.VITE_API_KEY_1 ?? ''

export const API_BASE = import.meta.env.VITE_API_BASE ?? ''

export const WINDOWS_DOWNLOAD_LINK = import.meta.env.VITE_WINDOWS_DOWNLOAD_LINK ?? ''

export const MAC_DOWNLOAD_LINK = import.meta.env.VITE_MAC_DOWNLOAD_LINK ?? ''

export const SHOULD_SHOW_DOWNLOAD_PAGE_TO_ADMIN =
  import.meta.env.SHOULD_SHOW_DOWNLOAD_PAGE_TO_ADMIN?.trim().toLowerCase() === 'true'
