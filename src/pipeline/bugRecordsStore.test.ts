import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readRecords, setBugStatus } from './bugRecordsStore'

function tmpFile(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglens-records-'))
  return path.join(dir, 'bug-records.json')
}

describe('bugRecordsStore', () => {
  let file: string
  beforeEach(() => {
    file = tmpFile()
  })
  afterEach(() => {
    fs.rmSync(path.dirname(file), { recursive: true, force: true })
  })

  it('archivo inexistente → {}', () => {
    expect(readRecords(file)).toEqual({})
  })

  it('guarda y lee un estado', () => {
    setBugStatus(file, 'r123', 'solucionado')
    const records = readRecords(file)
    expect(records['r123']?.status).toBe('solucionado')
    expect(typeof records['r123']?.updatedAt).toBe('string')
  })

  it('revertir a "nuevo" borra el registro (no se guarda el default)', () => {
    setBugStatus(file, 'r123', 'cerrado')
    expect(readRecords(file)['r123']).toBeDefined()
    setBugStatus(file, 'r123', 'nuevo')
    expect(readRecords(file)['r123']).toBeUndefined()
  })

  it('mantiene otros registros al actualizar uno', () => {
    setBugStatus(file, 'a', 'en_progreso')
    setBugStatus(file, 'b', 'no_replicado')
    setBugStatus(file, 'a', 'cerrado')
    const records = readRecords(file)
    expect(records['a']?.status).toBe('cerrado')
    expect(records['b']?.status).toBe('no_replicado')
  })

  it('archivo corrupto → {} (no rompe)', () => {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, 'no es json {{{')
    expect(readRecords(file)).toEqual({})
  })
})
