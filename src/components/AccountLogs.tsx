import { useEffect, useState } from 'react'
import { listAccountLogs, type Account, type AccountLog } from '../api/accounts'
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

function formatMeta(meta: Record<string, unknown> | null | undefined): string {
  if (!meta || Object.keys(meta).length === 0) {
    return '—'
  }
  return JSON.stringify(meta)
}

interface AccountLogsProps {
  account: Account
  onBack: () => void
}

export default function AccountLogs({ account, onBack }: AccountLogsProps) {
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AccountLog[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const title = account.sanchalakName?.trim() || account.phoneNumber

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

    void listAccountLogs(account.id, { page, limit: PAGE_SIZE }, token)
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
            : 'Unable to load account logs. Please try again.',
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
  }, [account.id, page])

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="page-panel users-page account-logs-page">
      <div className="page-header">
        <div className="page-header-copy">
          <button type="button" className="btn btn-secondary btn-compact" onClick={onBack}>
            Back
          </button>
          <p className="eyebrow">Account</p>
          <h1>Logs</h1>
          <p className="page-subtitle">
            {title}
            {account.sanchalakName?.trim() ? ` · ${account.phoneNumber}` : ''}
          </p>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="users-pagination">
        <p className="users-pagination-meta">
          {loading ? 'Loading...' : `Showing ${from}-${to} of ${total}`}
        </p>
        <div className="users-pagination-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading || page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
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
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      </div>

      <div className="users-table-wrap">
        <table className="users-table account-logs-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Team</th>
              <th>Tampered</th>
              <th>IP</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="users-table-empty">
                  Loading logs...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="users-table-empty">
                  No logs found.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const meta = formatMeta(row.meta)
                return (
                  <tr key={row.logId}>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>
                      <span className="status-pill">{formatEvent(row.event)}</span>
                    </td>
                    <td>{formatValue(row.teamNumber)}</td>
                    <td>
                      <span
                        className={`status-pill ${row.tampered ? 'status-inactive' : 'status-active'}`}
                      >
                        {row.tampered ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>{formatValue(row.ipAddress)}</td>
                    <td className="audit-message-cell">
                      <span className="audit-message" title={meta !== '—' ? meta : undefined}>
                        {meta}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
