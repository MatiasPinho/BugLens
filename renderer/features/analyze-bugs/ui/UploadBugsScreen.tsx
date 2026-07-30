// UploadBugsScreen.tsx
//
// Pantalla de entrada del pipeline (1e): traer un Excel de QA o cargar un bug a
// mano. Explica en tres pasos qué va a hacer BugLens antes de arrancar.

import FileUpload from '../../../components/FileUpload'
import { IconPlus } from '../../../components/icons'
import { col } from '../../../theme'

interface Props {
  excelPath: string | null
  onFileSelected: (path: string) => void
  onManualBug: () => void
  onAnalyze: () => void
  disabled?: boolean
}

const STEPS = [
  {
    title: 'Cargar un Excel — o un bug a mano',
    detail:
      'Detecta columnas en español e inglés y los links a Google Docs de cualquier celda.',
  },
  {
    title: 'Clasificar y reescribir',
    detail:
      'Una llamada al modelo local por bug: categoría, severidad, texto claro y datos que faltan.',
  },
  {
    title: 'Abrir cada bug y llevar el estado',
    detail: 'Todo el equipo ve el mismo proyecto, sincronizado en tiempo real.',
  },
]

export default function UploadBugsScreen({
  excelPath,
  onFileSelected,
  onManualBug,
  onAnalyze,
  disabled = false,
}: Props) {
  return (
    <div className="screen-scroll upload-screen">
      <div className="page-heading">
        <div className="grid gap-1.5">
          <span className="page-eyebrow">
            <span className="page-eyebrow-dot" aria-hidden="true" />
            Nueva entrada
          </span>
          <h2 className="page-title">
          Cargar bugs
          </h2>
          <p className="page-description">
            Traé un Excel de QA o cargá un bug a mano. BugLens clasifica y reescribe cada reporte.
          </p>
        </div>
      </div>

      <div className="card upload-card grid gap-4">
        <FileUpload excelPath={excelPath} onFileSelected={onFileSelected} disabled={disabled} />

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            className="btn-secondary btn-lg"
            onClick={onManualBug}
            disabled={disabled}
          >
            <IconPlus size={12} className="button-icon button-icon-plus" />
            Cargar bug manual
          </button>
          <button
            type="button"
            className="btn-primary btn-lg"
            onClick={onAnalyze}
            disabled={disabled || !excelPath}
          >
            Analizar bugs
          </button>
          {!excelPath && (
            <span className="text-xs" style={{ color: col.fgDim }}>
              Necesitás un archivo o un bug manual
            </span>
          )}
        </div>
      </div>

      <section className="card workflow-card grid gap-3.5">
        <h3 className="kicker">Cómo funciona</h3>
        {STEPS.map((step, index) => (
          <div key={step.title} className="workflow-step flex items-start gap-3">
            <span
              className={`workflow-step-number avatar ${index === 0 ? '' : 'avatar-muted'}`}
              style={{ width: '1.5rem', height: '1.5rem', fontSize: 'var(--text-xs)' }}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className="grid gap-0.5">
              <span
                className="font-semibold text-md"
                style={{ color: index === 0 ? col.fg : col.fgBody }}
              >
                {step.title}
              </span>
              <span className="text-sm" style={{ color: col.fgMuted }}>
                {step.detail}
              </span>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}
