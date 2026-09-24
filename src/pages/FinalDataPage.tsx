import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  createExcelMergeData,
  deleteExcelMergeData,
  deleteExcelMergeDataRows,
  downloadExcelMergeExport,
  getExcelMergeSummary,
  getExcelMergeTask,
  listExcelMergeData,
  listExcelMergeFiles,
  toExcelDataType,
  updateExcelMergeData,
  type ExcelCellValue,
  type ExcelDataType,
  type ExcelMergeColumn,
  type ExcelMergeDataColumn,
  type ExcelMergeDataRow,
  type ExcelMergeFileSummary,
  type ExcelMergeTask,
} from '../api/excel-merge'
import Modal from '../components/Modal'
import Drawer from '../components/club-data/Drawer'
import Pager from '../components/club-data/Pager'
import {
  apiErrorMessage,
  coerceCellValue,
  formatCell,
  formatDate,
  sortedColumns,
  valueToInput,
} from '../components/club-data/format'
import { getToken } from '../lib/session'

const PAGE_SIZES = [50, 100, 200] as const
const DELETE_LIMIT = 500
const META_SORTS = [
  { key: 'fileName', label: 'File' },
  { key: 'sourceRowNumber', label: 'Row' },
  { key: 'createdAt', label: 'Created' },
] as const

interface OutputColumn {
  key: string
  label: string
  dataType: ExcelDataType
  required: boolean
  primary: boolean
}

export default function FinalDataPage() {
  const { taskId = '' } = useParams()
  const [task, setTask] = useState<ExcelMergeTask | null>(null)
  const [files, setFiles] = useState<ExcelMergeFileSummary[]>([])
  const [dataColumns, setDataColumns] = useState<ExcelMergeDataColumn[]>([])
  const [rows, setRows] = useState<ExcelMergeDataRow[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState<number>(PAGE_SIZES[0])
  const [fileId, setFileId] = useState('')
  const [sort, setSort] = useState('')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [loadingTask, setLoadingTask] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editing, setEditing] = useState<ExcelMergeDataRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string[]>([])
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)
  const selectAllRef = useRef<HTMLInputElement>(null)

  const columns = useMemo(
    () => mergeColumns(task?.columns ?? [], dataColumns),
    [task?.columns, dataColumns],
  )
  const sortOptions = useMemo(() => {
    const reserved = new Set<string>(META_SORTS.map((item) => item.key))
    return [
      ...META_SORTS,
      ...columns
        .filter((column) => !reserved.has(column.key))
        .map((column) => ({ key: column.key, label: column.label })),
    ]
  }, [columns])

  useEffect(() => {
    document.title = task?.name ? `${task.name} · Final data` : 'Final data'
  }, [task?.name])

  useEffect(() => {
    const token = getToken()
    if (!token || !taskId) {
      setError('Your session expired. Please log in again.')
      setLoadingTask(false)
      return
    }
    let cancelled = false
    setLoadingTask(true)
    void getExcelMergeTask(taskId, token)
      .then((next) => {
        if (!cancelled) {
          setTask(next)
          setError('')
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setTask(null)
          setError(apiErrorMessage(loadError, 'Unable to load this task.'))
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingTask(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [taskId])

  useEffect(() => {
    const token = getToken()
    if (!token || !taskId) {
      return
    }
    let cancelled = false
    void listExcelMergeFiles(taskId, 1, 100, token)
      .then((result) => {
        if (!cancelled) {
          setFiles(result.data)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [taskId, reloadKey])

  useEffect(() => {
    const token = getToken()
    if (!token || !taskId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void listExcelMergeData(taskId, page, limit, token, {
      fileId: fileId || undefined,
      ...(sort ? { sort, order } : {}),
    })
      .then((result) => {
        if (cancelled) {
          return
        }
        setDataColumns(result.columns)
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
          setError(apiErrorMessage(loadError, 'Unable to load final data.'))
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
  }, [taskId, page, limit, fileId, sort, order, reloadKey])

  const pageIds = rows.map((row) => row.id)
  const selectedOnPage = pageIds.filter((id) => selectedIds.includes(id))
  const allSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedOnPage.length > 0 && !allSelected
    }
  }, [allSelected, selectedOnPage.length])

  function chooseSort(nextSort: string) {
    setPage(1)
    if (!nextSort) {
      setSort('')
      setOrder('asc')
      return
    }
    if (sort !== nextSort) {
      setSort(nextSort)
      setOrder('asc')
      return
    }
    if (order === 'asc') {
      setOrder('desc')
      return
    }
    setSort('')
    setOrder('asc')
  }

  function toggleRow(id: string, checked: boolean) {
    if (checked && !selectedIds.includes(id) && selectedIds.length >= DELETE_LIMIT) {
      setNotice('You can delete up to 500 rows at a time.')
      return
    }
    setSelectedIds((current) => {
      if (!checked) {
        return current.filter((item) => item !== id)
      }
      if (current.includes(id) || current.length >= DELETE_LIMIT) {
        return current
      }
      return [...current, id]
    })
  }

  function togglePage(checked: boolean) {
    if (!checked) {
      const hidden = new Set(pageIds)
      setSelectedIds((current) => current.filter((id) => !hidden.has(id)))
      return
    }
    const adding = pageIds.filter((id) => !selectedIds.includes(id))
    if (selectedIds.length + adding.length > DELETE_LIMIT) {
      setNotice('You can delete up to 500 rows at a time.')
    }
    setSelectedIds((current) => {
      const room = DELETE_LIMIT - current.length
      const nextIds = pageIds.filter((id) => !current.includes(id)).slice(0, Math.max(room, 0))
      return [...current, ...nextIds]
    })
  }

  function askDelete(ids: string[]) {
    if (ids.length === 0) {
      return
    }
    setDeleteError('')
    setPendingDelete(ids.slice(0, DELETE_LIMIT))
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
        await deleteExcelMergeData(taskId, pendingDelete[0], token)
      } else {
        await deleteExcelMergeDataRows(taskId, pendingDelete, token)
      }
      const removed = new Set(pendingDelete)
      if (editing && removed.has(editing.id)) {
        setEditing(null)
      }
      setSelectedIds((current) => current.filter((id) => !removed.has(id)))
      setPendingDelete([])
      setNotice(removed.size === 1 ? 'Deleted 1 row.' : `Deleted ${removed.size} rows.`)
      setReloadKey((current) => current + 1)
    } catch (deleteFailure) {
      setDeleteError(apiErrorMessage(deleteFailure, 'Unable to delete these rows.'))
    } finally {
      setDeleting(false)
    }
  }

  const columnCount = columns.length + 5

  return (
    <div className="final-data-page">
      <div className="page-header">
        <div className="page-header-copy">
          <h1>{loadingTask && !task ? 'Loading…' : task?.name || 'Final data'}</h1>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!task || task.validCount === 0}
            title={task && task.validCount === 0 ? 'No rows to download yet' : 'Choose summary columns, then download'}
            onClick={() => setDownloadOpen(true)}
          >
            Download
          </button>
          <button type="button" className="btn btn-primary" disabled={!task} onClick={() => setAddOpen(true)}>
            Add row
          </button>
        </div>
      </div>

      {notice && (
        <p className="form-success" role="status">
          {notice}
        </p>
      )}
      {error && <p className="form-error">{error}</p>}

      <div className="club-toolbar">
        <label className="form-field club-filter" htmlFor="final-data-file">
          File
          <select
            id="final-data-file"
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
        <label className="form-field club-filter" htmlFor="final-data-sort">
          Sort
          <select
            id="final-data-sort"
            value={sort}
            onChange={(event) => {
              setPage(1)
              setSort(event.target.value)
              setOrder('asc')
            }}
          >
            <option value="">Oldest first</option>
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field club-filter" htmlFor="final-data-order">
          Order
          <select
            id="final-data-order"
            value={order}
            disabled={!sort}
            onChange={(event) => {
              setOrder(event.target.value === 'desc' ? 'desc' : 'asc')
              setPage(1)
            }}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
        <label className="form-field club-filter" htmlFor="final-data-limit">
          Rows
          <select
            id="final-data-limit"
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value))
              setPage(1)
            }}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        {selectedIds.length > 0 && (
          <button type="button" className="btn btn-unable btn-compact" onClick={() => askDelete(selectedIds)}>
            Delete selected ({selectedIds.length})
          </button>
        )}
      </div>

      <Pager page={page} totalPages={totalPages} total={total} limit={limit} loading={loading} onPage={setPage} />

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
                  disabled={loading || pageIds.length === 0}
                  onChange={(event) => togglePage(event.target.checked)}
                />
              </th>
              <SortHeading label="File" sortKey="fileName" sort={sort} order={order} onSort={chooseSort} />
              <SortHeading label="Row" sortKey="sourceRowNumber" sort={sort} order={order} onSort={chooseSort} />
              {columns.map((column) => (
                <SortHeading
                  key={column.key}
                  label={column.label}
                  sortKey={column.key}
                  sort={sort}
                  order={order}
                  onSort={chooseSort}
                >
                  {column.primary ? <span className="club-primary-badge">Primary</span> : null}
                </SortHeading>
              ))}
              <SortHeading label="Created" sortKey="createdAt" sort={sort} order={order} onSort={chooseSort} />
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="users-table-empty">
                  No rows yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={selectedIds.includes(row.id) ? 'is-selected' : undefined}>
                  <td>
                    <input
                      className="club-row-check"
                      type="checkbox"
                      aria-label={`Select row ${row.sourceRowNumber ?? row.id}`}
                      checked={selectedIds.includes(row.id)}
                      onChange={(event) => toggleRow(row.id, event.target.checked)}
                    />
                  </td>
                  <td>{row.fileName || '—'}</td>
                  <td>{row.sourceRowNumber == null ? '—' : row.sourceRowNumber}</td>
                  {columns.map((column) => (
                    <td key={column.key}>{formatCell(row.values?.[column.key])}</td>
                  ))}
                  <td>{formatDate(row.createdAt)}</td>
                  <td>
                    <div className="club-inline-actions">
                      <button type="button" className="btn btn-secondary btn-compact" onClick={() => setEditing(row)}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-unable btn-compact" onClick={() => askDelete([row.id])}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {downloadOpen && task && (
        <DownloadDialog
          taskId={taskId}
          columns={sortedColumns(task.columns)}
          sort={sort}
          order={order}
          onClose={() => setDownloadOpen(false)}
        />
      )}

      {addOpen && task && (
        <RowDialog
          columns={columns}
          files={files}
          onClose={() => setAddOpen(false)}
          onSaved={(text) => {
            setAddOpen(false)
            setNotice(text)
            setReloadKey((current) => current + 1)
          }}
          taskId={taskId}
        />
      )}

      {editing && (
        <EditDrawer
          taskId={taskId}
          row={editing}
          columns={columns}
          onClose={() => setEditing(null)}
          onDelete={() => askDelete([editing.id])}
          onSaved={(text) => {
            setEditing(null)
            setNotice(text)
            setReloadKey((current) => current + 1)
          }}
        />
      )}

      {pendingDelete.length > 0 && (
        <Modal
          title={pendingDelete.length === 1 ? 'Delete row' : 'Delete rows'}
          description="Deleted rows are removed from the merged data."
          labelledBy="final-data-delete-title"
          busy={deleting}
          stacked={Boolean(editing)}
          onClose={() => {
            if (!deleting) {
              setPendingDelete([])
            }
          }}
        >
          <p>
            {pendingDelete.length === 1
              ? 'Delete this row? This cannot be undone.'
              : `Delete ${pendingDelete.length} rows? This cannot be undone.`}
          </p>
          {deleteError && <p className="form-error">{deleteError}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setPendingDelete([])} disabled={deleting}>
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

function DownloadDialog({
  taskId,
  columns,
  sort,
  order,
  onClose,
}: {
  taskId: string
  columns: ExcelMergeColumn[]
  sort: string
  order: 'asc' | 'desc'
  onClose: () => void
}) {
  const [rowColumn, setRowColumn] = useState('')
  const [columnColumn, setColumnColumn] = useState('')
  const [totalLabel, setTotalLabel] = useState('Total')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      setLoading(false)
      return
    }
    let cancelled = false
    void getExcelMergeSummary(taskId, token)
      .then((summary) => {
        if (cancelled || !summary) {
          return
        }
        if (typeof summary.rowColumn === 'string') {
          setRowColumn(summary.rowColumn)
        }
        if (typeof summary.columnColumn === 'string') {
          setColumnColumn(summary.columnColumn)
        }
        if (typeof summary.totalLabel === 'string' && summary.totalLabel.trim()) {
          setTotalLabel(summary.totalLabel)
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(apiErrorMessage(loadError, 'Unable to load the saved summary.'))
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
  }, [taskId])

  const choices = columnChoices(columns, rowColumn, columnColumn)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }
    setDownloading(true)
    setError('')
    try {
      await downloadExcelMergeExport(taskId, token, {
        ...(sort ? { sort, order } : {}),
        rowColumn,
        columnColumn,
        totalLabel,
      })
      onClose()
    } catch (downloadError) {
      setError(apiErrorMessage(downloadError, 'Unable to download the Excel file.'))
      setDownloading(false)
    }
  }

  return (
    <Modal
      title="Download"
      description="Choose the row column, column column, and total label for the summary sheet. The current sort is kept."
      labelledBy="final-data-download-title"
      busy={downloading}
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={(event) => void submit(event)}>
        <div className="club-field-grid">
          <label className="form-field">
            <span>Row column</span>
            <select
              value={rowColumn}
              disabled={downloading || loading}
              onChange={(event) => setRowColumn(event.target.value)}
            >
              <option value="">None</option>
              {choices.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Column column</span>
            <select
              value={columnColumn}
              disabled={downloading || loading}
              onChange={(event) => setColumnColumn(event.target.value)}
            >
              <option value="">None</option>
              {choices.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field span-2">
            <span>Total label</span>
            <input
              value={totalLabel}
              disabled={downloading || loading}
              onChange={(event) => setTotalLabel(event.target.value)}
            />
          </label>
        </div>
        {loading && <p className="club-muted">Loading saved summary…</p>}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={downloading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={downloading || loading}>
            {downloading ? 'Downloading…' : 'Download'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function columnChoices(
  columns: ExcelMergeColumn[],
  rowColumn: string,
  columnColumn: string,
): { key: string; label: string }[] {
  const known = new Set(columns.map((column) => column.key))
  const extras: { key: string; label: string }[] = []
  for (const key of [rowColumn, columnColumn]) {
    if (!key || known.has(key)) {
      continue
    }
    known.add(key)
    extras.push({ key, label: key })
  }
  return [...extras, ...columns.map((column) => ({ key: column.key, label: column.label }))]
}

function SortHeading({
  label,
  sortKey,
  sort,
  order,
  onSort,
  children,
}: {
  label: string
  sortKey: string
  sort: string
  order: 'asc' | 'desc'
  onSort: (key: string) => void
  children?: ReactNode
}) {
  const active = sort === sortKey
  return (
    <th aria-sort={active ? (order === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`club-sort${active ? ' is-active' : ''}`} onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        {children}
        <span className="club-sort-mark" aria-hidden="true">
          {active ? (order === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
}

function RowDialog({
  taskId,
  columns,
  files,
  onClose,
  onSaved,
}: {
  taskId: string
  columns: OutputColumn[]
  files: ExcelMergeFileSummary[]
  onClose: () => void
  onSaved: (notice: string) => void
}) {
  const [fileId, setFileId] = useState('')
  const [sourceRowNumber, setSourceRowNumber] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }
    const rowNumber = parseRowNumber(sourceRowNumber)
    if (rowNumber === null) {
      setError('Source row must be a whole number, or left blank.')
      return
    }
    const values = filledValues(columns, drafts)
    if (Object.keys(values).length === 0) {
      setError('Enter at least one value.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await createExcelMergeData(
        taskId,
        {
          ...(fileId ? { fileId } : {}),
          ...(rowNumber !== undefined ? { sourceRowNumber: rowNumber } : {}),
          values,
        },
        token,
      )
      onSaved('Row added.')
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Unable to add this row.'))
      setSaving(false)
    }
  }

  return (
    <Modal title="Add row" description="Leave the file blank to add this row directly to the merged data." labelledBy="final-data-add-title" busy={saving} wide onClose={onClose}>
      <form className="stack-form" onSubmit={(event) => void submit(event)}>
        <div className="club-field-grid">
          <label className="form-field">
            <span>File</span>
            <select value={fileId} disabled={saving} onChange={(event) => setFileId(event.target.value)}>
              <option value="">Merged data</option>
              {files.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.fileName}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Source row</span>
            <input
              value={sourceRowNumber}
              inputMode="numeric"
              disabled={saving}
              onChange={(event) => setSourceRowNumber(event.target.value)}
            />
          </label>
          {columns.map((column) => (
            <label key={column.key} className="form-field">
              <span>
                {column.label}
                {column.primary ? <span className="club-primary-badge">Primary</span> : null}
                {column.required ? ' *' : ''}
              </span>
              <CellInput
                column={column}
                value={drafts[column.key] ?? ''}
                disabled={saving}
                onChange={(value) => setDrafts((current) => ({ ...current, [column.key]: value }))}
              />
            </label>
          ))}
        </div>
        {columns.length === 0 && <p className="field-hint">This task has no output columns yet.</p>}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || columns.length === 0}>
            {saving ? 'Adding…' : 'Add row'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EditDrawer({
  taskId,
  row,
  columns,
  onClose,
  onDelete,
  onSaved,
}: {
  taskId: string
  row: ExcelMergeDataRow
  columns: OutputColumn[]
  onClose: () => void
  onDelete: () => void
  onSaved: (notice: string) => void
}) {
  const fields = columns.length > 0 ? columns : columnsFromValues(row)
  const [drafts, setDrafts] = useState<Record<string, string>>(() => draftsFrom(row, fields))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }
    const values = changedValues(fields, drafts, row.values)
    if (Object.keys(values).length === 0) {
      setError('Change a value before saving.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await updateExcelMergeData(taskId, row.id, { values }, token)
      onSaved('Row updated.')
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Unable to update this row.'))
      setSaving(false)
    }
  }

  return (
    <Drawer
      title={row.fileName ? `${row.fileName} · row ${row.sourceRowNumber ?? '—'}` : 'Edit row'}
      description="Columns you leave unchanged stay as they are. The original uploaded values are kept."
      labelledBy="final-data-edit-title"
      busy={saving}
      wide
      onClose={onClose}
      footer={
        <div className="club-inline-actions">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn btn-unable" disabled={saving} onClick={onDelete}>
            Delete
          </button>
        </div>
      }
    >
      <div className="club-drawer-fields">
        {fields.map((column) => (
          <div key={column.key} className="club-field">
            <div className="club-field-label">
              <span>
                {column.label}
                {column.primary ? <span className="club-primary-badge">Primary</span> : null}
              </span>
            </div>
            <p className="club-original">Original: {formatCell(row.originalValues?.[column.key])}</p>
            <CellInput
              column={column}
              value={drafts[column.key] ?? ''}
              disabled={saving}
              onChange={(value) => setDrafts((current) => ({ ...current, [column.key]: value }))}
            />
          </div>
        ))}
      </div>
      {error && <p className="form-error">{error}</p>}
    </Drawer>
  )
}

function CellInput({
  column,
  value,
  disabled,
  onChange,
}: {
  column: OutputColumn
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  if (column.dataType === 'boolean') {
    return (
      <select aria-label={column.label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">—</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    )
  }

  return (
    <input
      aria-label={column.label}
      value={value}
      disabled={disabled}
      inputMode={inputModeFor(column.dataType)}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function mergeColumns(taskColumns: ExcelMergeColumn[], dataColumns: ExcelMergeDataColumn[]): OutputColumn[] {
  const fromTask = sortedColumns(taskColumns).map((column) => ({
    key: column.key,
    label: column.label,
    dataType: column.dataType,
    required: column.required,
    primary: column.primary,
  }))
  const known = new Set(fromTask.map((column) => column.key))
  const extra = dataColumns
    .filter((column) => column.key && !known.has(column.key))
    .map((column) => ({
      key: column.key,
      label: column.label || column.key,
      dataType: toExcelDataType(column.dataType),
      required: false,
      primary: false,
    }))
  return [...fromTask, ...extra]
}

function columnsFromValues(row: ExcelMergeDataRow): OutputColumn[] {
  return Object.keys({ ...row.originalValues, ...row.values }).map((key) => ({
    key,
    label: key,
    dataType: 'string',
    required: false,
    primary: false,
  }))
}

function draftsFrom(row: ExcelMergeDataRow, columns: OutputColumn[]): Record<string, string> {
  return Object.fromEntries(columns.map((column) => [column.key, valueToInput(row.values?.[column.key])]))
}

function filledValues(columns: OutputColumn[], drafts: Record<string, string>): Record<string, ExcelCellValue> {
  const values: Record<string, ExcelCellValue> = {}
  for (const column of columns) {
    const next = coerceCellValue(column.dataType, drafts[column.key] ?? '')
    if (next !== null) {
      values[column.key] = next
    }
  }
  return values
}

function changedValues(
  columns: OutputColumn[],
  drafts: Record<string, string>,
  current: Record<string, ExcelCellValue> | undefined,
): Record<string, ExcelCellValue> {
  const values: Record<string, ExcelCellValue> = {}
  for (const column of columns) {
    const draft = drafts[column.key] ?? ''
    if (draft === valueToInput(current?.[column.key])) {
      continue
    }
    values[column.key] = coerceCellValue(column.dataType, draft)
  }
  return values
}

function parseRowNumber(raw: string): number | undefined | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return undefined
  }
  if (!/^\d+$/.test(trimmed) || Number(trimmed) < 1) {
    return null
  }
  return Number(trimmed)
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
