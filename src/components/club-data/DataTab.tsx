import { useEffect, useState } from 'react'
import {
  listExcelMergeData,
  listExcelMergeFiles,
  type ExcelMergeDataColumn,
  type ExcelMergeDataRow,
  type ExcelMergeFileSummary,
  type ExcelMergeTask,
} from '../../api/excel-merge'
import { getToken } from '../../lib/session'
import Pager from './Pager'
import { apiErrorMessage, formatCell } from './format'

const PAGE_SIZE = 50

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
    void listExcelMergeData(task.id, page, PAGE_SIZE, token, fileId)
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
  }, [task.id, page, fileId, task.validCount])

  return (
    <div>
      <p className="club-expected">
        These rows go into the combined Excel file. Pending errors stay out until they are approved.
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
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={Math.max(2, columns.length + 2)} className="users-table-empty">
                  No valid rows yet. Process a mapped file, or approve a corrected error.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.fileName}</td>
                  <td>{row.sourceRowNumber}</td>
                  {columns.map((column) => (
                    <td key={column.key}>{formatCell(row.values?.[column.key])}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
