import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AnalyzedBug } from '../types/index.js'
import { clearSession, readSession, writeSession } from './sessionStore'

function makeBug(id: string): AnalyzedBug {
  return {
    enriched: {
      raw: {
        id,
        rowIndex: 1,
        title: `bug ${id}`,
        description: 'd',
        rawRow: {},
        googleDocLinks: [],
      },
      googleDocs: [],
    },
    analysis: {
      category: 'frontend',
      severity: 'medium',
      confidence: 0.8,
      affectedArea: 'x',
      summary: 's',
      rewritten: { observed: 'o', expected: 'e', steps: [], environment: 'dev', problemCount: 1 },
      missingInformation: [],
      rawResponse: '{}',
    },
    status: 'nuevo',
    processingMs: 10,
  }
}

describe('sessionStore', () => {
  let dir: string
  let file: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglens-session-'))
    file = path.join(dir, 'session.json')
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('round-trip: lo escrito se lee igual', () => {
    writeSession(file, { excelPath: '/ruta/bugs.xlsx', results: [makeBug('a'), makeBug('b')] })
    const session = readSession(file)
    expect(session).not.toBeNull()
    expect(session?.excelPath).toBe('/ruta/bugs.xlsx')
    expect(session?.results).toHaveLength(2)
    expect(session?.results[0].enriched.raw.id).toBe('a')
    expect(session?.version).toBe(1)
  })

  it('archivo inexistente → null', () => {
    expect(readSession(path.join(dir, 'noexiste.json'))).toBeNull()
  })

  it('JSON corrupto → null', () => {
    fs.writeFileSync(file, 'esto no es json')
    expect(readSession(file)).toBeNull()
  })

  it('versión distinta → null (descarta sesiones de esquema viejo)', () => {
    fs.writeFileSync(file, JSON.stringify({ version: 999, results: [] }))
    expect(readSession(file)).toBeNull()
  })

  it('escritura atómica: no deja .tmp colgado', () => {
    writeSession(file, { excelPath: null, results: [makeBug('a')] })
    expect(fs.existsSync(file)).toBe(true)
    expect(fs.existsSync(`${file}.tmp`)).toBe(false)
  })

  it('crea el directorio si no existe', () => {
    const nested = path.join(dir, 'sub', 'dir', 'session.json')
    writeSession(nested, { excelPath: null, results: [] })
    expect(fs.existsSync(nested)).toBe(true)
  })

  it('clearSession borra el archivo y no falla si no existe', () => {
    writeSession(file, { excelPath: null, results: [] })
    clearSession(file)
    expect(fs.existsSync(file)).toBe(false)
    expect(() => clearSession(file)).not.toThrow()
  })
})
