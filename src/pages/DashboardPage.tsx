import { Navigate } from 'react-router-dom'
import { SHOULD_SHOW_DOWNLOAD_PAGE_TO_ADMIN } from '../api/config'
import DownloadCards from '../components/DownloadCards'
import LoginAnalytics from '../components/LoginAnalytics'
import { SHOW_ANALYTICS_KEY, useEntitlementEnabled } from '../lib/entitlements-store'
import { canSeeAdminDownloads, canViewLoginAnalytics } from '../lib/roles'
import { getAccount, isAuthenticated } from '../lib/session'

function formatValue(value: string | null | undefined): string {
  if (!value || !String(value).trim()) {
    return '—'
  }
  return String(value)
}

export default function DashboardPage() {
  const account = getAccount()
  const showAnalytics = useEntitlementEnabled(SHOW_ANALYTICS_KEY)

  if (!isAuthenticated() || !account) {
    return <Navigate to="/login" replace />
  }

  const details = [
    { label: 'Phone', value: account.phoneNumber },
    { label: 'Role', value: account.role },
    { label: 'Status', value: account.status },
    { label: 'Sanchalak', value: account.sanchalakName },
    { label: 'Country', value: account.country },
    { label: 'Sanghat', value: account.sanghat },
    { label: 'Jilha', value: account.jilha },
    { label: 'Taluka', value: account.taluka },
    { label: 'Group', value: account.group },
    { label: 'Kendra', value: account.kendra },
    { label: 'Last login', value: account.lastLoginTime },
  ]

  return (
    <div className="page-panel">
      <section className="dashboard-hero">
        <p className="eyebrow">Signed in</p>
        <h1>
          {formatValue(account.sanchalakName) !== '—'
            ? account.sanchalakName
            : account.phoneNumber}
        </h1>
        <p className="page-subtitle">
          Manage Pathnatya accounts and operations from this console.
        </p>
      </section>

      {canViewLoginAnalytics(account.role) && showAnalytics && <LoginAnalytics />}

      {SHOULD_SHOW_DOWNLOAD_PAGE_TO_ADMIN && canSeeAdminDownloads(account.role) && (
        <section className="dashboard-downloads">
          <p className="eyebrow">Desktop app</p>
          <h2 className="dashboard-downloads-title">Download Pathnatya</h2>
          <p className="page-subtitle">
            Install the Pathnatya app on your computer. Choose Windows or macOS to get started.
          </p>
          <DownloadCards />
        </section>
      )}

      <section className="dashboard-grid">
        {details.map((item) => (
          <div key={item.label} className="detail-item">
            <span className="detail-label">{item.label}</span>
            <span className="detail-value">{formatValue(item.value)}</span>
          </div>
        ))}
      </section>
    </div>
  )
}
