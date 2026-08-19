import { apiFetch } from './client'

export interface CheckPhoneResponse {
  exists: boolean
  needsPassword: boolean
}

export interface AccountTeam {
  id: string
  accountId: string
  teamNumber: number
  setPassword: boolean
  isLoginDisabled: boolean
  systemAddress?: string | null
  metadata?: Record<string, unknown> | null
  lastLoginTime?: string | null
  createdAt?: string
  updatedAt?: string
}

export interface AccountTeamsResponse {
  teams: AccountTeam[]
}

export interface Account {
  id: string
  phoneNumber: string
  setPassword?: boolean
  status?: string
  role?: string
  country: string | null
  sanghat: string | null
  jilha: string | null
  taluka: string | null
  group: string | null
  kendra: string | null
  sanchalakName: string | null
  ipAddress?: string | null
  numberOfTeams?: number | null
  numberOfReboot?: number | null
  systemAddress?: string[] | null
  metadata: Record<string, unknown> | null
  lastLoginTime?: string | null
  createdAt: string
  updatedAt: string
  isOffline?: boolean
  isLoginDisabled?: boolean
  logoutButton?: boolean
  appConfiguration?: number | null
  teams?: AccountTeam[]
  domSecurity?: boolean
  chokidar?: boolean
}

export interface LoginResponse {
  account: Account
  token: string
  isOffline?: boolean
}

export interface LoginTokenResponse {
  keys: string[]
}

export const ACCOUNT_ROLE_OPTIONS = [
  { value: 'User', label: 'User' },
  { value: 'Admin', label: 'Admin' },
  { value: 'SuperAdmin', label: 'Super Admin' },
  { value: 'Developer', label: 'Developer' },
] as const

export type AccountRoleValue = (typeof ACCOUNT_ROLE_OPTIONS)[number]['value']

export interface CreateAccountPayload {
  phoneNumber: string
  country?: string
  sanghat?: string
  jilha?: string
  taluka?: string
  group?: string
  kendra?: string
  sanchalakName?: string
  role?: AccountRoleValue
  metadata?: Record<string, unknown>
}

export interface BulkUploadError {
  row: number
  sn: string | null
  country: string | null
  sanghat: string | null
  jilha: string | null
  taluka: string | null
  group: string | null
  kendra: string | null
  sanchalakName: string | null
  phoneNumber: string | null
  error: string
}

export interface BulkUploadResult {
  totalRows: number
  created: number
  failed: number
  errors: BulkUploadError[]
}

export type AccountImportStatus = 'queued' | 'processing' | 'completed' | 'failed'

export interface AccountImportAccepted {
  jobId: string
  status: AccountImportStatus
}

export interface AccountImportJob {
  id: string
  status: AccountImportStatus
  fileName: string
  fileSize: number
  totalRows: number
  createdCount: number
  failedCount: number
  failureMessage: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface AccountImportError {
  id: string
  rowNumber: number
  sn: string | null
  country: string | null
  sanghat: string | null
  jilha: string | null
  taluka: string | null
  group: string | null
  kendra: string | null
  sanchalakName: string | null
  phoneNumber: string | null
  error: string
}

export interface AccountImportErrorsPage {
  data: AccountImportError[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ListAccountsQuery {
  page?: number
  limit?: number
  search?: string
  role?: string
}

export interface PaginatedAccountsResponse {
  data: Account[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface AccountRolesResponse {
  roles: string[]
}

export function checkPhone(phoneNumber: string): Promise<CheckPhoneResponse> {
  return apiFetch<CheckPhoneResponse>('/accounts/check-phone', {
    method: 'POST',
    json: { phoneNumber },
  })
}

function unwrapAccountsList(body: unknown): PaginatedAccountsResponse {
  if (!body || typeof body !== 'object') {
    throw new Error('Unable to load accounts.')
  }

  const outer = body as { data?: unknown; page?: number; limit?: number; total?: number; totalPages?: number }
  const nested =
    outer.data && typeof outer.data === 'object' && !Array.isArray(outer.data)
      ? (outer.data as PaginatedAccountsResponse)
      : null

  const page = nested && Array.isArray(nested.data) ? nested : (outer as PaginatedAccountsResponse)
  if (!Array.isArray(page.data)) {
    throw new Error('Unable to load accounts.')
  }

  return page
}

function unwrapAccountTeams(body: unknown): AccountTeam[] {
  if (Array.isArray(body)) {
    return body as AccountTeam[]
  }

  if (!body || typeof body !== 'object') {
    throw new Error('Unable to load teams.')
  }

  const outer = body as { teams?: unknown; data?: unknown }
  if (Array.isArray(outer.teams)) {
    return outer.teams as AccountTeam[]
  }

  if (Array.isArray(outer.data)) {
    return outer.data as AccountTeam[]
  }

  if (outer.data && typeof outer.data === 'object') {
    const nested = outer.data as { teams?: unknown }
    if (Array.isArray(nested.teams)) {
      return nested.teams as AccountTeam[]
    }
  }

  throw new Error('Unable to load teams.')
}

export function getAccountTeams(
  accountId: string,
  authToken: string,
): Promise<AccountTeam[]> {
  return apiFetch<unknown>(`/accounts/${accountId}/teams`, {
    authToken,
  }).then(unwrapAccountTeams)
}

export interface UpdateAccountTeamPayload {
  setPassword?: boolean
  isLoginDisabled?: boolean
}

function unwrapAccountTeam(body: unknown): AccountTeam | null {
  if (!body || typeof body !== 'object') {
    return null
  }

  const outer = body as { team?: unknown; data?: unknown }
  const candidates = [body, outer.team, outer.data]

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      continue
    }
    if ('id' in candidate && 'teamNumber' in candidate) {
      return candidate as AccountTeam
    }
    const nested = candidate as { team?: unknown }
    if (nested.team && typeof nested.team === 'object' && 'id' in nested.team) {
      return nested.team as AccountTeam
    }
  }

  return null
}

export async function updateAccountTeam(
  accountId: string,
  teamId: string,
  payload: UpdateAccountTeamPayload,
  authToken: string,
): Promise<AccountTeam | null> {
  const data = await apiFetch<unknown>(`/accounts/${accountId}/teams/${teamId}`, {
    method: 'PATCH',
    authToken,
    json: payload,
  })
  return unwrapAccountTeam(data)
}

export function listAccounts(
  query: ListAccountsQuery,
  authToken: string,
): Promise<PaginatedAccountsResponse> {
  const params = new URLSearchParams()
  params.set('page', String(query.page ?? 1))
  params.set('limit', String(query.limit ?? 20))
  if (query.search?.trim()) {
    params.set('search', query.search.trim())
  }
  if (query.role?.trim()) {
    params.set('role', query.role.trim())
  }
  return apiFetch<unknown>(`/accounts?${params.toString()}`, {
    authToken,
  }).then(unwrapAccountsList)
}

export function getAccountRoles(authToken: string): Promise<string[]> {
  return apiFetch<AccountRolesResponse>('/accounts/roles', { authToken }).then(
    (data) => data.roles,
  )
}

export interface UpdateAccountPayload {
  setPassword?: boolean
  isOffline?: boolean
  isLoginDisabled?: boolean
  logoutButton?: boolean
  domSecurity?: boolean
  chokidar?: boolean
  numberOfTeams?: number
  numberOfReboot?: number
  appConfiguration?: number
  status?: string
  role?: AccountRoleValue
  country?: string
  sanghat?: string
  jilha?: string
  taluka?: string
  group?: string
  kendra?: string
  sanchalakName?: string
  password?: string
}

export function createAccount(
  payload: CreateAccountPayload,
  authToken?: string,
): Promise<Account> {
  return apiFetch<Account>('/accounts', {
    method: 'POST',
    authToken,
    json: payload,
  })
}

export function updateAccount(
  accountId: string,
  payload: UpdateAccountPayload,
  authToken: string,
): Promise<Account> {
  return apiFetch<Account>(`/accounts/${accountId}`, {
    method: 'PATCH',
    authToken,
    json: payload,
  })
}

export function bulkUploadAccounts(
  file: File,
  authToken: string,
): Promise<AccountImportAccepted> {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch<AccountImportAccepted>('/accounts/bulk/upload', {
    method: 'POST',
    authToken,
    body: formData,
  })
}

export function getAccountImportJob(
  jobId: string,
  authToken: string,
): Promise<AccountImportJob> {
  return apiFetch<AccountImportJob>(`/accounts/bulk/upload/${jobId}`, {
    authToken,
  })
}

export function getAccountImportErrors(
  jobId: string,
  page: number,
  limit: number,
  authToken: string,
): Promise<AccountImportErrorsPage> {
  return apiFetch<AccountImportErrorsPage>(
    `/accounts/bulk/upload/${jobId}/errors?page=${page}&limit=${limit}`,
    { authToken },
  )
}

export function setPassword(
  phoneNumber: string,
  password: string,
  ipAddress: string,
): Promise<void> {
  return apiFetch<void>('/accounts/set-password', {
    method: 'POST',
    json: { phoneNumber, password, ipAddress },
  })
}

export function login(
  phoneNumber: string,
  password: string,
  ipAddress: string,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/accounts/login', {
    method: 'POST',
    json: { phoneNumber, password, ipAddress },
  })
}

export async function getLoginTokens(authToken: string): Promise<string[]> {
  const data = await apiFetch<LoginTokenResponse>('/accounts/login-token', {
    authToken,
  })
  return data.keys
}
