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

export function IconPlus({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  )
}

export function IconFolder({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </svg>
  )
}

export function IconSearch({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

export function IconUpload({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8 12 3 7 8" />
      <path d="M12 3v12" />
    </svg>
  )
}

export function IconChevronLeft({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <path d="M15 5 8 12l7 7" />
    </svg>
  )
}

export function IconChevronRight({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

export function IconGrid({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <rect x="3" y="4" width="18" height="7" rx="1.5" />
      <rect x="3" y="13" width="18" height="7" rx="1.5" />
    </svg>
  )
}

export function IconColumns({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M10 4v16" />
    </svg>
  )
}

export function IconSettings({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  )
}

export function IconLogout({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" />
    </svg>
  )
}

export function IconBug({ size = 16, className }: IconProps) {
  return (
    <svg aria-hidden="true" width={size} height={size} className={className} {...STROKE}>
      <ellipse cx="12" cy="14" rx="5" ry="6.5" />
      <path d="M12 7.5v13" />
      <circle cx="12" cy="4.5" r="2.5" />
      <path d="M10 2.8 8 1M14 2.8 16 1M7 12.5 3.5 11M7 15.5 3.5 16M17 12.5 20.5 11M17 15.5 20.5 16" />
    </svg>
  )
}
