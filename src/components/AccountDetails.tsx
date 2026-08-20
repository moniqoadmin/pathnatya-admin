import { type FormEvent, useEffect, useState } from 'react'
import {
  ACCOUNT_ROLE_OPTIONS,
  getAccountTeams,
  updateAccount,
  updateAccountTeam,
  type Account,
  type AccountRoleValue,
  type AccountTeam,
  type UpdateAccountPayload,
  type UpdateAccountTeamPayload,
} from '../api/accounts'
import { getToken } from '../lib/session'
import Modal from './Modal'
import PasswordInput from './PasswordInput'

const ENABLE_REASON_MIN_LENGTH = 10

type PendingTeamAction = {
  team: AccountTeam
  title: string
  description: string
  patch: UpdateAccountTeamPayload
  requiresReason?: boolean
}

interface AccountDetailsProps {
  account: Account
  canEdit: boolean
  canEditPrivileged: boolean
  onBack: () => void
  onUpdated: (account: Account, message: string) => void
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

function formatMetadata(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return '—'
  }
  return JSON.stringify(metadata, null, 2)
}

function formFromAccount(account: Account) {
  const role = ACCOUNT_ROLE_OPTIONS.some((option) => option.value === account.role)
    ? (account.role as AccountRoleValue)
    : 'User'

  return {
    sanchalakName: account.sanchalakName ?? '',
    role,
    isOffline: Boolean(account.isOffline),
    logoutButton: Boolean(account.logoutButton),
    numberOfTeams: account.numberOfTeams ?? 0,
    numberOfReboot: account.numberOfReboot ?? 0,
    appConfiguration: account.appConfiguration ?? 0,
    country: account.country ?? '',
    sanghat: account.sanghat ?? '',
    jilha: account.jilha ?? '',
    taluka: account.taluka ?? '',
    group: account.group ?? '',
    kendra: account.kendra ?? '',
    password: '',
  }
}

type TeamSlot = AccountTeam | { teamNumber: number; empty: true }

function isEmptySlot(slot: TeamSlot): slot is { teamNumber: number; empty: true } {
  return 'empty' in slot
}

function teamSlots(account: Account, teams: AccountTeam[]): TeamSlot[] {
  const maxSlot = Math.max(
    account.numberOfTeams ?? 0,
    ...teams.map((team) => team.teamNumber),
  )
  if (maxSlot <= 0) {
    return []
  }

  const byNumber = new Map(teams.map((team) => [team.teamNumber, team]))
  return Array.from({ length: maxSlot }, (_, index) => {
    const teamNumber = index + 1
    return byNumber.get(teamNumber) ?? { teamNumber, empty: true }
  })
}

function Switch({
  checked,
  disabled,
  danger,
  label,
  onToggle,
}: {
  checked: boolean
  disabled?: boolean
  danger?: boolean
  label: string
  onToggle: (next: boolean) => void
}) {
  return (
    <div className="team-toggle">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`switch${checked ? ' is-on' : ''}${danger ? ' is-danger' : ''}`}
        disabled={disabled}
        onClick={() => onToggle(!checked)}
      />
    </div>
  )
}

export default function AccountDetails({
  account,
  canEdit,
  canEditPrivileged,
  onBack,
  onUpdated,
}: AccountDetailsProps) {
  const [form, setForm] = useState(() => formFromAccount(account))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [teams, setTeams] = useState<AccountTeam[]>(account.teams ?? [])
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [teamsError, setTeamsError] = useState('')
  const [teamsStatus, setTeamsStatus] = useState('')
  const [savingTeamIds, setSavingTeamIds] = useState<string[]>([])
  const [pendingTeamAction, setPendingTeamAction] = useState<PendingTeamAction | null>(null)
  const [enableReason, setEnableReason] = useState('')
  const [enableReasonError, setEnableReasonError] = useState('')

  const fieldsDisabled = !canEdit || !editing || saving
  const locationDisabled = !canEditPrivileged || fieldsDisabled

  useEffect(() => {
    setForm(formFromAccount(account))
  }, [account])

  useEffect(() => {
    setEditing(false)
    setError('')
    setStatus('')
  }, [account.id])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setTeamsError('Your session expired. Please log in again.')
      setTeamsLoading(false)
      return
    }

    let cancelled = false
    setTeamsLoading(true)
    setTeamsError('')
    setTeamsStatus('')
    setTeams(account.teams ?? [])

    void getAccountTeams(account.id, token)
      .then((nextTeams) => {
        if (!cancelled) {
          setTeams(nextTeams)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setTeamsError(
            err instanceof Error && err.message.trim()
              ? err.message.trim()
              : 'Unable to load teams. Please try again.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTeamsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [account.id])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleCancelEdit() {
    setForm(formFromAccount(account))
    setEditing(false)
    setError('')
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canEdit) {
      return
    }

    setError('')
    setStatus('')

    if (canEditPrivileged) {
      if (!Number.isFinite(form.numberOfTeams) || form.numberOfTeams < 0) {
        setError('Number of teams must be zero or greater.')
        return
      }
      if (!Number.isFinite(form.numberOfReboot) || form.numberOfReboot < 0) {
        setError('Number of reboots must be zero or greater.')
        return
      }
    }

    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }

    const payload: UpdateAccountPayload = {
      isOffline: form.isOffline,
      logoutButton: form.logoutButton,
    }

    if (canEditPrivileged) {
      payload.numberOfTeams = Math.floor(form.numberOfTeams)
      payload.numberOfReboot = Math.floor(form.numberOfReboot)
      payload.appConfiguration = Math.floor(form.appConfiguration)
      payload.role = form.role
      payload.country = form.country.trim()
      payload.sanghat = form.sanghat.trim()
      payload.jilha = form.jilha.trim()
      payload.taluka = form.taluka.trim()
      payload.group = form.group.trim()
      payload.kendra = form.kendra.trim()
      payload.sanchalakName = form.sanchalakName.trim()
      if (form.password) {
        payload.password = form.password
      }
    }

    setSaving(true)
    try {
      const updated = await updateAccount(account.id, payload, token)
      const nextAccount = { ...account, ...updated, teams }
      setEditing(false)
      setForm(formFromAccount(nextAccount))
      onUpdated(
        nextAccount,
        `Updated ${nextAccount.sanchalakName || nextAccount.phoneNumber || 'account'}.`,
      )
      setStatus(`Updated ${nextAccount.sanchalakName || nextAccount.phoneNumber || 'account'}.`)
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Unable to update account. Please try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleTeamUpdate(team: AccountTeam, patch: UpdateAccountTeamPayload) {
    const token = getToken()
    if (!token) {
      setTeamsError('Your session expired. Please log in again.')
      return
    }

    setTeamsError('')
    setTeamsStatus('')
    const { reason: _reason, ...teamFields } = patch
    setTeams((current) =>
      current.map((item) => (item.id === team.id ? { ...item, ...teamFields } : item)),
    )
    setSavingTeamIds((current) => (current.includes(team.id) ? current : [...current, team.id]))

    try {
      const updated = await updateAccountTeam(account.id, team.id, patch, token)
      setTeams((current) =>
        current.map((item) =>
          item.id === team.id ? { ...item, ...teamFields, ...(updated ?? {}) } : item,
        ),
      )
      const changed =
        patch.isLoginDisabled != null
          ? patch.isLoginDisabled
            ? 'Login disabled'
            : 'Login enabled'
          : 'Reset password'
      setTeamsStatus(`Updated Team ${team.teamNumber}: ${changed}.`)
    } catch (err) {
      setTeams((current) => current.map((item) => (item.id === team.id ? team : item)))
      setTeamsError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : `Unable to update Team ${team.teamNumber}. Please try again.`,
      )
    } finally {
      setSavingTeamIds((current) => current.filter((id) => id !== team.id))
    }
  }

  function requestTeamAction(team: AccountTeam, kind: 'reset' | 'enable-login' | 'disable-login') {
    if (kind === 'reset') {
      setPendingTeamAction({
        team,
        title: 'Reset password',
        description: `Reset the password for Team ${team.teamNumber}? They will need to set a new password.`,
        patch: { setPassword: false },
      })
      return
    }

    if (kind === 'enable-login') {
      setEnableReason('')
      setEnableReasonError('')
      setPendingTeamAction({
        team,
        title: 'Enable login',
        description: `Enable login for Team ${team.teamNumber}? Enter a valid reason to enable the user.`,
        patch: { isLoginDisabled: false },
        requiresReason: true,
      })
      return
    }

    setPendingTeamAction({
      team,
      title: 'Disable login',
      description: `Disable login for Team ${team.teamNumber}? They will not be able to log in.`,
      patch: { isLoginDisabled: true },
    })
  }

  function closePendingTeamAction() {
    setPendingTeamAction(null)
    setEnableReason('')
    setEnableReasonError('')
  }

  function confirmPendingTeamAction() {
    if (!pendingTeamAction) {
      return
    }

    if (pendingTeamAction.requiresReason) {
      const reason = enableReason.trim()
      if (reason.length < ENABLE_REASON_MIN_LENGTH) {
        setEnableReasonError('Enter a valid reason to enable the user (at least 10 characters).')
        return
      }

      const action = pendingTeamAction
      closePendingTeamAction()
      void handleTeamUpdate(action.team, { ...action.patch, reason })
      return
    }

    const action = pendingTeamAction
    closePendingTeamAction()
    void handleTeamUpdate(action.team, action.patch)
  }

  const title = account.sanchalakName?.trim() || account.phoneNumber
  const slots = teamSlots(account, teams)
  const loggedInCount = teams.length
  const configuredCount = account.numberOfTeams ?? 0

  return (
    <div className="page-panel users-page account-details">
      <div className="page-header">
        <div className="page-header-copy">
          <button type="button" className="btn btn-secondary btn-compact" onClick={onBack}>
            Back
          </button>
          <p className="eyebrow">Account</p>
          <h1>{title}</h1>
          <p className="page-subtitle">{account.phoneNumber}</p>
        </div>
        {canEdit && (
          <div className="page-actions">
            {editing ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="account-details-form"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
      {status && !error && <p className="form-success">{status}</p>}

      <section className="account-details-section">
        <div className="account-details-section-header">
          <h2>Teams</h2>
          <p>
            {loggedInCount} of {configuredCount} logged in
          </p>
        </div>
        {teamsError && <p className="form-error">{teamsError}</p>}
        {teamsStatus && !teamsError && <p className="form-success">{teamsStatus}</p>}
        {teamsLoading ? (
          <p className="teams-empty">Loading teams...</p>
        ) : slots.length === 0 ? (
          <p className="teams-empty">No teams configured yet.</p>
        ) : (
          <div className="teams-layout">
            {slots.some((slot) => !isEmptySlot(slot)) && (
              <div className="teams-grid">
                {slots.map((slot) => {
                  if (isEmptySlot(slot)) {
                    return null
                  }

                  const savingTeam = savingTeamIds.includes(slot.id)
                  return (
                    <article
                      key={slot.id}
                      className={`team-card${slot.isLoginDisabled ? ' is-blocked' : ''}`}
                    >
                      <div className="team-card-header">
                        <span className="team-badge">{slot.teamNumber}</span>
                        <div>
                          <p className="team-card-title">Team {slot.teamNumber}</p>
                          <p className="team-card-meta">
                            Last login {formatDate(slot.lastLoginTime)}
                          </p>
                        </div>
                      </div>
                      <div className="team-toggle">
                        <span>Reset password</span>
                        <span className="team-action-tip">
                          <button
                            type="button"
                            className="btn btn-secondary btn-compact"
                            disabled={savingTeam || !slot.setPassword}
                            aria-describedby={
                              slot.setPassword ? undefined : `reset-password-tip-${slot.id}`
                            }
                            onClick={() => requestTeamAction(slot, 'reset')}
                          >
                            Reset
                          </button>
                          {!slot.setPassword && (
                            <span
                              id={`reset-password-tip-${slot.id}`}
                              className="team-tooltip"
                              role="tooltip"
                            >
                              Password not set yet
                            </span>
                          )}
                        </span>
                      </div>
                      {slot.isLoginDisabled ? (
                        <div className="team-toggle">
                          <span>Login disabled</span>
                          <button
                            type="button"
                            className="btn btn-compact btn-primary"
                            disabled={savingTeam}
                            onClick={() => requestTeamAction(slot, 'enable-login')}
                          >
                            Enable
                          </button>
                        </div>
                      ) : canEditPrivileged ? (
                        <Switch
                          label="Login disabled"
                          checked={false}
                          disabled={savingTeam}
                          danger
                          onToggle={() => requestTeamAction(slot, 'disable-login')}
                        />
                      ) : (
                        <div className="team-toggle">
                          <span>Login disabled</span>
                          <span className="team-toggle-value">No</span>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
            {slots.some(isEmptySlot) && (
              <div className="teams-waiting">
                <p className="teams-waiting-label">Waiting to log in</p>
                <div className="teams-waiting-list">
                  {slots.filter(isEmptySlot).map((slot) => (
                    <span key={`empty-${slot.teamNumber}`} className="team-chip">
                      <span className="team-chip-number">{slot.teamNumber}</span>
                      Team {slot.teamNumber}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="account-details-section">
        <h2>Details</h2>
        <form id="account-details-form" className="stack-form account-details-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="account-jilha">Jilha</label>
            <input
              id="account-jilha"
              type="text"
              value={form.jilha}
              onChange={(event) => update('jilha', event.target.value)}
              disabled={locationDisabled}
            />
          </div>
          <div className="form-field">
            <label htmlFor="account-taluka">Taluka</label>
            <input
              id="account-taluka"
              type="text"
              value={form.taluka}
              onChange={(event) => update('taluka', event.target.value)}
              disabled={locationDisabled}
            />
          </div>

          <div className="form-field">
            <label htmlFor="account-group">Group</label>
            <input
              id="account-group"
              type="text"
              value={form.group}
              onChange={(event) => update('group', event.target.value)}
              disabled={locationDisabled}
            />
          </div>
          <div className="form-field">
            <label htmlFor="account-kendra">Kendra</label>
            <input
              id="account-kendra"
              type="text"
              value={form.kendra}
              onChange={(event) => update('kendra', event.target.value)}
              disabled={locationDisabled}
            />
          </div>
        </div>

        <div className="checkbox-grid">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={form.isOffline}
              onChange={(event) => update('isOffline', event.target.checked)}
              disabled={fieldsDisabled}
            />
            <span>Offline</span>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={form.logoutButton}
              onChange={(event) => update('logoutButton', event.target.checked)}
              disabled={fieldsDisabled}
            />
            <span>Logout button</span>
          </label>
        </div>

        {canEditPrivileged && (
          <details className="account-more-details">
            <summary>More details</summary>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="account-phone">Phone</label>
                <input id="account-phone" type="text" value={account.phoneNumber} disabled />
              </div>
              <div className="form-field">
                <label htmlFor="account-role">Role</label>
                <select
                  id="account-role"
                  value={form.role}
                  onChange={(event) => update('role', event.target.value as AccountRoleValue)}
                  disabled={fieldsDisabled}
                >
                  {ACCOUNT_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field span-2">
                <label htmlFor="account-sanchalak">Sanchalak name</label>
                <input
                  id="account-sanchalak"
                  type="text"
                  value={form.sanchalakName}
                  onChange={(event) => update('sanchalakName', event.target.value)}
                  disabled={fieldsDisabled}
                />
              </div>

              <div className="form-field">
                <label htmlFor="account-country">Country</label>
                <input
                  id="account-country"
                  type="text"
                  value={form.country}
                  onChange={(event) => update('country', event.target.value)}
                  disabled={fieldsDisabled}
                />
              </div>
              <div className="form-field">
                <label htmlFor="account-sanghat">Sanghat</label>
                <input
                  id="account-sanghat"
                  type="text"
                  value={form.sanghat}
                  onChange={(event) => update('sanghat', event.target.value)}
                  disabled={fieldsDisabled}
                />
              </div>

              <div className="form-field">
                <label htmlFor="account-number-of-teams">Number of teams</label>
                <input
                  id="account-number-of-teams"
                  type="number"
                  min={0}
                  step={1}
                  value={form.numberOfTeams}
                  onChange={(event) => update('numberOfTeams', Number(event.target.value))}
                  disabled={fieldsDisabled}
                />
              </div>
              <div className="form-field">
                <label htmlFor="account-number-of-reboot">Number of reboot</label>
                <input
                  id="account-number-of-reboot"
                  type="number"
                  min={0}
                  step={1}
                  value={form.numberOfReboot}
                  onChange={(event) => update('numberOfReboot', Number(event.target.value))}
                  disabled={fieldsDisabled}
                />
              </div>

              <div className="form-field">
                <label htmlFor="account-app-configuration">App configuration</label>
                <input
                  id="account-app-configuration"
                  type="number"
                  step={1}
                  value={form.appConfiguration}
                  onChange={(event) => update('appConfiguration', Number(event.target.value))}
                  disabled={fieldsDisabled}
                />
              </div>
              <div className="form-field">
                <label htmlFor="account-created">Created</label>
                <input id="account-created" type="text" value={formatDate(account.createdAt)} disabled />
              </div>

              <div className="form-field">
                <label htmlFor="account-updated">Updated</label>
                <input id="account-updated" type="text" value={formatDate(account.updatedAt)} disabled />
              </div>
              <div className="form-field">
                <label htmlFor="account-id">Account ID</label>
                <input id="account-id" type="text" value={account.id} disabled />
              </div>
              <div className="form-field span-2">
                <label htmlFor="account-metadata">Metadata</label>
                <textarea
                  id="account-metadata"
                  rows={4}
                  value={formatMetadata(account.metadata)}
                  disabled
                />
              </div>
              {editing && canEdit && (
                <div className="form-field span-2">
                  <label htmlFor="account-password">New password</label>
                  <PasswordInput
                    id="account-password"
                    value={form.password}
                    onChange={(event) => update('password', event.target.value)}
                    disabled={saving}
                    autoComplete="new-password"
                    placeholder="Leave blank to keep current"
                  />
                </div>
              )}
            </div>
          </details>
        )}
      </form>
      </section>

      {pendingTeamAction && (
        <Modal
          title={pendingTeamAction.title}
          description={pendingTeamAction.description}
          labelledBy="team-action-confirm-title"
          onClose={closePendingTeamAction}
        >
          {pendingTeamAction.requiresReason && (
            <div className="form-field">
              <label htmlFor="enable-login-reason">Reason</label>
              <textarea
                id="enable-login-reason"
                rows={4}
                value={enableReason}
                onChange={(event) => {
                  setEnableReason(event.target.value)
                  if (enableReasonError) {
                    setEnableReasonError('')
                  }
                }}
                placeholder="Enter a valid reason to enable the user"
                autoFocus
              />
              {(enableReasonError || enableReason.trim().length < ENABLE_REASON_MIN_LENGTH) && (
                <p className={enableReasonError ? 'form-error' : 'field-hint'}>
                  {enableReasonError ||
                    `${ENABLE_REASON_MIN_LENGTH - enableReason.trim().length} more characters required`}
                </p>
              )}
            </div>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closePendingTeamAction}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={confirmPendingTeamAction}
              disabled={
                Boolean(pendingTeamAction.requiresReason) &&
                enableReason.trim().length < ENABLE_REASON_MIN_LENGTH
              }
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
