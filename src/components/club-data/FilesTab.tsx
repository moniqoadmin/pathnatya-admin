import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import {
  EXCEL_FILE_STATUSES,
  EXCEL_MERGE_ACCEPT,
  EXCEL_MERGE_MAX_BYTES,
  EXCEL_MERGE_MAX_FILES,
  listExcelMergeFiles,
  processExcelMergeFile,
  uploadExcelMergeFiles,
  type ExcelFileStatus,
  type ExcelMergeFileSummary,
  type ExcelMergeTask,
} from '../../api/excel-merge'
import { getToken } from '../../lib/session'
import Pager from './Pager'
import { apiErrorMessage, fileStatusLabel, fileStep, formatBytes, formatDate, isExcelFile, sortedColumns } from './format'

const PAGE_SIZE = 20

interface FilesTabProps {
  task: ExcelMergeTask
  onTaskRefresh: () => Promise<void>
  onOpenMapping: (fileId: string) => void
  onNotice: (kind: 'success' | 'error', text: string) => void
}

export default function FilesTab({ task, onTaskRefresh, onOpenMapping, onNotice }: FilesTabProps) {
  const [status, setStatus] = useState<ExcelFileStatus | ''>('')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [rows, setRows] = useState<ExcelMergeFileSummary[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [processingId, setProcessingId] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const outputNames = sortedColumns(task.columns).map((column) =>
    column.primary ? `${column.label} (primary)` : column.label,
  )

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void listExcelMergeFiles(task.id, page, PAGE_SIZE, token, status)
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
          setError(apiErrorMessage(loadError, 'Unable to load files.'))
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
  }, [task.id, page, status, reloadKey])

  useEffect(() => {
    const waiting = rows.some((file) => file.status === 'processing' || file.status === 'uploaded')
    if (!waiting) {
      return
    }
    const timer = window.setTimeout(() => {
      setReloadKey((current) => current + 1)
      void onTaskRefresh()
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [rows, onTaskRefresh])

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (selected.length === 0) {
      return
    }

    const problems: string[] = []
    const accepted: File[] = []
    for (const file of selected) {
      if (!isExcelFile(file)) {
        problems.push(`${file.name} is not an Excel file.`)
        continue
      }
      if (file.size > EXCEL_MERGE_MAX_BYTES) {
        problems.push(`${file.name} is larger than 20 MB.`)
        continue
      }
      accepted.push(file)
    }

    const room = EXCEL_MERGE_MAX_FILES - pending.length
    if (accepted.length > room) {
      problems.push(`You can upload ${EXCEL_MERGE_MAX_FILES} files at a time.`)
    }
    const allowed = accepted.slice(0, Math.max(room, 0))
    if (allowed.length > 0) {
      setPending((current) => [...current, ...allowed].slice(0, EXCEL_MERGE_MAX_FILES))
    }

    if (problems.length > 0) {
      onNotice('error', problems.join('\n'))
    }
  }

  async function upload() {
    const token = getToken()
    if (!token) {
      onNotice('error', 'Your session expired. Please log in again.')
      return
    }
    if (pending.length === 0) {
      return
    }

    setUploading(true)
    try {
      const result = await uploadExcelMergeFiles(task.id, pending, token)
      setPending([])
      setReloadKey((current) => current + 1)
      await onTaskRefresh()

      const failed = result.files.filter((file) => file.status === 'failed')
      if (failed.length > 0) {
        onNotice(
          'error',
          failed
            .map((file) => file.failureMessage || `${file.fileName} could not be analyzed.`)
            .join('\n'),
        )
        return
      }

      if (result.files.length === 1 && result.files[0]?.status === 'analyzed') {
        onNotice('success', `${result.files[0].fileName} needs column matching.`)
        onOpenMapping(result.files[0].id)
        return
      }

      onNotice(
        'success',
        `Uploaded ${result.files.length} file${result.files.length === 1 ? '' : 's'}. Match columns for each file that is ready.`,
      )
    } catch (uploadError) {
      onNotice('error', apiErrorMessage(uploadError, 'Unable to upload those files.'))
      setReloadKey((current) => current + 1)
      await onTaskRefresh().catch(() => undefined)
    } finally {
      setUploading(false)
    }
  }

  async function processFile(fileId: string) {
    const token = getToken()
    if (!token) {
      onNotice('error', 'Your session expired. Please log in again.')
      return
    }
    setProcessingId(fileId)
    try {
      const file = await processExcelMergeFile(task.id, fileId, token)
      setReloadKey((current) => current + 1)
      await onTaskRefresh()
      if (file.status === 'failed') {
        onNotice('error', file.failureMessage || 'Processing failed.')
        return
      }
      onNotice(
        'success',
        `${file.fileName}: ${file.validCount} valid, ${file.errorCount} error${file.errorCount === 1 ? '' : 's'}.`,
      )
    } catch (processError) {
      onNotice('error', apiErrorMessage(processError, 'Unable to process this file.'))
    } finally {
      setProcessingId('')
    }
  }

  return (
    <div>
      <div className="club-upload-panel">
        <div className="club-upload">
          <p className="club-expected">
            Uploading a file only reads it. It does not add output columns. Match each column afterward, including on
            the first file. New columns can be added to the output later. Rows already merged stay in Data and leave
            those cells blank.
            {outputNames.length > 0 ? ` Output format: ${outputNames.join(', ')}.` : ''}
          </p>
          <div className="file-picker">
            <input
              ref={fileInputRef}
              id="club-data-files"
              type="file"
              accept={EXCEL_MERGE_ACCEPT}
              multiple
              hidden
              onChange={chooseFiles}
              disabled={uploading}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              Choose Excel files
            </button>
            <p className="file-picker-name">
              {pending.length === 0
                ? 'No files selected'
                : `${pending.length} file${pending.length === 1 ? '' : 's'} selected`}
            </p>
          </div>
          <p className="field-hint">Up to {EXCEL_MERGE_MAX_FILES} files, 20 MB each.</p>
        </div>
        {pending.length > 0 && (
          <ul className="club-pending-files">
            {pending.map((file) => (
              <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                <span>
                  {file.name}
                  <span className="club-muted"> {formatBytes(file.size)}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  onClick={() =>
                    setPending((current) =>
                      current.filter(
                        (item) =>
                          !(
                            item.name === file.name &&
                            item.size === file.size &&
                            item.lastModified === file.lastModified
                          ),
                      ),
                    )
                  }
                  disabled={uploading}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="club-inline-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void upload()}
            disabled={uploading || pending.length === 0}
          >
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      <div className="club-toolbar">
        <label className="form-field club-filter" htmlFor="club-file-status">
          Status
          <select
            id="club-file-status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ExcelFileStatus | '')
              setPage(1)
            }}
          >
            <option value="">All statuses</option>
            {EXCEL_FILE_STATUSES.map((item) => (
              <option key={item} value={item}>
                {fileStatusLabel(item)}
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
              <th>Next step</th>
              <th>Uploaded</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="users-table-empty">
                  No files uploaded yet.
                </td>
              </tr>
            ) : (
              rows.map((file) => (
                <tr key={file.id}>
                  <td>
                    <span className="club-task-name">{file.fileName}</span>
                    <span className="club-muted">
                      {formatBytes(file.fileSize)}
                      {file.selectedSheet ? ` · ${file.selectedSheet}` : ''}
                      {file.headerRow ? ` · header row ${file.headerRow}` : ''}
                    </span>
                    {file.status === 'failed' && file.failureMessage && (
                      <span className="club-failure">{file.failureMessage}</span>
                    )}
                  </td>
                  <td>
                    <div className="club-next-step">
                      <span>{fileStep(file)}</span>
                      <div className="club-inline-actions">
                        {file.status === 'analyzed' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-compact"
                            onClick={() => onOpenMapping(file.id)}
                          >
                            Match Columns
                          </button>
                        )}
                        {file.status === 'mapping_confirmed' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-compact"
                              onClick={() => void processFile(file.id)}
                              disabled={processingId === file.id}
                            >
                              {processingId === file.id ? 'Processing…' : 'Process'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-compact"
                              onClick={() => onOpenMapping(file.id)}
                            >
                              Match Columns
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{formatDate(file.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
