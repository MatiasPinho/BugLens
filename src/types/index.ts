// ─── Bug raw (del Excel) ──────────────────────────────────────────────────────

export interface RawBug {
  id: string
  rowIndex: number
  title: string
  description: string
  stepsToReproduce?: string
  expectedResult?: string
  actualResult?: string
  environment?: string
  reporter?: string
  assignee?: string
  status?: string
  priority?: string
  /** Todas las celdas de la fila, por si la hoja tiene columnas no estándar */
  rawRow: Record<string, string>
  /** Links a Google Docs/Drive encontrados en cualquier celda */
  googleDocLinks: string[]
}

// ─── Documento de Google Docs ─────────────────────────────────────────────────

export interface DocImage {
  data: string // base64
  mimeType: string // 'image/png', 'image/jpeg', etc.
  alt?: string
}

export interface GoogleDocContent {
  url: string
  title: string
  text: string
  accessible: boolean
  error?: string
  images?: DocImage[]
}

// ─── Bug enriquecido (contexto para el LLM) ───────────────────────────────────

export interface EnrichedBug {
  raw: RawBug
  googleDocs: GoogleDocContent[]
}

// ─── Análisis del LLM ─────────────────────────────────────────────────────────
// El propósito de la app: cargar bugs, clasificarlos/ordenarlos, y REESCRIBIR el
// reporte (a veces incoherente) del QA en texto claro. Nada de análisis de código.

export type BugCategory = 'frontend' | 'backend' | 'database' | 'config' | 'data' | 'otro'

export type Severity = 'low' | 'medium' | 'high' | 'critical'

// La reescritura clara y estructurada del reporte original.
export interface RewrittenReport {
  observed: string // qué pasa hoy, en lenguaje claro (numerado si hay varios problemas)
  expected: string // qué debería pasar (mismo orden que observed)
  steps: string[] // pasos para reproducir, ordenados
  environment: string // ambiente (dev/prod/local… o "No informado")
  problemCount: number // cuántos problemas distintos mezcló el QA en este reporte
}

export interface BugAnalysis {
  category: BugCategory
  severity: Severity
  bugType?: string // ui | validation | routing | permissions | …
  confidence: number // 0–1

  affectedArea: string // pantalla / módulo (para agrupar y ordenar)
  summary: string // 1 oración: qué está roto (fila de la tabla)

  rewritten: RewrittenReport // versión clara y estructurada del reporte
  missingInformation: string[] // qué dato falta (para pedírselo al QA)

  rawResponse: string
  externalAgent?: ExternalAgentResult
  externalAgentHistory?: ExternalAgentResult[]
}

// ─── Análisis delegado a agente externo ──────────────────────────────────────
// BugLens no interpreta este resultado ni analiza código: ejecuta el comando
// configurado por el usuario y muestra su salida dentro de la app.

export interface ExternalAgentRepository {
  path: string
  branch: string
}

export interface ExternalAgentResult {
  ok: boolean
  output: string
  error?: string
  command: string
  workingDirectory?: string
  repositories?: ExternalAgentRepository[]
  durationMs: number
  createdAt?: string
}

export interface ExternalAgentProgress {
  bugId: string
  output: string
  chunk: string
  stream: 'stdout' | 'stderr'
  command: string
  workingDirectory?: string
  repositories?: ExternalAgentRepository[]
  elapsedMs: number
  silentMs: number
}

// Estado del ciclo de vida del bug (workflow del equipo, NO el LLM).
// Persiste por bug (clave por contenido) entre corridas. Default: 'nuevo'.
export type BugStatus = 'nuevo' | 'en_progreso' | 'solucionado' | 'cerrado' | 'no_replicado'

export interface AnalyzedBug {
  enriched: EnrichedBug
  analysis: BugAnalysis
  status: BugStatus
  comments?: BugComment[]
  error?: string
  processingMs: number
}

export interface BugComment {
  id: string
  body: string
  createdAt: string
  updatedAt?: string
  authorEmail?: string
}

// ─── Config de LLM ────────────────────────────────────────────────────────────

export type LLMProvider = 'ollama' | 'anthropic' | 'gemini' | 'openai'

// Modo de rendimiento: 'gpu' usa el paralelismo/timeout normales; 'cpu' baja el
// paralelismo a 1 y sube el timeout (sin GPU la inferencia es mucho más lenta).
export type PerformanceMode = 'gpu' | 'cpu'

export interface LLMConfig {
  provider: LLMProvider
  model?: string
  visionModel?: string
  baseUrl?: string
  apiKey?: string
  temperature?: number
  maxTokens?: number
  performanceMode?: PerformanceMode
}

// ─── Config general de la app ─────────────────────────────────────────────────

export interface AppConfig {
  llm: LLMConfig
  googleAuth: {
    clientId: string
    clientSecret: string
    tokenPath: string
  }
}

// ─── IPC messages ─────────────────────────────────────────────────────────────

export type AnalysisPhase = 'reading_excel' | 'reading_docs' | 'analyzing' | 'done' | 'error'

export interface ProgressEvent {
  type: 'progress'
  message: string
  current: number
  total: number
  phase?: AnalysisPhase
}

export interface LogEvent {
  type: 'log'
  level: 'info' | 'warn' | 'error'
  message: string
  timestamp: string
}

export interface AnalysisCompleteEvent {
  type: 'complete'
  results: AnalyzedBug[]
}

export interface BugResultEvent {
  type: 'bug-result'
  result: AnalyzedBug
  current: number
  total: number
}

export type IPCEvent = ProgressEvent | LogEvent | AnalysisCompleteEvent | BugResultEvent
