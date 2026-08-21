import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import {
  bulkUpdateTeams,
  bulkUploadAccounts,
  downloadAccountBulkTemplate,
  getAccountImportErrors,
  getAccountImportJob,
  getTeamImportErrors,
  getTeamImportJob,
  type AccountImportError,
  type AccountImportErrorsPage,
  type AccountImportJob,
  type BulkUploadError,
} from '../api/accounts'
import type { ApiError } from '../api/client'
import { downloadBulkErrorsCsv } from '../lib/csv'
import { getToken } from '../lib/session'
import Modal from './Modal'

const EXCEL_ACCEPT =
  '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const MAX_FILE_BYTES = 20 * 1024 * 1024
const POLL_INTERVAL_MS = 2_500

export type BulkUploadKind = 'accounts' | 'teams'

const ACTIVE_JOB_KEYS: Record<BulkUploadKind, string> = {
  accounts: 'pathnatya.activeAccountImportJobId',
  teams: 'pathnatya.activeTeamImportJobId',
}

interface BulkUploadDialogProps {
  kind?: BulkUploadKind
  onClose: () => void
}

function toBulkError(item: AccountImportError): BulkUploadError {
  return {
    row: item.rowNumber,
    sn: item.sn,
    country: item.country,
    sanghat: item.sanghat,
    jilha: item.jilha,
    taluka: item.taluka,
    group: item.group,
    kendra: item.kendra,
    sanchalakName: item.sanchalakName,
    phoneNumber: item.phoneNumber,
    error: item.error,
  }
}

function apiErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as ApiError
  if (apiError?.status === 413) return 'The Excel file exceeds the 20 MB limit.'
  if (apiError?.status === 429) {
    return `Too many requests. Please try again in ${apiError.retryAfterSeconds ?? 60} seconds.`
  }
  if (apiError?.status === 503) {
    return 'The import service is temporarily busy. Please try again shortly.'
  }
  return error instanceof Error && error.message.trim()
    ? error.message.trim()
    : fallback
}

export default function BulkUploadDialog({
  kind = 'accounts',
  onClose,
}: BulkUploadDialogProps) {
  const isTeams = kind === 'teams'
  const activeJobKey = ACTIVE_JOB_KEYS[kind]
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState(
    () => sessionStorage.getItem(activeJobKey) ?? '',
  )
  const [job, setJob] = useState<AccountImportJob | null>(null)
  const [errorsPage, setErrorsPage] = useState<AccountImportErrorsPage | null>(null)
  const [errorPageNumber, setErrorPageNumber] = useState(1)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)

  const active = jobId !== '' && job?.status !== 'completed' && job?.status !== 'failed'
  const busy = uploading || active
  const processed = (job?.createdCount ?? 0) + (job?.failedCount ?? 0)
  const percentage = job?.totalRows
    ? Math.min(100, Math.round((processed / job.totalRows) * 100))
    : 0

  useEffect(() => {
    if (!jobId || job?.status === 'completed' || job?.status === 'failed') return
    let cancelled = false
    let timer: number | undefined

    async function poll() {
      const token = getToken()
      if (!token) {
        setError('Your session expired. Please log in again.')
        return
      }
      try {
        const next = isTeams
          ? await getTeamImportJob(jobId, token)
          : await getAccountImportJob(jobId, token)
        if (cancelled) return
        setJob(next)
        setError('')
        if (next.status === 'completed' || next.status === 'failed') {
          sessionStorage.removeItem(activeJobKey)
          if (next.failedCount > 0) {
            const page = isTeams
              ? await getTeamImportErrors(jobId, 1, 100, token)
              : await getAccountImportErrors(jobId, 1, 100, token)
            if (!cancelled) {
              setErrorsPage(page)
              setErrorPageNumber(1)
            }
          }
          return
        }
        timer = window.setTimeout(poll, POLL_INTERVAL_MS)
      } catch (pollError) {
        if (!cancelled) {
          setError(apiErrorMessage(pollError, 'Unable to check the import status.'))
          timer = window.setTimeout(poll, POLL_INTERVAL_MS * 2)
        }
      }
    }

    void poll()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [activeJobKey, isTeams, jobId, job?.status])

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null
    event.target.value = ''
    setError('')
    setJob(null)
    setErrorsPage(null)
    setJobId('')

    if (!next) {
      setFile(null)
      return
    }
    if (!next.name.toLowerCase().endsWith('.xlsx')) {
      setFile(null)
      setError('Please select an Excel .xlsx file.')
      return
    }
    if (next.size === 0 || next.size > MAX_FILE_BYTES) {
      setFile(null)
      setError('Please select a non-empty Excel file smaller than 20 MB.')
      return
    }
    setFile(next)
  }

  async function downloadTemplate() {
    setError('')
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }

    setDownloadingTemplate(true)
    try {
      await downloadAccountBulkTemplate(token)
    } catch (downloadError) {
      setError(apiErrorMessage(downloadError, 'Unable to download the template.'))
    } finally {
      setDownloadingTemplate(false)
    }
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

    setUploading(true)
    try {
      const accepted = isTeams
        ? await bulkUpdateTeams(file, token)
        : await bulkUploadAccounts(file, token)
      setJobId(accepted.jobId)
      sessionStorage.setItem(activeJobKey, accepted.jobId)
      setJob(null)
    } catch (uploadError) {
      setError(apiErrorMessage(uploadError, 'Unable to upload the Excel file.'))
    } finally {
      setUploading(false)
    }
  }

  async function changeErrorPage(page: number) {
    if (!jobId) return
    const token = getToken()
    if (!token) return
    try {
      const next = isTeams
        ? await getTeamImportErrors(jobId, page, 100, token)
        : await getAccountImportErrors(jobId, page, 100, token)
      setErrorsPage(next)
      setErrorPageNumber(page)
    } catch (pageError) {
      setError(apiErrorMessage(pageError, 'Unable to load failed rows.'))
    }
  }

  async function downloadAllErrors() {
    if (!jobId || !job?.failedCount) return
    const token = getToken()
    if (!token) return
    setDownloading(true)
    try {
      const collected: BulkUploadError[] = []
      let page = 1
      let totalPages = 1
      do {
        const result = isTeams
          ? await getTeamImportErrors(jobId, page, 100, token)
          : await getAccountImportErrors(jobId, page, 100, token)
        collected.push(...result.data.map(toBulkError))
        totalPages = result.totalPages
        page += 1
      } while (page <= totalPages)
      downloadBulkErrorsCsv(
        collected,
        isTeams ? 'update-teams-errors' : 'bulk-upload-errors',
      )
    } catch (downloadError) {
      setError(apiErrorMessage(downloadError, 'Unable to download failed rows.'))
    } finally {
      setDownloading(false)
    }
  }

  function reset() {
    sessionStorage.removeItem(activeJobKey)
    setFile(null)
    setJobId('')
    setJob(null)
    setErrorsPage(null)
    setError('')
  }

  const hasResult = job?.status === 'completed' || job?.status === 'failed'
  const title = hasResult
    ? job.status === 'completed'
      ? isTeams
        ? 'Team update complete'
        : 'Bulk upload complete'
      : isTeams
        ? 'Team update failed'
        : 'Bulk upload failed'
    : jobId
      ? isTeams
        ? 'Updating teams'
        : 'Importing accounts'
      : isTeams
        ? 'Update teams'
        : 'Bulk upload accounts'

  return (
    <Modal
      title={title}
      description={
        jobId
          ? 'The job continues in the background. You may close this window and return later.'
          : isTeams
            ? 'Select a nivedan Excel .xlsx file with Updated No. of Teams Expected filled in.'
            : 'Select an Excel .xlsx file in the nivedan or accounts template format.'
      }
      labelledBy="bulk-upload-title"
      busy={busy}
      wide={Boolean(jobId)}
      dismissible
      onClose={onClose}
      footer={
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {hasResult && (
            <button type="button" className="btn btn-secondary" onClick={reset}>
              {isTeams ? 'Update another file' : 'Upload another file'}
            </button>
          )}
          {job?.status === 'completed' && job.failedCount > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void downloadAllErrors()}
              disabled={downloading}
            >
              {downloading ? 'Preparing CSV…' : 'Download errors CSV'}
            </button>
          )}
          {!jobId && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleUpload()}
              disabled={uploading || !file}
            >
              {uploading ? 'Uploading…' : isTeams ? 'Update teams' : 'Upload'}
            </button>
          )}
        </div>
      }
    >
      {!jobId ? (
        <div className="stack-form">
          <input
            ref={fileInputRef}
            type="file"
            accept={EXCEL_ACCEPT}
            hidden
            onChange={handleFileChange}
          />
          <div className="file-picker">
            {!isTeams && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void downloadTemplate()}
                disabled={uploading || downloadingTemplate}
              >
                {downloadingTemplate ? 'Downloading…' : 'Download template'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              Choose Excel file
            </button>
            <p className="file-picker-name">{file ? file.name : 'No file selected'}</p>
          </div>
          <p className="bulk-file-help">Maximum file size: 20 MB</p>
          {error && <p className="form-error">{error}</p>}
        </div>
      ) : (
        <div className="bulk-error-panel">
          <div className="bulk-import-status-row">
            <span className={`status-pill status-${job?.status ?? 'queued'}`}>
              {job?.status ?? 'queued'}
            </span>
            <span>{job?.fileName ?? file?.name ?? 'Excel import'}</span>
          </div>

          {!hasResult && (
            <div className="bulk-progress-block">
              <div className="bulk-progress-track" aria-label="Import progress">
                <span
                  className={job?.totalRows ? '' : 'is-indeterminate'}
                  style={job?.totalRows ? { width: `${percentage}%` } : undefined}
                />
              </div>
              <p>
                {job?.totalRows
                  ? `Processed ${processed.toLocaleString()} of ${job.totalRows.toLocaleString()} rows (${percentage}%)`
                  : job?.status === 'processing'
                    ? isTeams
                      ? 'Updating team counts…'
                      : 'Reading and validating the Excel file…'
                    : 'Waiting for a worker to pick up the job…'}
              </p>
            </div>
          )}

          {job && (
            <div className="bulk-summary-grid">
              <div className="bulk-summary-item">
                <span className="bulk-summary-label">Total rows</span>
                <span className="bulk-summary-value">{job.totalRows.toLocaleString()}</span>
              </div>
              <div className="bulk-summary-item">
                <span className="bulk-summary-label">{isTeams ? 'Updated' : 'Created'}</span>
                <span className="bulk-summary-value">{job.createdCount.toLocaleString()}</span>
              </div>
              <div className="bulk-summary-item is-danger">
                <span className="bulk-summary-label">Failed</span>
                <span className="bulk-summary-value">{job.failedCount.toLocaleString()}</span>
              </div>
            </div>
          )}

          {job?.status === 'completed' && (
            <p className={job.failedCount > 0 ? 'form-error' : 'form-success'}>
              {job.failedCount > 0
                ? `${job.failedCount.toLocaleString()} rows failed. Review them below or download the CSV.`
                : isTeams
                  ? `Successfully updated ${job.createdCount.toLocaleString()} accounts.`
                  : `Successfully created ${job.createdCount.toLocaleString()} accounts.`}
            </p>
          )}
          {job?.status === 'failed' && (
            <p className="form-error">
              {job.failureMessage ?? 'The import could not be completed.'}
            </p>
          )}
          {error && <p className="form-error">{error}</p>}

          {errorsPage && errorsPage.data.length > 0 && (
            <>
              {errorsPage.totalPages > 1 && (
                <div className="bulk-error-pagination">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={errorPageNumber <= 1}
                    onClick={() => void changeErrorPage(errorPageNumber - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {errorPageNumber} of {errorsPage.totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={errorPageNumber >= errorsPage.totalPages}
                    onClick={() => void changeErrorPage(errorPageNumber + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
              <div className="bulk-error-table-wrap">
                <table className="bulk-error-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Mobile</th>
                      <th>Kendra</th>
                      <th>Sanghat</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorsPage.data.map((item) => (
                      <tr key={item.id}>
                        <td>{item.rowNumber}</td>
                        <td>{item.phoneNumber ?? '—'}</td>
                        <td>{item.kendra ?? '—'}</td>
                        <td>{item.sanghat ?? '—'}</td>
                        <td>{item.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
