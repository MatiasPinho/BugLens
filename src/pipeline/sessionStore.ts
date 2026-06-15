/**
 * sessionStore.ts
 *
 * Persiste la SESIÓN de trabajo (los bugs cargados ahora — de Excel o manuales —
 * con su análisis) en un JSON local, para reconstruir la tabla al reabrir la app.
 *
 * A diferencia de `bugRecordsStore` (estado por contenido) y `analysisCache`
 * (análisis por contenido), acá guardamos la lista completa renderizada para un
 * restore instantáneo, sin volver a llamar al LLM ni re-enriquecer docs.
 *
 * Escritura ATÓMICA (temp + rename): un cierre a mitad de escritura no corrompe
 * el archivo (queda la versión anterior intacta).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { AnalyzedBug } from '../types/index.js'

const SESSION_VERSION = 1

export interface SessionData {
  version: number
  savedAt: string
  excelPath: string | null
  results: AnalyzedBug[]
}

/** Lee la sesión guardada. Inexistente, corrupta o de versión distinta → `null`. */
export function readSession(filePath: string): SessionData | null {
  try {
    if (!fs.existsSync(filePath)) return null
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SessionData
    if (data.version !== SESSION_VERSION || !Array.isArray(data.results)) return null
    return data
  } catch {
    return null
  }
}

/**
 * Persiste la sesión de forma atómica: escribe a `<file>.tmp` y renombra. No
 * bloquea ante errores de escritura (limpia el temp si quedó).
 */
export function writeSession(
  filePath: string,
  session: { excelPath: string | null; results: AnalyzedBug[] },
): void {
  const data: SessionData = {
    version: SESSION_VERSION,
    savedAt: new Date().toISOString(),
    excelPath: session.excelPath,
    results: session.results,
  }
  const tmpPath = `${filePath}.tmp`
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(tmpPath, JSON.stringify(data))
    fs.renameSync(tmpPath, filePath)
  } catch {
    // Limpiar el temp si quedó colgado; no bloquear por un error de escritura.
    try {
      if (fs.existsSync(tmpPath)) fs.rmSync(tmpPath)
    } catch {
      /* skip */
    }
  }
}

/** Borra la sesión guardada (al iniciar un análisis nuevo). */
export function clearSession(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) fs.rmSync(filePath)
  } catch {
    /* skip */
  }
}
