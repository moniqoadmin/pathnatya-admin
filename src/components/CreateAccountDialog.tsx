import { type FormEvent, useState } from 'react'
import {
  ACCOUNT_ROLE_OPTIONS,
  createAccount,
  type AccountRoleValue,
} from '../api/accounts'
import Modal from './Modal'
import { getToken } from '../lib/session'

interface CreateAccountDialogProps {
  onClose: () => void
  onCreated: (message: string) => void
}

const COUNTRY_CODES = [
  { code: '91', country: 'India' },
  { code: '44', country: 'UK' },
  { code: '1', country: 'US' },
] as const

const EMPTY_FORM = {
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
}

function optional(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed || undefined
}

function countryFromCode(code: string): string {
  return COUNTRY_CODES.find((item) => item.code === code)?.country ?? ''
}

export default function CreateAccountDialog({
  onClose,
  onCreated,
}: CreateAccountDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
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

    setLoading(true)
    try {
      const account = await createAccount(
        {
          phoneNumber,
          role: form.role,
          sanchalakName: optional(form.sanchalakName),
          country: optional(form.country) ?? optional(countryFromCode(countryCode)),
          sanghat: optional(form.sanghat),
          jilha: optional(form.jilha),
          taluka: optional(form.taluka),
          group: optional(form.group),
          kendra: optional(form.kendra),
          metadata: { source: 'admin-import', countryCode },
        },
        getToken() ?? undefined,
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
      description="Add a single Pathnatya account. Enter the country extension and 10-digit mobile number, then choose a role and organisation details."
      labelledBy="create-account-title"
      busy={loading}
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
              />
            </div>
          </div>

          <p className="field-hint span-2">Use 91 for India, 44 for the UK, or 1 for the US.</p>

          <div className="form-field span-2">
            <label htmlFor="create-role">Role</label>
            <select
              id="create-role"
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
            <label htmlFor="create-sanchalak">Sanchalak name</label>
            <input
              id="create-sanchalak"
              type="text"
              value={form.sanchalakName}
              onChange={(event) => update('sanchalakName', event.target.value)}
              disabled={loading}
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
              disabled={loading}
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
        </div>

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
            {loading ? 'Creating...' : 'Create account'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
