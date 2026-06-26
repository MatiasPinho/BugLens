import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as dotenv from 'dotenv'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'

// Load .env from project root (dev) or app resources (prod)
const envPath = app.isPackaged
  ? path.join(process.resourcesPath, '.env')
  : path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

import { clearCache, getCacheStats } from '../src/llm/analysisCache.js'
import { getLLMConfig } from '../src/llm/client.js'
import { analyzeBug } from '../src/llm/fastTriage.js'
import { resolveConcurrency } from '../src/llm/runtimeConfig.js'
import { BrowserDocsReader } from '../src/pipeline/browserDocsReader.js'
import { BugEnricher } from '../src/pipeline/bugEnricher.js'
import { readExcel, writeBugsExcel, writeEnrichedExcel } from '../src/pipeline/excelReader.js'
import { writeFullDataJson } from '../src/pipeline/fullDataExport.js'
import { GoogleDocsReader } from '../src/pipeline/googleDocsReader.js'
import { buildManualBug, type ManualBugFields } from '../src/pipeline/manualBugBuilder.js'
import {
  createRemoteBugImport,
  deleteRemoteBug,
  loadRemoteAnalyzedBugs,
  type RemoteAnalysisContext,
  saveRemoteAnalysisResult,
  setRemoteBugStatus,
} from '../src/supabase/teamBugs.js'
import {
  createSupabaseProject,
  createSupabaseTeamClient,
  getSupabaseTeamStatus,
  type SupabaseTeamConfig,
  signOutSupabaseTeam,
  startSupabaseGoogleAuth,
} from '../src/supabase/teamClient.js'
import type {
  AnalyzedBug,
  BugStatus,
  LLMConfig,
  PerformanceMode,
  RawBug,
} from '../src/types/index.js'

function getCacheDir(): string {
  return path.join(app.getPath('userData'), 'analysis-cache')
}

function getSupabaseSessionPath(): string {
  return path.join(app.getPath('userData'), 'supabase-session.json')
}

// ─── Simple JSON config store ─────────────────────────────────────────────────
// Replaces electron-store to avoid ESM/CJS conflicts.

interface AppSettings {
  googleClientId: string
  googleClientSecret: string
  llmProvider: string
  llmModel: string
  ollamaBaseUrl: string
  // Rendimiento: 'gpu' (paralelismo/timeout normales) o 'cpu' (serie + timeout largo).
  performanceMode: PerformanceMode
  supabaseUrl: string
  supabasePublishableKey: string
  supabaseDefaultProjectSlug: string
  supabaseDefaultProjectName: string
  supabaseActiveProjectId: string
  // Marca de primer arranque: false hasta que el usuario completa el wizard inicial.
  onboarded: boolean
}

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

function loadSettings(): AppSettings {
  const defaults: AppSettings = {
    googleClientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
    googleClientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
    llmProvider: process.env['LLM_PROVIDER'] ?? 'ollama',
    llmModel: process.env['LLM_MODEL'] ?? process.env['OLLAMA_MODEL'] ?? 'qwen2.5:7b',
    ollamaBaseUrl: process.env['OLLAMA_BASE_URL'] ?? 'http://localhost:11434',
    performanceMode: process.env['LLM_PERFORMANCE_MODE'] === 'cpu' ? 'cpu' : 'gpu',
    supabaseUrl: process.env['SUPABASE_URL'] ?? '',
    supabasePublishableKey:
      process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['SUPABASE_ANON_KEY'] ?? '',
    supabaseDefaultProjectSlug: process.env['SUPABASE_DEFAULT_PROJECT_SLUG'] ?? 'buglens-default',
    supabaseDefaultProjectName: process.env['SUPABASE_DEFAULT_PROJECT_NAME'] ?? 'buglens',
    supabaseActiveProjectId: process.env['SUPABASE_ACTIVE_PROJECT_ID'] ?? '',
    onboarded: false,
  }

  const configPath = getConfigPath()
  if (!fs.existsSync(configPath)) return defaults

  try {
    const saved = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Partial<AppSettings>
    return { ...defaults, ...saved }
  } catch {
    return defaults
  }
}

function saveSettings(patch: Partial<AppSettings>): void {
  const current = loadSettings()
  const updated = { ...current, ...patch }
  fs.mkdirSync(path.dirname(getConfigPath()), { recursive: true })
  fs.writeFileSync(getConfigPath(), JSON.stringify(updated, null, 2))
}

function loadSupabaseTeamConfig(): SupabaseTeamConfig {
  const s = loadSettings()
  return {
    url: s.supabaseUrl,
    publishableKey: s.supabasePublishableKey,
    defaultProjectSlug: s.supabaseDefaultProjectSlug,
    defaultProjectName: s.supabaseDefaultProjectName,
    activeProjectId: s.supabaseActiveProjectId || undefined,
  }
}

function makeSupabaseTeamClient() {
  return createSupabaseTeamClient(loadSupabaseTeamConfig(), getSupabaseSessionPath())
}

// ─── Window ───────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null
let remoteBugsChannel: ReturnType<
  NonNullable<ReturnType<typeof makeSupabaseTeamClient>>['channel']
> | null = null
let watchedProjectId: string | null = null

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

function sendToRenderer(channel: string, payload: unknown): void {
  mainWindow?.webContents.send(channel, payload)
}

function log(level: 'info' | 'warn' | 'error', message: string): void {
  console.log(`[${level.toUpperCase()}] ${message}`)
  sendToRenderer('log', {
    type: 'log',
    level,
    message,
    timestamp: new Date().toISOString(),
  })
}

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
  if (watchedProjectId === projectId && remoteBugsChannel) return

  const client = makeSupabaseTeamClient()
  if (!client) throw new Error('Supabase no está configurado.')

  if (remoteBugsChannel) {
    await client.removeChannel(remoteBugsChannel)
    remoteBugsChannel = null
    watchedProjectId = null
  }

  remoteBugsChannel = client
    .channel(`project-bugs:${projectId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bugs',
        filter: `project_id=eq.${projectId}`,
      },
      () => {
        sendToRenderer('remote-bugs-changed', { type: 'remote-bugs-changed' })
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') log('info', 'Realtime de bugs conectado')
      if (status === 'CHANNEL_ERROR') log('warn', 'Realtime de bugs tuvo un error')
    })

  watchedProjectId = projectId
}

async function unwatchRemoteBugChanges(): Promise<void> {
  if (!remoteBugsChannel) return
  const client = makeSupabaseTeamClient()
  if (client) await client.removeChannel(remoteBugsChannel)
  remoteBugsChannel = null
  watchedProjectId = null
}

// ─── Lazy singleton factories ─────────────────────────────────────────────────

function makeGoogleReader(): GoogleDocsReader {
  const s = loadSettings()
  const tokenPath = path.join(app.getPath('userData'), 'google-token.json')
  return new GoogleDocsReader(s.googleClientId, s.googleClientSecret, tokenPath)
}

function makeBrowserReader(): BrowserDocsReader {
  return new BrowserDocsReader(app.getPath('userData'))
}

// ─── IPC: Settings ────────────────────────────────────────────────────────────

ipcMain.handle('settings:get', () => loadSettings())

ipcMain.handle('settings:save', (_e, patch: Partial<AppSettings>) => {
  saveSettings(patch)
  return { ok: true }
})

ipcMain.handle('settings:pick-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

// ─── IPC: Supabase team auth ─────────────────────────────────────────────────

ipcMain.handle('supabase:status', async () => {
  try {
    const status = await getSupabaseTeamStatus(makeSupabaseTeamClient(), loadSupabaseTeamConfig())
    if (status.authenticated && status.project) {
      saveSettings({ supabaseActiveProjectId: status.project.id })
      await watchRemoteBugChanges(status.project.id).catch((err) => {
        log('warn', `No se pudo conectar realtime: ${errorMessage(err)}`)
      })
    }
    return status
  } catch (err) {
    return {
      configured: Boolean(loadSupabaseTeamConfig().url && loadSupabaseTeamConfig().publishableKey),
      authenticated: false,
      error: errorMessage(err),
    }
  }
})

ipcMain.handle('supabase:start-google-auth', async () => {
  try {
    const config = loadSupabaseTeamConfig()
    const client = createSupabaseTeamClient(config, getSupabaseSessionPath())
    if (!client) {
      return {
        configured: false,
        authenticated: false,
        error: 'Configurá SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY antes de iniciar sesión.',
      }
    }
    const status = await startSupabaseGoogleAuth(client, config, shell)
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
    return {
      configured: Boolean(loadSupabaseTeamConfig().url && loadSupabaseTeamConfig().publishableKey),
      authenticated: false,
      error: message,
    }
  }
})

ipcMain.handle('supabase:sign-out', async () => {
  await unwatchRemoteBugChanges()
  await signOutSupabaseTeam(makeSupabaseTeamClient())
  return { ok: true }
})

ipcMain.handle('supabase:select-project', async (_e, { projectId }: { projectId: string }) => {
  try {
    saveSettings({ supabaseActiveProjectId: projectId })
    const status = await getSupabaseTeamStatus(makeSupabaseTeamClient(), loadSupabaseTeamConfig())
    if (status.authenticated && status.project) {
      saveSettings({ supabaseActiveProjectId: status.project.id })
      await watchRemoteBugChanges(status.project.id)
    }
    return status
  } catch (err) {
    const message = errorMessage(err)
    log('error', `Error seleccionando proyecto: ${message}`)
    return {
      configured: Boolean(loadSupabaseTeamConfig().url && loadSupabaseTeamConfig().publishableKey),
      authenticated: false,
      error: message,
    }
  }
})

ipcMain.handle(
  'supabase:create-project',
  async (_e, { name, slug }: { name: string; slug: string }) => {
    try {
      const client = makeSupabaseTeamClient()
      if (!client) throw new Error('Supabase no está configurado.')
      const project = await createSupabaseProject(client, name, slug)
      saveSettings({ supabaseActiveProjectId: project.id })
      const status = await getSupabaseTeamStatus(client, loadSupabaseTeamConfig())
      await watchRemoteBugChanges(project.id)
      log('info', `proyecto creado: ${project.name}`)
      return status
    } catch (err) {
      const message = errorMessage(err)
      log('error', `Error creando proyecto: ${message}`)
      return {
        configured: Boolean(
          loadSupabaseTeamConfig().url && loadSupabaseTeamConfig().publishableKey,
        ),
        authenticated: false,
        error: message,
      }
    }
  },
)

// ─── IPC: Google Auth ─────────────────────────────────────────────────────────

ipcMain.handle('google:auth-status', () => {
  return { authenticated: makeGoogleReader().isAuthenticated() }
})

ipcMain.handle('google:start-auth', async () => {
  const reader = makeGoogleReader()
  const authUrl = reader.getAuthUrl()
  await shell.openExternal(authUrl)
  try {
    await reader.waitForCallback()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
})

ipcMain.handle('google:revoke', async () => {
  await makeGoogleReader().revokeAuth()
  return { ok: true }
})

// ─── IPC: Browser-based Google Auth (cookie session, no OAuth) ───────────────

ipcMain.handle('browser-auth:status', () => {
  return { authenticated: makeBrowserReader().isAuthenticated() }
})

ipcMain.handle('browser-auth:start-login', async () => {
  const reader = makeBrowserReader()
  try {
    await reader.startLoginFlow()
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log('error', `Error en login del navegador: ${message}`)
    return { ok: false, error: message }
  }
})

ipcMain.handle('browser-auth:revoke', () => {
  makeBrowserReader().revokeSession()
  return { ok: true }
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
  const start = Date.now()

  try {
    const s = loadSettings()
    const llmConfig: LLMConfig = getLLMConfig({
      provider: s.llmProvider as LLMConfig['provider'],
      model: s.llmModel,
      baseUrl: s.ollamaBaseUrl,
      performanceMode: s.performanceMode,
    })
    const teamClient = makeSupabaseTeamClient()
    if (!teamClient) throw new Error('Supabase no está configurado.')
    const remoteClient = teamClient
    const teamConfig = loadSupabaseTeamConfig()
    const importId = await createRemoteBugImport(teamClient, teamConfig, {
      sourceType,
      sourceName,
      sourcePath,
      rowCount: bugs.length,
    })
    const remoteContext: RemoteAnalysisContext = {
      importId,
      sourceType,
      provider: llmConfig.provider,
      model: llmConfig.model,
    }

    // Auto-levantar Ollama si es el provider elegido y no está corriendo
    if (s.llmProvider === 'ollama') {
      const baseUrl = s.ollamaBaseUrl || 'http://localhost:11434'
      const { started, alreadyRunning } = await ensureOllamaRunning(baseUrl)
      if (started) log('info', 'Ollama iniciado automáticamente')
      else if (alreadyRunning) log('info', 'Ollama ya estaba corriendo')
      else log('warn', 'No se pudo levantar Ollama — el análisis puede fallar')
    }

    // Prefer browser-session reader (no OAuth, company can't see it in Cloud Console)
    // Fall back to OAuth reader if browser session is not set up
    const browserReader = makeBrowserReader()
    const oauthReader = makeGoogleReader()

    let docsReader: {
      readDocuments(urls: string[]): Promise<import('../src/types/index.js').GoogleDocContent[]>
    } | null = null
    if (browserReader.isAuthenticated()) {
      docsReader = browserReader
      log('info', 'Acceso a Google Docs via sesión del navegador')
    } else if (oauthReader.isAuthenticated()) {
      docsReader = oauthReader
      log('info', 'Acceso a Google Docs via OAuth (sin capturas — requiere sesión del navegador)')
    } else {
      log('warn', 'Google no autenticado — bugs sin documentos de evidencia')
    }

    const enricher = new BugEnricher(docsReader)

    // Paralelismo por proveedor (cloud tolera más; Ollama queuea internamente, pero N
    // workers evitan head-of-line blocking). En modo CPU baja a 1; override global vía
    // LLM_CONCURRENCY (ver resolveConcurrency).
    const concurrency = resolveConcurrency(llmConfig.provider, {
      performanceMode: s.performanceMode,
    })

    log(
      'info',
      `Paralelismo: ${concurrency} bugs simultáneos (${llmConfig.provider}, modo ${s.performanceMode})`,
    )

    // Results array preserves original order
    const results: AnalyzedBug[] = new Array(bugs.length)
    let completed = 0

    // Worker-pool pattern: N workers consume from shared queue
    async function processBug(i: number): Promise<void> {
      const bug = bugs[i]
      const bugStart = Date.now()

      log('info', `[${i + 1}/${bugs.length}] ${bug.title}`)

      try {
        const enriched = await enricher.enrich(bug)

        for (const doc of enriched.googleDocs) {
          if (!doc.accessible) log('warn', `  Doc no accesible: ${doc.url}`)
          else {
            const imgCount = doc.images?.length ?? 0
            log(
              'info',
              `  Doc leído: ${doc.title}${imgCount > 0 ? ` (${imgCount} imagen${imgCount > 1 ? 'es' : ''})` : ''}`,
            )
          }
        }

        // Clasificar + reescribir el bug (una sola llamada LLM, sin tocar repos).
        const { analysis, fromCache } = await analyzeBug(enriched, llmConfig, getCacheDir())
        if (fromCache) log('info', `  ✓ desde cache`)
        const result: AnalyzedBug = {
          enriched,
          analysis,
          status: 'nuevo',
          processingMs: Date.now() - bugStart,
        }

        results[i] = result
        await saveRemoteAnalysisResult(remoteClient, teamConfig, result, remoteContext)
        completed++

        log(
          'info',
          `✓ [${completed}/${bugs.length}] ${analysis.severity} ${analysis.category} — ${bug.title}`,
        )

        // Stream result to renderer immediately — don't wait for all bugs
        sendToRenderer('bug-result', {
          type: 'bug-result',
          result,
          current: completed,
          total: bugs.length,
        })
        sendToRenderer('progress', {
          type: 'progress',
          phase: 'analyzing',
          message: `${completed}/${bugs.length} analizados — ${bug.title}`,
          current: completed,
          total: bugs.length,
        })
      } catch (err) {
        const message = errorMessage(err)
        log('error', `✗ Bug ${i + 1} falló: ${message}`)
        const result: AnalyzedBug = {
          enriched: { raw: bug, googleDocs: [] },
          analysis: {
            category: 'otro',
            severity: 'low',
            confidence: 0,
            affectedArea: 'No informado',
            summary: 'Error durante el análisis',
            rewritten: {
              observed: 'No informado',
              expected: 'No informado',
              steps: [],
              environment: 'No informado',
              problemCount: 1,
            },
            missingInformation: [],
            rawResponse: message,
          },
          status: 'nuevo',
          error: message,
          processingMs: Date.now() - bugStart,
        }
        results[i] = result
        await saveRemoteAnalysisResult(remoteClient, teamConfig, result, remoteContext)
        completed++

        sendToRenderer('bug-result', {
          type: 'bug-result',
          result,
          current: completed,
          total: bugs.length,
        })
        sendToRenderer('progress', {
          type: 'progress',
          message: `${completed}/${bugs.length} analizados`,
          current: completed,
          total: bugs.length,
        })
      }
    }

    // Run workers: each picks the next unstarted bug until all are done
    let nextIdx = 0
    async function worker() {
      while (nextIdx < bugs.length) {
        const i = nextIdx++
        await processBug(i)
      }
    }

    sendToRenderer('progress', {
      type: 'progress',
      phase: 'analyzing',
      message: `analizando ${bugs.length} bugs (x${concurrency})`,
      current: 0,
      total: bugs.length,
    })
    await Promise.all(Array.from({ length: Math.min(concurrency, bugs.length) }, worker))

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)
    log(
      'info',
      `Análisis completado en ${elapsed}s (${(bugs.length / parseFloat(elapsed)).toFixed(1)} bugs/s)`,
    )
    sendToRenderer('progress', {
      type: 'progress',
      phase: 'done',
      message: `completado en ${elapsed}s`,
      current: bugs.length,
      total: bugs.length,
    })
    if (emitComplete) {
      sendToRenderer('analysis-complete', { type: 'complete', results: results.filter(Boolean) })
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
ipcMain.handle('analyze:run', async (_e, excelPath: string) => {
  try {
    sendToRenderer('progress', {
      type: 'progress',
      phase: 'reading_excel',
      message: 'leyendo Excel...',
      current: 0,
      total: 0,
    })
    log('info', `Leyendo Excel: ${excelPath}`)
    const bugs = readExcel(excelPath)
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
ipcMain.handle('analyze:manual-bug', async (_e, fields: ManualBugFields) => {
  try {
    const bug = buildManualBug(fields, ++manualBugCounter)
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

// ─── IPC: Cache ───────────────────────────────────────────────────────────────

// ─── IPC: Estado de bugs (persistente) ───────────────────────────────────────

ipcMain.handle(
  'bug:set-status',
  async (_e, { bug, status }: { bug: AnalyzedBug; status: BugStatus }) => {
    try {
      const client = makeSupabaseTeamClient()
      if (!client) throw new Error('Supabase no está configurado.')
      await setRemoteBugStatus(client, loadSupabaseTeamConfig(), bug.enriched.raw, status)
      return { ok: true }
    } catch (err) {
      const message = errorMessage(err)
      log('error', `Error guardando estado remoto: ${message}`)
      return { ok: false, error: message }
    }
  },
)

ipcMain.handle('bugs:load-remote', async () => {
  try {
    const client = makeSupabaseTeamClient()
    if (!client) throw new Error('Supabase no está configurado.')
    const results = await loadRemoteAnalyzedBugs(client, loadSupabaseTeamConfig())
    return { ok: true, results }
  } catch (err) {
    const message = errorMessage(err)
    log('error', `Error cargando bugs remotos: ${message}`)
    return { ok: false, error: message, results: [] }
  }
})

ipcMain.handle('bug:delete', async (_e, { bug }: { bug: AnalyzedBug }) => {
  try {
    const client = makeSupabaseTeamClient()
    if (!client) throw new Error('Supabase no está configurado.')
    await deleteRemoteBug(client, loadSupabaseTeamConfig(), bug.enriched.raw)
    return { ok: true }
  } catch (err) {
    const message = errorMessage(err)
    log('error', `Error borrando bug remoto: ${message}`)
    return { ok: false, error: message }
  }
})

ipcMain.handle('bugs:watch-remote', async () => {
  try {
    const status = await getSupabaseTeamStatus(makeSupabaseTeamClient(), loadSupabaseTeamConfig())
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

ipcMain.handle('cache:stats', () => getCacheStats(getCacheDir()))

ipcMain.handle('cache:clear', () => {
  clearCache(getCacheDir())
  return { ok: true }
})

// ─── IPC: Reset (restablecer) ───────────────────────────────────────────────────
// Dos scopes destructivos, separados a propósito:
//  - 'bug-data': alcance legado. No borra Supabase.
//  - 'config':   settings.json → vuelve a defaults (incl. onboarded:false → wizard).
// No toca la caché de análisis (tiene su propio botón) ni las sesiones de Google.
// Tras borrar, reinicia la app para arrancar desde un estado limpio.

function removeFileIfExists(filePath: string): void {
  try {
    fs.rmSync(filePath, { force: true })
  } catch {
    // best-effort: si no se puede borrar, el reinicio igual no rompe nada
  }
}

ipcMain.handle('app:reset', (_e, { scope }: { scope: 'bug-data' | 'config' }) => {
  if (scope === 'config') {
    removeFileIfExists(getConfigPath())
  }
  // Reiniciar para que el renderer arranque sin estado en memoria.
  app.relaunch()
  app.quit()
  return { ok: true }
})

// ─── IPC: Export ─────────────────────────────────────────────────────────────

ipcMain.handle(
  'export:excel',
  async (_e, { originalPath, results }: { originalPath: string; results: AnalyzedBug[] }) => {
    const defaultName = `${path.basename(originalPath, path.extname(originalPath))}_analizado.xlsx`
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    })

    if (canceled || !filePath) return { ok: false }

    try {
      writeEnrichedExcel(
        filePath,
        originalPath,
        results.map((r) => ({
          rowIndex: r.enriched.raw.rowIndex,
          category: r.analysis.category,
          severity: r.analysis.severity,
          bugType: r.analysis.bugType ?? '',
          confidence: r.analysis.confidence,
          summary: r.analysis.summary,
          observed: r.analysis.rewritten.observed,
          expected: r.analysis.rewritten.expected,
          steps: r.analysis.rewritten.steps,
          environment: r.analysis.rewritten.environment,
          missingInformation: r.analysis.missingInformation,
          error: r.error,
        })),
      )
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
ipcMain.handle('export:bugs', async (_e, { results }: { results: AnalyzedBug[] }) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: 'bugs_analizados.xlsx',
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  })

  if (canceled || !filePath) return { ok: false }

  try {
    writeBugsExcel(
      filePath,
      results.map((r) => ({
        title: r.enriched.raw.title,
        rowIndex: r.enriched.raw.rowIndex,
        category: r.analysis.category,
        severity: r.analysis.severity,
        bugType: r.analysis.bugType ?? '',
        confidence: r.analysis.confidence,
        summary: r.analysis.summary,
        observed: r.analysis.rewritten.observed,
        expected: r.analysis.rewritten.expected,
        steps: r.analysis.rewritten.steps,
        environment: r.analysis.rewritten.environment,
        missingInformation: r.analysis.missingInformation,
        error: r.error,
      })),
    )
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
  'export:full-data',
  async (_e, { excelPath, results }: { excelPath: string | null; results: AnalyzedBug[] }) => {
    const defaultName = excelPath
      ? `${path.basename(excelPath, path.extname(excelPath))}_datos_completos.json`
      : 'bugs_datos_completos.json'
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow!, {
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })

    if (canceled || !filePath) return { ok: false }

    try {
      writeFullDataJson(filePath, results, excelPath)
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

ipcMain.handle('dialog:open-excel', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls', 'csv'] }],
  })
  return result.canceled ? null : result.filePaths[0]
})

// ─── Ollama helpers ───────────────────────────────────────────────────────────

let ollamaProcess: cp.ChildProcess | null = null

/** Busca el binario de ollama en rutas comunes. */
function findOllamaBin(): string | null {
  const env = process.env
  // OLLAMA_BIN (override explícito) primero, en cualquier plataforma.
  const candidates: Array<string | null | undefined> = [env['OLLAMA_BIN']]

  if (process.platform === 'win32') {
    const localApp = env['LOCALAPPDATA']
    const programFiles = env['ProgramFiles']
    candidates.push(
      localApp ? path.join(localApp, 'Programs', 'Ollama', 'ollama.exe') : null,
      programFiles ? path.join(programFiles, 'Ollama', 'ollama.exe') : null,
    )
  } else {
    candidates.push(
      env['HOME'] ? path.join(env['HOME'], '.local', 'bin', 'ollama') : null,
      '/usr/local/bin/ollama',
      '/usr/bin/ollama',
      '/opt/homebrew/bin/ollama',
    )
  }

  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p
  }
  return null
}

/** Pinga Ollama. Devuelve true si responde. */
async function pingOllama(baseUrl: string): Promise<boolean> {
  try {
    const r = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
    return r.ok
  } catch {
    return false
  }
}

/** Intenta levantar `ollama serve` si no está corriendo. */
async function ensureOllamaRunning(
  baseUrl: string,
): Promise<{ started: boolean; alreadyRunning: boolean }> {
  if (await pingOllama(baseUrl)) return { started: false, alreadyRunning: true }

  const bin = findOllamaBin()
  if (!bin) return { started: false, alreadyRunning: false }

  log('info', `Levantando Ollama: ${bin}`)
  // HSA_OVERRIDE_GFX_VERSION=10.3.0 is required for AMD RDNA2 GPUs (RX 6xxx series, gfx1030/1031/1032)
  // that are not in Ollama's bundled ROCm TensileLibrary. Maps gfx1032 → gfx1030 codepath.
  // Solo aplica al ROCm de Linux; en Windows/macOS no corresponde.
  // OLLAMA_NUM_PARALLEL: sin esto ollama sirve los requests casi en serie, así que
  // analizar un batch grande tarda muchísimo. 3 slots paralelos comparten los pesos
  // del modelo (solo suman KV cache chico) y aceleran el throughput del batch.
  ollamaProcess = cp.spawn(bin, ['serve'], {
    detached: false,
    stdio: 'ignore',
    env: {
      ...process.env,
      ...(process.platform === 'linux' ? { HSA_OVERRIDE_GFX_VERSION: '10.3.0' } : {}),
      OLLAMA_NUM_PARALLEL: '3',
    },
  })
  ollamaProcess.unref()

  // Esperar hasta 15 s a que responda
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 800))
    if (await pingOllama(baseUrl)) {
      log('info', 'Ollama levantado correctamente')
      return { started: true, alreadyRunning: false }
    }
  }

  return { started: false, alreadyRunning: false }
}

// Cerrar ollama al salir de la app (solo si lo levantamos nosotros)
app.on('before-quit', () => {
  if (ollamaProcess) {
    ollamaProcess.kill()
    ollamaProcess = null
  }
})

ipcMain.handle('llm:check-ollama', async () => {
  const s = loadSettings()
  const baseUrl = s.ollamaBaseUrl || 'http://localhost:11434'
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) return { available: false }
    const data = (await response.json()) as { models?: Array<{ name: string }> }
    return { available: true, models: data.models?.map((m) => m.name) ?? [] }
  } catch {
    return { available: false, models: [] }
  }
})

ipcMain.handle('llm:start-ollama', async () => {
  const s = loadSettings()
  const baseUrl = s.ollamaBaseUrl || 'http://localhost:11434'
  const result = await ensureOllamaRunning(baseUrl)
  if (result.alreadyRunning) return { ok: true, message: 'Ollama ya estaba corriendo' }
  if (result.started) return { ok: true, message: 'Ollama iniciado correctamente' }
  return { ok: false, message: 'No se encontró el binario de Ollama — instalalo primero' }
})

// ─── Sondeo de hardware (GPU vs CPU) ────────────────────────────────────────────
// La forma honesta de saber si el modelo correrá en GPU o CPU es preguntarle a Ollama:
// cargamos el modelo con una generación mínima y leemos /api/ps. `size_vram > 0`
// significa que Ollama lo está corriendo (al menos en parte) en la GPU.

type Accelerator = 'gpu' | 'cpu' | 'unknown'

interface HardwareProbe {
  accelerator: Accelerator
  detail: string
  model?: string
}

interface OllamaPsModel {
  name: string
  model?: string
  size?: number
  size_vram?: number
}

async function probeAccelerator(baseUrl: string, model: string): Promise<HardwareProbe> {
  const running = await ensureOllamaRunning(baseUrl)
  if (!running.started && !running.alreadyRunning) {
    return { accelerator: 'unknown', detail: 'Ollama no está disponible (instalalo y reintentá)' }
  }

  // ¿Está descargado el modelo? Sin él no podemos cargar nada.
  try {
    const tags = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) })
    const data = (await tags.json()) as { models?: Array<{ name: string }> }
    const names = data.models?.map((m) => m.name) ?? []
    const isDownloaded = names.some((n) => n === model || n.split(':')[0] === model.split(':')[0])
    if (!isDownloaded) {
      return { accelerator: 'unknown', detail: `El modelo "${model}" no está descargado todavía` }
    }
  } catch {
    return { accelerator: 'unknown', detail: 'No se pudo consultar Ollama' }
  }

  // Cargar el modelo con una generación mínima (puede tardar en CPU — es esperable).
  try {
    await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: 'hi', stream: false, options: { num_predict: 1 } }),
      signal: AbortSignal.timeout(120_000),
    })
  } catch {
    return { accelerator: 'unknown', detail: 'No se pudo cargar el modelo para el sondeo' }
  }

  // Leer qué tiene cargado y cuánta VRAM usa.
  try {
    const ps = await fetch(`${baseUrl}/api/ps`, { signal: AbortSignal.timeout(5000) })
    const data = (await ps.json()) as { models?: OllamaPsModel[] }
    const loaded =
      data.models?.find((m) => (m.model ?? m.name) === model || m.name === model) ??
      data.models?.[0]
    if (!loaded) {
      return { accelerator: 'unknown', detail: 'Ollama no reportó el modelo cargado', model }
    }
    const vram = loaded.size_vram ?? 0
    if (vram > 0) {
      return { accelerator: 'gpu', detail: 'El modelo corre en la GPU', model }
    }
    return {
      accelerator: 'cpu',
      detail: 'El modelo corre en CPU — el análisis será lento y puede cortar por timeout',
      model,
    }
  } catch {
    return { accelerator: 'unknown', detail: 'No se pudo leer el estado de Ollama', model }
  }
}

ipcMain.handle('hardware:probe', async (): Promise<HardwareProbe> => {
  const s = loadSettings()
  const baseUrl = s.ollamaBaseUrl || 'http://localhost:11434'
  const model = s.llmModel || 'qwen2.5:7b'
  return probeAccelerator(baseUrl, model)
})
