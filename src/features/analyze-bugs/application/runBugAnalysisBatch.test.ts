import { describe, expect, it, vi } from 'vitest'
import type { BugAnalysis, EnrichedBug, RawBug } from '../../../shared/contracts/bugTypes.js'
import type { LLMConfig } from '../../../shared/contracts/settingsTypes.js'
import { runBugAnalysisBatch } from './runBugAnalysisBatch.js'

function makeBug(id: string, title = `Bug ${id}`): RawBug {
  return {
    id,
    rowIndex: Number(id),
    title,
    description: 'Algo falla',
    rawRow: {},
    googleDocLinks: [],
  }
}

function makeAnalysis(summary = 'Resumen'): BugAnalysis {
  return {
    category: 'frontend',
    severity: 'medium',
    confidence: 0.9,
    affectedArea: 'login',
    summary,
    rewritten: {
      observed: 'Falla',
      expected: 'Debe funcionar',
      steps: ['abrir pantalla'],
      environment: 'qa',
      problemCount: 1,
    },
    missingInformation: [],
    rawResponse: '{}',
  }
}

const llmConfig: LLMConfig = {
  provider: 'ollama',
  model: 'qwen2.5:7b',
  performanceMode: 'gpu',
}

describe('runBugAnalysisBatch', () => {
  it('analiza bugs, persiste resultados y emite progreso', async () => {
    const bugs = [makeBug('1', 'Login roto'), makeBug('2', 'Alta rota')]
    const saved: string[] = []
    const progress: string[] = []
    const bugResults: string[] = []
    let clock = 100

    const result = await runBugAnalysisBatch(
      {
        bugs,
        enricher: {
          enrich: vi.fn(
            async (bug: RawBug): Promise<EnrichedBug> => ({ raw: bug, googleDocs: [] }),
          ),
        },
        llmConfig,
        performanceMode: 'gpu',
        cacheDir: 'cache',
        saveResult: vi.fn(async (analyzedBug, analysisConfig) => {
          saved.push(`${analyzedBug.enriched.raw.id}:${analysisConfig?.model}`)
        }),
        onBugResult: (payload) => bugResults.push(payload.result.enriched.raw.id),
        onProgress: (payload) => progress.push(payload.message),
        onLog: vi.fn(),
      },
      {
        now: () => {
          clock += 10
          return clock
        },
        resolveConcurrency: vi.fn(() => 1),
        selectLLMConfigForBug: vi.fn((_, config) => ({ ...config, model: 'vision' })),
        analyzeBug: vi.fn(async (_enriched, _config, cacheDir) => ({
          analysis: makeAnalysis(`cache:${cacheDir}`),
          fromCache: false,
        })),
      },
    )

    expect(result.results.map((item) => item.enriched.raw.id)).toEqual(['1', '2'])
    expect(saved).toEqual(['1:vision', '2:vision'])
    expect(bugResults).toEqual(['1', '2'])
    expect(progress[0]).toBe('analizando 2 bugs (x1)')
    expect(progress.at(-1)).toContain('completado')
  })

  it('produce un resultado de error util cuando falla un bug individual', async () => {
    const savedErrors: Array<string | undefined> = []

    const result = await runBugAnalysisBatch(
      {
        bugs: [makeBug('1')],
        enricher: {
          enrich: vi.fn(
            async (bug: RawBug): Promise<EnrichedBug> => ({ raw: bug, googleDocs: [] }),
          ),
        },
        llmConfig,
        performanceMode: 'gpu',
        cacheDir: 'cache',
        saveResult: vi.fn(async (analyzedBug) => {
          savedErrors.push(analyzedBug.error)
        }),
        onBugResult: vi.fn(),
        onProgress: vi.fn(),
        onLog: vi.fn(),
      },
      {
        now: vi.fn(() => 100),
        resolveConcurrency: vi.fn(() => 1),
        analyzeBug: vi.fn(async () => {
          throw new Error('LLM caido')
        }),
      },
    )

    expect(result.results).toHaveLength(1)
    expect(result.results[0].error).toBe('LLM caido')
    expect(result.results[0].analysis.summary).toBe('Error durante el analisis')
    expect(savedErrors).toEqual(['LLM caido'])
  })
})
