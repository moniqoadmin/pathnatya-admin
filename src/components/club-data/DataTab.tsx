import { useEffect, useState } from 'react'
import {
  listExcelMergeData,
  listExcelMergeFiles,
  type ExcelMergeColumn,
  type ExcelMergeDataColumn,
  type ExcelMergeDataRow,
  type ExcelMergeFileSummary,
  type ExcelMergeTask,
} from '../../api/excel-merge'
import { getToken } from '../../lib/session'
import Drawer from './Drawer'
import Pager from './Pager'
import { apiErrorMessage, formatCell, sortedColumns } from './format'

const PAGE_SIZE = 50
const PREVIEW_COUNT = 4

function orderByOutput(columns: ExcelMergeDataColumn[], taskColumns: ExcelMergeColumn[]): ExcelMergeDataColumn[] {
  const byKey = new Map(columns.map((column) => [column.key, column]))
  const fromTask = sortedColumns(taskColumns).map(
    (column) =>
      byKey.get(column.key) ?? {
        key: column.key,
        label: column.label,
        dataType: column.dataType,
      },
  )
  const known = new Set(fromTask.map((column) => column.key))
  return [...fromTask, ...columns.filter((column) => !known.has(column.key))]
}

function previewColumns(
  columns: ExcelMergeDataColumn[],
  taskColumns: ExcelMergeColumn[],
): ExcelMergeDataColumn[] {
  const ordered = orderByOutput(columns, taskColumns)
  const primary = new Set(taskColumns.filter((column) => column.primary).map((column) => column.key))
  const required = new Set(taskColumns.filter((column) => column.required).map((column) => column.key))
  const primaryColumns = ordered.filter((column) => primary.has(column.key))
  const requiredColumns = ordered.filter((column) => required.has(column.key) && !primary.has(column.key))
  const rest = ordered.filter((column) => !primary.has(column.key) && !required.has(column.key))
  const chosen = [...primaryColumns, ...requiredColumns, ...rest].slice(0, PREVIEW_COUNT)
  return chosen.length > 0 ? chosen : ordered.slice(0, PREVIEW_COUNT)
}

interface DataTabProps {
  task: ExcelMergeTask
}

export default function DataTab({ task }: DataTabProps) {
  const [fileId, setFileId] = useState('')
  const [files, setFiles] = useState<ExcelMergeFileSummary[]>([])
  const [page, setPage] = useState(1)
  const [columns, setColumns] = useState<ExcelMergeDataColumn[]>([])
  const [rows, setRows] = useState<ExcelMergeDataRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const columnSignature = sortedColumns(task.columns)
    .map((column) => `${column.id}:${column.sortOrder}:${column.primary ? 1 : 0}:${column.label}`)
    .join('|')
  const primaryKeys = new Set(task.columns.filter((column) => column.primary).map((column) => column.key))

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
    void listExcelMergeData(task.id, page, PAGE_SIZE, token, { fileId })
      .then((result) => {
        if (cancelled) {
          return
        }
        setColumns(result.columns)
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
          setError(apiErrorMessage(loadError, 'Unable to load valid rows.'))
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
  }, [task.id, page, fileId, task.validCount, columnSignature])

  const orderedColumns = orderByOutput(columns, task.columns)
  const preview = previewColumns(columns, task.columns)
  const selected = rows.find((row) => row.id === selectedId) ?? null

  return (
    <div>
      <p className="club-expected">
        These rows go into the combined Excel file, in the current output-column order. Open a row to see every output
        column. A column added after a row was merged is blank. Pending errors stay on Errors until they are approved.
      </p>
      <div className="club-toolbar">
        <label className="form-field club-filter" htmlFor="club-data-file">
          File
          <select
            id="club-data-file"
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
      <div className="users-table-wrap">
        <table className="users-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Row</th>
              {preview.map((column) => (
                <th key={column.key}>
                  <span className="club-col-heading">
                    {column.label}
                    {primaryKeys.has(column.key) && <span className="club-primary-badge">Primary</span>}
                  </span>
                </th>
              ))}
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={preview.length + 3} className="users-table-empty">
                  No valid rows yet. Process a file, or approve a corrected error.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="is-clickable" onClick={() => setSelectedId(row.id)}>
                  <td>{row.fileName}</td>
                  <td>{row.sourceRowNumber}</td>
                  {preview.map((column) => (
                    <td key={column.key}>{formatCell(row.values?.[column.key])}</td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary btn-compact"
                      onClick={(event) => {
                        event.stopPropagation()
                        setSelectedId(row.id)
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {selected && (
        <Drawer
          title={`${selected.fileName} · row ${selected.sourceRowNumber}`}
          description="Every output column for this row."
          labelledBy="club-data-row-title"
          onClose={() => setSelectedId('')}
        >
          <dl className="club-detail-list">
            <div>
              <dt>File</dt>
              <dd>{selected.fileName}</dd>
            </div>
            <div>
              <dt>Row</dt>
              <dd>{selected.sourceRowNumber}</dd>
            </div>
            {orderedColumns.map((column) => (
              <div key={column.key}>
                <dt>
                  {column.label}
                  {primaryKeys.has(column.key) && <span className="club-primary-badge">Primary</span>}
                </dt>
                <dd>{formatCell(selected.values?.[column.key])}</dd>
              </div>
            ))}
          </dl>
        </Drawer>
      )}
    </div>
  )
}
