import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { canAccessPath } from '../lib/roles'
import { getAccount } from '../lib/session'

export default function RequireRole() {
  const location = useLocation()
  const account = getAccount()

  if (!account || !canAccessPath(account.role, location.pathname)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
