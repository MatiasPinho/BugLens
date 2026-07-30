import { useEffect, useState } from 'react'
import { BugUnderLensMark } from '../../../components/decor/BugMotifs'
import { IconCheck } from '../../../components/icons'
import { col } from '../../../theme'
import { DEFAULT_OLLAMA_TEXT_MODEL, DEFAULT_OLLAMA_VISION_MODEL } from './llmOptions'
import PerformanceModePicker, { type PerformanceMode } from './PerformanceModePicker'

interface Props {
  onDone: () => void
}

interface WizardState {
  performanceMode: PerformanceMode
  llmProvider: string
  llmModel: string
  llmVisionModel: string
  ollamaBaseUrl: string
}

const STEPS = ['Rendimiento', 'Modelo', 'Google Docs'] as const

/**
 * Wizard de primer arranque: captura las decisiones importantes (rendimiento GPU/CPU,
 * proveedor + modelo, acceso a Google Docs) y las persiste con `onboarded: true`.
 * Todo queda editable luego en Configuración.
 */
export default function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [state, setState] = useState<WizardState>({
    performanceMode: 'gpu',
    llmProvider: 'ollama',
    llmModel: '',
    llmVisionModel: DEFAULT_OLLAMA_VISION_MODEL,
    ollamaBaseUrl: 'http://localhost:11434',
  })
  const [browserAuth, setBrowserAuth] = useState<{ authenticated: boolean } | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const analyzeImages = state.llmVisionModel.trim().length > 0

  useEffect(() => {
    window.electronAPI.getSettings().then((s) =>
      setState((prev) => ({
        ...prev,
        performanceMode: s.performanceMode ?? 'gpu',
        llmProvider: 'ollama',
        llmModel: DEFAULT_OLLAMA_TEXT_MODEL,
        llmVisionModel: s.llmVisionModel ?? DEFAULT_OLLAMA_VISION_MODEL,
        ollamaBaseUrl: s.ollamaBaseUrl || 'http://localhost:11434',
      })),
    )
    window.electronAPI.getBrowserAuthStatus().then(setBrowserAuth)
  }, [])

  const set = <K extends keyof WizardState>(key: K, value: WizardState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }))

  const connectGoogle = async () => {
    setAuthLoading(true)
    const result = await window.electronAPI.startBrowserLogin()
    setAuthLoading(false)
    if (result.ok) setBrowserAuth({ authenticated: true })
  }

  const finish = async () => {
    setSaving(true)
    await window.electronAPI.saveSettings({
      ...state,
      llmProvider: 'ollama',
      llmModel: DEFAULT_OLLAMA_TEXT_MODEL,
      ollamaBaseUrl: 'http://localhost:11434',
      onboarded: true,
    })
    setSaving(false)
    onDone()
  }

  const isLast = step === STEPS.length - 1

  return (
    <div className="onboarding-page flex h-full items-center justify-center p-10">
      <div className="onboarding-shell grid w-full max-w-[38.75rem] gap-5">
        <div className="onboarding-intro flex flex-col items-center gap-2 text-center">
          <span className="app-brand-mark" style={{ width: '2.5rem', height: '2.5rem' }}>
            <BugUnderLensMark className="motif-sway" style={{ width: 21 }} />
          </span>
          <span className="font-bold text-3xl" style={{ letterSpacing: '-0.02em' }}>
            Bienvenido a BugLens
          </span>
          <p className="text-sm" style={{ color: col.fgMuted }}>
            Configuremos lo importante. Todo se puede cambiar después en Configuración.
          </p>
        </div>

        <ol className="stepper" aria-label="progreso del wizard">
          {STEPS.map((label, index) => {
            const done = index < step
            const active = index === step
            return (
              <li key={label} className="contents">
                <span
                  className={`stepper-item ${index <= step ? 'stepper-item-active' : ''}`}
                  aria-current={active ? 'step' : undefined}
                >
                  <span className="stepper-bullet">
                    {done ? <IconCheck size={12} /> : index + 1}
                  </span>
                  {label}
                </span>
                {index < STEPS.length - 1 && <span aria-hidden="true" className="stepper-line" />}
              </li>
            )
          })}
        </ol>

        <div key={step} className="onboarding-card card grid animate-fade-in gap-4">
          {step === 0 && (
            <WizardSection
              title="Rendimiento"
              hint="¿Tu equipo tiene placa de video? Sin GPU el análisis es lento y puede cortar por timeout."
            >
              <PerformanceModePicker
                value={state.performanceMode}
                onChange={(mode) => set('performanceMode', mode)}
              />
            </WizardSection>
          )}

          {step === 1 && (
            <WizardSection
              title="Modelo LLM"
              hint="Solo Ollama local, sin API key. Elegí si el análisis mira también las capturas."
            >
              <div
                className="grid gap-3 md:grid-cols-2"
                role="radiogroup"
                aria-label="modo de análisis"
              >
                <label className={`choice-card ${!analyzeImages ? 'choice-card-selected' : ''}`}>
                  <span className="choice-radio" aria-hidden="true" />
                  <input
                    type="radio"
                    name="onboarding-analysis-mode"
                    checked={!analyzeImages}
                    className="sr-only"
                    onChange={() => set('llmVisionModel', '')}
                  />
                  <span className="grid gap-1">
                    <span className="choice-title">Solo texto</span>
                    <span className="choice-text">Ignora las capturas al analizar. Más rápido.</span>
                    <span className="mono text-2xs" style={{ color: col.fgDim }}>
                      {DEFAULT_OLLAMA_TEXT_MODEL}
                    </span>
                  </span>
                </label>
                <label className={`choice-card ${analyzeImages ? 'choice-card-selected' : ''}`}>
                  <span className="choice-radio" aria-hidden="true" />
                  <input
                    type="radio"
                    name="onboarding-analysis-mode"
                    checked={analyzeImages}
                    className="sr-only"
                    onChange={() => set('llmVisionModel', DEFAULT_OLLAMA_VISION_MODEL)}
                  />
                  <span className="grid gap-1">
                    <span className="choice-title">Texto + capturas</span>
                    <span className="choice-text">Usa visión cuando el bug trae imágenes.</span>
                    <span className="mono text-2xs" style={{ color: col.fgDim }}>
                      {DEFAULT_OLLAMA_TEXT_MODEL} + {DEFAULT_OLLAMA_VISION_MODEL}
                    </span>
                  </span>
                </label>
              </div>
            </WizardSection>
          )}

          {step === 2 && (
            <WizardSection
              title="Acceso a Google Docs"
              hint="Opcional. La sesión del navegador trae texto y capturas de los docs enlazados. Podés saltarlo y hacerlo después."
            >
              {browserAuth?.authenticated ? (
                <span
                  className="inline-flex items-center gap-1.5 text-sm"
                  style={{ color: col.solved }}
                >
                  <IconCheck size={14} />
                  Sesión activa
                </span>
              ) : (
                <button
                  type="button"
                  className="btn-secondary justify-self-start"
                  onClick={connectGoogle}
                  disabled={authLoading}
                >
                  {authLoading ? 'Esperando login…' : 'Conectar con el navegador'}
                </button>
              )}
            </WizardSection>
          )}
        </div>

        <div className="wizard-footer flex items-center justify-between">
          <span className="text-xs" style={{ color: col.fgDim }}>
            Paso {step + 1} de {STEPS.length}
          </span>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                className="btn-secondary btn-lg"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                Atrás
              </button>
            )}
            {isLast ? (
              <button
                type="button"
                className="btn-primary btn-lg"
                onClick={finish}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Empezar'}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary btn-lg"
                onClick={() => setStep((s) => s + 1)}
              >
                Siguiente
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function WizardSection({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <span className="font-bold text-xl">{title}</span>
        <p className="text-sm" style={{ color: col.fgMuted, lineHeight: 1.55 }}>
          {hint}
        </p>
      </div>
      {children}
    </div>
  )
}
