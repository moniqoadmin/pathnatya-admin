import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { listEntitlements, updateEntitlement, type Entitlement } from '../api/entitlements'
import Modal from '../components/Modal'
import { ADMIN_HOME_PATH, canManageEntitlements } from '../lib/roles'
import { getAccount, getToken } from '../lib/session'

const KNOWN_LABELS: Record<string, { title: string; description: string }> = {
  ADMIN_LOGIN_ELECTRON_APP: {
    title: 'Electron privileged login',
    description: 'Allow privileged admin login from the Electron desktop app.',
  },
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : fallback
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

function titleFromKey(key: string): string {
  const known = KNOWN_LABELS[key]
  if (known) {
    return known.title
  }
  return key
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function descriptionFor(item: Entitlement): string {
  if (item.description) {
    return item.description
  }
  return KNOWN_LABELS[item.key]?.description ?? 'Feature flag for this environment.'
}

function displayName(item: Entitlement): string {
  return item.name?.trim() || titleFromKey(item.key)
}

export default function EntitlementsPage() {
  const account = getAccount()
  const [items, setItems] = useState<Entitlement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [savingKey, setSavingKey] = useState('')
  const [pending, setPending] = useState<Entitlement | null>(null)

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

    void listEntitlements(token)
      .then((nextItems) => {
        if (!cancelled) {
          setItems(nextItems)
        }
      })
      .catch((loadError) => {
        if (cancelled) {
          return
        }
        setItems([])
        setError(apiErrorMessage(loadError, 'Unable to load entitlements. Please try again.'))
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey])

  async function confirmToggle() {
    if (!pending) {
      return
    }

    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      setPending(null)
      return
    }

    const nextEnabled = !pending.enabled
    setSavingKey(pending.key)
    setError('')
    setStatus('')

    try {
      const updated = await updateEntitlement(pending.key, { enabled: nextEnabled }, token)
      setItems((current) => {
        const exists = current.some((item) => item.key === updated.key)
        if (!exists) {
          return [...current, updated]
        }
        return current.map((item) => (item.key === updated.key ? { ...item, ...updated } : item))
      })
      setStatus(
        `${displayName(updated)} is now ${updated.enabled ? 'on' : 'off'}.`,
      )
      setPending(null)
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Unable to update entitlement. Please try again.'))
    } finally {
      setSavingKey('')
    }
  }

  const busy = Boolean(savingKey)

  if (!canManageEntitlements(account?.role)) {
    return <Navigate to={ADMIN_HOME_PATH} replace />
  }

  return (
    <div className="page-panel entitlements-page">
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">Access</p>
          <h1>Entitlements</h1>
          <p className="page-subtitle">
            Turn privileged app features on or off. Changes apply immediately.
          </p>
        </div>
        <div className="page-actions">
          <p className="users-total" aria-live="polite">
            <span className="users-total-value">{items.length.toLocaleString()}</span>
            <span className="users-total-label">
              {items.length === 1 ? 'flag' : 'flags'}
            </span>
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading || busy}
            onClick={() => setReloadKey((current) => current + 1)}
          >
            {loading ? 'Loading...' : 'Reload'}
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}
      {status && <p className="form-success">{status}</p>}

      {loading ? (
        <p className="teams-empty">Loading entitlements...</p>
      ) : items.length === 0 && !error ? (
        <p className="teams-empty">No entitlements found.</p>
      ) : (
        <div className="entitlement-list">
          {items.map((item) => {
            const title = displayName(item)
            const saving = savingKey === item.key
            return (
              <article key={item.key} className="entitlement-card">
                <div className="entitlement-card-copy">
                  <h2>{title}</h2>
                  <p className="entitlement-key">
                    <code>{item.key}</code>
                  </p>
                  <p className="page-subtitle">{descriptionFor(item)}</p>
                  {item.updatedAt && (
                    <p className="entitlement-meta">
                      Updated {formatDate(item.updatedAt)}
                      {item.updatedBy ? ` · ${item.updatedBy}` : ''}
                    </p>
                  )}
                </div>
                <div className="entitlement-card-control">
                  <span
                    className={`status-pill ${item.enabled ? 'status-active' : 'status-inactive'}`}
                  >
                    {item.enabled ? 'On' : 'Off'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={item.enabled}
                    aria-label={`${title} ${item.enabled ? 'on' : 'off'}`}
                    className={`switch${item.enabled ? ' is-on' : ''}`}
                    disabled={busy}
                    onClick={() => {
                      setError('')
                      setStatus('')
                      setPending(item)
                    }}
                  />
                  {saving && <span className="entitlement-saving">Saving...</span>}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {pending && (
        <Modal
          title={`${pending.enabled ? 'Turn off' : 'Turn on'} ${displayName(pending)}?`}
          description={
            pending.enabled
              ? 'This entitlement is currently on. Turning it off takes effect immediately.'
              : 'This entitlement is currently off. Turning it on takes effect immediately.'
          }
          labelledBy="entitlement-confirm-title"
          busy={busy}
          onClose={() => {
            if (!busy) {
              setPending(null)
            }
          }}
          footer={
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setPending(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={pending.enabled ? 'btn btn-unable' : 'btn btn-primary'}
                disabled={busy}
                onClick={() => {
                  void confirmToggle()
                }}
              >
                {busy
                  ? 'Saving...'
                  : pending.enabled
                    ? 'Turn off'
                    : 'Turn on'}
              </button>
            </div>
          }
        >
          <p className="entitlement-confirm-copy">
            {descriptionFor(pending)} The flag key is <code>{pending.key}</code>.
          </p>
        </Modal>
      )}
    </div>
  )
}
