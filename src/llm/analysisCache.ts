/**
 * analysisCache.ts
 *
 * Cache de resultados del análisis (clasificación + reescritura).
 * Clave: SHA-256 de (bug content + doc content + images + model + provider + prompt version).
 *
 * Si nada del input cambió, no llamamos al LLM:
 *  - Re-correr el mismo Excel → 0 llamadas LLM
 *  - Mismo bug, modelo distinto → cache miss, recálculo
 *  - Misma config, prompt actualizado → cache miss (bump PROMPT_VERSION)
 */

import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import type { BugAnalysis, EnrichedBug, LLMConfig } from '../types/index.js'

// Bump cuando cambia el prompt — invalida cache vieja para forzar recálculo.
const PROMPT_VERSION = 'v11-2026-06-vision-images'

const SUBDIR = 'analysis'

// ─── Key generation ──────────────────────────────────────────────────────────

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 32)
}

/**
 * Computa la clave de cache para un bug + configuración.
 * Idempotente: mismo input → misma clave → mismo resultado cacheado.
 */
export function makeCacheKey(enriched: EnrichedBug, config: LLMConfig): string {
  const bug = enriched.raw
  const bugParts = [
    bug.id,
    bug.title,
    bug.description ?? '',
    JSON.stringify(bug.rawRow),
    bug.stepsToReproduce ?? '',
    bug.expectedResult ?? '',
    bug.actualResult ?? '',
  ].join('|')

  const docParts = enriched.googleDocs
    .filter((d) => d.accessible)
    .map((d) => `${d.title}::${d.text}`)
    .join('||')

  const imageParts = enriched.googleDocs
    .filter((d) => d.accessible)
    .flatMap((d) => d.images ?? [])
    .map((img) => `${img.mimeType}:${sha256(img.data)}`)
    .join('||')

  const modelKey = `${config.provider}/${config.model ?? 'default'}`

  return sha256([PROMPT_VERSION, modelKey, bugParts, docParts, imageParts].join('|'))
}

// ─── Storage ──────────────────────────────────────────────────────────────────

interface CacheEntry {
  cachedAt: string
  key: string
  value: BugAnalysis
}

function cachePath(dir: string, key: string): string {
  return path.join(dir, SUBDIR, `${key}.json`)
}

/** Devuelve el análisis cacheado para la clave, o `null` si no existe / está corrupto. */
export function loadCachedAnalysis(key: string, dir: string): BugAnalysis | null {
  const file = cachePath(dir, key)
  if (!fs.existsSync(file)) return null
  try {
    const entry = JSON.parse(fs.readFileSync(file, 'utf8')) as CacheEntry
    return entry.value
  } catch {
    return null
  }
}

/** Guarda el análisis bajo la clave dada. No bloquea ante errores de escritura. */
export function saveCachedAnalysis(key: string, dir: string, value: BugAnalysis): void {
  fs.mkdirSync(path.join(dir, SUBDIR), { recursive: true })
  const entry: CacheEntry = { cachedAt: new Date().toISOString(), key, value }
  try {
    fs.writeFileSync(cachePath(dir, key), JSON.stringify(entry, null, 2))
  } catch {
    // No bloquear el análisis por un error de escritura
  }
}

// ─── Stats / management ──────────────────────────────────────────────────────

/** Cantidad de análisis cacheados y tamaño total en KB. */
export function getCacheStats(dir: string): { count: number; sizeKB: number } {
  const subDir = path.join(dir, SUBDIR)
  if (!fs.existsSync(subDir)) return { count: 0, sizeKB: 0 }
  try {
    const files = fs.readdirSync(subDir).filter((f) => f.endsWith('.json'))
    let totalSize = 0
    for (const f of files) {
      try {
        totalSize += fs.statSync(path.join(subDir, f)).size
      } catch {
        /* skip */
      }
    }
    return { count: files.length, sizeKB: Math.round(totalSize / 1024) }
  } catch {
    return { count: 0, sizeKB: 0 }
  }
}

/** Borra toda la caché de análisis del directorio. */
export function clearCache(dir: string): void {
  const subDir = path.join(dir, SUBDIR)
  if (fs.existsSync(subDir)) fs.rmSync(subDir, { recursive: true, force: true })
}
