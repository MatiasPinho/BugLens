/**
 * AppRail.tsx
 *
 * Navegación principal comprimida a un rail de iconos. Reemplaza al sidebar
 * ancho: el contexto (proyecto activo, identidad) vive ahora en `AppTopbar` y
 * los KPI en la propia pantalla de Bugs.
 *
 * Al no haber texto visible, CADA botón lleva `aria-label` + `title`: el label
 * es lo único que nombra el destino para lector de pantalla y para el tooltip.
 */

import type React from 'react'
import { BugLensMark } from './decor/BugMotifs'

export interface AppRailItem<T extends string> {
  key: T
  label: string
  count?: number
  icon: React.ReactNode
}

interface Props<T extends string> {
  items: AppRailItem<T>[]
  /** Destinos del grupo inferior (configuración): mismo tipo, otro lugar. */
  footerItems?: AppRailItem<T>[]
  active: T
  onSelect: (key: T) => void
  /** Acciones que no son destinos de navegación (ayuda, cerrar sesión). */
  actions?: React.ReactNode
}

export default function AppRail<T extends string>({
  items,
  footerItems = [],
  active,
  onSelect,
  actions,
}: Props<T>) {
  return (
    <nav className="app-rail" aria-label="navegación principal">
      <span
        className="app-brand-mark app-rail-brand"
        role="img"
        aria-label="BugLens"
        title="BugLens"
      >
        <BugLensMark compact style={{ width: 20 }} />
      </span>

      <div className="app-rail-group">
        {items.map((item) => (
          <RailButton key={item.key} item={item} active={active === item.key} onSelect={onSelect} />
        ))}
      </div>

      <div className="app-rail-group app-rail-group-footer">
        {footerItems.map((item) => (
          <RailButton key={item.key} item={item} active={active === item.key} onSelect={onSelect} />
        ))}
        {actions}
      </div>
    </nav>
  )
}

function RailButton<T extends string>({
  item,
  active,
  onSelect,
}: {
  item: AppRailItem<T>
  active: boolean
  onSelect: (key: T) => void
}) {
  // El contador va dentro del label accesible: en el rail se ve como un número
  // suelto y por sí solo no dice de qué es.
  const label = item.count && item.count > 0 ? `${item.label} (${item.count})` : item.label

  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      title={label}
      onClick={() => onSelect(item.key)}
      className={`app-rail-item ${active ? 'app-rail-item-active' : ''}`}
    >
      {item.icon}
      {item.count !== undefined && item.count > 0 && (
        <span className="app-rail-count" aria-hidden="true">
          {item.count > 99 ? '99+' : item.count}
        </span>
      )}
    </button>
  )
}
