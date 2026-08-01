// BugRewrittenReport.tsx
//
// El protagonista del producto: la versión REESCRITA y clara del reporte de QA.
// Se comparte entre la vista previa (lista + preview) y el detalle dedicado; el
// detalle usa la versión `dense={false}`, con más aire y tipografía más grande.

import type { AnalyzedBug } from '../../../../src/shared/contracts'

export function BugRewrittenReport({ bug, dense = false }: { bug: AnalyzedBug; dense?: boolean }) {
  const rewritten = bug.analysis.rewritten

  return (
    <div className="grid gap-3.5">
      <div className="bug-rewrite-grid">
        <RewritePanel
          index="01"
          tone="actual"
          title="Qué pasa"
          text={rewritten.observed}
          dense={dense}
        />
        <RewritePanel
          index="02"
          tone="expected"
          title="Qué debería pasar"
          text={rewritten.expected}
          dense={dense}
        />
      </div>

      {rewritten.steps.length > 0 && (
        <div className="rewrite-steps grid gap-2.5">
          <div className="rewrite-steps-head">
            <span className="rewrite-section-index" aria-hidden="true">
              03
            </span>
            <span className="kicker">{dense ? 'Pasos' : 'Pasos para reproducir'}</span>
          </div>
          <ol className="grid gap-2.5">
            {rewritten.steps.map((step, index) => (
              <li key={index} className="bug-step">
                <span className="bug-step-number">{index + 1}</span>
                <span className="bug-step-text">{step.replace(/^\d+[.)]\s*/, '')}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

// El borde izquierdo de color + el título comunican el rol (defecto vs. esperado);
// el cuerpo queda en el color de lectura normal.
function RewritePanel({
  index,
  tone,
  title,
  text,
  dense,
}: {
  index: string
  tone: 'actual' | 'expected'
  title: string
  text: string
  dense: boolean
}) {
  const isEmpty = text === 'No informado'
  return (
    <div className={`rewrite-panel rewrite-panel-${tone}`}>
      <span className="rewrite-panel-index" aria-hidden="true">
        {index}
      </span>
      <span className="rewrite-panel-title">{title}</span>
      <p
        className={`rewrite-panel-body whitespace-pre-wrap ${isEmpty ? 'rewrite-panel-body-muted' : ''}`}
        style={dense ? { fontSize: 'var(--text-sm)' } : undefined}
      >
        {text}
      </p>
    </div>
  )
}
