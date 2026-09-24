import { useEffect, useMemo, useState } from 'react'
import {
  confirmExcelMergeMapping,
  getExcelMergeFile,
  listExcelMergeFiles,
  toExcelDataType,
  type ExcelDataType,
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
  id: string
  sourceHeader: string
  sample: string
  choice: string
  reason: string
  label: string
  dataType: ExcelDataType
  required: boolean
  primary: boolean
}

interface MappingTabProps {
  task: ExcelMergeTask
  fileId: string
  onFileChange: (fileId: string) => void
  onOpenTab: (tab: 'data' | 'errors') => void
  onTaskRefresh: () => Promise<void>
}

function choiceFromSuggestion(suggestion: ExcelSuggestedMapping | undefined): string {
  if (suggestion?.action === 'ignore') {
    return IGNORE
  }
  if (
    suggestion?.columnKey &&
    (suggestion.action === 'map' || suggestion.reason === 'name_match' || suggestion.reason === 'saved')
  ) {
    return suggestion.columnKey
  }
  return CREATE
}

function rowFromSource(
  header: string,
  index: number,
  sample: string,
  inferredType: unknown,
  suggestion: ExcelSuggestedMapping | undefined,
): MappingRow {
  const choice = choiceFromSuggestion(suggestion)
  const suggestedLabel = suggestion?.label?.trim() || suggestion?.columnLabel?.trim() || ''
  return {
    id: `${index}:${header}`,
    sourceHeader: header,
    sample,
    choice,
    reason: suggestion?.reason ?? (suggestion?.action === 'unmapped' ? 'unmapped' : ''),
    label: suggestedLabel || header,
    dataType: toExcelDataType(suggestion?.dataType ?? inferredType),
    required: suggestion?.required === true,
    primary: choice === CREATE && suggestion?.primary === true,
  }
}

function buildRows(file: ExcelMergeFileDetail): MappingRow[] {
  const suggestionList = Array.isArray(file.suggestedMappings) ? file.suggestedMappings : []
  const byHeader = new Map(suggestionList.map((item) => [item.sourceHeader, item] as const))
  const analyzed = Array.isArray(file.analysis?.columns) ? file.analysis.columns : []
  const rows =
    analyzed.length > 0
      ? analyzed.map((column, index) => {
          const suggestion =
            byHeader.get(column.header) ?? suggestionList.find((item) => item.sourceIndex === column.index)
          const sample = (column.sampleValues ?? []).filter(Boolean).slice(0, 3).join(', ')
          return rowFromSource(column.header, index, sample, column.inferredType, suggestion)
        })
      : suggestionList.map((suggestion, index) =>
          rowFromSource(suggestion.sourceHeader, index, '', undefined, suggestion),
        )

  let primaryTaken = false
  return rows.map((row) => {
    if (!row.primary) {
      return row
    }
    if (primaryTaken) {
      return { ...row, primary: false }
    }
    primaryTaken = true
    return row
  })
}

function mappingHint(row: MappingRow): string {
  if (!row.choice) {
    return ''
  }
  if (row.reason === 'saved') {
    return 'Previous choice for this column.'
  }
  if (row.reason === 'name_match') {
    return 'Matched an output column with the same name.'
  }
  return ''
}

export default function MappingTab({
  task,
  fileId,
  onFileChange,
  onOpenTab,
  onTaskRefresh,
}: MappingTabProps) {
  const columns = sortedColumns(task.columns)
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

    void getExcelMergeFile(task.id, fileId, token)
      .then((file) => {
        if (cancelled) {
          return
        }
        setDetail(file)
        setSheetName(file.analysis?.selectedSheet || file.selectedSheet || file.sheetNames?.[0] || '')
        setHeaderRow(String(file.analysis?.headerRow || file.headerRow || 1))
        setRows(buildRows(file))
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
  }, [task.id, fileId, reloadKey])

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
  const existingPrimary = columns.find((column) => column.primary)

  function applySheet(nextSheet: string) {
    setSheetName(nextSheet)
    const sheet = sheets.find((item) => item.name === nextSheet)
    if (sheet?.headerRow) {
      setHeaderRow(String(sheet.headerRow))
    }
  }

  function updateRow(id: string, patch: Partial<MappingRow>) {
    setRows((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
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
      setError('Choose Map, Add to Output, or Ignore for every Excel column.')
      return
    }

    const used = new Set<string>()
    for (const row of rows) {
      if (row.choice === IGNORE || row.choice === CREATE) {
        continue
      }
      if (used.has(row.choice)) {
        const label = columns.find((column) => column.key === row.choice)?.label ?? row.choice
        setError(`Two Excel columns cannot use the same output column (${label}).`)
        return
      }
      used.add(row.choice)
    }

    const primaryCreates = rows.filter((row) => row.choice === CREATE && row.primary)
    if (primaryCreates.length > 1) {
      setError('Only one new output column can be primary.')
      return
    }

    const mappings: ExcelMergeMappingEntry[] = rows.map((row) => {
      if (row.choice === IGNORE) {
        return { sourceHeader: row.sourceHeader, action: 'ignore' }
      }
      if (row.choice === CREATE) {
        const label = row.label.trim()
        return {
          sourceHeader: row.sourceHeader,
          action: 'create',
          ...(label ? { label } : {}),
          dataType: row.dataType,
          required: row.required,
          ...(row.primary ? { primary: true } : {}),
        }
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
      setRows(buildRows(file))
      await onTaskRefresh()
      setReloadKey((current) => current + 1)
      if (file.status === 'failed') {
        setError(file.failureMessage || 'Processing failed.')
        return
      }
      setStatus(
        process
          ? `Processed ${file.fileName}: ${file.validCount} valid, ${file.errorCount} errors.`
          : 'Column matching saved. New output columns are available now. Process this file when you are ready.',
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

      {!fileId && <p className="club-muted">Choose a file to match its columns.</p>}
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
              <strong>Saved matching</strong>
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

              <p className="club-expected">
                Each Excel column starts as Add to output. Map it to an existing column, or ignore it. A saved match or
                an exact name still uses that output column. Adding a column updates the output format immediately.
                Set the column type from the output format. Older merged rows stay blank for that column.
              </p>

              {rows.length === 0 ? (
                <p className="club-muted">No columns were detected in this file.</p>
              ) : (
                <div className="club-match-list">
                  <div className="club-match-head">
                    <span>Excel column</span>
                    <span className="club-match-arrow" aria-hidden="true" />
                    <span>Output</span>
                  </div>
                  {rows.map((row) => {
                    const output = columns.find((column) => column.key === row.choice)
                    const hint = mappingHint(row)
                    return (
                      <div className="club-match-row" key={row.id}>
                        <div>
                          <span className="club-task-name">{row.sourceHeader}</span>
                          {row.sample && <span className="club-muted">{row.sample}</span>}
                          {hint && <span className="club-reason">{hint}</span>}
                        </div>
                        <span className="club-match-arrow" aria-hidden="true">
                          →
                        </span>
                        <div className="club-match-output">
                          <select
                            aria-label={`Output for ${row.sourceHeader}`}
                            value={row.choice}
                            disabled={busy}
                            onChange={(event) => {
                              const choice = event.target.value
                              updateRow(row.id, {
                                choice,
                                label: choice === CREATE && !row.label.trim() ? row.sourceHeader : row.label,
                                primary: choice === CREATE ? row.primary : false,
                              })
                            }}
                          >
                            <option value="">Choose an action</option>
                            <optgroup label="Map">
                              {columns.length === 0 && (
                                <option value="__none__" disabled>
                                  No output columns yet
                                </option>
                              )}
                              {row.choice &&
                                row.choice !== IGNORE &&
                                row.choice !== CREATE &&
                                !output && <option value={row.choice}>{row.choice}</option>}
                              {columns.map((column) => (
                                <option key={column.key} value={column.key}>
                                  {column.label}
                                  {column.primary ? ' (primary)' : ''}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Add to Output">
                              <option value={CREATE}>Add “{row.sourceHeader}” to output</option>
                            </optgroup>
                            <optgroup label="Ignore">
                              <option value={IGNORE}>Ignore</option>
                            </optgroup>
                          </select>
                          {row.choice === CREATE && (
                            <div className="club-create-options">
                              <span className="club-new-output">New output column</span>
                              <label className="form-field">
                                <span>Output name</span>
                                <input
                                  aria-label={`Output name for ${row.sourceHeader}`}
                                  value={row.label}
                                  placeholder={row.sourceHeader}
                                  disabled={busy}
                                  onChange={(event) => updateRow(row.id, { label: event.target.value })}
                                />
                              </label>
                              <label className="checkbox-field">
                                <input
                                  type="checkbox"
                                  checked={row.required}
                                  disabled={busy}
                                  onChange={(event) => updateRow(row.id, { required: event.target.checked })}
                                />
                                Required
                              </label>
                              <label className="checkbox-field">
                                <input
                                  type="checkbox"
                                  checked={row.primary}
                                  disabled={busy}
                                  onChange={(event) => {
                                    const primary = event.target.checked
                                    setRows((current) =>
                                      current.map((item) => ({
                                        ...item,
                                        primary: item.id === row.id ? primary : primary ? false : item.primary,
                                      })),
                                    )
                                  }}
                                />
                                Set as primary
                              </label>
                              {row.primary && existingPrimary && (
                                <p className="club-muted">
                                  This replaces {existingPrimary.label} as the primary column.
                                </p>
                              )}
                            </div>
                          )}
                          {row.choice === IGNORE && (
                            <span className="club-muted">This Excel column will not be included</span>
                          )}
                          {output && (
                            <span className="club-muted">
                              Maps to {output.label}
                              {output.primary ? ' · primary column' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="club-inline-actions club-column-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy || rows.length === 0}
                  onClick={() => void submit(false)}
                >
                  {saving === 'save' ? 'Saving…' : 'Save matching'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || rows.length === 0}
                  onClick={() => void submit(true)}
                >
                  {saving === 'process' ? 'Processing…' : 'Process'}
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
