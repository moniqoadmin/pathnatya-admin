import { useEffect, useState, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getAccountRoles, listAccounts, type Account } from '../api/accounts'
import AccountDetails from '../components/AccountDetails'
import {
  canEditAccount,
  canEditPrivilegedAccountFields,
  canViewAccountLogs,
  isSuperAdmin,
} from '../lib/roles'
import { getAccount, getToken } from '../lib/session'

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 350

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

function parsePage(value: string | null): number {
  const page = Number(value)
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
}

function loggedInTeamCount(account: Account): number {
  return account.teams?.length ?? 0
}

function latestLoginTime(account: Account): string | null {
  if (account.lastLoginTime) {
    return account.lastLoginTime
  }

  const times = (account.teams ?? [])
    .map((team) => team.lastLoginTime)
    .filter((value): value is string => Boolean(value))

  if (times.length === 0) {
    return null
  }

  return times.reduce((latest, time) =>
    new Date(time).getTime() > new Date(latest).getTime() ? time : latest,
  )
}

function accountStatus(account: Account): { label: string; className: string } {
  if (account.status) {
    return { label: account.status, className: `status-${account.status}` }
  }
  if (account.isOffline) {
    return { label: 'Offline', className: 'status-inactive' }
  }
  return { label: 'Online', className: 'status-active' }
}

export default function ListUsersPage() {
  const account = getAccount()
  const canFilterRoles = isSuperAdmin(account?.role)
  const canEdit = canEditAccount(account?.role)
  const canEditPrivileged = canEditPrivilegedAccountFields(account?.role)
  const canViewLogs = canViewAccountLogs(account?.role)
  const [searchParams, setSearchParams] = useSearchParams()

  const page = parsePage(searchParams.get('page'))
  const search = searchParams.get('search') ?? ''
  const role = canFilterRoles ? (searchParams.get('role') ?? 'User') : ''

  const [searchInput, setSearchInput] = useState(search)
  const [roles, setRoles] = useState<string[]>([])
  const [rows, setRows] = useState<Account[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!canFilterRoles) {
      return
    }
    if (searchParams.get('role')) {
      return
    }
    const next = new URLSearchParams(searchParams)
    next.set('role', 'User')
    if (!next.get('page')) {
      next.set('page', '1')
    }
    setSearchParams(next, { replace: true })
  }, [canFilterRoles, searchParams, setSearchParams])

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const nextSearch = searchInput.trim()
      const currentSearch = search.trim()
      if (nextSearch === currentSearch) {
        return
      }

      const next = new URLSearchParams(searchParams)
      if (nextSearch) {
        next.set('search', nextSearch)
      } else {
        next.delete('search')
      }
      next.set('page', '1')
      setSearchParams(next, { replace: true })
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(handle)
  }, [searchInput, search, searchParams, setSearchParams])

  useEffect(() => {
    if (!canFilterRoles) {
      return
    }

    const token = getToken()
    if (!token) {
      return
    }

    let cancelled = false
    void getAccountRoles(token)
      .then((nextRoles) => {
        if (!cancelled) {
          setRoles(nextRoles)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoles(['User', 'Admin', 'SuperAdmin', 'Developer'])
        }
      })

    return () => {
      cancelled = true
    }
  }, [canFilterRoles])

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

    void listAccounts(
      {
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        role: canFilterRoles ? role || undefined : undefined,
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
            : 'Unable to load accounts. Please try again.',
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
  }, [page, search, role, canFilterRoles, reloadKey])

  function updateParams(mutate: (params: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams)
    mutate(next)
    setSearchParams(next, { replace: true })
  }

  function handleRoleSelect(nextRole: string) {
    updateParams((params) => {
      params.set('role', nextRole)
      params.set('page', '1')
    })
  }

  function handlePageChange(nextPage: number) {
    updateParams((params) => {
      params.set('page', String(nextPage))
    })
  }

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  function openDetails(row: Account) {
    setStatus('')
    setSelectedAccount(row)
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLTableRowElement>,
    row: Account,
  ) {
    if (event.target instanceof HTMLElement && event.target.closest('button')) {
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDetails(row)
    }
  }

  if (selectedAccount) {
    return (
      <AccountDetails
        account={selectedAccount}
        canEdit={canEdit}
        canEditPrivileged={canEditPrivileged}
        canViewLogs={canViewLogs}
        onBack={() => setSelectedAccount(null)}
        onUpdated={(updated, message) => {
          setSelectedAccount(updated)
          setRows((current) =>
            current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
          )
          if (message) {
            setStatus(message)
          }
        }}
      />
    )
  }

  return (
    <div className="page-panel users-page">
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">Users</p>
          <h1>List Users</h1>
          <p className="page-subtitle">
            Search and browse registered accounts
            {canFilterRoles ? ' by role' : ''}.
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={() => setReloadKey((current) => current + 1)}
          >
            {loading ? 'Loading...' : 'Reload'}
          </button>
        </div>
      </div>

      <div className="users-toolbar">
        <label className="users-search" htmlFor="users-search">
          <span className="users-search-label">Search</span>
          <input
            id="users-search"
            type="search"
            placeholder="Phone number or kendra"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>

        {canFilterRoles && (
          <div className="role-filters" aria-label="Filter by role">
            {roles.map((item) => (
              <button
                key={item}
                type="button"
                className={`role-filter-tag${role === item ? ' is-active' : ''}`}
                onClick={() => handleRoleSelect(item)}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
      {status && <p className="form-success">{status}</p>}

      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th>Phone</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Sanghat</th>
              <th>Jilha</th>
              <th>Kendra</th>
              <th>Teams</th>
              <th>Logged in</th>
              <th>Last login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="users-table-empty">
                  Loading accounts...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="users-table-empty">
                  No accounts found.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const status = accountStatus(row)
                return (
                  <tr
                    key={row.id}
                    className="is-clickable"
                    tabIndex={0}
                    onClick={() => openDetails(row)}
                    onKeyDown={(event) => handleRowKeyDown(event, row)}
                  >
                    <td>{formatValue(row.phoneNumber)}</td>
                    <td>{formatValue(row.sanchalakName)}</td>
                    <td>{formatValue(row.role)}</td>
                    <td>
                      <span className={`status-pill ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                    <td>{formatValue(row.sanghat)}</td>
                    <td>{formatValue(row.jilha)}</td>
                    <td>{formatValue(row.kendra)}</td>
                    <td>{formatValue(row.numberOfTeams)}</td>
                    <td>{loggedInTeamCount(row)}</td>
                    <td>{formatDate(latestLoginTime(row))}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        onClick={(event) => {
                          event.stopPropagation()
                          openDetails(row)
                        }}
                      >
                        Go to
                      </button>
                    </td>
                  </tr>
                )
              })
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
