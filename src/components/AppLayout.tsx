import { useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { canAccessAdmin, getHomePath, getNavItemsForRole, isUser } from '../lib/roles'
import { clearSession, getAccount, isAuthenticated } from '../lib/session'

export default function AppLayout() {
  const navigate = useNavigate()
  const account = getAccount()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!isAuthenticated() || !account) {
    return <Navigate to="/login" replace />
  }

  if (isUser(account.role)) {
    return <Navigate to={getHomePath(account.role)} replace />
  }

  if (!canAccessAdmin(account.role)) {
    clearSession()
    return <Navigate to="/login" replace />
  }

  const navItems = getNavItemsForRole(account.role)
  const displayName =
    account.sanchalakName?.trim() || account.phoneNumber || 'Account'

  function handleLogout() {
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`app-shell${mobileOpen ? ' sidebar-open' : ''}`}>
      <aside className="app-sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <p className="brand-mark">Pathnatya</p>
          <p className="sidebar-tagline">Admin Console</p>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' is-active' : ''}`
              }
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-user-name">{displayName}</span>
            {account.role && (
              <span className="sidebar-user-role">{account.role}</span>
            )}
          </div>
          <button type="button" className="btn btn-secondary sidebar-logout" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="sidebar-toggle"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <p className="brand-mark mobile-brand">Pathnatya</p>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
