import * as fs from 'node:fs'
import * as path from 'node:path'

export function childJsonFilePath(basePath: string, fileName: string): string {
  return path.join(basePath, fileName)
}

export function readJsonFile(filePath: string): unknown {
  if (!fs.existsSync(filePath)) return null

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown
  } catch {
    return null
  }
}

export function writeJsonFile(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2))
}

export function deleteFileIfExists(filePath: string): void {
  try {
    fs.rmSync(filePath, { force: true })
  } catch {
    // Best effort: callers can continue with their recovery path.
  }
}
