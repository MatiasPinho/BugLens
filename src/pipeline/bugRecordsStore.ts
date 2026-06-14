/**
 * bugRecordsStore.ts
 *
 * Persiste el estado de cada bug (clave por contenido → estado) en un JSON local.
 * Solo se guardan los bugs con estado distinto de 'nuevo' (el default), para
 * mantener el archivo chico y que revertir a 'nuevo' borre el registro.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { BugStatus } from '../types/index.js'

interface RecordEntry {
  status: BugStatus
  updatedAt: string
}
export type BugRecords = Record<string, RecordEntry>

/** Lee el mapa `clave → {estado, updatedAt}` del JSON. Inexistente o corrupto → `{}`. */
export function readRecords(filePath: string): BugRecords {
  try {
    if (!fs.existsSync(filePath)) return {}
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as BugRecords
  } catch {
    return {}
  }
}

/** Persiste el estado de un bug. Si es `nuevo` (el default), borra el registro. */
export function setBugStatus(filePath: string, key: string, status: BugStatus): void {
  const records = readRecords(filePath)
  if (status === 'nuevo') {
    delete records[key] // revertir a default → no ocupa lugar
  } else {
    records[key] = { status, updatedAt: new Date().toISOString() }
  }
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(records, null, 2))
  } catch {
    // No bloquear por un error de escritura
  }
}
