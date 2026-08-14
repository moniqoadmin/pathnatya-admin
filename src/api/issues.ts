import { apiFetch } from './client'

export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface IssueComment {
  accountId: string
  phoneNumber: string
  message: string
  createdAt: string
}

export interface Issue {
  id: string
  phoneNumber: string
  accountId: string
  reportedBy: string
  message: string
  issueNumbers: number[]
  status: IssueStatus
  resolution: string | null
  resolutionMessage: string | null
  comments: IssueComment[]
  resolvedBy: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateIssuePayload {
  phoneNumber: string
  message: string
  issueNumbers: number[]
}

export interface ListIssuesQuery {
  page?: number
  limit?: number
  status?: IssueStatus
}

export interface PaginatedIssuesResponse {
  data: Issue[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export function createIssue(payload: CreateIssuePayload, authToken: string): Promise<Issue> {
  return apiFetch<Issue>('/issues', {
    method: 'POST',
    authToken,
    json: payload,
  })
}

export const ISSUE_STATUS_META: Record<
  IssueStatus,
  { label: string; description: string }
> = {
  open: { label: 'Open', description: 'Newly created (default)' },
  in_progress: { label: 'In progress', description: 'Being worked on' },
  resolved: { label: 'Resolved', description: 'Fixed' },
  closed: {
    label: 'Closed',
    description: 'Closed without treating it as a fix, or after wrap-up',
  },
}

export const RESOLVE_STATUS_OPTIONS = ['resolved', 'closed'] as const

export type ResolveIssueStatus = (typeof RESOLVE_STATUS_OPTIONS)[number]

export interface ResolveIssuePayload {
  resolution: string
  resolutionMessage: string
  status?: ResolveIssueStatus
}

export function listIssues(query: ListIssuesQuery, authToken: string): Promise<PaginatedIssuesResponse> {
  const params = new URLSearchParams()
  params.set('page', String(query.page ?? 1))
  params.set('limit', String(query.limit ?? 20))
  return apiFetch<PaginatedIssuesResponse>(`/issues?${params.toString()}`, {
    authToken,
  })
}

export function listPendingIssues(
  query: ListIssuesQuery,
  authToken: string,
): Promise<PaginatedIssuesResponse> {
  const params = new URLSearchParams()
  params.set('page', String(query.page ?? 1))
  params.set('limit', String(query.limit ?? 20))
  if (query.status) {
    params.set('status', query.status)
  }
  return apiFetch<PaginatedIssuesResponse>(`/issues/pending?${params.toString()}`, {
    authToken,
  })
}

export function getIssue(id: string, authToken: string): Promise<Issue> {
  return apiFetch<Issue>(`/issues/${id}`, { authToken })
}

export function addIssueComment(
  id: string,
  message: string,
  authToken: string,
): Promise<Issue> {
  return apiFetch<Issue>(`/issues/${id}/comments`, {
    method: 'POST',
    authToken,
    json: { message },
  })
}

export function updateIssueStatus(
  id: string,
  status: Extract<IssueStatus, 'in_progress'>,
  authToken: string,
): Promise<Issue> {
  return apiFetch<Issue>(`/issues/${id}/status`, {
    method: 'PATCH',
    authToken,
    json: { status },
  })
}

export function resolveIssue(
  id: string,
  payload: ResolveIssuePayload,
  authToken: string,
): Promise<Issue> {
  return apiFetch<Issue>(`/issues/${id}/resolve`, {
    method: 'PATCH',
    authToken,
    json: payload,
  })
}
