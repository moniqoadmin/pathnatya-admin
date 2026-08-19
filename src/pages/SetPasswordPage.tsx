import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { setPassword as setAccountPassword } from '../api/accounts'
import PasswordInput from '../components/PasswordInput'
import { getDeviceId } from '../lib/device-id'
import { getPendingPhone, savePendingPhone } from '../lib/session'

export default function SetPasswordPage() {
  const navigate = useNavigate()
  const pendingPhone = getPendingPhone()
  const [password, setPasswordValue] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!pendingPhone) {
    return <Navigate to="/login" replace />
  }

  const phoneNumber = pendingPhone

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await setAccountPassword(phoneNumber, password, getDeviceId())
      savePendingPhone(phoneNumber)
      navigate('/login', { replace: true })
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Unable to set password. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <header className="auth-header">
          <p className="brand-mark">Pathnatya</p>
          <h1>Set Password</h1>
          <p className="auth-subtitle">
            Create a password for your account. It cannot be reset later.
          </p>
        </header>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="set-phone">Phone Number</label>
          <input
            id="set-phone"
            type="tel"
            value={phoneNumber}
            readOnly
            className="input-readonly"
          />

          <label htmlFor="set-password">Password</label>
          <PasswordInput
            id="set-password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPasswordValue(event.target.value)}
            disabled={loading}
            autoFocus
          />

          <label htmlFor="confirm-password">Confirm Password</label>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={loading}
          />

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Setting password...' : 'Set Password'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/login')}
            disabled={loading}
          >
            Back
          </button>
        </form>
      </div>
    </div>
  )
}
