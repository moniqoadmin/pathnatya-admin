import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import RequireRole from './components/RequireRole'
import CreationPage from './pages/CreationPage'
import DashboardPage from './pages/DashboardPage'
import ListUsersPage from './pages/ListUsersPage'
import LoginPage from './pages/LoginPage'
import SetPasswordPage from './pages/SetPasswordPage'
import SolutionsPage from './pages/SolutionsPage'
import { canAccessAdmin } from './lib/roles'
import { clearSession, getAccount, isAuthenticated } from './lib/session'
import './App.css'

function PublicOnly() {
  if (isAuthenticated()) {
    const account = getAccount()
    if (account && canAccessAdmin(account.role)) {
      return <Navigate to="/dashboard" replace />
    }
    clearSession()
  }
  return <Outlet />
}

function RequireAuth() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  const account = getAccount()
  if (!account || !canAccessAdmin(account.role)) {
    clearSession()
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route element={<RequireRole />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/creation" element={<CreationPage />} />
              <Route path="/users" element={<ListUsersPage />} />
              <Route path="/solutions" element={<SolutionsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
