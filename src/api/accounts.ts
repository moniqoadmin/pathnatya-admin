import { apiFetch } from './client'

export interface CheckPhoneResponse {
  exists: boolean
  needsPassword: boolean
}

export interface Account {
  id: string
  phoneNumber: string
  setPassword: boolean
  status: string
  role?: string
  country: string | null
  sanghat: string | null
  jilha: string | null
  taluka: string | null
  group: string | null
  kendra: string | null
  sanchalakName: string | null
  ipAddress: string | null
  numberOfTeams?: number | null
  systemAddress?: string[] | null
  metadata: Record<string, unknown> | null
  lastLoginTime: string | null
  createdAt: string
  updatedAt: string
  isOffline?: boolean
  isLoginDisabled?: boolean
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
  return apiFetch<PaginatedAccountsResponse>(`/accounts?${params.toString()}`, {
    authToken,
  })
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
  domSecurity?: boolean
  chokidar?: boolean
  numberOfTeams?: number
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
): Promise<BulkUploadResult> {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch<BulkUploadResult>('/accounts/bulk/upload', {
    method: 'POST',
    authToken,
    body: formData,
  })
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
