import { useEffect, useRef, useState } from 'react'
import type { LogLine } from '../App'
import { alpha, col } from '../theme'
import { IconRestore, IconTrash, IconWarning } from './icons'

type ResetScope = 'bug-data' | 'config'

interface Props {
  addLog: (level: LogLine['level'], message: string) => void
}

interface ResetAction {
  scope: ResetScope
  label: string
  description: string
  confirmMessage: string
  Icon: typeof IconTrash
}

const ACTIONS: ResetAction[] = [
  {
    scope: 'bug-data',
    label: 'borrar datos de bugs',
    description: 'Olvida los estados de los bugs y vacía la tabla cargada (sesión + análisis).',
    confirmMessage: 'esto borra los estados y la sesión, y reinicia la app',
    Icon: IconTrash,
  },
  {
    scope: 'config',
    label: 'restablecer configuración',
    description: 'Vuelve a los valores por defecto y reabre el asistente de primer arranque.',
    confirmMessage: 'esto restablece la configuración y reinicia la app',
    Icon: IconRestore,
  },
]

/**
 * Acciones destructivas de restablecimiento, con confirmación inline (sin `confirm()`
 * nativo). Cada una borra datos en disco y **reinicia la app**. No tocan la caché de
 * análisis (tiene su propio botón) ni las sesiones de Google.
 */
export default function ResetControls({ addLog }: Props) {
  return (
    <div className="space-y-2">
      {ACTIONS.map((action) => (
        <ResetRow key={action.scope} action={action} addLog={addLog} />
      ))}
    </div>
  )
}

// Una acción con confirmación inline en dos pasos. Maneja el foco como DeleteControl:
// al confirmar lleva el foco al botón de confirmar (el disparador se desmonta); al
// cancelar lo devuelve al disparador. Esc cancela.
function ResetRow({ action, addLog }: { action: ResetAction; addLog: Props['addLog'] }) {
  const { scope, label, description, confirmMessage, Icon } = action
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const wasConfirming = useRef(false)

  useEffect(() => {
    if (confirming) confirmRef.current?.focus()
    else if (wasConfirming.current) triggerRef.current?.focus()
    wasConfirming.current = confirming
  }, [confirming])

  // Esc cancela; stopPropagation evita que el atajo global de la app también dispare.
  const cancelOnEscape = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      setConfirming(false)
    }
  }

  const run = async () => {
    setBusy(true)
    addLog('warn', `${label} — reiniciando…`)
    // resetApp reinicia la app, así que la promesa puede no resolver: no dependemos de ella.
    await window.electronAPI.resetApp(scope)
  }

  if (confirming) {
    return (
      <div
        className="flex animate-fade-in flex-wrap items-center gap-2.5 rounded p-2.5 text-xs"
        role="alert"
        style={{ border: `1px solid ${alpha(col.red, 0.4)}`, background: alpha(col.red, 0.07) }}
      >
        <span className="flex items-center gap-1.5" style={{ color: col.red }}>
          <IconWarning size={12} className="flex-shrink-0" />
          {confirmMessage}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            ref={confirmRef}
            type="button"
            className="btn-danger text-xs"
            onClick={run}
            onKeyDown={cancelOnEscape}
            disabled={busy}
            aria-label={`sí, ${label}`}
          >
            {busy ? 'reiniciando…' : 'sí, restablecer'}
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setConfirming(false)}
            onKeyDown={cancelOnEscape}
            disabled={busy}
          >
            cancelar
          </button>
        </div>
      </div>
    )
  }

  // Acento destructivo en reposo (rojo tenue) + ícono distintivo; el hover intensifica.
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex flex-shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 font-mono text-xs transition-colors duration-200"
        onClick={() => setConfirming(true)}
        style={{
          color: col.red,
          border: `1px solid ${alpha(col.red, 0.32)}`,
          background: alpha(col.red, 0.07),
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = alpha(col.red, 0.16)
          e.currentTarget.style.borderColor = alpha(col.red, 0.5)
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = alpha(col.red, 0.07)
          e.currentTarget.style.borderColor = alpha(col.red, 0.32)
        }}
      >
        <Icon size={12} className="flex-shrink-0" />
        {label}
      </button>
      <span className="flex-1 text-xs" style={{ color: col.fgMuted }}>
        {description}
      </span>
    </div>
  )
}
