import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import RequireRole from './components/RequireRole'
import AuditTrailPage from './pages/AuditTrailPage'
import CreationPage from './pages/CreationPage'
import DashboardPage from './pages/DashboardPage'
import DownloadPage from './pages/DownloadPage'
import ListUsersPage from './pages/ListUsersPage'
import LoginPage from './pages/LoginPage'
import SetPasswordPage from './pages/SetPasswordPage'
import SolutionsPage from './pages/SolutionsPage'
import { ADMIN_HOME_PATH, USER_HOME_PATH, canAccessAdmin } from './lib/roles'
import { clearSession, getAccount, hasDownloadAccess, isAuthenticated } from './lib/session'
import './App.css'

function PublicOnly() {
  if (isAuthenticated()) {
    const account = getAccount()
    if (account && canAccessAdmin(account.role)) {
      return <Navigate to={ADMIN_HOME_PATH} replace />
    }
    clearSession()
  }

  if (hasDownloadAccess()) {
    return <Navigate to={USER_HOME_PATH} replace />
  }

  return <Outlet />
}

function RequireAuth() {
  if (!isAuthenticated()) {
    return <Navigate to={hasDownloadAccess() ? USER_HOME_PATH : '/login'} replace />
  }

  const account = getAccount()
  if (!account || !canAccessAdmin(account.role)) {
    if (hasDownloadAccess()) {
      return <Navigate to={USER_HOME_PATH} replace />
    }
    clearSession()
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function RequireDownloadAccess() {
  if (isAuthenticated()) {
    const account = getAccount()
    if (account && canAccessAdmin(account.role)) {
      return <Navigate to={ADMIN_HOME_PATH} replace />
    }
  }

  if (!hasDownloadAccess()) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function FallbackRoute() {
  if (isAuthenticated()) {
    const account = getAccount()
    if (account && canAccessAdmin(account.role)) {
      return <Navigate to={ADMIN_HOME_PATH} replace />
    }
    clearSession()
  }

  if (hasDownloadAccess()) {
    return <Navigate to={USER_HOME_PATH} replace />
  }

  return <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
        </Route>
        <Route element={<RequireDownloadAccess />}>
          <Route path="/download" element={<DownloadPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route element={<RequireRole />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/creation" element={<CreationPage />} />
              <Route path="/users" element={<ListUsersPage />} />
              <Route path="/solutions" element={<SolutionsPage />} />
              <Route path="/audit-trail" element={<AuditTrailPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<FallbackRoute />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
