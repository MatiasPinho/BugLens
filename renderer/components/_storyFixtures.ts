// Fábrica de AnalyzedBug para las historias de Storybook (no es una *.stories,
// así que Storybook no la carga como historia).

import type {
  AnalyzedBug,
  BugCategory,
  BugComment,
  BugStatus,
  CommentVote,
  Severity,
} from '../../src/shared/contracts'

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
  reporter?: string
  /** Ruta de la pantalla afectada, como la informaría el Excel del QA. */
  screen?: string
  confidence?: number
}): AnalyzedBug {
  const observed = o.observed ?? 'qué pasa, reescrito en lenguaje claro'
  return {
    enriched: {
      raw: {
        id: o.id,
        rowIndex: Number(o.id.replace(/\D/g, '')) || 1,
        title: o.title,
        description: 'reporte original del QA (a veces incoherente)',
        reporter: o.reporter,
        rawRow: o.screen ? { url: `https://finn.app${o.screen}` } : {},
        googleDocLinks: [],
      },
      googleDocs: [],
    },
    analysis: {
      category: o.category ?? 'frontend',
      severity: o.severity ?? 'medium',
      bugType: 'validation',
      confidence: o.confidence ?? 0.85,
      affectedArea: o.screen ?? 'formularios',
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

// Comentario de prueba con los agregados de voto ya en cero: evita repetir
// `upvotes/downvotes/myVote` en cada fixture de historia y de test.
export function makeComment(o: {
  id: string
  body: string
  createdAt?: string
  parentId?: string | null
  authorEmail?: string
  authorName?: string
  upvotes?: number
  downvotes?: number
  myVote?: CommentVote
}): BugComment {
  return {
    id: o.id,
    parentId: o.parentId ?? null,
    body: o.body,
    createdAt: o.createdAt ?? '2026-01-01T10:00:00.000Z',
    authorEmail: o.authorEmail,
    authorName: o.authorName,
    upvotes: o.upvotes ?? 0,
    downvotes: o.downvotes ?? 0,
    myVote: o.myVote ?? 0,
  }
}
