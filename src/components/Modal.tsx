import { type ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  title: string
  description: string
  labelledBy: string
  busy?: boolean
  wide?: boolean
  dismissible?: boolean
  footer?: ReactNode
  onClose: () => void
  children: ReactNode
}

export default function Modal({
  title,
  description,
  labelledBy,
  busy = false,
  wide = false,
  dismissible = true,
  footer,
  onClose,
  children,
}: ModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy && dismissible) {
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
  }, [busy, dismissible, onClose])

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!busy && dismissible) {
          onClose()
        }
      }}
    >
      <div
        className={`modal-panel${wide ? ' modal-panel-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={`${labelledBy}-description`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id={labelledBy}>{title}</h2>
            <p id={`${labelledBy}-description`} className="modal-description">
              {description}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            Close
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
