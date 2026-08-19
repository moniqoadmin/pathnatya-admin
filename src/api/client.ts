import { clearSession } from '../lib/session'
import { APP_KEY, API_BASE } from './config'
import { decryptPayload, encryptPayload } from './payload-crypto'

export type ApiFetchOptions = RequestInit & {
  json?: unknown
  authToken?: string
}

export type ApiError = Error & {
  status?: number
  data?: unknown
  retryAfterSeconds?: number
}

function errorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const message = (data as { message: unknown }).message
    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }
  return fallback
}

function withAdminParam(path: string): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}admin=true`
}

function handleUnauthorized(): void {
  clearSession()
  const path = window.location.pathname
  if (path === '/login' || path.startsWith('/login/') || path === '/set-password' || path === '/download') {
    return
  }
  window.location.assign('/login')
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { json, authToken, headers: initHeaders, body: initBody, ...rest } = options
  const headers = new Headers(initHeaders)
  headers.set('X-App-Key', APP_KEY)

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }

  let body = initBody
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify({ payload: await encryptPayload(json) })
  }

  const res = await fetch(`${API_BASE}${withAdminParam(path)}`, { ...rest, headers, body })

  if (res.status === 401) {
    handleUnauthorized()
    throw Object.assign(new Error('Session expired. Please log in again.'), {
      status: 401,
    })
  }

  if (res.status === 204) {
    return undefined as T
  }

  const envelope = await res.json()
  const data = await readResponseBody<T>(envelope)
  if (!res.ok) {
    const retryAfterHeader = Number(res.headers.get('Retry-After'))
    const retryAfterBody =
      data && typeof data === 'object' && 'retryAfterSeconds' in data
        ? Number((data as { retryAfterSeconds: unknown }).retryAfterSeconds)
        : 0
    throw Object.assign(new Error(errorMessage(data, 'API error')), {
      status: res.status,
      data,
      retryAfterSeconds:
        retryAfterHeader > 0 ? retryAfterHeader : retryAfterBody || undefined,
    })
  }

  return data
}

async function readResponseBody<T>(envelope: unknown): Promise<T> {
  if (envelope && typeof envelope === 'object' && 'payload' in envelope) {
    const payload = (envelope as { payload: unknown }).payload
    if (typeof payload === 'string' && payload) {
      const decrypted = await decryptPayload<unknown>(payload)
      if (typeof decrypted === 'string') {
        try {
          return JSON.parse(decrypted) as T
        } catch {
          return decrypted as T
        }
      }
      return decrypted as T
    }
  }

  if (envelope && typeof envelope === 'object') {
    return envelope as T
  }

  throw new Error('Expected encrypted payload response')
}
