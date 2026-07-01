import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type {
  AnalyzedBug,
  ExternalAgentProgress,
  ExternalAgentRepository,
  ExternalAgentResult,
} from '../types/index.js'

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000
const DEFAULT_STALLED_PROGRESS_TIMEOUT_MS = 90 * 1000
const PROCESS_TERMINATION_GRACE_MS = 2 * 1000
const MAX_BUFFER_BYTES = 1024 * 1024 * 8
const TERMINAL_PATHS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
]
const OPENCODE_PROMPT_FILE_MESSAGE =
  'Analizá el bug adjunto siguiendo las instrucciones del archivo.'
const OPENCODE_BIG_PICKLE_MODEL = 'opencode/big-pickle'
// biome-ignore lint/complexity/useRegexLiterals: el literal dispara noControlCharactersInRegex.
const ANSI_CSI_REGEX = new RegExp(String.raw`\x1B\[[0-?]*[ -/]*[@-~]`, 'g')
// biome-ignore lint/complexity/useRegexLiterals: el literal dispara noControlCharactersInRegex.
const ANSI_OSC_REGEX = new RegExp(String.raw`\x1B\][^\x07]*(?:\x07|\x1B\\)`, 'g')

function shellQuote(value: string): string {
  if (process.platform === 'win32') return `"${value.replace(/"/g, '\\"')}"`
  return `'${value.replace(/'/g, `'\\''`)}'`
}

interface PreparedExternalAgentCommand {
  command: string
  promptFile?: string
  env?: NodeJS.ProcessEnv
}

function prepareCommand(command: string, prompt: string): PreparedExternalAgentCommand {
  if (!command.includes('{promptFile}') && !command.includes('{prompt}')) {
    return { command }
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglens-agent-'))
  const promptFile = path.join(dir, 'prompt.txt')
  fs.writeFileSync(promptFile, prompt, 'utf8')

  return {
    command: command
      .replaceAll('{promptFile}', shellQuote(promptFile))
      .replaceAll('{prompt}', shellQuote(prompt)),
    promptFile,
  }
}

function isOpenCodeRunCommand(command: string): boolean {
  return /^\s*opencode\s+run(?:\s|$)/.test(command)
}

function commandHasOpenCodeAgent(command: string): boolean {
  return /(?:^|\s)--agent(?:\s|=)/.test(command)
}

function isLegacyOpenCodeCatPromptCommand(command: string): boolean {
  return /(?:^|\s)opencode\s+run\b[\s\S]*\$\(\s*cat\b/.test(command)
}

function withOpenCodeBugLensAgent(command: string): string {
  if (!isOpenCodeRunCommand(command) || commandHasOpenCodeAgent(command)) return command
  return command.replace(/^\s*opencode\s+run\b/, 'opencode run --agent buglens')
}

function buildOpenCodeConfigContent(repositories: ExternalAgentRepository[]): string {
  const externalDirectoryPermissions = Object.fromEntries(
    repositories.map((repo) => [`${repo.path.replace(/\/+$/, '')}/*`, 'allow']),
  )
  return JSON.stringify({
    agent: {
      buglens: {
        description: 'Analiza bugs desde BugLens sin editar archivos ni delegar subagentes.',
        mode: 'primary',
        permission: {
          edit: 'deny',
          bash: 'deny',
          task: { '*': 'deny' },
          question: 'deny',
          todowrite: 'deny',
          read: 'allow',
          list: 'allow',
          grep: 'allow',
          glob: 'allow',
          external_directory:
            Object.keys(externalDirectoryPermissions).length > 0
              ? externalDirectoryPermissions
              : 'deny',
        },
      },
    },
  })
}

function prepareOpenCodeCommand(
  prepared: PreparedExternalAgentCommand,
  repositories: ExternalAgentRepository[],
): PreparedExternalAgentCommand {
  const command =
    prepared.promptFile && isLegacyOpenCodeCatPromptCommand(prepared.command)
      ? `opencode run --model ${OPENCODE_BIG_PICKLE_MODEL} ${shellQuote(OPENCODE_PROMPT_FILE_MESSAGE)} --file ${shellQuote(prepared.promptFile)}`
      : prepared.command
  if (!isOpenCodeRunCommand(command)) return { ...prepared, command }
  return {
    ...prepared,
    command: withOpenCodeBugLensAgent(command),
    env: {
      ...prepared.env,
      OPENCODE_CONFIG_CONTENT: buildOpenCodeConfigContent(repositories),
    },
  }
}

function cleanupPromptFile(promptFile?: string): void {
  if (!promptFile) return
  try {
    fs.rmSync(path.dirname(promptFile), { recursive: true, force: true })
  } catch {
    /* no bloquear el resultado por limpieza temporal */
  }
}

export function stripAnsi(value: string): string {
  return value.replace(ANSI_CSI_REGEX, '').replace(ANSI_OSC_REGEX, '')
}

interface ExternalAgentErrorDetails {
  message: string
  killed?: boolean
  signal?: NodeJS.Signals | null
}

function externalAgentErrorMessage(
  error: ExternalAgentErrorDetails,
  output: string,
  timeoutMs: number,
  stalledProgressMs?: number,
): string {
  if (stalledProgressMs) {
    return [
      `El agente externo quedó en progreso interno sin entregar un informe durante ${Math.round(stalledProgressMs / 1000)}s.`,
      'Esto suele pasar cuando el comando necesita permisos, TTY o confirmación interactiva.',
      'Configurá un modo no interactivo del agente o elegí otro preset en Settings.',
    ].join('\n')
  }

  if (error.killed && error.signal === 'SIGTERM') {
    return `El agente externo superó el timeout de ${Math.round(timeoutMs / 1000)}s.`
  }

  const combined = `${error.message}\n${output}`.toLowerCase()
  if (combined.includes('stdin is not a terminal') || combined.includes('stdin is not a tty')) {
    return [
      error.message,
      'El comando parece interactivo y necesita una terminal real.',
      'Configurá el modo no interactivo del agente y usá {promptFile} para pasarle el bug.',
      'Ejemplo para Codex CLI: codex exec "$(cat {promptFile})"',
    ].join('\n')
  }

  if (
    combined.includes('api key is missing') ||
    combined.includes('api key missing') ||
    combined.includes('missing api key')
  ) {
    const envMatch = output.match(/[A-Z][A-Z0-9_]*API[A-Z0-9_]*KEY[A-Z0-9_]*/)?.[0]
    return [
      'El agente externo está instalado, pero su provider no está configurado.',
      envMatch ? `Falta configurar ${envMatch} en el entorno del agente.` : '',
      'BugLens no maneja esa credencial: corregí la configuración del agente local o elegí otro preset.',
    ]
      .filter(Boolean)
      .join('\n')
  }

  return error.message
}

function resolveStalledProgressTimeoutMs(timeoutMs: number): number {
  const configured = Number(process.env['EXTERNAL_AGENT_STALLED_PROGRESS_TIMEOUT_MS'])
  if (Number.isFinite(configured) && configured > 0) return configured
  return Math.min(DEFAULT_STALLED_PROGRESS_TIMEOUT_MS, timeoutMs)
}

function hasExpectedReportContent(output: string): boolean {
  return /(^|\n)#{1,3}\s*(resumen|evidencia|diagn[oó]stico|archivos|estado probable|pr[oó]ximos pasos|informaci[oó]n faltante)\b/i.test(
    output,
  )
}

function isOperationalProgressOnly(output: string): boolean {
  if (hasExpectedReportContent(output)) return false
  const normalized = output.toLowerCase()
  const hasTodoList =
    normalized.includes('todos') &&
    (/\[\s\]|\[[x·•.-]\]/i.test(output) || normalized.includes('sintetizar evidencia'))
  const hasPermissionPrompt =
    normalized.includes('permission requested') ||
    normalized.includes('approval required') ||
    normalized.includes('waiting for approval') ||
    normalized.includes('confirm')
  return hasTodoList || hasPermissionPrompt
}

function terminateExternalProcess(child: cp.ChildProcess, detached: boolean): void {
  if (detached && child.pid) {
    const processGroupId = -child.pid
    try {
      process.kill(processGroupId, 'SIGTERM')
    } catch {
      child.kill('SIGTERM')
    }
    setTimeout(() => {
      try {
        process.kill(processGroupId, 'SIGKILL')
      } catch {
        /* el proceso ya terminó */
      }
    }, PROCESS_TERMINATION_GRACE_MS).unref()
    return
  }

  child.kill('SIGTERM')
  setTimeout(() => {
    if (!child.killed) child.kill('SIGKILL')
  }, PROCESS_TERMINATION_GRACE_MS).unref()
}

function normalizeExternalAgentRepositories(
  repositories?: ExternalAgentRepository[],
  legacyWorkingDirectory?: string,
): ExternalAgentRepository[] {
  const normalized = (repositories ?? [])
    .map((repo) => ({ path: repo.path.trim(), branch: repo.branch.trim() }))
    .filter((repo) => repo.path)
  if (normalized.length > 0) return normalized
  const legacyPath = legacyWorkingDirectory?.trim()
  return legacyPath ? [{ path: legacyPath, branch: '' }] : []
}

export function buildExternalAgentPrompt(
  bug: AnalyzedBug,
  repositories?: ExternalAgentRepository[] | string,
): string {
  const raw = bug.enriched.raw
  const analysis = bug.analysis
  const rewritten = analysis.rewritten
  const normalizedRepositories =
    typeof repositories === 'string'
      ? normalizeExternalAgentRepositories(undefined, repositories)
      : normalizeExternalAgentRepositories(repositories)
  const repositoryContext =
    normalizedRepositories.length === 1 && !normalizedRepositories[0].branch
      ? `- El repositorio local disponible está en: ${normalizedRepositories[0].path}. Usalo como directorio de trabajo para leer código si aporta al bug.`
      : normalizedRepositories.length > 0
        ? [
            `- Repositorios locales disponibles: ${normalizedRepositories.length}.`,
            ...normalizedRepositories.map((repo, index) =>
              [
                `  ${index + 1}. Ruta: ${repo.path}`,
                repo.branch
                  ? `     Rama objetivo: ${repo.branch}`
                  : '     Rama objetivo: no indicada',
                index === 0 ? '     Directorio de trabajo inicial del agente.' : '',
              ]
                .filter(Boolean)
                .join('\n'),
            ),
            '- Usá las ramas objetivo como contexto de lectura. No hagas checkout ni cambies ramas salvo que el usuario lo haya pedido explícitamente.',
            '- Si necesitás inspeccionar una rama distinta a la activa, preferí comandos de solo lectura como git show, git grep o git diff apuntando a esa rama.',
          ].join('\n')
        : '- No se configuraron repositorios locales para esta ejecución; analizá solo con el reporte y documentos disponibles.'
  const docs = bug.enriched.googleDocs
    .map((doc, index) => {
      const state = doc.accessible ? 'accesible' : `no accesible: ${doc.error ?? 'sin detalle'}`
      const text = doc.text.trim()
      return [
        `Documento ${index + 1}: ${doc.title || doc.url}`,
        `URL: ${doc.url}`,
        `Estado: ${state}`,
        text ? `Contenido:\n${text}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')

  return [
    'Sos un agente externo invocado por BugLens para analizar un bug puntual.',
    'Tu objetivo es ayudar a un equipo de producto/desarrollo a entender el reporte y decidir el siguiente paso.',
    '',
    'Reglas de análisis',
    '- Respondé siempre en español.',
    '- Mantenete estrictamente dentro del bug informado: no abras investigaciones laterales si no ayudan a este reporte.',
    '- Si tenés acceso a un repositorio local, podés leer archivos, buscar referencias y revisar tests/logs relevantes.',
    '- No uses subagentes, agentes de exploración, tareas delegadas ni herramientas tipo task. Hacé la lectura vos mismo.',
    '- No intentes usar shell/bash/comandos del sistema. Usá solo herramientas de lectura y búsqueda si el agente las ofrece.',
    '- No modifiques archivos, no instales dependencias, no ejecutes migraciones, no hagas commits y no borres datos.',
    '- Evitá comandos destructivos o de larga duración. Si necesitás ejecutar algo, priorizá comandos de solo lectura.',
    '- Separá evidencia comprobada de hipótesis. No presentes una suposición como hecho.',
    '- Si no tenés suficiente contexto para confirmar la causa, decilo y proponé qué dato faltaría.',
    '- Tratá el reporte como una observación histórica de QA, no como prueba de que el código actual sigue fallando. No escribas "el reporte confirma" para justificar el estado actual; contrastá cada paso con evidencia del código vigente.',
    '- Evaluá los pasos reportados uno por uno. El estado final depende solo de esos pasos, no de bugs laterales que encuentres en la misma pantalla, módulo o servicio.',
    '- Si encontrás otro problema relacionado pero distinto al reporte, ponelo en "Hallazgos laterales" y no lo uses para marcar el bug original como no resuelto.',
    '- Si el reporte habla de campos obligatorios, asteriscos, required o mensajes visuales, cualquier campo del mismo formulario que tenga asterisco pero no validación required es parte de la cobertura del bug, no hallazgo lateral.',
    '- Si el reporte describe una reproducción por UI, evaluá primero controles, validadores, bloqueo de input y mensajes visibles de esa UI. La falta de validación redundante en backend/API directa es hallazgo lateral salvo que demuestres que la UI actual envía ese payload inválido.',
    '- No marques "no_resuelto" por recomendaciones de defensa en profundidad, inconsistencias potenciales o hipótesis. Usá "no_determinable" si falta ejecutar la app, y "parcialmente_resuelto" si algunos pasos están cubiertos y otros no fueron verificados.',
    '- No uses el formato viejo "Parece resuelto: sí/no". Usá exactamente "Estado probable: ..." con una de las opciones indicadas.',
    '- No expongas secretos, tokens, variables sensibles ni datos personales innecesarios.',
    '- No devuelvas JSON salvo que el comando o el usuario lo pida explícitamente.',
    '- No te limites a narrar acciones realizadas: cerrá con una conclusión accionable.',
    repositoryContext,
    '',
    'Bug original',
    `Título: ${raw.title}`,
    `Descripción: ${raw.description || 'No informado'}`,
    raw.stepsToReproduce ? `Pasos originales: ${raw.stepsToReproduce}` : '',
    raw.expectedResult ? `Resultado esperado original: ${raw.expectedResult}` : '',
    raw.actualResult ? `Resultado actual original: ${raw.actualResult}` : '',
    raw.environment ? `Ambiente original: ${raw.environment}` : '',
    raw.reporter ? `Reporter: ${raw.reporter}` : '',
    raw.assignee ? `Asignado a: ${raw.assignee}` : '',
    raw.priority ? `Prioridad original: ${raw.priority}` : '',
    '',
    'Reescritura de BugLens',
    `Resumen: ${analysis.summary}`,
    `Área afectada: ${analysis.affectedArea}`,
    `Categoría: ${analysis.category}`,
    `Severidad: ${analysis.severity}`,
    `Qué pasa: ${rewritten.observed}`,
    `Qué debería pasar: ${rewritten.expected}`,
    rewritten.steps.length > 0
      ? `Pasos reescritos:\n${rewritten.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`
      : 'Pasos reescritos: No informado',
    `Ambiente reescrito: ${rewritten.environment}`,
    analysis.missingInformation.length > 0
      ? `Información faltante: ${analysis.missingInformation.join('; ')}`
      : 'Información faltante: ninguna',
    '',
    docs ? `Documentos adjuntos\n${docs}` : 'Documentos adjuntos: ninguno',
    '',
    'Contrato de salida obligatorio',
    '- Respondé únicamente con Markdown.',
    '- Usá exactamente las secciones de la plantilla, en el mismo orden y con los mismos títulos.',
    '- No agregues secciones nuevas, prólogos, epílogos, tablas, emojis ni bloques JSON.',
    '- No omitas secciones. Si una sección no aplica, escribí "ninguno", "ninguna" o "no_verificable" según corresponda.',
    '- Usá viñetas con "- " y numeración con "1.". No uses otros estilos de lista.',
    '- En cobertura, cada línea debe tener exactamente este patrón: "Paso N: <paso> → <estado>. <detalle>".',
    '- Los estados de cobertura permitidos son: cubierto, parcial, falla, no_verificable, lateral.',
    '- Si el código actual cubre una parte del paso pero falta otra, usá "parcial". Si el código actual tiene un validador/bloqueo explícito para ese paso, marcá "cubierto" aunque todavía recomiendes una prueba manual. No mezcles hallazgos laterales con el estado del bug original.',
    '',
    'Plantilla obligatoria',
    '',
    '## Resumen',
    '<1 a 3 frases con la conclusión principal.>',
    '',
    '## Evidencia',
    '- <fuente o dato> - <qué sostiene>',
    '- ninguno',
    '',
    '## Cobertura de los pasos reportados',
    '1. Paso 1: <paso reportado> → cubierto | parcial | falla | no_verificable | lateral. <detalle breve>',
    '2. Paso 2: <paso reportado> → cubierto | parcial | falla | no_verificable | lateral. <detalle breve>',
    '',
    '## Diagnóstico probable',
    '<causa o zona probable del bug reportado; aclarar si es hipótesis.>',
    '',
    '## Archivos o áreas a revisar',
    '- <ruta, pantalla, servicio o módulo> - <motivo>',
    '- ninguno',
    '',
    '## Hallazgos laterales',
    '- <hallazgo relacionado pero distinto> - <por qué no cambia el estado del bug original>',
    '- ninguno',
    '',
    '## Estado probable del bug',
    'Estado probable: resuelto | parcialmente_resuelto | no_resuelto | no_determinable',
    'Coincide con el bug reportado: sí | parcial | no',
    'Motivo: <evidencia breve basada solo en los pasos reportados. Usá no_resuelto solo si al menos un paso reportado no tiene validación/bloqueo o hay evidencia directa de que sigue fallando. Usá no_determinable si solo faltan pruebas de ejecución.>',
    '',
    '## Próximos pasos',
    '- <acción concreta para reproducir, verificar, corregir o pedir más información>',
    '- ninguno',
    '',
    '## Información faltante',
    '- <pregunta específica para QA/producto/dev>',
    '- ninguna',
  ]
    .filter((line) => line !== '')
    .join('\n')
}

export function runExternalAgent(
  command: string,
  bug: AnalyzedBug,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onProgress?: (progress: ExternalAgentProgress) => void,
  repositories?: ExternalAgentRepository[] | string,
): Promise<ExternalAgentResult> {
  const trimmedCommand = command.trim()
  const startedAt = Date.now()
  const normalizedRepositories =
    typeof repositories === 'string'
      ? normalizeExternalAgentRepositories(undefined, repositories)
      : normalizeExternalAgentRepositories(repositories)
  const normalizedWorkingDirectory = normalizedRepositories[0]?.path || undefined

  if (!trimmedCommand) {
    return Promise.resolve({
      ok: false,
      output: '',
      error: 'Configurá un comando de agente externo en Settings.',
      command: '',
      durationMs: 0,
    })
  }

  const invalidRepository = normalizedRepositories.find(
    (repo) => !fs.existsSync(repo.path) || !fs.statSync(repo.path).isDirectory(),
  )
  if (invalidRepository) {
    return Promise.resolve({
      ok: false,
      output: '',
      error: `El repositorio local configurado no existe o no es un directorio: ${invalidRepository.path}`,
      command: trimmedCommand,
      workingDirectory: normalizedWorkingDirectory,
      repositories: normalizedRepositories,
      durationMs: 0,
    })
  }

  const prompt =
    normalizedRepositories.length === 1 && !normalizedRepositories[0].branch
      ? buildExternalAgentPrompt(bug, normalizedRepositories[0].path)
      : buildExternalAgentPrompt(bug, normalizedRepositories)
  const prepared = prepareOpenCodeCommand(
    prepareCommand(trimmedCommand, prompt),
    normalizedRepositories,
  )

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false
    let timedOut = false
    let stalledProgress = false
    let progressOnlyStartedAt: number | null = null
    let bufferExceeded = false
    let lastOutputAt = startedAt

    const detached = process.platform !== 'win32'
    const child = cp.spawn(prepared.command, {
      cwd: normalizedWorkingDirectory,
      env: {
        ...process.env,
        ...prepared.env,
        PATH: [process.env['PATH'] ?? '', ...TERMINAL_PATHS].filter(Boolean).join(path.delimiter),
      },
      shell: process.env['SHELL'] || process.env['ComSpec'],
      detached,
      windowsHide: true,
    })

    const stalledProgressTimeoutMs = resolveStalledProgressTimeoutMs(timeoutMs)
    const stalledProgressInterval = setInterval(() => {
      if (!progressOnlyStartedAt) return
      if (Date.now() - progressOnlyStartedAt < stalledProgressTimeoutMs) return
      stalledProgress = true
      terminateExternalProcess(child, detached)
    }, 1000)

    const timeout = setTimeout(() => {
      timedOut = true
      terminateExternalProcess(child, detached)
    }, timeoutMs)

    const finish = (result: ExternalAgentResult) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      clearInterval(stalledProgressInterval)
      cleanupPromptFile(prepared.promptFile)
      resolve(result)
    }

    const appendOutput = (stream: 'stdout' | 'stderr', chunkBuffer: Buffer) => {
      const chunk = stripAnsi(chunkBuffer.toString('utf8'))
      if (!chunk) return
      if (stream === 'stdout') stdout += chunk
      else stderr += chunk

      const outputBytes = Buffer.byteLength(stdout) + Buffer.byteLength(stderr)
      if (outputBytes > MAX_BUFFER_BYTES) {
        bufferExceeded = true
        terminateExternalProcess(child, detached)
        return
      }

      const now = Date.now()
      const silentMs = now - lastOutputAt
      lastOutputAt = now
      const output = stripAnsi([stdout.trim(), stderr.trim()].filter(Boolean).join('\n\n'))
      if (isOperationalProgressOnly(output)) {
        progressOnlyStartedAt ??= now
      } else {
        progressOnlyStartedAt = null
      }
      onProgress?.({
        bugId: bug.enriched.raw.id,
        output,
        chunk,
        stream,
        command: prepared.command,
        workingDirectory: normalizedWorkingDirectory,
        repositories: normalizedRepositories,
        elapsedMs: now - startedAt,
        silentMs,
      })
    }

    child.stdout?.on('data', (chunk: Buffer) => appendOutput('stdout', chunk))
    child.stderr?.on('data', (chunk: Buffer) => appendOutput('stderr', chunk))

    child.on('error', (error) => {
      const durationMs = Date.now() - startedAt
      const output = stripAnsi([stdout.trim(), stderr.trim()].filter(Boolean).join('\n\n'))
      finish({
        ok: false,
        output,
        error: externalAgentErrorMessage({ message: error.message }, output, timeoutMs),
        command: prepared.command,
        workingDirectory: normalizedWorkingDirectory,
        repositories: normalizedRepositories,
        durationMs,
      })
    })

    child.on('close', (code, signal) => {
      const durationMs = Date.now() - startedAt
      const output = stripAnsi([stdout.trim(), stderr.trim()].filter(Boolean).join('\n\n'))

      if (timedOut || bufferExceeded || code !== 0) {
        const message = bufferExceeded
          ? 'El agente externo devolvió demasiada salida y BugLens detuvo la lectura.'
          : externalAgentErrorMessage(
              {
                message:
                  code === null
                    ? `Command failed: ${prepared.command}`
                    : `Command failed: ${prepared.command} exited with code ${code}`,
                killed: timedOut,
                signal,
              },
              output,
              timeoutMs,
              stalledProgress ? stalledProgressTimeoutMs : undefined,
            )
        finish({
          ok: false,
          output,
          error: message,
          command: prepared.command,
          workingDirectory: normalizedWorkingDirectory,
          repositories: normalizedRepositories,
          durationMs,
        })
        return
      }

      finish({
        ok: true,
        output: output || 'El agente terminó sin devolver salida.',
        command: prepared.command,
        workingDirectory: normalizedWorkingDirectory,
        repositories: normalizedRepositories,
        durationMs,
      })
    })

    if (prepared.promptFile) child.stdin?.end()
    else {
      child.stdin?.on('error', () => {
        /* Algunos agentes cierran stdin de inmediato; se reporta por stderr/exit code. */
      })
      child.stdin?.end(prompt)
    }
  })
}
