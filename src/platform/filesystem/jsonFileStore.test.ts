import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  childJsonFilePath,
  deleteFileIfExists,
  readJsonFile,
  writeJsonFile,
} from './jsonFileStore.js'

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglens-json-store-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('jsonFileStore', () => {
  it('resuelve un archivo hijo dentro del directorio base', () => {
    expect(childJsonFilePath('C:/BugLens', 'settings.json')).toBe(
      path.join('C:/BugLens', 'settings.json'),
    )
  })

  it('lee null cuando el archivo no existe o no es JSON valido', () => {
    const dir = makeTempDir()
    const missingPath = path.join(dir, 'missing.json')
    const invalidPath = path.join(dir, 'invalid.json')
    fs.writeFileSync(invalidPath, '{')

    expect(readJsonFile(missingPath)).toBeNull()
    expect(readJsonFile(invalidPath)).toBeNull()
  })

  it('crea directorios y escribe JSON formateado', () => {
    const filePath = path.join(makeTempDir(), 'nested', 'settings.json')

    writeJsonFile(filePath, { onboarded: true })

    expect(JSON.parse(fs.readFileSync(filePath, 'utf8'))).toEqual({ onboarded: true })
  })

  it('borra un archivo si existe y tolera ausentes', () => {
    const filePath = path.join(makeTempDir(), 'settings.json')
    fs.writeFileSync(filePath, '{}')

    deleteFileIfExists(filePath)
    deleteFileIfExists(filePath)

    expect(fs.existsSync(filePath)).toBe(false)
  })
})
