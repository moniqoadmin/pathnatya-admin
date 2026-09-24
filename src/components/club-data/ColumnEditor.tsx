import { useEffect, useRef, useState } from 'react'
import {
  EXCEL_DATA_TYPES,
  addExcelMergeColumns,
  deleteExcelMergeColumn,
  updateExcelMergeColumn,
  type ExcelDataType,
  type ExcelMergeColumn,
  type ExcelMergeColumnInput,
  type ExcelMergeTask,
} from '../../api/excel-merge'
import { getToken } from '../../lib/session'
import { DATA_TYPE_LABELS, apiErrorMessage, sortedColumns } from './format'

interface ColumnEditorProps {
  task: ExcelMergeTask
  onSaved: () => Promise<void>
}

interface DraftColumn {
  id: string
  label: string
  dataType: ExcelDataType
  required: boolean
}

function emptyDraft(): DraftColumn {
  return {
    id: crypto.randomUUID(),
    label: '',
    dataType: 'string',
    required: false,
  }
}

export default function ColumnEditor({ task, onSaved }: ColumnEditorProps) {
  const namesLocked = task.schemaFrozen
  const columns = sortedColumns(task.columns)
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const [drafts, setDrafts] = useState<DraftColumn[]>([])
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (detailsRef.current) {
      detailsRef.current.open = !task.schemaFrozen
    }
  }, [task.id, task.schemaFrozen])

  async function addColumns() {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }

    const payload: ExcelMergeColumnInput[] = []
    for (const draft of drafts) {
      const label = draft.label.trim()
      if (!label) {
        setError('Enter a label for each new column, or remove the empty row.')
        return
      }
      payload.push({ label, dataType: draft.dataType, required: draft.required })
    }

    const existing = new Set(columns.map((column) => column.label.trim().toLowerCase()))
    const seen = new Set<string>()
    for (const column of payload) {
      const key = column.label.toLowerCase()
      if (existing.has(key) || seen.has(key)) {
        setError(`Column “${column.label}” is already in this list.`)
        return
      }
      seen.add(key)
    }

    setAdding(true)
    setError('')
    try {
      await addExcelMergeColumns(task.id, payload, token)
      setDrafts([])
      await onSaved()
    } catch (addError) {
      setError(apiErrorMessage(addError, 'Unable to add columns.'))
    } finally {
      setAdding(false)
    }
  }

  return (
    <details className="club-columns" ref={detailsRef}>
      <summary>
        Master columns
        {namesLocked ? ' · names locked' : ' · editable until the first file'}
      </summary>
      <p className="club-muted">
        {namesLocked
          ? 'Column names stay as they were on the first file. You can still change the type and whether a column is required.'
          : 'Add columns now, or leave this empty and let the first uploaded file create them.'}
      </p>
      {error && <p className="form-error">{error}</p>}

      {columns.length === 0 && namesLocked && <p className="club-muted">No columns yet.</p>}

      {columns.map((column) => (
        <ColumnRow
          key={column.id}
          taskId={task.id}
          column={column}
          namesLocked={namesLocked}
          onSaved={onSaved}
        />
      ))}

      {!namesLocked &&
        drafts.map((draft) => (
          <div key={draft.id} className="club-column-row">
            <label className="form-field">
              <span>Label</span>
              <input
                value={draft.label}
                onChange={(event) =>
                  setDrafts((current) =>
                    current.map((item) =>
                      item.id === draft.id ? { ...item, label: event.target.value } : item,
                    ),
                  )
                }
              />
            </label>
            <TypeField
              value={draft.dataType}
              onChange={(dataType) =>
                setDrafts((current) =>
                  current.map((item) => (item.id === draft.id ? { ...item, dataType } : item)),
                )
              }
            />
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={draft.required}
                onChange={(event) =>
                  setDrafts((current) =>
                    current.map((item) =>
                      item.id === draft.id ? { ...item, required: event.target.checked } : item,
                    ),
                  )
                }
              />
              Required
            </label>
            <button
              type="button"
              className="btn btn-secondary btn-compact"
              onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}
            >
              Remove
            </button>
          </div>
        ))}

      {!namesLocked && (
        <div className="club-inline-actions club-column-actions">
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            onClick={() => setDrafts((current) => [...current, emptyDraft()])}
            disabled={adding}
          >
            Add column
          </button>
          {drafts.length > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-compact"
              onClick={() => void addColumns()}
              disabled={adding}
            >
              {adding ? 'Saving…' : 'Save new columns'}
            </button>
          )}
        </div>
      )}
    </details>
  )
}

function TypeField({
  value,
  onChange,
  disabled = false,
}: {
  value: ExcelDataType
  onChange: (value: ExcelDataType) => void
  disabled?: boolean
}) {
  return (
    <label className="form-field">
      <span>Type</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as ExcelDataType)}
      >
        {EXCEL_DATA_TYPES.map((type) => (
          <option key={type} value={type}>
            {DATA_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
    </label>
  )
}

function ColumnRow({
  taskId,
  column,
  namesLocked,
  onSaved,
}: {
  taskId: string
  column: ExcelMergeColumn
  namesLocked: boolean
  onSaved: () => Promise<void>
}) {
  const [label, setLabel] = useState(column.label)
  const [dataType, setDataType] = useState(column.dataType)
  const [required, setRequired] = useState(column.required)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLabel(column.label)
    setDataType(column.dataType)
    setRequired(column.required)
  }, [column.id, column.label, column.dataType, column.required])

  async function save() {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }
    const nextLabel = label.trim()
    if (!namesLocked && !nextLabel) {
      setError('Enter a column label.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await updateExcelMergeColumn(
        taskId,
        column.id,
        namesLocked
          ? { dataType, required }
          : { label: nextLabel, dataType, required },
        token,
      )
      await onSaved()
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Unable to update this column.'))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await deleteExcelMergeColumn(taskId, column.id, token)
      await onSaved()
    } catch (deleteError) {
      setError(apiErrorMessage(deleteError, 'Unable to delete this column.'))
      setSaving(false)
    }
  }

  return (
    <div className="club-column-row">
      {namesLocked ? (
        <p className="club-column-label">
          {column.label}
          <span className="club-muted">{column.key}</span>
        </p>
      ) : (
        <label className="form-field">
          <span>Label</span>
          <input value={label} onChange={(event) => setLabel(event.target.value)} disabled={saving} />
        </label>
      )}
      <TypeField value={dataType} onChange={setDataType} disabled={saving} />
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={required}
          disabled={saving}
          onChange={(event) => setRequired(event.target.checked)}
        />
        Required
      </label>
      <div className="club-inline-actions">
        <button type="button" className="btn btn-secondary btn-compact" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {!namesLocked && !confirmDelete && (
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            onClick={() => setConfirmDelete(true)}
            disabled={saving}
          >
            Delete
          </button>
        )}
        {!namesLocked && confirmDelete && (
          <button type="button" className="btn btn-unable btn-compact" onClick={() => void remove()} disabled={saving}>
            Confirm delete
          </button>
        )}
      </div>
      {error && <p className="form-error span-2">{error}</p>}
    </div>
  )
}
