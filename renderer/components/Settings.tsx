import type React from 'react'
import { useEffect, useState } from 'react'
import type { ExternalAgentRepository } from '../../src/types/index'
import type { LogLine } from '../App'
import { DEFAULT_OLLAMA_TEXT_MODEL, DEFAULT_OLLAMA_VISION_MODEL } from '../llmOptions'
import { alpha, col } from '../theme'
import { IconCheck, IconX } from './icons'
import PerformanceModePicker, { type PerformanceMode } from './PerformanceModePicker'
import type { TeamAuthStatus } from './TeamLogin'

interface SettingsData {
  googleClientId: string
  googleClientSecret: string
  llmProvider: string
  llmModel: string
  llmVisionModel: string
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

interface ExternalAgentPreset {
  id: string
  name: string
  command: string
  description: string
  legacyCommands?: string[]
}

interface OpenCodeStatus {
  installed: boolean
  version?: string
  hasBigPickle: boolean
  model: string
  commandPath?: string
  pathAdded?: string[]
  installedPackage?: boolean
  output?: string
  error?: string
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
    command:
      'opencode run --model opencode/big-pickle "Analizá el bug adjunto siguiendo las instrucciones del archivo." --file {promptFile}',
    legacyCommands: [
      'cd ~ && opencode run "$(cat {promptFile})"',
      'opencode run "$(cat {promptFile})"',
      'opencode run --file {promptFile} "Analizá el bug adjunto siguiendo las instrucciones del archivo."',
      'opencode run --model openrouter/nvidia/nemotron-3-ultra-550b-a55b:free --file {promptFile} "Analizá el bug adjunto siguiendo las instrucciones del archivo."',
      'opencode run --model openrouter/nvidia/nemotron-3-ultra-550b-a55b:free "Analizá el bug adjunto siguiendo las instrucciones del archivo." --file {promptFile}',
      'opencode run --model nvidia/nemotron-3-ultra-550b-a55b:free "Analizá el bug adjunto siguiendo las instrucciones del archivo." --file {promptFile}',
      'opencode run --model nvidia/nemotron-3-ultra-550b-a55b "Analizá el bug adjunto siguiendo las instrucciones del archivo." --file {promptFile}',
    ],
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
    llmVisionModel: DEFAULT_OLLAMA_VISION_MODEL,
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
  const [openCodeStatus, setOpenCodeStatus] = useState<OpenCodeStatus | null>(null)
  const [checkingOpenCode, setCheckingOpenCode] = useState(false)
  const [repairingOpenCode, setRepairingOpenCode] = useState(false)
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
  const analyzeImages = settings.llmVisionModel.trim().length > 0
  const openCodeReady = Boolean(openCodeStatus?.installed && openCodeStatus.hasBigPickle)

  useEffect(() => {
    window.electronAPI.getSettings().then((s: SettingsData) => {
      const externalAgentCommand = canonicalExternalAgentCommand(s.externalAgentCommand)
      const externalAgentRepositories = normalizeExternalAgentRepositories(s)
      setSettings({
        ...s,
        llmProvider: 'ollama',
        llmModel: DEFAULT_OLLAMA_TEXT_MODEL,
        llmVisionModel: s.llmVisionModel ?? DEFAULT_OLLAMA_VISION_MODEL,
        ollamaBaseUrl: 'http://localhost:11434',
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
    window.electronAPI.checkOpenCode().then(setOpenCodeStatus)
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
      llmProvider: 'ollama',
      llmModel: DEFAULT_OLLAMA_TEXT_MODEL,
      ollamaBaseUrl: 'http://localhost:11434',
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

  const checkOpenCode = async () => {
    setCheckingOpenCode(true)
    const status = await window.electronAPI.checkOpenCode()
    setOpenCodeStatus(status)
    setCheckingOpenCode(false)
    addLog(
      status.installed && status.hasBigPickle ? 'info' : 'warn',
      status.installed
        ? `opencode ${status.version ?? ''} · ${status.hasBigPickle ? 'big-pickle disponible' : 'big-pickle no disponible'}`
        : `opencode no disponible: ${status.error ?? 'sin detalle'}`,
    )
  }

  const repairOpenCode = async () => {
    setRepairingOpenCode(true)
    addLog('info', 'preparando opencode...')
    const status = await window.electronAPI.repairOpenCode()
    setOpenCodeStatus(status)
    setRepairingOpenCode(false)
    addLog(
      status.ok ? 'info' : 'error',
      status.ok
        ? `opencode listo: ${status.version ?? 'versión detectada'} · ${status.model}`
        : `no se pudo preparar opencode: ${status.error ?? 'sin detalle'}`,
    )
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-4 font-mono">
      <div className="mx-auto grid max-w-6xl gap-3">
        <div className="panel-card p-4">
          <div className="section-label mb-2">~/buglens/configuración</div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-semibold text-sm" style={{ color: col.fg }}>
                Configuración
              </h1>
              <p className="mt-1 max-w-2xl text-xs" style={{ color: col.fgMuted }}>
                Configurá el proyecto compartido, la evidencia de Google Docs, el modelo local y el
                agente externo sin salir del flujo principal.
              </p>
            </div>
            <span className="font-mono text-xs" style={{ color: col.border }}>
              ollama · supabase · docs
            </span>
            <div className="flex items-center gap-3">
              <button type="button" className="btn-primary" onClick={save} disabled={saving}>
                {saving ? 'guardando...' : 'guardar cambios'}
              </button>
              {saved && (
                <span
                  className="inline-flex items-center gap-1.5 text-xs"
                  style={{ color: col.fgDim }}
                >
                  <IconCheck size={12} />
                  guardado
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
          <div className="grid content-start gap-3">
            <Section
              id="settings-team"
              title="equipo"
              description="Sincronización compartida con Supabase. Usa Google Auth y un proyecto compartido por defecto."
            >
              <div className="grid gap-3 md:grid-cols-2">
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

              <div className="mt-3 flex flex-wrap items-center gap-3">
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
                      supabaseAuthLoading ||
                      !settings.supabaseUrl ||
                      !settings.supabasePublishableKey
                    }
                  >
                    {supabaseAuthLoading ? 'esperando login...' : 'conectar con google'}
                  </button>
                )}
              </div>

              {supabaseStatus?.error && (
                <div className="mt-3 text-xs" style={{ color: col.red }}>
                  {supabaseStatus.error}
                </div>
              )}
            </Section>

            <Section
              id="settings-docs"
              title="acceso a google docs"
              description="Trae texto y capturas desde los documentos adjuntos a los bugs."
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-xs" style={{ color: col.fg }}>
                      login con navegador
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 font-mono text-xs"
                      style={{
                        color: col.fgMuted,
                        border: `1px solid ${alpha(col.fgMuted, 0.3)}`,
                      }}
                    >
                      recomendado
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: col.fgMuted }}>
                    Abre una ventana de Chromium. Las cookies se guardan localmente. No requiere
                    admin.
                  </p>
                </div>

                {browserAuth?.authenticated ? (
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs"
                      style={{ color: col.fgDim }}
                    >
                      <IconCheck size={12} />
                      sesión activa
                    </span>
                    <button
                      type="button"
                      className="btn-danger text-xs"
                      onClick={revokeBrowserAuth}
                    >
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

              <div
                className="mt-4 pt-3"
                style={{ borderTop: `1px solid ${alpha(col.border, 0.18)}` }}
              >
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
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <p className="text-xs md:col-span-2" style={{ color: col.border }}>
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
                    <div className="flex items-center gap-3 md:col-span-2">
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

            <Section
              id="settings-agent"
              title="agente externo"
              description="Ejecuta el agente instalado en la terminal del usuario y muestra la salida en el detalle del bug."
            >
              <div className="grid gap-3">
                <div
                  className="rounded p-3"
                  style={{ border: `1px solid ${alpha(col.border, 0.22)}` }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-xs" style={{ color: col.fg }}>
                        OpenCode
                      </div>
                      <p className="mt-1 text-xs" style={{ color: col.fgMuted }}>
                        Modelo requerido: {openCodeStatus?.model ?? 'opencode/big-pickle'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={checkOpenCode}
                        disabled={checkingOpenCode || repairingOpenCode}
                      >
                        {checkingOpenCode ? 'verificando...' : 'verificar'}
                      </button>
                      {openCodeReady ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs"
                          style={{ color: col.fgDim }}
                        >
                          <IconCheck size={12} />
                          listo
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary text-xs"
                          onClick={repairOpenCode}
                          disabled={repairingOpenCode || checkingOpenCode}
                        >
                          {repairingOpenCode
                            ? 'preparando...'
                            : openCodeStatus?.installed
                              ? 'reparar modelo'
                              : 'instalar opencode'}
                        </button>
                      )}
                    </div>
                  </div>
                  {openCodeStatus && (
                    <div className="mt-2 grid gap-1 font-mono text-xs">
                      <span
                        style={{
                          color:
                            openCodeStatus.installed && openCodeStatus.hasBigPickle
                              ? col.fgDim
                              : col.red,
                        }}
                      >
                        {openCodeStatus.installed
                          ? `opencode ${openCodeStatus.version ?? ''} · ${
                              openCodeStatus.hasBigPickle
                                ? 'big-pickle disponible'
                                : 'modelo faltante'
                            }`
                          : 'opencode no instalado'}
                      </span>
                      {openCodeStatus.commandPath && (
                        <span style={{ color: col.fgMuted }}>{openCodeStatus.commandPath}</span>
                      )}
                      {openCodeStatus.pathAdded && openCodeStatus.pathAdded.length > 0 && (
                        <span style={{ color: col.fgMuted }}>
                          PATH reparado: {openCodeStatus.pathAdded.join('; ')}
                        </span>
                      )}
                      {openCodeStatus.error && (
                        <span style={{ color: col.red }}>{openCodeStatus.error}</span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="label" htmlFor="settings-external-agent-preset">
                    agente
                  </label>
                  <select
                    id="settings-external-agent-preset"
                    className="input text-xs"
                    value={externalAgentMode}
                    onChange={(event) => {
                      setExternalAgentMode(event.target.value)
                      const preset = EXTERNAL_AGENT_PRESETS.find(
                        (item) => item.id === event.target.value,
                      )
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
                </div>

                <div className="grid gap-2 md:grid-cols-2">
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
                          setSettings((prev) => ({
                            ...prev,
                            externalAgentCommand: preset.command,
                          }))
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
                        Agregá todos los repos que el agente puede consultar y la rama objetivo de
                        cada uno.
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
                  Los presets usan {'{promptFile}'} para pasar el bug sin TTY. BugLens ejecuta el
                  agente desde el primer repositorio y le informa toda la lista con sus ramas
                  objetivo; no hace checkout ni cambia ramas por su cuenta.
                </div>
              </div>
            </Section>
          </div>

          <div className="grid content-start gap-3">
            <Section
              id="settings-model"
              title="modelo llm"
              description="BugLens usa Ollama local. Elegí si el análisis ignora o lee capturas."
            >
              <div className="space-y-3">
                <div className="grid gap-2" role="radiogroup" aria-label="modo de análisis">
                  <label
                    className="choice-card cursor-pointer rounded p-2 text-left transition-all"
                    style={{
                      border: `1px solid ${!analyzeImages ? alpha(col.cream, 0.35) : alpha(col.border, 0.22)}`,
                      background: !analyzeImages ? alpha(col.cream, 0.06) : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="llm-analysis-mode"
                      checked={!analyzeImages}
                      className="sr-only"
                      onChange={() => setSettings((prev) => ({ ...prev, llmVisionModel: '' }))}
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
                    className="choice-card cursor-pointer rounded p-2 text-left transition-all"
                    style={{
                      border: `1px solid ${analyzeImages ? alpha(col.cream, 0.35) : alpha(col.border, 0.22)}`,
                      background: analyzeImages ? alpha(col.cream, 0.06) : 'transparent',
                    }}
                  >
                    <input
                      type="radio"
                      name="llm-analysis-mode"
                      checked={analyzeImages}
                      className="sr-only"
                      onChange={() =>
                        setSettings((prev) => ({
                          ...prev,
                          llmVisionModel: DEFAULT_OLLAMA_VISION_MODEL,
                        }))
                      }
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
            </Section>

            <Section
              id="settings-runtime"
              title="rendimiento"
              description='Sin placa de video el análisis es lento. "Analizar mi equipo" consulta Ollama y recomienda GPU o CPU.'
            >
              <PerformanceModePicker
                value={settings.performanceMode}
                onChange={(m) => setSettings((prev) => ({ ...prev, performanceMode: m }))}
              />
            </Section>

            <Section
              id="settings-cache"
              title="caché de análisis"
              description="Evita re-procesar bugs idénticos con la misma evidencia y modelo."
            >
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
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="panel-card scroll-mt-4 p-4">
      <div className="section-label mb-3">{title}</div>
      {description && (
        <p className="mb-3 text-xs" style={{ color: col.fgMuted }}>
          {description}
        </p>
      )}
      {children}
    </section>
  )
}
