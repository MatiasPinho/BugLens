import type { AnalyzedBug, EnrichedBug, RawBug } from '../../../shared/contracts/bugTypes.js'
import type { LLMConfig, PerformanceMode } from '../../../shared/contracts/settingsTypes.js'
import { resolveConcurrency } from '../infrastructure/runtimeConfig.js'
import { analyzeBug, selectLLMConfigForBug } from './fastTriage.js'

type LogLevel = 'info' | 'warn' | 'error'

export interface BatchProgress {
  phase?: 'analyzing' | 'done'
  message: string
  current: number
  total: number
}

export interface BatchBugResult {
  result: AnalyzedBug
  current: number
  total: number
}

interface BugEnricherLike {
  enrich(bug: RawBug): Promise<EnrichedBug>
}

interface RunBugAnalysisBatchDeps {
  analyzeBug?: typeof analyzeBug
  selectLLMConfigForBug?: typeof selectLLMConfigForBug
  resolveConcurrency?: typeof resolveConcurrency
  now?: () => number
}

export interface RunBugAnalysisBatchOptions {
  bugs: RawBug[]
  enricher: BugEnricherLike
  llmConfig: LLMConfig
  performanceMode: PerformanceMode
  cacheDir?: string
  saveResult(result: AnalyzedBug, analysisConfig?: LLMConfig): Promise<unknown>
  onBugResult(payload: BatchBugResult): void
  onProgress(progress: BatchProgress): void
  onLog(level: LogLevel, message: string): void
}

export interface RunBugAnalysisBatchResult {
  results: AnalyzedBug[]
  elapsedSeconds: string
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function makeErrorResult(bug: RawBug, message: string, processingMs: number): AnalyzedBug {
  return {
    enriched: { raw: bug, googleDocs: [] },
    analysis: {
      category: 'otro',
      severity: 'low',
      confidence: 0,
      affectedArea: 'No informado',
      summary: 'Error durante el analisis',
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
    processingMs,
  }
}

export async function runBugAnalysisBatch(
  options: RunBugAnalysisBatchOptions,
  deps: RunBugAnalysisBatchDeps = {},
): Promise<RunBugAnalysisBatchResult> {
  const now = deps.now ?? Date.now
  const analyzeBugFn = deps.analyzeBug ?? analyzeBug
  const selectConfig = deps.selectLLMConfigForBug ?? selectLLMConfigForBug
  const resolveConcurrencyFn = deps.resolveConcurrency ?? resolveConcurrency
  const start = now()
  const {
    bugs,
    enricher,
    llmConfig,
    performanceMode,
    cacheDir,
    saveResult,
    onBugResult,
    onProgress,
    onLog,
  } = options
  const concurrency = resolveConcurrencyFn(llmConfig.provider, { performanceMode })

  onLog(
    'info',
    `Paralelismo: ${concurrency} bugs simultaneos (${llmConfig.provider}, modo ${performanceMode})`,
  )

  const results: AnalyzedBug[] = new Array(bugs.length)
  let completed = 0

  async function processBug(index: number): Promise<void> {
    const bug = bugs[index]
    const bugStart = now()

    onLog('info', `[${index + 1}/${bugs.length}] ${bug.title}`)

    try {
      const enriched = await enricher.enrich(bug)

      for (const doc of enriched.googleDocs) {
        if (!doc.accessible) {
          onLog('warn', `  Doc no accesible: ${doc.url}`)
        } else {
          const imageCount = doc.images?.length ?? 0
          onLog(
            'info',
            `  Doc leido: ${doc.title}${imageCount > 0 ? ` (${imageCount} imagen${imageCount > 1 ? 'es' : ''})` : ''}`,
          )
        }
      }

      const analysisConfig = selectConfig(enriched, llmConfig)
      const { analysis, fromCache } = await analyzeBugFn(enriched, analysisConfig, cacheDir)
      if (fromCache) onLog('info', '  desde cache')

      const result: AnalyzedBug = {
        enriched,
        analysis,
        status: 'nuevo',
        processingMs: now() - bugStart,
      }
      results[index] = result
      await saveResult(result, analysisConfig)
      completed++

      onLog(
        'info',
        `[${completed}/${bugs.length}] ${analysis.severity} ${analysis.category} - ${bug.title}`,
      )
      onBugResult({ result, current: completed, total: bugs.length })
      onProgress({
        phase: 'analyzing',
        message: `${completed}/${bugs.length} analizados - ${bug.title}`,
        current: completed,
        total: bugs.length,
      })
    } catch (err) {
      const message = errorMessage(err)
      onLog('error', `Bug ${index + 1} fallo: ${message}`)
      const result = makeErrorResult(bug, message, now() - bugStart)
      results[index] = result
      await saveResult(result)
      completed++

      onBugResult({ result, current: completed, total: bugs.length })
      onProgress({
        message: `${completed}/${bugs.length} analizados`,
        current: completed,
        total: bugs.length,
      })
    }
  }

  let nextIndex = 0
  async function worker(): Promise<void> {
    while (nextIndex < bugs.length) {
      const index = nextIndex++
      await processBug(index)
    }
  }

  onProgress({
    phase: 'analyzing',
    message: `analizando ${bugs.length} bugs (x${concurrency})`,
    current: 0,
    total: bugs.length,
  })
  await Promise.all(Array.from({ length: Math.min(concurrency, bugs.length) }, worker))

  const elapsedSeconds = ((now() - start) / 1000).toFixed(1)
  onLog(
    'info',
    `Analisis completado en ${elapsedSeconds}s (${(bugs.length / Number.parseFloat(elapsedSeconds)).toFixed(1)} bugs/s)`,
  )
  onProgress({
    phase: 'done',
    message: `completado en ${elapsedSeconds}s`,
    current: bugs.length,
    total: bugs.length,
  })

  return { results: results.filter(Boolean), elapsedSeconds }
}
