import { type FormEvent, useEffect, useState } from 'react'
import {
  createAppConfiguration,
  listAppConfigurations,
  updateAppConfiguration,
  type AppConfiguration,
  type SaveAppConfigurationPayload,
  type VideoConfig,
} from '../api/app-configurations'
import { getToken } from '../lib/session'
import Modal from './Modal'
import PasswordInput from './PasswordInput'

const OPEN_PASSWORD = '1942'
const SAVE_PASSWORD = '1956'

interface AppConfigurationDialogProps {
  onClose: () => void
}

interface ConfigDraft {
  localKey: string
  originalId: number | null
  id: string
  videoConfig: string
  videoFiles: string
}

const EMPTY_VIDEO_CONFIG = `{
  "DEFAULT_HLS_SOURCE": "",
  "ALLOWED_HOSTS": []
}`

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function draftFromConfig(item: AppConfiguration): ConfigDraft {
  return {
    localKey: `saved-${item.id}`,
    originalId: item.id,
    id: String(item.id),
    videoConfig: prettyJson(item.videoConfig),
    videoFiles: prettyJson(item.videoFiles),
  }
}

function emptyDraft(nextId: number, localKey: string): ConfigDraft {
  return {
    localKey,
    originalId: null,
    id: String(nextId),
    videoConfig: EMPTY_VIDEO_CONFIG,
    videoFiles: '[]',
  }
}

function parseJsonObject(value: string, label: string): VideoConfig {
  const trimmed = value.trim() || '{}'
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error(`${label} must be valid JSON.`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return parsed as VideoConfig
}

function parseJsonArray(value: string, label: string): unknown[] {
  const trimmed = value.trim() || '[]'
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new Error(`${label} must be valid JSON.`)
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON array.`)
  }
  return parsed
}

function buildPayload(draft: ConfigDraft): SaveAppConfigurationPayload & { id: number } {
  const id = Number(draft.id)
  if (!Number.isInteger(id) || id < 1) {
    throw new Error('Configuration ID must be a whole number of 1 or higher.')
  }

  return {
    id,
    videoConfig: parseJsonObject(draft.videoConfig, 'Video config'),
    videoFiles: parseJsonArray(draft.videoFiles, 'Video files'),
  }
}

function apiErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : fallback
}

function nextConfigurationId(drafts: ConfigDraft[]): number {
  const ids = drafts
    .map((draft) => Number(draft.id))
    .filter((id) => Number.isInteger(id) && id >= 1)
  return (ids.length > 0 ? Math.max(...ids) : 0) + 1
}

export default function AppConfigurationDialog({ onClose }: AppConfigurationDialogProps) {
  const [unlocked, setUnlocked] = useState(false)
  const [openPassword, setOpenPassword] = useState('')
  const [openPasswordError, setOpenPasswordError] = useState('')
  const [pendingDraft, setPendingDraft] = useState<ConfigDraft | null>(null)
  const [savePassword, setSavePassword] = useState('')
  const [savePasswordError, setSavePasswordError] = useState('')
  const [drafts, setDrafts] = useState<ConfigDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [savingKey, setSavingKey] = useState('')
  const [cardError, setCardError] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!unlocked) {
      return
    }

    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    setStatus('')
    setCardError({})

    void listAppConfigurations(token)
      .then((items) => {
        if (!cancelled) {
          setDrafts(items.map(draftFromConfig))
        }
      })
      .catch((loadError) => {
        if (cancelled) {
          return
        }
        setDrafts([])
        setError(apiErrorMessage(loadError, 'Unable to load app configurations. Please try again.'))
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [reloadKey, unlocked])

  function updateDraft(localKey: string, patch: Partial<ConfigDraft>) {
    setDrafts((current) =>
      current.map((draft) => (draft.localKey === localKey ? { ...draft, ...patch } : draft)),
    )
    setCardError((current) => {
      if (!current[localKey]) {
        return current
      }
      const next = { ...current }
      delete next[localKey]
      return next
    })
    setStatus('')
  }

  function addDraft() {
    const localKey = `new-${Date.now()}`
    setDrafts((current) => [...current, emptyDraft(nextConfigurationId(current), localKey)])
    setStatus('')
    setError('')
  }

  function removeDraft(localKey: string) {
    setDrafts((current) => current.filter((draft) => draft.localKey !== localKey))
    setCardError((current) => {
      if (!current[localKey]) {
        return current
      }
      const next = { ...current }
      delete next[localKey]
      return next
    })
  }

  function unlock(event: FormEvent) {
    event.preventDefault()
    if (openPassword.trim() !== OPEN_PASSWORD) {
      setOpenPasswordError('Incorrect password.')
      return
    }
    setOpenPassword('')
    setOpenPasswordError('')
    setUnlocked(true)
  }

  function requestSave(draft: ConfigDraft) {
    try {
      buildPayload(draft)
    } catch (parseError) {
      setCardError((current) => ({
        ...current,
        [draft.localKey]: apiErrorMessage(parseError, 'Unable to save this configuration.'),
      }))
      return
    }

    setPendingDraft(draft)
    setSavePassword('')
    setSavePasswordError('')
  }

  function cancelSave() {
    if (savingKey) {
      return
    }
    setPendingDraft(null)
    setSavePassword('')
    setSavePasswordError('')
  }

  function confirmSave(event: FormEvent) {
    event.preventDefault()
    if (!pendingDraft) {
      return
    }
    if (savePassword.trim() !== SAVE_PASSWORD) {
      setSavePasswordError('Incorrect password.')
      return
    }

    const draft = pendingDraft
    setPendingDraft(null)
    setSavePassword('')
    setSavePasswordError('')
    void saveDraft(draft)
  }

  async function saveDraft(draft: ConfigDraft) {
    const token = getToken()
    if (!token) {
      setError('Your session expired. Please log in again.')
      return
    }

    let payload: SaveAppConfigurationPayload & { id: number }
    try {
      payload = buildPayload(draft)
    } catch (parseError) {
      setCardError((current) => ({
        ...current,
        [draft.localKey]: apiErrorMessage(parseError, 'Unable to save this configuration.'),
      }))
      return
    }

    setSavingKey(draft.localKey)
    setError('')
    setStatus('')

    try {
      const saved =
        draft.originalId == null
          ? await createAppConfiguration(payload, token)
          : await updateAppConfiguration(draft.originalId, payload, token)

      setDrafts((current) =>
        current.map((item) => (item.localKey === draft.localKey ? draftFromConfig(saved) : item)),
      )
      setStatus(
        draft.originalId != null && draft.originalId !== saved.id
          ? `Configuration ${draft.originalId} is now ID ${saved.id}. Accounts on the old ID were remapped.`
          : `Saved configuration ${saved.id}.`,
      )
    } catch (saveError) {
      setCardError((current) => ({
        ...current,
        [draft.localKey]: apiErrorMessage(saveError, 'Unable to save this configuration.'),
      }))
    } finally {
      setSavingKey('')
    }
  }

  const busy = Boolean(savingKey) || loading

  if (!unlocked) {
    return (
      <Modal
        title="App configuration"
        description="Enter the password to view and edit app configurations."
        labelledBy="app-configuration-lock-title"
        onClose={onClose}
      >
        <form className="stack-form" onSubmit={unlock}>
          <div className="form-field">
            <label htmlFor="app-config-open-password">Password</label>
            <PasswordInput
              id="app-config-open-password"
              autoComplete="off"
              autoFocus
              value={openPassword}
              onChange={(event) => {
                setOpenPassword(event.target.value)
                setOpenPasswordError('')
              }}
            />
          </div>
          {openPasswordError && <p className="form-error">{openPasswordError}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Continue
            </button>
          </div>
        </form>
      </Modal>
    )
  }

  return (
    <>
      <Modal
        title="App configuration"
        description="Edit each configuration as JSON. Changing an ID remaps accounts that currently use it."
        labelledBy="app-configuration-title"
        busy={Boolean(savingKey) || Boolean(pendingDraft)}
        wide
        onClose={() => {
          if (!savingKey && !pendingDraft) {
            onClose()
          }
        }}
      >
        <div className="app-config-toolbar">
          <p className="users-total" aria-live="polite">
            <span className="users-total-value">{drafts.length.toLocaleString()}</span>
            <span className="users-total-label">
              {drafts.length === 1 ? 'config' : 'configs'}
            </span>
          </p>
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || Boolean(pendingDraft)}
              onClick={() => setReloadKey((current) => current + 1)}
            >
              {loading ? 'Loading...' : 'Reload'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || Boolean(pendingDraft)}
              onClick={addDraft}
            >
              Add configuration
            </button>
          </div>
        </div>

        {error && <p className="form-error">{error}</p>}
        {status && <p className="form-success">{status}</p>}

        {loading ? (
          <p className="teams-empty">Loading app configurations...</p>
        ) : drafts.length === 0 && !error ? (
          <p className="teams-empty">No app configurations yet. Add one to get started.</p>
        ) : (
          <div className="app-config-list">
            {drafts.map((draft) => {
              const saving = savingKey === draft.localKey
              const idChanged =
                draft.originalId != null && Number(draft.id) !== draft.originalId
              const draftError = cardError[draft.localKey]

              return (
                <article key={draft.localKey} className="app-config-card">
                  <div className="app-config-card-header">
                    <h3>
                      {draft.originalId == null
                        ? 'New configuration'
                        : `Configuration ${draft.originalId}`}
                    </h3>
                    {draft.originalId == null && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-compact"
                        disabled={busy || Boolean(pendingDraft)}
                        onClick={() => removeDraft(draft.localKey)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="stack-form">
                    <div className="form-field">
                      <label htmlFor={`${draft.localKey}-id`}>ID</label>
                      <input
                        id={`${draft.localKey}-id`}
                        type="number"
                        min={1}
                        step={1}
                        value={draft.id}
                        onChange={(event) => updateDraft(draft.localKey, { id: event.target.value })}
                        disabled={busy || Boolean(pendingDraft)}
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor={`${draft.localKey}-video-config`}>Video config</label>
                      <textarea
                        id={`${draft.localKey}-video-config`}
                        className="app-config-json"
                        rows={10}
                        value={draft.videoConfig}
                        onChange={(event) =>
                          updateDraft(draft.localKey, { videoConfig: event.target.value })
                        }
                        disabled={busy || Boolean(pendingDraft)}
                        spellCheck={false}
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor={`${draft.localKey}-video-files`}>Video files</label>
                      <textarea
                        id={`${draft.localKey}-video-files`}
                        className="app-config-json"
                        rows={6}
                        value={draft.videoFiles}
                        onChange={(event) =>
                          updateDraft(draft.localKey, { videoFiles: event.target.value })
                        }
                        disabled={busy || Boolean(pendingDraft)}
                        spellCheck={false}
                      />
                    </div>
                  </div>

                  {idChanged && (
                    <p className="field-hint app-config-remap-hint">
                      Saving remaps accounts from configuration {draft.originalId} to ID {draft.id}.
                    </p>
                  )}
                  {draftError && <p className="form-error">{draftError}</p>}

                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy || Boolean(pendingDraft)}
                      onClick={() => requestSave(draft)}
                    >
                      {saving
                        ? 'Saving...'
                        : draft.originalId == null
                          ? 'Create'
                          : idChanged
                            ? 'Save and remap ID'
                            : 'Save'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </Modal>

      {pendingDraft && (
        <Modal
          title="Confirm save"
          description="Enter the save password to apply this configuration change."
          labelledBy="app-configuration-save-lock-title"
          stacked
          onClose={cancelSave}
        >
          <form className="stack-form" onSubmit={confirmSave}>
            <div className="form-field">
              <label htmlFor="app-config-save-password">Password</label>
              <PasswordInput
                id="app-config-save-password"
                autoComplete="off"
                autoFocus
                value={savePassword}
                onChange={(event) => {
                  setSavePassword(event.target.value)
                  setSavePasswordError('')
                }}
              />
            </div>
            {savePasswordError && <p className="form-error">{savePasswordError}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={cancelSave}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
