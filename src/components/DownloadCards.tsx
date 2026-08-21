import { useEffect, useMemo, useState } from 'react'
import { MAC_DOWNLOAD_LINK, WINDOWS_DOWNLOAD_LINK } from '../api/config'

type Platform = 'windows' | 'mac'

const DOWNLOAD_COOLDOWN_MS = 3 * 60 * 1000
const DOWNLOAD_COOLDOWN_STORAGE_KEY = 'pathnatya-download-cooldown-until'

function readCooldownUntil(): number {
  try {
    const until = Number(localStorage.getItem(DOWNLOAD_COOLDOWN_STORAGE_KEY))
    return Number.isFinite(until) ? until : 0
  } catch {
    return 0
  }
}

function writeCooldownUntil(until: number): void {
  try {
    localStorage.setItem(DOWNLOAD_COOLDOWN_STORAGE_KEY, String(until))
  } catch {
    // Ignore storage failures; in-memory cooldown still applies.
  }
}

function formatCooldown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function detectPreferredPlatform(): Platform | null {
  const platform = navigator.platform?.toLowerCase() ?? ''
  const userAgent = navigator.userAgent.toLowerCase()

  if (platform.includes('mac') || userAgent.includes('mac os')) {
    return 'mac'
  }
  if (platform.includes('win') || userAgent.includes('windows')) {
    return 'windows'
  }

  return null
}

function WindowsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3 12.3V4.8l8.2-1.12v8.62H3Zm9.3-1.25V3.52L21 2.2v8.85h-8.7ZM3 13.5h8.2v8.82L3 21.2V13.5Zm9.3 0H21V21.8l-8.7-1.2V13.5Z"
      />
    </svg>
  )
}

function MacIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.7 12.55c-.03-2.52 2.06-3.73 2.15-3.79-1.17-1.71-2.99-1.95-3.64-1.97-1.55-.16-3.03.91-3.82.91-.79 0-2.01-.89-3.3-.87-1.7.03-3.27.99-4.14 2.51-1.77 3.06-.45 7.59 1.27 10.07.84 1.21 1.84 2.57 3.15 2.52 1.26-.05 1.74-.82 3.27-.82 1.52 0 1.95.82 3.29.79 1.36-.02 2.22-1.23 3.05-2.45.96-1.4 1.35-2.76 1.37-2.83-.03-.01-2.63-1.01-2.65-4.07ZM14.6 5.4c.7-.84 1.16-2.01 1.03-3.18-1 .04-2.2.66-2.91 1.5-.64.74-1.2 1.94-1.05 3.08 1.11.09 2.24-.56 2.93-1.4Z"
      />
    </svg>
  )
}

function DownloadCard({
  platform,
  title,
  description,
  href,
  recommended,
  onCooldown,
  remainingMs,
  onDownloadStart,
}: {
  platform: Platform
  title: string
  description: string
  href: string
  recommended: boolean
  onCooldown: boolean
  remainingMs: number
  onDownloadStart: () => void
}) {
  const available = Boolean(href)

  return (
    <article
      className={`download-card${recommended ? ' is-recommended' : ''}${available ? '' : ' is-unavailable'}`}
    >
      {recommended && <span className="download-badge">Recommended</span>}
      <div className={`download-icon download-icon-${platform}`}>
        {platform === 'windows' ? <WindowsIcon /> : <MacIcon />}
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {available ? (
        onCooldown ? (
          <button type="button" className="btn btn-primary" disabled>
            Try again in {formatCooldown(remainingMs)}
          </button>
        ) : (
          <a
            className="btn btn-primary"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onDownloadStart}
          >
            Download
          </a>
        )
      ) : (
        <button type="button" className="btn btn-secondary" disabled>
          Link not set
        </button>
      )}
    </article>
  )
}

export default function DownloadCards() {
  const preferred = useMemo(() => detectPreferredPlatform(), [])
  const windowsUrl = WINDOWS_DOWNLOAD_LINK.trim()
  const macUrl = MAC_DOWNLOAD_LINK.trim()
  const [cooldownUntil, setCooldownUntil] = useState(readCooldownUntil)
  const [now, setNow] = useState(() => Date.now())
  const remainingMs = Math.max(0, cooldownUntil - now)
  const onCooldown = remainingMs > 0

  useEffect(() => {
    if (!onCooldown) {
      return
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now())
    }, 250)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [onCooldown])

  function handleDownloadStart() {
    const until = Date.now() + DOWNLOAD_COOLDOWN_MS
    setCooldownUntil(until)
    setNow(Date.now())
    writeCooldownUntil(until)
  }

  return (
    <div className="download-grid">
      <DownloadCard
        platform="windows"
        title="Windows"
        description="Installer for Windows 10 and 11."
        href={windowsUrl}
        recommended={preferred === 'windows'}
        onCooldown={onCooldown}
        remainingMs={remainingMs}
        onDownloadStart={handleDownloadStart}
      />
      <DownloadCard
        platform="mac"
        title="macOS"
        description="App for Mac computers running macOS."
        href={macUrl}
        recommended={preferred === 'mac'}
        onCooldown={onCooldown}
        remainingMs={remainingMs}
        onDownloadStart={handleDownloadStart}
      />
    </div>
  )
}
