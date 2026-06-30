import { useEffect, useState } from 'react'
import { DEFAULT_OLLAMA_TEXT_MODEL, DEFAULT_OLLAMA_VISION_MODEL } from '../llmOptions'
import { alpha, col } from '../theme'
import { BugUnderLensMark } from './decor/BugMotifs'
import { IconCheck } from './icons'
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

const STEPS = ['rendimiento', 'modelo', 'google docs'] as const

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
    <div className="flex h-full items-center justify-center p-6 font-mono">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <BugUnderLensMark
            className="motif-sway mb-2"
            style={{ width: 40, height: 40, color: col.cream }}
          />
          <div className="font-semibold text-sm" style={{ color: col.cream }}>
            bienvenido a buglens
          </div>
          <p className="mt-1 text-xs" style={{ color: col.fgMuted }}>
            configuremos lo importante. todo se puede cambiar después en configuración.
          </p>
        </div>

        {/* Stepper */}
        <ol className="mb-5 flex items-center justify-center gap-2" aria-label="progreso">
          {STEPS.map((label, i) => {
            const done = i < step
            const active = i === step
            return (
              <li
                key={label}
                className="flex items-center gap-1.5 text-2xs"
                aria-current={active ? 'step' : undefined}
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-200"
                  style={{
                    border: `1px solid ${i <= step ? col.cream : alpha(col.border, 0.4)}`,
                    background: done ? alpha(col.cream, 0.12) : 'transparent',
                    color: i <= step ? col.cream : col.fgMuted,
                  }}
                >
                  {done ? <IconCheck size={12} /> : i + 1}
                </span>
                <span style={{ color: active ? col.fg : col.fgMuted }}>{label}</span>
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="ml-1 h-px w-5"
                    style={{ background: alpha(col.border, 0.5) }}
                  />
                )}
              </li>
            )
          })}
        </ol>

        <div key={step} className="card animate-fade-in">
          {step === 0 && (
            <Section
              title="rendimiento"
              hint="¿tu equipo tiene placa de video? sin GPU el análisis es lento y puede cortar por timeout."
            >
              <PerformanceModePicker
                value={state.performanceMode}
                onChange={(m) => set('performanceMode', m)}
              />
            </Section>
          )}

          {step === 1 && (
            <Section title="modelo llm" hint="dónde corre el análisis.">
              <div className="space-y-3">
                <div
                  className="grid gap-2 md:grid-cols-2"
                  role="radiogroup"
                  aria-label="modo de análisis"
                >
                  <label
                    className="cursor-pointer rounded p-2 text-left transition-all"
                    style={{
                      border: `1px solid ${!analyzeImages ? alpha(col.cream, 0.35) : alpha(col.border, 0.22)}`,
                      background: !analyzeImages ? alpha(col.cream, 0.06) : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="onboarding-analysis-mode"
                      checked={!analyzeImages}
                      className="sr-only"
                      onChange={() => set('llmVisionModel', '')}
                    />
                    <span className="block font-medium text-xs" style={{ color: col.fg }}>
                      Solo texto
                    </span>
                    <span className="mt-1 block text-xs" style={{ color: col.fgMuted }}>
                      ignora capturas al analizar
                    </span>
                    <span className="mt-1 block font-mono text-xs" style={{ color: col.border }}>
                      {DEFAULT_OLLAMA_TEXT_MODEL}
                    </span>
                  </label>
                  <label
                    className="cursor-pointer rounded p-2 text-left transition-all"
                    style={{
                      border: `1px solid ${analyzeImages ? alpha(col.cream, 0.35) : alpha(col.border, 0.22)}`,
                      background: analyzeImages ? alpha(col.cream, 0.06) : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="onboarding-analysis-mode"
                      checked={analyzeImages}
                      className="sr-only"
                      onChange={() => set('llmVisionModel', DEFAULT_OLLAMA_VISION_MODEL)}
                    />
                    <span className="block font-medium text-xs" style={{ color: col.fg }}>
                      Texto + capturas
                    </span>
                    <span className="mt-1 block text-xs" style={{ color: col.fgMuted }}>
                      usa visión si el bug trae imágenes
                    </span>
                    <span className="mt-1 block font-mono text-xs" style={{ color: col.border }}>
                      {DEFAULT_OLLAMA_TEXT_MODEL} + {DEFAULT_OLLAMA_VISION_MODEL}
                    </span>
                  </label>
                </div>
              </div>
            </Section>
          )}

          {step === 2 && (
            <Section
              title="acceso a google docs"
              hint="opcional. conecta el login del navegador para traer la evidencia de los docs. podés saltarlo y hacerlo después."
            >
              {browserAuth?.authenticated ? (
                <span
                  className="inline-flex items-center gap-1.5 text-xs"
                  style={{ color: col.green }}
                >
                  <IconCheck size={12} />
                  sesión activa
                </span>
              ) : (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  onClick={connectGoogle}
                  disabled={authLoading}
                >
                  {authLoading ? 'esperando login…' : 'conectar con navegador'}
                </button>
              )}
            </Section>
          )}
        </div>

        {/* Nav */}
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{ visibility: step === 0 ? 'hidden' : 'visible' }}
          >
            atrás
          </button>

          {isLast ? (
            <button type="button" className="btn-primary" onClick={finish} disabled={saving}>
              {saving ? 'guardando…' : 'empezar'}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => setStep((s) => s + 1)}>
              siguiente
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="section-label mb-1">{title}</div>
      <p className="mb-3 text-xs" style={{ color: col.fgMuted }}>
        {hint}
      </p>
      {children}
    </div>
  )
}
