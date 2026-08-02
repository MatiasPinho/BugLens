// BugKpiGrid.tsx
//
// Resumen numérico y atajos de triage de la lista de bugs.

import type { BugKpiFilter, BugKpis } from './bugPresentation'

const KPI_OPTIONS: Array<{
  key: BugKpiFilter
  label: string
  tone: string
}> = [
  { key: 'active', label: 'Activos', tone: '' },
  { key: 'critical', label: 'Críticos', tone: 'kpi-critical' },
  { key: 'missingInfo', label: 'Falta info', tone: 'kpi-warn' },
  { key: 'solved', label: 'Solucionados', tone: 'kpi-solved' },
]

export function BugKpiGrid({
  active,
  critical,
  missingInfo,
  solved,
  selected,
  onSelect,
}: BugKpis & {
  selected?: BugKpiFilter | null
  onSelect?: (filter: BugKpiFilter) => void
}) {
  const values: Record<BugKpiFilter, number> = { active, critical, missingInfo, solved }

  return (
    <fieldset className="kpi-grid">
      <legend className="sr-only">Atajos de triage</legend>
      {KPI_OPTIONS.map((option) => (
        <Kpi
          key={option.key}
          label={option.label}
          value={values[option.key]}
          tone={option.tone}
          selected={selected === option.key}
          onSelect={onSelect ? () => onSelect(option.key) : undefined}
        />
      ))}
    </fieldset>
  )
}

function Kpi({
  label,
  value,
  tone,
  selected,
  onSelect,
}: {
  label: string
  value: number
  tone: string
  selected: boolean
  onSelect?: () => void
}) {
  const content = (
    <>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
    </>
  )

  if (!onSelect) return <div className={`kpi ${tone}`}>{content}</div>

  return (
    <button
      type="button"
      className={`kpi kpi-interactive ${tone} ${selected ? 'kpi-selected' : ''}`}
      aria-label={`Filtrar por ${label.toLowerCase()}, ${value} bug${value === 1 ? '' : 's'}`}
      aria-pressed={selected}
      disabled={value === 0}
      onClick={onSelect}
    >
      {content}
    </button>
  )
}
