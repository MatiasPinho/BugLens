import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AnalyzedBug } from '../types/index.js'
import { buildFullDataExport, writeFullDataJson } from './fullDataExport'

function makeBug(id: string): AnalyzedBug {
  return {
    enriched: {
      raw: {
        id,
        rowIndex: 7,
        title: `bug ${id}`,
        description: 'La pantalla no carga.',
        stepsToReproduce: 'Abrir la pantalla',
        expectedResult: 'Debe cargar',
        actualResult: 'Queda en blanco',
        environment: 'local',
        reporter: 'QA',
        rawRow: {
          Título: `bug ${id}`,
          CampoExtra: 'valor original',
        },
        googleDocLinks: ['https://docs.google.com/document/d/abc123/edit'],
      },
      googleDocs: [
        {
          url: 'https://docs.google.com/document/d/abc123/edit',
          title: 'Evidencia',
          text: 'Texto recopilado desde el documento.',
          accessible: true,
          images: [{ data: 'base64-data', mimeType: 'image/png', alt: 'captura' }],
        },
      ],
    },
    analysis: {
      category: 'frontend',
      severity: 'high',
      bugType: 'ui',
      confidence: 0.85,
      affectedArea: '/form',
      summary: 'El formulario queda en blanco.',
      rewritten: {
        observed: 'Al abrir la pantalla, el formulario queda en blanco.',
        expected: 'El formulario debe mostrarse correctamente.',
        steps: ['Abrir /form'],
        environment: 'local',
        problemCount: 1,
      },
      missingInformation: ['navegador'],
      rawResponse: '{"summary":"raw"}',
    },
    status: 'en_progreso',
    error: 'warning de prueba',
    processingMs: 1234,
  }
}

describe('fullDataExport', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglens-full-export-'))
  })

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('arma un export con metadata y todos los resultados sin aplanar', () => {
    const bug = makeBug('a')
    const data = buildFullDataExport([bug], '/tmp/bugs.xlsx', '2026-01-02T03:04:05.000Z')

    expect(data.version).toBe(1)
    expect(data.exportedAt).toBe('2026-01-02T03:04:05.000Z')
    expect(data.sourceExcelPath).toBe('/tmp/bugs.xlsx')
    expect(data.bugCount).toBe(1)
    expect(data.results[0]).toEqual(bug)
    expect(data.results[0].enriched.raw.rawRow.CampoExtra).toBe('valor original')
    expect(data.results[0].enriched.googleDocs[0].images?.[0].data).toBe('base64-data')
    expect(data.results[0].analysis.rawResponse).toBe('{"summary":"raw"}')
  })

  it('escribe un JSON legible y crea directorios si hace falta', () => {
    const outputPath = path.join(dir, 'nested', 'bugs_completos.json')
    const bug = makeBug('b')

    writeFullDataJson(outputPath, [bug], null)

    const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
    expect(parsed.sourceExcelPath).toBeNull()
    expect(parsed.bugCount).toBe(1)
    expect(parsed.results[0].enriched.raw.id).toBe('b')
    expect(fs.readFileSync(outputPath, 'utf8')).toContain('\n  "results"')
  })
})
