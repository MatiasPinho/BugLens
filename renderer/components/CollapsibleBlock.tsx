/**
 * CollapsibleBlock.tsx
 *
 * Recorta un bloque largo y ofrece "Ver más". Sirve para que lo que viene
 * después — típicamente los comentarios — quede al alcance sin atravesar varias
 * pantallas de reporte.
 *
 * Solo aparece el control si el contenido realmente lo justifica: un bloque que
 * apenas pasa el límite no gana nada con plegarse y sí molesta con un botón de
 * más.
 */

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

/** Alto visible por defecto cuando el bloque está plegado. */
const DEFAULT_MAX_HEIGHT = 340

/**
 * Cuánto tiene que sobrar para que valga la pena plegar. Sin esto, un bloque de
 * 350px contra un límite de 340 mostraría un "Ver más" que ahorra 10px.
 */
const MIN_WORTHWHILE_GAIN = 96

/** Lógica pura: ¿conviene ofrecer el plegado para este contenido? */
export function shouldOfferCollapse(
  contentHeight: number,
  maxHeight: number,
  minGain: number = MIN_WORTHWHILE_GAIN,
): boolean {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return false
  return contentHeight - maxHeight >= minGain
}

interface Props {
  children: ReactNode
  maxHeight?: number
  /** Qué se está desplegando, para el nombre accesible del botón. */
  label: string
  /** Deja el bloque siempre entero (ej. mientras llega salida en vivo). */
  disabled?: boolean
}

export default function CollapsibleBlock({
  children,
  maxHeight = DEFAULT_MAX_HEIGHT,
  label,
  disabled = false,
}: Props) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [collapsible, setCollapsible] = useState(false)

  const measure = useCallback(() => {
    const element = contentRef.current
    if (!element) return
    setCollapsible(!disabled && shouldOfferCollapse(element.scrollHeight, maxHeight))
  }, [disabled, maxHeight])

  // El contenido cambia de alto solo (imágenes del doc que cargan, la salida del
  // agente que llega en vivo), así que no alcanza con medir una vez al montar.
  useEffect(() => {
    const element = contentRef.current
    if (!element) return undefined
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [measure])

  const clipped = collapsible && !expanded

  return (
    <div className="collapsible-block">
      <div
        ref={contentRef}
        className={`collapsible-block-content ${clipped ? 'collapsible-block-clipped' : ''}`}
        style={clipped ? { maxHeight } : undefined}
        // Lo recortado no se ve pero sus botones seguirían siendo alcanzables
        // con Tab. `inert` los saca del foco y del árbol de accesibilidad.
        // React 18 no tipa el atributo; en el DOM se aplica igual.
        {...(clipped ? ({ inert: '' } as Record<string, string>) : {})}
      >
        {children}
      </div>

      {collapsible && (
        <button
          type="button"
          className="collapsible-block-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? `Ver menos de ${label}` : `Ver todo ${label}`}
        </button>
      )}
    </div>
  )
}
