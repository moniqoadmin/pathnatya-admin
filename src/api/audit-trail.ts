import { apiFetch } from './client'

export interface AuditTrailEvent {
  id: string
  accountId: string
  name: string | null
  targetAccountId: string | null
  kendra: string | null
  event: string
  message: string | null
  createdAt: string
  metaData: Record<string, unknown> | null
}

export interface ListAuditTrailQuery {
  page?: number
  limit?: number
}

export interface PaginatedAuditTrailResponse {
  data: AuditTrailEvent[]
  page: number
  limit: number
  total: number
  totalPages: number
}

function unwrapAuditTrailList(body: unknown): PaginatedAuditTrailResponse {
  if (!body || typeof body !== 'object') {
    throw new Error('Unable to load audit trail.')
  }

  const outer = body as {
    data?: unknown
    page?: number
    limit?: number
    total?: number
    totalPages?: number
  }
  const nested =
    outer.data && typeof outer.data === 'object' && !Array.isArray(outer.data)
      ? (outer.data as PaginatedAuditTrailResponse)
      : null

  const page = nested && Array.isArray(nested.data) ? nested : (outer as PaginatedAuditTrailResponse)
  if (!Array.isArray(page.data)) {
    throw new Error('Unable to load audit trail.')
  }

  return {
    data: page.data,
    page: page.page ?? 1,
    limit: page.limit ?? 20,
    total: page.total ?? page.data.length,
    totalPages: page.totalPages ?? 1,
  }
}

export function listAuditTrail(
  query: ListAuditTrailQuery,
  authToken: string,
): Promise<PaginatedAuditTrailResponse> {
  const params = new URLSearchParams()
  params.set('page', String(query.page ?? 1))
  params.set('limit', String(query.limit ?? 20))
  return apiFetch<unknown>(`/audit-trail?${params.toString()}`, {
    authToken,
  }).then(unwrapAuditTrailList)
}
