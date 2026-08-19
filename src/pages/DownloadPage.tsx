import { Navigate, useNavigate } from 'react-router-dom'
import DownloadCards from '../components/DownloadCards'
import {
  clearSession,
  clearVerifiedUser,
  getAccount,
  getVerifiedUser,
  hasDownloadAccess,
} from '../lib/session'

export default function DownloadPage() {
  const navigate = useNavigate()
  const verifiedUser = getVerifiedUser()
  const account = getAccount()

  if (!hasDownloadAccess()) {
    return <Navigate to="/login" replace />
  }

  const displayName =
    account?.sanchalakName?.trim() ||
    verifiedUser?.phoneNumber ||
    account?.phoneNumber ||
    'Account'

  function handleLogout() {
    clearVerifiedUser()
    clearSession()
    navigate('/login', { replace: true })
  }

  return (
    <div className="download-shell">
      <header className="download-topbar">
        <p className="brand-mark">Pathnatya</p>
        <div className="download-topbar-user">
          <div className="sidebar-user">
            <span className="sidebar-user-name">{displayName}</span>
            <span className="sidebar-user-role">User</span>
          </div>
          <button type="button" className="btn btn-secondary btn-compact" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="download-main">
        <section className="download-hero">
          <p className="eyebrow">Desktop app</p>
          <h1>Download Pathnatya</h1>
          <p className="page-subtitle">
            Install the Pathnatya app on your computer. Choose Windows or macOS to get started.
          </p>
        </section>

        <DownloadCards />
      </main>
    </div>
  )
}
