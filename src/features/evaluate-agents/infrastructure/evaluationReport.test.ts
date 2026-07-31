import { describe, expect, it } from 'vitest'
import type { AnalyzedBug } from '../../../shared/contracts/index.js'
import type { AgentEvaluationCase } from '../application/agentEvaluation.js'
import { buildEvaluationReport, type StoredAgentEvaluationRun } from './evaluationReport.js'

const evaluationCase: AgentEvaluationCase = {
  id: 'html-case',
  title: 'Caso <peligroso>',
  input: { title: 'Bug', description: 'Descripción' },
}

function normalOutput(): AnalyzedBug {
  return {
    enriched: {
      raw: {
        id: 'eval-html-case-1',
        rowIndex: 1,
        title: 'Bug',
        description: 'Descripción',
        rawRow: {},
        googleDocLinks: [],
      },
      googleDocs: [],
    },
    analysis: {
      category: 'otro',
      severity: 'low',
      confidence: 0.5,
      affectedArea: 'No informado',
      summary: '<script>alert(1)</script>',
      rewritten: {
        observed: 'Falla',
        expected: 'Funciona',
        steps: [],
        environment: 'No informado',
        problemCount: 1,
      },
      missingInformation: [],
      rawResponse: '<script>alert(2)</script>',
    },
    status: 'nuevo',
    processingMs: 10,
  }
}

function makeRun(score: number): StoredAgentEvaluationRun {
  return {
    manifest: {
      id: 'run-1',
      createdAt: '2026-07-31T12:00:00.000Z',
      agents: 'normal',
      cacheMode: 'fresh',
      repeats: 1,
      settingsPath: 'settings.json',
      provider: 'ollama',
      normalModel: 'qwen2.5:7b',
      visionModel: 'qwen2.5vl:7b',
      externalAgentCommand: '',
      repositories: [],
      cases: [evaluationCase],
    },
    records: [
      {
        caseId: evaluationCase.id,
        caseTitle: evaluationCase.title,
        repetition: 1,
        startedAt: '2026-07-31T12:00:00.000Z',
        finishedAt: '2026-07-31T12:00:01.000Z',
        normal: {
          output: normalOutput(),
          assessment: {
            score,
            passed: score === 100 ? 1 : 0,
            total: 1,
            checks: [{ id: 'check', label: 'Salida válida', passed: score === 100 }],
          },
        },
      },
    ],
  }
}

describe('buildEvaluationReport', () => {
  it('incluye resultados exactos, escapa HTML y compara el baseline', () => {
    const report = buildEvaluationReport(makeRun(100), makeRun(0))

    expect(report).toContain('Resultado exacto de la app')
    expect(report).toContain('Respuesta cruda del modelo')
    expect(report).toContain('Caso &lt;peligroso&gt;')
    expect(report).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(report).not.toContain('<script>alert(1)</script>')
    expect(report).toContain('+100')
  })
})
