import React, { useEffect, useRef } from 'react'
import { alpha, col } from '../theme'
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

  const accent = tone === 'danger' ? col.red : col.cream

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="cerrar modal"
        className="absolute inset-0 cursor-default"
        style={{ background: alpha(col.code, 0.82) }}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative w-full max-w-md animate-fade-in rounded-md p-4 font-mono"
        style={{
          color: col.fg,
          background: col.surface,
          border: `1px solid ${alpha(accent, 0.26)}`,
          boxShadow: `0 20px 60px ${alpha(col.code, 0.65)}`,
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-start gap-2">
              {tone === 'danger' && <IconWarning size={16} className="mt-0.5 flex-shrink-0" />}
              <h2 className="text-sm font-semibold leading-5" style={{ color: accent }}>
                {title}
              </h2>
            </div>
            {description && (
              <p className="mt-1 text-xs" style={{ color: col.fgMuted }}>
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn-mini flex-shrink-0"
            onClick={onClose}
            aria-label="cerrar"
          >
            <IconX size={12} />
          </button>
        </div>
        {children}
      </div>
    </div>
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
          cancelar
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
