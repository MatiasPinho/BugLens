import { useState } from 'react'
import type { LogLine } from '../App'
import { alpha, col } from '../theme'
import { ConfirmActionModal } from './ActionModal'
import { IconRestore, IconTrash } from './icons'

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
    label: 'vaciar vista local',
    description: 'Reinicia la app sin borrar bugs ni estados del proyecto compartido.',
    confirmMessage: 'esto reinicia la app sin borrar datos de Supabase',
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
 * Acciones destructivas de restablecimiento. Cada una **reinicia la app**. No tocan
 * la caché de análisis (tiene su propio botón) ni las sesiones de Google.
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

function ResetRow({ action, addLog }: { action: ResetAction; addLog: Props['addLog'] }) {
  const { scope, label, description, confirmMessage, Icon } = action
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    addLog('warn', `${label} — reiniciando…`)
    // resetApp reinicia la app, así que la promesa puede no resolver: no dependemos de ella.
    await window.electronAPI.resetApp(scope)
  }

  // Acento destructivo en reposo (rojo tenue) + ícono distintivo; el hover intensifica.
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
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
      <ConfirmActionModal
        open={confirming}
        title={label}
        description={confirmMessage}
        confirmLabel="restablecer"
        busyLabel="reiniciando"
        busy={busy}
        onClose={() => {
          if (!busy) setConfirming(false)
        }}
        onConfirm={run}
      />
    </div>
  )
}
