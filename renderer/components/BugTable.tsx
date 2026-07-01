import React, { useMemo, useState } from 'react'
import type {
  AnalyzedBug,
  BugCategory,
  BugStatus,
  DocImage,
  ExternalAgentProgress,
  ExternalAgentResult,
  Severity,
} from '../../src/types/index'
import { alpha, col, sz } from '../theme'
import { ActionModal, ConfirmActionModal } from './ActionModal'
import { BugUnderLensMark } from './decor/BugMotifs'
import { IconCheck, IconHelp, IconInfo, IconWarning, IconX } from './icons'

interface Props {
  results: AnalyzedBug[]
  analyzing?: boolean
  onSetStatus?: (bug: AnalyzedBug, status: BugStatus) => void
  onDelete?: (bug: AnalyzedBug) => void
  onAnalyzeExternalAgent?: (bug: AnalyzedBug) => Promise<ExternalAgentResult>
  focusedId?: string | null
  expandedId?: string | null
  onFocus?: (id: string | null) => void
  onToggleExpand?: (id: string) => void
  searchInputRef?: React.MutableRefObject<HTMLInputElement | null>
}

const severityOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }

// Etiqueta en español para mostrar (el enum sigue en inglés en código/filtros).
export const severityLabel: Record<Severity, string> = {
  critical: 'crítica',
  high: 'alta',
  medium: 'media',
  low: 'baja',
}

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
      className="btn-mini flex-shrink-0"
      title="copiar"
      style={{
        color: copied ? col.fgDim : col.muted,
        borderColor: copied ? alpha(col.fgDim, 0.35) : undefined,
      }}
      onMouseEnter={(e) => {
        if (!copied) e.currentTarget.style.color = col.fgMuted
      }}
      onMouseLeave={(e) => {
        if (!copied) e.currentTarget.style.color = col.muted
      }}
    >
      {copied ? <IconCheck size={12} /> : 'copiar'}
    </button>
  )
}

export function DeleteControl({ onConfirm, title }: { onConfirm: () => void; title: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="borrar bug"
        className="btn-mini flex-shrink-0"
        style={{
          color: col.red,
          borderColor: alpha(col.red, 0.32),
          background: alpha(col.red, 0.07),
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = alpha(col.red, 0.16)
          e.currentTarget.style.borderColor = alpha(col.red, 0.5)
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = alpha(col.red, 0.07)
          e.currentTarget.style.borderColor = alpha(col.red, 0.32)
        }}
      >
        borrar
      </button>
      <ConfirmActionModal
        open={open}
        title="borrar bug"
        description={`Se ocultará "${title}" del proyecto compartido.`}
        confirmLabel="borrar bug"
        busyLabel="borrando"
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false)
          onConfirm()
        }}
      />
    </>
  )
}

function ExternalAgentConfirmModal({
  open,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <ActionModal
      open={open}
      title="analizar con agente en la nube"
      description="BugLens va a enviar este bug al agente externo configurado para pedir una revisión adicional."
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="external-agent-consent-grid">
          <ConsentPoint
            title="calidad variable"
            text="La precisión de la respuesta depende del modelo, provider y configuración elegidos por el usuario."
          />
          <ConsentPoint
            title="tiempo variable"
            text="La velocidad puede cambiar según cola del proveedor, tamaño del repo, timeout y cantidad de contexto."
          />
          <ConsentPoint
            title="acceso al repositorio"
            text="Si hay un repositorio local configurado, el agente recibirá esa ruta y podrá leer archivos para orientar el análisis."
          />
          <ConsentPoint
            title="revisión humana"
            text="El resultado se integra al reporte como ayuda de triage; no reemplaza la validación técnica del equipo."
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            cancelar
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={busy}>
            iniciar análisis
          </button>
        </div>
      </div>
    </ActionModal>
  )
}

function ConsentPoint({ title, text }: { title: string; text: string }) {
  return (
    <div className="external-agent-consent-point">
      <div className="external-agent-consent-title">{title}</div>
      <p className="external-agent-consent-text">{text}</p>
    </div>
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
  onAnalyzeExternalAgent,
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
            width="12"
            height="12"
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
              {severityLabel[s]}
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
          className="ml-auto flex cursor-pointer items-center justify-center gap-1.5 rounded px-2 py-1 font-mono text-xs transition-all"
          style={{
            // Ancho fijo al texto más largo ("agrupado", 8ch) para que el toggle
            // agrupar↔agrupado no desplace lo de al lado.
            minWidth: 'calc(8ch + 1rem + 2px)',
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
          {/* aria-live: anuncia el total al cambiar pestaña/filtro. Ancho fijo +
              tabular-nums + alineado a la derecha → el conteo no salta al cambiar
              de dígitos ni de formato ("N/M" ↔ "N bugs"). */}
          <span
            aria-live="polite"
            aria-atomic="true"
            className="inline-block text-right tabular-nums"
            style={{ minWidth: '8ch' }}
          >
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
                fontSize: sz.text2xs,
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
                      <OmBadge style={sv}>{severityLabel[r.analysis.severity]}</OmBadge>
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
                          boxShadow: `inset 3px 0 0 ${severityStripColor[r.analysis.severity]}, inset 0 -3px 0 ${severityStripColor[r.analysis.severity]}`,
                          background: col.code,
                        }}
                      >
                        <ExpandedDetail
                          result={r}
                          onClose={() => setExpandedId(null)}
                          onDelete={onDelete ? () => onDelete(r) : undefined}
                          onSetStatus={onSetStatus ? (status) => onSetStatus(r, status) : undefined}
                          onAnalyzeExternalAgent={onAnalyzeExternalAgent}
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
            {/* Motivo temático (lupa + bicho): buscar y no encontrar nada */}
            <BugUnderLensMark style={{ width: 44, color: col.dim }} />
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
      <td colSpan={8} style={{ padding: '0.5rem 0.75rem' }}>
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
  onSetStatus,
  onAnalyzeExternalAgent,
}: {
  result: AnalyzedBug
  onClose?: () => void
  onDelete?: () => void
  onSetStatus?: (status: BugStatus) => void
  onAnalyzeExternalAgent?: (bug: AnalyzedBug) => Promise<ExternalAgentResult>
}) {
  const { enriched, analysis } = result
  const raw = enriched.raw
  const rw = analysis.rewritten
  const [externalAgentResult, setExternalAgentResult] = useState<ExternalAgentResult | null>(
    analysis.externalAgent ?? null,
  )
  const [externalAgentRunning, setExternalAgentRunning] = useState(false)
  const [externalAgentProgress, setExternalAgentProgress] = useState<ExternalAgentProgress | null>(
    null,
  )
  const [externalAgentStartedAt, setExternalAgentStartedAt] = useState<number | null>(null)
  const [externalAgentElapsedMs, setExternalAgentElapsedMs] = useState(0)
  const [externalAgentLastOutputAt, setExternalAgentLastOutputAt] = useState<number | null>(null)
  const [externalAgentConfirmOpen, setExternalAgentConfirmOpen] = useState(false)
  const [resolvedSuggestionDismissed, setResolvedSuggestionDismissed] = useState(false)
  const previousBugIdRef = React.useRef(raw.id)

  const allImages = enriched.googleDocs.flatMap((d) => d.images ?? [])
  const runExternalAgent =
    onAnalyzeExternalAgent ??
    (typeof window !== 'undefined' ? window.electronAPI?.analyzeWithExternalAgent : undefined)

  React.useEffect(() => {
    if (externalAgentRunning) return
    if (previousBugIdRef.current !== raw.id) {
      previousBugIdRef.current = raw.id
      setExternalAgentResult(analysis.externalAgent ?? null)
      setResolvedSuggestionDismissed(false)
      return
    }
    if (analysis.externalAgent) setExternalAgentResult(analysis.externalAgent)
  }, [analysis.externalAgent, externalAgentRunning, raw.id])

  React.useEffect(() => {
    if (!externalAgentRunning || !externalAgentStartedAt) return undefined
    const timer = window.setInterval(() => {
      setExternalAgentElapsedMs(Date.now() - externalAgentStartedAt)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [externalAgentRunning, externalAgentStartedAt])

  React.useEffect(() => {
    if (!externalAgentRunning) return undefined
    const unsubscribe = window.electronAPI?.onExternalAgentProgress?.((progress) => {
      if (progress.bugId !== raw.id) return
      setExternalAgentProgress(progress)
      setExternalAgentElapsedMs(progress.elapsedMs)
      setExternalAgentLastOutputAt(Date.now())
    })
    return unsubscribe
  }, [externalAgentRunning, raw.id])

  const handleExternalAgent = async () => {
    if (!runExternalAgent || externalAgentRunning) return
    const startedAt = Date.now()
    setExternalAgentRunning(true)
    setExternalAgentResult(null)
    setExternalAgentProgress(null)
    setExternalAgentStartedAt(startedAt)
    setExternalAgentElapsedMs(0)
    setExternalAgentLastOutputAt(null)
    setResolvedSuggestionDismissed(false)
    try {
      setExternalAgentResult(await runExternalAgent(result))
    } catch (err) {
      setExternalAgentResult({
        ok: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
        command: '',
        durationMs: 0,
      })
    } finally {
      setExternalAgentRunning(false)
    }
  }

  const externalAgentSilenceMs = externalAgentRunning
    ? Date.now() - (externalAgentLastOutputAt ?? externalAgentStartedAt ?? Date.now())
    : 0

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

  const externalAgentRunningOutput = externalAgentProgress?.output.trim()
  const externalAgentStatusText = externalAgentRunningOutput
    ? `última salida hace ${formatAgentDuration(externalAgentSilenceMs)}`
    : `sin salida todavía · ${formatAgentDuration(externalAgentElapsedMs)}`
  const resolvedSuggestion = externalAgentResult?.ok
    ? parseResolvedSuggestion(externalAgentResult.output)
    : null

  return (
    <div className="bug-detail space-y-4 p-6">
      <div className="bug-detail-hero">
        <div className="min-w-0 space-y-2">
          <div className="bug-detail-meta">
            <OmBadge style={severityStyle[analysis.severity]}>
              severidad {severityLabel[analysis.severity]}
            </OmBadge>
            <OmBadge style={categoryStyle[analysis.category]}>{analysis.category}</OmBadge>
            <OmBadge style={statusStyle[result.status]}>{statusStyle[result.status].label}</OmBadge>
            {analysis.missingInformation.length > 0 && (
              <OmBadge
                style={{
                  text: col.amber,
                  bg: alpha(col.amberDeep, 0.08),
                  border: alpha(col.amberDeep, 0.28),
                }}
              >
                faltan {analysis.missingInformation.length} datos
              </OmBadge>
            )}
          </div>
          <div>
            <h3 className="bug-detail-title">{raw.title}</h3>
            <p className="bug-detail-summary mt-1 text-sm">{analysis.summary}</p>
          </div>
        </div>
        <div className="bug-detail-actions">
          {onDelete && <DeleteControl onConfirm={onDelete} title={raw.title} />}
          <button
            type="button"
            onClick={() => setExternalAgentConfirmOpen(true)}
            className="btn-mini flex-shrink-0"
            disabled={externalAgentRunning || !runExternalAgent}
            title="analizar con agente externo"
            style={{
              color: externalAgentRunning ? col.fgDim : col.cream,
              borderColor: alpha(col.cream, 0.28),
              background: externalAgentRunning ? alpha(col.cream, 0.08) : 'transparent',
            }}
          >
            {externalAgentRunning ? 'analizando...' : 'Analizar'}
          </button>
          <ExternalAgentConfirmModal
            open={externalAgentConfirmOpen}
            busy={externalAgentRunning}
            onClose={() => setExternalAgentConfirmOpen(false)}
            onConfirm={() => {
              setExternalAgentConfirmOpen(false)
              void handleExternalAgent()
            }}
          />
          <CopyButton text={copyText} />
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="btn-mini"
              onMouseEnter={(e) => (e.currentTarget.style.color = col.fgMuted)}
              onMouseLeave={(e) => (e.currentTarget.style.color = col.muted)}
            >
              cerrar
            </button>
          )}
        </div>
      </div>

      <div className="bug-detail-layout">
        <div className="bug-detail-main">
          <SectionCard title="reporte reescrito" accent>
            <div className="space-y-4">
              {rw.problemCount > 1 && (
                <div
                  role="status"
                  className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-xs"
                  style={{
                    color: col.amber,
                    border: `1px solid ${alpha(col.amberDeep, 0.3)}`,
                    background: alpha(col.amberDeep, 0.06),
                  }}
                >
                  <IconWarning size={12} className="flex-shrink-0" />
                  este reporte junta {rw.problemCount} problemas distintos
                </div>
              )}
              <div className="bug-rewrite-grid">
                <RewriteColumn label="qué pasa" text={rw.observed} tone={col.red} Icon={IconX} />
                <RewriteColumn
                  label="qué debería pasar"
                  text={rw.expected}
                  tone={col.green}
                  Icon={IconCheck}
                />
              </div>

              {rw.steps.length > 0 && (
                <div>
                  <div className="label">pasos para reproducir</div>
                  <ol className="space-y-2">
                    {rw.steps.map((s, i) => (
                      <li key={i} className="bug-step">
                        <span className="bug-step-number">{i + 1}</span>
                        <span className="bug-step-text">{s.replace(/^\d+[.)]\s*/, '')}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </SectionCard>

          {(externalAgentResult || externalAgentRunning) && (
            <ExternalAgentPanel
              running={externalAgentRunning}
              result={externalAgentResult}
              progress={externalAgentProgress}
              elapsedMs={externalAgentElapsedMs}
              statusText={externalAgentStatusText}
              runningOutput={externalAgentRunningOutput}
            />
          )}

          {resolvedSuggestion &&
            !resolvedSuggestionDismissed &&
            result.status !== 'solucionado' && (
              <ResolvedSuggestionCard
                reason={resolvedSuggestion.reason}
                onConfirm={() => {
                  onSetStatus?.('solucionado')
                  setResolvedSuggestionDismissed(true)
                }}
                onDismiss={() => setResolvedSuggestionDismissed(true)}
                canConfirm={Boolean(onSetStatus)}
              />
            )}

          {allImages.length > 0 && (
            <SectionCard title={`capturas (${allImages.length})`}>
              <DocImageGallery images={allImages} />
            </SectionCard>
          )}
        </div>

        <aside className="bug-detail-rail" aria-label="contexto del reporte">
          <SectionCard title="contexto">
            <div className="grid gap-2">
              <DetailStat
                label="pantalla"
                value={analysis.affectedArea || 'No informado'}
                muted={!analysis.affectedArea}
              />
              <DetailStat
                label="ambiente"
                value={rw.environment}
                muted={rw.environment === 'No informado'}
              />
              <DetailStat label="tipo" value={analysis.bugType ?? 'No informado'} />
              <DetailStat label="confianza" value={`${Math.round(analysis.confidence * 100)}%`} />
            </div>
          </SectionCard>

          {analysis.missingInformation.length > 0 && (
            <SectionCard title="datos que faltan">
              <ul className="missing-list">
                {analysis.missingInformation.map((m, i) => (
                  <li key={i} className="missing-item">
                    <span style={{ color: col.amber }}>
                      <IconHelp size={12} />
                    </span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          {!externalAgentResult && !externalAgentRunning && (
            <SectionCard title="agente configurado">
              <div
                className="flex items-start gap-2 text-sm leading-relaxed"
                style={{ color: col.fgMuted }}
              >
                <span
                  className="mt-0.5"
                  style={{ color: runExternalAgent ? col.cream : col.muted }}
                >
                  <IconInfo size={12} />
                </span>
                <span>
                  {runExternalAgent
                    ? 'Podés pedir un análisis adicional desde la acción Analizar.'
                    : 'No hay agente externo disponible para este entorno.'}
                </span>
              </div>
            </SectionCard>
          )}
        </aside>
      </div>

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

function ExternalAgentPanel({
  running,
  result,
  elapsedMs,
  statusText,
  runningOutput,
}: {
  running: boolean
  result: ExternalAgentResult | null
  progress: ExternalAgentProgress | null
  elapsedMs: number
  statusText: string
  runningOutput?: string
}) {
  const ok = result?.ok
  const duration = running ? elapsedMs : (result?.durationMs ?? 0)
  const agentOutput = running
    ? runningOutput || 'Esperando salida del agente externo. El proceso sigue activo.'
    : result?.output || 'El agente no devolvió salida.'
  const accessIssue = parseAgentAccessIssue(agentOutput)

  return (
    <SectionCard title="análisis del agente en la nube">
      <div className="cloud-agent-panel">
        <div className="cloud-agent-header">
          <div className="min-w-0">
            <div className="cloud-agent-kicker">
              <span className="cloud-agent-mark" aria-hidden="true" />
              aporte integrado al reporte
            </div>
            <p className="cloud-agent-lead">
              Revisión adicional hecha por el agente configurado en la nube sobre este bug.
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
            <OmBadge
              style={
                running
                  ? {
                      text: col.cream,
                      bg: alpha(col.cream, 0.08),
                      border: alpha(col.cream, 0.24),
                    }
                  : ok
                    ? {
                        text: col.green,
                        bg: alpha(col.green, 0.08),
                        border: alpha(col.green, 0.24),
                      }
                    : {
                        text: col.red,
                        bg: alpha(col.red, 0.08),
                        border: alpha(col.red, 0.24),
                      }
              }
            >
              {running ? 'ejecutando' : ok ? 'completado' : 'error'}
            </OmBadge>
            <span className="font-mono text-xs" style={{ color: col.muted }}>
              {formatAgentDuration(duration)}
            </span>
          </div>
        </div>

        <div className="cloud-agent-body">
          {running && (
            <div className="font-mono text-xs" style={{ color: col.fgMuted }}>
              proceso activo · {statusText}
            </div>
          )}
          {result?.error && (
            <div className="whitespace-pre-line text-sm leading-relaxed" style={{ color: col.red }}>
              {result.error}
            </div>
          )}

          {accessIssue ? (
            <AgentAccessIssueCard path={accessIssue.path} />
          ) : running ? (
            <AgentRunningProgress output={agentOutput} />
          ) : ok ? (
            <CloudAgentReport>{agentOutput}</CloudAgentReport>
          ) : null}

          {!ok && result?.output && result.error && (
            <div className="p-3 pt-0">
              <div className="mb-2 font-mono text-xs uppercase" style={{ color: col.fgMuted }}>
                salida técnica
              </div>
              <CloudAgentReport>{result.output}</CloudAgentReport>
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  )
}

function DetailStat({
  label,
  value,
  muted = false,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="detail-stat">
      <span className="detail-stat-label">{label}</span>
      <span className="detail-stat-value" style={{ color: muted ? col.muted : undefined }}>
        {value}
      </span>
    </div>
  )
}

function AgentRunningProgress({ output }: { output: string }) {
  const tasks = parseAgentTodoProgress(output)

  return (
    <div className="agent-running-progress">
      <div className="agent-running-title">el agente está revisando el bug</div>
      <p className="agent-running-text">
        La salida parcial se mantiene como progreso interno hasta que el agente termine el informe.
      </p>
      {tasks.length > 0 && (
        <ul className="agent-running-tasks" aria-label="progreso del agente">
          {tasks.map((task, index) => (
            <li key={`${task.text}-${index}`} className="agent-running-task">
              <span className={`agent-running-task-dot agent-running-task-${task.status}`} />
              <span>{task.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function parseAgentTodoProgress(output: string): Array<{ status: string; text: string }> {
  const todoIndex = output.search(/\bTODOS\b/i)
  if (todoIndex < 0) return []
  const text = output.slice(todoIndex).replace(/\s+/g, ' ')
  const markerRegex = /\[([•xX✓ ])\]\s*/g
  const matches = [...text.matchAll(markerRegex)]
  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length
      const end = matches[index + 1]?.index ?? text.length
      const marker = match[1]
      const taskText = cleanAgentReportText(text.slice(start, end))
      const status = marker === ' ' ? 'pending' : marker === '•' ? 'active' : 'done'
      return { status, text: taskText }
    })
    .filter((task) => task.text)
}

function AgentAccessIssueCard({ path }: { path?: string }) {
  return (
    <div className="agent-access-issue">
      <div className="agent-access-issue-title">el agente no pudo acceder al repositorio</div>
      <p className="agent-access-issue-text">
        El comando externo pidió permiso para leer {path ? `“${path}”` : 'el repositorio'} y el
        agente lo rechazó automáticamente. No llegó a hacer un análisis útil de código.
      </p>
      <p className="agent-access-issue-hint">
        Revisá que el repositorio configurado sea el directorio de trabajo permitido por el agente o
        ajustá sus permisos/sandbox para ejecuciones no interactivas.
      </p>
    </div>
  )
}

function parseAgentAccessIssue(output: string): { path?: string } | null {
  if (!/permission requested:/i.test(output)) return null
  if (!/(auto-rejecting|rejected permission|user rejected permission)/i.test(output)) return null
  const path = output.match(/external_directory\s+\(([^)]+)\)/i)?.[1]
  return { path }
}

function ResolvedSuggestionCard({
  reason,
  canConfirm,
  onConfirm,
  onDismiss,
}: {
  reason: string
  canConfirm: boolean
  onConfirm: () => void
  onDismiss: () => void
}) {
  return (
    <div className="resolved-suggestion-card">
      <div className="min-w-0">
        <div className="resolved-suggestion-title">parece que está resuelto</div>
        <p className="resolved-suggestion-text">
          {reason ||
            'El agente encontró indicios de que el problema podría estar corregido en el código revisado.'}
        </p>
        <p className="resolved-suggestion-warning">
          Esta inferencia puede ser incorrecta: depende del modelo, la rama revisada y el contexto
          disponible. Confirmalo antes de cerrar el bug.
        </p>
      </div>
      <fieldset className="resolved-suggestion-actions">
        <legend className="sr-only">marcar bug como resuelto</legend>
        <button
          type="button"
          className="btn-primary text-xs"
          onClick={onConfirm}
          disabled={!canConfirm}
          title={canConfirm ? 'marcar como solucionado' : 'no hay handler de estado disponible'}
        >
          sí
        </button>
        <button type="button" className="btn-secondary text-xs" onClick={onDismiss}>
          no
        </button>
      </fieldset>
    </div>
  )
}

function parseResolvedSuggestion(output: string): { reason: string } | null {
  const lines = output
    .split(/\r?\n/)
    .map((line) => cleanAgentReportText(line))
    .filter(Boolean)
  const expectsStructuredStatus = lines.some((line) =>
    /^(?:#{1,6}\s*)?(coincide con el bug reportado|estado probable\s*:|hallazgos laterales)$/i.test(
      line,
    ),
  )

  const explicitLineIndex = lines.findIndex((line) => {
    const status = parseAgentResolvedStatusLine(line, expectsStructuredStatus)
    return status !== 'unknown'
  })
  if (explicitLineIndex >= 0) {
    if (
      parseAgentResolvedStatusLine(lines[explicitLineIndex], expectsStructuredStatus) !== 'resolved'
    ) {
      return null
    }
    const reasonLine = lines
      .slice(explicitLineIndex + 1, explicitLineIndex + 4)
      .find((line) => /^motivo\s*:/i.test(line))
    return { reason: reasonLine?.replace(/^motivo\s*:\s*/i, '').trim() ?? '' }
  }

  const clearPositive = lines.find(
    (line) =>
      !isNegatedResolvedLine(line) &&
      /\b(parece|probablemente|aparentemente)\s+(que\s+)?(ya\s+)?est[aá]\s+resuelto\b/i.test(line),
  )
  return clearPositive ? { reason: clearPositive } : null
}

function parseAgentResolvedStatusLine(
  line: string,
  expectsStructuredStatus: boolean,
): 'resolved' | 'not_resolved' | 'unknown' {
  const explicitResolved = line.match(/^parece resuelto\s*:\s*(.+)$/i)
  const explicitStatus = line.match(/^estado probable(?: del bug)?\s*:\s*(.+)$/i)
  if (expectsStructuredStatus && explicitResolved && !explicitStatus) return 'unknown'
  const value = normalizeAgentStatusValue(explicitResolved?.[1] ?? explicitStatus?.[1] ?? '')
  if (!value) return 'unknown'
  if (/\b(parcial|parcialmente|no determinable)\b/.test(value)) return 'not_resolved'
  if (/^(si|yes|true|resuelto)\b/.test(value)) return 'resolved'
  if (
    /^(no|false|parcial|parcialmente|no resuelto|no_resuelto|no determinable|no_determinable)\b/.test(
      value,
    )
  ) {
    return 'not_resolved'
  }
  return 'unknown'
}

function normalizeAgentStatusValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim()
}

function isNegatedResolvedLine(line: string): boolean {
  const normalizedLine = normalizeAgentStatusValue(line)
  return /\b(no|sin evidencia|no hay evidencia|no se observa|no pude confirmar)\b.*\bresuelt/.test(
    normalizedLine,
  )
}

type AgentReportBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'coverage'; items: AgentCoverageItem[] }
  | { type: 'insights'; items: AgentInsight[] }
  | { type: 'references'; items: AgentFileReference[] }

interface AgentCoverageItem {
  status: 'covered' | 'partial' | 'failed' | 'unknown' | 'side'
  statusLabel: string
  step: string
  detail: string
}

interface AgentInsight {
  title: string
  body: string
}

interface AgentFileReference {
  file: string
  line: string
  relevance: string
}

function CloudAgentReport({ children }: { children: string }) {
  const blocks = parseAgentReport(children)

  return (
    <div className="cloud-agent-report">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <h4 key={`${block.type}-${index}`} className="cloud-agent-heading">
              {block.text}
            </h4>
          )
        }
        if (block.type === 'list') {
          return (
            <ul key={`${block.type}-${index}`} className="cloud-agent-list">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          )
        }
        if (block.type === 'insights') {
          return <CloudAgentInsights key={`${block.type}-${index}`} items={block.items} />
        }
        if (block.type === 'coverage') {
          return <CloudAgentCoverage key={`${block.type}-${index}`} items={block.items} />
        }
        if (block.type === 'references') {
          return <CloudAgentReferences key={`${block.type}-${index}`} items={block.items} />
        }
        return (
          <p key={`${block.type}-${index}`} className="cloud-agent-paragraph">
            {block.text}
          </p>
        )
      })}
    </div>
  )
}

function parseAgentReport(output: string): AgentReportBlock[] {
  const blocks: AgentReportBlock[] = []
  let paragraph: string[] = []
  let listItems: string[] = []
  let tableRows: string[][] = []
  let insights: AgentInsight[] = []
  let coverageItems: AgentCoverageItem[] = []
  let references: AgentFileReference[] = []
  let currentSection = ''
  let skippingTodoBlock = false

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    blocks.push({ type: 'paragraph', text: cleanAgentReportText(paragraph.join(' ')) })
    paragraph = []
  }

  const flushList = () => {
    if (listItems.length === 0) return
    blocks.push({ type: 'list', items: listItems.map(cleanAgentReportText) })
    listItems = []
  }

  const flushTable = () => {
    if (tableRows.length === 0) return
    const references = tableRowsToReferences(tableRows)
    if (references.length > 0) blocks.push({ type: 'references', items: references })
    else {
      blocks.push({
        type: 'paragraph',
        text: tableRows.map((row) => row.map(cleanAgentReportText).join(' · ')).join(' · '),
      })
    }
    tableRows = []
  }

  const flushInsights = () => {
    if (insights.length === 0) return
    blocks.push({ type: 'insights', items: insights })
    insights = []
  }

  const flushCoverage = () => {
    if (coverageItems.length === 0) return
    blocks.push({ type: 'coverage', items: coverageItems })
    coverageItems = []
  }

  const flushReferences = () => {
    if (references.length === 0) return
    blocks.push({ type: 'references', items: references })
    references = []
  }

  for (const rawLine of normalizeAgentReportOutput(output).split(/\r?\n/)) {
    const line = rawLine.trim()
    const heading = line.match(/^#{1,6}\s+(.+)$/)
    const plainHeading = !heading && isPlainAgentSectionHeading(line) ? line : ''
    if (/^TODOS$/i.test(line)) {
      flushParagraph()
      flushList()
      flushTable()
      flushInsights()
      flushCoverage()
      flushReferences()
      skippingTodoBlock = true
      continue
    }
    if (skippingTodoBlock && !heading && !plainHeading) continue
    if (heading || plainHeading) skippingTodoBlock = false
    if (isAgentOperationalTrace(line) || isAgentFillerLine(line)) {
      flushParagraph()
      flushList()
      flushTable()
      flushInsights()
      flushCoverage()
      flushReferences()
      continue
    }
    if (!line) {
      flushParagraph()
      flushList()
      flushTable()
      flushInsights()
      flushCoverage()
      flushReferences()
      continue
    }

    const tableRow = parseMarkdownTableRow(line)
    if (tableRow) {
      flushParagraph()
      flushList()
      flushInsights()
      flushCoverage()
      flushReferences()
      tableRows.push(tableRow)
      continue
    }

    if (heading || plainHeading) {
      flushParagraph()
      flushList()
      flushTable()
      flushInsights()
      flushCoverage()
      flushReferences()
      const headingText = heading?.[1]
        ? cleanAgentReportText(heading[1])
        : canonicalAgentSectionHeading(plainHeading)
      currentSection = normalizeAgentSection(headingText)
      blocks.push({ type: 'heading', text: headingText })
      continue
    }

    const listItem = line.match(/^(?:[-*]|\d+[.)])\s+(.+)$/)
    if (listItem) {
      flushParagraph()
      flushTable()
      const reference = parseAgentReferenceLine(listItem[1])
      if (reference) {
        flushList()
        flushInsights()
        references.push(reference)
        continue
      }
      const insight = parseAgentInsightLine(listItem[1], currentSection)
      if (insight) {
        flushList()
        flushCoverage()
        flushReferences()
        insights.push(insight)
        continue
      }
      const coverage = parseAgentCoverageLine(listItem[1], currentSection)
      if (coverage) {
        flushList()
        flushInsights()
        flushReferences()
        coverageItems.push(coverage)
        continue
      }
      flushReferences()
      flushInsights()
      flushCoverage()
      listItems.push(listItem[1])
      continue
    }

    const reference = parseAgentReferenceLine(line)
    if (reference) {
      flushParagraph()
      flushList()
      flushTable()
      flushInsights()
      flushCoverage()
      references.push(reference)
      continue
    }

    const insight = parseAgentInsightLine(line, currentSection)
    if (insight) {
      flushParagraph()
      flushList()
      flushTable()
      flushCoverage()
      flushReferences()
      insights.push(insight)
      continue
    }

    const coverage = parseAgentCoverageLine(line, currentSection)
    if (coverage) {
      flushParagraph()
      flushList()
      flushTable()
      flushInsights()
      flushReferences()
      coverageItems.push(coverage)
      continue
    }

    if (shouldRenderLineAsListItem(line, currentSection)) {
      flushParagraph()
      flushTable()
      flushInsights()
      flushCoverage()
      flushReferences()
      listItems.push(line)
      continue
    }

    flushList()
    flushTable()
    flushInsights()
    flushCoverage()
    flushReferences()
    paragraph.push(line)
  }

  flushParagraph()
  flushList()
  flushTable()
  flushInsights()
  flushCoverage()
  flushReferences()

  if (blocks.length === 0) {
    return [{ type: 'paragraph', text: 'El agente no devolvió salida.' }]
  }
  return blocks
}

function normalizeAgentReportOutput(output: string): string {
  return output
    .replace(/\s+(Coincide con el bug reportado:)/gi, '\n$1')
    .replace(/\s+(Motivo:)/gi, '\n$1')
}

function isAgentOperationalTrace(line: string): boolean {
  if (!line) return false
  if (/^>\s*build\s*[·-]/i.test(line)) return true
  if (/^(?:[-*]\s*)?>\s*(?:buglens|opencode)\s*[·-]/i.test(line)) return true
  if (/^[→✱✓•]\s+/.test(line)) return true
  if (/\b(Read|Glob|Grep|Explore Agent)\b/.test(line) && /[→✱✓•]/.test(line)) return true
  if (/^✗\s*Invalid Tool\b/i.test(line)) return true
  if (/^The arguments provided to the tool are invalid:/i.test(line)) return true
  return false
}

function isAgentFillerLine(line: string): boolean {
  return (
    /^ahora tengo suficiente información/i.test(line) ||
    /^ahora tengo suficiente contexto/i.test(line) ||
    /^este es mi análisis:?$/i.test(line) ||
    /^(now let me|let me|i(?:'|’)ll|i will|i need to|next,? i|first,? i)\b/i.test(line)
  )
}

function isPlainAgentSectionHeading(line: string): boolean {
  if (!line || /[.:]$/.test(line)) return false
  return Boolean(AGENT_SECTION_HEADINGS[normalizeAgentSection(line)])
}

const AGENT_SECTION_HEADINGS: Record<string, string> = {
  resumen: 'Resumen',
  evidencia: 'Evidencia',
  'cobertura de los pasos reportados': 'Cobertura de los pasos reportados',
  'diagnostico probable': 'Diagnóstico probable',
  'archivos o areas a revisar': 'Archivos o áreas a revisar',
  'hallazgos laterales': 'Hallazgos laterales',
  'estado probable del bug': 'Estado probable del bug',
  'proximos pasos': 'Próximos pasos',
  'informacion faltante': 'Información faltante',
}

function canonicalAgentSectionHeading(line: string): string {
  return AGENT_SECTION_HEADINGS[normalizeAgentSection(line)] ?? cleanAgentReportText(line)
}

function normalizeAgentSection(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function parseAgentInsightLine(line: string, section: string): AgentInsight | null {
  if (!['evidencia', 'diagnostico probable'].includes(section)) return null
  const cleanedLine = cleanAgentReportText(line)
  const separator = cleanedLine.includes(' — ') ? ' — ' : cleanedLine.includes(': ') ? ': ' : ''
  if (!separator) return null
  const [title = '', ...bodyParts] = cleanedLine.split(separator)
  const body = bodyParts.join(separator).trim()
  if (!title.trim() || !body) return null
  return { title: title.trim(), body }
}

function parseAgentCoverageLine(line: string, section: string): AgentCoverageItem | null {
  if (section !== 'cobertura de los pasos reportados') return null
  const cleanedLine = cleanAgentReportText(line)
  const match = cleanedLine.match(
    /^(.+?)\s*(?:→|=>|:|-)\s*(cubierto|parcial|parcialmente cubierto|cubierto parcialmente|no cubierto|falla|fallando|no verificable|no_verificable|hallazgo lateral|lateral)\.?\s*(.*)$/i,
  )
  if (!match) return null
  const statusText = normalizeAgentStatusValue(match[2] ?? '')
  const detailText = normalizeAgentStatusValue(match[3] ?? '')
  const hasPartialDetail =
    /\b(no verificado|no verificada|sin verificar|no valida|no validado|no validada|backend no|solo frontend)\b/.test(
      detailText,
    )
  const status = statusText.includes('hallazgo')
    ? 'side'
    : statusText === 'lateral'
      ? 'side'
      : statusText.includes('no verificable')
        ? 'unknown'
        : statusText.includes('parcial') || (statusText === 'cubierto' && hasPartialDetail)
          ? 'partial'
          : statusText.includes('no cubierto') || statusText.includes('falla')
            ? 'failed'
            : 'covered'
  const statusLabel =
    status === 'covered'
      ? 'cubierto'
      : status === 'partial'
        ? 'parcial'
        : status === 'failed'
          ? 'falla'
          : status === 'unknown'
            ? 'no verificable'
            : 'lateral'
  return {
    status,
    statusLabel,
    step: cleanAgentReportText(match[1] ?? ''),
    detail: cleanAgentReportText(match[3] ?? ''),
  }
}

function shouldRenderLineAsListItem(line: string, section: string): boolean {
  if (!['proximos pasos', 'informacion faltante'].includes(section)) return false
  return cleanAgentReportText(line).length > 0
}

function CloudAgentCoverage({ items }: { items: AgentCoverageItem[] }) {
  const markerByStatus: Record<AgentCoverageItem['status'], string> = {
    covered: '✓',
    partial: '~',
    failed: '!',
    unknown: '?',
    side: '·',
  }

  return (
    <div className="cloud-agent-coverage">
      {items.map((item, index) => (
        <div
          key={`${item.step}-${index}`}
          className={`cloud-agent-coverage-item cloud-agent-coverage-${item.status}`}
        >
          <span className="cloud-agent-coverage-mark" aria-hidden="true">
            {markerByStatus[item.status]}
          </span>
          <div className="cloud-agent-coverage-copy">
            <div className="cloud-agent-coverage-title">
              <span>{item.step}</span>
              <span className="cloud-agent-coverage-status">{item.statusLabel}</span>
            </div>
            {item.detail && <p className="cloud-agent-coverage-detail">{item.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

function CloudAgentInsights({ items }: { items: AgentInsight[] }) {
  return (
    <div className="cloud-agent-insights">
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} className="cloud-agent-insight">
          <div className="cloud-agent-insight-title">{item.title}</div>
          <p className="cloud-agent-insight-body">{item.body}</p>
        </div>
      ))}
    </div>
  )
}

function CloudAgentReferences({ items }: { items: AgentFileReference[] }) {
  return (
    <div className="cloud-agent-references">
      {items.map((item, index) => (
        <div key={`${item.file}-${item.line}-${index}`} className="cloud-agent-reference">
          <div className="cloud-agent-reference-main">
            <span className="cloud-agent-reference-file">{item.file}</span>
            {item.line && <span className="cloud-agent-reference-line">línea {item.line}</span>}
          </div>
          {item.relevance && <p className="cloud-agent-reference-note">{item.relevance}</p>}
        </div>
      ))}
    </div>
  )
}

function parseAgentReferenceLine(line: string): AgentFileReference | null {
  const cleanedLine = cleanAgentReportText(line)
  const parts = cleanedLine.split(/\s+[—-]\s+/)
  const target = parts[0]?.trim() ?? ''
  const relevance = parts.slice(1).join(' — ').trim()
  if (!isLikelyAgentReferenceTarget(target)) return null

  const lineMatch = target.match(/^(.*?)(?::|\s+línea\s+)(\d+(?:-\d+)?)$/i)
  return {
    file: lineMatch ? lineMatch[1].trim() : target,
    line: lineMatch ? lineMatch[2] : '',
    relevance,
  }
}

function isLikelyAgentReferenceTarget(value: string): boolean {
  if (!value) return false
  if (/^(backend|frontend|api|servicio|endpoint|configuración|configuracion):/i.test(value)) {
    return true
  }
  return /(?:^|\/)[\w.-]+\.(?:ts|tsx|js|jsx|html|css|scss|java|kt|cs|go|py|rb|php|sql|json|yml|yaml|properties|xml|md)$/i.test(
    value,
  )
}

function parseMarkdownTableRow(line: string): string[] | null {
  if (!line.includes('|')) return null
  const cells = line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
  if (cells.length < 2) return null
  if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) return []
  return cells
}

function tableRowsToReferences(rows: string[][]): AgentFileReference[] {
  const meaningfulRows = rows.filter((row) => row.length > 0)
  if (meaningfulRows.length === 0) return []

  const firstRow = meaningfulRows[0].map((cell) => normalizeAgentTableHeader(cell))
  const hasHeader = firstRow.some((cell) => ['archivo', 'file', 'ruta', 'path'].includes(cell))
  const bodyRows = hasHeader ? meaningfulRows.slice(1) : meaningfulRows
  const fileIndex = hasHeader
    ? firstRow.findIndex((cell) => ['archivo', 'file', 'ruta', 'path'].includes(cell))
    : 0
  const lineIndex = hasHeader
    ? firstRow.findIndex((cell) => ['linea', 'line', 'lineas', 'lines'].includes(cell))
    : 1
  const relevanceIndex = hasHeader
    ? firstRow.findIndex((cell) =>
        ['relevancia', 'motivo', 'razon', 'detalle', 'descripcion'].includes(cell),
      )
    : 2

  return bodyRows
    .map((row) => ({
      file: cleanAgentReportText(row[fileIndex] ?? row[0] ?? ''),
      line: cleanAgentReportText(row[lineIndex] ?? ''),
      relevance: cleanAgentReportText(row[relevanceIndex] ?? row.slice(2).join(' ')),
    }))
    .filter((item) => item.file)
}

function normalizeAgentTableHeader(text: string): string {
  return cleanAgentReportText(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function cleanAgentReportText(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatAgentDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${seconds}s`
  return `${minutes}m ${seconds}s`
}

// Columna de la reescritura con acento semántico (tipo diff): el ícono + el borde
// izquierdo + el color del label comunican el rol (defecto vs. esperado); el cuerpo
// queda en el color de lectura normal.
function RewriteColumn({
  label,
  text,
  tone,
  Icon,
}: {
  label: string
  text: string
  tone: string
  Icon: typeof IconCheck
}) {
  const isEmpty = text === 'No informado'
  return (
    <div className="rewrite-panel" style={{ borderLeftColor: alpha(tone, 0.58) }}>
      <div
        className="label"
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: tone }}
      >
        <Icon size={11} />
        {label}
      </div>
      <p
        className={`rewrite-panel-body whitespace-pre-wrap ${isEmpty ? 'rewrite-panel-body-muted' : ''}`}
      >
        {text}
      </p>
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
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 10 10" fill="none">
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
