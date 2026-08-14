import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { checkPhone, getLoginTokens, login } from '../api/accounts'
import PasswordInput from '../components/PasswordInput'
import { getDeviceId } from '../lib/device-id'
import { canAccessAdmin, normalizeRole } from '../lib/roles'
import {
  clearPendingPhone,
  getPendingPhone,
  savePendingPhone,
  saveSession,
} from '../lib/session'

type Step = 'phone' | 'password'

export default function LoginPage() {
  const navigate = useNavigate()
  const pending = getPendingPhone()
  const [step, setStep] = useState<Step>(pending ? 'password' : 'phone')
  const [phoneNumber, setPhoneNumber] = useState(pending ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handlePhoneSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    const trimmed = phoneNumber.trim()
    if (!/^\d{10}$/.test(trimmed)) {
      setError('Please enter a valid 10-digit phone number.')
      return
    }

    setLoading(true)
    try {
      const result = await checkPhone(trimmed)

      if (!result.exists) {
        setError('Wrong phone number. Please check and try again.')
        return
      }

      savePendingPhone(trimmed)

      if (result.needsPassword) {
        navigate('/set-password')
        return
      }

      setPhoneNumber(trimmed)
      setStep('password')
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Unable to verify phone number. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLoginSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')

    const trimmed = phoneNumber.trim()
    if (!/^\d{10}$/.test(trimmed)) {
      setError('Please enter a valid 10-digit phone number.')
      return
    }

    if (!password) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)
    try {
      const deviceId = getDeviceId()
      const result = await login(trimmed, password, deviceId)

      if (!canAccessAdmin(result.account.role)) {
        const role = normalizeRole(result.account.role)
        setError(
          role === 'user'
            ? 'User accounts cannot access the admin console.'
            : 'Your account does not have permission to access this console.',
        )
        return
      }

      saveSession(result.token, result.account)

      try {
        await getLoginTokens(result.token)
      } catch {
        // Token fetch is best-effort for admin; session is already saved.
      }

      clearPendingPhone()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Invalid phone number or password. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  function handleBackToPhone() {
    setStep('phone')
    setPassword('')
    setError('')
    clearPendingPhone()
  }

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <header className="auth-header">
          <p className="brand-mark">Pathnatya</p>
          <h1>Admin Login</h1>
          <p className="auth-subtitle">
            {step === 'phone'
              ? 'Enter your registered phone number to continue'
              : 'Enter your password to access the dashboard'}
          </p>
        </header>

        {step === 'phone' ? (
          <form className="auth-form" onSubmit={handlePhoneSubmit}>
            <label htmlFor="login-phone">Phone Number</label>
            <input
              id="login-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="9876543210"
              value={phoneNumber}
              onChange={(event) =>
                setPhoneNumber(event.target.value.replace(/\D/g, '').slice(0, 10))
              }
              disabled={loading}
              autoFocus
            />

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Checking...' : 'Continue'}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleLoginSubmit}>
            <label htmlFor="login-phone-readonly">Phone Number</label>
            <input
              id="login-phone-readonly"
              type="tel"
              value={phoneNumber}
              readOnly
              className="input-readonly"
            />

            <label htmlFor="login-password">Password</label>
            <PasswordInput
              id="login-password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              autoFocus
            />

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleBackToPhone}
              disabled={loading}
            >
              Back
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
