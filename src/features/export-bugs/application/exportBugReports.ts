import * as path from 'node:path'
import type { AnalyzedBug } from '../../../shared/contracts/bugTypes.js'
import type { AnalysisExportRow } from '../../analyze-bugs/infrastructure/excelReader.js'
import {
  writeBugsExcel,
  writeEnrichedExcel,
} from '../../analyze-bugs/infrastructure/excelReader.js'
import { writeFullDataJson } from './fullDataExport.js'

export function enrichedExcelDefaultName(originalPath: string): string {
  return `${path.basename(originalPath, path.extname(originalPath))}_analizado.xlsx`
}

export function fullDataDefaultName(sourceExcelPath: string | null): string {
  return sourceExcelPath
    ? `${path.basename(sourceExcelPath, path.extname(sourceExcelPath))}_datos_completos.json`
    : 'bugs_datos_completos.json'
}

export function toAnalysisExportRow(result: AnalyzedBug): AnalysisExportRow {
  return {
    rowIndex: result.enriched.raw.rowIndex,
    category: result.analysis.category,
    severity: result.analysis.severity,
    bugType: result.analysis.bugType ?? '',
    confidence: result.analysis.confidence,
    summary: result.analysis.summary,
    observed: result.analysis.rewritten.observed,
    expected: result.analysis.rewritten.expected,
    steps: result.analysis.rewritten.steps,
    environment: result.analysis.rewritten.environment,
    missingInformation: result.analysis.missingInformation,
    error: result.error,
  }
}

export function exportEnrichedExcel(
  outputPath: string,
  originalPath: string,
  results: AnalyzedBug[],
): void {
  writeEnrichedExcel(outputPath, originalPath, results.map(toAnalysisExportRow))
}

export function exportBugsExcel(outputPath: string, results: AnalyzedBug[]): void {
  writeBugsExcel(
    outputPath,
    results.map((result) => ({
      title: result.enriched.raw.title,
      ...toAnalysisExportRow(result),
    })),
  )
}

export function exportFullDataJson(
  outputPath: string,
  results: AnalyzedBug[],
  sourceExcelPath: string | null,
): void {
  writeFullDataJson(outputPath, results, sourceExcelPath)
}
