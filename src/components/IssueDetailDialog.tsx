import { type FormEvent, useEffect, useState } from 'react'
import {
  addIssueComment,
  getIssue,
  ISSUE_STATUS_META,
  resolveIssue,
  RESOLVE_STATUS_OPTIONS,
  updateIssueStatus,
  type Issue,
  type ResolveIssueStatus,
} from '../api/issues'
import { getErrorCode } from '../lib/error-codes'
import { getToken } from '../lib/session'
import Modal from './Modal'

interface IssueDetailDialogProps {
  issueId: string
  onClose: () => void
  onResolved: (issue: Issue, message: string) => void
  onUpdated: (issue: Issue) => void
}

function formatValue(value: string | number | null | undefined): string {
  if (value == null || String(value).trim() === '') {
    return '—'
  }
  return String(value)
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '—'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

function statusLabel(status: string | null | undefined): string {
  if (!status) {
    return 'Unknown'
  }
  return ISSUE_STATUS_META[status as keyof typeof ISSUE_STATUS_META]?.label ?? status.replaceAll('_', ' ')
}

function statusDescription(status: string | null | undefined): string {
  if (!status) {
    return ''
  }
  return ISSUE_STATUS_META[status as keyof typeof ISSUE_STATUS_META]?.description ?? ''
}

function isTerminalStatus(status: string | null | undefined): boolean {
  return status === 'resolved' || status === 'closed'
}

export default function IssueDetailDialog({
  issueId,
  onClose,
  onResolved,
  onUpdated,
}: IssueDetailDialogProps) {
  const [issue, setIssue] = useState<Issue | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState('')
  const [commentLoading, setCommentLoading] = useState(false)
  const [resolution, setResolution] = useState('')
  const [resolutionMessage, setResolutionMessage] = useState('')
  const [resolveStatus, setResolveStatus] = useState<ResolveIssueStatus>('resolved')
  const [resolveError, setResolveError] = useState('')
  const [resolveLoading, setResolveLoading] = useState(false)
  const [progressError, setProgressError] = useState('')
  const [progressLoading, setProgressLoading] = useState(false)

  const busy = loading || commentLoading || resolveLoading || progressLoading

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoadError('Your session expired. Please log in again.')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError('')

    void getIssue(issueId, token)
      .then((nextIssue) => {
        if (cancelled) {
          return
        }
        setIssue(nextIssue)
        setResolution(nextIssue.resolution ?? '')
        setResolutionMessage(nextIssue.resolutionMessage ?? '')
        setResolveStatus(nextIssue.status === 'closed' ? 'closed' : 'resolved')
      })
      .catch((err) => {
        if (cancelled) {
          return
        }
        setIssue(null)
        setLoadError(
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : 'Unable to load this issue. Please try again.',
        )
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [issueId])

  async function handleAddComment(event: FormEvent) {
    event.preventDefault()
    setCommentError('')

    const trimmed = comment.trim()
    if (!trimmed) {
      setCommentError('Please add a comment.')
      return
    }

    const token = getToken()
    if (!token) {
      setCommentError('Your session expired. Please log in again.')
      return
    }

    setCommentLoading(true)
    try {
      const updated = await addIssueComment(issueId, trimmed, token)
      setIssue(updated)
      setComment('')
      onUpdated(updated)
    } catch (err) {
      setCommentError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Unable to add the comment. Please try again.',
      )
    } finally {
      setCommentLoading(false)
    }
  }

  async function handleMarkInProgress() {
    setProgressError('')

    const token = getToken()
    if (!token) {
      setProgressError('Your session expired. Please log in again.')
      return
    }

    setProgressLoading(true)
    try {
      const updated = await updateIssueStatus(issueId, 'in_progress', token)
      setIssue(updated)
      onUpdated(updated)
    } catch (err) {
      setProgressError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Unable to mark this issue in progress. Please try again.',
      )
    } finally {
      setProgressLoading(false)
    }
  }

  async function handleResolve(event: FormEvent) {
    event.preventDefault()
    setResolveError('')

    const trimmedResolution = resolution.trim()
    const trimmedMessage = resolutionMessage.trim()
    if (!trimmedResolution) {
      setResolveError('Please add a short resolution summary.')
      return
    }
    if (!trimmedMessage) {
      setResolveError('Please add a resolution message.')
      return
    }

    const token = getToken()
    if (!token) {
      setResolveError('Your session expired. Please log in again.')
      return
    }

    setResolveLoading(true)
    try {
      const updated = await resolveIssue(
        issueId,
        {
          resolution: trimmedResolution,
          resolutionMessage: trimmedMessage,
          status: resolveStatus,
        },
        token,
      )
      onResolved(
        updated,
        resolveStatus === 'closed' ? 'Issue closed.' : 'Issue marked as resolved.',
      )
    } catch (err) {
      setResolveError(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Unable to resolve this issue. Please try again.',
      )
    } finally {
      setResolveLoading(false)
    }
  }

  const issueNumbers = issue?.issueNumbers ?? []
  const comments = issue?.comments ?? []
  const canResolve = issue ? !isTerminalStatus(issue.status) : false
  const canMarkInProgress = issue?.status === 'open'

  return (
    <Modal
      title="Issue details"
      description={
        issue
          ? `${statusLabel(issue.status)} · ${statusDescription(issue.status)}`
          : 'Review the reported issue, add a comment, or mark it done.'
      }
      labelledBy="issue-detail-title"
      busy={busy}
      wide
      onClose={onClose}
    >
      {loading ? (
        <p className="users-table-empty">Loading issue...</p>
      ) : loadError ? (
        <p className="form-error">{loadError}</p>
      ) : issue ? (
        <div className="issue-detail">
          <dl className="issue-detail-grid">
            <div>
              <dt>Phone</dt>
              <dd>{formatValue(issue.phoneNumber)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`status-pill status-${issue.status || 'unknown'}`}>
                  {statusLabel(issue.status)}
                </span>
              </dd>
            </div>
            <div>
              <dt>Reported</dt>
              <dd>{formatDate(issue.createdAt)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDate(issue.updatedAt)}</dd>
            </div>
            <div className="span-2">
              <dt>Issue numbers</dt>
              <dd>
                {issueNumbers.length === 0 ? (
                  '—'
                ) : (
                  <ul className="issue-code-list">
                    {issueNumbers.map((code) => {
                      const errorCode = getErrorCode(code)
                      return (
                        <li key={code}>
                          <span className="issue-code-number">{code}</span>
                          {errorCode ? (
                            <span className="issue-code-meta">
                              {errorCode.area} · {errorCode.message}
                            </span>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </dd>
            </div>
            <div className="span-2">
              <dt>Message</dt>
              <dd className="issue-detail-message">{formatValue(issue.message)}</dd>
            </div>
            {issue.resolution ? (
              <div className="span-2">
                <dt>Resolution</dt>
                <dd>{issue.resolution}</dd>
              </div>
            ) : null}
            {issue.resolutionMessage ? (
              <div className="span-2">
                <dt>Resolution message</dt>
                <dd className="issue-detail-message">{issue.resolutionMessage}</dd>
              </div>
            ) : null}
            {issue.resolvedAt ? (
              <div>
                <dt>Resolved</dt>
                <dd>{formatDate(issue.resolvedAt)}</dd>
              </div>
            ) : null}
            {issue.resolvedBy ? (
              <div>
                <dt>Resolved by</dt>
                <dd>{issue.resolvedBy}</dd>
              </div>
            ) : null}
          </dl>

          <section className="issue-section">
            <h3>Comments</h3>
            {comments.length === 0 ? (
              <p className="field-hint">No comments yet.</p>
            ) : (
              <ul className="issue-comment-list">
                {comments.map((item, index) => (
                  <li key={`${item.accountId}-${item.createdAt}-${index}`} className="issue-comment">
                    <div className="issue-comment-meta">
                      <span>{formatValue(item.phoneNumber)}</span>
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                    <p>{item.message}</p>
                  </li>
                ))}
              </ul>
            )}

            {!isTerminalStatus(issue.status) && (
              <form className="stack-form issue-comment-form" onSubmit={handleAddComment}>
                <div className="form-field">
                  <label htmlFor="issue-comment">Add a comment</label>
                  <textarea
                    id="issue-comment"
                    rows={3}
                    placeholder="Note what you tried or asked the user to do..."
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    disabled={busy}
                  />
                </div>
                {commentError && <p className="form-error">{commentError}</p>}
                <div className="modal-actions">
                  <button type="submit" className="btn btn-secondary" disabled={busy}>
                    {commentLoading ? 'Adding...' : 'Add comment'}
                  </button>
                </div>
              </form>
            )}
          </section>

          {canResolve && (
            <section className="issue-section">
              <h3>Update status</h3>
              {canMarkInProgress && (
                <div className="stack-form">
                  <p className="field-hint">Mark this issue as in progress while you work on it.</p>
                  {progressError && <p className="form-error">{progressError}</p>}
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => void handleMarkInProgress()}
                      disabled={busy}
                    >
                      {progressLoading ? 'Updating...' : 'Mark in progress'}
                    </button>
                  </div>
                </div>
              )}
              <h3>Resolve issue</h3>
              <p className="field-hint">
                SuperAdmin and Developer can mark this as fixed, or close it without treating it as
                a fix.
              </p>
              <form className="stack-form" onSubmit={handleResolve}>
                <div className="form-field">
                  <label htmlFor="issue-resolve-status">Final status</label>
                  <select
                    id="issue-resolve-status"
                    value={resolveStatus}
                    onChange={(event) => setResolveStatus(event.target.value as ResolveIssueStatus)}
                    disabled={busy}
                  >
                    {RESOLVE_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {ISSUE_STATUS_META[status].label} — {ISSUE_STATUS_META[status].description}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="issue-resolution">Resolution</label>
                  <input
                    id="issue-resolution"
                    type="text"
                    placeholder="Short summary, e.g. Playback restored after cache clear."
                    value={resolution}
                    onChange={(event) => setResolution(event.target.value)}
                    disabled={busy}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="issue-resolution-message">Resolution message</label>
                  <textarea
                    id="issue-resolution-message"
                    rows={4}
                    placeholder="What was done with the user, and how you confirmed it."
                    value={resolutionMessage}
                    onChange={(event) => setResolutionMessage(event.target.value)}
                    disabled={busy}
                  />
                </div>
                {resolveError && <p className="form-error">{resolveError}</p>}
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    {resolveLoading
                      ? 'Saving...'
                      : resolveStatus === 'closed'
                        ? 'Close issue'
                        : 'Mark resolved'}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      ) : null}
    </Modal>
  )
}
