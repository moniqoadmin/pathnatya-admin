import { type FormEvent, useState } from 'react'
import {
  ACCOUNT_ROLE_OPTIONS,
  createAccount,
  type Account,
  type AccountRoleValue,
} from '../api/accounts'
import { isAdmin } from '../lib/roles'
import { getToken } from '../lib/session'
import Modal from './Modal'

interface CreateAccountDialogProps {
  actor: Account | null
  onClose: () => void
  onCreated: (message: string) => void
}

const COUNTRY_CODES = [
  { code: '91', country: 'India' },
  { code: '44', country: 'UK' },
  { code: '1', country: 'US' },
] as const

const DEFAULTS = {
  countryCode: '91',
  phoneNumber: '',
  role: 'User' as AccountRoleValue,
  sanchalakName: '',
  country: 'India',
  sanghat: '',
  jilha: '',
  taluka: '',
  group: '',
  kendra: '',
  numberOfTeams: 1,
  numberOfReboot: 0,
  appConfiguration: 1,
  logoutButton: false,
  isOffline: true,
  source: 'curl',
}

function optional(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed || undefined
}

function countryFromCode(code: string): string {
  return COUNTRY_CODES.find((item) => item.code === code)?.country ?? ''
}

function wholeNumber(value: number, fallback: number, min: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  return Math.max(min, Math.floor(value))
}

function formFromActor(actor: Account | null) {
  const adminOnly = isAdmin(actor?.role)
  return {
    ...DEFAULTS,
    country: actor?.country?.trim() || DEFAULTS.country,
    sanghat: adminOnly ? actor?.sanghat?.trim() || DEFAULTS.sanghat : DEFAULTS.sanghat,
    jilha: adminOnly ? actor?.jilha?.trim() || DEFAULTS.jilha : DEFAULTS.jilha,
    taluka: adminOnly ? actor?.taluka?.trim() || DEFAULTS.taluka : DEFAULTS.taluka,
    group: adminOnly ? actor?.group?.trim() || DEFAULTS.group : DEFAULTS.group,
    kendra: adminOnly ? actor?.kendra?.trim() || DEFAULTS.kendra : DEFAULTS.kendra,
  }
}

export default function CreateAccountDialog({
  actor,
  onClose,
  onCreated,
}: CreateAccountDialogProps) {
  const adminOnly = isAdmin(actor?.role)
  const [form, setForm] = useState(() => formFromActor(actor))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update<K extends keyof typeof DEFAULTS>(key: K, value: (typeof DEFAULTS)[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleCountryCodeChange(value: string) {
    const countryCode = value.replace(/\D/g, '').slice(0, 4)
    setForm((current) => {
      const mapped = countryFromCode(countryCode)
      const shouldUpdateCountry =
        !current.country.trim() || current.country === countryFromCode(current.countryCode)
      return {
        ...current,
        countryCode,
        country: shouldUpdateCountry && mapped ? mapped : current.country,
      }
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    const countryCode = form.countryCode.trim()
    if (!countryCode) {
      setError('Please enter a country extension, for example 91.')
      return
    }

    const phoneNumber = form.phoneNumber.trim()
    if (!/^\d{10}$/.test(phoneNumber)) {
      setError('Please enter a valid 10-digit mobile number.')
      return
    }

    const sanchalakName = form.sanchalakName.trim()
    if (!sanchalakName) {
      setError('Please enter a sanchalak name.')
      return
    }

    const sanghat = form.sanghat.trim()
    if (!sanghat) {
      setError('Please enter a sanghat.')
      return
    }

    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }

    setLoading(true)
    try {
      const account = await createAccount(
        {
          phoneNumber,
          role: adminOnly ? 'User' : form.role,
          sanchalakName,
          country: optional(form.country) ?? optional(countryFromCode(countryCode)),
          sanghat,
          jilha: optional(form.jilha),
          taluka: optional(form.taluka),
          group: optional(form.group),
          kendra: optional(form.kendra),
          numberOfTeams: wholeNumber(form.numberOfTeams, DEFAULTS.numberOfTeams, 1),
          numberOfReboot: wholeNumber(form.numberOfReboot, DEFAULTS.numberOfReboot, 0),
          appConfiguration: wholeNumber(form.appConfiguration, DEFAULTS.appConfiguration, 1),
          logoutButton: form.logoutButton,
          isOffline: form.isOffline,
          metadata: {
            source: form.source.trim() || DEFAULTS.source,
            countryCode,
          },
        },
        token,
      )

      onCreated(
        `Account created for ${account.sanchalakName || account.phoneNumber} (${account.role ?? form.role}).`,
      )
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Unable to create account. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Create account"
      description={
        adminOnly
          ? 'Admins can create User accounts in their own sanghat. Defaults are filled in — change them if needed.'
          : 'Add a Pathnatya account. Defaults are filled in — change them if needed.'
      }
      labelledBy="create-account-title"
      busy={loading}
      wide
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="phone-pair span-2">
            <div className="form-field">
              <label htmlFor="create-extension">Extension</label>
              <div className="extension-input">
                <span aria-hidden="true">+</span>
                <input
                  id="create-extension"
                  type="tel"
                  inputMode="numeric"
                  placeholder="91"
                  value={form.countryCode}
                  onChange={(event) => handleCountryCodeChange(event.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="create-phone">Mobile number</label>
              <input
                id="create-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="9876543210"
                value={form.phoneNumber}
                onChange={(event) =>
                  update('phoneNumber', event.target.value.replace(/\D/g, '').slice(0, 10))
                }
                disabled={loading}
                required
              />
            </div>
          </div>

          <p className="field-hint span-2">
            Required. 10 digits only for US, UK, or India — no country code, spaces, or extension.
          </p>

          <div className="form-field">
            <label htmlFor="create-role">Role</label>
            <select
              id="create-role"
              value={adminOnly ? 'User' : form.role}
              onChange={(event) => update('role', event.target.value as AccountRoleValue)}
              disabled={loading || adminOnly}
            >
              {ACCOUNT_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="create-sanchalak">Sanchalak name</label>
            <input
              id="create-sanchalak"
              type="text"
              value={form.sanchalakName}
              onChange={(event) => update('sanchalakName', event.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="create-country">Country</label>
            <input
              id="create-country"
              type="text"
              value={form.country}
              onChange={(event) => update('country', event.target.value)}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="create-sanghat">Sanghat</label>
            <input
              id="create-sanghat"
              type="text"
              value={form.sanghat}
              onChange={(event) => update('sanghat', event.target.value)}
              disabled={loading || adminOnly}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="create-jilha">Jilha</label>
            <input
              id="create-jilha"
              type="text"
              value={form.jilha}
              onChange={(event) => update('jilha', event.target.value)}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="create-taluka">Taluka</label>
            <input
              id="create-taluka"
              type="text"
              value={form.taluka}
              onChange={(event) => update('taluka', event.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="create-group">Group</label>
            <input
              id="create-group"
              type="text"
              value={form.group}
              onChange={(event) => update('group', event.target.value)}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="create-kendra">Kendra</label>
            <input
              id="create-kendra"
              type="text"
              value={form.kendra}
              onChange={(event) => update('kendra', event.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="create-number-of-teams">Number of teams</label>
            <input
              id="create-number-of-teams"
              type="number"
              min={1}
              step={1}
              value={form.numberOfTeams}
              onChange={(event) => update('numberOfTeams', Number(event.target.value))}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="create-number-of-reboot">No. of reboot</label>
            <input
              id="create-number-of-reboot"
              type="number"
              min={0}
              step={1}
              value={form.numberOfReboot}
              onChange={(event) => update('numberOfReboot', Number(event.target.value))}
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="create-app-configuration">App configuration</label>
            <input
              id="create-app-configuration"
              type="number"
              min={1}
              step={1}
              value={form.appConfiguration}
              onChange={(event) => update('appConfiguration', Number(event.target.value))}
              disabled={loading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="create-source">Source</label>
            <input
              id="create-source"
              type="text"
              value={form.source}
              onChange={(event) => update('source', event.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="checkbox-grid">
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={form.logoutButton}
              onChange={(event) => update('logoutButton', event.target.checked)}
              disabled={loading}
            />
            <span>Logout button</span>
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
        </div>

        <p className="field-hint">
          Mobile number, sanchalak name, and sanghat are required. Blank values for the rest fall
          back to: role User, teams 1, reboot 0, app configuration 1, logout button off, offline
          on, source curl.
        </p>

        {adminOnly && !form.sanghat.trim() && (
          <p className="form-error">
            Your account has no sanghat. Ask a SuperAdmin to set it before creating users.
          </p>
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
          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              loading || !form.sanchalakName.trim() || !form.sanghat.trim()
            }
          >
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
