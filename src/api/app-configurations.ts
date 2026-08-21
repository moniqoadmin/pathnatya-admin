import { apiFetch } from './client'

export type VideoConfig = Record<string, unknown>

export interface AppConfiguration {
  id: number
  videoConfig: VideoConfig
  videoFiles: unknown[]
  createdAt: string | null
  updatedAt: string | null
}

export interface SaveAppConfigurationPayload {
  id?: number
  videoConfig?: VideoConfig
  videoFiles?: unknown[]
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

function numberField(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return null
}

function parseVideoConfig(value: unknown): VideoConfig {
  return asRecord(value) ?? {}
}

function parseVideoFiles(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function unwrapAppConfiguration(value: unknown): AppConfiguration | null {
  const record = asRecord(value)
  if (!record) {
    return null
  }

  const nested = asRecord(record.appConfiguration) ?? asRecord(record.data)
  const source = nested && ('id' in nested || 'videoConfig' in nested || 'video_config' in nested)
    ? nested
    : record

  const id = numberField(source, 'id')
  if (id == null) {
    return null
  }

  return {
    id,
    videoConfig: parseVideoConfig(source.videoConfig ?? source.video_config),
    videoFiles: parseVideoFiles(source.videoFiles ?? source.video_files),
    createdAt: stringField(source, 'createdAt', 'created_at'),
    updatedAt: stringField(source, 'updatedAt', 'updated_at'),
  }
}

function parseAppConfiguration(body: unknown): AppConfiguration | null {
  const direct = unwrapAppConfiguration(body)
  if (direct) {
    return direct
  }

  const outer = asRecord(body)
  if (!outer) {
    return null
  }

  return unwrapAppConfiguration(asRecord(outer.data) ?? asRecord(outer.appConfiguration))
}

function unwrapAppConfigurationList(body: unknown): AppConfiguration[] {
  const outer = asRecord(body)
  const nested = asRecord(outer?.data)
  const candidates = [
    Array.isArray(body) ? body : null,
    Array.isArray(outer?.data) ? outer.data : null,
    Array.isArray(outer?.appConfigurations) ? outer.appConfigurations : null,
    Array.isArray(outer?.configurations) ? outer.configurations : null,
    Array.isArray(nested?.data) ? nested.data : null,
    Array.isArray(nested?.appConfigurations) ? nested.appConfigurations : null,
    Array.isArray(nested?.configurations) ? nested.configurations : null,
  ]

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) {
      continue
    }
    const items = candidate
      .map((item) => unwrapAppConfiguration(item))
      .filter((item): item is AppConfiguration => item != null)
    if (items.length > 0 || candidate.length === 0) {
      return items.sort((a, b) => a.id - b.id)
    }
  }

  const single = parseAppConfiguration(body)
  return single ? [single] : []
}

function fallbackFromPayload(payload: SaveAppConfigurationPayload, id: number): AppConfiguration {
  return {
    id,
    videoConfig: payload.videoConfig ?? {},
    videoFiles: payload.videoFiles ?? [],
    createdAt: null,
    updatedAt: null,
  }
}

export function listAppConfigurations(authToken: string): Promise<AppConfiguration[]> {
  return apiFetch<unknown>('/app-configurations', { authToken }).then(unwrapAppConfigurationList)
}

export function getAppConfiguration(id: number, authToken: string): Promise<AppConfiguration> {
  return apiFetch<unknown>(`/app-configurations/${id}`, { authToken }).then((body) => {
    const configuration = parseAppConfiguration(body)
    if (!configuration) {
      throw new Error('Unable to load app configuration.')
    }
    return configuration
  })
}

export function createAppConfiguration(
  payload: SaveAppConfigurationPayload & { id: number },
  authToken: string,
): Promise<AppConfiguration> {
  return apiFetch<unknown>('/app-configurations', {
    method: 'POST',
    authToken,
    json: payload,
  }).then((body) => parseAppConfiguration(body) ?? fallbackFromPayload(payload, payload.id))
}

export function updateAppConfiguration(
  id: number,
  payload: SaveAppConfigurationPayload,
  authToken: string,
): Promise<AppConfiguration> {
  return apiFetch<unknown>(`/app-configurations/${id}`, {
    method: 'PATCH',
    authToken,
    json: payload,
  }).then(
    (body) => parseAppConfiguration(body) ?? fallbackFromPayload(payload, payload.id ?? id),
  )
}
