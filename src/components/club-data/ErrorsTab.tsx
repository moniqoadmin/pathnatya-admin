import { useEffect, useRef, useState } from 'react'
import {
  deleteExcelMergeError,
  deleteExcelMergeErrors,
  listExcelMergeErrors,
  listExcelMergeFiles,
  updateExcelMergeError,
  type ExcelCellValue,
  type ExcelDataType,
  type ExcelMergeErrorField,
  type ExcelMergeErrorRow,
  type ExcelMergeFileSummary,
  type ExcelMergeTask,
} from '../../api/excel-merge'
import { getToken } from '../../lib/session'
import Modal from '../Modal'
import Drawer from './Drawer'
import Pager from './Pager'
import {
  apiErrorMessage,
  coerceCellValue,
  formatCell,
  formatDate,
  problemTexts,
  splitReasons,
  statusPillClass,
  valueToInput,
} from './format'

const PAGE_SIZE = 50

interface ErrorsTabProps {
  task: ExcelMergeTask
  onTaskRefresh: () => Promise<void>
  onNotice: (kind: 'success' | 'error', text: string) => void
}

export default function ErrorsTab({ task, onTaskRefresh, onNotice }: ErrorsTabProps) {
  const [status, setStatus] = useState<'pending' | 'resolved'>('pending')
  const [fileId, setFileId] = useState('')
  const [files, setFiles] = useState<ExcelMergeFileSummary[]>([])
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [rows, setRows] = useState<ExcelMergeErrorRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [pendingDelete, setPendingDelete] = useState<string[]>([])
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const selectAllRef = useRef<HTMLInputElement>(null)
  const columnSignature = task.columns
    .map((column) => `${column.id}:${column.primary ? 1 : 0}:${column.label}`)
    .join('|')

  useEffect(() => {
    const token = getToken()
    if (!token) {
      return
    }
    let cancelled = false
    void listExcelMergeFiles(task.id, 1, 100, token)
      .then((result) => {
        if (!cancelled) {
          setFiles(result.data)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [task.id])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void listExcelMergeErrors(task.id, page, PAGE_SIZE, token, status, fileId)
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
          setError(apiErrorMessage(loadError, 'Unable to load errors.'))
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
  }, [task.id, page, status, fileId, reloadKey, task.pendingErrorCount, columnSignature])

  function replaceRow(next: ExcelMergeErrorRow) {
    setRows((current) => current.map((row) => (row.id === next.id ? next : row)))
  }

  const selected = rows.find((row) => row.id === selectedId) ?? null
  const pageIds = rows.map((row) => row.id)
  const selectedOnPage = pageIds.filter((id) => selectedIds.includes(id))
  const allSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedOnPage.length > 0 && !allSelected
    }
  }, [allSelected, selectedOnPage.length])

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id]
      }
      return current.filter((item) => item !== id)
    })
  }

  function togglePage(checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return [...new Set([...current, ...pageIds])]
      }
      const hidden = new Set(pageIds)
      return current.filter((id) => !hidden.has(id))
    })
  }

  function askDelete(ids: string[]) {
    if (ids.length === 0) {
      return
    }
    setDeleteError('')
    setPendingDelete(ids)
  }

  async function confirmDelete() {
    const token = getToken()
    if (!token) {
      setDeleteError('Your session expired. Please log in again.')
      return
    }
    if (pendingDelete.length === 0) {
      return
    }

    setDeleting(true)
    setDeleteError('')
    try {
      if (pendingDelete.length === 1) {
        await deleteExcelMergeError(task.id, pendingDelete[0], token)
      } else {
        await deleteExcelMergeErrors(task.id, pendingDelete, token)
      }
      const removed = new Set(pendingDelete)
      if (removed.has(selectedId)) {
        setSelectedId('')
      }
      setSelectedIds((current) => current.filter((id) => !removed.has(id)))
      setPendingDelete([])
      setReloadKey((current) => current + 1)
      await onTaskRefresh()
      onNotice(
        'success',
        removed.size === 1 ? 'Deleted 1 error row.' : `Deleted ${removed.size} error rows.`,
      )
    } catch (deleteFailure) {
      setDeleteError(apiErrorMessage(deleteFailure, 'Unable to delete these error rows.'))
    } finally {
      setDeleting(false)
    }
  }

  const pendingRows = rows.filter((row) => pendingDelete.includes(row.id))

  return (
    <div>
      <p className="club-expected">
        Open a row to fix it. Invalid output columns are marked in the panel. Save and approve to move the row into
        Data. If the primary value is already used, the row stays here until you change it to a unique value. Pending
        and resolved rows can be deleted.
      </p>
      <div className="club-toolbar">
        <label className="form-field club-filter" htmlFor="club-error-status">
          Status
          <select
            id="club-error-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as 'pending' | 'resolved')
              setPage(1)
              setSelectedIds([])
            }}
          >
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <label className="form-field club-filter" htmlFor="club-error-file">
          File
          <select
            id="club-error-file"
            value={fileId}
            onChange={(event) => {
              setFileId(event.target.value)
              setPage(1)
              setSelectedIds([])
            }}
          >
            <option value="">All files</option>
            {files.map((file) => (
              <option key={file.id} value={file.id}>
                {file.fileName}
              </option>
            ))}
          </select>
        </label>
        {selectedOnPage.length > 0 && (
          <button
            type="button"
            className="btn btn-unable btn-compact"
            disabled={deleting}
            onClick={() => askDelete(selectedOnPage)}
          >
            Delete selected ({selectedOnPage.length})
          </button>
        )}
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
      {!loading && rows.length === 0 ? (
        <p className="users-table-empty club-empty">
          {status === 'pending' ? 'No pending errors.' : 'No resolved errors yet.'}
        </p>
      ) : (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th className="club-select-col">
                    <input
                      ref={selectAllRef}
                      className="club-row-check"
                      type="checkbox"
                      aria-label="Select all rows on this page"
                      checked={allSelected}
                      disabled={loading || pageIds.length === 0 || deleting}
                      onChange={(event) => togglePage(event.target.checked)}
                    />
                  </th>
                <th>File</th>
                <th>Row</th>
                <th>Error summary</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                      <input
                        className="club-row-check"
                        type="checkbox"
                        aria-label={`Select ${row.fileName}, row ${row.sourceRowNumber}`}
                        checked={selectedIds.includes(row.id)}
                        disabled={deleting}
                        onChange={(event) => toggleRow(row.id, event.target.checked)}
                      />
                    </td>
                  <td>{row.fileName}</td>
                  <td>{row.sourceRowNumber}</td>
                  <td className="club-error-summary">{errorSummary(row)}</td>
                  <td>
                    <span className={`status-pill ${statusPillClass(row.status)}`}>{statusLabel(row.status)}</span>
                  </td>
                  <td>
                    <div className="club-inline-actions">
                      <button type="button" className="btn btn-primary btn-compact" onClick={() => setSelectedId(row.id)}>
                        {row.status === 'resolved' ? 'View' : 'Fix'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-unable btn-compact"
                        disabled={deleting}
                        onClick={() => askDelete([row.id])}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <ErrorCard
          key={selected.id}
          taskId={task.id}
          row={selected}
          onUpdated={replaceRow}
          onClose={() => setSelectedId('')}
          onApproved={() => {
            onNotice('success', `Approved ${selected.fileName}, row ${selected.sourceRowNumber}.`)
            setSelectedId('')
            setReloadKey((current) => current + 1)
            void onTaskRefresh()
          }}
          onDelete={() => askDelete([selected.id])}
        />
      )}
      {pendingDelete.length > 0 && (
        <Modal
          title={pendingDelete.length === 1 ? 'Delete error row' : 'Delete error rows'}
          description="Deleted rows are removed from this task."
          labelledBy="club-delete-errors-title"
          busy={deleting}
          onClose={() => {
            if (!deleting) {
              setPendingDelete([])
            }
          }}
        >
          <p>
            {pendingDelete.length === 1 && pendingRows[0]
              ? `Delete the error for ${pendingRows[0].fileName}, row ${pendingRows[0].sourceRowNumber}? This cannot be undone.`
              : `Delete ${pendingDelete.length} error rows? This cannot be undone.`}
          </p>
          {deleteError && <p className="form-error">{deleteError}</p>}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPendingDelete([])}
              disabled={deleting}
            >
              Cancel
            </button>
            <button type="button" className="btn btn-unable" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? 'Deleting…' : pendingDelete.length === 1 ? 'Delete row' : `Delete ${pendingDelete.length} rows`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function errorSummary(row: ExcelMergeErrorRow): string {
  const problems = [...row.fields.filter((field) => !field.valid)].sort(
    (left, right) => Number(right.primary) - Number(left.primary),
  )
  if (problems.length === 0) {
    return 'Ready to approve'
  }
  const first = problems[0]?.message || problems[0]?.label || 'Needs a fix'
  if (problems.length === 1) {
    return first
  }
  return `${problems.length} fields need a fix. ${first}`
}

function statusLabel(status: string): string {
  if (status === 'pending') {
    return 'Pending'
  }
  if (status === 'resolved') {
    return 'Resolved'
  }
  return status
}

function ErrorCard({
  taskId,
  row,
  onUpdated,
  onApproved,
  onDelete,
  onClose,
}: {
  taskId: string
  row: ExcelMergeErrorRow
  onUpdated: (row: ExcelMergeErrorRow) => void
  onApproved: () => void
  onDelete?: () => void
  onClose: () => void
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() => draftsFrom(row.fields))
  const [problems, setProblems] = useState<string[]>([])
  const [saving, setSaving] = useState<'draft' | 'approve' | ''>('')
  const [error, setError] = useState('')
  const resolved = row.status === 'resolved'

  useEffect(() => {
    setDrafts(draftsFrom(row.fields))
  }, [row.id, row.updatedAt, row.fields])

  async function save(approve: boolean) {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }

    const values: Record<string, ExcelCellValue> = {}
    for (const field of row.fields) {
      values[field.columnKey] = coerceCellValue(field.dataType, drafts[field.columnKey] ?? '')
    }

    setSaving(approve ? 'approve' : 'draft')
    setError('')
    try {
      const result = await updateExcelMergeError(taskId, row.id, { values, approve }, token)
      const nextProblems = problemTexts(result.remainingProblems)
      setProblems(nextProblems)
      if (result.row) {
        onUpdated(result.row)
        setDrafts(draftsFrom(result.row.fields))
      }
      if (result.approved) {
        onApproved()
        return
      }
      if (approve && nextProblems.length === 0 && !(result.row?.fields ?? []).some((field) => !field.valid && field.message)) {
        setError('This row is still invalid. Check the fields marked below.')
      }
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Unable to save this row.'))
    } finally {
      setSaving('')
    }
  }

  return (
    <Drawer
      title={`${row.fileName} · row ${row.sourceRowNumber}`}
      description={
        resolved && row.resolvedAt
          ? `Resolved ${formatDate(row.resolvedAt)}`
          : 'Fix the invalid fields, then save and approve. A primary value that is already used must be changed before this row can move into Data.'
      }
      labelledBy="club-error-row-title"
      busy={saving !== ''}
      onClose={onClose}
      footer={
        <div className="club-inline-actions">
            {!resolved && (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving !== ''}
                  onClick={() => void save(false)}
                >
                  {saving === 'draft' ? 'Saving…' : 'Save draft'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving !== ''}
                  onClick={() => void save(true)}
                >
                  {saving === 'approve' ? 'Saving…' : 'Save & Approve'}
                </button>
              </>
            )}
            {onDelete && (
              <button type="button" className="btn btn-unable" disabled={saving !== ''} onClick={onDelete}>
                Delete
              </button>
            )}
          </div>
      }
    >
      <div className="club-drawer-fields">
        {[...row.fields]
          .sort((left, right) => Number(left.valid) - Number(right.valid) || Number(right.primary) - Number(left.primary))
          .map((field) => {
          const draft = drafts[field.columnKey] ?? ''
          const dirty = draft !== valueToInput(field.currentValue)
          const showInvalid = !dirty && !field.valid
          const showValid = !dirty && field.valid
          const reasons = showInvalid ? splitReasons(field.message) : []
          return (
            <div
              key={field.columnKey}
              className={`club-field${showInvalid ? ' is-invalid' : ''}${showValid ? ' is-valid' : ''}`}
            >
              <div className="club-field-label">
                <span>
                  {field.label}
                  {field.primary ? <span className="club-primary-badge">Primary</span> : null}
                  {field.required ? ' *' : ''}
                </span>
                <span aria-hidden="true">{showInvalid ? '✕' : showValid ? '✓' : ''}</span>
              </div>
              {showInvalid && (
                <p className="club-original">Current value: {formatCell(field.currentValue)}</p>
              )}
              <p className="club-original">Original: {formatCell(field.originalValue)}</p>
              <FieldInput
                field={field}
                value={draft}
                disabled={resolved || saving !== ''}
                invalid={showInvalid}
                onChange={(value) => {
                  setProblems([])
                  setDrafts((current) => ({ ...current, [field.columnKey]: value }))
                }}
              />
              {reasons.length === 1 && <p className="club-field-message">{reasons[0]}</p>}
              {reasons.length > 1 && (
                <ul className="club-field-messages">
                  {reasons.map((reason, index) => (
                    <li key={`${field.columnKey}-${index}`}>{reason}</li>
                  ))}
                </ul>
              )}
              {showValid && <p className="club-field-ok">Valid</p>}
            </div>
          )
        })}
      </div>
      {problems.length > 0 && (
        <ul className="club-problem-list">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      {error && <p className="form-error">{error}</p>}
    </Drawer>
  )
}

function draftsFrom(fields: ExcelMergeErrorField[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.columnKey, valueToInput(field.currentValue)]))
}

function FieldInput({
  field,
  value,
  disabled,
  invalid,
  onChange,
}: {
  field: ExcelMergeErrorField
  value: string
  disabled: boolean
  invalid: boolean
  onChange: (value: string) => void
}) {
  if (field.dataType === 'boolean') {
    return (
      <select
        aria-label={field.label}
        aria-invalid={invalid}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    )
  }

  const inputMode = inputModeFor(field.dataType)
  return (
    <input
      aria-label={field.label}
      aria-invalid={invalid}
      value={value}
      disabled={disabled}
      inputMode={inputMode}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function inputModeFor(dataType: ExcelDataType): 'numeric' | 'tel' | 'text' {
  if (dataType === 'integer' || dataType === 'number') {
    return 'numeric'
  }
  if (dataType === 'phone') {
    return 'tel'
  }
  return 'text'
}
