// Íconos funcionales line-art (un trazo, `currentColor`), tamaño en la escala de 4px
// (8/12/16/20/24). Son DECORATIVOS (`aria-hidden`): el significado lo da el texto que
// los acompaña.

interface IconProps {
  size?: number
  className?: string
}

const STROKE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function IconCheck({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function IconWarning({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

export function IconInfo({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  )
}

export function IconHelp({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.2 9.5a2.8 2.8 0 0 1 5.4 1c0 1.9-2.8 2.5-2.8 2.5" />
      <path d="M12 17h.01" />
    </svg>
  )
}

export function IconX({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  )
}

export function IconTrash({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  )
}

export function IconRestore({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}
