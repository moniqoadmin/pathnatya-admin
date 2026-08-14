import { type FormEvent, useState } from 'react'
import {
  ACCOUNT_ROLE_OPTIONS,
  updateAccount,
  type Account,
  type AccountRoleValue,
  type UpdateAccountPayload,
} from '../api/accounts'
import { getToken } from '../lib/session'
import Modal from './Modal'
import PasswordInput from './PasswordInput'

interface EditAccountDialogProps {
  account: Account
  canEditPrivileged: boolean
  onClose: () => void
  onUpdated: (account: Account, message: string) => void
}

const ACCOUNT_STATUS_OPTIONS = ['active', 'inactive', 'suspended'] as const

function formFromAccount(account: Account) {
  const role = ACCOUNT_ROLE_OPTIONS.some((option) => option.value === account.role)
    ? (account.role as AccountRoleValue)
    : 'User'

  return {
    setPassword: Boolean(account.setPassword),
    isOffline: Boolean(account.isOffline),
    isLoginDisabled: Boolean(account.isLoginDisabled),
    domSecurity: Boolean(account.domSecurity),
    chokidar: Boolean(account.chokidar),
    numberOfTeams: account.numberOfTeams ?? 0,
    status: account.status || 'active',
    role,
    country: account.country ?? '',
    sanghat: account.sanghat ?? '',
    jilha: account.jilha ?? '',
    taluka: account.taluka ?? '',
    group: account.group ?? '',
    kendra: account.kendra ?? '',
    sanchalakName: account.sanchalakName ?? '',
    password: '',
  }
}

export default function EditAccountDialog({
  account,
  canEditPrivileged,
  onClose,
  onUpdated,
}: EditAccountDialogProps) {
  const [form, setForm] = useState(() => formFromAccount(account))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (!Number.isFinite(form.numberOfTeams) || form.numberOfTeams < 0) {
      setError('Number of teams must be zero or greater.')
      return
    }

    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }

    const payload: UpdateAccountPayload = {
      setPassword: form.setPassword,
      isOffline: form.isOffline,
      isLoginDisabled: form.isLoginDisabled,
      domSecurity: form.domSecurity,
      chokidar: form.chokidar,
      numberOfTeams: Math.floor(form.numberOfTeams),
    }

    if (canEditPrivileged) {
      payload.status = form.status.trim() || 'active'
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

    setLoading(true)
    try {
      const updated = await updateAccount(account.id, payload, token)
      onUpdated(
        updated,
        `Updated ${updated.sanchalakName || updated.phoneNumber || 'account'}.`,
      )
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Unable to update account. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Edit account"
      description={
        canEditPrivileged
          ? `Update flags, organisation details, role, and password for ${account.phoneNumber}.`
          : `Update login and security flags for ${account.phoneNumber}.`
      }
      labelledBy="edit-account-title"
      busy={loading}
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={handleSubmit}>
        <div className="checkbox-grid">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={form.setPassword}
              onChange={(event) => update('setPassword', event.target.checked)}
              disabled={loading}
            />
            <span>Password set</span>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={form.isOffline}
              onChange={(event) => update('isOffline', event.target.checked)}
              disabled={loading}
            />
            <span>Offline</span>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={form.isLoginDisabled}
              onChange={(event) => update('isLoginDisabled', event.target.checked)}
              disabled={loading}
            />
            <span>Login disabled</span>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={form.domSecurity}
              onChange={(event) => update('domSecurity', event.target.checked)}
              disabled={loading}
            />
            <span>DOM security</span>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={form.chokidar}
              onChange={(event) => update('chokidar', event.target.checked)}
              disabled={loading}
            />
            <span>Chokidar</span>
          </label>
        </div>

        <div className="form-field">
          <label htmlFor="edit-number-of-teams">Number of teams</label>
          <input
            id="edit-number-of-teams"
            type="number"
            min={0}
            step={1}
            value={form.numberOfTeams}
            onChange={(event) => update('numberOfTeams', Number(event.target.value))}
            disabled={loading}
          />
        </div>

        {canEditPrivileged && (
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="edit-status">Status</label>
              <select
                id="edit-status"
                value={form.status}
                onChange={(event) => update('status', event.target.value)}
                disabled={loading}
              >
                {!ACCOUNT_STATUS_OPTIONS.includes(
                  form.status as (typeof ACCOUNT_STATUS_OPTIONS)[number],
                ) && <option value={form.status}>{form.status}</option>}
                {ACCOUNT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="edit-role">Role</label>
              <select
                id="edit-role"
                value={form.role}
                onChange={(event) => update('role', event.target.value as AccountRoleValue)}
                disabled={loading}
              >
                {ACCOUNT_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field span-2">
              <label htmlFor="edit-sanchalak">Sanchalak name</label>
              <input
                id="edit-sanchalak"
                type="text"
                value={form.sanchalakName}
                onChange={(event) => update('sanchalakName', event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-field">
              <label htmlFor="edit-country">Country</label>
              <input
                id="edit-country"
                type="text"
                value={form.country}
                onChange={(event) => update('country', event.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-field">
              <label htmlFor="edit-sanghat">Sanghat</label>
              <input
                id="edit-sanghat"
                type="text"
                value={form.sanghat}
                onChange={(event) => update('sanghat', event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-field">
              <label htmlFor="edit-jilha">Jilha</label>
              <input
                id="edit-jilha"
                type="text"
                value={form.jilha}
                onChange={(event) => update('jilha', event.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-field">
              <label htmlFor="edit-taluka">Taluka</label>
              <input
                id="edit-taluka"
                type="text"
                value={form.taluka}
                onChange={(event) => update('taluka', event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-field">
              <label htmlFor="edit-group">Group</label>
              <input
                id="edit-group"
                type="text"
                value={form.group}
                onChange={(event) => update('group', event.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-field">
              <label htmlFor="edit-kendra">Kendra</label>
              <input
                id="edit-kendra"
                type="text"
                value={form.kendra}
                onChange={(event) => update('kendra', event.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-field span-2">
              <label htmlFor="edit-password">New password</label>
              <PasswordInput
                id="edit-password"
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
                disabled={loading}
                autoComplete="new-password"
                placeholder="Leave blank to keep current"
              />
            </div>
          </div>
        )}

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
