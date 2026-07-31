import type React from 'react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { col } from '../theme'
import { IconWarning, IconX } from './icons'
import { LoadingInline } from './Loading'

type Tone = 'default' | 'danger'

interface ActionModalProps {
  open: boolean
  title: string
  description?: string
  tone?: Tone
  children?: React.ReactNode
  onClose: () => void
}

export function ActionModal({
  open,
  title,
  description,
  tone = 'default',
  children,
  onClose,
}: ActionModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = `modal-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const descriptionId = description ? `${titleId}-description` : undefined

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => previous?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, open])

  if (!open) return null

  const accent = tone === 'danger' ? col.critical : col.fg
  const shellClassName = `modal-shell animate-fade-in ${
    tone === 'danger' ? 'modal-shell-danger' : ''
  }`

  // Portal a `document.body`: un modal abierto desde el topbar quedaba dentro de
  // su contexto de apilado (`z-index: 20`) y el rail (`z-index: 30`) le pasaba por
  // encima — el `z-50` de acá adentro no alcanza para salir del subárbol.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="cerrar modal"
        className="modal-backdrop"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={shellClassName}
      >
        <div className="modal-header">
          <div className="min-w-0">
            <div className="modal-title-row">
              {tone === 'danger' && <IconWarning size={16} className="flex-shrink-0 self-center" />}
              <h2 id={titleId} className="modal-title" style={{ color: accent }}>
                {title}
              </h2>
            </div>
            {description && (
              <p id={descriptionId} className="modal-description mt-1">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn-icon btn-icon-sm"
            onClick={onClose}
            aria-label="cerrar"
          >
            <IconX size={12} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel,
  busyLabel = 'procesando',
  tone = 'danger',
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel: string
  busyLabel?: string
  tone?: Tone
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <ActionModal open={open} title={title} description={description} tone={tone} onClose={onClose}>
      <div className="modal-actions">
        <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button
          type="button"
          className={tone === 'danger' ? 'btn-danger' : 'btn-primary'}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? <LoadingInline label={busyLabel} /> : confirmLabel}
        </button>
      </div>
    </ActionModal>
  )
}
