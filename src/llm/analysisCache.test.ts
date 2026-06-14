import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { BugAnalysis, EnrichedBug, LLMConfig } from '../types/index'
import {
  clearCache,
  getCacheStats,
  loadCachedAnalysis,
  makeCacheKey,
  saveCachedAnalysis,
} from './analysisCache'

function bug(
  over: Partial<{ title: string; description: string; docText: string }> = {},
): EnrichedBug {
  const { title = 'Login roto', description = 'no anda', docText } = over
  return {
    raw: { id: 'b1', rowIndex: 1, title, description, rawRow: {}, googleDocLinks: [] },
    googleDocs: docText ? [{ url: 'u', title: 'doc', text: docText, accessible: true }] : [],
  }
}

const cfg: LLMConfig = { provider: 'ollama', model: 'qwen2.5:7b' }

const analysis: BugAnalysis = {
  category: 'frontend',
  severity: 'high',
  confidence: 0.9,
  affectedArea: 'login',
  summary: 'roto',
  rewritten: { observed: 'o', expected: 'e', steps: ['s'], environment: 'dev', problemCount: 1 },
  missingInformation: [],
  rawResponse: '{}',
}

describe('makeCacheKey', () => {
  it('determinista: mismo input → misma clave', () => {
    expect(makeCacheKey(bug(), cfg)).toBe(makeCacheKey(bug(), cfg))
  })
  it('cambia con el contenido del bug', () => {
    expect(makeCacheKey(bug({ title: 'A' }), cfg)).not.toBe(makeCacheKey(bug({ title: 'B' }), cfg))
  })
  it('cambia con el texto del documento', () => {
    expect(makeCacheKey(bug(), cfg)).not.toBe(makeCacheKey(bug({ docText: 'algo nuevo' }), cfg))
  })
  it('cambia con el modelo', () => {
    const a = makeCacheKey(bug(), { provider: 'ollama', model: 'qwen2.5:7b' })
    const b = makeCacheKey(bug(), { provider: 'ollama', model: 'qwen2.5:14b' })
    expect(a).not.toBe(b)
  })
})

describe('cache storage', () => {
  let dir: string
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'buglens-cache-'))
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('guarda y recupera idéntico', () => {
    const key = makeCacheKey(bug(), cfg)
    expect(loadCachedAnalysis(key, dir)).toBeNull()
    saveCachedAnalysis(key, dir, analysis)
    expect(loadCachedAnalysis(key, dir)).toEqual(analysis)
  })

  it('getCacheStats cuenta las entradas', () => {
    expect(getCacheStats(dir).count).toBe(0)
    saveCachedAnalysis('k1', dir, analysis)
    saveCachedAnalysis('k2', dir, analysis)
    expect(getCacheStats(dir).count).toBe(2)
  })

  it('clearCache borra todo', () => {
    saveCachedAnalysis('k1', dir, analysis)
    clearCache(dir)
    expect(loadCachedAnalysis('k1', dir)).toBeNull()
    expect(getCacheStats(dir).count).toBe(0)
  })
})
