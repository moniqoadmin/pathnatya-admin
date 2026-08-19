export const APP_KEY = 'ZkjrS_rj8F7DbaGCtemUUpoBKcOqlcAtOVawSxKx6nwq62aIoRlX6-HkJjCgA5tI'

export const API_KEY_1 = 'x0m2-7u04b-5e1g-h7z1'

export const API_BASE = 'https://pathnatya-be-production.up.railway.app/api'

export const WINDOWS_DOWNLOAD_LINK = import.meta.env.VITE_WINDOWS_DOWNLOAD_LINK ?? ''

export const MAC_DOWNLOAD_LINK = import.meta.env.VITE_MAC_DOWNLOAD_LINK ?? ''

export const SHOULD_SHOW_DOWNLOAD_PAGE_TO_ADMIN =
  import.meta.env.SHOULD_SHOW_DOWNLOAD_PAGE_TO_ADMIN?.trim().toLowerCase() === 'true'
