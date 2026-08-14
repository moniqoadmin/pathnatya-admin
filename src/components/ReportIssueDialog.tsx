import { type FormEvent, useEffect, useState } from 'react'
import { listAccounts, type Account } from '../api/accounts'
import { createIssue } from '../api/issues'
import { ERROR_CODES } from '../lib/error-codes'
import { getToken } from '../lib/session'
import Modal from './Modal'

const SEARCH_DEBOUNCE_MS = 350
const SEARCH_PAGE_SIZE = 8

interface ReportIssueDialogProps {
  onClose: () => void
  onCreated: (message: string) => void
}

function formatValue(value: string | number | null | undefined): string {
  if (value == null || String(value).trim() === '') {
    return '—'
  }
  return String(value)
}

function AccountSummary({ account, expanded }: { account: Account; expanded: boolean }) {
  return (
    <div className="report-account-summary">
      <span className="report-account-phone">{formatValue(account.phoneNumber)}</span>
      <span className="report-account-meta">
        {formatValue(account.sanchalakName)} · {formatValue(account.kendra)}
      </span>
      {expanded && (
        <span className="report-account-meta">
          {formatValue(account.role)} · {formatValue(account.sanghat)} · {formatValue(account.jilha)}
        </span>
      )}
    </div>
  )
}

export default function ReportIssueDialog({ onClose, onCreated }: ReportIssueDialogProps) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Account[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selected, setSelected] = useState<Account | null>(null)
  const [issueNumbers, setIssueNumbers] = useState<number[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(handle)
  }, [searchInput])

  useEffect(() => {
    if (selected) {
      return
    }

    if (!search) {
      setResults([])
      setSearchError('')
      setSearching(false)
      return
    }

    const token = getToken()
    if (!token) {
      setSearchError('Your session expired. Please log in again.')
      setResults([])
      return
    }

    let cancelled = false
    setSearching(true)
    setSearchError('')

    void listAccounts({ page: 1, limit: SEARCH_PAGE_SIZE, search }, token)
      .then((response) => {
        if (cancelled) {
          return
        }
        setResults(response.data)
      })
      .catch((err) => {
        if (cancelled) {
          return
        }
        setResults([])
        setSearchError(
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : 'Unable to search accounts. Please try again.',
        )
      })
      .finally(() => {
        if (!cancelled) {
          setSearching(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [search, selected])

  function handleSelect(account: Account) {
    setSelected(account)
    setResults([account])
    setSearchInput(account.phoneNumber)
    setSearch(account.phoneNumber)
    setSearchError('')
  }

  function handleClearSelection() {
    setSelected(null)
    setResults([])
    setSearchInput('')
    setSearch('')
  }

  function toggleIssueNumber(value: number) {
    setIssueNumbers((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value].sort((a, b) => a - b),
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (!selected) {
      setError('Please search and select a phone number.')
      return
    }

    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      setError('Please add a message describing the issue.')
      return
    }

    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }

    setLoading(true)
    try {
      await createIssue(
        {
          phoneNumber: selected.phoneNumber,
          message: trimmedMessage,
          issueNumbers,
        },
        token,
      )
      onCreated(`Issue reported for ${selected.sanchalakName || selected.phoneNumber}.`)
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Unable to report the issue. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  const visibleAccounts = selected ? [selected] : results

  return (
    <Modal
      title="Report issue"
      description="Search for a phone number, optionally pick the error code shown on screen, then add a message."
      labelledBy="report-issue-title"
      busy={loading}
      wide
      onClose={onClose}
    >
      <form className="stack-form report-issue-form" onSubmit={handleSubmit}>
        <label className="users-search" htmlFor="report-issue-search">
          <span className="users-search-label">Search phone number</span>
          <input
            id="report-issue-search"
            type="search"
            placeholder="Phone number or kendra"
            value={searchInput}
            onChange={(event) => {
              if (selected) {
                handleClearSelection()
              }
              setSearchInput(event.target.value)
            }}
            disabled={loading}
            autoFocus
          />
        </label>

        {searchError && <p className="form-error">{searchError}</p>}

        {selected || search ? (
          <div className={`report-search-results${selected ? ' is-selected-only' : ''}`}>
            {searching && !selected ? (
              <p className="users-table-empty">Searching accounts...</p>
            ) : visibleAccounts.length === 0 ? (
              <p className="users-table-empty">No accounts found.</p>
            ) : (
              <ul className="report-account-list">
                {visibleAccounts.map((account) => {
                  const isSelected = selected?.id === account.id
                  return (
                    <li key={account.id}>
                      <button
                        type="button"
                        className={`report-account-option${isSelected ? ' is-selected' : ''}`}
                        onClick={() => handleSelect(account)}
                        disabled={loading}
                      >
                        <AccountSummary account={account} expanded={isSelected} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : (
          <p className="field-hint">Start typing a phone number to search registered accounts.</p>
        )}

        <div className="form-field">
          <label>Which error code do the user sees on the screen</label>
          <p className="field-hint">Optional. Tamper and integrity codes are marked in red.</p>
          <div className="error-code-chips" aria-label="Error codes">
            {ERROR_CODES.map((item) => {
              const isActive = issueNumbers.includes(item.code)
              const isPriority = item.kind === 'tamper' || item.kind === 'integrity'
              return (
                <button
                  key={item.code}
                  type="button"
                  className={`error-code-chip${isActive ? ' is-active' : ''}${isPriority ? ' is-priority' : ''}`}
                  onClick={() => toggleIssueNumber(item.code)}
                  disabled={loading}
                >
                  {item.code}
                </button>
              )
            })}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="report-issue-message">Message</label>
          <textarea
            id="report-issue-message"
            rows={4}
            placeholder="Describe the issue..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={loading}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Reporting...' : 'Report issue'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
