const STORAGE_KEY = 'pathnatya-admin-device-id'

export function getDeviceId(): string {
  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing) {
    return existing
  }

  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  localStorage.setItem(STORAGE_KEY, id)
  return id
}
