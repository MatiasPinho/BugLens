/**
 * BugList.tsx
 *
 * Columna izquierda del shell de tres columnas: buscador, pestañas de ciclo de
 * vida, filtros y la lista de bugs. Es la navegación dentro de la pantalla —
 * elegir acá cambia lo que muestran el centro y el rail de propiedades.
 *
 * Solo renderiza: el filtrado y el estado de los filtros viven en `BugsScreen`,
 * que es quien los comparte con el resto de la pantalla.
 */

import type React from 'react'
import { bugRecordKey } from '../../../../src/features/bug-workflow/domain/bugStatusKey'
import type {
  AnalyzedBug,
  BugCategory,
  BugStatus,
  Severity,
} from '../../../../src/shared/contracts'
import { IconSearch } from '../../../components/icons'
import { LifecycleTabs, SeverityBadge, StatusBadge } from './BugAtoms'
import { BugKpiGrid } from './BugKpiGrid'
import {
  type BugFilters,
  type BugKpis,
  hasActiveFilters,
  isQuietStatus,
  type LifecycleTab,
  screenPathOf,
  severityLabel,
  statusLabel,
  statusOptionsForTab,
} from './bugPresentation'

interface Props {
  bugs: AnalyzedBug[]
  totalCount: number
  counts: Record<LifecycleTab, number>
  /** Resumen del proyecto: es el contexto de lo que la lista está filtrando. */
  kpis: BugKpis
  filters: BugFilters
  categories: BugCategory[]
  severities: Severity[]
  selectedKey?: string | null
  onSelect: (key: string) => void
  onLifecycleChange: (tab: LifecycleTab) => void
  onSearchChange: (value: string) => void
  onSeverityChange: (value: Severity | 'all') => void
  onCategoryChange: (value: BugCategory | 'all') => void
  onStatusChange: (value: BugStatus | 'all') => void
  onClearFilters: () => void
  searchInputRef?: React.MutableRefObject<HTMLInputElement | null>
}

export default function BugList({
  bugs,
  totalCount,
  counts,
  kpis,
  filters,
  categories,
  severities,
  selectedKey,
  onSelect,
  onLifecycleChange,
  onSearchChange,
  onSeverityChange,
  onCategoryChange,
  onStatusChange,
  onClearFilters,
  searchInputRef,
}: Props) {
  return (
    <div className="bug-list-column">
      <div className="bug-list-head">
        <div className="search-box">
          <IconSearch size={16} className="button-icon" />
          <input
            ref={searchInputRef}
            type="text"
            value={filters.search}
            placeholder="Buscar bugs…"
            aria-label="buscar bugs"
            onChange={(event) => onSearchChange(event.target.value)}
          />
          <kbd className="flex-shrink-0">/</kbd>
        </div>

        <LifecycleTabs value={filters.lifecycle} counts={counts} onChange={onLifecycleChange} />

        <div className="bug-list-filters">
          <select
            aria-label="filtrar por severidad"
            value={filters.severity}
            onChange={(event) => onSeverityChange(event.target.value as Severity | 'all')}
            className="input bug-filter cursor-pointer"
          >
            <option value="all">Severidad</option>
            {severities.map((option) => (
              <option key={option} value={option}>
                {severityLabel[option]}
              </option>
            ))}
          </select>

          <select
            aria-label="filtrar por categoría"
            value={filters.category}
            onChange={(event) => onCategoryChange(event.target.value as BugCategory | 'all')}
            className="input bug-filter cursor-pointer"
          >
            <option value="all">Categoría</option>
            {categories.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            aria-label="filtrar por estado"
            value={filters.status}
            onChange={(event) => onStatusChange(event.target.value as BugStatus | 'all')}
            className="input bug-filter cursor-pointer"
          >
            <option value="all">Estado</option>
            {statusOptionsForTab(filters.lifecycle).map((option) => (
              <option key={option} value={option}>
                {statusLabel[option]}
              </option>
            ))}
          </select>

          {hasActiveFilters(filters) && (
            <button type="button" onClick={onClearFilters} className="btn-quiet btn-mini">
              Limpiar
            </button>
          )}
        </div>

        <BugKpiGrid {...kpis} />
      </div>

      <span className="kicker-xs bug-list-kicker">
        {filters.lifecycle === 'historicos' ? 'Histórico' : 'Bugs'}
      </span>

      {/* `listbox` y no una lista de botones: elegir acá selecciona un elemento
          de un conjunto, y así las flechas del lector de pantalla lo anuncian
          como "3 de 17". */}
      <ul className="bug-list-items" aria-label="lista de bugs">
        {bugs.map((bug) => {
          const key = bugRecordKey(bug.enriched.raw)
          const screen = screenPathOf(bug)
          const selected = key === selectedKey
          return (
            <li key={key}>
              <button
                type="button"
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelect(key)}
                className={`bug-list-item ${selected ? 'bug-list-item-active' : ''} ${
                  isQuietStatus(bug.status) ? 'bug-list-item-quiet' : ''
                }`}
              >
                <span className="bug-list-item-title">{bug.enriched.raw.title}</span>
                {/* Severidad y estado van como badges con texto, no como un punto
                    de color: es la regla del design system y el mismo criterio
                    que ya usaba la lista densa. */}
                <span className="bug-list-item-badges">
                  <SeverityBadge severity={bug.analysis.severity} />
                  <StatusBadge status={bug.status} />
                </span>
                <span className="bug-list-item-meta">{screen ?? 'Sin pantalla informada'}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {bugs.length === totalCount
          ? `${totalCount} bug${totalCount === 1 ? '' : 's'}`
          : `${bugs.length} de ${totalCount} bugs coinciden`}
      </span>
    </div>
  )
}
