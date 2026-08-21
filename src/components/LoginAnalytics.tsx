import { useEffect, useState } from 'react'
import { getLoginAnalytics, type LoginAnalyticsResponse } from '../api/accounts'
import { listSanghats } from '../api/sanghat-flags'
import { getToken } from '../lib/session'

type SincePreset = 'all' | 'today'

const EMPTY_ANALYTICS: LoginAnalyticsResponse = {
  accountsLoggedIn: 0,
  teamsLoggedIn: 0,
  totalAccounts: 0,
  totalTeams: 0,
}

function startOfTodayUtcIso(): string {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString()
}

function formatCount(value: number | null, loading: boolean): string {
  if (loading) {
    return '…'
  }
  if (value == null) {
    return '—'
  }
  return value.toLocaleString()
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : fallback
}

export default function LoginAnalytics() {
  const [sanghats, setSanghats] = useState<string[]>([])
  const [sanghatsLoading, setSanghatsLoading] = useState(true)
  const [sanghat, setSanghat] = useState('')
  const [sincePreset, setSincePreset] = useState<SincePreset>('all')
  const [analytics, setAnalytics] = useState<LoginAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setSanghatsLoading(false)
      return
    }

    let cancelled = false
    setSanghatsLoading(true)
    void listSanghats(token)
      .then((nextSanghats) => {
        if (!cancelled) {
          setSanghats(nextSanghats)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSanghats([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSanghatsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

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

    void getLoginAnalytics(
      {
        sanghat: sanghat.trim() || undefined,
        since: sincePreset === 'today' ? startOfTodayUtcIso() : undefined,
      },
      token,
    )
      .then((response) => {
        if (!cancelled) {
          setAnalytics(response)
        }
      })
      .catch((loadError) => {
        if (cancelled) {
          return
        }
        setAnalytics(null)
        setError(apiErrorMessage(loadError, 'Unable to load login analytics.'))
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [sanghat, sincePreset, reloadKey])

  const stats = analytics ?? EMPTY_ANALYTICS
  const scopeLabel = sanghat.trim() || 'All sanghats'
  const periodLabel = sincePreset === 'today' ? 'since start of today (UTC)' : 'all time'

  return (
    <section className="dashboard-analytics">
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">Usage</p>
          <h2 className="dashboard-analytics-title">Login counts</h2>
          <p className="page-subtitle">
            Teams with a last login, and distinct accounts with at least one such team.
            These counts update every 3 hours.
          </p>
        </div>
        <div className="page-actions">
          <p className="dashboard-analytics-freshness">Updates every 3 hours</p>
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

      <div className="dashboard-analytics-toolbar">
        <div className="role-filters" aria-label="Login period">
          <button
            type="button"
            className={`role-filter-tag${sincePreset === 'all' ? ' is-active' : ''}`}
            onClick={() => setSincePreset('all')}
          >
            All time
          </button>
          <button
            type="button"
            className={`role-filter-tag${sincePreset === 'today' ? ' is-active' : ''}`}
            onClick={() => setSincePreset('today')}
          >
            Today (UTC)
          </button>
        </div>

        <div className="users-sanghat-filter">
          <select
            id="dashboard-analytics-sanghat"
            aria-label="Sanghat"
            value={sanghat}
            disabled={sanghatsLoading}
            onChange={(event) => setSanghat(event.target.value)}
          >
            <option value="">
              {sanghatsLoading ? 'Loading sanghats…' : 'All sanghats'}
            </option>
            {sanghat && !sanghats.includes(sanghat) && (
              <option value={sanghat}>{sanghat}</option>
            )}
            {sanghats.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="dashboard-analytics-stats">
        <article className="dashboard-stat">
          <span className="dashboard-stat-label">Total accounts</span>
          <span className="dashboard-stat-value">
            {formatCount(analytics ? stats.totalAccounts : null, loading)}
          </span>
          <span className="dashboard-stat-hint">{scopeLabel}</span>
        </article>
        <article className="dashboard-stat">
          <span className="dashboard-stat-label">Accounts logged in</span>
          <span className="dashboard-stat-value">
            {formatCount(analytics ? stats.accountsLoggedIn : null, loading)}
          </span>
          <span className="dashboard-stat-hint">
            of {formatCount(analytics ? stats.totalAccounts : null, loading)} accounts · {scopeLabel}
          </span>
        </article>
        <article className="dashboard-stat">
          <span className="dashboard-stat-label">Total teams</span>
          <span className="dashboard-stat-value">
            {formatCount(analytics ? stats.totalTeams : null, loading)}
          </span>
          <span className="dashboard-stat-hint">{scopeLabel}</span>
        </article>
        <article className="dashboard-stat">
          <span className="dashboard-stat-label">Teams logged in</span>
          <span className="dashboard-stat-value">
            {formatCount(analytics ? stats.teamsLoggedIn : null, loading)}
          </span>
          <span className="dashboard-stat-hint">
            of {formatCount(analytics ? stats.totalTeams : null, loading)} teams · {periodLabel}
          </span>
        </article>
      </div>
    </section>
  )
}
