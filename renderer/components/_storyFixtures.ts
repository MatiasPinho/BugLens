// Fábrica de AnalyzedBug para las historias de Storybook (no es una *.stories,
// así que Storybook no la carga como historia).

import type { AnalyzedBug, BugCategory, BugStatus, Severity } from '../../src/types/index'

export function makeBug(o: {
  id: string
  title: string
  summary?: string
  status?: BugStatus
  category?: BugCategory
  severity?: Severity
  observed?: string
  expected?: string
  steps?: string[]
  environment?: string
  missing?: string[]
}): AnalyzedBug {
  const observed = o.observed ?? 'qué pasa, reescrito en lenguaje claro'
  return {
    enriched: {
      raw: {
        id: o.id,
        rowIndex: Number(o.id.replace(/\D/g, '')) || 1,
        title: o.title,
        description: 'reporte original del QA (a veces incoherente)',
        rawRow: {},
        googleDocLinks: [],
      },
      googleDocs: [],
    },
    analysis: {
      category: o.category ?? 'frontend',
      severity: o.severity ?? 'medium',
      bugType: 'validation',
      confidence: 0.85,
      affectedArea: 'formularios',
      summary: o.summary ?? `resumen de ${o.title}`,
      rewritten: {
        observed,
        expected: o.expected ?? 'qué debería pasar',
        steps: o.steps ?? ['paso 1', 'paso 2'],
        environment: o.environment ?? 'dev',
        problemCount: (observed.match(/^\s*\d+[.)]\s/gm) ?? []).length || 1,
      },
      missingInformation: o.missing ?? [],
      rawResponse: '{}',
    },
    status: o.status ?? 'nuevo',
    processingMs: 10,
  }
}
