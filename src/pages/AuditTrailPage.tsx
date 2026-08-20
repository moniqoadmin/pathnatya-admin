import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listAuditTrail, type AuditTrailEvent } from '../api/audit-trail'
import { getToken } from '../lib/session'

const PAGE_SIZE = 20

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

function formatEvent(value: string | null | undefined): string {
  if (!value || !value.trim()) {
    return '—'
  }
  return value.replace(/_/g, ' ')
}

function parsePage(value: string | null): number {
  const page = Number(value)
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
}

function TruncatedMessage({ message }: { message: string | null | undefined }) {
  const full = formatValue(message)

  return (
    <span className="audit-message" title={full !== '—' ? full : undefined}>
      {full}
    </span>
  )
}

export default function AuditTrailPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))

  const [rows, setRows] = useState<AuditTrailEvent[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

    void listAuditTrail({ page, limit: PAGE_SIZE }, token)
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
            : 'Unable to load audit trail. Please try again.',
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
  }, [page])

  function handlePageChange(nextPage: number) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(nextPage))
    setSearchParams(next, { replace: true })
  }

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="page-panel audit-trail-page">
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">Activity</p>
          <h1>Audit Trail</h1>
          <p className="page-subtitle">
            Review account changes and admin actions across Pathnatya.
          </p>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="users-table-wrap">
        <table className="users-table audit-trail-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Name</th>
              <th>Kendra</th>
              <th>Event</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="users-table-empty">
                  Loading audit trail...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="users-table-empty">
                  No audit events found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>{formatValue(row.name)}</td>
                  <td>{formatValue(row.kendra)}</td>
                  <td>
                    <span className="status-pill">{formatEvent(row.event)}</span>
                  </td>
                  <td className="audit-message-cell">
                    <TruncatedMessage message={row.message} />
                  </td>
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
    </div>
  )
}
