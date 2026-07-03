import { describe, expect, it, vi } from 'vitest'
import type { AnalyzedBug } from '../../../shared/contracts/bugTypes.js'
import type { LLMConfig } from '../../../shared/contracts/settingsTypes.js'
import * as teamBugs from '../infrastructure/teamBugs.js'
import { saveProjectAnalysisResult, startProjectAnalysisRun } from './projectAnalysisRun.js'

const config = {
  url: 'https://example.supabase.co',
  publishableKey: 'pk',
  defaultProjectName: 'buglens',
  defaultProjectSlug: 'buglens-default',
}

const llmConfig: LLMConfig = {
  provider: 'ollama',
  model: 'qwen2.5:7b',
  visionModel: 'qwen2.5vl:7b',
  performanceMode: 'gpu',
}

function makeBug(): AnalyzedBug {
  return {
    enriched: {
      raw: {
        id: 'bug-1',
        rowIndex: 1,
        title: 'Login roto',
        description: 'No entra',
        rawRow: {},
        googleDocLinks: [],
      },
      googleDocs: [],
    },
    analysis: {
      category: 'frontend',
      severity: 'medium',
      confidence: 0.9,
      affectedArea: 'login',
      summary: 'El login falla',
      rewritten: {
        observed: 'No entra',
        expected: 'Debe entrar',
        steps: [],
        environment: 'qa',
        problemCount: 1,
      },
      missingInformation: [],
      rawResponse: '{}',
    },
    status: 'nuevo',
    processingMs: 10,
  }
}

describe('projectAnalysisRun', () => {
  it('crea una corrida remota y arma contexto de analisis', async () => {
    const createImport = vi.fn().mockResolvedValue('import-1')

    const run = await startProjectAnalysisRun(
      {} as never,
      config,
      {
        sourceType: 'excel',
        sourceName: 'bugs.xlsx',
        sourcePath: 'C:/qa/bugs.xlsx',
        rowCount: 2,
      },
      llmConfig,
      { createImport },
    )

    expect(createImport).toHaveBeenCalledWith({} as never, config, {
      sourceType: 'excel',
      sourceName: 'bugs.xlsx',
      sourcePath: 'C:/qa/bugs.xlsx',
      rowCount: 2,
    })
    expect(run.context).toEqual({
      importId: 'import-1',
      sourceType: 'excel',
      provider: 'ollama',
      model: 'qwen2.5:7b',
    })
  })

  it('guarda resultados usando el modelo efectivo del bug', async () => {
    const saveAnalysisResult = vi.fn().mockResolvedValue('bug-remote-1')
    const run = await startProjectAnalysisRun(
      {} as never,
      config,
      { sourceType: 'manual', rowCount: 1 },
      llmConfig,
      {
        createImport: vi.fn().mockResolvedValue('import-1'),
        saveAnalysisResult,
      },
    )

    await run.saveResult(makeBug(), { ...llmConfig, model: 'qwen2.5vl:7b' })

    expect(saveAnalysisResult).toHaveBeenCalledWith({} as never, config, makeBug(), {
      importId: 'import-1',
      sourceType: 'manual',
      provider: 'ollama',
      model: 'qwen2.5vl:7b',
    })
  })

  it('expone guardado de analisis de proyecto para otros flujos', async () => {
    const saveRemoteAnalysisResult = vi
      .spyOn(teamBugs, 'saveRemoteAnalysisResult')
      .mockResolvedValue('bug-remote-1')
    const context = {
      importId: null,
      sourceType: 'manual' as const,
      provider: 'external-agent',
      model: 'opencode',
    }

    await expect(saveProjectAnalysisResult({} as never, config, makeBug(), context)).resolves.toBe(
      'bug-remote-1',
    )

    expect(saveRemoteAnalysisResult).toHaveBeenCalledWith({} as never, config, makeBug(), context)
  })
})
