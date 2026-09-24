import { useEffect, useMemo, useState } from 'react'
import {
  confirmExcelMergeMapping,
  getExcelMergeFile,
  listExcelMergeFiles,
  type ExcelMergeFileDetail,
  type ExcelMergeFileSummary,
  type ExcelMergeMappingEntry,
  type ExcelMergeTask,
  type ExcelSuggestedMapping,
} from '../../api/excel-merge'
import { getToken } from '../../lib/session'
import { apiErrorMessage, fileStatusLabel, reviewLines, sortedColumns, statusPillClass } from './format'

const IGNORE = '__ignore__'
const CREATE = '__create__'

interface MappingRow {
  sourceHeader: string
  sample: string
  inferredType: string
  choice: string
  reason: string
}

interface MappingTabProps {
  task: ExcelMergeTask
  fileId: string
  onFileChange: (fileId: string) => void
  onOpenTab: (tab: 'data' | 'errors') => void
  onTaskRefresh: () => Promise<void>
}

function choiceFromSuggestion(suggestion: ExcelSuggestedMapping | undefined): string {
  if (!suggestion || suggestion.action === 'unmapped') {
    return ''
  }
  if (suggestion.action === 'ignore') {
    return IGNORE
  }
  if (suggestion.action === 'create') {
    return CREATE
  }
  return suggestion.columnKey || ''
}

function buildRows(file: ExcelMergeFileDetail): MappingRow[] {
  const suggestionList = Array.isArray(file.suggestedMappings) ? file.suggestedMappings : []
  const suggestions = new Map(suggestionList.map((item) => [item.sourceHeader, item] as const))
  const analyzed = Array.isArray(file.analysis?.columns) ? file.analysis.columns : []
  if (analyzed.length > 0) {
    return analyzed.map((column) => {
      const suggestion = suggestions.get(column.header)
      return {
        sourceHeader: column.header,
        sample: (column.sampleValues ?? []).filter(Boolean).slice(0, 3).join(', '),
        inferredType: column.inferredType ?? '',
        choice: choiceFromSuggestion(suggestion),
        reason: suggestion?.reason ?? '',
      }
    })
  }

  return suggestionList.map((suggestion) => ({
    sourceHeader: suggestion.sourceHeader,
    sample: '',
    inferredType: '',
    choice: choiceFromSuggestion(suggestion),
    reason: suggestion.reason ?? '',
  }))
}

function rowsForTask(file: ExcelMergeFileDetail, frozen: boolean): MappingRow[] {
  const next = buildRows(file)
  if (!frozen) {
    return next
  }
  return next.map((row) => (row.choice === CREATE ? { ...row, choice: '' } : row))
}

export default function MappingTab({
  task,
  fileId,
  onFileChange,
  onOpenTab,
  onTaskRefresh,
}: MappingTabProps) {
  const columns = sortedColumns(task.columns)
  const namesLocked = task.schemaFrozen
  const [options, setOptions] = useState<ExcelMergeFileSummary[]>([])
  const [detail, setDetail] = useState<ExcelMergeFileDetail | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [sheetName, setSheetName] = useState('')
  const [headerRow, setHeaderRow] = useState('1')
  const [rows, setRows] = useState<MappingRow[]>([])
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState<'save' | 'process' | ''>('')

  useEffect(() => {
    const token = getToken()
    if (!token) {
      return
    }
    let cancelled = false
    void listExcelMergeFiles(task.id, 1, 100, token)
      .then((result) => {
        if (!cancelled) {
          setOptions(result.data)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [task.id, reloadKey])

  useEffect(() => {
    if (!fileId) {
      setDetail(null)
      setRows([])
      return
    }

    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    setStatus('')

    void getExcelMergeFile(task.id, fileId, token)
      .then((file) => {
        if (cancelled) {
          return
        }
        setDetail(file)
        setSheetName(file.analysis?.selectedSheet || file.selectedSheet || file.sheetNames?.[0] || '')
        setHeaderRow(String(file.analysis?.headerRow || file.headerRow || 1))
        setRows(rowsForTask(file, task.schemaFrozen))
      })
      .catch((loadError) => {
        if (!cancelled) {
          setDetail(null)
          setError(apiErrorMessage(loadError, 'Unable to load this file.'))
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
  }, [task.id, task.schemaFrozen, fileId, reloadKey])

  useEffect(() => {
    if (!detail || (detail.status !== 'processing' && detail.status !== 'uploaded')) {
      return
    }
    const timer = window.setTimeout(() => setReloadKey((current) => current + 1), 2000)
    return () => window.clearTimeout(timer)
  }, [detail])

  const sheets = detail?.analysis?.sheets ?? []
  const review = useMemo(() => reviewLines(detail?.review), [detail])
  const mappable = options.filter((file) => file.status !== 'failed')

  function applySheet(nextSheet: string) {
    setSheetName(nextSheet)
    const sheet = sheets.find((item) => item.name === nextSheet)
    if (sheet?.headerRow) {
      setHeaderRow(String(sheet.headerRow))
    }
  }

  async function submit(process: boolean) {
    const token = getToken()
    if (!token || !detail) {
      setError('Your session expired. Please log in again.')
      return
    }
    if (detail.status === 'failed') {
      setError(detail.failureMessage || 'This file failed and cannot be mapped.')
      return
    }

    const parsedHeader = Number(headerRow)
    if (!sheetName.trim()) {
      setError('Choose a sheet.')
      return
    }
    if (!Number.isInteger(parsedHeader) || parsedHeader < 1) {
      setError('Header row must be a whole number of 1 or more.')
      return
    }
    if (rows.length === 0) {
      setError('No columns were detected in this file.')
      return
    }
    if (rows.some((row) => !row.choice)) {
      setError('Choose a master column or Ignore for every uploaded column.')
      return
    }

    const used = new Set<string>()
    for (const row of rows) {
      if (row.choice === IGNORE || row.choice === CREATE) {
        continue
      }
      if (used.has(row.choice)) {
        const label = columns.find((column) => column.key === row.choice)?.label ?? row.choice
        setError(`Two uploaded columns cannot map to ${label}.`)
        return
      }
      used.add(row.choice)
    }

    const mappings: ExcelMergeMappingEntry[] = rows.map((row) => {
      if (row.choice === IGNORE) {
        return { sourceHeader: row.sourceHeader, action: 'ignore' }
      }
      if (row.choice === CREATE) {
        return { sourceHeader: row.sourceHeader, action: 'create' }
      }
      return { sourceHeader: row.sourceHeader, action: 'map', columnKey: row.choice }
    })

    setSaving(process ? 'process' : 'save')
    setError('')
    setStatus('')
    try {
      const file = await confirmExcelMergeMapping(
        task.id,
        detail.id,
        { sheetName: sheetName.trim(), headerRow: parsedHeader, process, mappings },
        token,
      )
      setDetail(file)
      setRows(rowsForTask(file, namesLocked))
      setReloadKey((current) => current + 1)
      await onTaskRefresh()
      if (file.status === 'failed') {
        setError(file.failureMessage || 'Processing failed.')
        return
      }
      setStatus(
        process
          ? `Processed ${file.fileName}: ${file.validCount} valid, ${file.errorCount} errors.`
          : 'Mapping saved. Process the file when you are ready.',
      )
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Unable to save this mapping.'))
    } finally {
      setSaving('')
    }
  }

  const busy = saving !== '' || detail?.status === 'processing' || detail?.status === 'uploaded'
  const failed = detail?.status === 'failed'

  return (
    <div>
      <div className="club-toolbar">
        <label className="form-field club-filter" htmlFor="club-map-file">
          File
          <select
            id="club-map-file"
            value={fileId}
            onChange={(event) => onFileChange(event.target.value)}
          >
            <option value="">Choose a file</option>
            {mappable.map((file) => (
              <option key={file.id} value={file.id}>
                {file.fileName} · {fileStatusLabel(file.status)}
              </option>
            ))}
            {detail && fileId && !mappable.some((file) => file.id === fileId) && (
              <option value={fileId}>{detail.fileName}</option>
            )}
          </select>
        </label>
      </div>

      {!fileId && <p className="club-muted">Choose an analyzed file to map its columns.</p>}
      {loading && <p className="club-muted">Loading file…</p>}
      {error && <p className="form-error">{error}</p>}
      {status && <p className="form-success">{status}</p>}

      {detail && !loading && (
        <>
          <div className="club-file-meta">
            <span className={`status-pill ${statusPillClass(detail.status)}`}>
              {fileStatusLabel(detail.status)}
            </span>
            <span>
              {detail.validCount} valid · {detail.errorCount} errors
            </span>
          </div>

          {failed && detail.failureMessage && <p className="form-error">{detail.failureMessage}</p>}

          {review.length > 0 && (
            <div className="club-review">
              <strong>Saved mapping</strong>
              <ul>
                {review.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {!failed && (
            <>
              <div className="club-mapping-fields">
                <label className="form-field">
                  <span>Sheet</span>
                  <select value={sheetName} onChange={(event) => applySheet(event.target.value)} disabled={busy}>
                    <option value="">Choose a sheet</option>
                    {(sheets.length > 0 ? sheets.map((sheet) => sheet.name) : detail.sheetNames).map((name) => {
                      const sheet = sheets.find((item) => item.name === name)
                      return (
                        <option key={name} value={name}>
                          {name}
                          {sheet?.isLikelyDataSheet ? ' · data' : ''}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <label className="form-field">
                  <span>Header row</span>
                  <input
                    inputMode="numeric"
                    value={headerRow}
                    disabled={busy}
                    onChange={(event) => setHeaderRow(event.target.value)}
                  />
                </label>
              </div>

              {rows.length === 0 ? (
                <p className="club-muted">No columns were detected in this file.</p>
              ) : (
                <div className="users-table-wrap">
                  <table className="users-table club-mapping-table">
                    <thead>
                      <tr>
                        <th>Uploaded column</th>
                        <th>Sample</th>
                        <th>Master column</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.sourceHeader}>
                          <td>
                            <span className="club-task-name">{row.sourceHeader}</span>
                            {row.inferredType && <span className="club-muted">{row.inferredType}</span>}
                          </td>
                          <td>{row.sample || '—'}</td>
                          <td>
                            <select
                              aria-label={`Map ${row.sourceHeader}`}
                              value={row.choice}
                              disabled={busy}
                              onChange={(event) =>
                                setRows((current) =>
                                  current.map((item) =>
                                    item.sourceHeader === row.sourceHeader
                                      ? { ...item, choice: event.target.value }
                                      : item,
                                  ),
                                )
                              }
                            >
                              <option value="">Choose a column</option>
                              {row.choice &&
                                row.choice !== IGNORE &&
                                row.choice !== CREATE &&
                                !columns.some((column) => column.key === row.choice) && (
                                  <option value={row.choice}>{row.choice}</option>
                                )}
                              {columns.map((column) => (
                                <option key={column.key} value={column.key}>
                                  {column.label}
                                  {column.required ? ' · required' : ''}
                                </option>
                              ))}
                              {!namesLocked && <option value={CREATE}>Create new column</option>}
                              <option value={IGNORE}>Ignore</option>
                            </select>
                            {row.reason === 'saved' && <span className="club-muted">Used before</span>}
                            {row.reason === 'name_match' && row.choice && (
                              <span className="club-muted">Name match</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="club-inline-actions club-column-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy || rows.length === 0}
                  onClick={() => void submit(false)}
                >
                  {saving === 'save' ? 'Saving…' : 'Save mapping'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || rows.length === 0}
                  onClick={() => void submit(true)}
                >
                  {saving === 'process' ? 'Processing…' : 'Confirm and process'}
                </button>
                {detail.errorCount > 0 && (
                  <button type="button" className="btn btn-secondary" onClick={() => onOpenTab('errors')}>
                    Review errors
                  </button>
                )}
                {detail.validCount > 0 && (
                  <button type="button" className="btn btn-secondary" onClick={() => onOpenTab('data')}>
                    View valid rows
                  </button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
