import { type ChangeEvent, useRef, useState } from 'react'
import {
  bulkUploadAccounts,
  type BulkUploadError,
  type BulkUploadResult,
} from '../api/accounts'
import { downloadBulkErrorsCsv } from '../lib/csv'
import { getToken } from '../lib/session'
import Modal from './Modal'

const EXCEL_ACCEPT =
  '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'

interface BulkUploadDialogProps {
  onClose: () => void
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null
  }
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value))
    } catch {
      return null
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function readNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return null
}

function readErrors(value: unknown): BulkUploadError[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((item, index) => {
    const row = asRecord(item) ?? {}
    return {
      row: readNumber(row.row, row.rowNumber, row.row_number) ?? index + 1,
      sn: (row.sn as string | null | undefined) ?? null,
      country: (row.country as string | null | undefined) ?? null,
      sanghat: (row.sanghat as string | null | undefined) ?? null,
      jilha: (row.jilha as string | null | undefined) ?? null,
      taluka: (row.taluka as string | null | undefined) ?? null,
      group: (row.group as string | null | undefined) ?? null,
      kendra: (row.kendra as string | null | undefined) ?? null,
      sanchalakName:
        (row.sanchalakName as string | null | undefined) ??
        (row.sanchalak_name as string | null | undefined) ??
        null,
      phoneNumber:
        (row.phoneNumber as string | null | undefined) ??
        (row.phone_number as string | null | undefined) ??
        null,
      error: String(row.error ?? row.message ?? 'Unknown error'),
    }
  })
}

function unwrapUploadPayload(value: unknown): Record<string, unknown> | null {
  const root = asRecord(value)
  if (!root) {
    return null
  }

  let current: Record<string, unknown> = root

  for (let depth = 0; depth < 4; depth += 1) {
    if (
      'totalRows' in current ||
      'total_rows' in current ||
      'created' in current ||
      'failed' in current ||
      'errors' in current
    ) {
      return current
    }

    const nestedCandidate: Record<string, unknown> | null =
      asRecord(current.data) ??
      asRecord(current.result) ??
      asRecord(current.body) ??
      asRecord(current.payload)

    if (!nestedCandidate) {
      return current
    }
    current = nestedCandidate
  }

  return current
}

function asBulkUploadResult(value: unknown): BulkUploadResult | null {
  const nested = unwrapUploadPayload(value)
  if (!nested) {
    return null
  }

  const errors = readErrors(nested.errors)
  const created = readNumber(nested.created) ?? 0
  const failed = readNumber(nested.failed) ?? errors.length
  const totalRows = readNumber(nested.totalRows, nested.total_rows) ?? created + failed

  if (totalRows === 0 && created === 0 && failed === 0 && errors.length === 0) {
    return null
  }

  return {
    totalRows,
    created,
    failed: Math.max(failed, errors.length),
    errors,
  }
}

function thrownData(err: unknown): unknown {
  if (err && typeof err === 'object' && 'data' in err) {
    return (err as { data: unknown }).data
  }
  return null
}

function errorKey(item: BulkUploadError, index: number): string {
  return `${item.row}-${item.phoneNumber ?? 'unknown'}-${index}`
}

export default function BulkUploadDialog({ onClose }: BulkUploadDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BulkUploadResult | null>(null)
  const [loading, setLoading] = useState(false)

  const errors = result?.errors ?? []
  const failedCount = result ? Math.max(result.failed, errors.length) : 0
  const hasErrors = failedCount > 0
  const hasResult = result !== null

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null
    event.target.value = ''
    setFile(next)
    setError('')
    setResult(null)
  }

  async function handleUpload() {
    setError('')

    if (!file) {
      setError('Please select an Excel file to upload.')
      return
    }

    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }

    setLoading(true)
    try {
      const uploadResult = await bulkUploadAccounts(file, token)
      const parsed = asBulkUploadResult(uploadResult)
      if (!parsed) {
        setError(
          'Upload finished, but the server did not return a usable summary. Please try again.',
        )
        return
      }
      setResult(parsed)
    } catch (err) {
      const fromThrow = asBulkUploadResult(thrownData(err))
      if (fromThrow) {
        setResult(fromThrow)
        return
      }

      setError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Unable to upload the Excel file. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={hasErrors ? 'Bulk upload errors' : hasResult ? 'Bulk upload complete' : 'Bulk upload accounts'}
      description={
        hasErrors
          ? 'Some rows could not be created. Review the summary below or download the errors as a CSV.'
          : hasResult
            ? 'Accounts were created from the Excel file.'
            : 'Select an Excel file (.xlsx) in the nivedan or accounts template format. Duplicate or invalid mobile numbers are skipped and listed after upload.'
      }
      labelledBy="bulk-upload-title"
      busy={loading}
      wide={hasResult}
      dismissible={!hasResult}
      onClose={onClose}
      footer={
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            {hasResult ? 'Close' : 'Cancel'}
          </button>
          {hasErrors ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => downloadBulkErrorsCsv(errors)}
            >
              Download errors CSV
            </button>
          ) : !hasResult ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleUpload()}
              disabled={loading}
            >
              {loading ? 'Uploading...' : 'Upload'}
            </button>
          ) : null}
        </div>
      }
    >
      {hasResult && result ? (
        <div className="bulk-error-panel">
          <div className="bulk-summary-grid">
            <div className="bulk-summary-item">
              <span className="bulk-summary-label">Total rows</span>
              <span className="bulk-summary-value">{result.totalRows}</span>
            </div>
            <div className="bulk-summary-item">
              <span className="bulk-summary-label">Created</span>
              <span className="bulk-summary-value">{result.created}</span>
            </div>
            <div className="bulk-summary-item is-danger">
              <span className="bulk-summary-label">Failed</span>
              <span className="bulk-summary-value">{failedCount}</span>
            </div>
          </div>

          <p className={hasErrors ? 'form-error' : 'form-success'}>
            {hasErrors
              ? `${failedCount} of ${result.totalRows} rows failed. Download the CSV to review and fix them.`
              : `Successfully created ${result.created} account${result.created === 1 ? '' : 's'}.`}
          </p>

          {hasErrors && (
            <div className="bulk-error-table-wrap">
              <table className="bulk-error-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>SN</th>
                    <th>Mobile</th>
                    <th>Name</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((item, index) => (
                    <tr key={errorKey(item, index)}>
                      <td>{item.row}</td>
                      <td>{item.sn ?? '—'}</td>
                      <td>{item.phoneNumber ?? '—'}</td>
                      <td>{item.sanchalakName ?? '—'}</td>
                      <td>{item.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="stack-form">
          <input
            ref={fileInputRef}
            type="file"
            accept={EXCEL_ACCEPT}
            hidden
            onChange={handleFileChange}
          />

          <div className="file-picker">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              Choose Excel file
            </button>
            <p className="file-picker-name">{file ? file.name : 'No file selected'}</p>
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>
      )}
    </Modal>
  )
}
