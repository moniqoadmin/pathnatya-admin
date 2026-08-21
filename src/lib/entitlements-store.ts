import { useEffect, useState } from 'react'
import { listEntitlements, type Entitlement } from '../api/entitlements'
import { decryptPayload, encryptPayload } from '../api/payload-crypto'
import { ENTITLEMENTS_STORAGE_KEY } from './session'

export const SHOW_ANALYTICS_KEY = 'SHOW_ANALYTICS'

type Listener = () => void

const listeners = new Set<Listener>()
let memoryCache: Entitlement[] | null = null
let inflight: Promise<Entitlement[]> | null = null

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function parseEntitlements(value: unknown): Entitlement[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is Entitlement => {
    if (!item || typeof item !== 'object') {
      return false
    }
    const record = item as Partial<Entitlement>
    return typeof record.key === 'string' && record.key.trim().length > 0
  })
}

async function readStoredEntitlements(): Promise<Entitlement[]> {
  if (memoryCache) {
    return memoryCache
  }

  const raw = localStorage.getItem(ENTITLEMENTS_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const decrypted = parseEntitlements(await decryptPayload<unknown>(raw))
    memoryCache = decrypted
    return decrypted
  } catch {
    localStorage.removeItem(ENTITLEMENTS_STORAGE_KEY)
    memoryCache = null
    return []
  }
}

export async function cacheEntitlements(items: Entitlement[]): Promise<void> {
  memoryCache = items
  localStorage.setItem(ENTITLEMENTS_STORAGE_KEY, await encryptPayload(items))
  notify()
}

export function clearCachedEntitlements(): void {
  memoryCache = null
  inflight = null
  localStorage.removeItem(ENTITLEMENTS_STORAGE_KEY)
  notify()
}

export async function refreshEntitlements(authToken: string): Promise<Entitlement[]> {
  if (!inflight) {
    inflight = listEntitlements(authToken)
      .then(async (items) => {
        await cacheEntitlements(items)
        return items
      })
      .finally(() => {
        inflight = null
      })
  }

  return inflight
}

export function isEntitlementEnabled(items: Entitlement[], key: string): boolean {
  return items.some((item) => item.key === key && item.enabled)
}

export function useEntitlementEnabled(key: string): boolean {
  const [enabled, setEnabled] = useState(() =>
    memoryCache ? isEntitlementEnabled(memoryCache, key) : false,
  )

  useEffect(() => {
    let cancelled = false

    async function sync(): Promise<void> {
      const items = await readStoredEntitlements()
      if (!cancelled) {
        setEnabled(isEntitlementEnabled(items, key))
      }
    }

    void sync()
    return subscribe(() => {
      void sync()
    })
  }, [key])

  return enabled
}
