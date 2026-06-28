import type React from 'react'
import { useEffect, useState } from 'react'
import type { LogLine } from '../App'
import type { ExternalAgentRepository } from '../../src/types/index'
import { defaultModelFor, LLM_OPTIONS } from '../llmOptions'
import { alpha, col } from '../theme'
import { IconCheck, IconX } from './icons'
import PerformanceModePicker, { type PerformanceMode } from './PerformanceModePicker'
import ResetControls from './ResetControls'
import type { TeamAuthStatus } from './TeamLogin'

interface SettingsData {
  googleClientId: string
  googleClientSecret: string
  llmProvider: string
  llmModel: string
  ollamaBaseUrl: string
  performanceMode: PerformanceMode
  supabaseUrl: string
  supabasePublishableKey: string
  supabaseDefaultProjectSlug: string
  supabaseDefaultProjectName: string
  supabaseActiveProjectId: string
  externalAgentCommand: string
  externalAgentTimeoutMs: number
  externalAgentWorkingDirectory: string
  externalAgentRepositories: ExternalAgentRepository[]
}

interface Props {
  addLog: (level: LogLine['level'], message: string) => void
  onTeamStatusChange?: (status: TeamAuthStatus) => void
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

interface ExternalAgentPreset {
  id: string
  name: string
  command: string
  description: string
  legacyCommands?: string[]
}

const EXTERNAL_AGENT_PRESETS: ExternalAgentPreset[] = [
  {
    id: 'codex',
    name: 'Codex CLI',
    command: 'codex exec "$(cat {promptFile})"',
    description: 'usa la sesión local de Codex',
  },
  {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude -p "$(cat {promptFile})"',
    description: 'usa Claude Code en modo print',
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    command: 'gemini -p "$(cat {promptFile})"',
    description: 'usa Gemini desde terminal',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    command: 'opencode run "$(cat {promptFile})"',
    legacyCommands: ['cd ~ && opencode run "$(cat {promptFile})"'],
    description: 'usa OpenCode Zen desde tu configuración global',
  },
]

const CUSTOM_EXTERNAL_AGENT_ID = 'custom'

function canonicalExternalAgentCommand(command: string): string {
  const preset = EXTERNAL_AGENT_PRESETS.find((item) => item.legacyCommands?.includes(command))
  return preset?.command ?? command
}

function externalAgentModeFor(command: string): string {
  const canonicalCommand = canonicalExternalAgentCommand(command)
  if (!canonicalCommand) return ''
  return (
    EXTERNAL_AGENT_PRESETS.find((preset) => preset.command === canonicalCommand)?.id ??
    CUSTOM_EXTERNAL_AGENT_ID
  )
}

function normalizeExternalAgentRepositories(
  settings: Partial<SettingsData>,
): ExternalAgentRepository[] {
  const repositories = Array.isArray(settings.externalAgentRepositories)
    ? settings.externalAgentRepositories
        .map((repo) => ({
          path: repo.path?.trim() ?? '',
          branch: repo.branch?.trim() ?? '',
        }))
        .filter((repo) => repo.path)
    : []
  if (repositories.length > 0) return repositories
  const legacyPath = settings.externalAgentWorkingDirectory?.trim()
  return legacyPath ? [{ path: legacyPath, branch: '' }] : []
}

export default function Settings({ addLog, onTeamStatusChange }: Props) {
  const [settings, setSettings] = useState<SettingsData>({
    googleClientId: '',
    googleClientSecret: '',
    llmProvider: 'ollama',
    llmModel: '',
    ollamaBaseUrl: 'http://localhost:11434',
    performanceMode: 'gpu',
    supabaseUrl: '',
    supabasePublishableKey: '',
    supabaseDefaultProjectSlug: 'buglens-default',
    supabaseDefaultProjectName: 'buglens',
    supabaseActiveProjectId: '',
    externalAgentCommand: '',
    externalAgentTimeoutMs: 20 * 60 * 1000,
    externalAgentWorkingDirectory: '',
    externalAgentRepositories: [],
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [cacheStats, setCacheStats] = useState<{ count: number; sizeKB: number } | null>(null)
  const [clearingCache, setClearingCache] = useState(false)
  const [googleAuth, setGoogleAuth] = useState<{ authenticated: boolean } | null>(null)
  const [browserAuth, setBrowserAuth] = useState<{ authenticated: boolean } | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [browserAuthLoading, setBrowserAuthLoading] = useState(false)
  const [supabaseStatus, setSupabaseStatus] = useState<TeamAuthStatus | null>(null)
  const [supabaseAuthLoading, setSupabaseAuthLoading] = useState(false)
  const [externalAgentMode, setExternalAgentMode] = useState('')
  const [ollamaStatus, setOllamaStatus] = useState<{
    available: boolean
    models?: string[]
  } | null>(null)
  const [showOAuth, setShowOAuth] = useState(false)

  useEffect(() => {
    window.electronAPI.getSettings().then((s: SettingsData) => {
      const externalAgentCommand = canonicalExternalAgentCommand(s.externalAgentCommand)
      const externalAgentRepositories = normalizeExternalAgentRepositories(s)
      setSettings({
        ...s,
        externalAgentCommand,
        externalAgentRepositories,
        externalAgentWorkingDirectory: externalAgentRepositories[0]?.path ?? '',
      })
      setExternalAgentMode(externalAgentModeFor(externalAgentCommand))
    })
    window.electronAPI.getAuthStatus().then(setGoogleAuth)
    window.electronAPI.getBrowserAuthStatus().then(setBrowserAuth)
    window.electronAPI.getSupabaseStatus().then(setSupabaseStatus)
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
    const externalAgentRepositories = normalizeExternalAgentRepositories(settings)
    await window.electronAPI.saveSettings({
      ...settings,
      externalAgentRepositories,
      externalAgentWorkingDirectory: externalAgentRepositories[0]?.path ?? '',
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addExternalAgentRepository = () => {
    setSettings((prev) => ({
      ...prev,
      externalAgentRepositories: [...prev.externalAgentRepositories, { path: '', branch: '' }],
    }))
  }

  const pickExternalAgentRepository = async (index: number) => {
    const directory = await window.electronAPI.pickDirectory()
    if (!directory) return
    setSettings((prev) => {
      const repositories =
        prev.externalAgentRepositories.length > 0
          ? prev.externalAgentRepositories
          : [{ path: '', branch: '' }]
      const externalAgentRepositories = repositories.map((repo, repoIndex) =>
        repoIndex === index ? { ...repo, path: directory } : repo,
      )
      return {
        ...prev,
        externalAgentRepositories,
        externalAgentWorkingDirectory: externalAgentRepositories[0]?.path ?? '',
      }
    })
  }

  const updateExternalAgentRepository = (
    index: number,
    key: keyof ExternalAgentRepository,
    value: string,
  ) => {
    setSettings((prev) => {
      const externalAgentRepositories = prev.externalAgentRepositories.map((repo, repoIndex) =>
        repoIndex === index ? { ...repo, [key]: value } : repo,
      )
      return {
        ...prev,
        externalAgentRepositories,
        externalAgentWorkingDirectory: externalAgentRepositories[0]?.path ?? '',
      }
    })
  }

  const removeExternalAgentRepository = (index: number) => {
    setSettings((prev) => {
      const externalAgentRepositories = prev.externalAgentRepositories.filter(
        (_repo, repoIndex) => repoIndex !== index,
      )
      return {
        ...prev,
        externalAgentRepositories,
        externalAgentWorkingDirectory: externalAgentRepositories[0]?.path ?? '',
      }
    })
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

  const startSupabaseGoogleAuth = async () => {
    await window.electronAPI.saveSettings({
      supabaseUrl: settings.supabaseUrl,
      supabasePublishableKey: settings.supabasePublishableKey,
      supabaseDefaultProjectSlug: settings.supabaseDefaultProjectSlug,
      supabaseDefaultProjectName: settings.supabaseDefaultProjectName,
    })
    setSupabaseAuthLoading(true)
    addLog('info', 'abriendo login de supabase...')
    const status = await window.electronAPI.startSupabaseGoogleAuth()
    setSupabaseAuthLoading(false)
    setSupabaseStatus(status)
    onTeamStatusChange?.(status)
    if (status.authenticated) {
      addLog('info', `supabase conectado: ${status.user?.email ?? status.user?.id}`)
    } else {
      addLog('error', `error en supabase: ${status.error ?? 'login no completado'}`)
    }
  }

  const signOutSupabase = async () => {
    await window.electronAPI.signOutSupabase()
    const status = await window.electronAPI.getSupabaseStatus()
    setSupabaseStatus(status)
    onTeamStatusChange?.(status)
    addLog('info', 'sesión de supabase cerrada')
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

      {/* ── Equipo / Supabase ── */}
      <Section title="equipo">
        <p className="mb-3 text-xs" style={{ color: col.fgMuted }}>
          Sincronización compartida con Supabase. Usa Google Auth y un proyecto compartido por
          defecto.
        </p>

        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="settings-supabase-url">
              supabase url
            </label>
            <input
              id="settings-supabase-url"
              type="text"
              className="input text-xs"
              placeholder="https://xxxx.supabase.co"
              value={settings.supabaseUrl}
              onChange={update('supabaseUrl')}
            />
          </div>

          <div>
            <label className="label" htmlFor="settings-supabase-publishable-key">
              publishable key
            </label>
            <input
              id="settings-supabase-publishable-key"
              type="password"
              className="input text-xs"
              placeholder="sb_publishable_..."
              value={settings.supabasePublishableKey}
              onChange={update('supabasePublishableKey')}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="settings-supabase-project-name">
                proyecto inicial
              </label>
              <input
                id="settings-supabase-project-name"
                type="text"
                className="input text-xs"
                value={settings.supabaseDefaultProjectName}
                onChange={update('supabaseDefaultProjectName')}
              />
            </div>
            <div>
              <label className="label" htmlFor="settings-supabase-project-slug">
                slug
              </label>
              <input
                id="settings-supabase-project-slug"
                type="text"
                className="input text-xs"
                value={settings.supabaseDefaultProjectSlug}
                onChange={update('supabaseDefaultProjectSlug')}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {supabaseStatus?.authenticated ? (
              <>
                <span
                  className="inline-flex items-center gap-1.5 text-xs"
                  style={{ color: col.fgDim }}
                >
                  <IconCheck size={12} />
                  {supabaseStatus.user?.email ?? 'conectado'}
                </span>
                {supabaseStatus.project && (
                  <span className="text-xs" style={{ color: col.fgMuted }}>
                    proyecto: {supabaseStatus.project.name}
                  </span>
                )}
                <button type="button" className="btn-danger text-xs" onClick={signOutSupabase}>
                  cerrar sesión
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={startSupabaseGoogleAuth}
                disabled={
                  supabaseAuthLoading || !settings.supabaseUrl || !settings.supabasePublishableKey
                }
              >
                {supabaseAuthLoading ? 'esperando login...' : 'conectar con google'}
              </button>
            )}
          </div>

          {supabaseStatus?.error && (
            <div className="text-xs" style={{ color: col.red }}>
              {supabaseStatus.error}
            </div>
          )}
        </div>
      </Section>

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

      {/* ── Agente externo ── */}
      <Section title="agente externo">
        <p className="mb-3 text-xs" style={{ color: col.fgMuted }}>
          BugLens ejecuta el agente instalado en la terminal del usuario y muestra la salida en el
          detalle del bug.
        </p>
        <div className="space-y-3">
          <label className="label" htmlFor="settings-external-agent-preset">
            agente
          </label>
          <select
            id="settings-external-agent-preset"
            className="input text-xs"
            value={externalAgentMode}
            onChange={(event) => {
              setExternalAgentMode(event.target.value)
              const preset = EXTERNAL_AGENT_PRESETS.find((item) => item.id === event.target.value)
              if (preset) {
                setSettings((prev) => ({ ...prev, externalAgentCommand: preset.command }))
                return
              }
              if (event.target.value === '') {
                setSettings((prev) => ({ ...prev, externalAgentCommand: '' }))
              }
            }}
          >
            <option value="">sin agente configurado</option>
            {EXTERNAL_AGENT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name} · {preset.command}
              </option>
            ))}
            <option value={CUSTOM_EXTERNAL_AGENT_ID}>personalizado</option>
          </select>

          <div className="grid grid-cols-2 gap-2">
            {EXTERNAL_AGENT_PRESETS.map((preset) => {
              const selected = settings.externalAgentCommand === preset.command
              return (
                <button
                  key={preset.id}
                  type="button"
                  className="rounded p-2 text-left transition-all"
                  style={{
                    border: `1px solid ${selected ? alpha(col.cream, 0.35) : alpha(col.border, 0.22)}`,
                    background: selected ? alpha(col.cream, 0.06) : 'transparent',
                  }}
                  onClick={() => {
                    setExternalAgentMode(preset.id)
                    setSettings((prev) => ({ ...prev, externalAgentCommand: preset.command }))
                  }}
                >
                  <span className="block font-medium text-xs" style={{ color: col.fg }}>
                    {preset.name}
                  </span>
                  <span className="mt-1 block text-xs" style={{ color: col.fgMuted }}>
                    {preset.description}
                  </span>
                  <span
                    className="mt-1 block truncate font-mono text-xs"
                    style={{ color: col.border }}
                  >
                    {preset.command}
                  </span>
                </button>
              )
            })}
          </div>

          {externalAgentMode === CUSTOM_EXTERNAL_AGENT_ID && (
            <div>
              <label className="label" htmlFor="settings-external-agent-command">
                comando personalizado
              </label>
              <input
                id="settings-external-agent-command"
                type="text"
                className="input text-xs"
                placeholder="mi-agente --prompt-file {promptFile}"
                value={settings.externalAgentCommand}
                onChange={update('externalAgentCommand')}
              />
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <div className="label mb-0">repositorios locales</div>
                <p className="mt-1 text-xs" style={{ color: col.fgMuted }}>
                  Agregá todos los repos que el agente puede consultar y la rama objetivo de cada
                  uno.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary flex-shrink-0 text-xs"
                onClick={addExternalAgentRepository}
              >
                + repo
              </button>
            </div>

            {settings.externalAgentRepositories.length === 0 ? (
              <button
                type="button"
                className="external-agent-empty-repo"
                onClick={addExternalAgentRepository}
              >
                agregar primer repositorio
              </button>
            ) : (
              <div className="external-agent-repo-list">
                {settings.externalAgentRepositories.map((repo, index) => (
                  <div key={index} className="external-agent-repo-row">
                    <div className="external-agent-repo-index">
                      {index === 0 ? 'principal' : `repo ${index + 1}`}
                    </div>
                    <div className="grid min-w-0 gap-2 md:grid-cols-[minmax(0,1fr)_10rem]">
                      <input
                        type="text"
                        className="input text-xs"
                        aria-label={`ruta del repositorio ${index + 1}`}
                        placeholder="/ruta/al/repositorio"
                        value={repo.path}
                        onChange={(event) =>
                          updateExternalAgentRepository(index, 'path', event.target.value)
                        }
                      />
                      <input
                        type="text"
                        className="input text-xs"
                        aria-label={`rama del repositorio ${index + 1}`}
                        placeholder="rama"
                        value={repo.branch}
                        onChange={(event) =>
                          updateExternalAgentRepository(index, 'branch', event.target.value)
                        }
                      />
                    </div>
                    <div className="external-agent-repo-actions">
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => pickExternalAgentRepository(index)}
                      >
                        elegir
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => removeExternalAgentRepository(index)}
                      >
                        quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label" htmlFor="settings-external-agent-timeout">
              timeout
            </label>
            <div className="flex items-center gap-2">
              <input
                id="settings-external-agent-timeout"
                type="number"
                min={60}
                step={60}
                className="input text-xs"
                value={Math.round(settings.externalAgentTimeoutMs / 1000)}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    externalAgentTimeoutMs: Number(event.target.value) * 1000,
                  }))
                }
              />
              <span className="font-mono text-xs" style={{ color: col.fgMuted }}>
                segundos
              </span>
            </div>
          </div>

          <div className="text-xs" style={{ color: col.border }}>
            Los presets usan {'{promptFile}'} para pasar el bug sin TTY. BugLens ejecuta el agente
            desde el primer repositorio y le informa toda la lista con sus ramas objetivo; no hace
            checkout ni cambia ramas por su cuenta. Credenciales, modelo y límites quedan a cargo
            del agente local.
          </div>
        </div>
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
