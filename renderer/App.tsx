import React, { useCallback, useEffect, useState } from 'react'
import type { ManualBugFields } from '../src/features/analyze-bugs/application/manualBugBuilder'
import { bugRecordKey } from '../src/features/bug-workflow/domain/bugStatusKey'
import type {
  AnalyzedBug,
  BugComment,
  BugResultEvent,
  BugStatus,
  CommentVote,
  ExternalAgentResult,
  IPCEvent,
  LogEvent,
  ProgressEvent,
  TeamMember,
} from '../src/shared/contracts'
import AppRail, { type AppRailItem } from './components/AppRail'
import AppTopbar from './components/AppTopbar'
import {
  IconBug,
  IconFolder,
  IconHelp,
  IconPlus,
  IconSettings,
  IconUpload,
  IconX,
} from './components/icons'
import { LoadingOverlay } from './components/Loading'
import AnalysisProgressScreen from './features/analyze-bugs/ui/AnalysisProgressScreen'
import ManualBugForm from './features/analyze-bugs/ui/ManualBugForm'
import UploadBugsScreen from './features/analyze-bugs/ui/UploadBugsScreen'
import type { BugDetailAgentInfo } from './features/bug-workflow/ui/BugDetail'
import BugsScreen from './features/bug-workflow/ui/BugsScreen'
import NewProjectModal from './features/projects/ui/NewProjectModal'
import ProjectSwitcher from './features/projects/ui/ProjectSwitcher'
import ProjectsScreen from './features/projects/ui/ProjectsScreen'
import TeamLogin, { type TeamAuthStatus } from './features/projects/ui/TeamLogin'
import Onboarding from './features/settings/ui/Onboarding'
import Settings from './features/settings/ui/Settings'
import { col } from './theme'

type Route = 'bugs' | 'upload' | 'projects' | 'settings'
type Phase = 'idle' | 'analyzing' | 'done'

export interface LogLine {
  id: number
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: string
}

let logCounter = 0

function MissingElectronApi() {
  return (
    <div className="grid h-screen place-items-center p-6">
      <div className="card max-w-md">
        <div className="font-bold text-lg">BugLens necesita Electron</div>
        <p className="mt-2 text-sm" style={{ color: col.fgMuted }}>
          Esta pantalla requiere el preload de Electron para comunicarse con archivos, Supabase y el
          proceso principal. Abrí la app con <code className="code-inline">npm run dev</code> o
          desde el ejecutable.
        </p>
      </div>
    </div>
  )
}

export default function App() {
  if (typeof window !== 'undefined' && !window.electronAPI) {
    return <MissingElectronApi />
  }

  return <ElectronApp />
}

function ElectronApp() {
  const [route, setRoute] = useState<Route>('bugs')
  const [phase, setPhase] = useState<Phase>('idle')
  const [excelPath, setExcelPath] = useState<string | null>(null)
  const [results, setResults] = useState<AnalyzedBug[]>([])
  const [logs, setLogs] = useState<LogLine[]>([])
  const [progress, setProgress] = useState<{
    current: number
    total: number
    message: string
    phase?: import('../src/shared/contracts').AnalysisPhase
  }>({ current: 0, total: 0, message: '' })
  const [showManualForm, setShowManualForm] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  // Primer arranque: null = cargando settings; false = mostrar wizard; true = app normal.
  const [onboarded, setOnboarded] = useState<boolean | null>(null)
  const [engineLabel, setEngineLabel] = useState('')
  const [agentInfo, setAgentInfo] = useState<BugDetailAgentInfo | undefined>()
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null)
  const [teamStatus, setTeamStatus] = useState<TeamAuthStatus | null>(null)
  const [teamAuthLoading, setTeamAuthLoading] = useState(false)
  const [projectBusy, setProjectBusy] = useState(false)
  const [requestLoading, setRequestLoading] = useState<{ title: string; detail?: string } | null>(
    null,
  )
  const [focusedBugKey, setFocusedBugKey] = useState<string | null>(null)
  const [detailBugKey, setDetailBugKey] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [projectMembers, setProjectMembers] = useState<TeamMember[]>([])
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)
  const remoteReloadTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeProjectId = teamStatus?.project?.id ?? null
  const detailBug =
    results.find((bug) => bugRecordKey(bug.enriched.raw) === detailBugKey) ?? null

  const addLog = useCallback((level: LogLine['level'], message: string, timestamp?: string) => {
    setLogs((prev) => [
      ...prev.slice(-499),
      { id: logCounter++, level, message, timestamp: timestamp ?? new Date().toISOString() },
    ])
  }, [])

  useEffect(() => {
    const api = window.electronAPI

    const cleanProgress = api.onProgress((ev: IPCEvent) => {
      if (ev.type !== 'progress') return
      const e = ev as ProgressEvent
      setProgress({ current: e.current, total: e.total, message: e.message, phase: e.phase })
      // El progreso 'done' llega ordenado DESPUÉS del último 'bug-result' (mismo
      // canal), así que marca la fase final de forma confiable — sin depender de
      // la carrera entre el evento y la respuesta del invoke (clave en el flujo
      // manual, que no emite 'analysis-complete').
      if (e.phase === 'done') setPhase('done')
    })

    const cleanLog = api.onLog((ev: IPCEvent) => {
      if (ev.type !== 'log') return
      const e = ev as LogEvent
      addLog(e.level, e.message, e.timestamp)
    })

    const cleanBugResult = api.onBugResult((ev: IPCEvent) => {
      if (ev.type !== 'bug-result') return
      const e = ev as BugResultEvent
      setResults((prev) => {
        const resultKey = bugRecordKey(e.result.enriched.raw)
        const exists = prev.some((bug) => bugRecordKey(bug.enriched.raw) === resultKey)
        return exists ? prev : [...prev, e.result]
      })
      setPhase('analyzing')
    })

    const cleanComplete = api.onAnalysisComplete((ev: IPCEvent) => {
      if (ev.type !== 'complete') return
      setResults(ev.results as AnalyzedBug[])
      setPhase('done')
      addLog('info', `análisis completo: ${(ev.results as AnalyzedBug[]).length} bugs procesados`)
    })

    return () => {
      cleanProgress()
      cleanLog()
      cleanBugResult()
      cleanComplete()
    }
  }, [addLog])

  // Settings que la UI del shell necesita: wizard de primer arranque, layout de
  // bugs, etiqueta del motor y agente configurado (para el rail del detalle).
  const loadShellSettings = useCallback(async () => {
    const settings = await window.electronAPI.getSettings()
    setOnboarded(Boolean(settings.onboarded))
    setEngineLabel(
      `${settings.llmModel} en ${settings.performanceMode === 'cpu' ? 'CPU' : 'GPU'} · ${
        settings.performanceMode === 'cpu' ? 'de a un bug' : 'varios bugs en paralelo'
      }`,
    )
    const repository = settings.externalAgentRepositories?.[0]
    setAgentInfo(
      settings.externalAgentCommand
        ? {
            command: settings.externalAgentCommand,
            repository: repository?.path,
            branch: repository?.branch,
          }
        : undefined,
    )
  }, [])

  useEffect(() => {
    void loadShellSettings()
    window.electronAPI.getSupabaseStatus().then(setTeamStatus)
    window.electronAPI.checkOllama().then((status) => setOllamaAvailable(status.available))
  }, [loadShellSettings])

  // Miembros del proyecto activo: son las personas asignables y las que aparecen
  // en la actividad. Se recargan al cambiar de proyecto.
  useEffect(() => {
    if (!activeProjectId) {
      setProjectMembers([])
      return
    }
    window.electronAPI.listProjectMembers().then((result) => {
      setProjectMembers(result.ok && result.members ? result.members : [])
    })
  }, [activeProjectId])

  const handleTeamLogin = useCallback(async () => {
    setTeamAuthLoading(true)
    setRequestLoading({
      title: 'esperando login',
      detail: 'Completá Google Auth en el navegador.',
    })
    try {
      const status = await window.electronAPI.startSupabaseGoogleAuth()
      setTeamStatus(status)
      if (status.authenticated)
        addLog('info', `equipo conectado: ${status.user?.email ?? status.user?.id}`)
      else addLog('error', `error en equipo: ${status.error ?? 'login no completado'}`)
    } finally {
      setTeamAuthLoading(false)
      setRequestLoading(null)
    }
  }, [addLog])

  const handleSignOut = useCallback(async () => {
    await window.electronAPI.signOutSupabase()
    const status = await window.electronAPI.getSupabaseStatus()
    setTeamStatus(status)
    setResults([])
    setDetailBugKey(null)
    addLog('info', 'sesión del equipo cerrada')
  }, [addLog])

  const handleSelectProject = useCallback(
    async (projectId: string) => {
      if (!projectId || projectId === activeProjectId) return
      setProjectBusy(true)
      setRequestLoading({
        title: 'cambiando proyecto',
        detail: 'Sincronizando bugs, estados y realtime.',
      })
      try {
        const status = await window.electronAPI.selectSupabaseProject(projectId)
        setTeamStatus(status)
        setResults([])
        setDetailBugKey(null)
        setFocusedBugKey(null)
        if (status.project) addLog('info', `proyecto activo: ${status.project.name}`)
        else addLog('error', `error seleccionando proyecto: ${status.error ?? 'sin detalle'}`)
      } finally {
        setProjectBusy(false)
        setRequestLoading(null)
      }
    },
    [activeProjectId, addLog],
  )

  const handleCreateProject = useCallback(
    async (name: string, slug: string) => {
      setProjectBusy(true)
      setRequestLoading({ title: 'creando proyecto', detail: `${name} / ${slug}` })
      try {
        const status = await window.electronAPI.createSupabaseProject(name, slug)
        setTeamStatus(status)
        setResults([])
        setDetailBugKey(null)
        setFocusedBugKey(null)
        if (status.project) addLog('info', `proyecto creado: ${status.project.name}`)
        else addLog('error', `error creando proyecto: ${status.error ?? 'sin detalle'}`)
      } finally {
        setProjectBusy(false)
        setRequestLoading(null)
      }
    },
    [addLog],
  )

  const loadRemoteResults = useCallback(
    async (logRestore = false, showLoading = false) => {
      if (showLoading) {
        setRequestLoading({
          title: 'cargando proyecto',
          detail: 'Leyendo bugs analizados desde Supabase.',
        })
      }
      try {
        const remote = await window.electronAPI.loadRemoteBugs()
        if (remote.ok) {
          setResults(remote.results)
          setExcelPath(null)
          setPhase(remote.results.length > 0 ? 'done' : 'idle')
          if (logRestore && remote.results.length > 0) {
            addLog('info', `bugs restaurados desde Supabase: ${remote.results.length}`)
          }
        } else {
          addLog('error', `error restaurando Supabase: ${remote.error ?? 'sin detalle'}`)
        }
      } finally {
        if (showLoading) setRequestLoading(null)
      }
    },
    [addLog],
  )

  // Restaurar la tabla desde Supabase al abrir. La sesión local dejó de ser la
  // fuente de verdad: si el equipo está conectado, lo que se ve sale del proyecto remoto.
  useEffect(() => {
    if (!teamStatus?.authenticated || !activeProjectId) return
    void loadRemoteResults(true, true)
  }, [activeProjectId, loadRemoteResults, teamStatus?.authenticated])

  useEffect(() => {
    if (!teamStatus?.authenticated || !activeProjectId) return

    window.electronAPI.watchRemoteBugs().then((result) => {
      if (!result.ok) addLog('warn', `realtime no disponible: ${result.error ?? 'sin detalle'}`)
    })

    const cleanRemoteChanges = window.electronAPI.onRemoteBugsChanged(() => {
      if (remoteReloadTimerRef.current) clearTimeout(remoteReloadTimerRef.current)
      remoteReloadTimerRef.current = setTimeout(() => {
        if (phase !== 'analyzing') void loadRemoteResults(false)
      }, 500)
    })

    return () => {
      cleanRemoteChanges()
      if (remoteReloadTimerRef.current) clearTimeout(remoteReloadTimerRef.current)
    }
  }, [activeProjectId, addLog, loadRemoteResults, phase, teamStatus?.authenticated])

  const handleAnalyze = useCallback(async () => {
    if (!excelPath) return
    setPhase('analyzing')
    setResults([])
    setLogs([])
    setProgress({ current: 0, total: 0, message: 'iniciando…' })
    addLog('info', 'iniciando análisis…')

    const result = await window.electronAPI.runAnalysis(excelPath)
    if (!result.ok) {
      addLog('error', `error: ${result.error}`)
      setPhase('idle')
    } else {
      await loadRemoteResults(false)
      setRoute('bugs')
    }
  }, [excelPath, addLog, loadRemoteResults])

  // Analizar un bug cargado a mano: lo agrega al listado (no resetea).
  const handleAddManualBug = useCallback(
    async (fields: ManualBugFields) => {
      setPhase('analyzing')
      setProgress({ current: 0, total: 1, message: 'analizando bug manual…' })
      addLog('info', 'analizando bug manual…')

      try {
        const result = await window.electronAPI.analyzeManualBug(fields)
        if (result.ok) {
          await loadRemoteResults(false)
          setPhase('done')
          setRoute('bugs')
          return
        }
        addLog('error', `error: ${result.error}`)
      } catch (err) {
        // Ej: handler IPC no registrado (main sin reiniciar tras cambios).
        addLog('error', `error: ${err instanceof Error ? err.message : String(err)}`)
      }
      // Si ya había bugs en la tabla, no volver a idle (no perder la vista).
      setResults((prev) => {
        setPhase(prev.length > 0 ? 'done' : 'idle')
        return prev
      })
    },
    [addLog, loadRemoteResults],
  )

  const handleExport = useCallback(async () => {
    if (results.length === 0) return
    // Sin Excel original (o con bugs manuales mezclados) no se puede anclar por
    // fila: se exporta una hoja autocontenida desde cero.
    const hasManualBug = results.some((r) => r.enriched.raw.id.startsWith('manual-'))
    const result =
      !excelPath || hasManualBug
        ? await window.electronAPI.exportBugs(results)
        : await window.electronAPI.exportExcel(excelPath, results)
    if (result.ok) addLog('info', `exportado: ${result.filePath}`)
    else if (result.error) addLog('error', `error al exportar: ${result.error}`)
  }, [excelPath, results, addLog])

  // Cambiar el estado de un bug: update optimista en la UI + persistir en Supabase.
  const handleSetStatus = useCallback(
    async (bug: AnalyzedBug, status: BugStatus) => {
      const key = bugRecordKey(bug.enriched.raw)
      setResults((prev) =>
        prev.map((item) =>
          bugRecordKey(item.enriched.raw) === key ? { ...item, status } : item,
        ),
      )
      const result = await window.electronAPI.setBugStatus(bug, status)
      if (!result.ok) {
        addLog('error', `error guardando estado: ${result.error}`)
        setResults((prev) =>
          prev.map((item) =>
            bugRecordKey(item.enriched.raw) === key ? { ...item, status: bug.status } : item,
          ),
        )
      }
    },
    [addLog],
  )

  // Borrar un bug: soft-delete remoto en Supabase + update optimista del listado.
  const handleDeleteBug = useCallback(
    async (bug: AnalyzedBug) => {
      const key = bugRecordKey(bug.enriched.raw)
      const previousResults = results
      setResults((prev) => prev.filter((item) => bugRecordKey(item.enriched.raw) !== key))
      setDetailBugKey((current) => (current === key ? null : current))
      setFocusedBugKey((current) => (current === key ? null : current))

      const result = await window.electronAPI.deleteBug(bug)
      if (result.ok) addLog('info', `bug borrado: ${bug.enriched.raw.title}`)
      else {
        setResults(previousResults)
        addLog('error', `error borrando bug: ${result.error ?? 'sin detalle'}`)
      }
    },
    [addLog, results],
  )

  const handleAnalyzeExternalAgent = useCallback(
    async (bug: AnalyzedBug): Promise<ExternalAgentResult> => {
      const result = await window.electronAPI.analyzeWithExternalAgent(bug)
      setResults((prev) =>
        prev.map((item) =>
          bugRecordKey(item.enriched.raw) === bugRecordKey(bug.enriched.raw)
            ? {
                ...item,
                analysis: {
                  ...item.analysis,
                  externalAgent: result,
                  externalAgentHistory: [
                    result,
                    ...(item.analysis.externalAgentHistory ?? []).filter(
                      (entry) =>
                        entry.createdAt !== result.createdAt || entry.output !== result.output,
                    ),
                  ],
                },
              }
            : item,
        ),
      )
      return result
    },
    [],
  )

  const handleAddBugComment = useCallback(
    async (bug: AnalyzedBug, body: string, parentId: string | null = null): Promise<BugComment> => {
      const result = await window.electronAPI.addBugComment(bug, body, parentId)
      if (!result.ok || !result.comment) {
        throw new Error(result.error ?? 'No se pudo guardar el comentario.')
      }
      const savedComment = result.comment
      setResults((prev) =>
        prev.map((item) =>
          bugRecordKey(item.enriched.raw) === bugRecordKey(bug.enriched.raw)
            ? { ...item, comments: [savedComment, ...(item.comments ?? [])] }
            : item,
        ),
      )
      addLog('info', `nota guardada: ${bug.enriched.raw.title}`)
      return result.comment
    },
    [addLog],
  )

  const handleSetAssignees = useCallback(
    async (bug: AnalyzedBug, userIds: string[]) => {
      const result = await window.electronAPI.setBugAssignees(bug, userIds)
      if (!result.ok) {
        addLog('error', `no se pudieron asignar responsables: ${result.error ?? 'error remoto'}`)
        return
      }
      // El servidor es la fuente de verdad de los responsables (valida que sean
      // miembros del proyecto), así que se recarga en vez de adivinar el estado.
      await loadRemoteResults()
    },
    [addLog, loadRemoteResults],
  )

  const handleSetDueDate = useCallback(
    async (bug: AnalyzedBug, dueDate: string | null) => {
      const result = await window.electronAPI.setBugDueDate(bug, dueDate)
      if (!result.ok) {
        addLog('error', `no se pudo cambiar la fecha límite: ${result.error ?? 'error remoto'}`)
        return
      }
      setResults((prev) =>
        prev.map((item) =>
          bugRecordKey(item.enriched.raw) === bugRecordKey(bug.enriched.raw)
            ? { ...item, dueDate }
            : item,
        ),
      )
    },
    [addLog],
  )

  const handleVoteComment = useCallback(
    async (commentId: string, value: CommentVote) => {
      const result = await window.electronAPI.voteBugComment(commentId, value)
      if (!result.ok || !result.totals) {
        addLog('error', `no se pudo votar: ${result.error ?? 'error remoto'}`)
        return
      }
      // El servidor devuelve los totales ya recalculados: se aplican tal cual en
      // vez de sumar de a uno, que se desincronizaría con los votos de otros.
      const totals = result.totals
      setResults((prev) =>
        prev.map((item) => ({
          ...item,
          comments: item.comments?.map((comment) =>
            comment.id === commentId
              ? {
                  ...comment,
                  upvotes: totals.upvotes,
                  downvotes: totals.downvotes,
                  myVote: totals.myVote,
                }
              : comment,
          ),
        })),
      )
    },
    [addLog],
  )

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  // j/k: siguiente/anterior bug · Enter: abrir detalle · Esc: volver · /: buscar
  // 1-5: marcar estado · ?: ayuda
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      const isTyping =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
      if (isTyping && e.key !== 'Escape') return
      if (route !== 'bugs') return

      switch (e.key) {
        case '?':
          if (e.shiftKey || target.tagName !== 'BODY') return
          e.preventDefault()
          setShowHelp((v) => !v)
          break
        case '/':
          if (results.length === 0) return
          e.preventDefault()
          searchInputRef.current?.focus()
          break
        case 'Escape':
          if (showHelp) {
            setShowHelp(false)
            break
          }
          if (detailBugKey) {
            setDetailBugKey(null)
            break
          }
          if (isTyping) (target as HTMLInputElement).blur()
          break
        case 'j': {
          if (results.length === 0) return
          e.preventDefault()
          const index = results.findIndex(
            (bug) => bugRecordKey(bug.enriched.raw) === focusedBugKey,
          )
          const next = results[Math.min(index + 1, results.length - 1)] ?? results[0]
          const nextKey = bugRecordKey(next.enriched.raw)
          setFocusedBugKey(nextKey)
          if (detailBugKey) setDetailBugKey(nextKey)
          break
        }
        case 'k': {
          if (results.length === 0) return
          e.preventDefault()
          const index = results.findIndex(
            (bug) => bugRecordKey(bug.enriched.raw) === focusedBugKey,
          )
          const previous = results[Math.max(index - 1, 0)] ?? results[0]
          const previousKey = bugRecordKey(previous.enriched.raw)
          setFocusedBugKey(previousKey)
          if (detailBugKey) setDetailBugKey(previousKey)
          break
        }
        case 'Enter': {
          if (!focusedBugKey) return
          e.preventDefault()
          setDetailBugKey((current) => (current === focusedBugKey ? null : focusedBugKey))
          break
        }
        // 1-5: marcar estado del bug enfocado, sin abrirlo.
        case '1':
        case '2':
        case '3':
        case '4':
        case '5': {
          if (!focusedBugKey) return
          const bug = results.find(
            (item) => bugRecordKey(item.enriched.raw) === focusedBugKey,
          )
          if (!bug) return
          const statusByKey: Record<string, BugStatus> = {
            '1': 'nuevo',
            '2': 'en_progreso',
            '3': 'solucionado',
            '4': 'cerrado',
            '5': 'no_replicado',
          }
          e.preventDefault()
          void handleSetStatus(bug, statusByKey[e.key])
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [route, results, focusedBugKey, detailBugKey, showHelp, handleSetStatus])

  // Primer arranque: mientras carga no parpadeamos nada; si falta onboarding, wizard.
  if (onboarded === null) {
    return (
      <div
        className="window-drag-surface relative h-screen"
        style={{ background: col.canvas }}
      />
    )
  }
  if (!onboarded) {
    return (
      <div className="relative h-screen" style={{ background: col.canvas }}>
        <Onboarding
          onDone={() => {
            setOnboarded(true)
            void loadShellSettings()
          }}
        />
      </div>
    )
  }

  if (!teamStatus?.authenticated) {
    return (
      <div className="relative h-screen">
        <TeamLogin status={teamStatus} loading={teamAuthLoading} onLogin={handleTeamLogin} />
        <LoadingOverlay
          visible={Boolean(requestLoading)}
          title={requestLoading?.title ?? ''}
          detail={requestLoading?.detail}
        />
      </div>
    )
  }

  const navItems: AppRailItem<Route>[] = [
    { key: 'bugs', label: 'Bugs', count: results.length, icon: <IconBug size={18} /> },
    { key: 'upload', label: 'Cargar bugs', icon: <IconUpload size={18} /> },
    {
      key: 'projects',
      label: 'Proyectos',
      count: teamStatus.projects?.length,
      icon: <IconFolder size={18} />,
    },
  ]

  // Configuración va al pie del rail, separada de los destinos de trabajo.
  const railFooterItems: AppRailItem<Route>[] = [
    { key: 'settings', label: 'Configuración', icon: <IconSettings size={18} /> },
  ]

  const projects = teamStatus.projects ?? (teamStatus.project ? [teamStatus.project] : [])

  const routeLabel: Record<Route, string> = {
    bugs: 'Bugs',
    upload: 'Cargar bugs',
    projects: 'Proyectos',
    settings: 'Configuración',
  }

  // La miga final es el bug abierto cuando hay detalle; si no, la sección.
  const breadcrumb = [routeLabel[route], ...(detailBug ? [detailBug.enriched.raw.title] : [])]

  const showBugs = phase !== 'analyzing' && route === 'bugs' && results.length > 0

  // Las acciones de trabajo viven en el topbar: ya no hay banda de encabezado
  // que cruce la pantalla.
  const topbar = (
    <AppTopbar
      breadcrumb={breadcrumb}
      projectSlot={
        <ProjectSwitcher
          activeProject={teamStatus.project}
          projects={projects}
          busy={projectBusy || phase === 'analyzing'}
          onSelect={(projectId) => void handleSelectProject(projectId)}
          onCreate={(name, slug) => void handleCreateProject(name, slug)}
        />
      }
      statusSlot={
        <span
          className={`badge ${ollamaAvailable === false ? 'badge-severity-critical' : 'badge-accent'}`}
          title="modelo local de análisis"
          role="status"
        >
          <span className="dot" aria-hidden="true" />
          {ollamaAvailable === false ? 'Ollama no disponible' : 'Ollama local'}
        </span>
      }
      actions={
        showBugs ? (
          <>
            <button
              type="button"
              className="btn-secondary btn-lg"
              onClick={() => setShowManualForm(true)}
            >
              <IconPlus size={14} className="button-icon button-icon-plus" />
              Cargar bug manual
            </button>
            <button type="button" className="btn-secondary btn-lg" onClick={handleExport}>
              Exportar Excel
            </button>
          </>
        ) : undefined
      }
      asideActions={
        showBugs ? (
          <button type="button" className="btn-primary btn-lg" onClick={() => setRoute('upload')}>
            Analizar bugs
          </button>
        ) : undefined
      }
      members={projectMembers}
      user={{
        id: teamStatus.user?.id,
        email: teamStatus.user?.email,
        provider: 'Google Auth',
      }}
      onSignOut={() => void handleSignOut()}
    />
  )

  return (
    <div className="app-shell relative">
      <AppRail
        items={navItems}
        footerItems={railFooterItems}
        active={route}
        onSelect={(next) => {
          setRoute(next)
          setDetailBugKey(null)
        }}
        actions={
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="app-rail-item"
            title="atajos de teclado (?)"
            aria-label="atajos de teclado"
          >
            <IconHelp size={18} />
          </button>
        }
      />

      {showBugs ? (
        <BugsScreen
          topbar={topbar}
          results={results}
          project={
            teamStatus.project
              ? {
                  name: teamStatus.project.name,
                  slug: teamStatus.project.slug,
                  bugCount: results.length,
                }
              : undefined
          }
          agent={agentInfo}
          members={projectMembers}
          searchInputRef={searchInputRef}
          focusedKey={focusedBugKey}
          onFocus={setFocusedBugKey}
          onSetStatus={(bug, status) => void handleSetStatus(bug, status)}
          onSetAssignees={(bug, userIds) => void handleSetAssignees(bug, userIds)}
          onSetDueDate={(bug, dueDate) => void handleSetDueDate(bug, dueDate)}
          onAddComment={handleAddBugComment}
          onVoteComment={(commentId, value) => void handleVoteComment(commentId, value)}
          onDelete={(bug) => void handleDeleteBug(bug)}
          onAnalyzeExternalAgent={handleAnalyzeExternalAgent}
        />
      ) : (
        <div className="app-content">
          {topbar}
          <main className="app-main min-h-0 flex-1 overflow-hidden">
            {phase === 'analyzing' ? (
              <AnalysisProgressScreen
                current={progress.current}
                total={progress.total}
                message={progress.message}
                phase={progress.phase}
                logs={logs}
                engineLabel={engineLabel}
              />
            ) : route === 'settings' ? (
              <Settings
                addLog={addLog}
                onTeamStatusChange={setTeamStatus}
                onOllamaAvailabilityChange={setOllamaAvailable}
                onNewProject={() => setRoute('projects')}
              />
            ) : route === 'projects' ? (
              <ProjectsScreen
                projects={projects}
                activeProjectId={activeProjectId ?? undefined}
                activeProjectBugCount={results.length}
                busy={projectBusy}
                onSelect={(projectId) => void handleSelectProject(projectId)}
                onCreate={() => setShowNewProject(true)}
              />
            ) : route === 'upload' ? (
              <UploadBugsScreen
                excelPath={excelPath}
                onFileSelected={setExcelPath}
                onManualBug={() => setShowManualForm(true)}
                onAnalyze={() => void handleAnalyze()}
              />
            ) : (
              <UploadBugsScreen
                excelPath={excelPath}
                onFileSelected={setExcelPath}
                onManualBug={() => setShowManualForm(true)}
                onAnalyze={() => void handleAnalyze()}
              />
            )}
          </main>
        </div>
      )}

      <LoadingOverlay
        visible={Boolean(requestLoading)}
        title={requestLoading?.title ?? ''}
        detail={requestLoading?.detail}
      />

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showManualForm && (
        <ManualBugForm
          onSubmit={(fields) => void handleAddManualBug(fields)}
          onClose={() => setShowManualForm(false)}
        />
      )}
      <NewProjectModal
        open={showNewProject}
        busy={projectBusy}
        onClose={() => setShowNewProject(false)}
        onCreate={(name, slug) => void handleCreateProject(name, slug)}
      />
    </div>
  )
}

// ─── Help modal ────────────────────────────────────────────────────────────────
// Cheatsheet de atajos. Se abre con `?` y cierra con Esc o click afuera.

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* backdrop: botón real → click/Enter/Space cierra y es accesible por teclado */}
      <button
        type="button"
        aria-label="cerrar ayuda"
        className="modal-backdrop"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="atajos de teclado"
        className="modal-shell animate-fade-in"
        style={{ maxWidth: '26rem' }}
      >
        <div className="modal-header">
          <h2 className="modal-title">Atajos de teclado</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon btn-icon-sm"
            aria-label="cerrar"
          >
            <IconX size={12} />
          </button>
        </div>
        <div className="modal-body grid gap-2">
          <ShortcutRow keys={['j']} label="Siguiente bug" />
          <ShortcutRow keys={['k']} label="Bug anterior" />
          <ShortcutRow keys={['↵']} label="Abrir / cerrar el detalle" />
          <ShortcutRow keys={['esc']} label="Volver a la lista" />
          <ShortcutRow keys={['/']} label="Enfocar la búsqueda" />
          <ShortcutRow keys={['1', '…', '5']} label="Marcar estado (nuevo → no replicado)" />
          <ShortcutRow keys={['?']} label="Mostrar / ocultar esta ayuda" />
        </div>
      </div>
    </div>
  )
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm" style={{ color: col.fgBody }}>
        {label}
      </span>
      <span className="flex gap-1">
        {keys.map((key, index) => (
          <kbd key={index}>{key}</kbd>
        ))}
      </span>
    </div>
  )
}
