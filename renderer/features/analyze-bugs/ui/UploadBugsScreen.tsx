// UploadBugsScreen.tsx
//
// Pantalla de entrada del pipeline (1e): traer un Excel de QA o cargar un bug a
// mano. Explica en tres pasos qué va a hacer BugLens antes de arrancar.

import FileUpload from '../../../components/FileUpload'
import { IconPlus, IconSettings, IconWarning } from '../../../components/icons'
import { col } from '../../../theme'

interface Props {
  excelPath: string | null
  onFileSelected: (path: string) => void
  onManualBug: () => void
  onAnalyze: () => void
  engineAvailability?: boolean | null
  onOpenSettings?: () => void
  disabled?: boolean
}

const STEPS = [
  {
    title: 'Cargar un Excel — o un bug a mano',
    detail: 'Detecta columnas en español e inglés y los links a Google Docs de cualquier celda.',
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
  engineAvailability = true,
  onOpenSettings,
  disabled = false,
}: Props) {
  const enginePending = engineAvailability !== true
  const analyzeDisabled = disabled || !excelPath || enginePending
  const analysisDescription = enginePending
    ? 'upload-engine-state upload-reassurance'
    : 'upload-reassurance'

  return (
    <div className="screen-scroll upload-screen">
      <div className="page-heading">
        <div className="grid gap-1.5">
          <span className="page-eyebrow">
            <span className="page-eyebrow-dot" aria-hidden="true" />
            Nueva entrada
          </span>
          <h2 className="page-title">Cargar bugs</h2>
          <p className="page-description">
            Traé un Excel de QA o cargá un bug a mano. BugLens clasifica y reescribe cada reporte.
          </p>
        </div>
      </div>

      <div className="upload-layout">
        <section className="card upload-card grid gap-4" aria-label="cargar archivo">
          <div className="grid gap-1">
            <h3 className="font-bold text-xl">Archivo de QA</h3>
            <p className="text-sm" style={{ color: col.fgMuted }}>
              Elegí el archivo fuente. Podés cambiarlo antes de iniciar el análisis.
            </p>
          </div>

          {enginePending && (
            <div
              id="upload-engine-state"
              className={`upload-engine-state ${
                engineAvailability === false ? 'upload-engine-state-unavailable' : ''
              }`}
              role={engineAvailability === false ? 'alert' : 'status'}
            >
              <span className="upload-engine-state-icon" aria-hidden="true">
                {engineAvailability === false ? (
                  <IconWarning size={16} />
                ) : (
                  <span className="dot" />
                )}
              </span>
              <span className="upload-engine-state-copy">
                <strong>
                  {engineAvailability === false
                    ? 'Ollama no está disponible'
                    : 'Comprobando el modelo local'}
                </strong>
                <span>
                  {engineAvailability === false
                    ? 'Podés dejar el Excel listo, pero conectalo antes de iniciar el análisis.'
                    : 'Podés elegir el Excel mientras validamos Ollama.'}
                </span>
              </span>
              {engineAvailability === false && onOpenSettings && (
                <button
                  type="button"
                  className="btn-secondary btn-mini upload-engine-state-action"
                  onClick={onOpenSettings}
                >
                  <IconSettings size={12} />
                  Abrir configuración
                </button>
              )}
            </div>
          )}

          <FileUpload excelPath={excelPath} onFileSelected={onFileSelected} disabled={disabled} />

          <div className="upload-actions">
            <button
              type="button"
              className="btn-secondary btn-lg"
              onClick={onManualBug}
              disabled={disabled || enginePending}
              title={enginePending ? 'El bug manual necesita Ollama disponible' : undefined}
            >
              <IconPlus size={12} className="button-icon button-icon-plus" />
              Cargar bug manual
            </button>
            <button
              type="button"
              className="btn-primary btn-lg"
              onClick={onAnalyze}
              disabled={analyzeDisabled}
              aria-describedby={analysisDescription}
            >
              Analizar bugs
            </button>
          </div>

          <p id="upload-reassurance" className="upload-reassurance" role="status">
            {excelPath && engineAvailability === false
              ? 'Archivo listo. Falta conectar Ollama para iniciar el análisis.'
              : excelPath && engineAvailability === null
                ? 'Archivo listo. Estamos comprobando Ollama.'
                : excelPath
                  ? 'Archivo listo. Los estados existentes se conservan al reimportar.'
                  : engineAvailability === false
                    ? 'Elegí un archivo mientras conectás Ollama; el bug manual necesita el modelo.'
                    : engineAvailability === null
                      ? 'Podés elegir un archivo mientras comprobamos Ollama.'
                      : 'Elegí un archivo para habilitar el análisis, o cargá un bug manual.'}
          </p>
        </section>

        <section className="card workflow-card grid gap-3.5">
          <div className="grid gap-1">
            <h3 className="font-bold text-xl">Qué va a pasar</h3>
            <p className="text-xs" style={{ color: col.fgMuted }}>
              El modelo corre en tu equipo y el proyecto queda sincronizado.
            </p>
          </div>
          {STEPS.map((step, index) => (
            <div key={step.title} className="workflow-step flex items-start gap-3">
              <span
                className={`workflow-step-number avatar ${index === 0 ? '' : 'avatar-muted'}`}
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
    </div>
  )
}
