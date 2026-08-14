import { useState } from 'react'
import BulkUploadDialog from '../components/BulkUploadDialog'
import CreateAccountDialog from '../components/CreateAccountDialog'
import { isSuperAdmin } from '../lib/roles'
import { getAccount } from '../lib/session'

export default function CreationPage() {
  const account = getAccount()
  const [showCreate, setShowCreate] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(
    null,
  )

  const canManageAccounts = isSuperAdmin(account?.role)

  return (
    <div className="page-panel">
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">Creation</p>
          <h1>Creation</h1>
          <p className="page-subtitle">Create and manage Pathnatya content from here.</p>
        </div>

        {canManageAccounts && (
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setStatus(null)
                setShowUpload(true)
              }}
            >
              Bulk upload
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setStatus(null)
                setShowCreate(true)
              }}
            >
              Create
            </button>
          </div>
        )}
      </div>

      {status && (
        <p className={status.kind === 'error' ? 'form-error' : 'form-success'}>{status.text}</p>
      )}

      {showUpload && <BulkUploadDialog onClose={() => setShowUpload(false)} />}

      {showCreate && (
        <CreateAccountDialog
          onClose={() => setShowCreate(false)}
          onCreated={(message) => {
            setShowCreate(false)
            setStatus({ kind: 'success', text: message })
          }}
        />
      )}
    </div>
  )
}
