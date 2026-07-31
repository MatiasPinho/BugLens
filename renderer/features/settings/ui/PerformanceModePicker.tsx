import { useState } from 'react'
import { IconCheck, IconInfo, IconWarning } from '../../../components/icons'
import { col } from '../../../theme'

export type PerformanceMode = 'gpu' | 'cpu'

type Accelerator = 'gpu' | 'cpu' | 'unknown'

interface ProbeResult {
  accelerator: Accelerator
  detail: string
  model?: string
}

interface Props {
  value: PerformanceMode
  onChange: (mode: PerformanceMode) => void
}

const MODE_OPTIONS: Array<{ id: PerformanceMode; name: string; description: string }> = [
  {
    id: 'gpu',
    name: 'Con placa de video (GPU)',
    description: 'Rápido: el modelo corre acelerado por la GPU y analiza varios bugs en paralelo.',
  },
  {
    id: 'cpu',
    name: 'Sin placa de video (CPU)',
    description: 'Mucho más lento. Analiza de a un bug y espera más antes de cortar.',
  },
]

/**
 * Selector del modo de rendimiento (GPU/CPU) con un sondeo honesto: le pregunta a
 * Ollama si el modelo corre en GPU o CPU y marca la opción recomendada. Sin GPU avisa
 * que el análisis será lento. Controlado: `value` + `onChange`.
 */
export default function PerformanceModePicker({ value, onChange }: Props) {
  const [probing, setProbing] = useState(false)
  const [probe, setProbe] = useState<ProbeResult | null>(null)

  const recommended: PerformanceMode | null =
    probe?.accelerator === 'gpu' ? 'gpu' : probe?.accelerator === 'cpu' ? 'cpu' : null

  const analyze = async () => {
    setProbing(true)
    setProbe(null)
    try {
      const result = await window.electronAPI.probeHardware()
      setProbe(result)
      // Auto-seleccionar la opción recomendada si el sondeo fue concluyente.
      if (result.accelerator === 'gpu' || result.accelerator === 'cpu') onChange(result.accelerator)
    } finally {
      setProbing(false)
    }
  }

  return (
    <div className="grid gap-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          className="btn-secondary justify-self-start"
          onClick={analyze}
          disabled={probing}
          aria-busy={probing}
        >
          {probing ? 'Analizando tu equipo…' : 'Analizar mi equipo'}
        </button>
        {probing && (
          <span className="flex items-center gap-2 text-xs" style={{ color: col.fgMuted }}>
            <span
              className="h-1.5 w-1.5 flex-shrink-0 animate-scan rounded-full"
              style={{ background: col.accent }}
            />
            Cargando el modelo para medir (puede tardar)
          </span>
        )}
      </div>

      {probe && !probing && <ProbeNotice accelerator={probe.accelerator} detail={probe.detail} />}

      <div className="grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="modo de rendimiento">
        {MODE_OPTIONS.map((option) => {
          const isSelected = value === option.id
          return (
            <label
              key={option.id}
              className={`choice-card ${isSelected ? 'choice-card-selected' : ''}`}
            >
              <span className="choice-radio" aria-hidden="true" />
              <input
                type="radio"
                name="performanceMode"
                value={option.id}
                checked={isSelected}
                onChange={() => onChange(option.id)}
                className="sr-only"
              />
              <span className="grid gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="choice-title">{option.name}</span>
                  {recommended === option.id && (
                    <span className="badge badge-solved">
                      <IconCheck size={8} />
                      Recomendado
                    </span>
                  )}
                </span>
                <span className="choice-text">{option.description}</span>
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function ProbeNotice({ accelerator, detail }: { accelerator: Accelerator; detail: string }) {
  // CPU/unknown → aviso ámbar; GPU → confirmación verde. Color + ícono + texto (no solo color).
  const tone =
    accelerator === 'gpu'
      ? { fg: col.solved, bg: col.solvedTint, line: col.solvedLine, Icon: IconCheck }
      : accelerator === 'cpu'
        ? { fg: col.warn, bg: col.warnBg, line: col.warnLine, Icon: IconWarning }
        : { fg: col.fgBody, bg: col.subtle, line: col.borderCard, Icon: IconInfo }

  return (
    <div
      className="flex animate-fade-in items-start gap-2 rounded-lg p-3 text-sm"
      role="status"
      aria-live="polite"
      style={{ border: `1px solid ${tone.line}`, background: tone.bg, color: tone.fg }}
    >
      <tone.Icon size={14} className="mt-0.5 flex-shrink-0" />
      <span>{detail}</span>
    </div>
  )
}
