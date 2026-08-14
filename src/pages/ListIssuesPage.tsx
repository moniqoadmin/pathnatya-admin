import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ISSUE_STATUS_META, listPendingIssues, type Issue, type IssueStatus } from '../api/issues'
import IssueDetailDialog from '../components/IssueDetailDialog'
import { canResolveIssues } from '../lib/roles'
import { getAccount, getToken } from '../lib/session'

const PAGE_SIZE = 20
const STATUS_ORDER: IssueStatus[] = ['open', 'in_progress', 'resolved', 'closed']
const STATUS_FILTERS = ['all', ...STATUS_ORDER] as const

type StatusFilter = (typeof STATUS_FILTERS)[number]

function formatValue(value: string | number | null | undefined): string {
  if (value == null || String(value).trim() === '') {
    return '—'
  }
  return String(value)
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

function formatIssueNumbers(values: number[] | null | undefined): string {
  if (!values || values.length === 0) {
    return '—'
  }
  return values.join(', ')
}

function parsePage(value: string | null): number {
  const page = Number(value)
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
}

function parseStatusFilter(value: string | null): StatusFilter {
  if (value && STATUS_FILTERS.includes(value as StatusFilter)) {
    return value as StatusFilter
  }
  return 'all'
}

function statusLabel(status: string | null | undefined): string {
  if (!status) {
    return 'Unknown'
  }
  return ISSUE_STATUS_META[status as IssueStatus]?.label ?? status.replaceAll('_', ' ')
}

function filterLabel(filter: StatusFilter): string {
  if (filter === 'all') {
    return 'All'
  }
  return ISSUE_STATUS_META[filter].label
}

export default function ListIssuesPage() {
  const account = getAccount()
  const canManage = canResolveIssues(account?.role)
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const statusFilter = parseStatusFilter(searchParams.get('status'))

  const [rows, setRows] = useState<Issue[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    void listPendingIssues(
      {
        page,
        limit: PAGE_SIZE,
        status: statusFilter === 'all' ? undefined : statusFilter,
      },
      token,
    )
      .then((response) => {
        if (cancelled) {
          return
        }
        setRows(response.data)
        setTotal(response.total)
        setTotalPages(Math.max(1, response.totalPages || 1))
      })
      .catch((err) => {
        if (cancelled) {
          return
        }
        setRows([])
        setTotal(0)
        setTotalPages(1)
        setError(
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : 'Unable to load issues. Please try again.',
        )
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [page, statusFilter, reloadKey])

  function updateParams(mutate: (params: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams)
    mutate(next)
    setSearchParams(next, { replace: true })
  }

  function handleStatusFilter(nextFilter: StatusFilter) {
    updateParams((params) => {
      if (nextFilter === 'all') {
        params.delete('status')
      } else {
        params.set('status', nextFilter)
      }
      params.set('page', '1')
    })
  }

  function handlePageChange(nextPage: number) {
    updateParams((params) => {
      params.set('page', String(nextPage))
    })
  }

  function applyUpdatedIssue(updated: Issue) {
    const matchesFilter = statusFilter === 'all' || updated.status === statusFilter
    if (!matchesFilter) {
      setRows((current) => current.filter((row) => row.id !== updated.id))
      setTotal((current) => Math.max(0, current - 1))
      setReloadKey((current) => current + 1)
      return
    }

    setRows((current) =>
      current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
    )
  }

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)
  const columnCount = canManage ? 6 : 5
  const emptyLabel =
    statusFilter === 'all'
      ? 'No issues found.'
      : `No ${ISSUE_STATUS_META[statusFilter].label.toLowerCase()} issues.`

  return (
    <div className="page-panel users-page">
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">Issues</p>
          <h1>List Issues</h1>
          <p className="page-subtitle">
            Filter by status, open an issue, and mark it in progress, resolved, or closed.
          </p>
        </div>
      </div>

      <div className="users-toolbar">
        <div className="role-filters" aria-label="Filter by status">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={`role-filter-tag${statusFilter === item ? ' is-active' : ''}`}
              onClick={() => handleStatusFilter(item)}
            >
              {filterLabel(item)}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {status && <p className="form-success">{status}</p>}

      <div className="users-table-wrap">
        <table className="users-table issues-table">
          <thead>
            <tr>
              <th>Phone</th>
              <th>Issue numbers</th>
              <th>Message</th>
              <th>Status</th>
              <th>Reported</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columnCount} className="users-table-empty">
                  Loading issues...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="users-table-empty">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatValue(row.phoneNumber)}</td>
                  <td>{formatIssueNumbers(row.issueNumbers)}</td>
                  <td className="issues-message-cell">{formatValue(row.message)}</td>
                  <td>
                    <span
                      className={`status-pill status-${row.status || 'unknown'}`}
                      title={ISSUE_STATUS_META[row.status]?.description}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td>{formatDate(row.createdAt)}</td>
                  {canManage && (
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        onClick={() => {
                          setStatus('')
                          setSelectedIssueId(row.id)
                        }}
                      >
                        Open
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="users-pagination">
        <p className="users-pagination-meta">
          {loading ? 'Loading...' : `Showing ${from}-${to} of ${total}`}
        </p>
        <div className="users-pagination-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading || page <= 1}
            onClick={() => handlePageChange(page - 1)}
          >
            Previous
          </button>
          <span className="users-page-indicator">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading || page >= totalPages}
            onClick={() => handlePageChange(page + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {selectedIssueId && canManage && (
        <IssueDetailDialog
          issueId={selectedIssueId}
          onClose={() => setSelectedIssueId(null)}
          onUpdated={(updated) => {
            applyUpdatedIssue(updated)
          }}
          onResolved={(updated, message) => {
            setSelectedIssueId(null)
            setStatus(message)
            applyUpdatedIssue(updated)
          }}
        />
      )}
    </div>
  )
}
