import type React from 'react'
import { useEffect, useState } from 'react'
import type { ExternalAgentRepository } from '../../../../src/shared/contracts'
import type { LogLine } from '../../../App'
import { IconCheck, IconPlus, IconRestore, IconX } from '../../../components/icons'
import { col } from '../../../theme'
import type { TeamAuthStatus } from '../../projects/ui/TeamLogin'
import { DEFAULT_OLLAMA_TEXT_MODEL, DEFAULT_OLLAMA_VISION_MODEL } from './llmOptions'
import PerformanceModePicker, { type PerformanceMode } from './PerformanceModePicker'
import ResetControls from './ResetControls'

// Índice de secciones. Lo renderiza la propia pantalla: con el rail de
// iconos, la navegación global ya no tiene lugar para un índice de página.
export const SETTINGS_SECTIONS = [
  { id: 'settings-team', label: 'Equipo' },
  { id: 'settings-model', label: 'Modelo LLM' },
  { id: 'settings-runtime', label: 'Rendimiento' },
  { id: 'settings-docs', label: 'Acceso a Google Docs' },
  { id: 'settings-agent', label: 'Agente externo' },
  { id: 'settings-cache', label: 'Caché de análisis' },
  { id: 'settings-reset', label: 'Restablecer' },
] as const

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']

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
  onNewProject?: () => void
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

function openCodeErrorStatus(error: unknown): OpenCodeStatus {
  return {
    installed: false,
    hasBigPickle: false,
    model: 'opencode/big-pickle',
    error: error instanceof Error ? error.message : String(error),
  }
}

export default function Settings({ addLog, onTeamStatusChange, onNewProject }: Props) {
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
    setCheckingOpenCode(true)
    window.electronAPI
      .checkOpenCode()
      .then(setOpenCodeStatus)
      .catch((error: unknown) => setOpenCodeStatus(openCodeErrorStatus(error)))
      .finally(() => setCheckingOpenCode(false))
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
      addLog('error', 'configurá el Client ID y Client Secret de Google antes de autenticarte')
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
    const status = await window.electronAPI.checkOpenCode().catch(openCodeErrorStatus)
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
    <div className="settings-page flex h-full min-h-0 flex-col overflow-y-auto">
      {/* Índice de secciones. Vivía en el sidebar; con el rail de iconos pasa a
          la propia pantalla, que es la única que sabe qué secciones tiene. */}
      <nav className="settings-index" aria-label="secciones de configuración">
        {SETTINGS_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className="app-subnav-item"
            onClick={() => {
              document.getElementById(section.id)?.scrollIntoView({
                block: 'start',
                behavior: 'smooth',
              })
            }}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <header className="settings-header page-heading">
        <div className="grid gap-1.5">
          <span className="page-eyebrow">
            <span className="page-eyebrow-dot" aria-hidden="true" />
            Preferencias del producto
          </span>
          <h2 className="page-title">Configuración</h2>
          <p className="page-description">Equipo, modelo, rendimiento y herramientas externas.</p>
        </div>
        <div className="page-actions">
          {saved && (
            <span
              className="inline-flex items-center gap-1.5 text-sm"
              style={{ color: col.solved }}
              role="status"
            >
              <IconCheck size={14} />
              Guardado
            </span>
          )}
          <button type="button" className="btn-primary btn-lg" onClick={save} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </header>

      <div className="settings-grid grid gap-3.5 px-8 pb-8">
        <SettingsSection
          id="settings-team"
          title="Equipo"
          aside={
            <span className="text-xs" style={{ color: col.fgDim }}>
              Supabase · proyecto compartido
            </span>
          }
          badge={
            supabaseStatus?.authenticated ? (
              <span className="badge badge-solved">
                <IconCheck size={11} />
                Conectado
              </span>
            ) : undefined
          }
        >
          <div className="grid gap-3.5 md:grid-cols-2">
            <Field id="settings-supabase-url" label="Supabase URL">
              <input
                id="settings-supabase-url"
                type="text"
                className="input mono"
                placeholder="https://xxxx.supabase.co"
                value={settings.supabaseUrl}
                onChange={update('supabaseUrl')}
              />
            </Field>
            <Field id="settings-supabase-publishable-key" label="Publishable key">
              <input
                id="settings-supabase-publishable-key"
                type="password"
                className="input mono"
                placeholder="sb_publishable_..."
                value={settings.supabasePublishableKey}
                onChange={update('supabasePublishableKey')}
              />
            </Field>
            <Field id="settings-supabase-project-name" label="Proyecto inicial">
              <input
                id="settings-supabase-project-name"
                type="text"
                className="input"
                value={settings.supabaseDefaultProjectName}
                onChange={update('supabaseDefaultProjectName')}
              />
            </Field>
            <Field id="settings-supabase-project-slug" label="Slug">
              <input
                id="settings-supabase-project-slug"
                type="text"
                className="input mono"
                value={settings.supabaseDefaultProjectSlug}
                onChange={update('supabaseDefaultProjectSlug')}
              />
            </Field>
          </div>

          {supabaseStatus?.authenticated ? (
            <div className="inset-block flex-row items-center gap-2.5">
              <span className="project-mark">
                {(supabaseStatus.project?.name ?? 'BL').slice(0, 2).toUpperCase()}
              </span>
              <div className="grid min-w-0 gap-0.5">
                <span className="truncate font-semibold text-sm">
                  {supabaseStatus.project?.name ?? 'proyecto activo'}
                </span>
                <span className="truncate text-2xs" style={{ color: col.fgDim }}>
                  {supabaseStatus.project?.slug ?? '—'} ·{' '}
                  {supabaseStatus.user?.email ?? 'sesión activa'}
                </span>
              </div>
              <div className="ml-auto flex flex-shrink-0 items-center gap-2">
                {onNewProject && (
                  <button type="button" className="btn-secondary" onClick={onNewProject}>
                    <IconPlus size={13} className="button-icon button-icon-plus" />
                    Nuevo proyecto
                  </button>
                )}
                <button type="button" className="btn-danger" onClick={signOutSupabase}>
                  Cerrar sesión
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn-primary justify-self-start"
              onClick={startSupabaseGoogleAuth}
              disabled={
                supabaseAuthLoading || !settings.supabaseUrl || !settings.supabasePublishableKey
              }
            >
              {supabaseAuthLoading ? 'Esperando login…' : 'Conectar con Google'}
            </button>
          )}

          {supabaseStatus?.error && (
            <p className="text-sm" style={{ color: col.critical }}>
              {supabaseStatus.error}
            </p>
          )}
        </SettingsSection>

        <SettingsSection
          id="settings-model"
          title="Modelo LLM"
          aside={
            <span className="text-xs" style={{ color: col.fgDim }}>
              Solo Ollama local · sin API key
            </span>
          }
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
                name="llm-analysis-mode"
                checked={!analyzeImages}
                className="sr-only"
                onChange={() => setSettings((prev) => ({ ...prev, llmVisionModel: '' }))}
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
              <span className="grid gap-1">
                <span className="choice-title">Texto + capturas</span>
                <span className="choice-text">Usa visión cuando el bug trae imágenes.</span>
                <span className="mono text-2xs" style={{ color: col.fgDim }}>
                  {DEFAULT_OLLAMA_TEXT_MODEL} + {DEFAULT_OLLAMA_VISION_MODEL}
                </span>
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" className="btn-secondary" onClick={checkOllama}>
              Verificar Ollama
            </button>
            {ollamaStatus !== null && !ollamaStatus.available && (
              <button type="button" className="btn-primary" onClick={startOllama}>
                Iniciar Ollama
              </button>
            )}
            {ollamaStatus !== null && (
              <span
                className={`badge ${ollamaStatus.available ? 'badge-solved' : 'badge-severity-critical'}`}
              >
                {ollamaStatus.available ? <IconCheck size={11} /> : <IconX size={11} />}
                {ollamaStatus.available ? 'Disponible' : 'No disponible'}
              </span>
            )}
          </div>
        </SettingsSection>

        <SettingsSection
          id="settings-runtime"
          title="Rendimiento"
          description='Sin placa de video el análisis es lento. "Analizar mi equipo" consulta Ollama y recomienda GPU o CPU.'
        >
          <PerformanceModePicker
            value={settings.performanceMode}
            onChange={(mode) => setSettings((prev) => ({ ...prev, performanceMode: mode }))}
          />
        </SettingsSection>

        <div className="grid gap-3.5 xl:grid-cols-2">
          <SettingsSection
            id="settings-docs"
            title="Acceso a Google Docs"
            description="La sesión del navegador trae texto y capturas de los docs enlazados. No requiere permisos de admin."
          >
            <div className="flex flex-wrap items-center gap-2.5">
              {browserAuth?.authenticated ? (
                <>
                  <span className="badge badge-solved">Sesión activa</span>
                  <button type="button" className="btn-secondary" onClick={revokeBrowserAuth}>
                    Reconectar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={startBrowserLogin}
                  disabled={browserAuthLoading}
                >
                  {browserAuthLoading ? 'Esperando login…' : 'Conectar con el navegador'}
                </button>
              )}
            </div>

            <div className="detail-divider" />

            <button
              type="button"
              className="btn-quiet justify-self-start"
              onClick={() => setShowOAuth((value) => !value)}
              aria-expanded={showOAuth}
            >
              <span
                className="caret-down"
                style={{ transform: showOAuth ? 'none' : 'rotate(-90deg)' }}
                aria-hidden="true"
              />
              OAuth avanzado
            </button>

            {showOAuth && (
              <div className="grid gap-3.5">
                <p className="text-xs" style={{ color: col.fgDim }}>
                  Requiere Google Cloud Console con Docs API + Drive API habilitadas.
                </p>
                <Field id="settings-google-client-id" label="Client ID">
                  <input
                    id="settings-google-client-id"
                    type="text"
                    className="input mono"
                    placeholder="1234...apps.googleusercontent.com"
                    value={settings.googleClientId}
                    onChange={update('googleClientId')}
                  />
                </Field>
                <Field id="settings-google-client-secret" label="Client secret">
                  <input
                    id="settings-google-client-secret"
                    type="password"
                    className="input mono"
                    placeholder="GOCSPX-..."
                    value={settings.googleClientSecret}
                    onChange={update('googleClientSecret')}
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-2.5">
                  {googleAuth?.authenticated ? (
                    <>
                      <span className="badge badge-solved">
                        <IconCheck size={11} />
                        OAuth autenticado
                      </span>
                      <button type="button" className="btn-danger" onClick={revokeAuth}>
                        Desconectar
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={startAuth}
                      disabled={authLoading}
                    >
                      {authLoading ? 'Esperando…' : 'Conectar con OAuth'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            id="settings-cache"
            title="Caché de análisis"
            description="Evita re-procesar bugs idénticos con la misma evidencia y modelo."
          >
            <div className="flex flex-wrap items-center gap-3">
              {cacheStats !== null && (
                <span className="text-sm" style={{ color: col.fgBody }}>
                  <span className="font-semibold tabular-nums">{cacheStats.count}</span> análisis ·{' '}
                  <span className="tabular-nums">{cacheStats.sizeKB} KB</span>
                </span>
              )}
              <button
                type="button"
                className="btn-danger ml-auto"
                onClick={handleClearCache}
                disabled={clearingCache || (cacheStats !== null && cacheStats.count === 0)}
              >
                {clearingCache ? 'Limpiando…' : 'Limpiar caché'}
              </button>
            </div>
          </SettingsSection>
        </div>

        <SettingsSection
          id="settings-agent"
          title="Agente externo"
          description="Ejecuta el agente instalado en la terminal del usuario y muestra la salida en el detalle del bug."
        >
          <div className="inset-block">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="grid gap-0.5">
                <span className="font-semibold text-md">OpenCode</span>
                <span className="text-xs" style={{ color: col.fgMuted }}>
                  Modelo requerido: {openCodeStatus?.model ?? 'opencode/big-pickle'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={checkOpenCode}
                  disabled={checkingOpenCode || repairingOpenCode}
                >
                  {checkingOpenCode ? 'Verificando…' : 'Verificar'}
                </button>
                {openCodeReady ? (
                  <span className="badge badge-solved">
                    <IconCheck size={11} />
                    Listo
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={repairOpenCode}
                    disabled={repairingOpenCode || checkingOpenCode}
                  >
                    {repairingOpenCode
                      ? 'Preparando…'
                      : openCodeStatus?.installed
                        ? 'Reparar modelo'
                        : 'Instalar OpenCode'}
                  </button>
                )}
              </div>
            </div>
            {checkingOpenCode ? (
              <div
                className="inline-flex items-center gap-1.5 text-xs"
                role="status"
                aria-live="polite"
                style={{ color: col.fgMuted }}
              >
                <IconRestore size={12} className="animate-spin" />
                Verificando instalación…
              </div>
            ) : (
              openCodeStatus && (
                <div className="mono grid gap-1 text-xs">
                  <span style={{ color: openCodeReady ? col.solved : col.critical }}>
                    {openCodeStatus.installed
                      ? `opencode ${openCodeStatus.version ?? ''} · ${
                          openCodeStatus.hasBigPickle ? 'big-pickle disponible' : 'modelo faltante'
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
                    <span style={{ color: col.critical }}>{openCodeStatus.error}</span>
                  )}
                </div>
              )
            )}
          </div>

          <Field id="settings-external-agent-preset" label="Agente">
            <select
              id="settings-external-agent-preset"
              className="input cursor-pointer"
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
              <option value="">Sin agente configurado</option>
              {EXTERNAL_AGENT_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
              <option value={CUSTOM_EXTERNAL_AGENT_ID}>Personalizado</option>
            </select>
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            {EXTERNAL_AGENT_PRESETS.map((preset) => {
              const selected = settings.externalAgentCommand === preset.command
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`choice-card ${selected ? 'choice-card-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => {
                    setExternalAgentMode(preset.id)
                    setSettings((prev) => ({ ...prev, externalAgentCommand: preset.command }))
                  }}
                >
                  <span className="choice-radio" aria-hidden="true" />
                  <span className="grid min-w-0 gap-1 text-left">
                    <span className="choice-title">{preset.name}</span>
                    <span className="choice-text">{preset.description}</span>
                    <span className="mono truncate text-2xs" style={{ color: col.fgDim }}>
                      {preset.command}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          {externalAgentMode === CUSTOM_EXTERNAL_AGENT_ID && (
            <Field id="settings-external-agent-command" label="Comando personalizado">
              <input
                id="settings-external-agent-command"
                type="text"
                className="input mono"
                placeholder="mi-agente --prompt-file {promptFile}"
                value={settings.externalAgentCommand}
                onChange={update('externalAgentCommand')}
              />
            </Field>
          )}

          <div className="grid gap-2.5">
            <div className="flex items-start justify-between gap-2.5">
              <div className="grid gap-0.5">
                <span className="label mb-0">Repositorios locales</span>
                <p className="text-xs" style={{ color: col.fgMuted }}>
                  Agregá todos los repos que el agente puede consultar y la rama objetivo de cada
                  uno.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary flex-shrink-0"
                onClick={addExternalAgentRepository}
              >
                <IconPlus size={12} className="button-icon button-icon-plus" />
                Repo
              </button>
            </div>

            {settings.externalAgentRepositories.length === 0 ? (
              <button
                type="button"
                className="external-agent-empty-repo"
                onClick={addExternalAgentRepository}
              >
                Agregar primer repositorio
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
                        className="input mono"
                        aria-label={`ruta del repositorio ${index + 1}`}
                        placeholder="/ruta/al/repositorio"
                        value={repo.path}
                        onChange={(event) =>
                          updateExternalAgentRepository(index, 'path', event.target.value)
                        }
                      />
                      <input
                        type="text"
                        className="input mono"
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
                        className="btn-secondary"
                        onClick={() => pickExternalAgentRepository(index)}
                      >
                        Elegir
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => removeExternalAgentRepository(index)}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Field id="settings-external-agent-timeout" label="Timeout">
            <div className="flex items-center gap-2.5">
              <input
                id="settings-external-agent-timeout"
                type="number"
                min={60}
                step={60}
                className="input w-32 tabular-nums"
                value={Math.round(settings.externalAgentTimeoutMs / 1000)}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    externalAgentTimeoutMs: Number(event.target.value) * 1000,
                  }))
                }
              />
              <span className="text-sm" style={{ color: col.fgMuted }}>
                segundos
              </span>
            </div>
          </Field>

          <p className="text-xs" style={{ color: col.fgDim, lineHeight: 1.6 }}>
            Los presets usan {'{promptFile}'} para pasar el bug sin TTY. BugLens ejecuta el agente
            desde el primer repositorio y le informa toda la lista con sus ramas objetivo; no hace
            checkout ni cambia ramas por su cuenta.
          </p>
        </SettingsSection>

        <SettingsSection
          id="settings-reset"
          title="Restablecer"
          description="Acciones destructivas: cada una reinicia la app. No tocan la caché de análisis ni las sesiones de Google."
        >
          <ResetControls addLog={addLog} />
        </SettingsSection>
      </div>
    </div>
  )
}

function SettingsSection({
  id,
  title,
  description,
  badge,
  aside,
  children,
}: {
  id: string
  title: string
  description?: string
  badge?: React.ReactNode
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={id} className="settings-section card grid scroll-mt-6 gap-3.5">
      <header className="flex flex-wrap items-center gap-2.5">
        <h3 className="font-bold text-lg">{title}</h3>
        {badge}
        {aside && <div className="ml-auto">{aside}</div>}
      </header>
      {description && (
        <p className="text-sm" style={{ color: col.fgMuted, lineHeight: 1.55 }}>
          {description}
        </p>
      )}
      {children}
    </section>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  )
}
