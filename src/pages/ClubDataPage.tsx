import { type FormEvent, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  EXCEL_DATA_TYPES,
  createExcelMergeTask,
  deleteExcelMergeTask,
  listExcelMergeTasks,
  updateExcelMergeTask,
  type ExcelDataType,
  type ExcelMergeColumnInput,
  type ExcelMergeTaskSummary,
} from '../api/excel-merge'
import Modal from '../components/Modal'
import ClubDataWorkspace from '../components/club-data/ClubDataWorkspace'
import { DATA_TYPE_LABELS, apiErrorMessage, formatDate } from '../components/club-data/format'
import Pager from '../components/club-data/Pager'
import { parseClubTab, type ClubTab } from '../components/club-data/tabs'
import { getToken } from '../lib/session'
import { openFinalData } from '../lib/final-data'

const PAGE_SIZE = 20

interface DraftColumn {
  id: string
  label: string
  dataType: ExcelDataType
  required: boolean
  primary: boolean
}

function emptyColumn(): DraftColumn {
  return { id: crypto.randomUUID(), label: '', dataType: 'string', required: false, primary: false }
}

export default function ClubDataPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const taskId = searchParams.get('task') ?? ''
  const tab = parseClubTab(searchParams.get('tab'))
  const fileId = searchParams.get('file') ?? ''

  function openTask(id: string, nextTab: ClubTab = 'files', nextFileId = '') {
    const params: Record<string, string> = { task: id, tab: nextTab }
    if (nextFileId) {
      params.file = nextFileId
    }
    setSearchParams(params)
  }

  if (taskId) {
    return (
      <ClubDataWorkspace
        taskId={taskId}
        tab={tab}
        fileId={fileId}
        onTabChange={(nextTab, nextFileId = fileId) => openTask(taskId, nextTab, nextFileId)}
        onBack={() => setSearchParams({})}
      />
    )
  }

  return <TaskList onOpen={(id) => openTask(id)} />
}

function TaskList({ onOpen }: { onOpen: (taskId: string) => void }) {
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [rows, setRows] = useState<ExcelMergeTaskSummary[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ExcelMergeTaskSummary | null>(null)
  const [deleting, setDeleting] = useState<ExcelMergeTaskSummary | null>(null)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void listExcelMergeTasks(page, PAGE_SIZE, token)
      .then((result) => {
        if (cancelled) {
          return
        }
        setRows(result.data)
        setTotal(result.total)
        setTotalPages(result.totalPages)
        setError('')
        if (page > result.totalPages) {
          setPage(result.totalPages)
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(apiErrorMessage(loadError, 'Unable to load Club data tasks.'))
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
  }, [page, reloadKey])

  return (
    <div className="page-panel club-data-page">
      <div className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">Operations</p>
          <h1>Club data</h1>
          <p className="page-subtitle">
            Merge Excel files into one sheet. Upload a file, match its columns to the output format, then process it.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            Create task
          </button>
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <Pager
        page={page}
        totalPages={totalPages}
        total={total}
        limit={PAGE_SIZE}
        loading={loading}
        onPage={setPage}
      />

      <div className="users-table-wrap">
        <table className="users-table club-task-list">
          <colgroup>
            <col className="club-name-col" />
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th>Name</th>
              <th>Files</th>
              <th>Rows</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="users-table-empty">
                  No tasks yet. Create one, then upload the Excel files.
                </td>
              </tr>
            ) : (
              rows.map((task) => (
                <tr key={task.id} className="is-clickable" onClick={() => onOpen(task.id)}>
                  <td className="club-task-cell">
                    <span className="club-task-name">{task.name}</span>
                    {task.description && <span className="club-task-description">{task.description}</span>}
                    {task.columnCount > 0 && (
                      <span className="club-muted">
                        {task.columnCount} output {task.columnCount === 1 ? 'column' : 'columns'}
                      </span>
                    )}
                  </td>
                  <td>{task.fileCount}</td>
                  <td>
                    {task.validCount} valid · {task.pendingErrorCount} errors
                  </td>
                  <td>{formatDate(task.updatedAt)}</td>
                  <td>
                    <div className="club-inline-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        onClick={(event) => {
                          event.stopPropagation()
                          openFinalData(task.id)
                        }}
                      >
                        Data
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact club-icon-btn"
                        aria-label={`Rename ${task.name}`}
                        title="Rename"
                        onClick={(event) => {
                          event.stopPropagation()
                          setEditing(task)
                        }}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M4 20h4.2L19.5 8.7a2.1 2.1 0 0 0 0-3L18.3 4.5a2.1 2.1 0 0 0-3 0L4 15.8V20z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinejoin="round"
                          />
                          <path d="M13.2 6.3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="btn btn-unable btn-compact club-icon-btn"
                        aria-label={`Delete ${task.name}`}
                        title="Delete"
                        onClick={(event) => {
                          event.stopPropagation()
                          setDeleting(task)
                        }}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M4.5 7h15M9 7V4.8h6V7M7.2 7l.8 12.2h8l.8-12.2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {createOpen && (
        <CreateTaskDialog
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false)
            onOpen(id)
          }}
        />
      )}
      {editing && (
        <RenameTaskDialog
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            setReloadKey((current) => current + 1)
          }}
        />
      )}
      {deleting && (
        <DeleteTaskDialog
          task={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            setReloadKey((current) => current + 1)
          }}
        />
      )}
    </div>
  )
}

function CreateTaskDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (taskId: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [columns, setColumns] = useState<DraftColumn[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const token = getToken()
    const nextName = name.trim()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }
    if (!nextName) {
      setError('Enter a task name.')
      return
    }

    const payloadColumns: ExcelMergeColumnInput[] = []
    for (const column of columns) {
      const label = column.label.trim()
      if (!label) {
        setError('Enter a label for each column, or remove the empty row.')
        return
      }
      payloadColumns.push({
        label,
        dataType: column.dataType,
        required: column.required,
        ...(column.primary ? { primary: true } : {}),
      })
    }

    setSaving(true)
    setError('')
    try {
      const created = await createExcelMergeTask(
        {
          name: nextName,
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(payloadColumns.length > 0 ? { columns: payloadColumns } : {}),
        },
        token,
      )
      onCreated(created.id)
    } catch (createError) {
      setError(apiErrorMessage(createError, 'Unable to create this task.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Create task"
      description="A name is enough. You can add output columns now, or add them when you match a file. One column can be primary."
      labelledBy="club-create-title"
      busy={saving}
      wide
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="club-create-name">Name</label>
        <input
          id="club-create-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={saving}
          autoFocus
        />
        <label htmlFor="club-create-description">Description</label>
        <textarea
          id="club-create-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={saving}
        />
        <p className="field-hint">
          Optional output columns. These columns will appear in your final Excel file. You can also add them later.
        </p>
        {columns.length > 0 && (
          <div role="radiogroup" aria-label="Primary column">
            <label className="checkbox-field club-primary-none">
              <input
                type="radio"
                name="club-create-primary"
                checked={!columns.some((column) => column.primary)}
                disabled={saving}
                onChange={() => setColumns((current) => current.map((item) => ({ ...item, primary: false })))}
              />
              No primary column
            </label>
            {columns.map((column) => (
              <div key={column.id} className="club-column-row">
                <label className="form-field">
                  <span>
                    Label
                    {column.primary && <span className="club-primary-badge">Primary</span>}
                  </span>
                  <input
                    value={column.label}
                    disabled={saving}
                    onChange={(event) =>
                      setColumns((current) =>
                        current.map((item) =>
                          item.id === column.id ? { ...item, label: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </label>
                <label className="form-field">
                  <span>Type</span>
                  <select
                    value={column.dataType}
                    disabled={saving}
                    onChange={(event) =>
                      setColumns((current) =>
                        current.map((item) =>
                          item.id === column.id
                            ? { ...item, dataType: event.target.value as ExcelDataType }
                            : item,
                        ),
                      )
                    }
                  >
                    {EXCEL_DATA_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {DATA_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="club-column-flags">
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={column.required}
                      disabled={saving}
                      onChange={(event) =>
                        setColumns((current) =>
                          current.map((item) =>
                            item.id === column.id ? { ...item, required: event.target.checked } : item,
                          ),
                        )
                      }
                    />
                    Required
                  </label>
                  <label className="checkbox-field">
                    <input
                      type="radio"
                      name="club-create-primary"
                      checked={column.primary}
                      disabled={saving}
                      onChange={() =>
                        setColumns((current) =>
                          current.map((item) => ({ ...item, primary: item.id === column.id })),
                        )
                      }
                    />
                    Set as primary
                  </label>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  disabled={saving}
                  onClick={() => setColumns((current) => current.filter((item) => item.id !== column.id))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="club-inline-actions">
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            disabled={saving}
            onClick={() => setColumns((current) => [...current, emptyColumn()])}
          >
            Add column
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
            {saving ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function RenameTaskDialog({
  task,
  onClose,
  onSaved,
}: {
  task: ExcelMergeTaskSummary
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(task.name)
  const [description, setDescription] = useState(task.description ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const token = getToken()
    const nextName = name.trim()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }
    if (!nextName) {
      setError('Enter a task name.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await updateExcelMergeTask(task.id, { name: nextName, description: description.trim() || null }, token)
      onSaved()
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Unable to rename this task.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Rename task"
      description="Updates the label shown in the task list."
      labelledBy="club-list-rename-title"
      busy={saving}
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={(event) => void submit(event)}>
        <label htmlFor="club-list-rename-name">Name</label>
        <input id="club-list-rename-name" value={name} onChange={(event) => setName(event.target.value)} disabled={saving} />
        <label htmlFor="club-list-rename-description">Description</label>
        <textarea
          id="club-list-rename-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={saving}
        />
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DeleteTaskDialog({
  task,
  onClose,
  onDeleted,
}: {
  task: ExcelMergeTaskSummary
  onClose: () => void
  onDeleted: () => void
}) {
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function confirm() {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await deleteExcelMergeTask(task.id, token)
      onDeleted()
    } catch (deleteError) {
      setError(apiErrorMessage(deleteError, 'Unable to delete this task.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Delete task"
      description="This deletes the task, its files, valid rows, and errors."
      labelledBy="club-list-delete-title"
      busy={saving}
      onClose={onClose}
    >
      <p>
        Delete <strong>{task.name}</strong>? This cannot be undone.
      </p>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="btn btn-unable" onClick={() => void confirm()} disabled={saving}>
          {saving ? 'Deleting…' : 'Delete task'}
        </button>
      </div>
    </Modal>
  )
}
