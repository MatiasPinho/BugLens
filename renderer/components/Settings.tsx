import type React from 'react'
import { useEffect, useState } from 'react'
import type { LogLine } from '../App'
import { defaultModelFor, LLM_OPTIONS } from '../llmOptions'
import { alpha, col } from '../theme'
import { IconCheck, IconX } from './icons'
import PerformanceModePicker, { type PerformanceMode } from './PerformanceModePicker'
import ResetControls from './ResetControls'

interface SettingsData {
  googleClientId: string
  googleClientSecret: string
  llmProvider: string
  llmModel: string
  ollamaBaseUrl: string
  performanceMode: PerformanceMode
}

interface Props {
  addLog: (level: LogLine['level'], message: string) => void
}

// Pistas cortas para modelos Ollama conocidos (tradeoff velocidad/calidad).
// Match por nombre exacto o por familia (antes del ':').
const MODEL_HINTS: Record<string, string> = {
  'qwen2.5:7b': 'rápido',
  'qwen2.5:14b': 'mejor calidad, más lento',
  'qwen2.5:32b': 'máxima calidad, pesado',
  'qwen2.5-coder': 'orientado a código',
  'qwen2.5': 'recomendado',
}

export default function Settings({ addLog }: Props) {
  const [settings, setSettings] = useState<SettingsData>({
    googleClientId: '',
    googleClientSecret: '',
    llmProvider: 'ollama',
    llmModel: '',
    ollamaBaseUrl: 'http://localhost:11434',
    performanceMode: 'gpu',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [cacheStats, setCacheStats] = useState<{ count: number; sizeKB: number } | null>(null)
  const [clearingCache, setClearingCache] = useState(false)
  const [googleAuth, setGoogleAuth] = useState<{ authenticated: boolean } | null>(null)
  const [browserAuth, setBrowserAuth] = useState<{ authenticated: boolean } | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [browserAuthLoading, setBrowserAuthLoading] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<{
    available: boolean
    models?: string[]
  } | null>(null)
  const [showOAuth, setShowOAuth] = useState(false)

  useEffect(() => {
    window.electronAPI.getSettings().then((s: SettingsData) => setSettings(s))
    window.electronAPI.getAuthStatus().then(setGoogleAuth)
    window.electronAPI.getBrowserAuthStatus().then(setBrowserAuth)
    window.electronAPI.checkOllama().then(setOllamaStatus)
    window.electronAPI.cacheStats().then(setCacheStats)
  }, [])

  const handleClearCache = async () => {
    setClearingCache(true)
    await window.electronAPI.clearCache()
    const stats = await window.electronAPI.cacheStats()
    setCacheStats(stats)
    setClearingCache(false)
    addLog('info', 'caché de análisis eliminada')
  }

  const update = (key: keyof SettingsData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings((prev) => ({ ...prev, [key]: e.target.value }))

  const save = async () => {
    setSaving(true)
    await window.electronAPI.saveSettings(settings as unknown as Record<string, string>)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const startAuth = async () => {
    if (!settings.googleClientId || !settings.googleClientSecret) {
      alert('Configurá el Client ID y Client Secret de Google antes de autenticarte.')
      return
    }
    await window.electronAPI.saveSettings({
      googleClientId: settings.googleClientId,
      googleClientSecret: settings.googleClientSecret,
    })
    setAuthLoading(true)
    const result = await window.electronAPI.startAuth()
    setAuthLoading(false)
    if (result.ok) {
      setGoogleAuth({ authenticated: true })
      addLog('info', 'google oauth completado')
    } else {
      addLog('error', `error en google oauth: ${result.error}`)
    }
  }

  const revokeAuth = async () => {
    await window.electronAPI.revokeAuth()
    setGoogleAuth({ authenticated: false })
    addLog('info', 'sesión de google revocada')
  }

  const startBrowserLogin = async () => {
    setBrowserAuthLoading(true)
    addLog('info', 'abriendo ventana de login...')
    const result = await window.electronAPI.startBrowserLogin()
    setBrowserAuthLoading(false)
    if (result.ok) {
      setBrowserAuth({ authenticated: true })
      addLog('info', '✓ sesión del navegador guardada')
    } else {
      addLog('error', `error en login: ${result.error}`)
    }
  }

  const revokeBrowserAuth = async () => {
    await window.electronAPI.revokeBrowserAuth()
    setBrowserAuth({ authenticated: false })
    addLog('info', 'sesión del navegador eliminada')
  }

  const checkOllama = async () => {
    const status = await window.electronAPI.checkOllama()
    setOllamaStatus(status)
  }

  const startOllama = async () => {
    addLog('info', 'iniciando ollama...')
    const result = await window.electronAPI.startOllama()
    addLog(result.ok ? 'info' : 'error', result.message)
    if (result.ok) {
      const status = await window.electronAPI.checkOllama()
      setOllamaStatus(status)
    }
  }

  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto p-6 font-mono">
      <div className="mb-6 flex items-center gap-2">
        <div className="font-mono text-xs uppercase tracking-wider" style={{ color: col.border }}>
          ~/buglens/config
        </div>
      </div>

      {/* ── Google Docs ── */}
      <Section title="acceso a google docs">
        <div className="mb-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs" style={{ color: col.fg }}>
              login con navegador
            </span>
            <span
              className="rounded px-1.5 py-0.5 font-mono text-xs"
              style={{ color: col.fgMuted, border: `1px solid ${alpha(col.fgMuted, 0.3)}` }}
            >
              recomendado
            </span>
          </div>
          <p className="mb-3 text-xs" style={{ color: col.fgMuted }}>
            Abre una ventana de Chromium. Las cookies se guardan localmente. No requiere admin.
          </p>

          {browserAuth?.authenticated ? (
            <div className="flex items-center gap-3">
              <span
                className="inline-flex items-center gap-1.5 text-xs"
                style={{ color: col.fgDim }}
              >
                <IconCheck size={12} />
                sesión activa
              </span>
              <button type="button" className="btn-danger text-xs" onClick={revokeBrowserAuth}>
                cerrar sesión
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={startBrowserLogin}
              disabled={browserAuthLoading}
            >
              {browserAuthLoading ? 'esperando login...' : 'conectar con navegador'}
            </button>
          )}
        </div>

        <div className="pt-3" style={{ borderTop: `1px solid ${alpha(col.border, 0.18)}` }}>
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1.5 text-xs transition-colors"
            style={{ color: col.muted }}
            onMouseEnter={(e) => (e.currentTarget.style.color = col.fgMuted)}
            onMouseLeave={(e) => (e.currentTarget.style.color = col.muted)}
            onClick={() => setShowOAuth((v) => !v)}
          >
            <svg
              aria-hidden="true"
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="currentColor"
              style={{
                transform: showOAuth ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s',
              }}
            >
              <path d="M2 1l4 3-4 3V1z" />
            </svg>
            oauth avanzado
          </button>

          {showOAuth && (
            <div className="mt-3 space-y-3">
              <p className="text-xs" style={{ color: col.border }}>
                Requiere Google Cloud Console con Docs API + Drive API habilitadas.
              </p>
              <div>
                <label className="label" htmlFor="settings-google-client-id">
                  client id
                </label>
                <input
                  id="settings-google-client-id"
                  type="text"
                  className="input text-xs"
                  placeholder="1234...apps.googleusercontent.com"
                  value={settings.googleClientId}
                  onChange={update('googleClientId')}
                />
              </div>
              <div>
                <label className="label" htmlFor="settings-google-client-secret">
                  client secret
                </label>
                <input
                  id="settings-google-client-secret"
                  type="password"
                  className="input text-xs"
                  placeholder="GOCSPX-..."
                  value={settings.googleClientSecret}
                  onChange={update('googleClientSecret')}
                />
              </div>
              <div className="flex items-center gap-3">
                {googleAuth?.authenticated ? (
                  <>
                    <span
                      className="inline-flex items-center gap-1.5 text-xs"
                      style={{ color: col.fgDim }}
                    >
                      <IconCheck size={12} />
                      oauth autenticado
                    </span>
                    <button type="button" className="btn-danger text-xs" onClick={revokeAuth}>
                      desconectar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={startAuth}
                    disabled={authLoading}
                  >
                    {authLoading ? 'esperando...' : 'conectar con oauth'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ── LLM ── */}
      <Section title="modelo llm">
        <div className="mb-4 space-y-1.5">
          {LLM_OPTIONS.map((opt) => {
            const isSelected = settings.llmProvider === opt.id
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
                  name="llmProvider"
                  value={opt.id}
                  checked={isSelected}
                  onChange={() =>
                    setSettings((prev) => ({
                      ...prev,
                      llmProvider: opt.id,
                      // Resetear el modelo al default del proveedor: si no, arrastraba el
                      // modelo del proveedor anterior (ej: gemini → ollama mostraba el de gemini).
                      llmModel: defaultModelFor(opt.id),
                    }))
                  }
                  className="sr-only"
                />
                <div className="flex-1">
                  <div
                    className="font-medium text-xs"
                    style={{ color: isSelected ? col.fg : col.fgMuted }}
                  >
                    {opt.name}
                  </div>
                  <div className="mt-0.5 text-xs" style={{ color: col.fgMuted }}>
                    {opt.description}
                  </div>
                </div>
              </label>
            )
          })}
        </div>

        {settings.llmProvider === 'ollama' && (
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor="settings-ollama-base-url">
                base url
              </label>
              <input
                id="settings-ollama-base-url"
                type="text"
                className="input text-xs"
                value={settings.ollamaBaseUrl}
                onChange={update('ollamaBaseUrl')}
              />
            </div>
            <div>
              <label className="label" htmlFor="settings-ollama-model">
                modelo
              </label>
              <input
                id="settings-ollama-model"
                type="text"
                className="input text-xs"
                placeholder="qwen2.5:7b, qwen2.5:14b..."
                value={settings.llmModel}
                onChange={update('llmModel')}
              />
              {ollamaStatus?.models && ollamaStatus.models.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ollamaStatus.models.map((m, i) => {
                    const isSelected = settings.llmModel === m
                    const hint = MODEL_HINTS[m] ?? MODEL_HINTS[m.split(':')[0]]
                    return (
                      <button
                        type="button"
                        key={i}
                        className="cursor-pointer rounded px-2 py-1 text-xs transition-all"
                        style={{
                          border: `1px solid ${isSelected ? alpha(col.cream, 0.35) : alpha(col.border, 0.25)}`,
                          background: isSelected ? alpha(col.cream, 0.08) : 'transparent',
                          color: isSelected ? col.fg : col.fgMuted,
                        }}
                        onClick={() => setSettings((prev) => ({ ...prev, llmModel: m }))}
                      >
                        {m}
                        {hint ? <span style={{ color: col.border }}> · {hint}</span> : null}
                      </button>
                    )
                  })}
                </div>
              )}
              <div className="mt-1.5 text-xs" style={{ color: col.border }}>
                modelos más grandes razonan mejor (ej. detectar bugs ya resueltos) pero son más
                lentos y piden más VRAM/RAM.
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={checkOllama}>
                verificar ollama
              </button>
              {ollamaStatus !== null && !ollamaStatus.available && (
                <button type="button" className="btn-primary text-xs" onClick={startOllama}>
                  iniciar ollama
                </button>
              )}
              {ollamaStatus !== null && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs"
                  style={{ color: ollamaStatus.available ? col.fgDim : col.red }}
                >
                  {ollamaStatus.available ? <IconCheck size={12} /> : <IconX size={12} />}
                  {ollamaStatus.available ? 'disponible' : 'no disponible'}
                </span>
              )}
            </div>
          </div>
        )}

        {settings.llmProvider !== 'ollama' && (
          <div>
            <label className="label" htmlFor="settings-cloud-model">
              modelo (opcional)
            </label>
            <input
              id="settings-cloud-model"
              type="text"
              className="input text-xs"
              placeholder="ej: gpt-4o, claude-opus-4-7, gemini-1.5-pro"
              value={settings.llmModel}
              onChange={update('llmModel')}
            />
            <div className="mt-1 text-xs" style={{ color: col.border }}>
              configurá la api key en el archivo .env
            </div>
          </div>
        )}
      </Section>

      {/* ── Rendimiento ── */}
      <Section title="rendimiento">
        <p className="mb-3 text-xs" style={{ color: col.fgMuted }}>
          Sin placa de video el análisis es lento y puede cortar por timeout. "Analizar mi equipo"
          le pregunta a Ollama si el modelo corre en GPU o CPU.
        </p>
        <PerformanceModePicker
          value={settings.performanceMode}
          onChange={(m) => setSettings((prev) => ({ ...prev, performanceMode: m }))}
        />
      </Section>

      {/* ── Cache ── */}
      <Section title="caché de análisis">
        <p className="mb-3 text-xs" style={{ color: col.fgMuted }}>
          Los análisis se guardan para evitar re-procesar bugs idénticos.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {cacheStats !== null && (
            <div className="flex items-center gap-3 font-mono text-xs">
              <span style={{ color: col.fgDim }}>{cacheStats.count} análisis</span>
              <span style={{ color: col.border }}>·</span>
              <span style={{ color: col.fgMuted }}>{cacheStats.sizeKB} KB</span>
            </div>
          )}
          <button
            type="button"
            className="btn-danger text-xs"
            onClick={handleClearCache}
            disabled={clearingCache || (cacheStats !== null && cacheStats.count === 0)}
          >
            {clearingCache ? 'limpiando...' : 'limpiar caché'}
          </button>
        </div>
      </Section>

      {/* ── Reset ── */}
      <Section title="restablecer">
        <p className="mb-3 text-xs" style={{ color: col.fgMuted }}>
          Acciones que borran datos y reinician la app. No afectan la caché de análisis ni las
          sesiones de Google.
        </p>
        <ResetControls addLog={addLog} />
      </Section>

      {/* ── Save ── */}
      <div className="mt-4 mb-8 flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'guardando...' : 'guardar'}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: col.fgDim }}>
            <IconCheck size={12} />
            guardado
          </span>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card mb-3">
      <div className="section-label mb-3">{title}</div>
      {children}
    </div>
  )
}
