import { describe, expect, it } from 'vitest'
import type { AnalyzedBug, BugStatus, Severity } from '../../../../src/shared/contracts'
import {
  bugKpis,
  bugReportAsText,
  filterBugs,
  groupByScreen,
  hasActiveFilters,
  isActiveStatus,
  isQuietStatus,
  lifecycleCounts,
  screenOf,
  screenPathOf,
  statusOptionsForTab,
} from './bugPresentation'

function makeBug(over: {
  id: string
  title: string
  status?: BugStatus
  severity?: Severity
  summary?: string
  missing?: string[]
  url?: string
  affectedArea?: string
}): AnalyzedBug {
  return {
    enriched: {
      raw: {
        id: over.id,
        rowIndex: 1,
        title: over.title,
        description: `desc ${over.id}`,
        rawRow: over.url ? { url: over.url } : {},
        googleDocLinks: [],
      },
      googleDocs: [],
    },
    analysis: {
      category: 'frontend',
      severity: over.severity ?? 'medium',
      confidence: 0.8,
      affectedArea: over.affectedArea ?? 'formularios',
      summary: over.summary ?? `resumen ${over.id}`,
      rewritten: {
        observed: 'el botón no responde',
        expected: 'debería enviar el formulario',
        steps: ['abrir la pantalla', 'tocar enviar'],
        environment: 'dev',
        problemCount: 1,
      },
      missingInformation: over.missing ?? [],
      rawResponse: '{}',
    },
    status: over.status ?? 'nuevo',
    processingMs: 10,
  }
}

const baseFilters = {
  lifecycle: 'todos' as const,
  category: 'all' as const,
  severity: 'all' as const,
  status: 'all' as const,
  search: '',
}

describe('ciclo de vida', () => {
  it('separa activos de históricos por estado', () => {
    expect(isActiveStatus('nuevo')).toBe(true)
    expect(isActiveStatus('en_progreso')).toBe(true)
    expect(isActiveStatus('solucionado')).toBe(false)
    expect(isActiveStatus('cerrado')).toBe(false)
    expect(isActiveStatus('no_replicado')).toBe(false)
  })

  it('atenúa solo lo que ya se cerró', () => {
    expect(isQuietStatus('solucionado')).toBe(true)
    expect(isQuietStatus('cerrado')).toBe(true)
    expect(isQuietStatus('no_replicado')).toBe(false)
    expect(isQuietStatus('nuevo')).toBe(false)
  })

  it('cuenta activos, históricos y el total', () => {
    const counts = lifecycleCounts([
      makeBug({ id: 'a', title: 'a', status: 'nuevo' }),
      makeBug({ id: 'b', title: 'b', status: 'en_progreso' }),
      makeBug({ id: 'c', title: 'c', status: 'solucionado' }),
      makeBug({ id: 'd', title: 'd', status: 'no_replicado' }),
    ])
    expect(counts).toEqual({ activos: 2, historicos: 2, todos: 4 })
  })

  it('ofrece solo los estados que tienen sentido en cada pestaña', () => {
    expect(statusOptionsForTab('activos')).toEqual(['nuevo', 'en_progreso'])
    expect(statusOptionsForTab('historicos')).toEqual(['solucionado', 'cerrado', 'no_replicado'])
    expect(statusOptionsForTab('todos')).toHaveLength(5)
  })
})

describe('filterBugs', () => {
  const results = [
    makeBug({ id: 'a', title: 'Login roto', status: 'nuevo', severity: 'low' }),
    makeBug({ id: 'b', title: 'Export falla', status: 'en_progreso', severity: 'critical' }),
    makeBug({ id: 'c', title: 'Mail sin logo', status: 'solucionado', severity: 'medium' }),
  ]

  it('la pestaña activos deja fuera los históricos', () => {
    const filtered = filterBugs(results, { ...baseFilters, lifecycle: 'activos' })
    expect(filtered.map((bug) => bug.enriched.raw.id)).toEqual(['b', 'a'])
  })

  it('ordena por severidad: lo crítico primero', () => {
    const filtered = filterBugs(results, baseFilters)
    expect(filtered.map((bug) => bug.analysis.severity)).toEqual(['critical', 'medium', 'low'])
  })

  it('el filtro de estado refina dentro de la pestaña', () => {
    const filtered = filterBugs(results, { ...baseFilters, status: 'solucionado' })
    expect(filtered.map((bug) => bug.enriched.raw.id)).toEqual(['c'])
  })

  it('busca por título, resumen, texto reescrito y área', () => {
    expect(filterBugs(results, { ...baseFilters, search: 'login' })).toHaveLength(1)
    expect(filterBugs(results, { ...baseFilters, search: 'resumen b' })).toHaveLength(1)
    expect(filterBugs(results, { ...baseFilters, search: 'no responde' })).toHaveLength(3)
    expect(filterBugs(results, { ...baseFilters, search: 'formularios' })).toHaveLength(3)
    expect(filterBugs(results, { ...baseFilters, search: 'inexistente' })).toHaveLength(0)
  })

  it('detecta si hay filtros aplicados (la pestaña no cuenta)', () => {
    expect(hasActiveFilters({ ...baseFilters, lifecycle: 'historicos' })).toBe(false)
    expect(hasActiveFilters({ ...baseFilters, search: 'x' })).toBe(true)
    expect(hasActiveFilters({ ...baseFilters, severity: 'critical' })).toBe(true)
  })
})

describe('screenPathOf y screenOf', () => {
  it('deriva la pantalla de la URL de la fila, ignorando links de Google Docs', () => {
    expect(screenPathOf(makeBug({ id: 'a', title: 'x', url: 'https://app.test/auth/login' }))).toBe(
      '/auth/login',
    )
    expect(
      screenPathOf(
        makeBug({
          id: 'b',
          title: 'Titulo',
          url: 'https://docs.google.com/document/d/1',
          affectedArea: 'reportes',
        }),
      ),
    ).toBe('reportes')
  })

  it('sin URL ni área informada no inventa una pantalla', () => {
    expect(screenPathOf(makeBug({ id: 'c', title: 'Titulo', affectedArea: '' }))).toBeNull()
  })

  it('como clave de agrupación cae al título para no juntar bugs distintos', () => {
    expect(screenOf(makeBug({ id: 'c', title: 'Titulo', affectedArea: '' }))).toBe('Titulo')
    expect(screenOf(makeBug({ id: 'd', title: '', affectedArea: '' }))).toBe('sin pantalla')
  })

  it('agrupa por pantalla y ordena los grupos por la peor severidad', () => {
    const groups = groupByScreen([
      makeBug({ id: 'a', title: 'a', url: 'https://app.test/reportes', severity: 'low' }),
      makeBug({ id: 'b', title: 'b', url: 'https://app.test/login', severity: 'critical' }),
      makeBug({ id: 'c', title: 'c', url: 'https://app.test/login', severity: 'medium' }),
    ])
    expect(groups.map((group) => group.screen)).toEqual(['/login', '/reportes'])
    expect(groups[0].bugs).toHaveLength(2)
  })
})

describe('bugKpis', () => {
  it('cuenta activos, críticos, con datos faltantes y solucionados', () => {
    const kpis = bugKpis([
      makeBug({ id: 'a', title: 'a', status: 'nuevo', severity: 'critical', missing: ['consola'] }),
      makeBug({ id: 'b', title: 'b', status: 'en_progreso' }),
      makeBug({ id: 'c', title: 'c', status: 'solucionado', missing: ['usuario'] }),
    ])
    expect(kpis).toEqual({ active: 2, critical: 1, missingInfo: 2, solved: 1 })
  })
})

describe('bugReportAsText', () => {
  it('arma el texto plano del reporte reescrito para copiar', () => {
    const text = bugReportAsText(makeBug({ id: 'a', title: 'Login roto' }))
    expect(text).toContain('Login roto')
    expect(text).toContain('Qué pasa: el botón no responde')
    expect(text).toContain('Qué debería pasar: debería enviar el formulario')
    expect(text).toContain('1. abrir la pantalla')
    expect(text).toContain('Ambiente: dev')
    expect(text).not.toContain('Falta:')
  })

  it('incluye los datos que faltan cuando hay', () => {
    const bug = makeBug({ id: 'a', title: 'x', missing: ['el mensaje de consola'] })
    expect(bugReportAsText(bug)).toContain('Falta: el mensaje de consola')
  })
})
