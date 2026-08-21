import { apiFetch } from './client'

export type BulkFlagJobStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface SanghatFlagError {
  phoneNumber: string | null
  kendra: string | null
  sanghat: string | null
  teamNumber: number | null
  fields: string[]
  error: string
}

export interface UpdateSanghatFlagsPayload {
  sanghat?: string
  all?: boolean
  logoutButton?: boolean
  appConfiguration?: number
  numberOfReboot?: number
  isOffline?: boolean
  isLoginDisabled?: boolean
  reason?: string
  setPassword?: true
}

export interface SanghatFlagsSyncResult {
  sanghat: string
  all: false
  usersChanged: number
  teamsChanged: number
  errors: SanghatFlagError[]
}

export interface BulkFlagJobAccepted {
  jobId: string
  status: BulkFlagJobStatus
}

export type UpdateSanghatFlagsResult = SanghatFlagsSyncResult | BulkFlagJobAccepted

export interface BulkFlagJob {
  id: string
  status: BulkFlagJobStatus
  flags: Record<string, unknown>
  usersChanged: number
  teamsChanged: number
  errorCount: number
  failureMessage: string | null
  requestedBy: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface BulkFlagJobError extends SanghatFlagError {
  id: string
  jobId: string
  createdAt: string
}

export interface BulkFlagJobErrorsPage {
  data: BulkFlagJobError[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ListBulkFlagJobsQuery {
  page?: number
  limit?: number
  status?: BulkFlagJobStatus
}

export interface PaginatedBulkFlagJobsResponse {
  data: BulkFlagJob[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export function isBulkFlagJobAccepted(
  result: UpdateSanghatFlagsResult,
): result is BulkFlagJobAccepted {
  return 'jobId' in result && typeof result.jobId === 'string'
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function unwrapRecord(body: unknown): Record<string, unknown> {
  const outer = asRecord(body)
  if (!outer) {
    throw new Error('Unexpected API response.')
  }

  const nested = asRecord(outer.data)
  return nested ?? outer
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
}

function unwrapSanghats(body: unknown): string[] {
  const record = unwrapRecord(body)
  const candidates = [record.sanghats, record.data, asRecord(body)?.sanghats]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return stringList(candidate)
    }
  }
  throw new Error('Unable to load sanghats.')
}

function unwrapFlagError(value: unknown): SanghatFlagError | null {
  const record = asRecord(value)
  if (!record) {
    return null
  }

  return {
    phoneNumber: typeof record.phoneNumber === 'string' ? record.phoneNumber : null,
    kendra: typeof record.kendra === 'string' ? record.kendra : null,
    sanghat: typeof record.sanghat === 'string' ? record.sanghat : null,
    teamNumber: typeof record.teamNumber === 'number' ? record.teamNumber : null,
    fields: stringList(record.fields),
    error: typeof record.error === 'string' ? record.error : 'Unknown error',
  }
}

function unwrapSyncResult(record: Record<string, unknown>): SanghatFlagsSyncResult {
  const errors = Array.isArray(record.errors)
    ? record.errors.map(unwrapFlagError).filter((item): item is SanghatFlagError => item != null)
    : []

  return {
    sanghat: typeof record.sanghat === 'string' ? record.sanghat : '',
    all: false,
    usersChanged: Number(record.usersChanged ?? 0) || 0,
    teamsChanged: Number(record.teamsChanged ?? 0) || 0,
    errors,
  }
}

function unwrapUpdateResult(body: unknown): UpdateSanghatFlagsResult {
  const record = unwrapRecord(body)
  if (typeof record.jobId === 'string' && record.jobId.trim()) {
    const status = record.status
    return {
      jobId: record.jobId,
      status:
        status === 'queued' || status === 'processing' || status === 'completed' || status === 'failed'
          ? status
          : 'queued',
    }
  }
  return unwrapSyncResult(record)
}

function unwrapJob(body: unknown): BulkFlagJob {
  const record = unwrapRecord(body)
  const nestedJob = asRecord(record.job)
  const job = nestedJob ?? record
  const id = typeof job.id === 'string' ? job.id : typeof job.jobId === 'string' ? job.jobId : ''
  if (!id) {
    throw new Error('Unable to load the bulk flags job.')
  }

  const status = job.status
  return {
    id,
    status:
      status === 'queued' || status === 'processing' || status === 'completed' || status === 'failed'
        ? status
        : 'queued',
    flags: asRecord(job.flags) ?? {},
    usersChanged: Number(job.usersChanged ?? 0) || 0,
    teamsChanged: Number(job.teamsChanged ?? 0) || 0,
    errorCount: Number(job.errorCount ?? 0) || 0,
    failureMessage: typeof job.failureMessage === 'string' ? job.failureMessage : null,
    requestedBy: typeof job.requestedBy === 'string' ? job.requestedBy : null,
    startedAt: typeof job.startedAt === 'string' ? job.startedAt : null,
    completedAt: typeof job.completedAt === 'string' ? job.completedAt : null,
    createdAt: typeof job.createdAt === 'string' ? job.createdAt : '',
    updatedAt: typeof job.updatedAt === 'string' ? job.updatedAt : '',
  }
}

function unwrapJobsPage(body: unknown): PaginatedBulkFlagJobsResponse {
  const outer = asRecord(body)
  if (!outer) {
    throw new Error('Unable to load bulk flags jobs.')
  }

  const nested = asRecord(outer.data)
  const page = nested && Array.isArray(nested.data) ? nested : outer
  if (!Array.isArray(page.data)) {
    throw new Error('Unable to load bulk flags jobs.')
  }

  return {
    data: page.data.map((item) => unwrapJob(item)),
    page: Number(page.page ?? 1) || 1,
    limit: Number(page.limit ?? 20) || 20,
    total: Number(page.total ?? page.data.length) || 0,
    totalPages: Math.max(1, Number(page.totalPages ?? 1) || 1),
  }
}

function unwrapJobError(value: unknown): BulkFlagJobError | null {
  const base = unwrapFlagError(value)
  const record = asRecord(value)
  if (!base || !record || typeof record.id !== 'string') {
    return null
  }

  return {
    ...base,
    id: record.id,
    jobId: typeof record.jobId === 'string' ? record.jobId : '',
    createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
  }
}

function unwrapJobErrorsPage(body: unknown): BulkFlagJobErrorsPage {
  const outer = asRecord(body)
  if (!outer) {
    throw new Error('Unable to load job errors.')
  }

  const nested = asRecord(outer.data)
  const page = nested && Array.isArray(nested.data) ? nested : outer
  if (!Array.isArray(page.data)) {
    throw new Error('Unable to load job errors.')
  }

  return {
    data: page.data.map(unwrapJobError).filter((item): item is BulkFlagJobError => item != null),
    page: Number(page.page ?? 1) || 1,
    limit: Number(page.limit ?? 100) || 100,
    total: Number(page.total ?? page.data.length) || 0,
    totalPages: Math.max(1, Number(page.totalPages ?? 1) || 1),
  }
}

export function listSanghats(authToken: string): Promise<string[]> {
  return apiFetch<unknown>('/accounts/sanghats', { authToken }).then(unwrapSanghats)
}

export function updateSanghatFlags(
  payload: UpdateSanghatFlagsPayload,
  authToken: string,
): Promise<UpdateSanghatFlagsResult> {
  return apiFetch<unknown>('/accounts/sanghats/flags', {
    method: 'PATCH',
    authToken,
    json: payload,
  }).then(unwrapUpdateResult)
}

export function getBulkFlagJob(jobId: string, authToken: string): Promise<BulkFlagJob> {
  return apiFetch<unknown>(`/accounts/sanghats/flags/jobs/${jobId}`, { authToken }).then(unwrapJob)
}

export function getBulkFlagJobErrors(
  jobId: string,
  page: number,
  limit: number,
  authToken: string,
): Promise<BulkFlagJobErrorsPage> {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('limit', String(limit))
  return apiFetch<unknown>(
    `/accounts/sanghats/flags/jobs/${jobId}/errors?${params.toString()}`,
    { authToken },
  ).then(unwrapJobErrorsPage)
}

export function listBulkFlagJobs(
  query: ListBulkFlagJobsQuery,
  authToken: string,
): Promise<PaginatedBulkFlagJobsResponse> {
  const params = new URLSearchParams()
  params.set('page', String(query.page ?? 1))
  params.set('limit', String(query.limit ?? 20))
  if (query.status) {
    params.set('status', query.status)
  }
  return apiFetch<unknown>(`/accounts/sanghats/flags/jobs?${params.toString()}`, {
    authToken,
  }).then(unwrapJobsPage)
}

export async function findActiveBulkFlagJob(authToken: string): Promise<BulkFlagJob | null> {
  for (const status of ['queued', 'processing'] as const) {
    const page = await listBulkFlagJobs({ page: 1, limit: 1, status }, authToken)
    if (page.data[0]) {
      return page.data[0]
    }
  }
  return null
}
