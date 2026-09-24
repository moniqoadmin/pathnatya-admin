import { type FormEvent, useEffect, useState } from 'react'
import {
  getExcelMergeSummary,
  getExcelMergeTask,
  updateExcelMergeSummary,
  type ExcelMergeSummary,
} from '../../api/excel-merge'
import { getToken } from '../../lib/session'
import Modal from '../Modal'
import { apiErrorMessage, sortedColumns } from './format'

const EMPTY_SUMMARY = {
  rowColumn: '',
  columnColumn: '',
  totalLabel: 'Total',
  metrics: [],
}

interface SummaryColumn {
  key: string
  label: string
}

interface SummaryJsonDialogProps {
  taskId: string
  taskName: string
  onClose: () => void
  onSaved: () => void
}

export default function SummaryJsonDialog({ taskId, taskName, onClose, onSaved }: SummaryJsonDialogProps) {
  const [text, setText] = useState('')
  const [columns, setColumns] = useState<SummaryColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      setLoadFailed(true)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadFailed(false)
    setError('')
    void Promise.all([getExcelMergeSummary(taskId, token), getExcelMergeTask(taskId, token)])
      .then(([summary, task]) => {
        if (cancelled) {
          return
        }
        setColumns(sortedColumns(task.columns).map((column) => ({ key: column.key, label: column.label })))
        setText(JSON.stringify(summary ?? EMPTY_SUMMARY, null, 2))
      })
      .catch((loadError) => {
        if (!cancelled) {
          setLoadFailed(true)
          setError(apiErrorMessage(loadError, 'Unable to load the summary.'))
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

  async function submit(event: FormEvent) {
    event.preventDefault()
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }
    const parsed = parseSummaryJson(text)
    if (parsed.error || !parsed.value) {
      setError(parsed.error || 'Enter valid JSON.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await updateExcelMergeSummary(taskId, parsed.value, token)
      onSaved()
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Unable to save the summary.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Summary JSON"
      description={`Summary sheet settings for ${taskName}. Use each column key in rowColumn, columnColumn, and metrics.`}
      labelledBy="club-summary-title"
      busy={saving}
      wide
      onClose={onClose}
    >
      <form className="stack-form" onSubmit={(event) => void submit(event)}>
        {loading ? (
          <p className="club-muted">Loading summary…</p>
        ) : (
          <>
            {columns.length > 0 && (
              <p className="field-hint">
                Column keys:{' '}
                {columns.map((column) => (
                  <code key={column.key} className="club-summary-key">
                    {column.key}
                  </code>
                ))}
              </p>
            )}
            <label htmlFor="club-summary-json">JSON</label>
            <textarea
              id="club-summary-json"
              className="club-summary-json"
              value={text}
              spellCheck={false}
              disabled={saving || loadFailed}
              onChange={(event) => setText(event.target.value)}
            />
          </>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || loading || loadFailed || !text.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function parseSummaryJson(text: string): { value?: ExcelMergeSummary; error?: string } {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { error: 'Enter valid JSON.' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: 'Summary must be a JSON object.' }
  }
  const record = parsed as Record<string, unknown>
  for (const key of ['rowColumn', 'columnColumn', 'totalLabel'] as const) {
    if (key in record && record[key] !== undefined && typeof record[key] !== 'string') {
      return { error: `${key} must be text.` }
    }
  }
  if ('metrics' in record && record.metrics !== undefined && !Array.isArray(record.metrics)) {
    return { error: 'metrics must be a list.' }
  }
  return { value: record as ExcelMergeSummary }
}
