import { useEffect, useState } from 'react'
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

type PrimarySelection = { source: 'server' } | { source: 'draft'; id: string } | { source: 'none' } | { source: 'column'; id: string }

function emptyDraft(): DraftColumn {
  return {
    id: crypto.randomUUID(),
    label: '',
    dataType: 'string',
    required: false,
  }
}

export default function ColumnEditor({ task, onSaved }: ColumnEditorProps) {
  const columns = sortedColumns(task.columns)
  const [drafts, setDrafts] = useState<DraftColumn[]>([])
  const [primarySelection, setPrimarySelection] = useState<PrimarySelection>({ source: 'server' })
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [primarySaving, setPrimarySaving] = useState(false)
  const primaryName = `club-output-primary-${task.id}`
  const serverPrimary = columns.find((column) => column.primary)

  useEffect(() => {
    setPrimarySelection({ source: 'server' })
    setDrafts([])
  }, [task.id])

  function columnIsPrimary(column: ExcelMergeColumn): boolean {
    if (primarySelection.source === 'draft' || primarySelection.source === 'none') {
      return false
    }
    if (primarySelection.source === 'column') {
      return primarySelection.id === column.id
    }
    return column.primary
  }

  function noneIsPrimary(): boolean {
    if (primarySelection.source === 'none') {
      return true
    }
    if (primarySelection.source === 'server') {
      return !serverPrimary
    }
    return false
  }

  async function patchPrimary(columnId: string, primary: boolean) {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      setPrimarySelection({ source: 'server' })
      return
    }
    setPrimarySaving(true)
    setError('')
    try {
      await updateExcelMergeColumn(task.id, columnId, { primary }, token)
      await onSaved()
      setPrimarySelection({ source: 'server' })
    } catch (saveError) {
      setPrimarySelection({ source: 'server' })
      setError(apiErrorMessage(saveError, primary ? 'Unable to set the primary column.' : 'Unable to clear the primary column.'))
    } finally {
      setPrimarySaving(false)
    }
  }

  function chooseDraftPrimary(id: string) {
    setPrimarySelection({ source: 'draft', id })
    setError('')
  }

  function chooseColumnPrimary(column: ExcelMergeColumn) {
    if (column.primary && primarySelection.source === 'server') {
      return
    }
    setPrimarySelection({ source: 'column', id: column.id })
    void patchPrimary(column.id, true)
  }

  function chooseNoPrimary() {
    setPrimarySelection({ source: 'none' })
    if (serverPrimary) {
      void patchPrimary(serverPrimary.id, false)
      return
    }
    setError('')
  }

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
        setError('Enter a name for each new output column, or remove the empty row.')
        return
      }
      const makePrimary = primarySelection.source === 'draft' && primarySelection.id === draft.id
      payload.push({
        label,
        dataType: draft.dataType,
        required: draft.required,
        ...(makePrimary ? { primary: true } : {}),
      })
    }

    setAdding(true)
    setError('')
    try {
      await addExcelMergeColumns(task.id, payload, token)
      setDrafts([])
      setPrimarySelection({ source: 'server' })
      await onSaved()
    } catch (addError) {
      setError(apiErrorMessage(addError, 'Unable to add output columns.'))
    } finally {
      setAdding(false)
    }
  }

  const busy = adding || primarySaving
  const draftPrimary = primarySelection.source === 'draft' ? drafts.find((draft) => draft.id === primarySelection.id) : undefined

  return (
    <div className="club-format">
      <p className="club-muted">
        Uploading a file does not add columns. You can add columns after files have been processed. Older merged rows
        stay blank for a new column, and those files do not need to be processed again.
      </p>
      <p className="club-muted">One column can be primary. Later files must use a unique value in that column.</p>
      {error && <p className="form-error">{error}</p>}
      {columns.length === 0 && drafts.length === 0 && (
        <p className="club-muted">No output columns yet. Add them here, or add them when you match a file.</p>
      )}

      {(columns.length > 0 || drafts.length > 0) && (
        <div role="radiogroup" aria-label="Primary column">
          <label className="checkbox-field club-primary-none">
            <input
              type="radio"
              name={primaryName}
              checked={noneIsPrimary()}
              disabled={busy}
              onChange={() => chooseNoPrimary()}
            />
            No primary column
          </label>

          {columns.map((column) => (
            <ColumnRow
              key={column.id}
              taskId={task.id}
              column={column}
              primaryName={primaryName}
              primaryChecked={columnIsPrimary(column)}
              primaryDisabled={busy}
              onPrimary={() => chooseColumnPrimary(column)}
              onSaved={onSaved}
            />
          ))}

          {drafts.map((draft) => (
            <div key={draft.id} className="club-column-row">
              <label className="form-field">
                <span>
                  Name
                  {draftPrimary?.id === draft.id && <span className="club-primary-badge">Primary</span>}
                </span>
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
              <div className="club-column-flags">
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
                <label className="checkbox-field">
                  <input
                    type="radio"
                    name={primaryName}
                    checked={draftPrimary?.id === draft.id}
                    disabled={busy}
                    onChange={() => chooseDraftPrimary(draft.id)}
                  />
                  Set as primary
                </label>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-compact"
                onClick={() => {
                  setDrafts((current) => current.filter((item) => item.id !== draft.id))
                  if (primarySelection.source === 'draft' && primarySelection.id === draft.id) {
                    setPrimarySelection({ source: 'server' })
                  }
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {draftPrimary && serverPrimary && (
        <p className="club-muted">
          Saving output columns will make this the primary column instead of {serverPrimary.label}.
        </p>
      )}

      <div className="club-inline-actions club-column-actions">
        <button
          type="button"
          className="btn btn-secondary btn-compact"
          onClick={() => setDrafts((current) => [...current, emptyDraft()])}
          disabled={busy}
        >
          Add output column
        </button>
        {drafts.length > 0 && (
          <button
            type="button"
            className="btn btn-primary btn-compact"
            onClick={() => void addColumns()}
            disabled={busy}
          >
            {adding ? 'Saving…' : 'Save output columns'}
          </button>
        )}
      </div>
    </div>
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
  primaryName,
  primaryChecked,
  primaryDisabled,
  onPrimary,
  onSaved,
}: {
  taskId: string
  column: ExcelMergeColumn
  primaryName: string
  primaryChecked: boolean
  primaryDisabled: boolean
  onPrimary: () => void
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
    if (!nextLabel) {
      setError('Enter a name for this output column.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await updateExcelMergeColumn(taskId, column.id, { label: nextLabel, dataType, required }, token)
      await onSaved()
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Unable to update this output column.'))
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
      setError(apiErrorMessage(deleteError, 'Unable to remove this output column.'))
      setSaving(false)
    }
  }

  return (
    <div className="club-column-row">
      <label className="form-field">
        <span>
          Name
          {primaryChecked && <span className="club-primary-badge">Primary</span>}
        </span>
        <input value={label} onChange={(event) => setLabel(event.target.value)} disabled={saving} />
      </label>
      <TypeField value={dataType} onChange={setDataType} disabled={saving} />
      <div className="club-column-flags">
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={required}
            disabled={saving}
            onChange={(event) => setRequired(event.target.checked)}
          />
          Required
        </label>
        <label className="checkbox-field">
          <input
            type="radio"
            name={primaryName}
            checked={primaryChecked}
            disabled={primaryDisabled || saving}
            onChange={onPrimary}
          />
          Set as primary
        </label>
      </div>
      <div className="club-inline-actions">
        <button type="button" className="btn btn-secondary btn-compact" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {!confirmDelete && (
          <button
            type="button"
            className="btn btn-secondary btn-compact"
            onClick={() => setConfirmDelete(true)}
            disabled={saving}
          >
            Remove
          </button>
        )}
        {confirmDelete && (
          <button type="button" className="btn btn-unable btn-compact" onClick={() => void remove()} disabled={saving}>
            Confirm remove
          </button>
        )}
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  )
}
