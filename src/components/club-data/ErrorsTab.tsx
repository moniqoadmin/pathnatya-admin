import { useEffect, useState } from 'react'
import {
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
import Pager from './Pager'
import {
  apiErrorMessage,
  coerceCellValue,
  formatCell,
  formatDate,
  problemTexts,
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
  }, [task.id, page, status, fileId, reloadKey, task.pendingErrorCount])

  function replaceRow(next: ExcelMergeErrorRow) {
    setRows((current) => current.map((row) => (row.id === next.id ? next : row)))
  }

  return (
    <div>
      <p className="club-expected">
        Fix the invalid fields, then save and approve. Original cell text stays visible and is never overwritten.
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
        <div className="club-error-list">
          {rows.map((row) => (
            <ErrorCard
              key={row.id}
              taskId={task.id}
              row={row}
              onUpdated={replaceRow}
              onApproved={() => {
                onNotice('success', `Approved ${row.fileName}, row ${row.sourceRowNumber}.`)
                setReloadKey((current) => current + 1)
                void onTaskRefresh()
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ErrorCard({
  taskId,
  row,
  onUpdated,
  onApproved,
}: {
  taskId: string
  row: ExcelMergeErrorRow
  onUpdated: (row: ExcelMergeErrorRow) => void
  onApproved: () => void
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
      }
      if (result.approved) {
        onApproved()
        return
      }
      if (approve && nextProblems.length === 0) {
        setError('This row is still invalid. Check the fields marked below.')
      }
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Unable to save this row.'))
    } finally {
      setSaving('')
    }
  }

  return (
    <article className="club-error-card">
      <header>
        <div>
          <strong>
            {row.fileName} · row {row.sourceRowNumber}
          </strong>
          {resolved && row.resolvedAt && <p className="club-muted">Resolved {formatDate(row.resolvedAt)}</p>}
        </div>
        <span className={`status-pill ${statusPillClass(row.status)}`}>{row.status}</span>
      </header>
      <div className="club-field-grid">
        {row.fields.map((field) => {
          const draft = drafts[field.columnKey] ?? ''
          const dirty = draft !== valueToInput(field.currentValue)
          const showInvalid = !dirty && !field.valid
          const showValid = !dirty && field.valid
          return (
            <div
              key={field.columnKey}
              className={`club-field${showInvalid ? ' is-invalid' : ''}${showValid ? ' is-valid' : ''}`}
            >
              <div className="club-field-label">
                <span>
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                <span aria-hidden="true">{showInvalid ? '✕' : showValid ? '✓' : ''}</span>
              </div>
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
              {showInvalid && field.message && <p className="club-field-message">{field.message}</p>}
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
      {!resolved && (
        <div className="club-inline-actions club-column-actions">
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
        </div>
      )}
    </article>
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
