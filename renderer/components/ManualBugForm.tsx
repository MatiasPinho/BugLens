import { useEffect, useRef, useState } from 'react'
import type { ManualBugFields } from '../../src/pipeline/manualBugBuilder'
import { alpha, col } from '../theme'

interface Props {
  onSubmit: (fields: ManualBugFields) => void
  onClose: () => void
}

// Carga manual de un bug suelto, sin pasar por un Excel. Necesita al menos
// título o descripción — el resto lo completa el LLM (lo que falte va a "falta info").
export default function ManualBugForm({ onSubmit, onClose }: Props) {
  const [fields, setFields] = useState<ManualBugFields>({})
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const firstFieldRef = useRef<HTMLInputElement | null>(null)

  const set = (key: keyof ManualBugFields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }))

  const isValid = Boolean((fields.title ?? '').trim() || (fields.description ?? '').trim())

  const handleSubmit = () => {
    if (!isValid) return
    onSubmit(fields)
    onClose()
  }

  // Manejo de foco: al abrir, foco al primer campo; al cerrar, devolver el foco
  // a donde estaba (el botón que abrió el modal).
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    firstFieldRef.current?.focus()
    return () => previouslyFocused?.focus()
  }, [])

  // Teclado del modal: Esc cierra, Ctrl/Cmd+Enter envía, Tab queda atrapado
  // dentro del diálogo. stopPropagation evita que los atajos globales de la app
  // (j/k, 1-5, …) actúen mientras el modal está abierto.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
      return
    }
    if (e.key === 'Tab' && dialogRef.current) {
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, input, textarea, [href], [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop: botón real → click cierra. Fuera del tab order (Esc ya cierra). */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="cerrar formulario"
        className="absolute inset-0 cursor-default"
        style={{ background: alpha(col.code, 0.85) }}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="cargar bug manual"
        onKeyDown={handleKeyDown}
        className="relative max-h-[90vh] w-full max-w-lg animate-fade-in overflow-y-auto rounded p-5"
        style={{ background: col.surface, border: `1px solid ${alpha(col.border, 0.3)}` }}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider" style={{ color: col.cream }}>
            cargar bug manual
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded transition-colors"
            style={{ color: col.fgMuted }}
            onMouseEnter={(e) => (e.currentTarget.style.color = col.fg)}
            onMouseLeave={(e) => (e.currentTarget.style.color = col.fgMuted)}
            aria-label="cerrar"
          >
            <svg aria-hidden="true" width="11" height="11" viewBox="0 0 10 10" fill="none">
              <line
                x1="1"
                y1="1"
                x2="9"
                y2="9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="9"
                y1="1"
                x2="1"
                y2="9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* ── Principal: al menos uno de estos dos es obligatorio ── */}
        <div className="mb-1 flex items-center gap-2">
          <span className="section-label mb-0">reporte</span>
          <span className="font-mono text-xs" style={{ color: col.dim }}>
            título o descripción (al menos uno)
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="manual-bug-title">
              título
            </label>
            <input
              ref={firstFieldRef}
              id="manual-bug-title"
              type="text"
              className="input text-xs"
              placeholder="ej: el botón de login no responde"
              value={fields.title ?? ''}
              onChange={(e) => set('title', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="manual-bug-description">
              descripción
            </label>
            <textarea
              id="manual-bug-description"
              className="input resize-y text-xs"
              rows={3}
              placeholder="qué pasa, en las palabras del QA"
              value={fields.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
        </div>

        {/* ── Detalle: opcional, lo que el QA tenga a mano ── */}
        <div className="mt-4 mb-1">
          <span className="section-label mb-0">detalle (opcional)</span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="manual-bug-steps">
              pasos para reproducir
            </label>
            <textarea
              id="manual-bug-steps"
              className="input resize-y text-xs"
              rows={3}
              placeholder="uno por línea"
              value={fields.stepsToReproduce ?? ''}
              onChange={(e) => set('stepsToReproduce', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="manual-bug-expected">
                resultado esperado
              </label>
              <input
                id="manual-bug-expected"
                type="text"
                className="input text-xs"
                placeholder="qué debería pasar"
                value={fields.expectedResult ?? ''}
                onChange={(e) => set('expectedResult', e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="manual-bug-actual">
                resultado actual
              </label>
              <input
                id="manual-bug-actual"
                type="text"
                className="input text-xs"
                placeholder="qué pasa en su lugar"
                value={fields.actualResult ?? ''}
                onChange={(e) => set('actualResult', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="manual-bug-environment">
              ambiente
            </label>
            <input
              id="manual-bug-environment"
              type="text"
              className="input text-xs"
              placeholder="dev / prod / local…"
              value={fields.environment ?? ''}
              onChange={(e) => set('environment', e.target.value)}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={!isValid}>
            agregar y analizar
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            cancelar
          </button>
          <span className="ml-auto font-mono text-xs" style={{ color: col.dim }}>
            ⌘/Ctrl + ↵
          </span>
        </div>
        {/* Estado de validación, anunciado a lectores de pantalla */}
        <div role="status" aria-live="polite" className="mt-2 min-h-4">
          {!isValid && (
            <span className="font-mono text-xs" style={{ color: col.dim }}>
              cargá al menos título o descripción para continuar
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
