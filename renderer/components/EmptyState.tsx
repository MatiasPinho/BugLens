/**
 * EmptyState.tsx
 *
 * Estado vacío genérico: motivo decorativo + título + explicación + acción
 * opcional. Se usa cuando una lista no tiene nada que mostrar (sin bugs, sin
 * resultados para los filtros, sin notas). El contenido concreto lo pone cada
 * feature; acá vive solo la composición.
 */

import type React from 'react'
import { col } from '../theme'
import { BugUnderLensMark } from './decor/BugMotifs'

interface Props {
  title: string
  description?: string
  action?: React.ReactNode
  /** Motivo decorativo propio; por defecto la lupa con el bicho. */
  motif?: React.ReactNode
}

export default function EmptyState({ title, description, action, motif }: Props) {
  return (
    <div className="empty-state flex h-full flex-col items-center justify-center gap-4 p-10 text-center">
      <div className="empty-state-motif" aria-hidden="true">
        {motif ?? (
          <BugUnderLensMark className="motif-sway" style={{ width: 72, color: col.fgDisabled }} />
        )}
      </div>
      <div className="grid max-w-md gap-1.5">
        <p className="font-semibold text-lg">{title}</p>
        {description && (
          <p className="text-sm" style={{ color: col.fgMuted, textWrap: 'pretty' }}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}
