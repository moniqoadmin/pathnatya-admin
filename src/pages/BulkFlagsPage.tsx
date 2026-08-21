import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ApiError } from '../api/client'
import {
  findActiveBulkFlagJob,
  getBulkFlagJob,
  getBulkFlagJobErrors,
  isBulkFlagJobAccepted,
  listBulkFlagJobs,
  listSanghats,
  updateSanghatFlags,
  type BulkFlagJob,
  type BulkFlagJobErrorsPage,
  type SanghatFlagError,
  type SanghatFlagsSyncResult,
  type UpdateSanghatFlagsPayload,
} from '../api/sanghat-flags'
import Modal from '../components/Modal'
import { ADMIN_HOME_PATH } from '../lib/roles'
import { getToken } from '../lib/session'

const POLL_INTERVAL_MS = 1_500
const ERROR_PAGE_SIZE = 100
const HISTORY_PAGE_SIZE = 20
const ENABLE_REASON_MIN_LENGTH = 10
const ACTIVE_JOB_KEY = 'pathnatya.activeBulkFlagJobId'
const SENSITIVE_TITLE = 'Highly sensitive page'
const SENSITIVE_DESCRIPTION =
  'This is a highly sensitive page which can make changes on a bulk scale.'

const BOOLEAN_OPTIONS = [
  { value: 'true', label: 'True' },
  { value: 'false', label: 'False' },
] as const

type FlagKey =
  | 'isOffline'
  | 'logoutButton'
  | 'appConfiguration'
  | 'numberOfReboot'
  | 'isLoginDisabled'
  | 'setPassword'

const ACCOUNT_FLAGS: { key: FlagKey; label: string; hint: string }[] = [
  { key: 'isOffline', label: 'Is offline', hint: 'Account flag' },
  { key: 'logoutButton', label: 'Logout button', hint: 'Account flag' },
  { key: 'appConfiguration', label: 'App configuration', hint: 'Integer, 1 or higher' },
  { key: 'numberOfReboot', label: 'Number of reboot', hint: 'Integer, 0 or higher' },
]

const TEAM_FLAGS: { key: FlagKey; label: string; hint: string }[] = [
  { key: 'isLoginDisabled', label: 'Login disabled', hint: 'Team flag. Re-enabling requires a reason.' },
  { key: 'setPassword', label: 'Force password reset', hint: 'Team flag. Sends true only.' },
]

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

function formatFields(fields: string[] | undefined): string {
  if (!fields || fields.length === 0) {
    return '—'
  }
  return fields.join(', ')
}

function formatFlags(flags: Record<string, unknown> | undefined): string {
  if (!flags || Object.keys(flags).length === 0) {
    return '—'
  }
  return Object.entries(flags)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ')
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : fallback
}

function isJobActive(job: BulkFlagJob | null | undefined): boolean {
  return job?.status === 'queued' || job?.status === 'processing'
}

function parseBoolean(value: string): boolean {
  return value === 'true'
}

export default function BulkFlagsPage() {
  const navigate = useNavigate()
  const [confirmKind, setConfirmKind] = useState<'page' | 'update' | null>('page')
  const [pendingPayload, setPendingPayload] = useState<UpdateSanghatFlagsPayload | null>(null)
  const [sanghats, setSanghats] = useState<string[]>([])
  const [sanghatsLoading, setSanghatsLoading] = useState(true)
  const [allAccounts, setAllAccounts] = useState(false)
  const [sanghat, setSanghat] = useState('')
  const [apply, setApply] = useState<Record<FlagKey, boolean>>({
    isOffline: false,
    logoutButton: false,
    appConfiguration: false,
    numberOfReboot: false,
    isLoginDisabled: false,
    setPassword: false,
  })
  const [isOffline, setIsOffline] = useState(true)
  const [logoutButton, setLogoutButton] = useState(false)
  const [appConfiguration, setAppConfiguration] = useState(1)
  const [numberOfReboot, setNumberOfReboot] = useState(0)
  const [isLoginDisabled, setIsLoginDisabled] = useState(true)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [syncResult, setSyncResult] = useState<SanghatFlagsSyncResult | null>(null)
  const [jobId, setJobId] = useState(() => sessionStorage.getItem(ACTIVE_JOB_KEY) ?? '')
  const [job, setJob] = useState<BulkFlagJob | null>(null)
  const [errorsPage, setErrorsPage] = useState<BulkFlagJobErrorsPage | null>(null)
  const [errorPageNumber, setErrorPageNumber] = useState(1)
  const [history, setHistory] = useState<BulkFlagJob[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotalPages, setHistoryTotalPages] = useState(1)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError, setHistoryError] = useState('')

  const jobRunning = isJobActive(job) || (jobId !== '' && !job)
  const busy = submitting || jobRunning
  const needsLoginReason = apply.isLoginDisabled && !isLoginDisabled
  const reasonLength = reason.trim().length
  const reasonTooShort = needsLoginReason && reasonLength < ENABLE_REASON_MIN_LENGTH
  const anyFlagSelected = Object.values(apply).some(Boolean)
  const scopeReady = allAccounts || Boolean(sanghat.trim())
  const canSubmit = scopeReady && anyFlagSelected && !busy && !reasonTooShort

  const syncErrors = syncResult?.errors ?? []
  const jobErrors = errorsPage?.data ?? []
  const showingJobErrors = !syncResult && jobErrors.length > 0
  const errorRows: SanghatFlagError[] = showingJobErrors ? jobErrors : syncErrors

  const appliedFlagsSummary = useMemo(() => {
    const parts: string[] = []
    if (apply.isOffline) parts.push(`isOffline: ${String(isOffline)}`)
    if (apply.logoutButton) parts.push(`logoutButton: ${String(logoutButton)}`)
    if (apply.appConfiguration) parts.push(`appConfiguration: ${appConfiguration}`)
    if (apply.numberOfReboot) parts.push(`numberOfReboot: ${numberOfReboot}`)
    if (apply.isLoginDisabled) parts.push(`isLoginDisabled: ${String(isLoginDisabled)}`)
    if (apply.setPassword) parts.push('setPassword: true')
    return parts.join(', ')
  }, [
    apply,
    isOffline,
    logoutButton,
    appConfiguration,
    numberOfReboot,
    isLoginDisabled,
  ])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      setSanghatsLoading(false)
      setHistoryLoading(false)
      return
    }

    let cancelled = false
    setSanghatsLoading(true)

    void listSanghats(token)
      .then((next) => {
        if (!cancelled) {
          setSanghats(next)
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(apiErrorMessage(loadError, 'Unable to load sanghats.'))
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
      return
    }

    let cancelled = false
    setHistoryLoading(true)

    void listBulkFlagJobs({ page: historyPage, limit: HISTORY_PAGE_SIZE }, token)
      .then((page) => {
        if (cancelled) {
          return
        }
        setHistory(page.data)
        setHistoryTotal(page.total)
        setHistoryTotalPages(Math.max(1, page.totalPages || 1))
        setHistoryError('')
      })
      .catch((loadError) => {
        if (!cancelled) {
          setHistory([])
          setHistoryTotal(0)
          setHistoryTotalPages(1)
          setHistoryError(apiErrorMessage(loadError, 'Unable to load job history.'))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [historyPage, job?.status])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      return
    }

    let cancelled = false

    void findActiveBulkFlagJob(token)
      .then((active) => {
        if (cancelled || !active) {
          return
        }
        sessionStorage.setItem(ACTIVE_JOB_KEY, active.id)
        setJobId(active.id)
        setJob(active)
        setSyncResult(null)
      })
      .catch(() => {
        // History load already reports list errors.
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!jobId || job?.status === 'completed' || job?.status === 'failed') {
      return
    }

    let cancelled = false
    let timer: number | undefined

    async function poll() {
      const token = getToken()
      if (!token) {
        setError('Your session expired. Please log in again.')
        return
      }

      try {
        const next = await getBulkFlagJob(jobId, token)
        if (cancelled) {
          return
        }
        setJob(next)
        setError('')
        if (next.status === 'completed' || next.status === 'failed') {
          sessionStorage.removeItem(ACTIVE_JOB_KEY)
          if (next.status === 'completed') {
            setStatus(
              `Updated ${next.usersChanged.toLocaleString()} users and ${next.teamsChanged.toLocaleString()} teams.`,
            )
          } else {
            setStatus('')
          }
          if (next.errorCount > 0) {
            const page = await getBulkFlagJobErrors(jobId, 1, ERROR_PAGE_SIZE, token)
            if (!cancelled) {
              setErrorsPage(page)
              setErrorPageNumber(1)
            }
          } else {
            setErrorsPage(null)
          }
          return
        }
        timer = window.setTimeout(poll, POLL_INTERVAL_MS)
      } catch (pollError) {
        if (!cancelled) {
          setError(apiErrorMessage(pollError, 'Unable to check the job status.'))
          timer = window.setTimeout(poll, POLL_INTERVAL_MS * 2)
        }
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timer) {
        window.clearTimeout(timer)
      }
    }
  }, [jobId, job?.status])

  function toggleFlag(key: FlagKey, included: boolean) {
    setApply((current) => ({ ...current, [key]: included }))
  }

  function buildPayload(): UpdateSanghatFlagsPayload | string {
    if (!anyFlagSelected) {
      return 'Select at least one flag to update.'
    }
    if (!allAccounts && !sanghat.trim()) {
      return 'Choose a sanghat or check all accounts.'
    }
    if (reasonTooShort) {
      return `Enter a valid reason to re-enable login (at least ${ENABLE_REASON_MIN_LENGTH} characters).`
    }
    if (apply.appConfiguration && (!Number.isFinite(appConfiguration) || appConfiguration < 1)) {
      return 'App configuration must be a whole number of 1 or higher.'
    }
    if (apply.numberOfReboot && (!Number.isFinite(numberOfReboot) || numberOfReboot < 0)) {
      return 'Number of reboot must be a whole number of 0 or higher.'
    }

    const payload: UpdateSanghatFlagsPayload = allAccounts
      ? { all: true }
      : { sanghat: sanghat.trim() }

    if (apply.isOffline) payload.isOffline = isOffline
    if (apply.logoutButton) payload.logoutButton = logoutButton
    if (apply.appConfiguration) payload.appConfiguration = Math.floor(appConfiguration)
    if (apply.numberOfReboot) payload.numberOfReboot = Math.floor(numberOfReboot)
    if (apply.isLoginDisabled) {
      payload.isLoginDisabled = isLoginDisabled
      if (!isLoginDisabled) {
        payload.reason = reason.trim()
      }
    }
    if (apply.setPassword) payload.setPassword = true

    return payload
  }

  async function loadJobErrors(nextJobId: string, page: number) {
    const token = getToken()
    if (!token) {
      return
    }
    try {
      const next = await getBulkFlagJobErrors(nextJobId, page, ERROR_PAGE_SIZE, token)
      setErrorsPage(next)
      setErrorPageNumber(page)
    } catch (pageError) {
      setError(apiErrorMessage(pageError, 'Unable to load job errors.'))
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setStatus('')
    setSyncResult(null)
    setErrorsPage(null)

    const payload = buildPayload()
    if (typeof payload === 'string') {
      setError(payload)
      return
    }

    setPendingPayload(payload)
    setConfirmKind('update')
  }

  function dismissSensitive() {
    if (confirmKind === 'page') {
      navigate(ADMIN_HOME_PATH)
      return
    }
    setConfirmKind(null)
    setPendingPayload(null)
  }

  function confirmSensitive() {
    if (confirmKind === 'page') {
      setConfirmKind(null)
      return
    }
    if (!pendingPayload) {
      setConfirmKind(null)
      return
    }
    const payload = pendingPayload
    setConfirmKind(null)
    setPendingPayload(null)
    void runUpdate(payload)
  }

  async function runUpdate(payload: UpdateSanghatFlagsPayload) {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }

    setSubmitting(true)
    try {
      const result = await updateSanghatFlags(payload, token)
      if (isBulkFlagJobAccepted(result)) {
        sessionStorage.setItem(ACTIVE_JOB_KEY, result.jobId)
        setJobId(result.jobId)
        setJob(null)
        setStatus('Queued a bulk flags job for all accounts.')
        return
      }

      setSyncResult(result)
      setJobId('')
      setJob(null)
      sessionStorage.removeItem(ACTIVE_JOB_KEY)
      setStatus(
        `Updated ${result.usersChanged.toLocaleString()} users and ${result.teamsChanged.toLocaleString()} teams in ${result.sanghat}.`,
      )
    } catch (submitError) {
      const apiError = submitError as ApiError
      setError(apiErrorMessage(submitError, 'Unable to update flags.'))
      if (apiError.status === 409) {
        try {
          const active = await findActiveBulkFlagJob(token)
          if (active) {
            sessionStorage.setItem(ACTIVE_JOB_KEY, active.id)
            setJobId(active.id)
            setJob(active)
            setSyncResult(null)
          }
        } catch {
          // Keep the 409 message.
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function inspectHistoryJob(next: BulkFlagJob) {
    setSyncResult(null)
    setError('')
    setStatus('')
    setJob(next)
    setJobId(next.id)
    setErrorsPage(null)
    setErrorPageNumber(1)

    if (isJobActive(next)) {
      sessionStorage.setItem(ACTIVE_JOB_KEY, next.id)
      return
    }

    sessionStorage.removeItem(ACTIVE_JOB_KEY)
    if (next.errorCount > 0) {
      await loadJobErrors(next.id, 1)
    }
    if (next.status !== 'failed') {
      setStatus(
        `Updated ${next.usersChanged.toLocaleString()} users and ${next.teamsChanged.toLocaleString()} teams.`,
      )
    }
  }

  function handleAllAccountsChange(checked: boolean) {
    setAllAccounts(checked)
    if (checked) {
      setSanghat('')
    }
  }

  function handleSanghatChange(value: string) {
    setSanghat(value)
    if (value) {
      setAllAccounts(false)
    }
  }

  const historyFrom = historyTotal === 0 ? 0 : (historyPage - 1) * HISTORY_PAGE_SIZE + 1
  const historyTo = Math.min(historyPage * HISTORY_PAGE_SIZE, historyTotal)

  return (
    <div className="page-panel bulk-flags-page">
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">Operations</p>
          <h1>Bulk Flags</h1>
          <p className="page-subtitle">
            Update account and team flags for one sanghat immediately, or queue a job for every
            account.
          </p>
        </div>
      </div>

      <section className="creation-guide" aria-labelledby="bulk-flags-form-title">
        <div className="creation-guide-intro">
          <h2 id="bulk-flags-form-title">Update flags</h2>
          <p>
            Choose a sanghat or all accounts, then include only the flags you want to change. Do
            not send both a sanghat and all accounts together.
          </p>
        </div>

        <form className="stack-form bulk-flags-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="bulk-flags-block">
            <h3>Scope</h3>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={allAccounts}
                disabled={busy}
                onChange={(event) => handleAllAccountsChange(event.target.checked)}
              />
              All accounts
            </label>
            <div className="form-field">
              <label htmlFor="bulk-flags-sanghat">Sanghat</label>
              <select
                id="bulk-flags-sanghat"
                value={sanghat}
                disabled={busy || allAccounts || sanghatsLoading}
                onChange={(event) => handleSanghatChange(event.target.value)}
              >
                <option value="">
                  {sanghatsLoading ? 'Loading sanghats…' : 'Select a sanghat'}
                </option>
                {sanghats.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bulk-flags-block">
            <h3>Account flags</h3>
            <div className="flag-rows">
              {ACCOUNT_FLAGS.map((flag) => (
                <div key={flag.key} className="flag-row">
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={apply[flag.key]}
                      disabled={busy}
                      onChange={(event) => toggleFlag(flag.key, event.target.checked)}
                    />
                    {flag.label}
                  </label>
                  {flag.key === 'isOffline' && apply.isOffline && (
                    <select
                      value={String(isOffline)}
                      disabled={busy}
                      onChange={(event) => setIsOffline(parseBoolean(event.target.value))}
                    >
                      {BOOLEAN_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {flag.key === 'logoutButton' && apply.logoutButton && (
                    <select
                      value={String(logoutButton)}
                      disabled={busy}
                      onChange={(event) => setLogoutButton(parseBoolean(event.target.value))}
                    >
                      {BOOLEAN_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {flag.key === 'appConfiguration' && apply.appConfiguration && (
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={appConfiguration}
                      disabled={busy}
                      onChange={(event) => setAppConfiguration(Number(event.target.value))}
                    />
                  )}
                  {flag.key === 'numberOfReboot' && apply.numberOfReboot && (
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={numberOfReboot}
                      disabled={busy}
                      onChange={(event) => setNumberOfReboot(Number(event.target.value))}
                    />
                  )}
                  <p className="field-hint">{flag.hint}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bulk-flags-block">
            <h3>Team flags</h3>
            <div className="flag-rows">
              {TEAM_FLAGS.map((flag) => (
                <div key={flag.key} className="flag-row">
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={apply[flag.key]}
                      disabled={busy}
                      onChange={(event) => toggleFlag(flag.key, event.target.checked)}
                    />
                    {flag.label}
                  </label>
                  {flag.key === 'isLoginDisabled' && apply.isLoginDisabled && (
                    <select
                      value={String(isLoginDisabled)}
                      disabled={busy}
                      onChange={(event) => setIsLoginDisabled(parseBoolean(event.target.value))}
                    >
                      {BOOLEAN_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="field-hint">{flag.hint}</p>
                </div>
              ))}
            </div>
            {needsLoginReason && (
              <div className="form-field">
                <label htmlFor="bulk-flags-reason">Reason to re-enable login</label>
                <textarea
                  id="bulk-flags-reason"
                  value={reason}
                  disabled={busy}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Follow-up completed"
                />
                <p className="field-hint">
                  {reasonTooShort
                    ? `${ENABLE_REASON_MIN_LENGTH - reasonLength} more characters required`
                    : 'Required when setting login disabled to false.'}
                </p>
              </div>
            )}
          </div>

          {error && <p className="form-error">{error}</p>}
          {status && !error && <p className="form-success">{status}</p>}

          <div className="page-actions bulk-flags-submit">
            <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
              {jobRunning
                ? 'Job in progress…'
                : submitting
                  ? 'Updating…'
                  : allAccounts
                    ? 'Queue update for all accounts'
                    : 'Update sanghat'}
            </button>
          </div>
        </form>
      </section>

      {(job || syncResult) && (
        <section className="creation-guide" aria-labelledby="bulk-flags-result-title">
          <div className="creation-guide-intro">
            <h2 id="bulk-flags-result-title">{syncResult ? 'Sanghat result' : 'Job status'}</h2>
            <p>
              {syncResult
                ? `Immediate update for ${syncResult.sanghat}.`
                : job
                  ? formatFlags(job.flags) !== '—'
                    ? formatFlags(job.flags)
                    : appliedFlagsSummary || 'Waiting for job details…'
                  : 'Waiting for job details…'}
            </p>
          </div>

          {job && (
            <div className="bulk-import-status-row">
              <span className={`status-pill status-${job.status}`}>{job.status}</span>
              <span>{job.requestedBy ? `Requested by ${job.requestedBy}` : 'Bulk flags job'}</span>
            </div>
          )}

          {jobRunning && (
            <div className="bulk-progress-block">
              <div className="bulk-progress-track" aria-label="Bulk flags progress">
                <span className="is-indeterminate" />
              </div>
              <p>
                {job?.status === 'processing'
                  ? 'Updating accounts and teams…'
                  : 'Waiting for a worker to pick up the job…'}
              </p>
            </div>
          )}

          <div className="bulk-summary-grid">
            <div className="bulk-summary-item">
              <span className="bulk-summary-label">Users changed</span>
              <span className="bulk-summary-value">
                {(syncResult?.usersChanged ?? job?.usersChanged ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="bulk-summary-item">
              <span className="bulk-summary-label">Teams changed</span>
              <span className="bulk-summary-value">
                {(syncResult?.teamsChanged ?? job?.teamsChanged ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="bulk-summary-item is-danger">
              <span className="bulk-summary-label">Errors</span>
              <span className="bulk-summary-value">
                {(syncResult?.errors.length ?? job?.errorCount ?? 0).toLocaleString()}
              </span>
            </div>
          </div>

          {job?.status === 'failed' && (
            <p className="form-error">
              {job.failureMessage || 'The bulk flags job failed. Some rows may already be updated.'}
            </p>
          )}

          {errorRows.length > 0 && (
            <>
              <div className="bulk-error-table-wrap">
                <table className="bulk-error-table">
                  <thead>
                    <tr>
                      <th>Mobile</th>
                      <th>Kendra</th>
                      <th>Sanghat</th>
                      <th>Team</th>
                      <th>Fields</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorRows.map((item, index) => (
                      <tr key={`${item.phoneNumber ?? 'row'}-${item.teamNumber ?? 'x'}-${index}`}>
                        <td>{formatValue(item.phoneNumber)}</td>
                        <td>{formatValue(item.kendra)}</td>
                        <td>{formatValue(item.sanghat)}</td>
                        <td>{formatValue(item.teamNumber)}</td>
                        <td>{formatFields(item.fields)}</td>
                        <td>{item.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {showingJobErrors && errorsPage && errorsPage.totalPages > 1 && (
                <div className="bulk-error-pagination">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={errorPageNumber <= 1}
                    onClick={() => void loadJobErrors(jobId, errorPageNumber - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {errorPageNumber} of {errorsPage.totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={errorPageNumber >= errorsPage.totalPages}
                    onClick={() => void loadJobErrors(jobId, errorPageNumber + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <section className="creation-guide" aria-labelledby="bulk-flags-history-title">
        <div className="creation-guide-intro">
          <h2 id="bulk-flags-history-title">Job history</h2>
          <p>Recent all-accounts jobs. Select a row to inspect its status and errors.</p>
        </div>

        {historyError && <p className="form-error">{historyError}</p>}

        <div className="users-table-wrap">
          <table className="users-table bulk-flags-history-table">
            <thead>
              <tr>
                <th>Created</th>
                <th>Status</th>
                <th>Flags</th>
                <th>Users</th>
                <th>Teams</th>
                <th>Errors</th>
              </tr>
            </thead>
            <tbody>
              {historyLoading ? (
                <tr>
                  <td colSpan={6} className="users-table-empty">
                    Loading job history...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="users-table-empty">
                    No bulk flags jobs yet.
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr
                    key={item.id}
                    className={`is-clickable${jobId === item.id ? ' is-selected' : ''}`}
                    tabIndex={0}
                    onClick={() => void inspectHistoryJob(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        void inspectHistoryJob(item)
                      }
                    }}
                  >
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <span className={`status-pill status-${item.status}`}>{item.status}</span>
                    </td>
                    <td>{formatFlags(item.flags)}</td>
                    <td>{item.usersChanged.toLocaleString()}</td>
                    <td>{item.teamsChanged.toLocaleString()}</td>
                    <td>{item.errorCount.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="users-pagination">
          <p className="users-pagination-meta">
            {historyLoading ? 'Loading...' : `Showing ${historyFrom}-${historyTo} of ${historyTotal}`}
          </p>
          <div className="users-pagination-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={historyLoading || historyPage <= 1}
              onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
            >
              Previous
            </button>
            <span className="users-page-indicator">
              Page {historyPage} of {historyTotalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={historyLoading || historyPage >= historyTotalPages}
              onClick={() => setHistoryPage((page) => page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {confirmKind && (
        <Modal
          title={SENSITIVE_TITLE}
          description={SENSITIVE_DESCRIPTION}
          labelledBy="bulk-flags-sensitive-title"
          busy={submitting}
          dismissible={confirmKind === 'update'}
          onClose={dismissSensitive}
        >
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={dismissSensitive}
              disabled={submitting}
            >
              {confirmKind === 'page' ? 'Go back' : 'Cancel'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={confirmSensitive}
              disabled={submitting}
            >
              {confirmKind === 'page'
                ? 'Continue'
                : allAccounts
                  ? 'Queue update'
                  : 'Update sanghat'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
