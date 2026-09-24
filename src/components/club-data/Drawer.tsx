import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface DrawerProps {
  title: string
  description?: string
  labelledBy: string
  busy?: boolean
  wide?: boolean
  footer?: ReactNode
  onClose: () => void
  children: ReactNode
}

export default function Drawer({
  title,
  description,
  labelledBy,
  busy = false,
  wide = false,
  footer,
  onClose,
  children,
}: DrawerProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) {
        onClose()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [busy, onClose])

  return createPortal(
    <div
      className="club-drawer-backdrop"
      onClick={() => {
        if (!busy) {
          onClose()
        }
      }}
    >
      <aside
        className={`club-drawer${wide ? ' is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="club-drawer-header">
          <div>
            <h2 id={labelledBy}>{title}</h2>
            {description ? <p className="club-muted">{description}</p> : null}
          </div>
          <button type="button" className="btn btn-secondary btn-compact" onClick={onClose} disabled={busy}>
            Close
          </button>
        </header>
        <div className="club-drawer-body">{children}</div>
        {footer ? <footer className="club-drawer-footer">{footer}</footer> : null}
      </aside>
    </div>,
    document.body,
  )
}
