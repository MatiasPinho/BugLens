import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { AnalyzedBug } from '../types/index'
import { buildExternalAgentPrompt, runExternalAgent, stripAnsi } from './externalAgent'

function makeBug(): AnalyzedBug {
  return {
    enriched: {
      raw: {
        id: 'b1',
        rowIndex: 1,
        title: 'Login roto',
        description: 'No deja entrar',
        stepsToReproduce: 'abrir login, enviar form',
        expectedResult: 'entra al dashboard',
        actualResult: 'queda cargando',
        environment: 'staging',
        rawRow: {},
        googleDocLinks: [],
      },
      googleDocs: [
        {
          url: 'https://docs.google.com/doc',
          title: 'Evidencia',
          text: 'captura con error 500',
          accessible: true,
        },
      ],
    },
    analysis: {
      category: 'frontend',
      severity: 'high',
      confidence: 0.8,
      affectedArea: 'login',
      summary: 'el login queda cargando',
      rewritten: {
        observed: 'al enviar credenciales queda cargando',
        expected: 'debería entrar al dashboard',
        steps: ['abrir login', 'enviar credenciales'],
        environment: 'staging',
        problemCount: 1,
      },
      missingInformation: ['usuario de prueba'],
      rawResponse: '{}',
    },
    status: 'nuevo',
    processingMs: 10,
  }
}

describe('externalAgent', () => {
  it('arma un prompt con el bug original, la reescritura y documentos', () => {
    const prompt = buildExternalAgentPrompt(makeBug())

    expect(prompt).toContain('Título: Login roto')
    expect(prompt).toContain('Qué pasa: al enviar credenciales queda cargando')
    expect(prompt).toContain('Información faltante: usuario de prueba')
    expect(prompt).toContain('captura con error 500')
    expect(prompt).toContain('No modifiques archivos')
    expect(prompt).toContain('No uses subagentes')
    expect(prompt).toContain('No intentes usar shell/bash')
    expect(prompt).toContain('Tratá el reporte como una observación histórica de QA')
    expect(prompt).toContain('no como prueba de que el código actual sigue fallando')
    expect(prompt).toContain('Evaluá los pasos reportados uno por uno')
    expect(prompt).toContain(
      'cualquier campo del mismo formulario que tenga asterisco pero no validación required',
    )
    expect(prompt).toContain('Si el reporte describe una reproducción por UI')
    expect(prompt).toContain(
      'La falta de validación redundante en backend/API directa es hallazgo lateral',
    )
    expect(prompt).toContain('No uses el formato viejo "Parece resuelto: sí/no"')
    expect(prompt).toContain('Hallazgos laterales')
    expect(prompt).toContain('Separá evidencia comprobada de hipótesis')
    expect(prompt).toContain('## Diagnóstico probable')
    expect(prompt).toContain('## Cobertura de los pasos reportados')
    expect(prompt).toContain('Paso → cubierto | parcial | falla | no_verificable | lateral')
    expect(prompt).toContain('## Estado probable del bug')
    expect(prompt).toContain(
      'Estado probable: resuelto | parcialmente_resuelto | no_resuelto | no_determinable',
    )
    expect(prompt).toContain('Coincide con el bug reportado: sí | parcial | no')
    expect(prompt).toContain(
      'Usá no_resuelto solo si al menos un paso reportado no tiene validación/bloqueo',
    )
    expect(prompt).toContain('## Próximos pasos')
  })

  it('incluye el repositorio local configurado en las reglas del prompt', () => {
    const prompt = buildExternalAgentPrompt(makeBug(), '/repo/app')

    expect(prompt).toContain('El repositorio local disponible está en: /repo/app')
    expect(prompt).not.toContain('Repositorios locales disponibles: 1')
  })

  it('incluye múltiples repositorios y sus ramas objetivo en el prompt', () => {
    const prompt = buildExternalAgentPrompt(makeBug(), [
      { path: '/repo/frontend', branch: 'release/qa' },
      { path: '/repo/backend', branch: 'main' },
    ])

    expect(prompt).toContain('Repositorios locales disponibles: 2')
    expect(prompt).toContain('Ruta: /repo/frontend')
    expect(prompt).toContain('Rama objetivo: release/qa')
    expect(prompt).toContain('Ruta: /repo/backend')
    expect(prompt).toContain('Rama objetivo: main')
    expect(prompt).toContain('No hagas checkout ni cambies ramas')
    expect(prompt).toContain('git show')
  })

  it('ejecuta el comando configurado pasando el prompt por stdin', async () => {
    const result = await runExternalAgent(
      'grep -q "Login roto" && printf ok || printf bad',
      makeBug(),
    )

    expect(result.ok).toBe(true)
    expect(result.output).toBe('ok')
  })

  it('ejecuta el agente externo desde el repositorio local configurado', async () => {
    const workingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'buglens-repo-'))
    try {
      const result = await runExternalAgent('pwd', makeBug(), 1000, undefined, [
        { path: workingDirectory, branch: 'main' },
      ])

      expect(result.ok).toBe(true)
      expect(result.output).toBe(workingDirectory)
      expect(result.workingDirectory).toBe(workingDirectory)
      expect(result.repositories).toEqual([{ path: workingDirectory, branch: 'main' }])
    } finally {
      fs.rmSync(workingDirectory, { recursive: true, force: true })
    }
  })

  it('permite pasar el prompt por archivo temporal con {promptFile}', async () => {
    const result = await runExternalAgent(
      'grep -q "Login roto" {promptFile} && printf ok || printf bad',
      makeBug(),
    )

    expect(result.ok).toBe(true)
    expect(result.output).toBe('ok')
  })

  it('ejecuta OpenCode con un agente BugLens sin subagentes', async () => {
    const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglens-bin-'))
    const previousPath = process.env['PATH']
    const opencodePath = path.join(binDir, 'opencode')
    fs.writeFileSync(
      opencodePath,
      [
        '#!/bin/sh',
        'printf "ARGS:%s\\n" "$*"',
        'printf "CONFIG:%s\\n" "$OPENCODE_CONFIG_CONTENT"',
      ].join('\n'),
      'utf8',
    )
    fs.chmodSync(opencodePath, 0o755)
    process.env['PATH'] = `${binDir}${path.delimiter}${previousPath ?? ''}`

    try {
      const result = await runExternalAgent('opencode run "$(cat {promptFile})"', makeBug(), 1000)
      expect(result.error).toBeUndefined()

      expect(result.ok).toBe(true)
      expect(result.output).toContain('ARGS:run --agent buglens')
      expect(result.output).toContain('"task":{"*":"deny"}')
      expect(result.output).toContain('"edit":"deny"')
    } finally {
      process.env['PATH'] = previousPath
      fs.rmSync(binDir, { recursive: true, force: true })
    }
  })

  it('notifica salida parcial mientras el comando sigue corriendo', async () => {
    const chunks: string[] = []
    const result = await runExternalAgent(
      'printf "pensando"; sleep 0.1; printf " listo"',
      makeBug(),
      1000,
      (progress) => chunks.push(progress.output),
    )

    expect(result.ok).toBe(true)
    expect(result.output).toBe('pensando listo')
    expect(chunks.some((chunk) => chunk.includes('pensando'))).toBe(true)
  })

  it('corta el agente si queda solo en progreso operativo sin informe', async () => {
    process.env['EXTERNAL_AGENT_STALLED_PROGRESS_TIMEOUT_MS'] = '50'
    try {
      const result = await runExternalAgent(
        'printf "TODOS\\n[ ] Explorar frontend\\n[ ] Sintetizar evidencia"; sleep 5',
        makeBug(),
        5000,
      )

      expect(result.ok).toBe(false)
      expect(result.error).toContain('progreso interno')
      expect(result.error).toContain('modo no interactivo')
      expect(result.output).toContain('TODOS')
    } finally {
      delete process.env['EXTERNAL_AGENT_STALLED_PROGRESS_TIMEOUT_MS']
    }
  })

  it('limpia códigos ANSI de la salida del agente', () => {
    expect(stripAnsi('\u001b[91mError:\u001b[0m falta key')).toBe('Error: falta key')
  })

  it('traduce errores de API key faltante del agente local', async () => {
    const result = await runExternalAgent(
      'printf "\\033[91mError: Google Generative AI API key is missing. Pass it using the GOOGLE_GENERATIVE_AI_API_KEY environment variable.\\033[0m" >&2; exit 1',
      makeBug(),
    )

    expect(result.ok).toBe(false)
    expect(result.output).not.toContain('\u001b')
    expect(result.error).toContain('provider no está configurado')
    expect(result.error).toContain('GOOGLE_GENERATIVE_AI_API_KEY')
  })

  it('explica cómo configurar comandos interactivos sin tty', async () => {
    const result = await runExternalAgent(
      'printf "Error: stdin is not a terminal" >&2; exit 1',
      makeBug(),
    )

    expect(result.ok).toBe(false)
    expect(result.error).toContain('modo no interactivo')
    expect(result.error).toContain('{promptFile}')
  })

  it('falla rápido si no hay comando configurado', async () => {
    const result = await runExternalAgent('   ', makeBug())

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/Configurá/)
  })
})
