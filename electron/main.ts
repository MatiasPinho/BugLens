import * as path from 'node:path'
import * as dotenv from 'dotenv'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'

// Load .env from project root (dev) or app resources (prod)
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, '.env')
  : path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

import {
  analyzeExcelBugs,
  analyzeManualBug,
} from '../src/features/analyze-bugs/application/analyzeBugReports.js'
import { BugEnricher } from '../src/features/analyze-bugs/application/bugEnricher.js'
import {
  getBrowserDocsAuthStatus,
  getGoogleDocsAuthStatus,
  revokeBrowserDocsAuth,
  revokeGoogleDocsAuth,
  startBrowserDocsLogin,
  startGoogleDocsAuth,
} from '../src/features/analyze-bugs/application/evidenceDocsAuth.js'
import {
  createBrowserDocsReader,
  createGoogleDocsReader,
} from '../src/features/analyze-bugs/application/evidenceDocsReaders.js'
import type { ManualBugFields } from '../src/features/analyze-bugs/application/manualBugBuilder.js'
import { runBugAnalysisBatch } from '../src/features/analyze-bugs/application/runBugAnalysisBatch.js'
import { selectEvidenceDocsReader } from '../src/features/analyze-bugs/application/selectEvidenceDocsReader.js'
import {
  clearCache,
  getCacheStats,
} from '../src/features/analyze-bugs/infrastructure/analysisCache.js'
import { BrowserDocsReader } from '../src/features/analyze-bugs/infrastructure/browserDocsReader.js'
import {
  addBugComment,
  deleteBug,
  listProjectMembers,
  loadProjectBugs,
  setBugAssignees,
  setBugDueDate,
  setBugStatus,
  voteBugComment,
} from '../src/features/bug-workflow/application/manageBugWorkflow.js'
import {
  enrichedExcelDefaultName,
  exportBugsExcel,
  exportEnrichedExcel,
  exportFullDataJson,
  fullDataDefaultName,
} from '../src/features/export-bugs/application/exportBugReports.js'
import { runExternalAgent } from '../src/features/external-agent/application/externalAgent.js'
import {
  checkOpenCode,
  repairOpenCode,
} from '../src/features/external-agent/application/openCodeSetup.js'
import {
  createProjectAndLoadStatus,
  createProjectClient,
  loadProjectTeamStatus,
  projectTeamErrorStatus,
  type SupabaseTeamConfig,
  signOutProjectTeam,
  startProjectTeamGoogleAuth,
} from '../src/features/projects/application/manageProjects.js'
import {
  saveProjectAnalysisResult,
  startProjectAnalysisRun,
} from '../src/features/projects/application/projectAnalysisRun.js'
import { ProjectBugRealtimeWatcher } from '../src/features/projects/application/projectBugRealtime.js'
import {
  buildLLMConfigFromSettings,
  localLLMBaseUrl,
  shouldEnsureLocalLLM,
} from '../src/features/settings/application/llmSettings.js'
import { probeHardware } from '../src/features/settings/application/probeHardware.js'
import {
  type AppResetScope,
  resetAppSettings,
} from '../src/features/settings/application/resetAppSettings.js'
import {
  type AppSettings,
  appSettingsPath,
  loadAppSettings,
  saveAppSettings,
  settingsToSupabaseTeamConfig,
} from '../src/features/settings/application/settingsStore.js'
import {
  checkOllamaAvailability,
  ensureOllamaRunning,
  stopManagedOllama,
} from '../src/platform/ollama/ollamaService.js'
import type {
  AnalyzedBug,
  BugStatus,
  CommentVote,
  HardwareProbe,
  LLMConfig,
  RawBug,
} from '../src/shared/contracts/index.js'
import { IPC_CHANNELS, type IPCChannel } from '../src/shared/ipc/channels.js'

function getCacheDir(): string {
  return path.join(app.getPath('userData'), 'analysis-cache')
}

function getSupabaseSessionPath(): string {
  return path.join(app.getPath('userData'), 'supabase-session.json')
}

// ─── Simple JSON config store ─────────────────────────────────────────────────
// Replaces electron-store to avoid ESM/CJS conflicts.

function getConfigPath(): string {
  return appSettingsPath(app.getPath('userData'))
}

function loadSettings(): AppSettings {
  return loadAppSettings(getConfigPath(), process.env)
}

function saveSettings(patch: Partial<AppSettings>): void {
  saveAppSettings(getConfigPath(), patch, process.env)
}

function loadSupabaseTeamConfig(): SupabaseTeamConfig {
  return settingsToSupabaseTeamConfig(loadSettings())
}

function makeSupabaseTeamClient() {
  return createProjectClient(loadSupabaseTeamConfig(), getSupabaseSessionPath())
}

// ─── Window ───────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null

// En Linux, algunos drivers/Mesa hacen que el proceso GPU de Chromium sea
// inusable ("GPU process isn't usable. Goodbye." → SIGTRAP). Para una UI simple
// como ésta, el render por software es más que suficiente y evita el crash.
if (process.platform === 'linux') {
  app.disableHardwareAcceleration()
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Bug Analyzer',
  })

  // app.isPackaged === false during dev (electron .), true in packaged builds
  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sendToRenderer(channel: IPCChannel, payload: unknown): void {
  mainWindow?.webContents.send(channel, payload)
}

function log(level: 'info' | 'warn' | 'error', message: string): void {
  console.log(`[${level.toUpperCase()}] ${message}`)
  sendToRenderer(IPC_CHANNELS.log, {
    type: IPC_CHANNELS.log,
    level,
    message,
    timestamp: new Date().toISOString(),
  })
}

const projectBugRealtimeWatcher = new ProjectBugRealtimeWatcher({
  onChanged: () => {
    sendToRenderer(IPC_CHANNELS.remoteBugsChanged, { type: IPC_CHANNELS.remoteBugsChanged })
  },
  onStatus: (status) => {
    if (status === 'SUBSCRIBED') log('info', 'Realtime de bugs conectado')
    if (status === 'CHANNEL_ERROR') log('warn', 'Realtime de bugs tuvo un error')
  },
})

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object') {
    const record = err as Record<string, unknown>
    const parts = [record['message'], record['details'], record['hint'], record['code']]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim())
    if (parts.length > 0) return parts.join(' · ')
    try {
      return JSON.stringify(record)
    } catch {
      return String(err)
    }
  }
  return String(err)
}

async function watchRemoteBugChanges(projectId: string): Promise<void> {
  await projectBugRealtimeWatcher.watch(makeSupabaseTeamClient(), projectId)
}

async function unwatchRemoteBugChanges(): Promise<void> {
  await projectBugRealtimeWatcher.unwatch(makeSupabaseTeamClient())
}

// ─── Lazy singleton factories ─────────────────────────────────────────────────

function makeGoogleReader() {
  return createGoogleDocsReader(loadSettings(), app.getPath('userData'))
}

function makeBrowserReader() {
  return createBrowserDocsReader(app.getPath('userData'))
}

// ─── IPC: Settings ────────────────────────────────────────────────────────────

ipcMain.handle(IPC_CHANNELS.settingsGet, () => loadSettings())

ipcMain.handle(IPC_CHANNELS.settingsSave, (_e, patch: Partial<AppSettings>) => {
  saveSettings(patch)
  return { ok: true }
})

ipcMain.handle(IPC_CHANNELS.settingsPickDirectory, async () => {
  const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

// ─── IPC: Supabase team auth ─────────────────────────────────────────────────

ipcMain.handle(IPC_CHANNELS.supabaseStatus, async () => {
  try {
    const status = await loadProjectTeamStatus(makeSupabaseTeamClient(), loadSupabaseTeamConfig())
    if (status.authenticated && status.project) {
      saveSettings({ supabaseActiveProjectId: status.project.id })
      await watchRemoteBugChanges(status.project.id).catch((err) => {
        log('warn', `No se pudo conectar realtime: ${errorMessage(err)}`)
      })
    }
    return status
  } catch (err) {
    return projectTeamErrorStatus(loadSupabaseTeamConfig(), errorMessage(err))
  }
})

ipcMain.handle(IPC_CHANNELS.supabaseStartGoogleAuth, async () => {
  try {
    const config = loadSupabaseTeamConfig()
    const client = createProjectClient(config, getSupabaseSessionPath())
    if (!client) {
      return {
        configured: false,
        authenticated: false,
        error: 'Configurá SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY antes de iniciar sesión.',
      }
    }
    const status = await startProjectTeamGoogleAuth(client, config, shell)
    log('info', `supabase login completado: ${status.user?.email ?? status.user?.id}`)
    if (status.project) {
      saveSettings({ supabaseActiveProjectId: status.project.id })
      await watchRemoteBugChanges(status.project.id).catch((err) => {
        log('warn', `No se pudo conectar realtime: ${errorMessage(err)}`)
      })
    }
    return status
  } catch (err) {
    const message = errorMessage(err)
    log('error', `Error en Supabase Auth: ${message}`)
    return projectTeamErrorStatus(loadSupabaseTeamConfig(), message)
  }
})

ipcMain.handle(IPC_CHANNELS.supabaseSignOut, async () => {
  await unwatchRemoteBugChanges()
  await signOutProjectTeam(makeSupabaseTeamClient())
  return { ok: true }
})

ipcMain.handle(
  IPC_CHANNELS.supabaseSelectProject,
  async (_e, { projectId }: { projectId: string }) => {
    try {
      saveSettings({ supabaseActiveProjectId: projectId })
      const status = await loadProjectTeamStatus(makeSupabaseTeamClient(), loadSupabaseTeamConfig())
      if (status.authenticated && status.project) {
        saveSettings({ supabaseActiveProjectId: status.project.id })
        await watchRemoteBugChanges(status.project.id)
      }
      return status
    } catch (err) {
      const message = errorMessage(err)
      log('error', `Error seleccionando proyecto: ${message}`)
      return projectTeamErrorStatus(loadSupabaseTeamConfig(), message)
    }
  },
)

ipcMain.handle(
  IPC_CHANNELS.supabaseCreateProject,
  async (_e, { name, slug }: { name: string; slug: string }) => {
    try {
      const client = makeSupabaseTeamClient()
      if (!client) throw new Error('Supabase no está configurado.')
      const config = loadSupabaseTeamConfig()
      const status = await createProjectAndLoadStatus(client, config, name, slug)
      const project = status.project
      if (!project) throw new Error('No se pudo resolver el proyecto creado.')
      saveSettings({ supabaseActiveProjectId: project.id })
      await watchRemoteBugChanges(project.id)
      log('info', `proyecto creado: ${project.name}`)
      return status
    } catch (err) {
      const message = errorMessage(err)
      log('error', `Error creando proyecto: ${message}`)
      return projectTeamErrorStatus(loadSupabaseTeamConfig(), message)
    }
  },
)

// ─── IPC: Google Auth ─────────────────────────────────────────────────────────

ipcMain.handle(IPC_CHANNELS.googleAuthStatus, () => {
  return getGoogleDocsAuthStatus(makeGoogleReader())
})

ipcMain.handle(IPC_CHANNELS.googleStartAuth, async () => {
  return startGoogleDocsAuth(makeGoogleReader(), shell)
})

ipcMain.handle(IPC_CHANNELS.googleRevoke, async () => {
  return revokeGoogleDocsAuth(makeGoogleReader())
})

// ─── IPC: Browser-based Google Auth (cookie session, no OAuth) ───────────────

ipcMain.handle(IPC_CHANNELS.browserAuthStatus, () => {
  return getBrowserDocsAuthStatus(makeBrowserReader())
})

ipcMain.handle(IPC_CHANNELS.browserAuthStartLogin, async () => {
  const result = await startBrowserDocsLogin(makeBrowserReader())
  if (!result.ok) {
    const message = result.error ?? 'Error desconocido'
    log('error', `Error en login del navegador: ${message}`)
  }
  return result
})

ipcMain.handle(IPC_CHANNELS.browserAuthRevoke, () => {
  return revokeBrowserDocsAuth(makeBrowserReader())
})

// ─── IPC: Main analysis pipeline ─────────────────────────────────────────────

// Secuencia para ids de bugs manuales dentro de la sesión. La identidad real
// para el estado persistente es por contenido (bugRecordKey), no por este id.
let manualBugCounter = 0

/**
 * Analiza una lista de bugs crudos (vengan de Excel o cargados a mano):
 * enriquece con Google Docs, clasifica + reescribe con el LLM, y streamea cada
 * resultado al renderer a medida que termina.
 *
 * @param emitComplete cuando es true emite `analysis-complete` con TODOS los
 *   resultados (el renderer reemplaza la tabla — corrida desde Excel). Cuando es
 *   false solo streamea por `bug-result` (el renderer appendea — bug manual).
 */
async function analyzeBugs(
  bugs: RawBug[],
  {
    emitComplete,
    sourceType,
    sourceName,
    sourcePath,
  }: {
    emitComplete: boolean
    sourceType: 'excel' | 'manual'
    sourceName?: string
    sourcePath?: string
  },
): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const s = loadSettings()
    const llmConfig: LLMConfig = buildLLMConfigFromSettings(s)
    const teamClient = makeSupabaseTeamClient()
    if (!teamClient) throw new Error('Supabase no está configurado.')
    const teamConfig = loadSupabaseTeamConfig()
    const projectAnalysisRun = await startProjectAnalysisRun(
      teamClient,
      teamConfig,
      {
        sourceType,
        sourceName,
        sourcePath,
        rowCount: bugs.length,
      },
      llmConfig,
    )

    // Auto-levantar Ollama si es el provider elegido y no está corriendo
    if (shouldEnsureLocalLLM(s)) {
      const baseUrl = localLLMBaseUrl(s)
      const { started, alreadyRunning } = await ensureOllamaRunning(baseUrl, (message) =>
        log('info', message),
      )
      if (started) log('info', 'Ollama iniciado automáticamente')
      else if (alreadyRunning) log('info', 'Ollama ya estaba corriendo')
      else log('warn', 'No se pudo levantar Ollama — el análisis puede fallar')
    }

    // Prefer browser-session reader (no OAuth, company can't see it in Cloud Console)
    // Fall back to OAuth reader if browser session is not set up
    const browserReader = makeBrowserReader()
    const oauthReader = makeGoogleReader()

    const docsSelection = selectEvidenceDocsReader(browserReader, oauthReader)
    log(docsSelection.log.level, docsSelection.log.message)

    const enricher = new BugEnricher(docsSelection.reader)

    const { results } = await runBugAnalysisBatch({
      bugs,
      enricher,
      llmConfig,
      performanceMode: s.performanceMode,
      cacheDir: getCacheDir(),
      saveResult: projectAnalysisRun.saveResult,
      onBugResult: ({ result, current, total }) =>
        sendToRenderer(IPC_CHANNELS.bugResult, {
          type: IPC_CHANNELS.bugResult,
          result,
          current,
          total,
        }),
      onProgress: (progress) =>
        sendToRenderer(IPC_CHANNELS.progress, {
          type: IPC_CHANNELS.progress,
          ...progress,
        }),
      onLog: log,
    })

    if (emitComplete) {
      sendToRenderer(IPC_CHANNELS.analysisComplete, {
        type: 'complete',
        results: results.filter(Boolean),
      })
    }

    // Cerrar el contexto headless del browser reader para liberar recursos
    if (browserReader instanceof BrowserDocsReader) {
      await browserReader.closeContext().catch(() => {})
    }

    return { ok: true, count: results.length }
  } catch (err) {
    const message = errorMessage(err)
    log('error', `Error general: ${message}`)
    return { ok: false, error: message }
  }
}

// Corrida desde Excel: lee el archivo y analiza todos los bugs (reemplaza la tabla).
ipcMain.handle(IPC_CHANNELS.analyzeRun, async (_e, excelPath: string) => {
  try {
    sendToRenderer(IPC_CHANNELS.progress, {
      type: IPC_CHANNELS.progress,
      phase: 'reading_excel',
      message: 'leyendo Excel...',
      current: 0,
      total: 0,
    })
    log('info', `Leyendo Excel: ${excelPath}`)
    const bugs = analyzeExcelBugs(excelPath)
    log('info', `Encontrados ${bugs.length} bugs`)
    return await analyzeBugs(bugs, {
      emitComplete: true,
      sourceType: 'excel',
      sourceName: path.basename(excelPath),
      sourcePath: excelPath,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log('error', `Error leyendo Excel: ${message}`)
    return { ok: false, error: message }
  }
})

// Carga manual: arma un RawBug desde los campos del formulario y lo analiza,
// streameándolo a la tabla sin reemplazar lo ya cargado.
ipcMain.handle(IPC_CHANNELS.analyzeManualBug, async (_e, fields: ManualBugFields) => {
  try {
    const bug = analyzeManualBug(fields, ++manualBugCounter)
    log('info', `Bug manual cargado: ${bug.title}`)
    return await analyzeBugs([bug], {
      emitComplete: false,
      sourceType: 'manual',
      sourceName: 'manual',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log('error', `Error en bug manual: ${message}`)
    return { ok: false, error: message }
  }
})

ipcMain.handle(
  IPC_CHANNELS.bugAnalyzeExternalAgent,
  async (event, { bug }: { bug: AnalyzedBug }) => {
    try {
      const { externalAgentCommand, externalAgentTimeoutMs, externalAgentRepositories } =
        loadSettings()
      log('info', `Enviando bug a agente externo: ${bug.enriched.raw.title}`)
      const externalAgentResult = await runExternalAgent(
        externalAgentCommand,
        bug,
        externalAgentTimeoutMs,
        (progress) => {
          event.sender.send(IPC_CHANNELS.externalAgentProgress, progress)
        },
        externalAgentRepositories,
      )
      const result = { ...externalAgentResult, createdAt: new Date().toISOString() }
      if (result.ok) {
        log('info', `Agente externo terminó en ${Math.round(result.durationMs / 1000)}s`)
      } else {
        log('error', `Error en agente externo: ${result.error ?? 'sin detalle'}`)
      }
      try {
        const client = makeSupabaseTeamClient()
        if (!client) throw new Error('Supabase no está configurado.')
        await saveProjectAnalysisResult(
          client,
          loadSupabaseTeamConfig(),
          {
            ...bug,
            analysis: {
              ...bug.analysis,
              externalAgent: result,
              externalAgentHistory: [result, ...(bug.analysis.externalAgentHistory ?? [])],
            },
          },
          {
            importId: null,
            sourceType: bug.enriched.raw.id.startsWith('manual-') ? 'manual' : 'excel',
            provider: 'external-agent',
            model: result.command,
            promptVersion: 'external-agent-v1',
          },
        )
        log('info', `Resultado del agente externo guardado: ${bug.enriched.raw.title}`)
      } catch (err) {
        log('warn', `No se pudo guardar el resultado del agente externo: ${errorMessage(err)}`)
      }
      return result
    } catch (err) {
      const message = errorMessage(err)
      log('error', `Error ejecutando agente externo: ${message}`)
      return {
        ok: false,
        output: '',
        error: message,
        command: loadSettings().externalAgentCommand,
        durationMs: 0,
      }
    }
  },
)

// ─── IPC: Cache ───────────────────────────────────────────────────────────────

// ─── IPC: Estado de bugs (persistente) ───────────────────────────────────────

ipcMain.handle(
  IPC_CHANNELS.bugSetStatus,
  async (_e, { bug, status }: { bug: AnalyzedBug; status: BugStatus }) => {
    try {
      const client = makeSupabaseTeamClient()
      if (!client) throw new Error('Supabase no está configurado.')
      await setBugStatus(client, loadSupabaseTeamConfig(), bug, status)
      return { ok: true }
    } catch (err) {
      const message = errorMessage(err)
      log('error', `Error guardando estado remoto: ${message}`)
      return { ok: false, error: message }
    }
  },
)

ipcMain.handle(
  IPC_CHANNELS.bugAddComment,
  async (
    _e,
    { bug, body, parentId }: { bug: AnalyzedBug; body: string; parentId?: string | null },
  ) => {
    try {
      const client = makeSupabaseTeamClient()
      if (!client) throw new Error('Supabase no está configurado.')
      const comment = await addBugComment(client, loadSupabaseTeamConfig(), bug, body, parentId)
      return { ok: true, comment }
    } catch (err) {
      const message = errorMessage(err)
      log('error', `Error guardando comentario remoto: ${message}`)
      return { ok: false, error: message }
    }
  },
)

ipcMain.handle(
  IPC_CHANNELS.bugSetAssignees,
  async (_e, { bug, userIds }: { bug: AnalyzedBug; userIds: string[] }) => {
    try {
      const client = makeSupabaseTeamClient()
      if (!client) throw new Error('Supabase no está configurado.')
      await setBugAssignees(client, loadSupabaseTeamConfig(), bug, userIds)
      return { ok: true }
    } catch (err) {
      const message = errorMessage(err)
      log('error', `Error asignando responsables: ${message}`)
      return { ok: false, error: message }
    }
  },
)

ipcMain.handle(
  IPC_CHANNELS.bugSetDueDate,
  async (_e, { bug, dueDate }: { bug: AnalyzedBug; dueDate: string | null }) => {
    try {
      const client = makeSupabaseTeamClient()
      if (!client) throw new Error('Supabase no está configurado.')
      await setBugDueDate(client, loadSupabaseTeamConfig(), bug, dueDate)
      return { ok: true }
    } catch (err) {
      const message = errorMessage(err)
      log('error', `Error cambiando la fecha límite: ${message}`)
      return { ok: false, error: message }
    }
  },
)

ipcMain.handle(
  IPC_CHANNELS.bugVoteComment,
  async (_e, { commentId, value }: { commentId: string; value: CommentVote }) => {
    try {
      const client = makeSupabaseTeamClient()
      if (!client) throw new Error('Supabase no está configurado.')
      const totals = await voteBugComment(client, loadSupabaseTeamConfig(), commentId, value)
      return { ok: true, totals }
    } catch (err) {
      const message = errorMessage(err)
      log('error', `Error votando el comentario: ${message}`)
      return { ok: false, error: message }
    }
  },
)

ipcMain.handle(IPC_CHANNELS.projectMembers, async () => {
  try {
    const client = makeSupabaseTeamClient()
    if (!client) throw new Error('Supabase no está configurado.')
    const members = await listProjectMembers(client, loadSupabaseTeamConfig())
    return { ok: true, members }
  } catch (err) {
    const message = errorMessage(err)
    log('error', `Error cargando miembros del proyecto: ${message}`)
    return { ok: false, error: message }
  }
})

ipcMain.handle(IPC_CHANNELS.bugsLoadRemote, async () => {
  try {
    const client = makeSupabaseTeamClient()
    if (!client) throw new Error('Supabase no está configurado.')
    const results = await loadProjectBugs(client, loadSupabaseTeamConfig())
    return { ok: true, results }
  } catch (err) {
    const message = errorMessage(err)
    log('error', `Error cargando bugs remotos: ${message}`)
    return { ok: false, error: message, results: [] }
  }
})

ipcMain.handle(IPC_CHANNELS.bugDelete, async (_e, { bug }: { bug: AnalyzedBug }) => {
  try {
    const client = makeSupabaseTeamClient()
    if (!client) throw new Error('Supabase no está configurado.')
    await deleteBug(client, loadSupabaseTeamConfig(), bug)
    return { ok: true }
  } catch (err) {
    const message = errorMessage(err)
    log('error', `Error borrando bug remoto: ${message}`)
    return { ok: false, error: message }
  }
})

ipcMain.handle(IPC_CHANNELS.bugsWatchRemote, async () => {
  try {
    const status = await loadProjectTeamStatus(makeSupabaseTeamClient(), loadSupabaseTeamConfig())
    if (!status.authenticated || !status.project) {
      throw new Error('No hay sesión de equipo o proyecto compartido activo.')
    }
    await watchRemoteBugChanges(status.project.id)
    return { ok: true }
  } catch (err) {
    const message = errorMessage(err)
    log('error', `Error conectando realtime: ${message}`)
    return { ok: false, error: message }
  }
})

// ─── IPC: Cache ───────────────────────────────────────────────────────────────

ipcMain.handle(IPC_CHANNELS.cacheStats, () => getCacheStats(getCacheDir()))

ipcMain.handle(IPC_CHANNELS.cacheClear, () => {
  clearCache(getCacheDir())
  return { ok: true }
})

// ─── IPC: Reset (restablecer) ───────────────────────────────────────────────────
// Dos scopes destructivos, separados a propósito:
//  - 'bug-data': alcance legado. No borra Supabase.
//  - 'config':   settings.json → vuelve a defaults (incl. onboarded:false → wizard).
// No toca la caché de análisis (tiene su propio botón) ni las sesiones de Google.
// Tras borrar, reinicia la app para arrancar desde un estado limpio.

ipcMain.handle(IPC_CHANNELS.appReset, (_e, { scope }: { scope: AppResetScope }) => {
  resetAppSettings(scope, getConfigPath())
  // Reiniciar para que el renderer arranque sin estado en memoria.
  app.relaunch()
  app.quit()
  return { ok: true }
})

// ─── IPC: Export ─────────────────────────────────────────────────────────────

ipcMain.handle(
  IPC_CHANNELS.exportExcel,
  async (_e, { originalPath, results }: { originalPath: string; results: AnalyzedBug[] }) => {
    const defaultName = enrichedExcelDefaultName(originalPath)
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    })

    if (canceled || !filePath) return { ok: false }

    try {
      exportEnrichedExcel(filePath, originalPath, results)
      log('info', `Excel exportado: ${filePath}`)
      return { ok: true, filePath }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log('error', `Error exportando: ${message}`)
      return { ok: false, error: message }
    }
  },
)

// Export desde cero (sin Excel original): para bugs cargados a mano o mezclados.
ipcMain.handle(IPC_CHANNELS.exportBugs, async (_e, { results }: { results: AnalyzedBug[] }) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: 'bugs_analizados.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  })

  if (canceled || !filePath) return { ok: false }

  try {
    exportBugsExcel(filePath, results)
    log('info', `Excel exportado: ${filePath}`)
    return { ok: true, filePath }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log('error', `Error exportando: ${message}`)
    return { ok: false, error: message }
  }
})

// Export completo sin aplanar: conserva RawBug, rawRow, Google Docs leídos,
// imágenes base64, análisis, rawResponse del LLM, errores, estado y tiempos.
ipcMain.handle(
  IPC_CHANNELS.exportFullData,
  async (_e, { excelPath, results }: { excelPath: string | null; results: AnalyzedBug[] }) => {
    const defaultName = fullDataDefaultName(excelPath)
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })

    if (canceled || !filePath) return { ok: false }

    try {
      exportFullDataJson(filePath, results, excelPath)
      log('info', `Datos completos exportados: ${filePath}`)
      return { ok: true, filePath }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log('error', `Error exportando datos completos: ${message}`)
      return { ok: false, error: message }
    }
  },
)

// ─── IPC: Dialogs & misc ─────────────────────────────────────────────────────

ipcMain.handle(IPC_CHANNELS.dialogOpenExcel, async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls', 'csv'] }],
  })
  return result.canceled ? null : result.filePaths[0]
})

// ─── Ollama helpers ───────────────────────────────────────────────────────────

ipcMain.handle(IPC_CHANNELS.opencodeCheck, async () => checkOpenCode())
ipcMain.handle(IPC_CHANNELS.opencodeRepair, async () => repairOpenCode())

app.on('before-quit', () => {
  stopManagedOllama()
})

ipcMain.handle(IPC_CHANNELS.llmCheckOllama, async () => {
  const s = loadSettings()
  const baseUrl = s.ollamaBaseUrl || 'http://localhost:11434'
  return checkOllamaAvailability(baseUrl)
})

ipcMain.handle(IPC_CHANNELS.llmStartOllama, async () => {
  const s = loadSettings()
  const baseUrl = s.ollamaBaseUrl || 'http://localhost:11434'
  const result = await ensureOllamaRunning(baseUrl, (message) => log('info', message))
  if (result.alreadyRunning) return { ok: true, message: 'Ollama ya estaba corriendo' }
  if (result.started) return { ok: true, message: 'Ollama iniciado correctamente' }
  return { ok: false, message: 'No se encontró el binario de Ollama — instalalo primero' }
})

ipcMain.handle(IPC_CHANNELS.hardwareProbe, async (): Promise<HardwareProbe> => {
  const s = loadSettings()
  const baseUrl = s.ollamaBaseUrl || 'http://localhost:11434'
  const model = s.llmModel || 'qwen2.5:7b'
  return probeHardware(baseUrl, model, {
    ensureRunning: (ollamaBaseUrl) =>
      ensureOllamaRunning(ollamaBaseUrl, (message) => log('info', message)),
  })
})
