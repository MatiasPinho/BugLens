import { IconSettings } from './icons'

interface Props {
  availability: boolean | null
  onOpenSettings: () => void
}

const ENGINE_STATE = {
  checking: {
    label: 'Comprobando Ollama',
    tone: 'badge badge-category',
    title: 'Comprobando el modelo local',
  },
  available: {
    label: 'Ollama local',
    tone: 'badge badge-accent',
    title: 'Abrir configuración del modelo local',
  },
  unavailable: {
    label: 'Ollama no disponible',
    tone: 'badge badge-severity-critical',
    title: 'Abrir configuración de Ollama',
  },
} as const

/** Estado global del motor y acceso directo a su configuración. */
export default function EngineStatusButton({ availability, onOpenSettings }: Props) {
  const state =
    availability === null
      ? ENGINE_STATE.checking
      : availability
        ? ENGINE_STATE.available
        : ENGINE_STATE.unavailable

  return (
    <button
      type="button"
      className={`${state.tone} engine-status-badge engine-status-action`}
      onClick={onOpenSettings}
      title={state.title}
      aria-label={`${state.label}. Abrir configuración`}
      aria-live="polite"
    >
      <span className="dot" aria-hidden="true" />
      <span className="engine-status-label">{state.label}</span>
      <IconSettings size={12} className="engine-status-action-icon" aria-hidden="true" />
    </button>
  )
}
