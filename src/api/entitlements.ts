import { apiFetch } from './client'

export interface Entitlement {
  key: string
  enabled: boolean
  name: string | null
  description: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export interface UpdateEntitlementPayload {
  enabled: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return null
}

function booleanField(record: Record<string, unknown>, ...keys: string[]): boolean | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') {
      return value
    }
    if (value === 1 || value === 'true' || value === '1') {
      return true
    }
    if (value === 0 || value === 'false' || value === '0') {
      return false
    }
  }
  return null
}

function parseEntitlement(body: unknown, key: string): Entitlement | null {
  if (body == null) {
    return null
  }

  const direct = unwrapEntitlement(body, key)
  if (direct) {
    return direct
  }

  const outer = asRecord(body)
  if (!outer) {
    return null
  }

  return unwrapEntitlement(asRecord(outer.data) ?? asRecord(outer.entitlement), key)
}

function unwrapEntitlement(value: unknown, fallbackKey?: string): Entitlement | null {
  if (typeof value === 'boolean' && fallbackKey) {
    return {
      key: fallbackKey,
      enabled: value,
      name: null,
      description: null,
      updatedAt: null,
      updatedBy: null,
    }
  }

  const record = asRecord(value)
  if (!record) {
    return null
  }

  const nested = asRecord(record.entitlement) ?? asRecord(record.data)
  const source = nested && ('key' in nested || 'code' in nested || 'enabled' in nested || 'isEnabled' in nested)
    ? nested
    : record

  const key =
    stringField(source, 'key', 'code', 'id') ??
    (fallbackKey && fallbackKey.trim() ? fallbackKey.trim() : null)
  if (!key) {
    return null
  }

  return {
    key,
    enabled: booleanField(source, 'enabled', 'isEnabled') ?? false,
    name: stringField(source, 'name', 'title', 'label'),
    description: stringField(source, 'description', 'details'),
    updatedAt: stringField(source, 'updatedAt', 'updated_at'),
    updatedBy: stringField(source, 'updatedBy', 'updated_by'),
  }
}

function unwrapEntitlementList(body: unknown): Entitlement[] {
  const outer = asRecord(body)
  const nested = asRecord(outer?.data)
  const candidates = [
    Array.isArray(body) ? body : null,
    Array.isArray(outer?.data) ? outer.data : null,
    Array.isArray(outer?.entitlements) ? outer.entitlements : null,
    Array.isArray(nested?.data) ? nested.data : null,
    Array.isArray(nested?.entitlements) ? nested.entitlements : null,
  ]

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue
    }
    const items = candidate
      .map((item) => unwrapEntitlement(item))
      .filter((item): item is Entitlement => item != null)
    if (items.length > 0 || candidate.length === 0) {
      return items
    }
  }

  const record = nested ?? outer
  if (!record) {
    throw new Error('Unable to load entitlements.')
  }

  const single = unwrapEntitlement(record)
  if (single) {
    return [single]
  }

  const items: Entitlement[] = []
  for (const [key, value] of Object.entries(record)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      continue
    }
    const entitlement = unwrapEntitlement(value, key)
    if (entitlement) {
      items.push(entitlement)
    }
  }

  return items
}

export function listEntitlements(authToken: string): Promise<Entitlement[]> {
  return apiFetch<unknown>('/entitlements', { authToken }).then(unwrapEntitlementList)
}

export function getEntitlement(key: string, authToken: string): Promise<Entitlement> {
  return apiFetch<unknown>(`/entitlements/${encodeURIComponent(key)}`, { authToken }).then(
    (body) => {
      const entitlement = parseEntitlement(body, key)
      if (!entitlement) {
        throw new Error('Unable to load entitlement.')
      }
      return entitlement
    },
  )
}

export function updateEntitlement(
  key: string,
  payload: UpdateEntitlementPayload,
  authToken: string,
): Promise<Entitlement> {
  return apiFetch<unknown>(`/entitlements/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    authToken,
    json: payload,
  }).then(
    (body) =>
      parseEntitlement(body, key) ?? {
        key,
        enabled: payload.enabled,
        name: null,
        description: null,
        updatedAt: null,
        updatedBy: null,
      },
  )
}
