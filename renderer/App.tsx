import React, { useCallback, useEffect, useState } from 'react'
import type { ManualBugFields } from '../src/pipeline/manualBugBuilder'
import type {
  AnalyzedBug,
  BugResultEvent,
  BugStatus,
  ExternalAgentResult,
  IPCEvent,
  LogEvent,
  ProgressEvent,
} from '../src/types/index'
import BugTable, { severityLabel } from './components/BugTable'
import { BeetleMark } from './components/decor/BugMotifs'
import EmptyState from './components/EmptyState'
import FileUpload from './components/FileUpload'
import { IconPlus } from './components/icons'
import { LoadingOverlay } from './components/Loading'
import ManualBugForm from './components/ManualBugForm'
import Onboarding from './components/Onboarding'
import ProgressLog from './components/ProgressLog'
import ProjectSwitcher from './components/ProjectSwitcher'
import Settings from './components/Settings'
import TeamLogin, { type TeamAuthStatus } from './components/TeamLogin'
import { alpha, col } from './theme'

type Tab = 'main' | 'settings'
type Phase = 'idle' | 'analyzing' | 'done'

export interface LogLine {
  id: number
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: string
}

let logCounter = 0

export default function App() {
  const [tab, setTab] = useState<Tab>('main')
  const [phase, setPhase] = useState<Phase>('idle')
  const [excelPath, setExcelPath] = useState<string | null>(null)
  const [results, setResults] = useState<AnalyzedBug[]>([])
  const [logs, setLogs] = useState<LogLine[]>([])
  const [progress, setProgress] = useState<{
    current: number
    total: number
    message: string
    phase?: import('../src/types/index').AnalysisPhase
  }>({ current: 0, total: 0, message: '' })
  const [showLogs, setShowLogs] = useState(false)
  const [showManualForm, setShowManualForm] = useState(false)
  // Primer arranque: null = cargando settings; false = mostrar wizard; true = app normal.
  const [onboarded, setOnboarded] = useState<boolean | null>(null)
  const [teamStatus, setTeamStatus] = useState<TeamAuthStatus | null>(null)
  const [teamAuthLoading, setTeamAuthLoading] = useState(false)
  const [projectBusy, setProjectBusy] = useState(false)
  const [requestLoading, setRequestLoading] = useState<{
    title: string
    detail?: string
  } | null>(null)
  const [focusedBugId, setFocusedBugId] = useState<string | null>(null)
  const [expandedBugId, setExpandedBugId] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)
  const remoteReloadTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeProjectId = teamStatus?.project?.id ?? null

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
        const exists = prev.some((r) => r.enriched.raw.id === e.result.enriched.raw.id)
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

  // Saber si hay que mostrar el wizard de primer arranque.
  useEffect(() => {
    window.electronAPI.getSettings().then((s) => setOnboarded(Boolean(s.onboarded)))
    window.electronAPI.getSupabaseStatus().then(setTeamStatus)
  }, [])

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
        setExpandedBugId(null)
        setFocusedBugId(null)
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
      setRequestLoading({
        title: 'creando proyecto',
        detail: `${name} / ${slug}`,
      })
      try {
        const status = await window.electronAPI.createSupabaseProject(name, slug)
        setTeamStatus(status)
        setResults([])
        setExpandedBugId(null)
        setFocusedBugId(null)
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
    let cancelled = false
    if (!teamStatus?.authenticated || !activeProjectId) return

    loadRemoteResults(true, true).then(() => {
      if (cancelled) return
    })

    return () => {
      cancelled = true
    }
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

  // Si la tabla queda vacía estando en 'done' (borraste el último bug), volver al
  // inicio para mostrar la pantalla de carga.
  useEffect(() => {
    if (phase === 'done' && results.length === 0) setPhase('idle')
  }, [phase, results.length])

  const handleAnalyze = useCallback(async () => {
    if (!excelPath) return
    setPhase('analyzing')
    setResults([])
    setLogs([])
    setShowLogs(false)
    setProgress({ current: 0, total: 0, message: 'iniciando...' })
    addLog('info', 'iniciando análisis...')

    const result = await window.electronAPI.runAnalysis(excelPath)
    if (!result.ok) {
      addLog('error', `error: ${result.error}`)
      setPhase('idle')
    } else {
      await loadRemoteResults(false)
    }
  }, [excelPath, addLog, loadRemoteResults])

  // Analizar un bug cargado a mano: lo appendea a la tabla (no resetea).
  const handleAddManualBug = useCallback(
    async (fields: ManualBugFields) => {
      setPhase('analyzing')
      setShowLogs(false)
      setProgress({ current: 0, total: 1, message: 'analizando bug manual...' })
      addLog('info', 'analizando bug manual...')

      try {
        const result = await window.electronAPI.analyzeManualBug(fields)
        if (result.ok) {
          await loadRemoteResults(false)
          setPhase('done')
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
    if (result.ok) {
      addLog('info', `exportado: ${result.filePath}`)
    } else if (result.error) {
      addLog('error', `error al exportar: ${result.error}`)
    }
  }, [excelPath, results, addLog])

  const handleExportFullData = useCallback(async () => {
    if (results.length === 0) return
    const result = await window.electronAPI.exportFullData(excelPath, results)
    if (result.ok) {
      addLog('info', `datos completos exportados: ${result.filePath}`)
    } else if (result.error) {
      addLog('error', `error al exportar datos completos: ${result.error}`)
    }
  }, [excelPath, results, addLog])

  // Cambiar el estado de un bug: update optimista en la UI + persistir en Supabase.
  const handleSetStatus = useCallback(
    async (bug: AnalyzedBug, status: BugStatus) => {
      const id = bug.enriched.raw.id
      setResults((prev) => prev.map((r) => (r.enriched.raw.id === id ? { ...r, status } : r)))
      const result = await window.electronAPI.setBugStatus(bug, status)
      if (!result.ok) {
        addLog('error', `error guardando estado: ${result.error}`)
        setResults((prev) =>
          prev.map((r) => (r.enriched.raw.id === id ? { ...r, status: bug.status } : r)),
        )
      }
    },
    [addLog],
  )

  // Borrar un bug: soft-delete remoto en Supabase + update optimista de la tabla.
  const handleDeleteBug = useCallback(
    async (bug: AnalyzedBug) => {
      const id = bug.enriched.raw.id
      const previousResults = results
      setResults((prev) => prev.filter((r) => r.enriched.raw.id !== id))
      setExpandedBugId((curr) => (curr === id ? null : curr))
      setFocusedBugId((curr) => (curr === id ? null : curr))

      const result = await window.electronAPI.deleteBug(bug)
      if (result.ok) {
        addLog('info', `bug borrado: ${bug.enriched.raw.title}`)
      } else {
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
          item.enriched.raw.id === bug.enriched.raw.id
            ? { ...item, analysis: { ...item.analysis, externalAgent: result } }
            : item,
        ),
      )
      return result
    },
    [],
  )

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  // j/k: next/prev bug, Enter: expandir, Esc: cerrar, /: focus search, d: deep analysis del bug abierto, ?: help
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignorar si estamos escribiendo en un input/textarea/select
      const target = e.target as HTMLElement
      const isTyping =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
      if (isTyping && e.key !== 'Escape') return

      // Solo activos en la tab main
      if (tab !== 'main') return

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
          if (expandedBugId) {
            setExpandedBugId(null)
            break
          }
          if (isTyping) (target as HTMLInputElement).blur()
          break
        case 'j': {
          if (results.length === 0) return
          e.preventDefault()
          const idx = results.findIndex((r) => r.enriched.raw.id === focusedBugId)
          const next = results[Math.min(idx + 1, results.length - 1)] ?? results[0]
          setFocusedBugId(next.enriched.raw.id)
          break
        }
        case 'k': {
          if (results.length === 0) return
          e.preventDefault()
          const idx = results.findIndex((r) => r.enriched.raw.id === focusedBugId)
          const prev = results[Math.max(idx - 1, 0)] ?? results[0]
          setFocusedBugId(prev.enriched.raw.id)
          break
        }
        case 'Enter': {
          if (!focusedBugId) return
          e.preventDefault()
          setExpandedBugId((curr) => (curr === focusedBugId ? null : focusedBugId))
          break
        }
        // 1-5: marcar estado del bug enfocado, sin abrirlo.
        case '1':
        case '2':
        case '3':
        case '4':
        case '5': {
          if (!focusedBugId) return
          const bug = results.find((r) => r.enriched.raw.id === focusedBugId)
          if (!bug) return
          const map: Record<string, BugStatus> = {
            '1': 'nuevo',
            '2': 'en_progreso',
            '3': 'solucionado',
            '4': 'cerrado',
            '5': 'no_replicado',
          }
          e.preventDefault()
          handleSetStatus(bug, map[e.key])
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tab, results, focusedBugId, expandedBugId, showHelp, handleSetStatus])

  // Primer arranque: mientras carga no parpadeamos nada; si falta onboarding, wizard.
  if (onboarded === null) return <div className="h-screen bg-om-base" />
  if (!onboarded) {
    return (
      <div className="h-screen bg-om-base text-om-fg">
        <Onboarding onDone={() => setOnboarded(true)} />
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

  return (
    <div className="relative flex h-screen flex-col bg-om-base text-om-fg">
      {/* Header */}
      <header className="flex flex-shrink-0 items-center justify-between border-om-border/25 border-b bg-om-surface px-4 py-2">
        <div className="flex items-center gap-2.5">
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            style={{ color: col.cream, flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
            <line
              x1="21"
              y1="21"
              x2="16.65"
              y2="16.65"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="11" cy="11" r="2.5" fill="currentColor" opacity="0.7" />
          </svg>
          <span
            className="font-mono font-semibold text-sm tracking-tight"
            style={{ color: col.cream }}
          >
            buglens
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {(['main', 'settings'] as Tab[]).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setTab(t)}
              className="cursor-pointer rounded px-3 py-1 font-mono text-xs transition-colors"
              style={
                tab === t
                  ? {
                      background: alpha(col.cream, 0.12),
                      color: col.cream,
                      border: `1px solid ${alpha(col.cream, 0.22)}`,
                    }
                  : {
                      color: col.fgMuted,
                      background: 'transparent',
                      border: '1px solid transparent',
                    }
              }
              onMouseEnter={(e) => {
                if (tab !== t) {
                  e.currentTarget.style.color = col.fg
                  e.currentTarget.style.background = col.raised
                }
              }}
              onMouseLeave={(e) => {
                if (tab !== t) {
                  e.currentTarget.style.color = col.fgMuted
                  e.currentTarget.style.background = 'transparent'
                }
              }}
            >
              {t === 'main' ? 'principal' : 'config'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="ml-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded font-mono text-xs transition-colors"
            style={{ color: col.fgMuted, border: '1px solid transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = col.fg
              e.currentTarget.style.background = col.raised
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = col.fgMuted
              e.currentTarget.style.background = 'transparent'
            }}
            title="atajos de teclado (?)"
            aria-label="ayuda"
          >
            ?
          </button>
        </nav>
      </header>

      <main className="flex-1 overflow-hidden">
        {tab === 'settings' ? (
          <Settings addLog={addLog} onTeamStatusChange={setTeamStatus} />
        ) : (
          <div className="flex h-full">
            {/* Left panel */}
            <div className="side-panel flex flex-shrink-0 flex-col gap-3 overflow-y-auto border-om-border/20 border-r p-4">
              <ProjectSwitcher
                activeProject={teamStatus.project}
                projects={teamStatus.projects ?? (teamStatus.project ? [teamStatus.project] : [])}
                busy={projectBusy || phase === 'analyzing'}
                onSelect={(projectId) => void handleSelectProject(projectId)}
                onCreate={(name, slug) => void handleCreateProject(name, slug)}
              />

              <FileUpload
                excelPath={excelPath}
                onFileSelected={setExcelPath}
                disabled={phase === 'analyzing'}
              />

              {phase !== 'analyzing' && (
                <button
                  type="button"
                  className="btn-secondary side-action w-full"
                  onClick={() => setShowManualForm(true)}
                >
                  <IconPlus size={12} className="button-icon button-icon-plus" />
                  cargar bug manual
                </button>
              )}

              {phase === 'idle' && (
                <button
                  type="button"
                  className="btn-primary side-action w-full"
                  onClick={handleAnalyze}
                  disabled={!excelPath}
                >
                  analizar bugs
                </button>
              )}

              {phase === 'analyzing' && (
                <div className="card">
                  {/* Pasos visuales — el segmento activo está iluminado */}
                  <PhaseSteps current={progress.phase} />

                  <div className="mt-3 mb-2.5 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 flex-shrink-0 animate-scan rounded-full bg-om-cream" />
                    <span className="flex-1 truncate font-mono text-om-fgmuted text-sm">
                      {progress.message}
                    </span>
                  </div>
                  <div
                    className="h-1 w-full rounded-full"
                    style={{ background: alpha(col.muted, 0.35) }}
                  >
                    <div
                      className="h-1 rounded-full transition-all duration-500"
                      style={{
                        background: col.cream,
                        width:
                          progress.total > 0
                            ? `${(progress.current / progress.total) * 100}%`
                            : '5%',
                      }}
                    />
                  </div>
                  {progress.total > 0 && (
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="font-mono text-xs" style={{ color: col.dim }}>
                        {Math.round((progress.current / progress.total) * 100)}%
                      </span>
                      <span className="font-mono text-om-muted text-xs">
                        {progress.current}/{progress.total}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowLogs((v) => !v)}
                    className="mt-2.5 flex w-full cursor-pointer items-center gap-1.5 font-mono text-xs transition-colors"
                    style={{ color: showLogs ? col.fgMuted : col.muted }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = col.fgMuted)}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = showLogs ? col.fgMuted : col.muted)
                    }
                  >
                    <svg
                      aria-hidden="true"
                      width="8"
                      height="8"
                      viewBox="0 0 8 8"
                      fill="currentColor"
                      style={{
                        transform: showLogs ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.15s',
                      }}
                    >
                      <path d="M2 1l4 3-4 3V1z" />
                    </svg>
                    log
                    {logs.length > 0 && <span style={{ color: col.dim }}>({logs.length})</span>}
                  </button>
                </div>
              )}

              {phase === 'done' && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="btn-primary side-action w-full"
                    onClick={handleExport}
                  >
                    exportar excel
                  </button>
                  <button
                    type="button"
                    className="btn-secondary side-action w-full"
                    onClick={handleExportFullData}
                  >
                    exportar datos completos
                  </button>
                </div>
              )}

              {phase === 'done' && results.length > 0 && (
                <div className="card">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="section-label mb-0">resumen</div>
                    <span className="font-mono text-xs" style={{ color: col.fgMuted }}>
                      {results.length} bugs
                    </span>
                  </div>
                  <StatsGrid results={results} />
                </div>
              )}

              {/* Escarabajo ambiente al pie del panel (decorativo, balanceo sutil) */}
              <div aria-hidden="true" className="mt-auto flex justify-center pt-6">
                <BeetleMark
                  className="motif-sway"
                  style={{ width: 84, color: col.fgDim, opacity: 0.12 }}
                />
              </div>
            </div>

            {/* Right panel */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {results.length > 0 ? (
                <div className="flex h-full flex-col">
                  <div className="flex-1 overflow-hidden">
                    <BugTable
                      results={results}
                      analyzing={phase === 'analyzing'}
                      onSetStatus={handleSetStatus}
                      onDelete={handleDeleteBug}
                      onAnalyzeExternalAgent={handleAnalyzeExternalAgent}
                      focusedId={focusedBugId}
                      expandedId={expandedBugId}
                      onFocus={setFocusedBugId}
                      onToggleExpand={(id) => setExpandedBugId((curr) => (curr === id ? null : id))}
                      searchInputRef={searchInputRef}
                    />
                  </div>
                  {showLogs && (
                    <div className="h-40 flex-shrink-0 border-om-border/20 border-t">
                      <ProgressLog logs={logs} />
                    </div>
                  )}
                </div>
              ) : phase === 'analyzing' ? (
                <div className="flex-1 overflow-hidden">
                  <ProgressLog logs={logs} />
                </div>
              ) : (
                <div className="flex-1 overflow-hidden">
                  <EmptyState hasExcel={!!excelPath} />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <LoadingOverlay
        visible={Boolean(requestLoading)}
        title={requestLoading?.title ?? ''}
        detail={requestLoading?.detail}
      />

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showManualForm && (
        <ManualBugForm onSubmit={handleAddManualBug} onClose={() => setShowManualForm(false)} />
      )}
    </div>
  )
}

// ─── Help modal ────────────────────────────────────────────────────────────────
// Cheatsheet de atajos. Se abre con `?` y cierra con Esc o click afuera.

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop: botón real → click/Enter/Space cierra y es accesible por teclado */}
      <button
        type="button"
        aria-label="cerrar ayuda"
        className="absolute inset-0 cursor-default"
        style={{ background: alpha(col.code, 0.85) }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="atajos de teclado"
        className="relative w-full max-w-md rounded p-5"
        style={{ background: col.surface, border: `1px solid ${alpha(col.border, 0.3)}` }}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider" style={{ color: col.cream }}>
            atajos de teclado
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 cursor-pointer items-center justify-center rounded transition-colors"
            style={{ color: col.fgMuted }}
            onMouseEnter={(e) => (e.currentTarget.style.color = col.fg)}
            onMouseLeave={(e) => (e.currentTarget.style.color = col.fgMuted)}
            aria-label="cerrar"
          >
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 10 10" fill="none">
              <line
                x1="1"
                y1="1"
                x2="9"
                y2="9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="9"
                y1="1"
                x2="1"
                y2="9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-1.5">
          <ShortcutRow keys={['j']} label="siguiente bug" />
          <ShortcutRow keys={['k']} label="bug anterior" />
          <ShortcutRow keys={['enter']} label="expandir / colapsar bug" />
          <ShortcutRow keys={['esc']} label="cerrar detalle / modal" />
          <ShortcutRow keys={['/']} label="enfocar búsqueda" />
          <ShortcutRow keys={['1', '…', '5']} label="marcar estado (nuevo→no replicado)" />
          <ShortcutRow keys={['?']} label="mostrar / ocultar esta ayuda" />
        </div>
      </div>
    </div>
  )
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="font-mono text-xs" style={{ color: col.fgDim }}>
        {label}
      </span>
      <div className="flex gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="rounded px-1.5 py-0.5 font-mono text-xs"
            style={{
              background: alpha(col.muted, 0.3),
              border: `1px solid ${alpha(col.border, 0.3)}`,
              color: col.cream,
              minWidth: '1.4em',
              textAlign: 'center',
            }}
          >
            {k}
          </kbd>
        ))}
      </div>
    </div>
  )
}

// Pasos visuales del pipeline. Cada chip se ilumina cuando es la fase activa,
// los anteriores quedan en color completado, los futuros en gris.
export function PhaseSteps({ current }: { current?: import('../src/types/index').AnalysisPhase }) {
  const steps: Array<{ key: import('../src/types/index').AnalysisPhase; label: string }> = [
    { key: 'reading_excel', label: 'excel' },
    { key: 'reading_docs', label: 'docs' },
    { key: 'analyzing', label: 'analizar' },
    { key: 'done', label: 'listo' },
  ]
  const currentIdx = steps.findIndex((s) => s.key === current)
  // Si la fase no aplica (todavía no se emitió), asumimos arrancando en 0
  const activeIdx = currentIdx >= 0 ? currentIdx : 0

  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => {
        const isPast = i < activeIdx
        const isCurrent = i === activeIdx && current !== 'done'
        const isDone = current === 'done' || isPast
        const color = isCurrent ? col.cream : isDone ? col.fgDim : col.dim
        return (
          <div key={s.key} className="flex min-w-0 flex-1 items-center gap-1">
            <div
              className="h-0.5 flex-1 rounded-full"
              style={{ background: color, opacity: isCurrent ? 1 : isDone ? 0.6 : 0.3 }}
            />
            <span
              className="flex-shrink-0 font-mono text-xs uppercase tracking-wider"
              style={{ color }}
            >
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Estados en orden de workflow, con etiqueta y color (mismos que la tabla).
const STATUS_META: Array<{ key: string; label: string; color: string }> = [
  { key: 'nuevo', label: 'nuevo', color: col.fgDim },
  { key: 'en_progreso', label: 'en progreso', color: col.amber },
  { key: 'solucionado', label: 'solucionado', color: col.green },
  { key: 'cerrado', label: 'cerrado', color: col.fgMuted },
  { key: 'no_replicado', label: 'no replicado', color: col.terracotta },
]

export function StatsGrid({ results }: { results: AnalyzedBug[] }) {
  const counts = results.reduce(
    (acc, r) => {
      acc.categories[r.analysis.category] = (acc.categories[r.analysis.category] ?? 0) + 1
      acc.severities[r.analysis.severity] = (acc.severities[r.analysis.severity] ?? 0) + 1
      acc.statuses[r.status] = (acc.statuses[r.status] ?? 0) + 1
      return acc
    },
    {
      categories: {} as Record<string, number>,
      severities: {} as Record<string, number>,
      statuses: {} as Record<string, number>,
    },
  )

  const severityColor: Record<string, string> = {
    critical: 'text-om-red',
    high: 'text-om-amber',
    medium: 'text-om-cream',
    low: 'text-om-fgdim',
  }

  return (
    <div className="space-y-1 font-mono text-xs">
      {/* Estado (workflow) — primero */}
      {STATUS_META.filter((s) => counts.statuses[s.key]).map((s) => (
        <div key={s.key} className="flex justify-between">
          <span style={{ color: s.color }}>{s.label}</span>
          <span className="text-om-fg">{counts.statuses[s.key]}</span>
        </div>
      ))}

      <div className="mt-1.5 border-om-border/20 border-t pt-1.5">
        {Object.entries(counts.severities)
          .sort()
          .map(([s, n]) => (
            <div key={s} className="flex justify-between">
              <span className={severityColor[s] ?? 'text-om-fgmuted'}>
                {(severityLabel as Record<string, string>)[s] ?? s}
              </span>
              <span className="text-om-fg">{n}</span>
            </div>
          ))}
      </div>
      <div className="mt-1.5 border-om-border/20 border-t pt-1.5">
        {Object.entries(counts.categories)
          .sort()
          .map(([c, n]) => (
            <div key={c} className="flex justify-between">
              <span className="text-om-fgmuted">{c}</span>
              <span className="text-om-fg">{n}</span>
            </div>
          ))}
      </div>
    </div>
  )
}
