import { useEffect, useRef, useState } from 'react'
import type { ManualBugFields } from '../../../../src/features/analyze-bugs/application/manualBugBuilder'
import { IconX } from '../../../components/icons'
import { col } from '../../../theme'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* backdrop: botón real → click cierra. Fuera del tab order (Esc ya cierra). */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="cerrar formulario"
        className="modal-backdrop"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="cargar bug manual"
        onKeyDown={handleKeyDown}
        className="modal-shell animate-fade-in"
      >
        <div className="modal-header">
          <div className="grid min-w-0 gap-0.5">
            <h2 className="modal-title">Cargar bug manual</h2>
            <p className="modal-description">
              Con título o descripción alcanza: el resto lo completa el análisis.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon btn-icon-sm"
            aria-label="cerrar"
          >
            <IconX size={12} />
          </button>
        </div>

        <div className="modal-body grid gap-4">
          <div>
            <label className="label" htmlFor="manual-bug-title">
              Título
            </label>
            <input
              ref={firstFieldRef}
              id="manual-bug-title"
              type="text"
              className="input"
              placeholder="Ej: el botón de login no responde"
              value={fields.title ?? ''}
              onChange={(e) => set('title', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="manual-bug-description">
              Descripción
            </label>
            <textarea
              id="manual-bug-description"
              className="input resize-y"
              rows={3}
              placeholder="Qué pasa, en las palabras del QA"
              value={fields.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <div className="detail-divider" />
          <span className="kicker">Detalle opcional</span>

          <div>
            <label className="label" htmlFor="manual-bug-steps">
              Pasos para reproducir
            </label>
            <textarea
              id="manual-bug-steps"
              className="input resize-y"
              rows={3}
              placeholder="Uno por línea"
              value={fields.stepsToReproduce ?? ''}
              onChange={(e) => set('stepsToReproduce', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="manual-bug-expected">
                Resultado esperado
              </label>
              <input
                id="manual-bug-expected"
                type="text"
                className="input"
                placeholder="Qué debería pasar"
                value={fields.expectedResult ?? ''}
                onChange={(e) => set('expectedResult', e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="manual-bug-actual">
                Resultado actual
              </label>
              <input
                id="manual-bug-actual"
                type="text"
                className="input"
                placeholder="Qué pasa en su lugar"
                value={fields.actualResult ?? ''}
                onChange={(e) => set('actualResult', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="manual-bug-environment">
              Ambiente
            </label>
            <input
              id="manual-bug-environment"
              type="text"
              className="input"
              placeholder="dev / prod / local…"
              value={fields.environment ?? ''}
              onChange={(e) => set('environment', e.target.value)}
            />
          </div>

          {/* Estado de validación, anunciado a lectores de pantalla */}
          <div role="status" aria-live="polite" className="min-h-4">
            {!isValid && (
              <span className="text-xs" style={{ color: col.fgDim }}>
                Cargá al menos título o descripción para continuar
              </span>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <span className="text-2xs" style={{ color: col.fgDim }}>
            ⌘/Ctrl + ↵ para agregar
          </span>
          <button type="button" className="btn-secondary ml-auto" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={handleSubmit} disabled={!isValid}>
            Agregar y analizar
          </button>
        </div>
      </div>
    </div>
  )
}
