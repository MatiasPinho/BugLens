// AnalysisProgressScreen.tsx
//
// Pantalla de análisis en curso (1f): pasos del pipeline, barra de progreso con
// el bug que se está reescribiendo y el log de la corrida.

import { Fragment } from 'react'
import type { AnalysisPhase } from '../../../../src/shared/contracts'
import type { LogLine } from '../../../App'
import ProgressLog from '../../../components/ProgressLog'
import { col } from '../../../theme'

const PHASES: Array<{ key: AnalysisPhase; label: string }> = [
  { key: 'reading_excel', label: 'Excel' },
  { key: 'reading_docs', label: 'Docs' },
  { key: 'analyzing', label: 'Analizar' },
  { key: 'done', label: 'Listo' },
]

interface Props {
  current: number
  total: number
  message: string
  phase?: AnalysisPhase
  logs: LogLine[]
  /** Ej: "qwen2.5:7b en GPU · 3 bugs en paralelo" */
  engineLabel?: string
}

export default function AnalysisProgressScreen({
  current,
  total,
  message,
  phase,
  logs,
  engineLabel,
}: Props) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="analysis-progress-screen flex h-full min-h-0 flex-col gap-5 p-8">
      <div className="page-heading">
        <div className="grid gap-1.5">
          <span className="page-eyebrow">
            <span className="page-eyebrow-dot animate-scan" aria-hidden="true" />
            Pipeline en curso
          </span>
          <h2 className="page-title">
            {total > 0 ? `Analizando ${total} bug${total === 1 ? '' : 's'}` : 'Analizando bugs'}
          </h2>
          {engineLabel && <p className="page-description">{engineLabel}</p>}
        </div>
      </div>

      <div className="card analysis-progress-card grid gap-4">
        <PhaseSteps current={phase} />

        <div className="grid gap-2">
          <div className="flex items-center gap-2.5">
            <span className="min-w-0 flex-1 truncate text-sm" style={{ color: col.fgBody }}>
              {message}
            </span>
            {total > 0 && (
              <span className="flex-shrink-0 font-semibold text-sm tabular-nums">
                {current} / {total}
              </span>
            )}
          </div>
          <span className="progress-track">
            <span className="progress-fill" style={{ width: `${total > 0 ? percent : 5}%` }} />
          </span>
          {total > 0 && (
            <div
              className="flex items-center justify-between text-xs"
              style={{ color: col.fgDim }}
              aria-live="polite"
            >
              <span>{percent}% completado</span>
              <span>
                {total - current} bug{total - current === 1 ? '' : 's'} restante
                {total - current === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ProgressLog logs={logs} />
      </div>
    </div>
  )
}

// Pasos visuales del pipeline: el activo se marca en acento, los anteriores en
// verde de completado y los futuros en gris.
export function PhaseSteps({ current }: { current?: AnalysisPhase }) {
  const currentIndex = PHASES.findIndex((step) => step.key === current)
  const activeIndex = currentIndex >= 0 ? currentIndex : 0

  return (
    <div className="phase-steps">
      {PHASES.map((step, index) => {
        const isDone = current === 'done' || index < activeIndex
        const isCurrent = index === activeIndex && current !== 'done'
        const stepClass = isCurrent ? 'phase-step-current' : isDone ? 'phase-step-done' : ''
        const connectorClass = isCurrent
          ? 'phase-connector-current'
          : isDone
            ? 'phase-connector-done'
            : ''
        return (
          <Fragment key={step.key}>
            {index > 0 && <span className={`phase-connector ${connectorClass}`} />}
            <span className={`phase-step ${stepClass}`}>
              <span className="phase-step-dot" />
              {step.label}
            </span>
          </Fragment>
        )
      })}
    </div>
  )
}
