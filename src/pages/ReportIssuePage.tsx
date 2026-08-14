import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { listIssues, type Issue } from '../api/issues'
import ReportIssueDialog from '../components/ReportIssueDialog'
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

export default function ReportIssuePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))

  const [rows, setRows] = useState<Issue[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [showReport, setShowReport] = useState(false)
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

    void listIssues({ page, limit: PAGE_SIZE }, token)
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
  }, [page, reloadKey])

  function handlePageChange(nextPage: number) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(nextPage))
    setSearchParams(next, { replace: true })
  }

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="page-panel users-page">
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">Issues</p>
          <h1>Report Issue</h1>
          <p className="page-subtitle">Submit a new issue and review previously reported ones.</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setStatus('')
              setShowReport(true)
            }}
          >
            Report issue
          </button>
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="users-table-empty">
                  Loading issues...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="users-table-empty">
                  No issues reported yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatValue(row.phoneNumber)}</td>
                  <td>{formatIssueNumbers(row.issueNumbers)}</td>
                  <td className="issues-message-cell">{formatValue(row.message)}</td>
                  <td>
                    <span className={`status-pill status-${row.status || 'unknown'}`}>
                      {formatValue(row.status).replaceAll('_', ' ')}
                    </span>
                  </td>
                  <td>{formatDate(row.createdAt)}</td>
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

      {showReport && (
        <ReportIssueDialog
          onClose={() => setShowReport(false)}
          onCreated={(text) => {
            setShowReport(false)
            setStatus(text)
            setReloadKey((current) => current + 1)
            handlePageChange(1)
          }}
        />
      )}
    </div>
  )
}
