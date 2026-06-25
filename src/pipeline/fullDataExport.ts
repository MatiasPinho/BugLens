import * as fs from 'node:fs'
import * as path from 'node:path'
import type { AnalyzedBug } from '../types/index.js'

const FULL_DATA_EXPORT_VERSION = 1

export interface FullDataExport {
  version: number
  exportedAt: string
  sourceExcelPath: string | null
  bugCount: number
  results: AnalyzedBug[]
}

export function buildFullDataExport(
  results: AnalyzedBug[],
  sourceExcelPath: string | null,
  exportedAt = new Date().toISOString(),
): FullDataExport {
  return {
    version: FULL_DATA_EXPORT_VERSION,
    exportedAt,
    sourceExcelPath,
    bugCount: results.length,
    results,
  }
}

export function writeFullDataJson(
  outputPath: string,
  results: AnalyzedBug[],
  sourceExcelPath: string | null,
): void {
  const data = buildFullDataExport(results, sourceExcelPath)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8')
}
