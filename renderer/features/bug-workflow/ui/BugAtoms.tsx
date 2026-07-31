// BugAtoms.tsx
//
// Piezas chicas y reutilizables de la UI de bugs: badges, barra de confianza,
// selector de estado, pestañas de ciclo de vida, acciones (copiar / borrar),
// tarjeta de sección y galería de capturas.

import React, { useState } from 'react'
import type { BugStatus, DocImage, Severity } from '../../../../src/shared/contracts'
import { ConfirmActionModal } from '../../../components/ActionModal'
import { IconCheck, IconTrash, IconX } from '../../../components/icons'
import { col } from '../../../theme'
import {
  LIFECYCLE_TABS,
  type LifecycleTab,
  STATUS_OPTIONS,
  severityBadgeClass,
  severityLabel,
  statusBadgeClass,
  statusLabel,
} from './bugPresentation'

// ─── Badges ──────────────────────────────────────────────────────────────────

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={severityBadgeClass(severity)}>{severityLabel[severity]}</span>
}

export function StatusBadge({ status }: { status: BugStatus }) {
  return <span className={statusBadgeClass(status)}>{statusLabel[status]}</span>
}

export function CategoryBadge({ children }: { children: React.ReactNode }) {
  return <span className="badge badge-category">{children}</span>
}

export function MissingInfoBadge({ count }: { count: number }) {
  return (
    <span className="badge badge-warn" title={`faltan ${count} datos en el reporte`}>
      Falta info
    </span>
  )
}

export function ProblemCountBadge({ count }: { count: number }) {
  return <span className="badge badge-accent">{count} problemas</span>
}

// ─── Confianza del análisis ──────────────────────────────────────────────────

export function ConfidenceBar({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <span className="inline-flex items-center gap-2 text-xs" style={{ color: col.fgMuted }}>
      {showLabel && 'Confianza'}
      <span className="confidence-track" style={{ width: 72, height: 5 }}>
        <span
          className={`confidence-fill ${pct < 50 ? 'confidence-fill-low' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="font-semibold tabular-nums" style={{ color: col.fgStrong }}>
        {pct}%
      </span>
    </span>
  )
}

// ─── Selector de estado ──────────────────────────────────────────────────────
// Marca el estado sin abrir el detalle. stopPropagation para que el click no
// dispare la selección de la fila. Native select = accesible.

export function StatusSelect({
  status,
  onChange,
}: {
  status: BugStatus
  onChange: (status: BugStatus) => void
}) {
  return (
    <select
      value={status}
      aria-label="estado del bug"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value as BugStatus)}
      className={`${statusBadgeClass(status)} status-select`}
    >
      {STATUS_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {statusLabel[option]}
        </option>
      ))}
    </select>
  )
}

// ─── Pestañas de ciclo de vida ───────────────────────────────────────────────
// Patrón ARIA tablist: una sola parada de tab (roving tabindex), flechas/Home/End
// mueven la selección (activación automática). Comunica con texto + contador (no
// solo color); el nombre accesible incluye el conteo y oculta el número visual
// para no leerlo dos veces.

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
    const current = LIFECYCLE_TABS.findIndex((tab) => tab.key === value)
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
    <div role="tablist" aria-label="ciclo de vida" onKeyDown={handleKeyDown} className="tablist">
      {LIFECYCLE_TABS.map((tab, index) => {
        const active = value === tab.key
        const count = counts[tab.key]
        return (
          <button
            key={tab.key}
            ref={(el) => {
              tabRefs.current[index] = el
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            aria-label={`${tab.label}, ${count} bug${count === 1 ? '' : 's'}`}
            onClick={() => onChange(tab.key)}
            className={`tab ${active ? 'tab-active' : ''}`}
          >
            {tab.label}
            <span aria-hidden="true" className="tab-count">
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Acciones ────────────────────────────────────────────────────────────────

export function CopyButton({ text, label = 'Copiar' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="btn-secondary flex-shrink-0"
      title="copiar el reporte reescrito"
    >
      {copied ? (
        <>
          <IconCheck size={12} className="button-icon" />
          Copiado
        </>
      ) : (
        label
      )}
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
        title="Borrar bug"
        className="btn-danger flex-shrink-0"
      >
        <IconTrash size={12} className="button-icon" />
        Borrar
      </button>
      <ConfirmActionModal
        open={open}
        title="Borrar bug"
        description={`Se ocultará "${title}" del proyecto compartido.`}
        confirmLabel="Borrar bug"
        busyLabel="Borrando"
        onClose={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false)
          onConfirm()
        }}
      />
    </>
  )
}

// ─── Tarjeta de sección ──────────────────────────────────────────────────────

export function SectionCard({
  title,
  count,
  aside,
  children,
  accent = false,
}: {
  title: string
  count?: number
  aside?: React.ReactNode
  children: React.ReactNode
  accent?: boolean
}) {
  return (
    <section className={accent ? 'section-card-accent' : 'section-card'}>
      <header className="mb-3 flex items-center gap-2.5">
        <h3 className="kicker">{title}</h3>
        {count !== undefined && (
          <span className={`count-chip ${accent ? 'count-chip-accent' : ''}`}>{count}</span>
        )}
        {aside && <div className="ml-auto flex items-center gap-2">{aside}</div>}
      </header>
      {children}
    </section>
  )
}

// ─── Galería de capturas ─────────────────────────────────────────────────────

export function DocImageGallery({ images }: { images: DocImage[] }) {
  const [lightbox, setLightbox] = useState<DocImage | null>(null)

  return (
    <>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))' }}
      >
        {images.map((image, index) => (
          <button
            type="button"
            key={index}
            onClick={() => setLightbox(image)}
            className="overflow-hidden rounded-md transition-colors"
            style={{ border: `1px solid ${col.borderCard}`, background: col.subtle }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = col.accentPale
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = col.borderCard
            }}
          >
            <img
              src={`data:${image.mimeType};base64,${image.data}`}
              alt={image.alt || `Imagen ${index + 1}`}
              className="h-28 w-full object-contain"
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
            className="modal-backdrop"
            onClick={() => setLightbox(null)}
          />
          <div role="dialog" aria-modal="true" className="relative max-h-[90vh] max-w-5xl">
            <img
              src={`data:${lightbox.mimeType};base64,${lightbox.data}`}
              alt={lightbox.alt || 'Imagen del documento'}
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
              style={{ border: `1px solid ${col.borderCard}`, background: col.surface }}
            />
            {lightbox.alt && (
              <div className="mt-2 text-center text-xs" style={{ color: col.surface }}>
                {lightbox.alt}
              </div>
            )}
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="btn-icon btn-icon-sm absolute -top-3 -right-3 rounded-full"
              aria-label="cerrar"
            >
              <IconX size={12} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
