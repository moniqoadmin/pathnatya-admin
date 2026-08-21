import { useEffect, useState } from 'react'
import { getTeamById, type AccountTeam } from '../api/accounts'
import { getToken } from '../lib/session'
import Modal from './Modal'

interface TeamDetailsModalProps {
  teamId: string
  teamNumber: number
  onClose: () => void
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

function formatYesNo(value: boolean | null | undefined): string {
  if (value == null) {
    return '—'
  }
  return value ? 'Yes' : 'No'
}

function formatMetadata(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return '—'
  }
  return JSON.stringify(metadata, null, 2)
}

export default function TeamDetailsModal({ teamId, teamNumber, onClose }: TeamDetailsModalProps) {
  const [team, setTeam] = useState<AccountTeam | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    setTeam(null)

    void getTeamById(teamId, token)
      .then((next) => {
        if (!cancelled) {
          setTeam(next)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error && err.message.trim()
              ? err.message.trim()
              : 'Unable to load team details.',
          )
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
  }, [teamId])

  return (
    <Modal
      title={`Team ${team?.teamNumber ?? teamNumber} details`}
      description="Latest details for this team."
      labelledBy="team-details-title"
      wide
      onClose={onClose}
    >
      {loading ? (
        <p className="teams-empty">Loading team details…</p>
      ) : error ? (
        <p className="form-error">{error}</p>
      ) : team ? (
        <TeamDetailsList team={team} />
      ) : (
        <p className="form-error">Unable to load team details.</p>
      )}
    </Modal>
  )
}

function TeamDetailsList({ team }: { team: AccountTeam }) {
  const metadata = formatMetadata(team.metadata)

  return (
    <dl className="team-details-list">
      <div className="team-details-item">
        <dt>Team number</dt>
        <dd>{team.teamNumber}</dd>
      </div>
      <div className="team-details-item">
        <dt>Set password</dt>
        <dd>{formatYesNo(team.setPassword)}</dd>
      </div>
      <div className="team-details-item">
        <dt>Login disabled</dt>
        <dd>{formatYesNo(team.isLoginDisabled)}</dd>
      </div>
      <div className="team-details-item">
        <dt>System address</dt>
        <dd>{team.systemAddress?.trim() || '—'}</dd>
      </div>
      <div className="team-details-item">
        <dt>Last login</dt>
        <dd>{formatDate(team.lastLoginTime)}</dd>
      </div>
      <div className="team-details-item">
        <dt>Created</dt>
        <dd>{formatDate(team.createdAt)}</dd>
      </div>
      <div className="team-details-item is-wide">
        <dt>Team ID</dt>
        <dd>{team.id}</dd>
      </div>
      <div className="team-details-item is-wide">
        <dt>Account ID</dt>
        <dd>{team.accountId}</dd>
      </div>
      <div className="team-details-item">
        <dt>Updated</dt>
        <dd>{formatDate(team.updatedAt)}</dd>
      </div>
      <div className="team-details-item is-wide">
        <dt>Metadata</dt>
        <dd>
          {metadata === '—' ? '—' : <pre className="team-details-json">{metadata}</pre>}
        </dd>
      </div>
    </dl>
  )
}
