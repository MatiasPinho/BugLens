import type { RawBug } from '../../../shared/contracts/bugTypes.js'
import type { LLMConfig } from '../../../shared/contracts/settingsTypes.js'
import { readExcel } from '../infrastructure/excelReader.js'
import type { BugEnricher } from './bugEnricher.js'
import { analyzeBug } from './fastTriage.js'
import { buildManualBug, type ManualBugFields } from './manualBugBuilder.js'

export function analyzeExcelBugs(excelPath: string): RawBug[] {
  return readExcel(excelPath)
}

export function analyzeManualBug(fields: ManualBugFields, seq = 1): RawBug {
  return buildManualBug(fields, seq)
}

export async function enrichBugReport(enricher: BugEnricher, bug: RawBug) {
  return enricher.enrich(bug)
}

export async function classifyAndRewriteBug(enricher: BugEnricher, bug: RawBug, config: LLMConfig) {
  const enriched = await enrichBugReport(enricher, bug)
  return analyzeBug(enriched, config)
}
