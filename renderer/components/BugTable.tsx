import React, { useMemo, useState } from 'react'
import type { AnalyzedBug, BugCategory, BugStatus, DocImage, Severity } from '../../src/types/index'
import { alpha, col } from '../theme'

interface Props {
  results: AnalyzedBug[]
  analyzing?: boolean
  onSetStatus?: (bug: AnalyzedBug, status: BugStatus) => void
  onDelete?: (bug: AnalyzedBug) => void
  focusedId?: string | null
  expandedId?: string | null
  onFocus?: (id: string | null) => void
  onToggleExpand?: (id: string) => void
  searchInputRef?: React.MutableRefObject<HTMLInputElement | null>
}

const severityOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const severityStripColor: Record<Severity, string> = {
  critical: alpha(col.red, 1),
  high: alpha(col.amberStrip, 0.95),
  medium: alpha(col.cream, 0.75),
  low: alpha(col.fgDim, 0.55),
}

export const severityStyle: Record<Severity, { text: string; bg: string; border: string }> = {
  critical: { text: col.red, bg: alpha(col.red, 0.1), border: alpha(col.red, 0.3) },
  high: { text: col.amber, bg: alpha(col.amberDeep, 0.1), border: alpha(col.amberDeep, 0.28) },
  medium: { text: col.cream, bg: alpha(col.cream, 0.08), border: alpha(col.cream, 0.2) },
  low: { text: col.fgDim, bg: alpha(col.fgDim, 0.08), border: alpha(col.fgDim, 0.18) },
}

// Estados del ciclo de vida. Color + texto (no solo color, por accesibilidad).
export const statusStyle: Record<
  BugStatus,
  { label: string; text: string; bg: string; border: string }
> = {
  nuevo: {
    label: 'nuevo',
    text: col.fgDim,
    bg: alpha(col.fgDim, 0.08),
    border: alpha(col.fgDim, 0.22),
  },
  en_progreso: {
    label: 'en progreso',
    text: col.amber,
    bg: alpha(col.amberDeep, 0.1),
    border: alpha(col.amberDeep, 0.3),
  },
  solucionado: {
    label: 'solucionado',
    text: col.green,
    bg: alpha(col.green, 0.1),
    border: alpha(col.green, 0.3),
  },
  cerrado: {
    label: 'cerrado',
    text: col.fgMuted,
    bg: alpha(col.fgMuted, 0.08),
    border: alpha(col.fgMuted, 0.24),
  },
  no_replicado: {
    label: 'no replicado',
    text: col.terracotta,
    bg: alpha(col.terracotta, 0.08),
    border: alpha(col.terracotta, 0.26),
  },
}

const STATUS_OPTIONS: BugStatus[] = [
  'nuevo',
  'en_progreso',
  'solucionado',
  'cerrado',
  'no_replicado',
]

// ─── Ciclo de vida ──────────────────────────────────────────────────────────
// Separa lo ACCIONABLE (requiere trabajo) de lo ARCHIVADO (cerrado / no se pudo
// reproducir). La pestaña 'activos' es la vista por defecto.
const ACTIVE_STATUSES: BugStatus[] = ['nuevo', 'en_progreso']
const HISTORIC_STATUSES: BugStatus[] = ['solucionado', 'cerrado', 'no_replicado']

export function isActiveStatus(status: BugStatus): boolean {
  return status === 'nuevo' || status === 'en_progreso'
}

export type LifecycleTab = 'activos' | 'historicos' | 'todos'

const LIFECYCLE_TABS: { key: LifecycleTab; label: string }[] = [
  { key: 'activos', label: 'activos' },
  { key: 'historicos', label: 'históricos' },
  { key: 'todos', label: 'todos' },
]

// Control segmentado para elegir el ciclo de vida. Sigue el patrón ARIA tablist:
// una sola parada de tab (roving tabindex), flechas/Home/End mueven la selección
// (activación automática). Comunica con texto + contador (no solo color); el nombre
// accesible incluye el conteo y oculta el número visual para no leerlo dos veces.
export function LifecycleTabs({
  value,
  counts,
  onChange,
}: {
  value: LifecycleTab
  counts: Record<LifecycleTab, number>
  onChange: (tab: LifecycleTab) => void
}) {
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = LIFECYCLE_TABS.findIndex((t) => t.key === value)
    const last = LIFECYCLE_TABS.length - 1
    let next = current
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = current >= last ? 0 : current + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = current <= 0 ? last : current - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    else return
    e.preventDefault()
    onChange(LIFECYCLE_TABS[next].key)
    tabRefs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="ciclo de vida"
      onKeyDown={handleKeyDown}
      className="inline-flex items-center gap-0.5 rounded p-0.5"
      style={{ border: `1px solid ${alpha(col.border, 0.25)}`, background: alpha(col.muted, 0.12) }}
    >
      {LIFECYCLE_TABS.map((t, i) => {
        const active = value === t.key
        const count = counts[t.key]
        return (
          <button
            key={t.key}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            aria-label={`${t.label}, ${count} bug${count === 1 ? '' : 's'}`}
            onClick={() => onChange(t.key)}
            className="cursor-pointer rounded px-2.5 py-1 font-mono text-xs transition-colors"
            style={
              active
                ? { background: alpha(col.cream, 0.12), color: col.cream }
                : { background: 'transparent', color: col.fgMuted }
            }
            onMouseEnter={(e) => {
              if (!active) e.currentTarget.style.color = col.fg
            }}
            onMouseLeave={(e) => {
              if (!active) e.currentTarget.style.color = col.fgMuted
            }}
          >
            {t.label}
            <span
              aria-hidden="true"
              className="ml-1.5"
              style={{ color: active ? alpha(col.cream, 0.7) : count === 0 ? col.muted : col.dim }}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Selector inline: marca el estado sin abrir el detalle. stopPropagation para que
// el click en el select no expanda/colapse la fila. Native select = accesible.
export function StatusSelect({
  status,
  onChange,
}: {
  status: BugStatus
  onChange: (s: BugStatus) => void
}) {
  const st = statusStyle[status]
  return (
    <select
      value={status}
      aria-label="estado del bug"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value as BugStatus)}
      className="status-select cursor-pointer rounded px-1.5 py-0.5 font-mono text-xs"
      style={{ color: st.text, background: st.bg, border: `1px solid ${st.border}` }}
    >
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {statusStyle[s].label}
        </option>
      ))}
    </select>
  )
}

export const categoryStyle: Record<BugCategory, { text: string; bg: string; border: string }> = {
  frontend: { text: col.fgDim, bg: alpha(col.fgDim, 0.08), border: alpha(col.fgDim, 0.2) },
  backend: { text: col.fgMuted, bg: alpha(col.fgMuted, 0.08), border: alpha(col.fgMuted, 0.22) },
  database: { text: col.cream, bg: alpha(col.cream, 0.08), border: alpha(col.cream, 0.18) },
  config: { text: col.gray, bg: alpha(col.gray, 0.08), border: alpha(col.gray, 0.18) },
  data: { text: col.warm, bg: alpha(col.warm, 0.06), border: alpha(col.warm, 0.16) },
  otro: { text: col.fgMuted, bg: alpha(col.fgMuted, 0.06), border: alpha(col.fgMuted, 0.18) },
}

// ─── Atoms ────────────────────────────────────────────────────────────────────

export function OmBadge({
  style,
  children,
}: {
  style: { text: string; bg: string; border: string }
  children: React.ReactNode
}) {
  return (
    <span
      style={{ color: style.text, background: style.bg, border: `1px solid ${style.border}` }}
      className="inline-flex items-center rounded px-1.5 py-0.5 font-mono text-xs"
    >
      {children}
    </span>
  )
}

export function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? col.fgDim : pct >= 50 ? col.cream : col.red
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-20 rounded-full" style={{ background: alpha(col.muted, 0.4) }}>
        <div
          className="h-1 rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="w-8 text-right font-mono text-xs" style={{ color: col.border }}>
        {pct}%
      </span>
    </div>
  )
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="flex-shrink-0 cursor-pointer transition-colors"
      title="copiar"
      style={{
        color: copied ? col.fgDim : col.muted,
        border: `1px solid ${copied ? alpha(col.fgDim, 0.35) : alpha(col.border, 0.25)}`,
        background: 'transparent',
        borderRadius: '4px',
        padding: '0.2rem 0.4rem',
        fontSize: '0.65rem',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        if (!copied) e.currentTarget.style.color = col.fgMuted
      }}
      onMouseLeave={(e) => {
        if (!copied) e.currentTarget.style.color = col.muted
      }}
    >
      {copied ? '✓' : 'copy'}
    </button>
  )
}

// Borrado con confirmación inline (dos pasos: "borrar" → "¿seguro? sí / no").
// Evita borrados accidentales sin recurrir a un confirm() nativo.
export function DeleteControl({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <span className="flex flex-shrink-0 items-center gap-1.5 font-mono text-xs">
        <span style={{ color: col.fgMuted }}>¿borrar?</span>
        <button
          type="button"
          onClick={onConfirm}
          className="cursor-pointer transition-colors"
          style={{
            color: col.red,
            border: `1px solid ${alpha(col.red, 0.4)}`,
            borderRadius: '4px',
            padding: '0.2rem 0.5rem',
            fontSize: '0.65rem',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = alpha(col.red, 0.1))}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          sí, borrar
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="cursor-pointer transition-colors"
          style={{
            color: col.muted,
            border: `1px solid ${alpha(col.border, 0.25)}`,
            borderRadius: '4px',
            padding: '0.2rem 0.5rem',
            fontSize: '0.65rem',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = col.fgMuted)}
          onMouseLeave={(e) => (e.currentTarget.style.color = col.muted)}
        >
          no
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      title="borrar bug"
      className="flex-shrink-0 cursor-pointer transition-colors"
      style={{
        color: col.muted,
        border: `1px solid ${alpha(col.border, 0.25)}`,
        borderRadius: '4px',
        padding: '0.2rem 0.5rem',
        fontSize: '0.65rem',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = col.red
        e.currentTarget.style.borderColor = alpha(col.red, 0.4)
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = col.muted
        e.currentTarget.style.borderColor = alpha(col.border, 0.25)
      }}
    >
      borrar
    </button>
  )
}

export function SectionCard({
  title,
  children,
  accent = false,
}: {
  title: string
  children: React.ReactNode
  accent?: boolean
}) {
  return (
    <div className={accent ? 'section-card-accent' : 'section-card'}>
      <div className="section-label">{title}</div>
      {children}
    </div>
  )
}

// ─── Screen grouping key ──────────────────────────────────────────────────────
// La pantalla se deriva del REPORTE original (estable): ruta de una URL de la
// fila → título → área del análisis.

function screenOf(bug: AnalyzedBug): string {
  const raw = bug.enriched.raw
  for (const v of Object.values(raw.rawRow ?? {})) {
    const m = String(v).match(/https?:\/\/[^\s"']+/)
    if (!m) continue
    if (/docs\.google\.com|drive\.google\.com/.test(m[0])) continue
    try {
      const path = new URL(m[0]).pathname.replace(/\/+$/, '')
      if (path && path !== '/') return path
    } catch {
      /* URL inválida — seguir */
    }
  }
  if (raw.title?.trim()) return raw.title.trim()
  return bug.analysis.affectedArea?.trim() || 'sin pantalla'
}

// ─── BugTable ─────────────────────────────────────────────────────────────────

export default function BugTable({
  results,
  analyzing = false,
  onSetStatus,
  onDelete,
  focusedId: focusedIdProp,
  expandedId: expandedIdProp,
  onFocus,
  onToggleExpand,
  searchInputRef,
}: Props) {
  const [localExpandedId, setLocalExpandedId] = useState<string | null>(null)
  const expandedId = expandedIdProp !== undefined ? expandedIdProp : localExpandedId
  const setExpandedId = (id: string | null) => {
    if (onToggleExpand) {
      if (id === null && expandedId) onToggleExpand(expandedId)
      else if (id !== null) onToggleExpand(id)
    } else {
      setLocalExpandedId(id)
    }
  }
  const focusedId = focusedIdProp

  const [lifecycle, setLifecycle] = useState<LifecycleTab>('activos')
  const [filterCategory, setFilterCategory] = useState<BugCategory | 'all'>('all')
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<BugStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('flat')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Cambiar de pestaña limpia el filtro de estado (evita un filtro fuera de la
  // pestaña, ej. quedar en 'solucionado' al volver a 'activos').
  const handleLifecycle = (tab: LifecycleTab) => {
    setLifecycle(tab)
    setFilterStatus('all')
  }

  // Estados que tiene sentido ofrecer en el dropdown según la pestaña.
  const statusOptionsForTab =
    lifecycle === 'activos'
      ? ACTIVE_STATUSES
      : lifecycle === 'historicos'
        ? HISTORIC_STATUSES
        : STATUS_OPTIONS

  const lifecycleCounts = useMemo<Record<LifecycleTab, number>>(() => {
    const activos = results.filter((r) => isActiveStatus(r.status)).length
    return { activos, historicos: results.length - activos, todos: results.length }
  }, [results])

  const filtered = useMemo(() => {
    return results
      .filter((r) => {
        if (lifecycle === 'activos' && !isActiveStatus(r.status)) return false
        if (lifecycle === 'historicos' && isActiveStatus(r.status)) return false
        if (filterCategory !== 'all' && r.analysis.category !== filterCategory) return false
        if (filterSeverity !== 'all' && r.analysis.severity !== filterSeverity) return false
        if (filterStatus !== 'all' && r.status !== filterStatus) return false
        if (search) {
          const q = search.toLowerCase()
          return (
            r.enriched.raw.title.toLowerCase().includes(q) ||
            r.analysis.summary.toLowerCase().includes(q) ||
            r.analysis.rewritten.observed.toLowerCase().includes(q) ||
            (r.analysis.affectedArea?.toLowerCase().includes(q) ?? false)
          )
        }
        return true
      })
      .sort((a, b) => severityOrder[a.analysis.severity] - severityOrder[b.analysis.severity])
  }, [results, lifecycle, filterCategory, filterSeverity, filterStatus, search])

  const categories = useMemo(() => [...new Set(results.map((r) => r.analysis.category))], [results])
  const severities = useMemo(() => [...new Set(results.map((r) => r.analysis.severity))], [results])

  const groups = useMemo(() => {
    if (viewMode !== 'grouped') return []
    const map = new Map<string, AnalyzedBug[]>()
    for (const bug of filtered) {
      const key = screenOf(bug)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(bug)
    }
    return [...map.entries()]
      .map(([area, bugs]) => ({ area, bugs }))
      .sort(
        (a, b) =>
          Math.min(...a.bugs.map((b) => severityOrder[b.analysis.severity])) -
          Math.min(...b.bugs.map((b) => severityOrder[b.analysis.severity])),
      )
  }, [filtered, viewMode])

  const renderItems = useMemo(() => {
    if (viewMode === 'flat') {
      return filtered.map((bug) => ({ type: 'bug' as const, bug }))
    }
    return groups.flatMap((g) => [
      { type: 'group-header' as const, area: g.area, bugs: g.bugs },
      ...(collapsedGroups.has(g.area) ? [] : g.bugs.map((bug) => ({ type: 'bug' as const, bug }))),
    ])
  }, [filtered, viewMode, groups, collapsedGroups])

  return (
    <div className="flex h-full flex-col">
      {/* Filter bar */}
      <div
        className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2.5"
        style={{ borderColor: alpha(col.border, 0.2), background: col.base }}
      >
        <LifecycleTabs value={lifecycle} counts={lifecycleCounts} onChange={handleLifecycle} />
        <div className="relative">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            style={{ color: col.muted }}
          >
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <line
              x1="21"
              y1="21"
              x2="16.65"
              y2="16.65"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="buscar bugs... (/)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input w-44 text-xs"
            style={{ paddingLeft: '1.5rem' }}
          />
        </div>
        <select
          aria-label="filtrar por categoría"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as BugCategory | 'all')}
          className="input w-32 cursor-pointer text-xs"
        >
          <option value="all">categoría</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          aria-label="filtrar por severidad"
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as Severity | 'all')}
          className="input w-32 cursor-pointer text-xs"
        >
          <option value="all">severidad</option>
          {severities.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label="filtrar por estado"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as BugStatus | 'all')}
          className="input w-32 cursor-pointer text-xs"
        >
          <option value="all">estado</option>
          {statusOptionsForTab.map((s) => (
            <option key={s} value={s}>
              {statusStyle[s].label}
            </option>
          ))}
        </select>
        {(search ||
          filterCategory !== 'all' ||
          filterSeverity !== 'all' ||
          filterStatus !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setFilterCategory('all')
              setFilterSeverity('all')
              setFilterStatus('all')
            }}
            className="cursor-pointer font-mono text-xs transition-colors"
            style={{ color: col.muted }}
            onMouseEnter={(e) => (e.currentTarget.style.color = col.fgMuted)}
            onMouseLeave={(e) => (e.currentTarget.style.color = col.muted)}
          >
            limpiar
          </button>
        )}
        <button
          type="button"
          onClick={() => setViewMode((v) => (v === 'flat' ? 'grouped' : 'flat'))}
          className="ml-auto flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 font-mono text-xs transition-all"
          style={{
            color: viewMode === 'grouped' ? col.cream : col.muted,
            border: `1px solid ${viewMode === 'grouped' ? alpha(col.cream, 0.28) : alpha(col.border, 0.22)}`,
            background: viewMode === 'grouped' ? alpha(col.cream, 0.07) : 'transparent',
          }}
          title={viewMode === 'flat' ? 'agrupar por pantalla' : 'vista plana'}
        >
          {viewMode === 'grouped' ? 'agrupado' : 'agrupar'}
        </button>
        <span className="flex items-center gap-2.5 font-mono text-xs" style={{ color: col.muted }}>
          {analyzing && (
            <span className="flex items-center gap-1.5" style={{ color: col.fgDim }}>
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full"
                style={{ background: col.cream }}
              />
              analizando
            </span>
          )}
          {/* aria-live: al cambiar de pestaña/filtro, anuncia el nuevo total */}
          <span aria-live="polite" aria-atomic="true">
            {filtered.length !== results.length ? (
              <>
                <span style={{ color: col.fgMuted }}>{filtered.length}</span>
                <span style={{ color: col.dim }}>/{results.length}</span>
              </>
            ) : (
              <span style={{ color: col.muted }}>{results.length} bugs</span>
            )}
          </span>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead
            className="sticky top-0 z-10"
            style={{ background: col.base, borderBottom: `1px solid ${alpha(col.border, 0.18)}` }}
          >
            <tr
              className="text-left font-mono"
              style={{
                fontSize: '0.60rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.11em',
                color: col.muted,
              }}
            >
              <th className="w-4 py-2 pr-1 pl-3 font-normal"></th>
              <th className="w-8 px-2 py-2">#</th>
              <th className="px-4 py-2">título</th>
              <th className="px-4 py-2">estado</th>
              <th className="px-4 py-2">área</th>
              <th className="px-4 py-2">cat</th>
              <th className="px-4 py-2">severidad</th>
              <th className="px-4 py-2">confianza</th>
            </tr>
          </thead>
          <tbody>
            {renderItems.map((item) => {
              if (item.type === 'group-header') {
                return (
                  <GroupHeaderRow
                    key={`gh-${item.area}`}
                    area={item.area}
                    bugs={item.bugs}
                    collapsed={collapsedGroups.has(item.area)}
                    onToggle={() =>
                      setCollapsedGroups((prev) => {
                        const next = new Set(prev)
                        if (next.has(item.area)) next.delete(item.area)
                        else next.add(item.area)
                        return next
                      })
                    }
                  />
                )
              }
              const r = item.bug
              const id = r.enriched.raw.id
              const isExpanded = expandedId === id
              const isFocused = focusedId === id
              const isDone = r.status === 'solucionado' || r.status === 'cerrado'
              const sv = severityStyle[r.analysis.severity]
              const ct = categoryStyle[r.analysis.category]

              return (
                <React.Fragment key={id}>
                  <tr
                    ref={(el) => {
                      if (el && isFocused) el.scrollIntoView({ block: 'nearest' })
                    }}
                    onClick={() => {
                      onFocus?.(id)
                      setExpandedId(isExpanded ? null : id)
                    }}
                    onMouseEnter={(e) => {
                      onFocus?.(id)
                      if (!isExpanded) e.currentTarget.style.background = alpha(col.raised, 0.8)
                    }}
                    onMouseLeave={(e) => {
                      if (!isExpanded)
                        e.currentTarget.style.background = isExpanded
                          ? col.raised
                          : isFocused
                            ? alpha(col.cream, 0.04)
                            : 'transparent'
                    }}
                    className={`cursor-pointer ${isExpanded || isFocused ? `row-strip-${r.analysis.severity}-focused` : `row-strip-${r.analysis.severity}`}`}
                    style={{
                      borderBottom: isExpanded ? 'none' : `1px solid ${alpha(col.border, 0.12)}`,
                      background: isExpanded
                        ? col.raised
                        : isFocused
                          ? alpha(col.cream, 0.04)
                          : 'transparent',
                      transition: 'background 0.12s',
                    }}
                  >
                    <td className="py-2.5 pr-1 pl-3">
                      <svg
                        aria-hidden="true"
                        width="8"
                        height="8"
                        viewBox="0 0 8 8"
                        fill="currentColor"
                        className="transition-transform"
                        style={{
                          color: isExpanded ? col.cream : col.muted,
                          transform: isExpanded ? 'rotate(90deg)' : 'none',
                        }}
                      >
                        <path d="M2 1l4 3-4 3V1z" />
                      </svg>
                    </td>
                    <td className="px-2 py-2.5 font-mono" style={{ color: col.dim }}>
                      {r.enriched.raw.rowIndex}
                    </td>
                    <td className="max-w-xs px-4 py-2.5">
                      <div
                        className="truncate font-medium text-sm"
                        style={{ color: isDone ? col.done : col.fg }}
                        title={r.enriched.raw.title}
                      >
                        {r.enriched.raw.title}
                      </div>
                      <div
                        className="mt-0.5 truncate font-mono"
                        style={{ color: isDone ? col.muted : col.border }}
                        title={r.analysis.summary}
                      >
                        {r.analysis.summary}
                      </div>
                      {r.analysis.missingInformation.length > 0 && (
                        <span className="font-mono text-xs" style={{ color: col.amber }}>
                          ⚠ falta info
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {onSetStatus ? (
                        <StatusSelect status={r.status} onChange={(s) => onSetStatus(r, s)} />
                      ) : (
                        <OmBadge style={statusStyle[r.status]}>
                          {statusStyle[r.status].label}
                        </OmBadge>
                      )}
                    </td>
                    <td className="max-w-[160px] px-4 py-2.5">
                      <div
                        className="truncate font-mono"
                        style={{ color: col.border }}
                        title={r.analysis.affectedArea}
                      >
                        {r.analysis.affectedArea || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <OmBadge style={ct}>{r.analysis.category}</OmBadge>
                    </td>
                    <td className="px-4 py-2.5">
                      <OmBadge style={sv}>{r.analysis.severity}</OmBadge>
                    </td>
                    <td className="px-4 py-2.5">
                      <ConfidenceBar value={r.analysis.confidence} />
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-0"
                        style={{
                          borderBottom: `2px solid ${severityStripColor[r.analysis.severity]}`,
                          boxShadow: `inset 3px 0 0 ${severityStripColor[r.analysis.severity]}`,
                          background: col.code,
                        }}
                      >
                        <ExpandedDetail
                          result={r}
                          onClose={() => setExpandedId(null)}
                          onDelete={onDelete ? () => onDelete(r) : undefined}
                        />
                      </td>
                    </tr>
                  )}
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="h-2" style={{ background: col.base }} />
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <svg
              aria-hidden="true"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              style={{ color: col.dim }}
            >
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.2" />
              <line
                x1="21"
                y1="21"
                x2="16.65"
                y2="16.65"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <line
                x1="8"
                y1="11"
                x2="14"
                y2="11"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-mono text-xs" style={{ color: col.muted }}>
              {results.length === 0
                ? 'sin bugs analizados'
                : lifecycle === 'activos'
                  ? 'no hay bugs activos'
                  : lifecycle === 'historicos'
                    ? 'no hay bugs en el histórico'
                    : 'sin resultados para estos filtros'}
            </span>
            {results.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setFilterCategory('all')
                  setFilterSeverity('all')
                  setFilterStatus('all')
                  setLifecycle('todos')
                }}
                className="cursor-pointer font-mono text-xs transition-colors"
                style={{ color: col.border }}
                onMouseEnter={(e) => (e.currentTarget.style.color = col.fgMuted)}
                onMouseLeave={(e) => (e.currentTarget.style.color = col.border)}
              >
                {lifecycle !== 'todos' ? 'ver todos' : 'limpiar filtros'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Group header row ─────────────────────────────────────────────────────────

export function GroupHeaderRow({
  area,
  bugs,
  collapsed,
  onToggle,
}: {
  area: string
  bugs: AnalyzedBug[]
  collapsed: boolean
  onToggle: () => void
}) {
  const counts = {
    critical: bugs.filter((b) => b.analysis.severity === 'critical').length,
    high: bugs.filter((b) => b.analysis.severity === 'high').length,
    medium: bugs.filter((b) => b.analysis.severity === 'medium').length,
    low: bugs.filter((b) => b.analysis.severity === 'low').length,
  }
  const worstColor =
    counts.critical > 0
      ? col.red
      : counts.high > 0
        ? col.amber
        : counts.medium > 0
          ? col.cream
          : col.fgDim

  return (
    <tr
      onClick={onToggle}
      className="cursor-pointer select-none"
      style={{ background: col.surface, borderBottom: `1px solid ${alpha(col.border, 0.2)}` }}
      onMouseEnter={(e) => (e.currentTarget.style.background = col.raised)}
      onMouseLeave={(e) => (e.currentTarget.style.background = col.surface)}
    >
      <td colSpan={8} style={{ padding: '0.45rem 0.75rem' }}>
        <div className="flex items-center gap-2.5">
          <svg
            aria-hidden="true"
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="currentColor"
            style={{
              color: col.fgMuted,
              transform: collapsed ? 'none' : 'rotate(90deg)',
              transition: 'transform 0.15s',
              flexShrink: 0,
            }}
          >
            <path d="M2 1l4 3-4 3V1z" />
          </svg>
          <span className="font-medium font-mono text-xs" style={{ color: worstColor }}>
            {area}
          </span>
          <span
            className="rounded px-1.5 py-0.5 font-mono text-xs"
            style={{
              color: col.fgMuted,
              border: `1px solid ${alpha(col.border, 0.28)}`,
              background: alpha(col.fgMuted, 0.08),
            }}
          >
            {bugs.length} bug{bugs.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            {counts.critical > 0 && <SeverityDot count={counts.critical} color={col.red} />}
            {counts.high > 0 && <SeverityDot count={counts.high} color={col.amber} />}
            {counts.medium > 0 && <SeverityDot count={counts.medium} color={col.cream} />}
            {counts.low > 0 && <SeverityDot count={counts.low} color={col.fgDim} />}
          </div>
        </div>
      </td>
    </tr>
  )
}

export function SeverityDot({ count, color }: { count: number; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      <span className="font-mono text-xs" style={{ color }}>
        {count}
      </span>
    </div>
  )
}

// ─── Expanded detail ──────────────────────────────────────────────────────────
// El protagonista: la versión REESCRITA y clara del reporte + qué falta + capturas.

export function ExpandedDetail({
  result,
  onClose,
  onDelete,
}: {
  result: AnalyzedBug
  onClose?: () => void
  onDelete?: () => void
}) {
  const { enriched, analysis } = result
  const raw = enriched.raw
  const rw = analysis.rewritten

  const allImages = enriched.googleDocs.flatMap((d) => d.images ?? [])

  // Texto plano para copiar la versión reescrita.
  const copyText = [
    `${raw.title}`,
    `Resumen: ${analysis.summary}`,
    `Qué pasa: ${rw.observed}`,
    `Qué debería pasar: ${rw.expected}`,
    rw.steps.length > 0 ? `Pasos:\n${rw.steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}` : '',
    `Ambiente: ${rw.environment}`,
    analysis.missingInformation.length > 0
      ? `Falta: ${analysis.missingInformation.join('; ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div className="space-y-4 p-6" style={{ background: alpha(col.base, 0.7) }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-sm" style={{ color: col.fg }}>
            {raw.title}
          </div>
          <div className="mt-0.5 text-sm" style={{ color: col.fgDim }}>
            {analysis.summary}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <CopyButton text={copyText} />
          {onDelete && <DeleteControl onConfirm={onDelete} />}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer transition-colors"
              style={{
                color: col.muted,
                border: `1px solid ${alpha(col.border, 0.25)}`,
                borderRadius: '4px',
                padding: '0.2rem 0.5rem',
                fontSize: '0.65rem',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = col.fgMuted)}
              onMouseLeave={(e) => (e.currentTarget.style.color = col.muted)}
            >
              cerrar
            </button>
          )}
        </div>
      </div>

      {/* Reescritura — el output principal */}
      <SectionCard title="reporte reescrito" accent>
        {rw.problemCount > 1 && (
          <div
            className="mb-3 inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-xs"
            style={{
              color: col.amber,
              border: `1px solid ${alpha(col.amberDeep, 0.3)}`,
              background: alpha(col.amberDeep, 0.06),
            }}
          >
            ⚠ este reporte junta {rw.problemCount} problemas distintos
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          <div>
            <div className="label">qué pasa</div>
            <p
              className="whitespace-pre-wrap text-sm leading-relaxed"
              style={{ color: rw.observed === 'No informado' ? col.muted : col.fgDim }}
            >
              {rw.observed}
            </p>
          </div>
          <div>
            <div className="label">qué debería pasar</div>
            <p
              className="whitespace-pre-wrap text-sm leading-relaxed"
              style={{ color: rw.expected === 'No informado' ? col.muted : col.fgDim }}
            >
              {rw.expected}
            </p>
          </div>

          {rw.steps.length > 0 && (
            <div className="col-span-2">
              <div className="label">pasos para reproducir</div>
              <ol className="space-y-1">
                {rw.steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className="mt-0.5 flex-shrink-0 font-mono text-xs"
                      style={{ color: col.muted }}
                    >
                      {i + 1}.
                    </span>
                    <span className="text-sm leading-relaxed" style={{ color: col.fgDim }}>
                      {s.replace(/^\d+[.)]\s*/, '')}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div>
            <div className="label">ambiente</div>
            <code
              className="font-mono text-xs"
              style={{ color: rw.environment === 'No informado' ? col.muted : col.fgMuted }}
            >
              {rw.environment}
            </code>
          </div>
          <div>
            <div className="label">tipo</div>
            <code className="font-mono text-xs" style={{ color: col.fgMuted }}>
              {analysis.bugType ?? '—'}
            </code>
          </div>
        </div>
      </SectionCard>

      {/* Qué falta */}
      {analysis.missingInformation.length > 0 && (
        <SectionCard title="datos que faltan en el reporte">
          <ul className="space-y-1">
            {analysis.missingInformation.map((m, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className="mt-0.5 flex-shrink-0 font-mono text-xs"
                  style={{ color: col.amber }}
                >
                  ?
                </span>
                <span className="text-sm leading-relaxed" style={{ color: col.fgDim }}>
                  {m}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Capturas del documento */}
      {allImages.length > 0 && (
        <SectionCard title={`capturas (${allImages.length})`}>
          <DocImageGallery images={allImages} />
        </SectionCard>
      )}

      {/* Reporte original (colapsable, para auditar la reescritura) */}
      <details className="group">
        <summary className="disclosure-summary flex cursor-pointer select-none items-center gap-1.5 font-mono text-xs transition-colors">
          <svg
            aria-hidden="true"
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="currentColor"
            className="transition-transform group-open:rotate-90"
          >
            <path d="M2 1l4 3-4 3V1z" />
          </svg>
          reporte original del QA
        </summary>
        <div
          className="mt-2 space-y-1.5 pl-3 text-sm leading-relaxed"
          style={{ color: col.fgMuted, borderLeft: `1px solid ${alpha(col.border, 0.2)}` }}
        >
          {raw.description && <p>{raw.description}</p>}
          {raw.stepsToReproduce && (
            <p>
              <span style={{ color: col.border }}>pasos: </span>
              {raw.stepsToReproduce}
            </p>
          )}
          {raw.actualResult && (
            <p>
              <span style={{ color: col.border }}>actual: </span>
              {raw.actualResult}
            </p>
          )}
          {raw.expectedResult && (
            <p>
              <span style={{ color: col.border }}>esperado: </span>
              {raw.expectedResult}
            </p>
          )}
        </div>
      </details>
    </div>
  )
}

// ─── Image gallery ────────────────────────────────────────────────────────────

export function DocImageGallery({ images }: { images: DocImage[] }) {
  const [lightbox, setLightbox] = useState<DocImage | null>(null)

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {images.map((img, i) => (
          <button
            type="button"
            key={i}
            onClick={() => setLightbox(img)}
            className="group relative overflow-hidden rounded transition-colors"
            style={{ border: `1px solid ${alpha(col.border, 0.25)}`, background: col.surface }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = alpha(col.fgMuted, 0.5))}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = alpha(col.border, 0.25))}
          >
            <img
              src={`data:${img.mimeType};base64,${img.data}`}
              alt={img.alt || `Imagen ${i + 1}`}
              className="h-16 w-auto max-w-[120px] object-contain"
            />
          </button>
        ))}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* backdrop accesible: botón real, cierra con click/Enter/Space */}
          <button
            type="button"
            aria-label="cerrar imagen"
            className="absolute inset-0 cursor-default"
            style={{ background: alpha(col.base, 0.92) }}
            onClick={() => setLightbox(null)}
          />
          <div role="dialog" aria-modal="true" className="relative max-h-[90vh] max-w-5xl">
            <img
              src={`data:${lightbox.mimeType};base64,${lightbox.data}`}
              alt={lightbox.alt || 'Imagen del documento'}
              className="max-h-[85vh] max-w-full rounded object-contain"
              style={{ border: `1px solid ${alpha(col.border, 0.3)}` }}
            />
            {lightbox.alt && (
              <div className="mt-2 text-center font-mono text-xs" style={{ color: col.muted }}>
                {lightbox.alt}
              </div>
            )}
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-colors"
              style={{
                background: col.raised,
                border: `1px solid ${alpha(col.border, 0.45)}`,
                color: col.fgMuted,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = col.fg
                e.currentTarget.style.borderColor = alpha(col.fgMuted, 0.6)
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = col.fgMuted
                e.currentTarget.style.borderColor = alpha(col.border, 0.45)
              }}
              aria-label="cerrar"
            >
              <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none">
                <line
                  x1="1"
                  y1="1"
                  x2="9"
                  y2="9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <line
                  x1="9"
                  y1="1"
                  x2="1"
                  y2="9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
