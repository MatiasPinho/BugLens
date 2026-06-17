import { useState } from 'react'
import { alpha, col } from '../theme'

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
    name: 'con placa de video (GPU)',
    description: 'Rápido. El modelo corre acelerado por la GPU.',
  },
  {
    id: 'cpu',
    name: 'sin placa de video (CPU)',
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary text-xs" onClick={analyze} disabled={probing}>
          {probing ? 'analizando tu equipo…' : 'analizar mi equipo'}
        </button>
        {probing && (
          <span className="text-xs" style={{ color: col.fgMuted }}>
            cargando el modelo para medir (puede tardar)
          </span>
        )}
      </div>

      {probe && !probing && (
        <ProbeNotice accelerator={probe.accelerator} detail={probe.detail} />
      )}

      <div className="space-y-1.5">
        {MODE_OPTIONS.map((opt) => {
          const isSelected = value === opt.id
          const isRecommended = recommended === opt.id
          return (
            <label
              key={opt.id}
              className="flex cursor-pointer items-start gap-3 rounded p-2.5 transition-all"
              style={{
                border: `1px solid ${isSelected ? alpha(col.cream, 0.3) : alpha(col.border, 0.22)}`,
                background: isSelected ? alpha(col.cream, 0.05) : 'transparent',
              }}
            >
              <div
                className="mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border transition-all"
                style={{
                  borderColor: isSelected ? col.cream : alpha(col.border, 0.45),
                  background: isSelected ? col.cream : 'transparent',
                }}
              >
                {isSelected && (
                  <div className="h-1.5 w-1.5 rounded-full" style={{ background: col.base }} />
                )}
              </div>
              <input
                type="radio"
                name="performanceMode"
                value={opt.id}
                checked={isSelected}
                onChange={() => onChange(opt.id)}
                className="sr-only"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="font-medium text-xs"
                    style={{ color: isSelected ? col.fg : col.fgMuted }}
                  >
                    {opt.name}
                  </span>
                  {isRecommended && (
                    <span
                      className="rounded px-1.5 py-0.5 font-mono text-2xs"
                      style={{
                        color: col.green,
                        border: `1px solid ${alpha(col.green, 0.4)}`,
                        background: alpha(col.green, 0.08),
                      }}
                    >
                      recomendado
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs" style={{ color: col.fgMuted }}>
                  {opt.description}
                </div>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function ProbeNotice({ accelerator, detail }: { accelerator: Accelerator; detail: string }) {
  // CPU/unknown → aviso ámbar; GPU → confirmación verde.
  const tone = accelerator === 'gpu' ? col.green : accelerator === 'cpu' ? col.amber : col.fgMuted
  const icon = accelerator === 'gpu' ? '✓' : accelerator === 'cpu' ? '⚠' : 'ℹ'
  return (
    <div
      className="rounded p-2.5 text-xs"
      role="status"
      style={{ border: `1px solid ${alpha(tone, 0.35)}`, background: alpha(tone, 0.06), color: tone }}
    >
      <span className="mr-1.5">{icon}</span>
      {detail}
    </div>
  )
}
