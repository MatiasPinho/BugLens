import { describe, expect, it } from 'vitest'
import type { AnalyzedBug } from '../../../shared/contracts/bugTypes.js'
import {
  enrichedExcelDefaultName,
  fullDataDefaultName,
  toAnalysisExportRow,
} from './exportBugReports.js'

function makeBug(overrides: Partial<AnalyzedBug> = {}): AnalyzedBug {
  return {
    enriched: {
      raw: {
        id: 'bug-1',
        rowIndex: 3,
        title: 'Login roto',
        description: 'No entra',
        rawRow: {},
        googleDocLinks: [],
      },
      googleDocs: [],
    },
    analysis: {
      category: 'frontend',
      severity: 'high',
      bugType: 'regression',
      confidence: 0.9,
      affectedArea: 'login',
      summary: 'El login falla',
      rewritten: {
        observed: 'No permite entrar',
        expected: 'Debe iniciar sesion',
        steps: ['abrir login', 'enviar form'],
        environment: 'qa',
        problemCount: 1,
      },
      missingInformation: ['usuario usado'],
      rawResponse: '{}',
    },
    status: 'nuevo',
    error: 'fallo evidencia',
    processingMs: 12,
    ...overrides,
  }
}

describe('exportBugReports', () => {
  it('calcula nombres default de export segun el origen', () => {
    expect(enrichedExcelDefaultName('C:/qa/import.xlsx')).toBe('import_analizado.xlsx')
    expect(fullDataDefaultName('C:/qa/import.xlsx')).toBe('import_datos_completos.json')
    expect(fullDataDefaultName(null)).toBe('bugs_datos_completos.json')
  })

  it('mapea un bug analizado a una fila plana de Excel', () => {
    expect(toAnalysisExportRow(makeBug())).toEqual({
      rowIndex: 3,
      category: 'frontend',
      severity: 'high',
      bugType: 'regression',
      confidence: 0.9,
      summary: 'El login falla',
      observed: 'No permite entrar',
      expected: 'Debe iniciar sesion',
      steps: ['abrir login', 'enviar form'],
      environment: 'qa',
      missingInformation: ['usuario usado'],
      error: 'fallo evidencia',
    })
  })

  it('usa string vacio cuando el tipo de bug no vino informado', () => {
    const bug = makeBug({
      analysis: {
        ...makeBug().analysis,
        bugType: undefined,
      },
    })

    expect(toAnalysisExportRow(bug).bugType).toBe('')
  })
})
