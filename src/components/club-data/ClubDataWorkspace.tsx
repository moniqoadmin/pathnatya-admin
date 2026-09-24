import { type FormEvent, type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react'
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
import Drawer from './Drawer'
import ErrorsTab from './ErrorsTab'
import FilesTab from './FilesTab'
import MappingTab from './MappingTab'
import { apiErrorMessage } from './format'
import { openFinalData } from '../../lib/final-data'
import SummaryJsonDialog from './SummaryJsonDialog'
import { type ClubTab } from './tabs'

const TABS: { id: ClubTab; label: string }[] = [
  { id: 'files', label: 'Files' },
  { id: 'mapping', label: 'Match Columns' },
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
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [downloadKind, setDownloadKind] = useState<'data' | 'errors' | ''>('')
  const [menu, setMenu] = useState<'edit' | 'download' | null>(null)
  const [formatOpen, setFormatOpen] = useState(false)
  const formatPrompted = useRef('')
  const closeMenu = useCallback(() => setMenu(null), [])

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

  useEffect(() => {
    if (!task || formatPrompted.current === task.id) {
      return
    }
    formatPrompted.current = task.id
    setFormatOpen(task.columns.length === 0)
  }, [task])

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
  const outputCount = task.columns.length || task.columnCount
  const primaryColumn = task.columns.find((column) => column.primary)

  return (
    <div className="page-panel club-data-page">
      <div className="club-task-header">
        <div className="club-task-toolbar">
          <button type="button" className="btn btn-secondary btn-compact" onClick={onBack}>
            All tasks
          </button>
          <div className="page-actions club-data-actions">
            <button type="button" className="btn btn-secondary" onClick={() => openFinalData(task.id)}>
              View final data
            </button>
          <ActionMenu
            label="Edit"
            open={menu === 'edit'}
            onToggle={() => setMenu((current) => (current === 'edit' ? null : 'edit'))}
            onClose={closeMenu}
          >
            <button
              type="button"
              role="menuitem"
              className="club-menu-item"
              onClick={() => {
                closeMenu()
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
              role="menuitem"
              className="club-menu-item"
              onClick={() => {
                closeMenu()
                setSummaryOpen(true)
              }}
            >
              Summary
            </button>
            <button
              type="button"
              role="menuitem"
              className="club-menu-item is-danger"
              onClick={() => {
                closeMenu()
                setDialogError('')
                setDeleteOpen(true)
              }}
            >
              Delete
            </button>
          </ActionMenu>
          <button
            type="button"
            className="btn btn-secondary"
            aria-expanded={formatOpen}
            onClick={() => setFormatOpen((open) => !open)}
          >
            Output format{outputCount > 0 ? ` · ${outputCount}` : ''}
          </button>
          <ActionMenu
            label={downloadKind ? 'Downloading…' : 'Download'}
            primary
            open={menu === 'download'}
            disabled={downloadKind !== ''}
            onToggle={() => setMenu((current) => (current === 'download' ? null : 'download'))}
            onClose={closeMenu}
          >
            <button
              type="button"
              role="menuitem"
              className="club-menu-item"
              disabled={task.validCount === 0}
              title={
                task.validCount === 0
                  ? 'No valid rows to download yet'
                  : 'Download valid rows in the current output-column order'
              }
              onClick={() => {
                closeMenu()
                void download('data')
              }}
            >
              Excel
            </button>
            <button
              type="button"
              role="menuitem"
              className="club-menu-item"
              disabled={task.pendingErrorCount === 0}
              title={task.pendingErrorCount === 0 ? 'No errors to download' : 'Download error rows'}
              onClick={() => {
                closeMenu()
                void download('errors')
              }}
            >
              Errors
            </button>
          </ActionMenu>
          </div>
        </div>
        <div className="page-header-copy">
          <p className="eyebrow">Club data</p>
          <h1>{task.name}</h1>
          <p className="page-subtitle">
            {task.description?.trim() ||
              'Upload files, match columns, then process them into one Excel file.'}
          </p>
          <ul className="club-stats">
            <li>
              <strong>{task.fileCount.toLocaleString()}</strong> {task.fileCount === 1 ? 'File' : 'Files'}
            </li>
            <li>
              <strong>{task.validCount.toLocaleString()}</strong> Valid {task.validCount === 1 ? 'Row' : 'Rows'}
            </li>
            <li>
              <strong>{task.pendingErrorCount.toLocaleString()}</strong>{' '}
              {task.pendingErrorCount === 1 ? 'Error' : 'Errors'}
            </li>
            <li>
              <strong>{outputCount.toLocaleString()}</strong> Output {outputCount === 1 ? 'Column' : 'Columns'}
            </li>
            {primaryColumn && (
              <li>
                Primary <strong>{primaryColumn.label}</strong>
              </li>
            )}
          </ul>
        </div>
      </div>

      {notice && (
        <div className={`club-notice ${notice.kind === 'error' ? 'form-error' : 'form-success'}`} role="status">
          <span>{notice.text}</span>
          <button type="button" className="btn btn-secondary btn-compact" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      {formatOpen && (
        <Drawer
          title={outputCount > 0 ? `Output format · ${outputCount}` : 'Output format'}
          description="These columns are the output format for the combined Excel file."
          labelledBy="club-output-format-title"
          wide
          onClose={() => setFormatOpen(false)}
        >
          <ColumnEditor task={task} onSaved={refreshTask} />
        </Drawer>
      )}

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
          description="This only changes the task name."
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

      {summaryOpen && (
        <SummaryJsonDialog
          taskId={task.id}
          taskName={task.name}
          onClose={() => setSummaryOpen(false)}
          onSaved={() => {
            setSummaryOpen(false)
            showNotice('success', 'Summary saved.')
          }}
        />
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

function ActionMenu({
  label,
  open,
  disabled = false,
  primary = false,
  onToggle,
  onClose,
  children,
}: {
  label: ReactNode
  open: boolean
  disabled?: boolean
  primary?: boolean
  onToggle: () => void
  onClose: () => void
  children: ReactNode
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) {
      return
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        onClose()
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  return (
    <div className="club-menu" ref={rootRef}>
      <button
        type="button"
        className={`btn ${primary ? 'btn-primary' : 'btn-secondary'}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={onToggle}
      >
        {label}
        <Caret open={open} />
      </button>
      {open && (
        <div className="club-menu-panel" id={menuId} role="menu">
          {children}
        </div>
      )}
    </div>
  )
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg className={`club-menu-caret${open ? ' is-open' : ''}`} width="12" height="8" viewBox="0 0 12 8" aria-hidden="true">
      <path fill="currentColor" d="M1.4.6 6 5.2 10.6.6 12 2 6 8 0 2z" />
    </svg>
  )
}
