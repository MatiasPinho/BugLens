import { useState } from 'react'
import type { LogLine } from '../../../App'
import { ConfirmActionModal } from '../../../components/ActionModal'
import { IconRestore, IconTrash } from '../../../components/icons'
import { col } from '../../../theme'

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
    label: 'Vaciar vista local',
    description: 'Reinicia la app sin borrar bugs ni estados del proyecto compartido.',
    confirmMessage: 'esto reinicia la app sin borrar datos de Supabase',
    Icon: IconTrash,
  },
  {
    scope: 'config',
    label: 'Restablecer configuración',
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
    <div className="grid gap-3">
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
        className="btn-danger flex-shrink-0"
        onClick={() => setConfirming(true)}
      >
        <Icon size={12} className="button-icon" />
        {label}
      </button>
      <span className="flex-1 text-sm" style={{ color: col.fgMuted }}>
        {description}
      </span>
      <ConfirmActionModal
        open={confirming}
        title={label}
        description={confirmMessage}
        confirmLabel="Restablecer"
        busyLabel="Reiniciando"
        busy={busy}
        onClose={() => {
          if (!busy) setConfirming(false)
        }}
        onConfirm={run}
      />
    </div>
  )
}
