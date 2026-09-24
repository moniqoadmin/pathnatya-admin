import { type FormEvent, useCallback, useEffect, useState } from 'react'
import {
  deleteExcelMergeTask,
  downloadExcelMergeErrors,
  downloadExcelMergeExport,
  getExcelMergeTask,
  updateExcelMergeTask,
  type ExcelMergeTask,
} from '../../api/excel-merge'
import Modal from '../Modal'
import { getToken } from '../../lib/session'
import ColumnEditor from './ColumnEditor'
import DataTab from './DataTab'
import ErrorsTab from './ErrorsTab'
import FilesTab from './FilesTab'
import MappingTab from './MappingTab'
import { apiErrorMessage } from './format'
import { type ClubTab } from './tabs'

const TABS: { id: ClubTab; label: string }[] = [
  { id: 'files', label: 'Files' },
  { id: 'mapping', label: 'Mapping' },
  { id: 'data', label: 'Data' },
  { id: 'errors', label: 'Errors' },
]

interface ClubDataWorkspaceProps {
  taskId: string
  tab: ClubTab
  fileId: string
  onTabChange: (tab: ClubTab, fileId?: string) => void
  onBack: () => void
}

export default function ClubDataWorkspace({
  taskId,
  tab,
  fileId,
  onTabChange,
  onBack,
}: ClubDataWorkspaceProps) {
  const [task, setTask] = useState<ExcelMergeTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [downloadKind, setDownloadKind] = useState<'data' | 'errors' | ''>('')

  const refreshTask = useCallback(async () => {
    const token = getToken()
    if (!token) {
      throw new Error('Your session expired. Please log in again.')
    }
    const next = await getExcelMergeTask(taskId, token)
    setTask(next)
  }, [taskId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setNotice(null)
    void refreshTask()
      .catch((loadError) => {
        if (!cancelled) {
          setTask(null)
          setError(apiErrorMessage(loadError, 'Unable to load this task.'))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [refreshTask])

  function showNotice(kind: 'success' | 'error', text: string) {
    setNotice({ kind, text })
  }

  async function saveName(event: FormEvent) {
    event.preventDefault()
    const token = getToken()
    const nextName = name.trim()
    if (!token) {
      setDialogError('Your session expired. Please log in again.')
      return
    }
    if (!nextName) {
      setDialogError('Enter a task name.')
      return
    }
    setSaving(true)
    setDialogError('')
    try {
      await updateExcelMergeTask(
        taskId,
        { name: nextName, description: description.trim() || null },
        token,
      )
      await refreshTask()
      setRenameOpen(false)
      showNotice('success', 'Task updated.')
    } catch (saveError) {
      setDialogError(apiErrorMessage(saveError, 'Unable to rename this task.'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    const token = getToken()
    if (!token) {
      setDialogError('Your session expired. Please log in again.')
      return
    }
    setSaving(true)
    setDialogError('')
    try {
      await deleteExcelMergeTask(taskId, token)
      onBack()
    } catch (deleteError) {
      setDialogError(apiErrorMessage(deleteError, 'Unable to delete this task.'))
      setSaving(false)
    }
  }

  async function download(kind: 'data' | 'errors') {
    const token = getToken()
    if (!token || !task) {
      showNotice('error', 'Your session expired. Please log in again.')
      return
    }
    if (kind === 'data' && task.validCount === 0) {
      showNotice('error', 'There are no valid rows to download yet.')
      return
    }
    setDownloadKind(kind)
    try {
      if (kind === 'data') {
        await downloadExcelMergeExport(taskId, token)
      } else {
        await downloadExcelMergeErrors(taskId, token)
      }
    } catch (downloadError) {
      showNotice('error', apiErrorMessage(downloadError, 'Unable to download the Excel file.'))
    } finally {
      setDownloadKind('')
    }
  }

  if (loading && !task) {
    return (
      <div className="page-panel club-data-page">
        <p className="club-muted">Loading task…</p>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="page-panel club-data-page">
        <button type="button" className="btn btn-secondary btn-compact" onClick={onBack}>
          All tasks
        </button>
        <p className="form-error">{error || 'This task could not be found.'}</p>
      </div>
    )
  }

  const tabCount: Record<ClubTab, number> = {
    files: task.fileCount,
    mapping: task.fileCount,
    data: task.validCount,
    errors: task.pendingErrorCount,
  }

  return (
    <div className="page-panel club-data-page">
      <div className="page-header">
        <div className="page-header-copy">
          <button type="button" className="btn btn-secondary btn-compact club-back" onClick={onBack}>
            All tasks
          </button>
          <p className="eyebrow">Club data</p>
          <h1>{task.name}</h1>
          <p className="page-subtitle">
            {task.description?.trim() ||
              'Upload Excel files, map their columns, correct errors, and download one combined sheet.'}
          </p>
        </div>
        <div className="page-actions club-data-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setName(task.name)
              setDescription(task.description ?? '')
              setDialogError('')
              setRenameOpen(true)
            }}
          >
            Rename
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setDialogError('')
              setDeleteOpen(true)
            }}
          >
            Delete
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={downloadKind !== '' || task.validCount === 0}
            title={task.validCount === 0 ? 'No valid rows to download yet' : 'Download combined Excel'}
            onClick={() => void download('data')}
          >
            {downloadKind === 'data' ? 'Downloading…' : 'Download Excel'}
          </button>
          {task.pendingErrorCount > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={downloadKind !== ''}
              onClick={() => void download('errors')}
            >
              {downloadKind === 'errors' ? 'Downloading…' : 'Download errors'}
            </button>
          )}
        </div>
      </div>

      <ul className="club-stats">
        <li>
          <strong>{task.fileCount}</strong> files
        </li>
        <li>
          <strong>{task.validCount}</strong> valid
        </li>
        <li>
          <strong>{task.pendingErrorCount}</strong> pending errors
        </li>
        <li>{task.schemaFrozen ? 'Columns locked' : 'Columns editable'}</li>
      </ul>
      {task.validCount === 0 && (
        <p className="club-muted">Combined download stays off until this task has valid rows.</p>
      )}

      {notice && (
        <div className={`club-notice ${notice.kind === 'error' ? 'form-error' : 'form-success'}`} role="status">
          <span>{notice.text}</span>
          <button type="button" className="btn btn-secondary btn-compact" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <ColumnEditor task={task} onSaved={refreshTask} />

      <div className="creation-tabs club-data-tabs" role="tablist" aria-label="Club data workspace">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`creation-tab${tab === item.id ? ' is-active' : ''}`}
            onClick={() => onTabChange(item.id, fileId)}
          >
            {item.label}
            {item.id !== 'mapping' ? ` (${tabCount[item.id]})` : ''}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'files' && (
          <FilesTab
            task={task}
            onTaskRefresh={refreshTask}
            onOpenMapping={(nextFileId) => onTabChange('mapping', nextFileId)}
            onNotice={showNotice}
          />
        )}
        {tab === 'mapping' && (
          <MappingTab
            task={task}
            fileId={fileId}
            onFileChange={(nextFileId) => onTabChange('mapping', nextFileId)}
            onOpenTab={(next) => onTabChange(next, fileId)}
            onTaskRefresh={refreshTask}
          />
        )}
        {tab === 'data' && <DataTab task={task} />}
        {tab === 'errors' && (
          <ErrorsTab task={task} onTaskRefresh={refreshTask} onNotice={showNotice} />
        )}
      </div>

      {renameOpen && (
        <Modal
          title="Rename task"
          description="The name is only a label. Column names stay with the uploaded files."
          labelledBy="club-rename-title"
          busy={saving}
          onClose={() => setRenameOpen(false)}
        >
          <form className="stack-form" onSubmit={(event) => void saveName(event)}>
            <label htmlFor="club-rename-name">Name</label>
            <input
              id="club-rename-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={saving}
            />
            <label htmlFor="club-rename-description">Description</label>
            <textarea
              id="club-rename-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={saving}
            />
            {dialogError && <p className="form-error">{dialogError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setRenameOpen(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteOpen && (
        <Modal
          title="Delete task"
          description="This deletes the task, its files, valid rows, and errors."
          labelledBy="club-delete-title"
          busy={saving}
          onClose={() => setDeleteOpen(false)}
        >
          <p>
            Delete <strong>{task.name}</strong>? This cannot be undone.
          </p>
          {dialogError && <p className="form-error">{dialogError}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="btn btn-unable" onClick={() => void confirmDelete()} disabled={saving}>
              {saving ? 'Deleting…' : 'Delete task'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
