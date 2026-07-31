import { describe, expect, it } from 'vitest'
import type { AnalyzedBug, ExternalAgentResult } from '../../../shared/contracts/index.js'
import {
  type AgentEvaluationCase,
  evaluateDeepAgent,
  evaluateNormalAgent,
  evaluationCaseToRawBug,
  evaluationMenuAction,
  parseEvaluationCases,
  parseEvaluationCliOptions,
  selectEvaluationCases,
} from './agentEvaluation.js'

const evaluationCase: AgentEvaluationCase = {
  id: 'login-loader',
  title: 'El login queda cargando',
  input: {
    title: 'Login roto',
    description: 'Con qa.demo queda cargando',
    expectedResult: 'Abrir dashboard',
    actualResult: 'Spinner infinito',
  },
  expectations: {
    normal: {
      categories: ['frontend'],
      problemCount: 1,
      requiredText: ['qa.demo', 'spinner'],
      forbiddenText: ['Chrome'],
      missingInformation: { max: 1 },
    },
    deep: {
      requiredText: ['LoginForm.tsx'],
      forbiddenText: ['revisé todo el proyecto'],
    },
  },
}

function makeNormalResult(): AnalyzedBug {
  return {
    enriched: {
      raw: evaluationCaseToRawBug(evaluationCase, 1, 1),
      googleDocs: [],
    },
    analysis: {
      category: 'frontend',
      severity: 'high',
      confidence: 0.9,
      affectedArea: 'Login',
      summary: 'El login de qa.demo queda con un spinner infinito.',
      rewritten: {
        observed: 'El formulario queda cargando.',
        expected: 'Debe abrir el dashboard.',
        steps: ['Ingresar con qa.demo'],
        environment: 'No informado',
        problemCount: 1,
      },
      missingInformation: [],
      rawResponse: '{}',
    },
    status: 'nuevo',
    processingMs: 100,
  }
}

const deepReport = `## Resumen
El login queda cargando.
## Evidencia
- LoginForm.tsx - controla el submit.
## Cobertura de los pasos reportados
1. Paso 1: enviar → falla. Queda cargando.
## Diagnóstico probable
El estado no se limpia.
## Archivos o áreas a revisar
- LoginForm.tsx
## Hallazgos laterales
- ninguno
## Estado probable del bug
Estado probable: no_resuelto
Coincide con el bug reportado: sí
Alcance revisado: LoginForm.tsx y sus tests.
Motivo: el estado queda activo.
## Próximos pasos
- corregir el finally.
## Información faltante
- ninguna`

describe('agentEvaluation', () => {
  it('convierte un caso en el mismo RawBug que consume el pipeline real', () => {
    const rawBug = evaluationCaseToRawBug(evaluationCase, 7, 2)

    expect(rawBug.id).toBe('eval-login-loader-2')
    expect(rawBug.rowIndex).toBe(7)
    expect(rawBug.title).toBe('Login roto')
    expect(rawBug.googleDocLinks).toEqual([])
  })

  it('evalúa la salida estructurada del agente normal sin comparar prosa exacta', () => {
    const assessment = evaluateNormalAgent(evaluationCase, makeNormalResult())

    expect(assessment.score).toBe(100)
    expect(assessment.checks.every((check) => check.passed)).toBe(true)
  })

  it('marca hechos perdidos, invenciones y errores de clasificación', () => {
    const result = makeNormalResult()
    result.analysis.category = 'database'
    result.analysis.summary = 'Falla en Chrome'
    result.analysis.rewritten.steps = []

    const assessment = evaluateNormalAgent(evaluationCase, result)

    expect(assessment.checks.find((check) => check.id === 'normal-category')?.passed).toBe(false)
    expect(assessment.checks.find((check) => check.id === 'normal-required-0')?.passed).toBe(false)
    expect(assessment.checks.find((check) => check.id === 'normal-forbidden-0')?.passed).toBe(false)
  })

  it('valida el contrato real del informe profundo', () => {
    const result: ExternalAgentResult = {
      ok: true,
      output: deepReport,
      command: 'opencode run',
      durationMs: 200,
    }

    const assessment = evaluateDeepAgent(evaluationCase, result)

    expect(assessment.score).toBe(100)
    expect(assessment.checks.every((check) => check.passed)).toBe(true)
  })

  it('detecta un informe profundo incompleto', () => {
    const result: ExternalAgentResult = {
      ok: true,
      output: '## Resumen\nRevisé todo el proyecto y no encontré nada.',
      command: 'opencode run',
      durationMs: 200,
    }

    const assessment = evaluateDeepAgent(evaluationCase, result)

    expect(assessment.checks.find((check) => check.id === 'deep-contract')?.passed).toBe(false)
    expect(
      assessment.checks.find((check) => check.id === 'deep-no-false-exhaustiveness')?.passed,
    ).toBe(false)
  })
})

describe('parseEvaluationCliOptions', () => {
  it('acepta suite, agentes, repeticiones y casos específicos', () => {
    const options = parseEvaluationCliOptions([
      '--suite',
      '20',
      '--agents',
      'normal',
      '--repeats',
      '3',
      '--case',
      'a,b',
      '--cache',
      'app',
    ])

    expect(options).toMatchObject({
      suiteSize: 20,
      agents: 'normal',
      repeats: 3,
      caseIds: ['a', 'b'],
      cacheMode: 'app',
    })
  })

  it('rechaza suites o agentes inválidos', () => {
    expect(() => parseEvaluationCliOptions(['--suite', '7'])).toThrow('--suite')
    expect(() => parseEvaluationCliOptions(['--agents', 'otro'])).toThrow('--agents')
  })
})

describe('evaluationMenuAction', () => {
  it('mapea las opciones simples a corridas concretas', () => {
    expect(evaluationMenuAction('1')).toEqual({
      kind: 'run',
      agents: 'normal',
      suiteSize: 1,
    })
    expect(evaluationMenuAction('4')).toEqual({ kind: 'run', agents: 'both', suiteSize: 5 })
    expect(evaluationMenuAction('6')).toEqual({ kind: 'run', agents: 'both', suiteSize: 20 })
  })

  it('reconoce acciones auxiliares y rechaza números inexistentes', () => {
    expect(evaluationMenuAction('7')).toEqual({ kind: 'choose-case' })
    expect(evaluationMenuAction('8')).toEqual({ kind: 'open-latest' })
    expect(evaluationMenuAction('0')).toEqual({ kind: 'exit' })
    expect(evaluationMenuAction('99')).toBeNull()
  })
})

describe('catálogo de evaluaciones', () => {
  const cases = [
    evaluationCase,
    { ...evaluationCase, id: 'second', title: 'Segundo caso' },
    { ...evaluationCase, id: 'third', title: 'Tercer caso' },
  ]

  it('selecciona casos por tamaño o por id', () => {
    expect(selectEvaluationCases(cases, { caseIds: [], suiteSize: 2 })).toHaveLength(2)
    expect(selectEvaluationCases(cases, { caseIds: ['third'], suiteSize: 5 })[0].id).toBe('third')
  })

  it('valida ids duplicados y campos obligatorios', () => {
    expect(parseEvaluationCases(cases)).toHaveLength(3)
    expect(() => parseEvaluationCases([evaluationCase, evaluationCase])).toThrow('duplicado')
    expect(() => parseEvaluationCases([{ id: 'incompleto' }])).toThrow('title')
  })
})
