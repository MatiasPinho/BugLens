import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline/promises'
import * as dotenv from 'dotenv'
import { runBugAnalysisBatch } from '../../src/features/analyze-bugs/application/runBugAnalysisBatch.js'
import {
  type AgentEvaluationCase,
  EVALUATION_MENU_ITEMS,
  evaluateDeepAgent,
  evaluateNormalAgent,
  evaluationCaseToRawBug,
  evaluationMenuAction,
  parseEvaluationCases,
  parseEvaluationCliOptions,
  selectEvaluationCases,
} from '../../src/features/evaluate-agents/application/agentEvaluation.js'
import {
  type AgentEvaluationRecord,
  buildEvaluationReport,
  type StoredAgentEvaluationRun,
} from '../../src/features/evaluate-agents/infrastructure/evaluationReport.js'
import { analyzeBugWithExternalAgent } from '../../src/features/external-agent/application/externalAgent.js'
import { buildLLMConfigFromSettings } from '../../src/features/settings/application/llmSettings.js'
import { loadAppSettings } from '../../src/features/settings/application/settingsStore.js'
import {
  ensureOllamaRunning,
  stopManagedOllama,
} from '../../src/platform/ollama/ollamaService.js'
import type { EnrichedBug, RawBug } from '../../src/shared/contracts/index.js'

const REPOSITORY_ROOT = path.resolve(__dirname, '..', '..', '..')
const CASES_PATH = path.join(REPOSITORY_ROOT, 'evals', 'cases.json')
const RESULTS_ROOT = path.join(REPOSITORY_ROOT, 'eval-results')

dotenv.config({ path: path.join(REPOSITORY_ROOT, '.env') })

function helpText(): string {
  return `Evaluaciones reales de los agentes de BugLens

Uso:
  npm run eval:agents
  npm run eval:agents -- --suite 5 --agents both

Sin opciones abre el menú interactivo por números.

Opciones:
  --suite 5|10|15|20       Cantidad de casos, en el orden del catálogo (default: 5)
  --agents normal|deep|both
                            Agentes a evaluar (default: both). deep ejecuta normal primero.
  --repeats N              Repeticiones por caso, de 1 a 10 (default: 1)
  --case id[,id]           Ejecutar casos específicos
  --cache fresh|app        fresh llama al modelo; app usa la caché real (default: fresh)
  --settings ruta          settings.json de BugLens
  --output directorio      Directorio de salida
  --baseline ruta          results.json previo o su directorio
  --list                    Listar los casos disponibles
  --help                    Mostrar esta ayuda`
}

function defaultUserDataPath(): string {
  if (process.platform === 'win32') {
    const appData = process.env['APPDATA']
    if (!appData) throw new Error('APPDATA no está definida; usá --settings')
    return path.join(appData, 'bug-analyzer')
  }
  const userHome = process.env['HOME']
  if (!userHome) throw new Error('HOME no está definida; usá --settings')
  if (process.platform === 'darwin') {
    return path.join(userHome, 'Library', 'Application Support', 'bug-analyzer')
  }
  return path.join(process.env['XDG_CONFIG_HOME'] ?? path.join(userHome, '.config'), 'bug-analyzer')
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function readCases(): AgentEvaluationCase[] {
  return parseEvaluationCases(readJson(CASES_PATH))
}

function openReport(reportPath: string): void {
  const command =
    process.platform === 'win32'
      ? 'explorer.exe'
      : process.platform === 'darwin'
        ? 'open'
        : 'xdg-open'
  const child = spawn(command, [reportPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
}

function latestReportPath(): string | null {
  if (!fs.existsSync(RESULTS_ROOT)) return null
  const reports = fs
    .readdirSync(RESULTS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(RESULTS_ROOT, entry.name, 'report.html'))
    .filter((reportPath) => fs.existsSync(reportPath))
    .map((reportPath) => ({ reportPath, modifiedAt: fs.statSync(reportPath).mtimeMs }))
    .sort((left, right) => right.modifiedAt - left.modifiedAt)
  return reports[0]?.reportPath ?? null
}

function printMainMenu(): void {
  console.log('\n=== Evaluaciones de BugLens ===')
  for (const [index, item] of EVALUATION_MENU_ITEMS.entries()) {
    console.log(`${index + 1}. ${item}`)
  }
  console.log('0. Salir')
}

async function chooseSpecificCase(
  terminal: readline.Interface,
  cases: AgentEvaluationCase[],
): Promise<string | null> {
  console.log('\nCasos disponibles')
  for (const [index, evaluationCase] of cases.entries()) {
    console.log(`${String(index + 1).padStart(2, '0')}. ${evaluationCase.title}`)
  }
  console.log('0. Volver')

  while (true) {
    const answer = (await terminal.question('\nNúmero de caso: ')).trim()
    if (answer === '0') return null
    const index = Number(answer) - 1
    if (Number.isInteger(index) && cases[index]) return cases[index].id
    console.log('Elegí un número válido entre 0 y 20.')
  }
}

async function interactiveOptions(
  terminal: readline.Interface,
  cases: AgentEvaluationCase[],
): Promise<ReturnType<typeof parseEvaluationCliOptions> | null> {
  while (true) {
    printMainMenu()
    const action = evaluationMenuAction(await terminal.question('\nElegí una opción: '))
    if (!action) {
      console.log('Opción inválida. Elegí un número del menú.')
      continue
    }
    if (action.kind === 'exit') return null
    if (action.kind === 'open-latest') {
      const reportPath = latestReportPath()
      if (reportPath) {
        openReport(reportPath)
        console.log(`Abriendo ${reportPath}`)
      } else {
        console.log('Todavía no hay reportes. Ejecutá primero una evaluación.')
      }
      continue
    }

    const options = parseEvaluationCliOptions([])
    if (action.kind === 'choose-case') {
      const caseId = await chooseSpecificCase(terminal, cases)
      if (!caseId) continue
      const agentAnswer = (
        await terminal.question('\n1. Solo agente normal\n2. Ambos agentes\nElegí una opción: ')
      ).trim()
      if (agentAnswer !== '1' && agentAnswer !== '2') {
        console.log('Opción inválida. Volvemos al menú principal.')
        continue
      }
      return {
        ...options,
        agents: agentAnswer === '1' ? 'normal' : 'both',
        caseIds: [caseId],
      }
    }

    return {
      ...options,
      agents: action.agents,
      suiteSize: action.suiteSize,
    }
  }
}

function timestampId(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
}

function resolveBaselinePath(value: string): string {
  const absolutePath = path.resolve(value)
  return fs.statSync(absolutePath).isDirectory()
    ? path.join(absolutePath, 'results.json')
    : absolutePath
}

function readBaseline(value?: string): StoredAgentEvaluationRun | undefined {
  if (!value) return undefined
  const baselinePath = resolveBaselinePath(value)
  const baseline = readJson(baselinePath) as StoredAgentEvaluationRun
  if (!baseline?.manifest || !Array.isArray(baseline.records)) {
    throw new Error(`Baseline inválido: ${baselinePath}`)
  }
  return baseline
}

function buildRepeatedCases(
  cases: AgentEvaluationCase[],
  repeats: number,
): Array<{ evaluationCase: AgentEvaluationCase; repetition: number; bug: RawBug }> {
  const repeated: Array<{
    evaluationCase: AgentEvaluationCase
    repetition: number
    bug: RawBug
  }> = []
  for (let repetition = 1; repetition <= repeats; repetition++) {
    for (const evaluationCase of cases) {
      repeated.push({
        evaluationCase,
        repetition,
        bug: evaluationCaseToRawBug(evaluationCase, repeated.length + 1, repetition),
      })
    }
  }
  return repeated
}

function writeRunFiles(outputDirectory: string, run: StoredAgentEvaluationRun): void {
  fs.writeFileSync(path.join(outputDirectory, 'results.json'), JSON.stringify(run, null, 2), 'utf8')
  fs.writeFileSync(
    path.join(outputDirectory, 'results.jsonl'),
    `${run.records.map((record) => JSON.stringify(record)).join('\n')}\n`,
    'utf8',
  )
}

function writeRawOutputs(outputDirectory: string, record: AgentEvaluationRecord): void {
  const rawDirectory = path.join(outputDirectory, 'raw')
  fs.mkdirSync(rawDirectory, { recursive: true })
  const baseName = `${record.caseId}-r${record.repetition}`
  fs.writeFileSync(
    path.join(rawDirectory, `${baseName}-normal.json`),
    JSON.stringify(record.normal.output, null, 2),
    'utf8',
  )
  if (record.deep) {
    fs.writeFileSync(
      path.join(rawDirectory, `${baseName}-deep.json`),
      JSON.stringify(record.deep.output, null, 2),
      'utf8',
    )
    fs.writeFileSync(
      path.join(rawDirectory, `${baseName}-deep.md`),
      record.deep.output.output,
      'utf8',
    )
  }
}

async function run(): Promise<void> {
  const allCases = readCases()
  const cliArgs = process.argv.slice(2)
  const terminal =
    cliArgs.length === 0
      ? readline.createInterface({ input: process.stdin, output: process.stdout })
      : null

  try {
    const options = terminal
      ? await interactiveOptions(terminal, allCases)
      : parseEvaluationCliOptions(cliArgs)
    if (!options) return
    if (options.help) {
      console.log(helpText())
      return
    }

    if (options.list) {
      for (const [index, evaluationCase] of allCases.entries()) {
        console.log(
          `${String(index + 1).padStart(2, '0')}. ${evaluationCase.id} — ${evaluationCase.title}`,
        )
      }
      return
    }

    const selectedCases = selectEvaluationCases(allCases, options)
    const repeatedCases = buildRepeatedCases(selectedCases, options.repeats)
    const defaultAppDataPath = defaultUserDataPath()
    const settingsPath = path.resolve(
      options.settingsPath ?? path.join(defaultAppDataPath, 'settings.json'),
    )
    const userDataPath = options.settingsPath ? path.dirname(settingsPath) : defaultAppDataPath
    const settings = loadAppSettings(settingsPath, process.env)
    const llmConfig = buildLLMConfigFromSettings(settings)
    const outputDirectory = path.resolve(
      options.outputPath ?? path.join(RESULTS_ROOT, timestampId()),
    )
    const baseline = readBaseline(options.baselinePath)
    fs.mkdirSync(outputDirectory, { recursive: true })

    console.log(`Casos: ${selectedCases.length}; repeticiones: ${options.repeats}`)
    console.log(`Agentes: ${options.agents}; caché: ${options.cacheMode}`)
    console.log(`Configuración: ${settingsPath}`)
    console.log(`Salida: ${outputDirectory}`)

    if (llmConfig.provider === 'ollama') {
      const startup = await ensureOllamaRunning(settings.ollamaBaseUrl, (message) =>
        console.log(`[ollama] ${message}`),
      )
      if (!startup.started && !startup.alreadyRunning) {
        console.warn('No se pudo iniciar Ollama; las ejecuciones normales registrarán el error.')
      }
    }
    if (
      (options.agents === 'deep' || options.agents === 'both') &&
      !settings.externalAgentCommand
    ) {
      console.warn(
        'No hay comando de agente externo; las evaluaciones profundas registrarán el error.',
      )
    }

    const caseByBugId = new Map(repeatedCases.map((item) => [item.bug.id, item.evaluationCase]))
    const batchStartedAt = new Date().toISOString()
    const { results } = await runBugAnalysisBatch({
      bugs: repeatedCases.map((item) => item.bug),
      enricher: {
        enrich: async (bug): Promise<EnrichedBug> => ({
          raw: bug,
          googleDocs: caseByBugId.get(bug.id)?.evidence ?? [],
        }),
      },
      llmConfig,
      performanceMode: settings.performanceMode,
      cacheDir: options.cacheMode === 'app' ? path.join(userDataPath, 'analysis-cache') : undefined,
      saveResult: async () => undefined,
      onBugResult: ({ result, current, total }) =>
        console.log(`[normal ${current}/${total}] ${result.enriched.raw.title}`),
      onProgress: () => undefined,
      onLog: (level, message) => {
        if (level !== 'info') console.log(`[${level}] ${message}`)
      },
    })

    const runResult: StoredAgentEvaluationRun = {
      manifest: {
        id: path.basename(outputDirectory),
        createdAt: batchStartedAt,
        agents: options.agents,
        cacheMode: options.cacheMode,
        repeats: options.repeats,
        settingsPath,
        provider: llmConfig.provider,
        normalModel: llmConfig.model ?? '',
        visionModel: llmConfig.visionModel ?? '',
        externalAgentCommand: settings.externalAgentCommand,
        repositories: settings.externalAgentRepositories,
        cases: selectedCases,
      },
      records: [],
    }

    for (const [index, item] of repeatedCases.entries()) {
      const normalOutput = results.find((result) => result.enriched.raw.id === item.bug.id)
      if (!normalOutput) throw new Error(`No se obtuvo resultado normal para ${item.bug.id}`)
      const record: AgentEvaluationRecord = {
        caseId: item.evaluationCase.id,
        caseTitle: item.evaluationCase.title,
        repetition: item.repetition,
        startedAt: batchStartedAt,
        finishedAt: new Date().toISOString(),
        normal: {
          output: normalOutput,
          assessment: evaluateNormalAgent(item.evaluationCase, normalOutput),
        },
      }

      if (options.agents === 'deep' || options.agents === 'both') {
        console.log(`[deep ${index + 1}/${repeatedCases.length}] ${item.evaluationCase.title}`)
        let lastProgressLog = 0
        const appDeepOutput = await analyzeBugWithExternalAgent(
          settings.externalAgentCommand,
          normalOutput,
          settings.externalAgentTimeoutMs,
          (progress) => {
            if (progress.elapsedMs - lastProgressLog >= 30_000) {
              lastProgressLog = progress.elapsedMs
              console.log(
                `  ${Math.round(progress.elapsedMs / 1000)}s; silencio ${Math.round(progress.silentMs / 1000)}s`,
              )
            }
          },
          settings.externalAgentRepositories,
        )
        record.deep = {
          output: appDeepOutput,
          assessment: evaluateDeepAgent(item.evaluationCase, appDeepOutput),
        }
        record.finishedAt = new Date().toISOString()
      }

      runResult.records.push(record)
      writeRawOutputs(outputDirectory, record)
      writeRunFiles(outputDirectory, runResult)
    }

    const reportPath = path.join(outputDirectory, 'report.html')
    const report = buildEvaluationReport(runResult, baseline)
    fs.writeFileSync(reportPath, report, 'utf8')
    console.log(`Reporte: ${reportPath}`)

    if (terminal) {
      const answer = (
        await terminal.question(
          '\n¿Querés abrir el reporte ahora?\n1. Sí\n2. No\nElegí una opción: ',
        )
      ).trim()
      if (answer === '1') openReport(reportPath)
    }
  } finally {
    terminal?.close()
    // Solo detiene la instancia que este runner haya iniciado. Si Ollama ya
    // estaba activo, `stopManagedOllama` no tiene un proceso propio que cerrar.
    stopManagedOllama()
  }
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
