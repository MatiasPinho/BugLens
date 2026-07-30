// bugPresentation.ts
//
// Traducciones a UI de los enums del dominio: etiquetas en español, orden de
// severidad, clase de badge y derivados (activo/histórico, pantalla afectada).
// Todo puro: no toca React ni el DOM.

import type { AnalyzedBug, BugCategory, BugStatus, Severity } from '../../../../src/shared/contracts'

export const severityOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

// Etiqueta en español para mostrar (el enum sigue en inglés en código/filtros).
export const severityLabel: Record<Severity, string> = {
  critical: 'crítica',
  high: 'alta',
  medium: 'media',
  low: 'baja',
}

export const statusLabel: Record<BugStatus, string> = {
  nuevo: 'nuevo',
  en_progreso: 'en progreso',
  solucionado: 'solucionado',
  cerrado: 'cerrado',
  no_replicado: 'no replicado',
}

export const STATUS_OPTIONS: BugStatus[] = [
  'nuevo',
  'en_progreso',
  'solucionado',
  'cerrado',
  'no_replicado',
]

// Las clases viven en styles.css (@layer components): color + fondo + borde de
// cada familia semántica. Acá solo se elige cuál corresponde.
//
// Los nombres van COMPLETOS y literales, nunca armados con template literal:
// Tailwind purga las clases de `@layer components` que no encuentra escritas en
// el código, y una clase interpolada es invisible para el escaneo. Cuando esto
// se armaba con `badge-severity-${severity}` los badges salían sin color en el
// build de producción.
const SEVERITY_BADGE_CLASS: Record<Severity, string> = {
  critical: 'badge badge-severity-critical',
  high: 'badge badge-severity-high',
  medium: 'badge badge-severity-medium',
  low: 'badge badge-severity-low',
}

const STATUS_BADGE_CLASS: Record<BugStatus, string> = {
  nuevo: 'badge badge-status-nuevo',
  en_progreso: 'badge badge-status-en_progreso',
  solucionado: 'badge badge-status-solucionado',
  cerrado: 'badge badge-status-cerrado',
  no_replicado: 'badge badge-status-no_replicado',
}

export function severityBadgeClass(severity: Severity): string {
  return SEVERITY_BADGE_CLASS[severity]
}

export function statusBadgeClass(status: BugStatus): string {
  return STATUS_BADGE_CLASS[status]
}

export function categoryBadgeClass(): string {
  return 'badge badge-category'
}

// Tira de color al costado de la fila/tarjeta: refuerza la severidad sin depender
// solo del badge.
export function severityStripClass(severity: Severity, focused: boolean): string {
  return focused ? `row-strip-${severity}-focused` : `row-strip-${severity}`
}

// ─── Ciclo de vida ──────────────────────────────────────────────────────────
// Separa lo ACCIONABLE (requiere trabajo) de lo ARCHIVADO (cerrado / no se pudo
// reproducir). La pestaña 'activos' es la vista por defecto. Es DERIVADO del
// estado, no un campo aparte.
export const ACTIVE_STATUSES: BugStatus[] = ['nuevo', 'en_progreso']
export const HISTORIC_STATUSES: BugStatus[] = ['solucionado', 'cerrado', 'no_replicado']

export function isActiveStatus(status: BugStatus): boolean {
  return status === 'nuevo' || status === 'en_progreso'
}

// Un bug archivado se atenúa en la lista: sigue legible pero no compite.
export function isQuietStatus(status: BugStatus): boolean {
  return status === 'solucionado' || status === 'cerrado'
}

export type LifecycleTab = 'activos' | 'historicos' | 'todos'

export const LIFECYCLE_TABS: { key: LifecycleTab; label: string }[] = [
  { key: 'activos', label: 'Activos' },
  { key: 'historicos', label: 'Históricos' },
  { key: 'todos', label: 'Todos' },
]

export function statusOptionsForTab(tab: LifecycleTab): BugStatus[] {
  if (tab === 'activos') return ACTIVE_STATUSES
  if (tab === 'historicos') return HISTORIC_STATUSES
  return STATUS_OPTIONS
}

export function lifecycleCounts(results: AnalyzedBug[]): Record<LifecycleTab, number> {
  const activos = results.filter((r) => isActiveStatus(r.status)).length
  return { activos, historicos: results.length - activos, todos: results.length }
}

// ─── Pantalla afectada ───────────────────────────────────────────────────────
// Se deriva del REPORTE original (estable): ruta de una URL de la fila → área del
// análisis. `screenPathOf` devuelve null cuando el reporte no informó ninguna de
// las dos: sirve para no mostrar una etiqueta inventada.
export function screenPathOf(bug: AnalyzedBug): string | null {
  for (const value of Object.values(bug.enriched.raw.rawRow ?? {})) {
    const match = String(value).match(/https?:\/\/[^\s"']+/)
    if (!match) continue
    if (/docs\.google\.com|drive\.google\.com/.test(match[0])) continue
    try {
      const path = new URL(match[0]).pathname.replace(/\/+$/, '')
      if (path && path !== '/') return path
    } catch {
      /* URL inválida — seguir */
    }
  }
  return bug.analysis.affectedArea?.trim() || null
}

// Clave de agrupación: siempre devuelve algo estable. Sin pantalla informada cae
// al título del reporte para no juntar bugs distintos en un grupo genérico.
export function screenOf(bug: AnalyzedBug): string {
  const path = screenPathOf(bug)
  if (path) return path
  return bug.enriched.raw.title?.trim() || 'sin pantalla'
}

export interface ScreenGroup {
  screen: string
  bugs: AnalyzedBug[]
}

// Agrupa por pantalla y ordena los grupos por la peor severidad que contienen.
export function groupByScreen(bugs: AnalyzedBug[]): ScreenGroup[] {
  const byScreen = new Map<string, AnalyzedBug[]>()
  for (const bug of bugs) {
    const key = screenOf(bug)
    const group = byScreen.get(key)
    if (group) group.push(bug)
    else byScreen.set(key, [bug])
  }
  return [...byScreen.entries()]
    .map(([screen, groupBugs]) => ({ screen, bugs: groupBugs }))
    .sort(
      (a, b) =>
        Math.min(...a.bugs.map((bug) => severityOrder[bug.analysis.severity])) -
        Math.min(...b.bugs.map((bug) => severityOrder[bug.analysis.severity])),
    )
}

// ─── Filtros ─────────────────────────────────────────────────────────────────

export interface BugFilters {
  lifecycle: LifecycleTab
  category: BugCategory | 'all'
  severity: Severity | 'all'
  status: BugStatus | 'all'
  search: string
}

export function hasActiveFilters(filters: BugFilters): boolean {
  return Boolean(
    filters.search ||
      filters.category !== 'all' ||
      filters.severity !== 'all' ||
      filters.status !== 'all',
  )
}

function matchesSearch(bug: AnalyzedBug, query: string): boolean {
  const q = query.toLowerCase()
  return (
    bug.enriched.raw.title.toLowerCase().includes(q) ||
    bug.analysis.summary.toLowerCase().includes(q) ||
    bug.analysis.rewritten.observed.toLowerCase().includes(q) ||
    (bug.analysis.affectedArea?.toLowerCase().includes(q) ?? false)
  )
}

// Filtra y ordena por severidad (lo crítico primero).
export function filterBugs(results: AnalyzedBug[], filters: BugFilters): AnalyzedBug[] {
  return results
    .filter((bug) => {
      if (filters.lifecycle === 'activos' && !isActiveStatus(bug.status)) return false
      if (filters.lifecycle === 'historicos' && isActiveStatus(bug.status)) return false
      if (filters.category !== 'all' && bug.analysis.category !== filters.category) return false
      if (filters.severity !== 'all' && bug.analysis.severity !== filters.severity) return false
      if (filters.status !== 'all' && bug.status !== filters.status) return false
      if (filters.search) return matchesSearch(bug, filters.search)
      return true
    })
    .sort((a, b) => severityOrder[a.analysis.severity] - severityOrder[b.analysis.severity])
}

// ─── KPIs de la cabecera ─────────────────────────────────────────────────────

export interface BugKpis {
  active: number
  critical: number
  missingInfo: number
  solved: number
}

export function bugKpis(results: AnalyzedBug[]): BugKpis {
  return {
    active: results.filter((bug) => isActiveStatus(bug.status)).length,
    critical: results.filter((bug) => bug.analysis.severity === 'critical').length,
    missingInfo: results.filter((bug) => bug.analysis.missingInformation.length > 0).length,
    solved: results.filter((bug) => bug.status === 'solucionado').length,
  }
}

// ─── Formato ─────────────────────────────────────────────────────────────────

export function formatTimelineDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatAgentDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

// Texto plano del reporte reescrito, para copiar al portapapeles.
export function bugReportAsText(bug: AnalyzedBug): string {
  const { enriched, analysis } = bug
  const rewritten = analysis.rewritten
  return [
    enriched.raw.title,
    `Resumen: ${analysis.summary}`,
    `Qué pasa: ${rewritten.observed}`,
    `Qué debería pasar: ${rewritten.expected}`,
    rewritten.steps.length > 0
      ? `Pasos:\n${rewritten.steps.map((step, i) => `  ${i + 1}. ${step}`).join('\n')}`
      : '',
    `Ambiente: ${rewritten.environment}`,
    analysis.missingInformation.length > 0
      ? `Falta: ${analysis.missingInformation.join('; ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}
