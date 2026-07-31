import type {
  AnalyzedBug,
  BugCategory,
  ExternalAgentResult,
  GoogleDocContent,
  RawBug,
} from '../../../shared/contracts/index.js'

export type EvaluationAgent = 'normal' | 'deep'
export type EvaluationAgentSelection = EvaluationAgent | 'both'
export type EvaluationCacheMode = 'fresh' | 'app'

export interface EvaluationBugInput {
  title: string
  description: string
  stepsToReproduce?: string
  expectedResult?: string
  actualResult?: string
  environment?: string
  reporter?: string
  assignee?: string
  priority?: string
  rawRow?: Record<string, string>
}

export interface NormalEvaluationExpectations {
  categories?: BugCategory[]
  problemCount?: number
  requiredText?: string[]
  forbiddenText?: string[]
  missingInformation?: {
    min?: number
    max?: number
  }
}

export interface DeepEvaluationExpectations {
  requiredText?: string[]
  forbiddenText?: string[]
}

export interface AgentEvaluationCase {
  id: string
  title: string
  input: EvaluationBugInput
  evidence?: GoogleDocContent[]
  expectations?: {
    normal?: NormalEvaluationExpectations
    deep?: DeepEvaluationExpectations
  }
}

export interface EvaluationCheck {
  id: string
  label: string
  passed: boolean
  detail?: string
}

export interface EvaluationAssessment {
  score: number
  passed: number
  total: number
  checks: EvaluationCheck[]
}

export interface EvaluationCliOptions {
  agents: EvaluationAgentSelection
  baselinePath?: string
  cacheMode: EvaluationCacheMode
  caseIds: string[]
  help: boolean
  list: boolean
  outputPath?: string
  repeats: number
  settingsPath?: string
  suiteSize: number
}

export type EvaluationMenuAction =
  | { kind: 'run'; agents: EvaluationAgentSelection; suiteSize: 1 | 5 | 10 | 20 }
  | { kind: 'choose-case' }
  | { kind: 'open-latest' }
  | { kind: 'exit' }

export const EVALUATION_MENU_ITEMS = [
  'Prueba rápida: 1 caso con agente normal',
  'Prueba rápida completa: 1 caso con ambos agentes',
  'Probar 5 casos con agente normal',
  'Probar 5 casos con ambos agentes',
  'Probar 10 casos con ambos agentes',
  'Probar los 20 casos con ambos agentes',
  'Elegir un caso específico',
  'Abrir el último reporte',
] as const

export function evaluationMenuAction(value: string): EvaluationMenuAction | null {
  switch (value.trim()) {
    case '1':
      return { kind: 'run', agents: 'normal', suiteSize: 1 }
    case '2':
      return { kind: 'run', agents: 'both', suiteSize: 1 }
    case '3':
      return { kind: 'run', agents: 'normal', suiteSize: 5 }
    case '4':
      return { kind: 'run', agents: 'both', suiteSize: 5 }
    case '5':
      return { kind: 'run', agents: 'both', suiteSize: 10 }
    case '6':
      return { kind: 'run', agents: 'both', suiteSize: 20 }
    case '7':
      return { kind: 'choose-case' }
    case '8':
      return { kind: 'open-latest' }
    case '0':
      return { kind: 'exit' }
    default:
      return null
  }
}

const REJECTION_PATTERNS = [
  /informaci[oó]n insuficiente/i,
  /no (?:puedo|es posible) (?:analizar|determinar|procesar)/i,
  /faltan datos para (?:analizar|continuar)/i,
]

const REQUIRED_DEEP_HEADINGS = [
  '## Resumen',
  '## Evidencia',
  '## Cobertura de los pasos reportados',
  '## Diagnóstico probable',
  '## Archivos o áreas a revisar',
  '## Hallazgos laterales',
  '## Estado probable del bug',
  '## Próximos pasos',
  '## Información faltante',
]

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function includesText(haystack: string, needle: string): boolean {
  return normalizeText(haystack).includes(normalizeText(needle))
}

function assessmentFrom(checks: EvaluationCheck[]): EvaluationAssessment {
  const passed = checks.filter((check) => check.passed).length
  return {
    score: checks.length === 0 ? 0 : Math.round((passed / checks.length) * 100),
    passed,
    total: checks.length,
    checks,
  }
}

function textCheck(
  id: string,
  label: string,
  haystack: string,
  expected: string,
  shouldExist: boolean,
): EvaluationCheck {
  const exists = includesText(haystack, expected)
  return {
    id,
    label,
    passed: shouldExist ? exists : !exists,
    detail: expected,
  }
}

export function evaluationCaseToRawBug(
  evaluationCase: AgentEvaluationCase,
  rowIndex: number,
  repetition: number,
): RawBug {
  const input = evaluationCase.input
  return {
    id: `eval-${evaluationCase.id}-${repetition}`,
    rowIndex,
    title: input.title,
    description: input.description,
    stepsToReproduce: input.stepsToReproduce,
    expectedResult: input.expectedResult,
    actualResult: input.actualResult,
    environment: input.environment,
    reporter: input.reporter,
    assignee: input.assignee,
    priority: input.priority,
    rawRow: input.rawRow ?? {},
    googleDocLinks: (evaluationCase.evidence ?? []).map((document) => document.url),
  }
}

export function evaluateNormalAgent(
  evaluationCase: AgentEvaluationCase,
  result: AnalyzedBug,
): EvaluationAssessment {
  const expectations = evaluationCase.expectations?.normal
  const analysis = result.analysis
  const structuredText = [
    analysis.summary,
    analysis.affectedArea,
    analysis.bugType ?? '',
    analysis.rewritten.observed,
    analysis.rewritten.expected,
    analysis.rewritten.steps.join('\n'),
    analysis.rewritten.environment,
    analysis.missingInformation.join('\n'),
  ].join('\n')
  const checks: EvaluationCheck[] = [
    {
      id: 'normal-execution',
      label: 'El análisis terminó sin error',
      passed: !result.error,
      detail: result.error,
    },
    {
      id: 'normal-summary',
      label: 'Entregó un resumen útil',
      passed: analysis.summary.trim().length > 0,
    },
    {
      id: 'normal-observed',
      label: 'Explicó qué sucede',
      passed: analysis.rewritten.observed.trim().length > 0,
    },
    {
      id: 'normal-expected',
      label: 'Explicó qué debería suceder',
      passed: analysis.rewritten.expected.trim().length > 0,
    },
    {
      id: 'normal-no-rejection',
      label: 'No rechazó el reporte por estar incompleto',
      passed: !REJECTION_PATTERNS.some((pattern) => pattern.test(structuredText)),
    },
  ]

  if (expectations?.categories?.length) {
    checks.push({
      id: 'normal-category',
      label: 'La categoría está dentro de las esperadas',
      passed: expectations.categories.includes(analysis.category),
      detail: `actual: ${analysis.category}; esperadas: ${expectations.categories.join(', ')}`,
    })
  }
  if (expectations?.problemCount !== undefined) {
    checks.push({
      id: 'normal-problem-count',
      label: 'Detectó la cantidad esperada de problemas independientes',
      passed: analysis.rewritten.problemCount === expectations.problemCount,
      detail: `actual: ${analysis.rewritten.problemCount}; esperado: ${expectations.problemCount}`,
    })
  }
  for (const [index, expected] of (expectations?.requiredText ?? []).entries()) {
    checks.push(
      textCheck(
        `normal-required-${index}`,
        `Conservó el dato requerido: ${expected}`,
        structuredText,
        expected,
        true,
      ),
    )
  }
  for (const [index, forbidden] of (expectations?.forbiddenText ?? []).entries()) {
    checks.push(
      textCheck(
        `normal-forbidden-${index}`,
        `No inventó ni afirmó: ${forbidden}`,
        structuredText,
        forbidden,
        false,
      ),
    )
  }
  const missingCount = analysis.missingInformation.length
  const missingRange = expectations?.missingInformation
  if (missingRange?.min !== undefined) {
    checks.push({
      id: 'normal-missing-min',
      label: 'Generó las preguntas mínimas esperadas',
      passed: missingCount >= missingRange.min,
      detail: `actual: ${missingCount}; mínimo: ${missingRange.min}`,
    })
  }
  if (missingRange?.max !== undefined) {
    checks.push({
      id: 'normal-missing-max',
      label: 'No generó preguntas pendientes de más',
      passed: missingCount <= missingRange.max,
      detail: `actual: ${missingCount}; máximo: ${missingRange.max}`,
    })
  }

  return assessmentFrom(checks)
}

export function evaluateDeepAgent(
  evaluationCase: AgentEvaluationCase,
  result: ExternalAgentResult,
): EvaluationAssessment {
  const output = result.output
  const expectations = evaluationCase.expectations?.deep
  const missingHeadings = REQUIRED_DEEP_HEADINGS.filter((heading) => !includesText(output, heading))
  const checks: EvaluationCheck[] = [
    {
      id: 'deep-execution',
      label: 'El agente profundo terminó sin error',
      passed: result.ok,
      detail: result.error,
    },
    {
      id: 'deep-output',
      label: 'Entregó un informe',
      passed: output.trim().length > 0,
    },
    {
      id: 'deep-contract',
      label: 'Respetó todas las secciones obligatorias',
      passed: missingHeadings.length === 0,
      detail: missingHeadings.length > 0 ? `faltan: ${missingHeadings.join(', ')}` : undefined,
    },
    {
      id: 'deep-scope',
      label: 'Declaró el alcance revisado',
      passed: /alcance revisado\s*:\s*\S+/i.test(output),
    },
    {
      id: 'deep-status',
      label: 'Declaró un estado probable válido',
      passed:
        /estado probable\s*:\s*(resuelto|parcialmente_resuelto|no_resuelto|no_determinable)\b/i.test(
          output,
        ),
    },
    {
      id: 'deep-no-false-exhaustiveness',
      label: 'No afirmó haber revisado todo el proyecto sin acotar el alcance',
      passed:
        !/(revis[eé] todo el (proyecto|repositorio)|en todo el (proyecto|repositorio) no existe)/i.test(
          output,
        ),
    },
  ]

  for (const [index, expected] of (expectations?.requiredText ?? []).entries()) {
    checks.push(
      textCheck(
        `deep-required-${index}`,
        `Incluyó la evidencia requerida: ${expected}`,
        output,
        expected,
        true,
      ),
    )
  }
  for (const [index, forbidden] of (expectations?.forbiddenText ?? []).entries()) {
    checks.push(
      textCheck(
        `deep-forbidden-${index}`,
        `Evitó la afirmación no permitida: ${forbidden}`,
        output,
        forbidden,
        false,
      ),
    )
  }

  return assessmentFrom(checks)
}

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`Falta un valor para ${option}`)
  return value
}

function parsePositiveInteger(value: string, option: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${option} debe ser un entero positivo`)
  }
  return parsed
}

export function parseEvaluationCliOptions(args: string[]): EvaluationCliOptions {
  const options: EvaluationCliOptions = {
    agents: 'both',
    cacheMode: 'fresh',
    caseIds: [],
    help: false,
    list: false,
    repeats: 1,
    suiteSize: 5,
  }

  for (let index = 0; index < args.length; index++) {
    const option = args[index]
    if (option === '--help' || option === '-h') {
      options.help = true
    } else if (option === '--list') {
      options.list = true
    } else if (option === '--suite') {
      options.suiteSize = parsePositiveInteger(readOptionValue(args, index, option), option)
      index++
    } else if (option === '--repeats') {
      options.repeats = parsePositiveInteger(readOptionValue(args, index, option), option)
      index++
    } else if (option === '--agents') {
      const agents = readOptionValue(args, index, option)
      if (agents !== 'normal' && agents !== 'deep' && agents !== 'both') {
        throw new Error('--agents debe ser normal, deep o both')
      }
      options.agents = agents
      index++
    } else if (option === '--cache') {
      const cacheMode = readOptionValue(args, index, option)
      if (cacheMode !== 'fresh' && cacheMode !== 'app') {
        throw new Error('--cache debe ser fresh o app')
      }
      options.cacheMode = cacheMode
      index++
    } else if (option === '--case') {
      options.caseIds.push(
        ...readOptionValue(args, index, option)
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      )
      index++
    } else if (option === '--settings') {
      options.settingsPath = readOptionValue(args, index, option)
      index++
    } else if (option === '--output') {
      options.outputPath = readOptionValue(args, index, option)
      index++
    } else if (option === '--baseline') {
      options.baselinePath = readOptionValue(args, index, option)
      index++
    } else {
      throw new Error(`Opción desconocida: ${option}`)
    }
  }

  if (![5, 10, 15, 20].includes(options.suiteSize)) {
    throw new Error('--suite debe ser 5, 10, 15 o 20')
  }
  if (options.repeats > 10) throw new Error('--repeats no puede superar 10')
  return options
}

export function selectEvaluationCases(
  cases: AgentEvaluationCase[],
  options: Pick<EvaluationCliOptions, 'caseIds' | 'suiteSize'>,
): AgentEvaluationCase[] {
  if (options.caseIds.length === 0) return cases.slice(0, options.suiteSize)
  const selected = options.caseIds.map((caseId) => cases.find((item) => item.id === caseId))
  const missing = options.caseIds.filter((_, index) => !selected[index])
  if (missing.length > 0) throw new Error(`Casos inexistentes: ${missing.join(', ')}`)
  return selected as AgentEvaluationCase[]
}

export function parseEvaluationCases(value: unknown): AgentEvaluationCase[] {
  if (!Array.isArray(value)) throw new Error('El catálogo de evaluaciones debe ser un array')
  const cases = value as AgentEvaluationCase[]
  const ids = new Set<string>()
  for (const [index, evaluationCase] of cases.entries()) {
    if (!evaluationCase || typeof evaluationCase !== 'object') {
      throw new Error(`Caso ${index + 1}: formato inválido`)
    }
    if (!evaluationCase.id?.trim()) throw new Error(`Caso ${index + 1}: falta id`)
    if (ids.has(evaluationCase.id)) throw new Error(`ID de caso duplicado: ${evaluationCase.id}`)
    if (!evaluationCase.title?.trim()) throw new Error(`Caso ${evaluationCase.id}: falta title`)
    if (!evaluationCase.input?.title?.trim()) {
      throw new Error(`Caso ${evaluationCase.id}: falta input.title`)
    }
    if (typeof evaluationCase.input.description !== 'string') {
      throw new Error(`Caso ${evaluationCase.id}: falta input.description`)
    }
    ids.add(evaluationCase.id)
  }
  return cases
}
