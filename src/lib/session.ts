import type { Account } from '../api/accounts'
import { isUser } from './roles'

const TOKEN_KEY = 'pathnatya-admin-token'
const ACCOUNT_KEY = 'pathnatya-admin-account'
const PHONE_KEY = 'pathnatya-admin-pending-phone'
const VERIFIED_USER_KEY = 'pathnatya-verified-user'

export interface VerifiedUserAccess {
  phoneNumber: string
  role: string
}

export function saveSession(token: string, account: Account): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account))
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ACCOUNT_KEY)
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getAccount(): Account | null {
  const raw = localStorage.getItem(ACCOUNT_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as Account
  } catch {
    return null
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getToken() && getAccount())
}

export function savePendingPhone(phoneNumber: string): void {
  sessionStorage.setItem(PHONE_KEY, phoneNumber)
}

export function getPendingPhone(): string | null {
  return sessionStorage.getItem(PHONE_KEY)
}

export function clearPendingPhone(): void {
  sessionStorage.removeItem(PHONE_KEY)
}

export function saveVerifiedUser(phoneNumber: string, role: string): void {
  sessionStorage.setItem(VERIFIED_USER_KEY, JSON.stringify({ phoneNumber, role }))
}

export function getVerifiedUser(): VerifiedUserAccess | null {
  const raw = sessionStorage.getItem(VERIFIED_USER_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as VerifiedUserAccess
    if (!parsed?.phoneNumber || !isUser(parsed.role)) {
      sessionStorage.removeItem(VERIFIED_USER_KEY)
      return null
    }
    return parsed
  } catch {
    sessionStorage.removeItem(VERIFIED_USER_KEY)
    return null
  }
}

export function clearVerifiedUser(): void {
  sessionStorage.removeItem(VERIFIED_USER_KEY)
}

export function hasDownloadAccess(): boolean {
  if (getVerifiedUser()) {
    return true
  }

  const account = getAccount()
  return isAuthenticated() && isUser(account?.role)
}
