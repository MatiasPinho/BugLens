/**
 * BugMotifs.tsx
 *
 * Marca de producto y motivos decorativos temáticos para complementar la UI.
 * Son line-art a un trazo (`currentColor`) y `aria-hidden`: el nombre BugLens
 * lo aporta el contenedor cuando la marca forma parte del chrome.
 *
 * On-brand BugLens: nada de imágenes externas ni color hardcodeado — solo trazo
 * que hereda el color del contenedor.
 */

import type { CSSProperties } from 'react'

interface MarkProps {
  className?: string
  style?: CSSProperties
}

interface BugLensMarkProps extends MarkProps {
  /** Simplifica el dibujo para conservar legibilidad en tamaños de hasta 24 px. */
  compact?: boolean
}

/**
 * Marca principal de BugLens: una lente que ordena las líneas de un reporte.
 * La variante compacta elimina detalle, pero conserva la misma silueta.
 */
export function BugLensMark({ className, compact = false, style }: BugLensMarkProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={compact ? 2.9 : 2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <circle cx={compact ? 13 : 13.4} cy={compact ? 13 : 13.4} r={compact ? 9.4 : 9.3} />
      <path
        d={compact ? 'M19.9 19.9 L27.4 27.4' : 'M20.2 20.2 L27.3 27.3'}
        strokeWidth={compact ? 3.6 : 3}
      />
      <path d={compact ? 'M8.4 10.4 H17.6' : 'M8.6 10.2 H18.2'} />
      <path
        d={compact ? 'M8.4 15.6 H14.4' : 'M8.6 13.6 H15'}
        opacity={0.72}
      />
      {!compact && <path d="M8.6 17 H18.2" />}
    </svg>
  )
}

// Escarabajo de frente, line-art geométrico. Hereda el color por `currentColor`.
export function BeetleMark({ className, style }: MarkProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 140"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {/* antenas */}
      <path d="M52 27 C46 14 40 10 33 8" />
      <path d="M68 27 C74 14 80 10 87 8" />
      <circle cx="33" cy="8" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="87" cy="8" r="2.4" fill="currentColor" stroke="none" />
      {/* cabeza */}
      <ellipse cx="60" cy="34" rx="14" ry="11" />
      {/* ojos */}
      <circle cx="54" cy="33" r="2" fill="currentColor" stroke="none" />
      <circle cx="66" cy="33" r="2" fill="currentColor" stroke="none" />
      {/* cuerpo (élitros) */}
      <ellipse cx="60" cy="86" rx="34" ry="44" />
      {/* línea de las alas + arco del pronoto */}
      <path d="M60 50 L60 126" />
      <path d="M40 58 Q60 49 80 58" />
      {/* patas izquierdas */}
      <path d="M30 66 L7 55" />
      <path d="M27 86 L3 86" />
      <path d="M30 106 L8 120" />
      {/* patas derechas */}
      <path d="M90 66 L113 55" />
      <path d="M93 86 L117 86" />
      <path d="M90 106 L112 120" />
      {/* manchas */}
      <circle cx="48" cy="74" r="3" fill="currentColor" stroke="none" />
      <circle cx="72" cy="92" r="3" fill="currentColor" stroke="none" />
      <circle cx="53" cy="106" r="3" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Lupa sobre un bicho — eco del logo (búsqueda) + el bug. Line-art a un trazo.
export function BugUnderLensMark({ className, style }: MarkProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      {/* lupa */}
      <circle cx="50" cy="50" r="34" />
      <path d="M75 75 L104 104" strokeWidth={3.4} />
      {/* bicho dentro de la lupa */}
      <ellipse cx="50" cy="54" rx="12" ry="16" />
      <path d="M50 38 L50 70" />
      <circle cx="50" cy="30" r="6" />
      <path d="M46 25 L40 18" />
      <path d="M54 25 L60 18" />
      {/* patitas */}
      <path d="M38 48 L28 43" />
      <path d="M38 56 L27 57" />
      <path d="M62 48 L72 43" />
      <path d="M62 56 L73 57" />
    </svg>
  )
}
